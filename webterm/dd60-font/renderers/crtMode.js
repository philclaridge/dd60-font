// @ts-check

/**
 * CRT physics-based character renderer
 * Simulates authentic DD60 visual characteristics with spot-based rendering
 * @module renderers/crtMode
 */

import { BASE_CELL_SIZE, GRID_CELLS, CDC_CHARACTERS } from '../config.js';
import { prepareCanvas, drawAtlasOriginOverlay, drawCharOriginOverlay } from './common.js';
import { getCharacterVector } from '../rom/decoder.js';
import {
    PHYSICS_DEFAULTS,
    calculateBiquadCoeffs,
    processCharacterPhysics,
    scaledToCanvas
} from './physics.js';

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
        PHYSICS_DEFAULTS.subsampleFactor,
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
        if (pos.z < PHYSICS_DEFAULTS.beamThreshold) {
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
        // Empirical kludge: /25 to get ROM + Physics and ROM + Gaussian brightness similar
        const alpha = Math.min(1, pos.z * config.brightness / 25);
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
