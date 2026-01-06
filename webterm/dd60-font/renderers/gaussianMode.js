// @ts-check

/**
 * Gaussian spot physics-based character renderer
 * Uses float accumulation buffer for accurate intensity blending,
 * then colorizes when transferring to canvas
 * @module renderers/gaussianMode
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
 * Gaussian-specific parameters
 */
const GAUSSIAN = {
    /** Sigma multiplier relative to beam width */
    sigmaMult: 0.5,
    /** Coverage in sigmas for spot texture */
    sigmasCoverage: 3
};

/**
 * Pre-computed Gaussian kernel (1D, will be used separably or as 2D lookup)
 * @type {{weights: Float32Array, radius: number, sigma: number} | null}
 */
let gaussianKernel = null;

/**
 * Create or update Gaussian kernel
 * @param {number} sigma - Standard deviation in pixels
 * @returns {{weights: Float32Array, radius: number, sigma: number}}
 */
function getGaussianKernel(sigma) {
    const radius = Math.ceil(sigma * GAUSSIAN.sigmasCoverage);

    // Return cached if parameters match
    if (gaussianKernel && Math.abs(gaussianKernel.sigma - sigma) < 0.001) {
        return gaussianKernel;
    }

    const size = radius * 2 + 1;
    const weights = new Float32Array(size * size);
    const twoSigmaSq = 2 * sigma * sigma;

    for (let dy = -radius; dy <= radius; dy++) {
        for (let dx = -radius; dx <= radius; dx++) {
            const distSq = dx * dx + dy * dy;
            const weight = Math.exp(-distSq / twoSigmaSq);
            const idx = (dy + radius) * size + (dx + radius);
            weights[idx] = weight;
        }
    }

    gaussianKernel = { weights, radius, sigma };
    return gaussianKernel;
}

/**
 * Accumulate Gaussian spot into float buffer
 * @param {Float32Array} buffer - Intensity accumulation buffer
 * @param {number} width - Buffer width
 * @param {number} height - Buffer height
 * @param {number} cx - Center X position
 * @param {number} cy - Center Y position
 * @param {number} intensity - Spot intensity (0-1+)
 * @param {{weights: Float32Array, radius: number}} kernel - Gaussian kernel
 */
function accumulateGaussian(buffer, width, height, cx, cy, intensity, kernel) {
    const { weights, radius } = kernel;
    const kernelSize = radius * 2 + 1;

    const startX = Math.floor(cx) - radius;
    const startY = Math.floor(cy) - radius;

    for (let ky = 0; ky < kernelSize; ky++) {
        const py = startY + ky;
        if (py < 0 || py >= height) continue;

        for (let kx = 0; kx < kernelSize; kx++) {
            const px = startX + kx;
            if (px < 0 || px >= width) continue;

            const weight = weights[ky * kernelSize + kx];
            const bufIdx = py * width + px;
            buffer[bufIdx] += intensity * weight;
        }
    }
}

/**
 * Transfer float buffer to canvas with colorization
 * @param {CanvasRenderingContext2D} ctx - Canvas context
 * @param {Float32Array} buffer - Intensity buffer
 * @param {number} width - Buffer width
 * @param {number} height - Buffer height
 * @param {number} offsetX - X offset on canvas
 * @param {number} offsetY - Y offset on canvas
 * @param {string} color - Hex color (e.g., '#90EE90')
 * @param {string} blendMode - Canvas blend mode
 */
function transferToCanvas(ctx, buffer, width, height, offsetX, offsetY, color, blendMode) {
    // Parse color to RGB
    const r = parseInt(color.slice(1, 3), 16);
    const g = parseInt(color.slice(3, 5), 16);
    const b = parseInt(color.slice(5, 7), 16);

    // Create ImageData
    const imageData = ctx.createImageData(width, height);
    const data = imageData.data;

    for (let i = 0; i < buffer.length; i++) {
        const intensity = Math.min(1, buffer[i]); // Clamp to 1 for alpha
        const alpha = Math.round(intensity * 255);

        const idx = i * 4;
        data[idx] = r;
        data[idx + 1] = g;
        data[idx + 2] = b;
        data[idx + 3] = alpha;
    }

    // Always use temp canvas + drawImage to preserve background (checkerboard)
    // putImageData would overwrite instead of compositing
    const tempCanvas = new OffscreenCanvas(width, height);
    const tempCtx = tempCanvas.getContext('2d');
    if (tempCtx) {
        tempCtx.putImageData(imageData, 0, 0);
        ctx.globalCompositeOperation = /** @type {GlobalCompositeOperation} */ (blendMode);
        ctx.drawImage(tempCanvas, offsetX, offsetY);
        ctx.globalCompositeOperation = 'source-over';
    }
}

