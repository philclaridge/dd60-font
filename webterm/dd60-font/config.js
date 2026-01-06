// @ts-check

/**
 * DD60 Font Atlas Generator Configuration
 * Constants and default values for the generator
 * @module config
 */

/** @type {number} Base cell size in display units */
export const BASE_CELL_SIZE = 8;

/** @type {number} Grid cells per dimension (8×8 = 64 characters) */
export const GRID_CELLS = 8;

/** @type {number} Atlas size in base display units (64×64) */
export const ATLAS_SIZE = GRID_CELLS * BASE_CELL_SIZE;

/**
 * Default configuration values
 * @type {Object}
 */
export const DEFAULT_CONFIG = {
    /** @type {'font'|'vector'|'crt'|'gaussian'} Renderer mode */
    renderMode: 'gaussian',
    /** @type {number} Character scale multiplier (1, 2, or 4) */
    characterScale: 1,
    /** @type {number} Pixel scale multiplier (1 to 16) */
    pixelScale: 16,
    /** @type {number} Base origin X offset in display units (scales with characterScale) */
    originOffsetX: 1,
    /** @type {number} Base origin Y offset in display units (scales with characterScale) */
    originOffsetY: 1,
    /** @type {boolean} Show checkerboard pattern */
    showGrid: false,
    /** @type {boolean} Show character origin dots */
    showOrigin: false,
    /** @type {number} Beam width in pixels (spot radius) */
    beamWidth: 8,
    /** @type {number} Brightness multiplier */
    brightness: 0.5,
    /** @type {string} Canvas blend mode for spot rendering */
    blendMode: 'source-over',
    /** @type {number} X deflection biquad filter cutoff (fraction of sample rate) */
    filterCutoffX: 0.003,
    /** @type {number} Y deflection biquad filter cutoff (fraction of sample rate) */
    filterCutoffY: 0.003,
    /** @type {number} X deflection biquad filter Q factor (0.707 = Butterworth) */
    filterQX: 0.75,
    /** @type {number} Y deflection biquad filter Q factor (0.707 = Butterworth) */
    filterQY: 0.75,
    /** @type {number} X deflection gain multiplier */
    filterGainX: 1.0,
    /** @type {number} Y deflection gain multiplier */
    filterGainY: 1.0,
    /** @type {number} Z beam intensity IIR filter retention (0 = no filter, 0.99 = heavy) */
    filterZ: 0.975,
    /** @type {string} Foreground color (phosphor green) */
    fgColor: '#90EE90',
    /** @type {string} Background color */
    bgColor: '#000000',
    /** @type {string} Checkerboard overlay color */
    checkerColor: '#1a1a1a',
    /** @type {string} Origin marker color */
    originColor: '#FF6600',
    /** @type {string} Selected character for detail view */
    detailChar: 'A',
    /** @type {number} Detail view magnification factor */
    detailMagnification: 6
};

/**
 * ROM timing labels in octal (T column values)
 * @type {string[]}
 */
export const ROM_TIMING_LABELS = [
    '76', '00', '01', '02', '03', '04', '05', '06', '07',
    '10', '11', '12', '13', '14', '15', '16', '17',
    '20', '21', '22', '23', '24', '25'
];

/**
 * Control binding definitions
 * Maps control IDs to CONFIG properties and value types
 * For 'logFloat' type, min/max define the logarithmic range (slider is 0-1 linear)
 * @type {Object.<string, {prop: string, type: 'checkbox'|'int'|'float'|'logFloat'|'string', min?: number, max?: number}>}
 */
export const CONTROL_BINDINGS = {
    'showGrid':       { prop: 'showGrid',           type: 'checkbox' },
    'showOrigin':     { prop: 'showOrigin',         type: 'checkbox' },
    'characterScale': { prop: 'characterScale',     type: 'int' },
    'pixelScale':     { prop: 'pixelScale',         type: 'float' },
    'beamWidth':      { prop: 'beamWidth',          type: 'float' },
    'brightness':     { prop: 'brightness',         type: 'float' },
    'filterCutoffX':  { prop: 'filterCutoffX',      type: 'logFloat', min: 0.0005, max: 0.05 },
    'filterCutoffY':  { prop: 'filterCutoffY',      type: 'logFloat', min: 0.0005, max: 0.05 },
    'filterQX':       { prop: 'filterQX',           type: 'float' },
    'filterQY':       { prop: 'filterQY',           type: 'float' },
    'filterGainX':    { prop: 'filterGainX',        type: 'float' },
    'filterGainY':    { prop: 'filterGainY',        type: 'float' },
    'filterZ':        { prop: 'filterZ',            type: 'float' },
    'detailChar':     { prop: 'detailChar',         type: 'string' },
    'detailMag':      { prop: 'detailMagnification', type: 'int' }
};

/**
 * CDC 6602 character set in ROM order (64 positions)
 * Position 00: space, 01-26: A-Z, 27-36: 0-9, 37-45: punctuation, 46-63: unused
 * @type {string[]}
 */
export const CDC_CHARACTERS = [
    ' ', 'A', 'B', 'C', 'D', 'E', 'F', 'G',  // 00-07
    'H', 'I', 'J', 'K', 'L', 'M', 'N', 'O',  // 08-15
    'P', 'Q', 'R', 'S', 'T', 'U', 'V', 'W',  // 16-23
    'X', 'Y', 'Z', '0', '1', '2', '3', '4',  // 24-31
    '5', '6', '7', '8', '9', '+', '-', '*',  // 32-39
    '/', '(', ')', '=', ',', '.', ' ', ' ',  // 40-47
    ' ', ' ', ' ', ' ', ' ', ' ', ' ', ' ',  // 48-55 (unused)
    ' ', ' ', ' ', ' ', ' ', ' ', ' ', ' '   // 56-63 (unused)
];
