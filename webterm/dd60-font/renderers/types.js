// @ts-check

/**
 * Renderer type definitions
 * @module renderers/types
 */

/**
 * Render configuration passed to renderers
 * @typedef {Object} RenderConfig
 * @property {number} characterScale - Character scale multiplier (1, 2, or 4)
 * @property {number} pixelScale - Pixel scale multiplier
 * @property {number} originOffsetX - Origin X offset in base units
 * @property {number} originOffsetY - Origin Y offset in base units
 * @property {boolean} showGrid - Show checkerboard pattern
 * @property {boolean} showOrigin - Show origin markers
 * @property {number} beamWidth - Beam width multiplier
 * @property {number} brightness - Brightness multiplier
 * @property {number} filterCutoffX - X deflection biquad filter cutoff (fraction of sample rate)
 * @property {number} filterCutoffY - Y deflection biquad filter cutoff (fraction of sample rate)
 * @property {number} filterQX - X deflection biquad filter Q factor (0.3-2.0)
 * @property {number} filterQY - Y deflection biquad filter Q factor (0.3-2.0)
 * @property {number} filterGainX - X deflection gain multiplier
 * @property {number} filterGainY - Y deflection gain multiplier
 * @property {number} filterZ - Z beam IIR filter retention (0-0.99)
 * @property {string} blendMode - Canvas composite operation for spot rendering
 * @property {string} fgColor - Foreground color
 * @property {string} bgColor - Background color
 * @property {string} checkerColor - Checkerboard color
 * @property {string} originColor - Origin marker color
 */

/**
 * Renderer interface - each rendering mode must implement this
 * @typedef {Object} Renderer
 * @property {string} name - Display name of the renderer
 * @property {string[]} supportedControls - Control IDs this renderer uses
 * @property {function(CanvasRenderingContext2D, number, RenderConfig): void} renderAtlas - Render complete atlas
 * @property {function(CanvasRenderingContext2D, string, number, RenderConfig): void} renderCharacter - Render single character
 * @property {function(): void} [init] - Optional initialization
 * @property {function(): void} [cleanup] - Optional cleanup
 */

// Export empty to make this a module
export {};
