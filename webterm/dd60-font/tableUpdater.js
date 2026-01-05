// @ts-check

/**
 * Table update utilities for ROM and vector display
 * @module tableUpdater
 */

import { cdcRomBinary } from './rom/binary.js';
import { getCharacterVector, simplifyVector } from './rom/decoder.js';
import { ROM_TIMING_LABELS } from './config.js';

/**
 * Update the ROM matrix table for the selected character
 * @param {string} char - Character to display
 * @param {HTMLElement} tbody - Table body element to update
 */
export function updateRomTable(char, tbody) {
    // Get ROM data for character
    const romData = cdcRomBinary[char];
    if (!romData) {
        tbody.innerHTML = '<tr><td colspan="6">No ROM data</td></tr>';
        return;
    }

    // Build table rows
    let html = '';
    for (let i = 0; i < ROM_TIMING_LABELS.length && i < romData.length; i++) {
        const binary = romData[i];
        const v1 = (binary >> 4) & 1;
        const v2 = (binary >> 3) & 1;
        const h1 = (binary >> 2) & 1;
        const h2 = (binary >> 1) & 1;
        const u = binary & 1;

        html += `<tr>
            <td class="t-col">${ROM_TIMING_LABELS[i]}</td>
            <td class="${v1 ? 'set' : ''}">${v1 ? 'X' : ''}</td>
            <td class="${v2 ? 'set' : ''}">${v2 ? 'X' : ''}</td>
            <td class="${h1 ? 'set' : ''}">${h1 ? 'X' : ''}</td>
            <td class="${h2 ? 'set' : ''}">${h2 ? 'X' : ''}</td>
            <td class="${u ? 'set' : ''}">${u ? 'X' : ''}</td>
        </tr>`;
    }

    tbody.innerHTML = html;
}

/**
 * Update the vector output table for the selected character
 * @param {string} char - Character to display
 * @param {HTMLElement} tbody - Table body element to update
 */
export function updateVectorTable(char, tbody) {
    // Get vector data for character
    const vectorData = getCharacterVector(char);
    if (!vectorData || vectorData.length === 0) {
        tbody.innerHTML = '<tr><td colspan="4">No vector data</td></tr>';
        return;
    }

    // Build table rows
    let html = '';
    for (let i = 0; i < vectorData.length; i++) {
        const [x, y, beam] = vectorData[i];
        const tLabel = ROM_TIMING_LABELS[i] || String(i);

        html += `<tr>
            <td class="t-col">${tLabel}</td>
            <td>${x}</td>
            <td>${y}</td>
            <td class="${beam ? 'set' : ''}">${beam ? 'ON' : ''}</td>
        </tr>`;
    }

    tbody.innerHTML = html;
}

/**
 * Update the simplified vector table for the selected character
 * @param {string} char - Character to display
 * @param {HTMLElement} tbody - Table body element to update
 */
export function updateSimplifiedTable(char, tbody) {
    // Get simplified vector data
    const vectorData = getCharacterVector(char);
    const simplified = simplifyVector(vectorData);

    if (!simplified || simplified.length === 0) {
        tbody.innerHTML = '<tr><td colspan="3">No data</td></tr>';
        return;
    }

    // Build table rows (no T column)
    let html = '';
    for (let i = 0; i < simplified.length; i++) {
        const [x, y, beam] = simplified[i];

        html += `<tr>
            <td>${x}</td>
            <td>${y}</td>
            <td class="${beam ? 'set' : ''}">${beam ? 'ON' : ''}</td>
        </tr>`;
    }

    tbody.innerHTML = html;
}
