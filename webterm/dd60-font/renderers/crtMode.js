// @ts-check

/**
 * CRT physics-based character renderer
 * Simulates authentic DD60 visual characteristics including:
 * - Beam velocity brightness variation
 * - Analog bandwidth corner rounding
 * - Phosphor bloom/glow effects
 * @module renderers/crtMode
 */

import { BASE_CELL_SIZE, GRID_CELLS, CDC_CHARACTERS } from '../config.js';
import { prepareCanvas, drawAtlasOriginOverlay, drawCharOriginOverlay } from './common.js';
import { getCharacterVector } from '../rom/decoder.js';

/**
 * Physics simulation parameters (non-configurable defaults)
 */
const PHYSICS = {
    /** Subsample factor - replicate each ROM row this many times */
    subsampleFactor: 64,
    /** Spot radius in pixels for visualization */
    spotRadius: 1.5,
    /** Minimum beam intensity to draw (0-1) */
    beamThreshold: 0.01
};

/**
 * Biquad filter coefficients
 * @typedef {Object} BiquadCoeffs
 * @property {number} b0
 * @property {number} b1
 * @property {number} b2
 * @property {number} a1
 * @property {number} a2
 */

/**
 * Biquad filter state (for one axis)
 * @typedef {Object} BiquadState
 * @property {number} x1 - x[n-1]
 * @property {number} x2 - x[n-2]
 * @property {number} y1 - y[n-1]
 * @property {number} y2 - y[n-2]
 */

/**
 * Calculate biquad low-pass filter coefficients
 * @param {number} cutoff - Cutoff frequency as fraction of sample rate (0 to 0.5)
 * @param {number} Q - Q factor (0.5 = overdamped, 0.707 = Butterworth, >1 = resonant)
 * @returns {BiquadCoeffs}
 */
function calculateBiquadCoeffs(cutoff, Q) {
    const omega = 2 * Math.PI * cutoff;
    const sinOmega = Math.sin(omega);
    const cosOmega = Math.cos(omega);
    const alpha = sinOmega / (2 * Q);

    const b0 = (1 - cosOmega) / 2;
    const b1 = 1 - cosOmega;
    const b2 = (1 - cosOmega) / 2;
    const a0 = 1 + alpha;
    const a1 = -2 * cosOmega;
    const a2 = 1 - alpha;

    // Normalize by a0
    return {
        b0: b0 / a0,
        b1: b1 / a0,
        b2: b2 / a0,
        a1: a1 / a0,
        a2: a2 / a0
    };
}

/**
 * Create initial biquad filter state
 * @param {number} initialValue - Initial value for all state
 * @returns {BiquadState}
 */
function createBiquadState(initialValue) {
    return {
        x1: initialValue,
        x2: initialValue,
        y1: initialValue,
        y2: initialValue
    };
}

/**
 * Apply biquad filter to a single sample
 * y[n] = b0*x[n] + b1*x[n-1] + b2*x[n-2] - a1*y[n-1] - a2*y[n-2]
 * @param {number} input - Input sample x[n]
 * @param {BiquadState} state - Filter state (modified in place)
 * @param {BiquadCoeffs} coeffs - Filter coefficients
 * @returns {number} Output sample y[n]
 */
function applyBiquad(input, state, coeffs) {
    const output = coeffs.b0 * input
                 + coeffs.b1 * state.x1
                 + coeffs.b2 * state.x2
                 - coeffs.a1 * state.y1
                 - coeffs.a2 * state.y2;

    // Shift state
    state.x2 = state.x1;
    state.x1 = input;
    state.y2 = state.y1;
    state.y1 = output;

    return output;
}

/**
 * Apply simple 1st-order IIR filter (for beam intensity)
 * @param {number} input - Input value
 * @param {number} prev - Previous output value
 * @param {number} retention - Retention factor (0 to 0.99)
 * @returns {number} Filtered output
 */
function applyIIR(input, prev, retention) {
    return (1 - retention) * input + retention * prev;
}

