// @ts-check

/**
 * CDC 6602 Character ROM Functions
 * Functions for working with CDC ROM binary format
 * @module rom/decoder
 */

import { cdcRomBinary } from './binary.js';

/**
 * Vector coordinate with beam intensity
 * @typedef {[number, number, number]} VectorCoord
 * @description Tuple of [x, y, beam_intensity] where beam_intensity is 0 (off) or 1 (on)
 */

/**
 * Maximum coordinate value for CDC character grid (0-6 range, 7x7 character on 8x8 cell)
 * @type {number}
 */
const CDC_CHAR_MAX_COORD = 6;

/**
 * Get all available character keys from the ROM
 * @returns {string[]} Array of available character keys
 */
export function getAllCharacters() {
    return Object.keys(cdcRomBinary);
}

/**
 * Get binary ROM data for a character
 * @param {string} char - Character to retrieve
 * @returns {number[]} Array of binary control values (23 entries)
 */
export function getCharacterBinary(char) {
    return cdcRomBinary[char] || cdcRomBinary[' '];
}

/**
 * Convert CDC ROM binary format to vector coordinate format at runtime
 * Implements the exact decoding algorithm from CDC 6602 documentation
 *
 * @param {number[]} binaryData - Array of binary control values
 * @returns {VectorCoord[]} Array of [x, y, beam] coordinates
 */
export function binaryToVector(binaryData) {
    if (!binaryData || binaryData.length === 0) {
        return [];
    }

    /** @type {VectorCoord[]} */
    const vectorData = [];

    // Initial state as per CDC 6602 specification
    let currentX = 0;
    let currentY = 0;
    let beamIntensity = 0;  // 0 = off, 1 = on
    let horizontalDirection = 1;  // 1 = positive, -1 = negative
    let verticalDirection = 1;    // 1 = positive, -1 = negative

    for (let i = 0; i < binaryData.length; i++) {
        const binary = binaryData[i];

        // Decode flags from binary value
        const V1 = Boolean((binary >> 4) & 1);
        const V2 = Boolean((binary >> 3) & 1);
        const H1 = Boolean((binary >> 2) & 1);
        const H2 = Boolean((binary >> 1) & 1);
        const U = Boolean(binary & 1);

        // Handle vertical movement according to CDC specification
        if (V1 && V2) {
            // Both set: toggle vertical direction, no movement
            verticalDirection = -verticalDirection;
        } else if (V1) {
            // V1 only: move 1 unit in current vertical direction
            currentY += verticalDirection;
        } else if (V2) {
            // V2 only: move 2 units in current vertical direction
            currentY += 2 * verticalDirection;
        }
        // If neither V1 nor V2: no vertical movement

        // Handle horizontal movement according to CDC specification
        if (H1 && H2) {
            // Both set: toggle horizontal direction, no movement
            horizontalDirection = -horizontalDirection;
        } else if (H1) {
            // H1 only: move 1 unit in current horizontal direction
            currentX += horizontalDirection;
        } else if (H2) {
            // H2 only: move 2 units in current horizontal direction
            currentX += 2 * horizontalDirection;
        }
        // If neither H1 nor H2: no horizontal movement

        // Handle beam toggle
        if (U) {
            beamIntensity = beamIntensity ? 0 : 1;
        }

        // Validate coordinates are within CDC bounds before adding
        if (currentX >= 0 && currentX <= CDC_CHAR_MAX_COORD &&
            currentY >= 0 && currentY <= CDC_CHAR_MAX_COORD) {
            // Add current position to vector data
            vectorData.push([currentX, currentY, beamIntensity]);
        } else {
            console.warn(`Generated coordinates (${currentX}, ${currentY}) exceed CDC bounds (0-${CDC_CHAR_MAX_COORD})`);
        }
    }

    return vectorData;
}

/**
 * Generate the entire vector ROM at runtime from binary data
 * Converts CDC ROM binary format to vector coordinates
 * @returns {Object.<string, VectorCoord[]>} Map of character to vector coordinate arrays
 */
export function generateVectorRom() {
    /** @type {Object.<string, VectorCoord[]>} */
    const vectorRom = {};

    for (const char of getAllCharacters()) {
        const binaryData = getCharacterBinary(char);
        vectorRom[char] = binaryToVector(binaryData);
    }

    return vectorRom;
}

/**
 * Get vector data for a specific character at runtime
 * @param {string} char - Character to retrieve
 * @returns {VectorCoord[]} Array of [x, y, beam] coordinates
 */
export function getCharacterVector(char) {
    const binaryData = getCharacterBinary(char);
    return binaryToVector(binaryData);
}

/**
 * Remove leading and trailing beam-off entries
 * Keeps from first beam=1 to last beam=1 (inclusive of final beam-off transition)
 * @param {VectorCoord[]} vectorData - Input vector coordinates
 * @returns {VectorCoord[]} Trimmed vector coordinates
 */
export function trimBeamOff(vectorData) {
    if (!vectorData || vectorData.length === 0) {
        return [];
    }

    // Find first index where beam=1
    let firstOn = -1;
    for (let i = 0; i < vectorData.length; i++) {
        if (vectorData[i][2] === 1) {
            firstOn = i;
            break;
        }
    }

    // No beam-on entries found
    if (firstOn === -1) {
        return [];
    }

    // Find last index where beam=1
    let lastOn = -1;
    for (let i = vectorData.length - 1; i >= 0; i--) {
        if (vectorData[i][2] === 1) {
            lastOn = i;
            break;
        }
    }

    // Return slice from first beam-on to last beam-on (inclusive)
    return vectorData.slice(firstOn, lastOn + 1);
}

/**
 * Remove consecutive duplicate entries where x, y, and beam all match
 * @param {VectorCoord[]} vectorData - Input vector coordinates
 * @returns {VectorCoord[]} Deduplicated vector coordinates
 */
export function deduplicateAdjacent(vectorData) {
    if (!vectorData || vectorData.length === 0) {
        return [];
    }

    /** @type {VectorCoord[]} */
    const result = [vectorData[0]];

    for (let i = 1; i < vectorData.length; i++) {
        const prev = result[result.length - 1];
        const curr = vectorData[i];

        // Keep if any value differs
        if (curr[0] !== prev[0] || curr[1] !== prev[1] || curr[2] !== prev[2]) {
            result.push(curr);
        }
    }

    return result;
}

/**
 * Simplify vector data by removing consecutive duplicates
 * @param {VectorCoord[]} vectorData - Input vector coordinates
 * @returns {VectorCoord[]} Simplified vector coordinates
 */
export function simplifyVector(vectorData) {
    return deduplicateAdjacent(vectorData);
}
