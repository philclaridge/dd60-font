// @ts-check

/**
 * Vector-based character renderer
 * Uses CDC character ROM data to draw vector strokes
 * @module renderers/vectorMode
 */

import { BASE_CELL_SIZE, GRID_CELLS, CDC_CHARACTERS } from '../config.js';
import { getCharacterVector, simplifyVector } from '../rom/decoder.js';
import { prepareCanvas, drawAtlasOriginOverlay, drawCharOriginOverlay } from './common.js';

/**
 * Offset for crisp 1px lines at integer coordinates
 * Added to coordinates so lines are centered on pixel boundaries
 */
const CRISP_LINE_OFFSET = 0.5;

/**
 * Convert CDC coordinate to canvas X position with crisp line offset
 * CDC origin is at (originOffsetX, originOffsetY) from cell bottom-left
 * @param {number} cdcX - CDC X coordinate (0-6)
 * @param {number} cellX - Cell left edge in display units
 * @param {number} originOffsetX - Origin X offset from cell left (pre-scaled)
 * @param {number} characterScale - Character scale factor
 * @param {number} pixelScale - Pixel scale factor
 * @returns {number} Canvas X position
 */
function cdcToCanvasX(cdcX, cellX, originOffsetX, characterScale, pixelScale) {
    // Base position: cell + origin offset + scaled CDC coordinate
    // Add crisp offset (divided by pixelScale to get 0.5 pixels after transform)
    return cellX + originOffsetX + cdcX * characterScale + CRISP_LINE_OFFSET / pixelScale;
}

/**
 * Convert CDC coordinate to canvas Y position with crisp line offset
 * CDC Y increases upward, canvas Y increases downward
 * @param {number} cdcY - CDC Y coordinate (0-6)
 * @param {number} cellY - Cell top edge in display units
 * @param {number} cellSize - Cell size in display units
 * @param {number} originOffsetY - Origin Y offset from cell bottom (pre-scaled)
 * @param {number} characterScale - Character scale factor
 * @param {number} pixelScale - Pixel scale factor
 * @returns {number} Canvas Y position
 */
function cdcToCanvasY(cdcY, cellY, cellSize, originOffsetY, characterScale, pixelScale) {
    // Bottom of cell in canvas coords, adjusted for pixel boundary
    const bottom = cellY + cellSize - 1/pixelScale;
    // Origin is originOffsetY up from bottom, CDC Y increases upward (scaled)
    // Add crisp offset (divided by pixelScale to get 0.5 pixels after transform)
    return bottom - originOffsetY - cdcY * characterScale + CRISP_LINE_OFFSET / pixelScale;
}

/**
 * Configure stroke style for vector rendering
 * Uses butt caps for thin lines (<3px), round caps for thicker lines
 * @param {CanvasRenderingContext2D} ctx - Canvas 2D context
 * @param {number} lineWidth - Line width in display units
 * @param {number} pixelScale - Pixel scale factor (line width in pixels = lineWidth * pixelScale)
 * @param {string} color - Stroke color
 */
function setupStrokeStyle(ctx, lineWidth, pixelScale, color) {
    ctx.strokeStyle = color;
    ctx.lineWidth = lineWidth;

    // Line width in pixels after transform
    const lineWidthPixels = lineWidth * pixelScale;

    // Use round caps/joins for thicker lines (>=3px), butt/miter for thin
    if (lineWidthPixels >= 3) {
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
    } else {
        ctx.lineCap = 'butt';
        ctx.lineJoin = 'miter';
    }
}

/**
 * Draw a single character using vector strokes
 *
 * Interprets triplet [x, y, intensity] as:
 * - intensity=1: DRAW visible line FROM previous position TO (x,y)
 * - intensity=0: MOVE invisibly, just update position
 *
 * @param {CanvasRenderingContext2D} ctx - Canvas 2D context
 * @param {string} char - Character to draw
 * @param {number} cellX - Cell left edge in display units
 * @param {number} cellY - Cell top edge in display units
 * @param {number} cellSize - Cell size in display units
 * @param {number} originOffsetX - Origin X offset (scaled by characterScale)
 * @param {number} originOffsetY - Origin Y offset (scaled by characterScale)
 * @param {number} characterScale - Character scale factor
 * @param {number} pixelScale - Pixel scale factor
 */
