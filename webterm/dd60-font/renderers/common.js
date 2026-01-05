// @ts-check

/**
 * Shared rendering utilities
 * @module renderers/common
 */

/**
 * Draw checkerboard pattern showing pixel boundaries
 * @param {CanvasRenderingContext2D} ctx - Canvas 2D context
 * @param {number} size - Total size in pixels
 * @param {string} checkerColor - Checkerboard color
 */
export function drawCheckerboard(ctx, size, checkerColor) {
    ctx.fillStyle = checkerColor;
    for (let y = 0; y < size; y++) {
        for (let x = 0; x < size; x++) {
            if ((x + y) % 2 === 0) {
                ctx.fillRect(x, y, 1, 1);
            }
        }
    }
}

/**
 * Draw origin marker at specified cell position
 * Units are in current coordinate system (display units or pixels)
 * @param {CanvasRenderingContext2D} ctx - Canvas 2D context
 * @param {number} cellX - Cell X position
 * @param {number} cellY - Cell Y position (top of cell)
 * @param {number} cellSize - Cell size
 * @param {number} offsetX - Origin X offset from cell bottom-left
 * @param {number} offsetY - Origin Y offset from cell bottom-left
 * @param {string} originColor - Origin marker color
 */
export function drawOriginMarker(ctx, cellX, cellY, cellSize, offsetX, offsetY, originColor) {
    ctx.fillStyle = originColor;
    // Canvas y increases downward, so bottom = cellY + cellSize - 1
    const x = cellX + offsetX;
    const y = cellY + cellSize - 1 - offsetY;
    // Draw 3x3 cross pattern
    ctx.fillRect(x, y, 1, 1);      // center
    ctx.fillRect(x - 1, y, 1, 1);  // left
    ctx.fillRect(x + 1, y, 1, 1);  // right
    ctx.fillRect(x, y - 1, 1, 1);  // top
    ctx.fillRect(x, y + 1, 1, 1);  // bottom
}

/**
 * Draw origin markers for all cells in grid
 * @param {CanvasRenderingContext2D} ctx - Canvas 2D context
 * @param {number} gridCells - Number of cells per dimension
 * @param {number} cellSize - Size of each cell
 * @param {number} offsetX - Origin X offset
 * @param {number} offsetY - Origin Y offset
 * @param {string} originColor - Origin marker color
 */
export function drawOrigins(ctx, gridCells, cellSize, offsetX, offsetY, originColor) {
    for (let row = 0; row < gridCells; row++) {
        for (let col = 0; col < gridCells; col++) {
            drawOriginMarker(ctx, col * cellSize, row * cellSize, cellSize, offsetX, offsetY, originColor);
        }
    }
}

/**
 * Prepare canvas with transparent background and optional checkerboard
 * Format B: Transparent background for compositing flexibility
 * Call this before drawing characters
 * @param {CanvasRenderingContext2D} ctx - Canvas 2D context
 * @param {number} size - Canvas size in pixels
 * @param {import('./types.js').RenderConfig} config - Render configuration
 */
export function prepareCanvas(ctx, size, config) {
    // Clear to transparent (Format B)
    ctx.clearRect(0, 0, size, size);

    // Draw checkerboard if enabled (helps visualize transparency)
    if (config.showGrid) {
        drawCheckerboard(ctx, size, config.checkerColor);
    }
}

/**
 * Draw origin overlay on top of characters (for atlas view)
 * Call this after drawing characters
 * @param {CanvasRenderingContext2D} ctx - Canvas 2D context
 * @param {number} gridCells - Number of cells per dimension
 * @param {number} cellPixelSize - Cell size in pixels
 * @param {import('./types.js').RenderConfig} config - Render configuration
 */
export function drawAtlasOriginOverlay(ctx, gridCells, cellPixelSize, config) {
    if (config.showOrigin) {
        const offsetX = config.originOffsetX * config.characterScale * config.pixelScale;
        const offsetY = config.originOffsetY * config.characterScale * config.pixelScale;
        drawOrigins(ctx, gridCells, cellPixelSize, offsetX, offsetY, config.originColor);
    }
}

/**
 * Draw origin overlay on top of character (for single character view)
 * Call this after drawing the character
 * @param {CanvasRenderingContext2D} ctx - Canvas 2D context
 * @param {number} cellPixelSize - Cell size in pixels
 * @param {import('./types.js').RenderConfig} config - Render configuration
 */
export function drawCharOriginOverlay(ctx, cellPixelSize, config) {
    if (config.showOrigin) {
        const offsetX = config.originOffsetX * config.characterScale * config.pixelScale;
        const offsetY = config.originOffsetY * config.characterScale * config.pixelScale;
        drawOriginMarker(ctx, 0, 0, cellPixelSize, offsetX, offsetY, config.originColor);
    }
}
