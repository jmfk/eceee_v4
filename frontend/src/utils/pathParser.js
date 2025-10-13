/**
 * Path Parser Utility
 * 
 * Handles path pattern parsing and variable extraction for the frontend editor.
 * Replicates backend path parsing logic to ensure widgets receive the same
 * context in editor mode as they do in published mode.
 */

import { validatePath, fetchPathPattern } from '../api/pathPatterns';
import { sanitizePath, isPathSafe } from './pathValidator';

/**
 * Parse a path against a pattern and extract variables
 * @param {string} pathPatternKey - The pattern key (e.g., 'news_slug')
 * @param {string} path - The URL path to parse (e.g., 'my-article/')
 * @returns {Promise<Object|null>} Extracted variables or null if invalid
 */
export const parsePathWithPattern = async (pathPatternKey, path) => {
    if (!pathPatternKey || !path) {
        return null;
    }

    // Client-side validation (defense-in-depth)
    const sanitizedPath = sanitizePath(path);
    const validation = isPathSafe(sanitizedPath);

    if (!validation.safe) {
        console.warn('Path validation failed:', validation.reason);
        return null;
    }

    try {
        const result = await validatePath(pathPatternKey, sanitizedPath);
        return result.valid ? result.variables : null;
    } catch (error) {
        console.error('Error parsing path with pattern:', error);
        return null;
    }
};

/**
 * Build complete path variables context for a page
 * @param {Object} webpageData - The webpage data object
 * @param {string} simulatedPath - The path to simulate (optional)
 * @returns {Promise<Object>} Path variables object
 */
export const buildPathVariablesContext = async (webpageData, simulatedPath) => {
    const patternKey = webpageData?.pathPatternKey || webpageData?.path_pattern_key;

    if (!patternKey) {
        return {};
    }

    // If no simulated path provided, use the pattern's example URL
    let pathToUse = simulatedPath;
    if (!pathToUse) {
        try {
            const pattern = await fetchPathPattern(patternKey);
            pathToUse = pattern.exampleUrl || pattern.example_url;
        } catch (error) {
            console.error('Error fetching pattern for default path:', error);
            return {};
        }
    }

    if (!pathToUse) {
        return {};
    }

    // Client-side validation (defense-in-depth)
    const sanitizedPath = sanitizePath(pathToUse);
    const validation = isPathSafe(sanitizedPath);

    if (!validation.safe) {
        console.warn('Path validation failed in buildPathVariablesContext:', validation.reason);
        return {};
    }

    const pathVariables = await parsePathWithPattern(patternKey, sanitizedPath);
    return pathVariables || {};
};

/**
 * Get default simulated path for a pattern
 * @param {string} pathPatternKey - The pattern key
 * @returns {Promise<string|null>} Default path or null
 */
export const getDefaultSimulatedPath = async (pathPatternKey) => {
    if (!pathPatternKey) {
        return null;
    }

    try {
        const pattern = await fetchPathPattern(pathPatternKey);
        return pattern.exampleUrl || pattern.example_url || null;
    } catch (error) {
        console.error('Error fetching pattern for default path:', error);
        return null;
    }
};

/**
 * Validate if a path matches a pattern
 * @param {string} pathPatternKey - The pattern key
 * @param {string} path - The path to validate
 * @returns {Promise<{valid: boolean, variables?: Object, error?: string}>}
 */
export const validatePathPattern = async (pathPatternKey, path) => {
    if (!pathPatternKey || !path) {
        return { valid: false, error: 'Missing pattern key or path' };
    }

    // Client-side validation (defense-in-depth)
    const sanitizedPath = sanitizePath(path);
    const validation = isPathSafe(sanitizedPath);

    if (!validation.safe) {
        return {
            valid: false,
            error: validation.reason || 'Client-side validation failed'
        };
    }

    try {
        const result = await validatePath(pathPatternKey, sanitizedPath);
        return result;
    } catch (error) {
        return {
            valid: false,
            error: error.message || 'Validation failed'
        };
    }
};

