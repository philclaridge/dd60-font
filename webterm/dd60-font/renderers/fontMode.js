// @ts-check

/**
 * Font-based character renderer
 * Uses system font via fillText() - no vector or CRT effects
 * @module renderers/fontMode
 */

import { BASE_CELL_SIZE, GRID_CELLS, CDC_CHARACTERS } from '../config.js';
import { prepareCanvas, drawAtlasOriginOverlay, drawCharOriginOverlay } from './common.js';

/**
 * Character offset from origin in CDC units (scales with characterScale)
 * These position the character center relative to the cell origin
 */
const CHAR_OFFSET_X = 2;  // CDC units right of origin
const CHAR_OFFSET_Y = 2;  // CDC units up from origin (Y increases upward in CDC coords)

/**
 * Fine-tuning offset in fixed display pixels (does NOT scale)
 * Applied in canvas coordinates (Y increases downward)
 */
const PIXEL_ADJUST_X = 0;  // fixed pixels right
const PIXEL_ADJUST_Y = 1;  // fixed pixels down

/**
 * Calculate character center position in display coordinates
 *
 * Combines three offset types:
 * 1. Origin offset: positions the CDC origin within the cell (scales with characterScale)
 * 2. Character offset: CDC-based offset from origin (scales with characterScale)
 * 3. Pixel adjustment: fixed pixel offset (divided by pixelScale to cancel transform scaling)
 *
 * @param {number} cellX - Cell left edge in display units
 * @param {number} cellY - Cell top edge in display units
 * @param {number} cellSize - Cell size in display units
 * @param {number} originOffsetX - Origin X offset from cell left (scaled by characterScale)
 * @param {number} originOffsetY - Origin Y offset from cell bottom (scaled by characterScale)
 * @param {number} pixelScale - Pixel scale factor
 * @returns {{x: number, y: number}} Character center position in display coordinates
 */
function calcCharPosition(cellX, cellY, cellSize, originOffsetX, originOffsetY, pixelScale) {
    const scale = cellSize / BASE_CELL_SIZE;

    // Origin position in canvas coords (Y inverted: bottom = cellY + cellSize - 1)
    // Use 1/pixelScale so it becomes exactly 1 pixel after transform
    const originX = cellX + originOffsetX;
    const originY = cellY + cellSize - 1/pixelScale - originOffsetY;

    // Character offset from origin (CDC units, scaled)
    const charOffsetX = CHAR_OFFSET_X * scale;
    const charOffsetY = CHAR_OFFSET_Y * scale;

    // Final position with fixed pixel adjustment
    // Divide by pixelScale so adjustment becomes fixed pixels after transform
    return {
        x: originX + charOffsetX + PIXEL_ADJUST_X / pixelScale,
        y: originY - charOffsetY + PIXEL_ADJUST_Y / pixelScale
    };
}

/**
 * Configure context for font rendering
 * @param {CanvasRenderingContext2D} ctx - Canvas 2D context
 * @param {number} cellSize - Cell size in display units
 * @param {string} fgColor - Foreground color
 */
function setupCharacterFont(ctx, cellSize, fgColor) {
    const fontSize = Math.floor(cellSize * 0.8);
    ctx.fillStyle = fgColor;
    ctx.font = `${fontSize}px monospace`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
}

/**
 * Draw a single character centered at position
 * @param {CanvasRenderingContext2D} ctx - Canvas 2D context
 * @param {string} char - Character to draw
 * @param {number} x - Center X position
 * @param {number} y - Center Y position
 */
function drawChar(ctx, char, x, y) {
    if (char && char !== ' ') {
        ctx.fillText(char, x, y);
    }
}

/**
 * Draw all characters in the grid
 * @param {CanvasRenderingContext2D} ctx - Canvas 2D context
 * @param {number} cellSize - Cell size in display units
 * @param {number} originOffsetX - Origin X offset (scaled by characterScale)
 * @param {number} originOffsetY - Origin Y offset (scaled by characterScale)
 * @param {number} pixelScale - Pixel scale factor
 * @param {string} fgColor - Foreground color
 */
function drawAllCharacters(ctx, cellSize, originOffsetX, originOffsetY, pixelScale, fgColor) {
    setupCharacterFont(ctx, cellSize, fgColor);

    for (let row = 0; row < GRID_CELLS; row++) {
        for (let col = 0; col < GRID_CELLS; col++) {
            const index = row * GRID_CELLS + col;
            const char = CDC_CHARACTERS[index];
            const pos = calcCharPosition(col * cellSize, row * cellSize, cellSize, originOffsetX, originOffsetY, pixelScale);
            drawChar(ctx, char, pos.x, pos.y);
        }
    }
}

/**
 * Font mode renderer - uses system font via fillText()
 * @type {import('./types.js').Renderer}
 */
export const fontModeRenderer = {
    name: 'Font Mode',
    supportedControls: ['showGrid', 'showOrigin', 'characterScale', 'pixelScale', 'detailChar', 'detailMag'],

    /**
     * Render the complete font atlas
     * @param {CanvasRenderingContext2D} ctx - Canvas 2D context
     * @param {number} canvasSize - Canvas size in pixels
     * @param {import('./types.js').RenderConfig} config - Render configuration
     */
    renderAtlas(ctx, canvasSize, config) {
        const cellSize = BASE_CELL_SIZE * config.characterScale;
        const cellPixelSize = cellSize * config.pixelScale;

        // Clear background and draw checkerboard
        prepareCanvas(ctx, canvasSize, config);

        // Apply pixel scale transform for character rendering
        ctx.setTransform(config.pixelScale, 0, 0, config.pixelScale, 0, 0);

        // Draw characters in display units
        const originOffsetXScaled = config.originOffsetX * config.characterScale;
        const originOffsetYScaled = config.originOffsetY * config.characterScale;
        drawAllCharacters(ctx, cellSize, originOffsetXScaled, originOffsetYScaled, config.pixelScale, config.fgColor);

        // Reset transform
        ctx.setTransform(1, 0, 0, 1, 0, 0);

        // Draw origin markers on top of characters
        drawAtlasOriginOverlay(ctx, GRID_CELLS, cellPixelSize, config);
    },

    /**
     * Render a single character for detail view
     * @param {CanvasRenderingContext2D} ctx - Canvas 2D context
     * @param {string} char - Character to render
     * @param {number} cellPixelSize - Cell size in pixels
     * @param {import('./types.js').RenderConfig} config - Render configuration
     */
    renderCharacter(ctx, char, cellPixelSize, config) {
        const cellSize = BASE_CELL_SIZE * config.characterScale;

        // Clear background and draw checkerboard
        prepareCanvas(ctx, cellPixelSize, config);

        // Apply pixel scale transform for character rendering
        ctx.setTransform(config.pixelScale, 0, 0, config.pixelScale, 0, 0);

        // Calculate character position (cell at 0,0 for single character view)
        const originOffsetX = config.originOffsetX * config.characterScale;
        const originOffsetY = config.originOffsetY * config.characterScale;
        const pos = calcCharPosition(0, 0, cellSize, originOffsetX, originOffsetY, config.pixelScale);

        setupCharacterFont(ctx, cellSize, config.fgColor);
        drawChar(ctx, char, pos.x, pos.y);

        // Reset transform
        ctx.setTransform(1, 0, 0, 1, 0, 0);

        // Draw origin marker on top of character
        drawCharOriginOverlay(ctx, cellPixelSize, config);
    }
};