/**
 * Render a single character with Gaussian accumulation
 * @param {CanvasRenderingContext2D} ctx - Canvas context
 * @param {string} char - Character to render
 * @param {number} cellPixelSize - Cell size in pixels
 * @param {number} offsetX - X offset for atlas rendering
 * @param {number} offsetY - Y offset for atlas rendering
 * @param {import('./types.js').RenderConfig} config - Render configuration
 */
function renderCharacterGaussian(ctx, char, cellPixelSize, offsetX, offsetY, config) {
    const vectorData = getCharacterVector(char);
    if (!vectorData || vectorData.length === 0) {
        return;
    }

    // Process through physics simulation with separate X/Y parameters
    const xCoeffs = calculateBiquadCoeffs(config.filterCutoffX, config.filterQX);
    const yCoeffs = calculateBiquadCoeffs(config.filterCutoffY, config.filterQY);
    const filteredPositions = processCharacterPhysics(
        vectorData,
        PHYSICS_DEFAULTS.subsampleFactor,
        xCoeffs,
        config.filterZ,
        config.characterScale,
        {
            yCoeffs: yCoeffs,
            xGain: config.filterGainX,
            yGain: config.filterGainY
        }
    );

    // Create float accumulation buffer for this cell
    const width = Math.ceil(cellPixelSize);
    const height = Math.ceil(cellPixelSize);
    const buffer = new Float32Array(width * height);

    // Get Gaussian kernel
    const sigma = config.beamWidth * GAUSSIAN.sigmaMult;
    const kernel = getGaussianKernel(sigma);

    // Energy normalization: wider spot = lower intensity per pixel
    // Reference sigma of 1.0 gives full brightness, larger sigma reduces intensity by 1/σ²
    const referenceSigma = 1.0;
    const energyNormalization = (referenceSigma * referenceSigma) / (sigma * sigma);

    // Accumulate all spots into float buffer
    for (const pos of filteredPositions) {
        if (pos.z < PHYSICS_DEFAULTS.beamThreshold) {
            continue;
        }

        const { canvasX, canvasY } = scaledToCanvas(
            pos.x,
            pos.y,
            cellPixelSize,
            config.characterScale,
            config.originOffsetX,
            config.originOffsetY
        );

        // Modulate intensity with energy normalization
        const intensity = pos.z * config.brightness * energyNormalization;

        accumulateGaussian(buffer, width, height, canvasX, canvasY, intensity, kernel);
    }

    // Transfer accumulated buffer to canvas with colorization
    transferToCanvas(ctx, buffer, width, height, offsetX, offsetY, config.fgColor, config.blendMode);
}

/**
 * Gaussian mode renderer - physics simulation with float accumulation
 * @type {import('./types.js').Renderer}
 */
export const gaussianModeRenderer = {
    name: 'Gaussian Mode',
    supportedControls: ['showGrid', 'showOrigin', 'characterScale', 'pixelScale', 'filterCutoffX', 'filterCutoffY', 'filterQX', 'filterQY', 'filterGainX', 'filterGainY', 'filterZ', 'brightness', 'beamWidth', 'detailChar', 'detailMag'],

    /**
     * Render the complete font atlas with Gaussian spots
     * @param {CanvasRenderingContext2D} ctx
     * @param {number} canvasSize
     * @param {import('./types.js').RenderConfig} config
     */
    renderAtlas(ctx, canvasSize, config) {
        const cellSize = BASE_CELL_SIZE * config.characterScale;
        const cellPixelSize = cellSize * config.pixelScale;

        prepareCanvas(ctx, canvasSize, config);

        for (let row = 0; row < GRID_CELLS; row++) {
            for (let col = 0; col < GRID_CELLS; col++) {
                const charIndex = row * GRID_CELLS + col;
                const char = CDC_CHARACTERS[charIndex];

                const offsetX = col * cellPixelSize;
                const offsetY = row * cellPixelSize;

                renderCharacterGaussian(ctx, char, cellPixelSize, offsetX, offsetY, config);
            }
        }

        ctx.setTransform(1, 0, 0, 1, 0, 0);
        drawAtlasOriginOverlay(ctx, GRID_CELLS, cellPixelSize, config);
    },

    /**
     * Render a single character with Gaussian spots for detail view
     * @param {CanvasRenderingContext2D} ctx
     * @param {string} char
     * @param {number} cellPixelSize
     * @param {import('./types.js').RenderConfig} config
     */
    renderCharacter(ctx, char, cellPixelSize, config) {
        prepareCanvas(ctx, cellPixelSize, config);
        renderCharacterGaussian(ctx, char, cellPixelSize, 0, 0, config);

        ctx.setTransform(1, 0, 0, 1, 0, 0);
        drawCharOriginOverlay(ctx, cellPixelSize, config);
    }
};
