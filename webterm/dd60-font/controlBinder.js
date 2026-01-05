// @ts-check

/**
 * Control binding utilities
 * @module controlBinder
 */

import { CONTROL_BINDINGS } from './config.js';

/**
 * @callback RenderCallback
 * @returns {void}
 */

/**
 * @typedef {Object} ControlBinding
 * @property {string} prop
 * @property {'checkbox'|'int'|'float'|'logFloat'|'string'} type
 * @property {number} [min] - For logFloat: minimum value
 * @property {number} [max] - For logFloat: maximum value
 */

/**
 * Convert linear slider position (0-1) to logarithmic value
 * @param {number} linear - Linear position 0-1
 * @param {number} min - Minimum value
 * @param {number} max - Maximum value
 * @returns {number} Logarithmic value between min and max
 */
function linearToLog(linear, min, max) {
    return min * Math.pow(max / min, linear);
}

/**
 * Convert logarithmic value to linear slider position (0-1)
 * @param {number} value - Logarithmic value
 * @param {number} min - Minimum value
 * @param {number} max - Maximum value
 * @returns {number} Linear position 0-1
 */
function logToLinear(value, min, max) {
    return Math.log(value / min) / Math.log(max / min);
}

/**
 * Transform a control value based on binding type
 * @param {HTMLInputElement|HTMLSelectElement} element - The input/select element
 * @param {ControlBinding} binding - The binding definition
 * @returns {boolean|number|string}
 */
function transformValue(element, binding) {
    switch (binding.type) {
        case 'checkbox':
            return /** @type {HTMLInputElement} */ (element).checked;
        case 'int':
            return parseInt(element.value, 10);
        case 'float':
            return parseFloat(element.value);
        case 'logFloat': {
            const linear = parseFloat(element.value);
            const min = binding.min ?? 0.001;
            const max = binding.max ?? 1;
            return linearToLog(linear, min, max);
        }
        case 'string':
        default:
            return element.value;
    }
}

/**
 * Format a value for display
 * @param {string|number|boolean} value - Value to format
 * @param {ControlBinding} binding - The binding definition
 * @returns {string}
 */
function formatDisplayValue(value, binding) {
    if (binding.type === 'logFloat' && typeof value === 'number') {
        // Show 3 decimal places for small values, fewer for larger
        if (value < 0.01) {
            return value.toFixed(4);
        } else if (value < 0.1) {
            return value.toFixed(3);
        } else {
            return value.toFixed(2);
        }
    }
    return String(value);
}

/**
 * Update a value display element
 * @param {string} id - Control ID
 * @param {string|number|boolean} value - Value to display
 * @param {ControlBinding} [binding] - Optional binding for formatting
 */
export function updateValueDisplay(id, value, binding) {
    const display = document.getElementById(id + 'Value');
    if (display) {
        const formatted = binding ? formatDisplayValue(value, binding) : String(value);
        display.textContent = formatted;
    }
}

/**
 * Bind all controls to config object and trigger re-render
 * @param {Object} config - Configuration object to update
 * @param {RenderCallback} onRender - Callback to trigger re-render
 */
export function bindControls(config, onRender) {
    for (const id of Object.keys(CONTROL_BINDINGS)) {
        const element = /** @type {HTMLInputElement|HTMLSelectElement|null} */ (document.getElementById(id));
        if (!element) continue;

        const binding = /** @type {ControlBinding} */ (CONTROL_BINDINGS[id]);
        const isSelect = element.tagName === 'SELECT';

        // For logFloat, set initial slider position from config value
        if (binding.type === 'logFloat' && element instanceof HTMLInputElement) {
            // @ts-ignore - dynamic property access
            const configValue = config[binding.prop];
            const min = binding.min ?? 0.001;
            const max = binding.max ?? 1;
            element.value = String(logToLinear(configValue, min, max));
        }

        // Set initial value display
        // @ts-ignore - dynamic property access
        updateValueDisplay(id, config[binding.prop], binding);

        // Bind change event (use 'change' for selects, 'input' for others)
        element.addEventListener(isSelect ? 'change' : 'input', () => {
            const transformedValue = transformValue(element, binding);

            // @ts-ignore - dynamic property access
            config[binding.prop] = transformedValue;

            // Update value display
            updateValueDisplay(id, transformedValue, binding);

            // Re-render
            onRender();
        });
    }
}

/**
 * Enable or disable controls based on renderer capabilities
 * @param {string[]} supportedControls - Array of control IDs the renderer supports
 */
export function updateControlStates(supportedControls) {
    for (const id of Object.keys(CONTROL_BINDINGS)) {
        const controlRow = document.getElementById(id)?.closest('.control-row');
        if (!controlRow) continue;

        const isSupported = supportedControls.includes(id);
        controlRow.classList.toggle('disabled', !isSupported);

        const element = /** @type {HTMLInputElement|HTMLSelectElement|null} */ (document.getElementById(id));
        if (element) {
            element.disabled = !isSupported;
        }
    }
}