function drawCharacterStrokes(ctx, char, cellX, cellY, cellSize, originOffsetX, originOffsetY, characterScale, pixelScale) {
    const vectorData = getCharacterVector(char);
    const simplified = simplifyVector(vectorData);

    if (!simplified || simplified.length === 0) {
        return;
    }

    // Start at CDC origin (0, 0)
    let prevCdcX = 0;
    let prevCdcY = 0;

    for (const [cdcX, cdcY, intensity] of simplified) {
        if (intensity === 1) {
            // DRAW: visible line from previous position to current position
            const prevCanvasX = cdcToCanvasX(prevCdcX, cellX, originOffsetX, characterScale, pixelScale);
            const prevCanvasY = cdcToCanvasY(prevCdcY, cellY, cellSize, originOffsetY, characterScale, pixelScale);
            const canvasX = cdcToCanvasX(cdcX, cellX, originOffsetX, characterScale, pixelScale);
            const canvasY = cdcToCanvasY(cdcY, cellY, cellSize, originOffsetY, characterScale, pixelScale);

            ctx.beginPath();
            ctx.moveTo(prevCanvasX, prevCanvasY);
            ctx.lineTo(canvasX, canvasY);
            ctx.stroke();
        }
        // intensity=0: MOVE invisibly, no drawing

        // Always update previous position
        prevCdcX = cdcX;
        prevCdcY = cdcY;
    }
}

/**
 * Draw all characters in the grid using vector strokes
 * @param {CanvasRenderingContext2D} ctx - Canvas 2D context
 * @param {number} cellSize - Cell size in display units
 * @param {number} originOffsetX - Origin X offset (scaled by characterScale)
 * @param {number} originOffsetY - Origin Y offset (scaled by characterScale)
 * @param {number} characterScale - Character scale factor
 * @param {number} pixelScale - Pixel scale factor
 * @param {string} fgColor - Foreground color
 */
function drawAllCharacters(ctx, cellSize, originOffsetX, originOffsetY, characterScale, pixelScale, fgColor) {
    // Line width is 1 display unit
    setupStrokeStyle(ctx, 1, pixelScale, fgColor);

    for (let row = 0; row < GRID_CELLS; row++) {
        for (let col = 0; col < GRID_CELLS; col++) {
            const index = row * GRID_CELLS + col;
            const char = CDC_CHARACTERS[index];
            if (char && char !== ' ') {
                drawCharacterStrokes(ctx, char, col * cellSize, row * cellSize, cellSize, originOffsetX, originOffsetY, characterScale, pixelScale);
            }
        }
    }
}

/**
 * Vector mode renderer - uses character ROM data to draw strokes
 * @type {import('./types.js').Renderer}
 */
export const vectorModeRenderer = {
    name: 'Vector Mode',
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
        const originOffsetX = config.originOffsetX * config.characterScale;
        const originOffsetY = config.originOffsetY * config.characterScale;
        drawAllCharacters(ctx, cellSize, originOffsetX, originOffsetY, config.characterScale, config.pixelScale, config.fgColor);

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

        // Draw character at cell origin (0, 0)
        const originOffsetX = config.originOffsetX * config.characterScale;
        const originOffsetY = config.originOffsetY * config.characterScale;

        setupStrokeStyle(ctx, 1, config.pixelScale, config.fgColor);
        drawCharacterStrokes(ctx, char, 0, 0, cellSize, originOffsetX, originOffsetY, config.characterScale, config.pixelScale);

        // Reset transform
        ctx.setTransform(1, 0, 0, 1, 0, 0);

        // Draw origin marker on top of character
        drawCharOriginOverlay(ctx, cellPixelSize, config);
    }
};