/**
 * Subsample and filter character vector data using biquad filters
 *
 * Hardware signal path: ROM delta → bit shift (charScale) → accumulator → 9-bit DAC → amplifier
 * The analog amplifier sees larger voltage steps at larger character scales, so we must
 * apply character scaling BEFORE filtering to match the hardware behavior.
 *
 * @param {import('../rom/decoder.js').VectorCoord[]} vectorData - Raw vector coordinates (0-6)
 * @param {number} subsampleFactor - Number of times to replicate each row
 * @param {BiquadCoeffs} xyCoeffs - X/Y biquad filter coefficients
 * @param {number} retentionZ - Beam intensity filter retention
 * @param {number} characterScale - Character scale multiplier (applied before filtering)
 * @returns {Array<{x: number, y: number, z: number}>} Filtered positions (in scaled coordinates)
 */
function processCharacterPhysics(vectorData, subsampleFactor, xyCoeffs, retentionZ, characterScale) {
    if (!vectorData || vectorData.length === 0) {
        return [];
    }

    /** @type {Array<{x: number, y: number, z: number}>} */
    const filteredPositions = [];

    // Initialize filter states to first position (scaled)
    const firstPos = vectorData[0];
    const xState = createBiquadState(firstPos[0] * characterScale);
    const yState = createBiquadState(firstPos[1] * characterScale);
    let zState = firstPos[2];

    // Process each ROM timing row
    for (const [x, y, beam] of vectorData) {
        // Apply character scale BEFORE filtering (matches hardware: bit shift before DAC)
        const scaledX = x * characterScale;
        const scaledY = y * characterScale;

        // Replicate each row subsampleFactor times
        for (let s = 0; s < subsampleFactor; s++) {
            // Apply biquad filter to scaled X and Y
            const filteredX = applyBiquad(scaledX, xState, xyCoeffs);
            const filteredY = applyBiquad(scaledY, yState, xyCoeffs);
            // Apply simple IIR to beam intensity
            zState = applyIIR(beam, zState, retentionZ);

            // Store filtered position (already in scaled coordinates)
            filteredPositions.push({
                x: filteredX,
                y: filteredY,
                z: zState
            });
        }
    }

    return filteredPositions;
}

/**
 * Convert pre-scaled coordinates to canvas pixel coordinates
 * Input coordinates are already scaled by characterScale (from physics simulation)
 * Canvas: origin top-left, Y down
 * @param {number} scaledX - X coordinate (already scaled by characterScale)
 * @param {number} scaledY - Y coordinate (already scaled by characterScale)
 * @param {number} cellPixelSize - Cell size in pixels
 * @param {number} characterScale - Character scale multiplier (for origin offset calculation)
 * @param {number} originOffsetX - Origin X offset in base units
 * @param {number} originOffsetY - Origin Y offset in base units
 * @returns {{canvasX: number, canvasY: number}}
 */
function scaledToCanvas(scaledX, scaledY, cellPixelSize, characterScale, originOffsetX, originOffsetY) {
    // Pixels per scaled unit (cellPixelSize covers BASE_CELL_SIZE * characterScale units)
    const pixelsPerUnit = cellPixelSize / (BASE_CELL_SIZE * characterScale);

    // Origin offset (in scaled coordinates, then to pixels)
    const offsetX = originOffsetX * characterScale * pixelsPerUnit;
    const offsetY = originOffsetY * characterScale * pixelsPerUnit;

    // Convert scaled coordinates to pixels (no additional scaling needed)
    const pixelX = scaledX * pixelsPerUnit;
    const pixelY = scaledY * pixelsPerUnit;

    // Apply origin offset and flip Y (CDC Y=0 is bottom, canvas Y=0 is top)
    const canvasX = offsetX + pixelX;
    const canvasY = cellPixelSize - offsetY - pixelY;

    return { canvasX, canvasY };
}

/**
 * Render a single character with physics simulation
 * @param {CanvasRenderingContext2D} ctx - Canvas context
 * @param {string} char - Character to render
 * @param {number} cellPixelSize - Cell size in pixels
 * @param {number} offsetX - X offset for atlas rendering
 * @param {number} offsetY - Y offset for atlas rendering
 * @param {import('./types.js').RenderConfig} config - Render configuration
 */
