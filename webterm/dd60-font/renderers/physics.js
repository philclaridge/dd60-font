// @ts-check

/**
 * Shared physics simulation for CRT beam emulation
 * Used by both crtMode and gaussianMode renderers
 * @module renderers/physics
 */

import { BASE_CELL_SIZE } from '../config.js';

/**
 * Default physics simulation parameters
 */
export const PHYSICS_DEFAULTS = {
    /** Subsample factor - replicate each ROM row this many times */
    subsampleFactor: 64,
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
 * Filtered beam position
 * @typedef {Object} FilteredPosition
 * @property {number} x - X position (in scaled coordinates)
 * @property {number} y - Y position (in scaled coordinates)
 * @property {number} z - Beam intensity (0-1)
 */

/**
 * Calculate biquad low-pass filter coefficients
 * @param {number} cutoff - Cutoff frequency as fraction of sample rate (0 to 0.5)
 * @param {number} Q - Q factor (0.5 = overdamped, 0.707 = Butterworth, >1 = resonant)
 * @returns {BiquadCoeffs}
 */
export function calculateBiquadCoeffs(cutoff, Q) {
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
export function createBiquadState(initialValue) {
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
export function applyBiquad(input, state, coeffs) {
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
export function applyIIR(input, prev, retention) {
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
 * @param {BiquadCoeffs} xyCoeffs - X/Y biquad filter coefficients (shared, or X-only if yCoeffs provided)
 * @param {number} retentionZ - Beam intensity filter retention
 * @param {number} characterScale - Character scale multiplier (applied before filtering)
 * @param {Object} [options] - Optional parameters
 * @param {BiquadCoeffs} [options.yCoeffs] - Separate Y filter coefficients
 * @param {number} [options.xGain=1.0] - X deflection gain multiplier
 * @param {number} [options.yGain=1.0] - Y deflection gain multiplier
 * @returns {FilteredPosition[]} Filtered positions (in scaled coordinates)
 */
export function processCharacterPhysics(vectorData, subsampleFactor, xyCoeffs, retentionZ, characterScale, options = {}) {
    if (!vectorData || vectorData.length === 0) {
        return [];
    }

    // Extract optional parameters with defaults
    const xCoeffs = xyCoeffs;
    const yCoeffs = options.yCoeffs || xyCoeffs;
    const xGain = options.xGain ?? 1.0;
    const yGain = options.yGain ?? 1.0;

    /** @type {FilteredPosition[]} */
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
            // Apply biquad filter to scaled X and Y (with separate coefficients and gains)
            const filteredX = applyBiquad(scaledX, xState, xCoeffs) * xGain;
            const filteredY = applyBiquad(scaledY, yState, yCoeffs) * yGain;
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
export function scaledToCanvas(scaledX, scaledY, cellPixelSize, characterScale, originOffsetX, originOffsetY) {
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