function renderCharacterPhysics(ctx, char, cellPixelSize, offsetX, offsetY, config) {
    // Get FULL vector data from ROM (all 23 timing rows, not simplified)
    // Each row represents 100ns - critical for accurate physics simulation
    // Includes: beam-off positioning, dwelling at vertices, all timing
    const vectorData = getCharacterVector(char);
    if (!vectorData || vectorData.length === 0) {
        return;
    }

    // Calculate biquad coefficients from config
    const xyCoeffs = calculateBiquadCoeffs(config.filterCutoff, config.filterQ);

    // Process through physics simulation (characterScale applied BEFORE filtering)
    const filteredPositions = processCharacterPhysics(
        vectorData,
        PHYSICS.subsampleFactor,
        xyCoeffs,
        config.filterZ,
        config.characterScale
    );

    // Parse foreground color for alpha modulation
    const fgColor = config.fgColor;

    // Spot radius from beam width (focus) control
    const spotRadius = config.beamWidth;

    // Set blend mode for spot rendering
    ctx.globalCompositeOperation = /** @type {GlobalCompositeOperation} */ (config.blendMode);

    for (const pos of filteredPositions) {
        // Only draw if beam intensity above threshold
        if (pos.z < PHYSICS.beamThreshold) {
            continue;
        }

        // Convert pre-scaled coordinates to canvas coordinates
        const { canvasX, canvasY } = scaledToCanvas(
            pos.x,
            pos.y,
            cellPixelSize,
            config.characterScale,
            config.originOffsetX,
            config.originOffsetY
        );

        // Modulate alpha based on beam intensity and brightness control
        const alpha = Math.min(1, pos.z * config.brightness);
        ctx.fillStyle = fgColor + Math.round(alpha * 255).toString(16).padStart(2, '0');

        // Draw circular spot at position
        ctx.beginPath();
        ctx.arc(
            offsetX + canvasX,
            offsetY + canvasY,
            spotRadius,
            0,
            2 * Math.PI
        );
        ctx.fill();
    }
}

/**
 * CRT mode renderer - physics-based DD60 emulation
 * @type {import('./types.js').Renderer}
 */
export const crtModeRenderer = {
    name: 'CRT Mode',
    supportedControls: ['showGrid', 'showOrigin', 'characterScale', 'pixelScale', 'filterCutoff', 'filterQ', 'filterZ', 'brightness', 'beamWidth', 'blendMode', 'detailChar', 'detailMag'],

    /**
     * Render the complete font atlas with CRT physics
     * @param {CanvasRenderingContext2D} ctx - Canvas 2D context
     * @param {number} canvasSize - Canvas size in pixels
     * @param {import('./types.js').RenderConfig} config - Render configuration
     */
    renderAtlas(ctx, canvasSize, config) {
        const cellSize = BASE_CELL_SIZE * config.characterScale;
        const cellPixelSize = cellSize * config.pixelScale;

        // Clear background and draw checkerboard
        prepareCanvas(ctx, canvasSize, config);

        // Render each character in the 8x8 grid
        for (let row = 0; row < GRID_CELLS; row++) {
            for (let col = 0; col < GRID_CELLS; col++) {
                const charIndex = row * GRID_CELLS + col;
                const char = CDC_CHARACTERS[charIndex];

                const offsetX = col * cellPixelSize;
                const offsetY = row * cellPixelSize;

                renderCharacterPhysics(ctx, char, cellPixelSize, offsetX, offsetY, config);
            }
        }

        // Reset transform
        ctx.setTransform(1, 0, 0, 1, 0, 0);

        // Draw origin markers on top of characters
        drawAtlasOriginOverlay(ctx, GRID_CELLS, cellPixelSize, config);
    },

    /**
     * Render a single character with CRT physics for detail view
     * @param {CanvasRenderingContext2D} ctx - Canvas 2D context
     * @param {string} char - Character to render
     * @param {number} cellPixelSize - Cell size in pixels
     * @param {import('./types.js').RenderConfig} config - Render configuration
     */
    renderCharacter(ctx, char, cellPixelSize, config) {
        // Clear background and draw checkerboard
        prepareCanvas(ctx, cellPixelSize, config);

        // Render character with physics
        renderCharacterPhysics(ctx, char, cellPixelSize, 0, 0, config);

        // Reset transform
        ctx.setTransform(1, 0, 0, 1, 0, 0);

        // Draw origin marker on top of character
        drawCharOriginOverlay(ctx, cellPixelSize, config);
    }
};
