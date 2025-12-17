/**
 * CSS Breakpoint Utilities
 * 
 * Utilities for working with responsive breakpoints in CSS.
 * Handles conversion between object format and media query strings.
 */

import { getBreakpoints } from './themeUtils';

/**
 * Generate CSS with media queries from breakpoint object
 * Used for client-side preview only - production CSS comes from styles.css API
 * 
 * @param {string|Object} cssObj - CSS as string (legacy) or object with breakpoints
 * @param {Object} theme - Theme object with breakpoints
 * @returns {string} - Generated CSS with media queries
 */
export function generateCSSFromBreakpoints(cssObj, theme) {
    // Legacy support - if CSS is already a string, return as-is
    if (typeof cssObj === 'string') {
        return cssObj;
    }
    
    // Get breakpoints from theme
    const breakpoints = getBreakpoints(theme);
    
    const parts = [];
    
    // Base styles (xs - no media query)
    if (cssObj.xs) {
        parts.push(cssObj.xs);
    }
    
    // Generate media queries for larger breakpoints (mobile-first)
    ['sm', 'md', 'lg', 'xl'].forEach(bp => {
        if (cssObj[bp] && cssObj[bp].trim() && breakpoints[bp]) {
            const mediaQuery = `@media (min-width: ${breakpoints[bp]}px) {\n${cssObj[bp]}\n}`;
            parts.push(mediaQuery);
        }
    });
    
    return parts.join('\n\n');
}

/**
 * Convert legacy string CSS to object format
 * 
 * @param {string} css - CSS string
 * @returns {Object} - CSS object with xs (base) key
 */
export function migrateLegacyCSS(css) {
    if (typeof css === 'object' && css !== null) {
        return css; // Already in new format
    }
    
    return {
        xs: css || ''
    };
}

/**
 * Convert CSS object to string (for backwards compatibility)
 * 
 * @param {Object} cssObj - CSS object with breakpoints
 * @returns {string} - CSS as string (only xs/base breakpoint)
 */
export function cssObjectToString(cssObj) {
    if (typeof cssObj === 'string') {
        return cssObj;
    }
    
    return cssObj.xs || cssObj.sm || '';
}

/**
 * Check if CSS object has any breakpoint-specific styles
 * 
 * @param {string|Object} cssObj - CSS as string or object
 * @returns {boolean} - True if has breakpoint styles
 */
export function hasBreakpointStyles(cssObj) {
    if (typeof cssObj === 'string') {
        return false;
    }
    
    return ['xs', 'sm', 'md', 'lg', 'xl'].some(bp => cssObj[bp] && cssObj[bp].trim());
}

/**
 * Copy CSS from one breakpoint to another
 * 
 * @param {Object} cssObj - CSS object
 * @param {string} fromBreakpoint - Source breakpoint (xs, sm, md, lg, xl)
 * @param {string} toBreakpoint - Target breakpoint
 * @returns {Object} - Updated CSS object
 */
export function copyBreakpointCSS(cssObj, fromBreakpoint, toBreakpoint) {
    const newCssObj = { ...cssObj };
    
    if (cssObj[fromBreakpoint]) {
        newCssObj[toBreakpoint] = cssObj[fromBreakpoint];
    }
    
    return newCssObj;
}

/**
 * Clear CSS for a specific breakpoint
 * 
 * @param {Object} cssObj - CSS object
 * @param {string} breakpoint - Breakpoint to clear
 * @returns {Object} - Updated CSS object
 */
export function clearBreakpointCSS(cssObj, breakpoint) {
    const newCssObj = { ...cssObj };
    delete newCssObj[breakpoint];
    return newCssObj;
}

/**
 * Get breakpoint keys in order (mobile-first)
 * 
 * @returns {Array} - Array of breakpoint keys
 */
export function getBreakpointKeys() {
    return ['xs', 'sm', 'md', 'lg', 'xl'];
}

/**
 * Get breakpoint label for UI display
 * 
 * @param {string} breakpoint - Breakpoint key
 * @param {Object} theme - Theme object with breakpoints
 * @returns {string} - Display label
 */
export function getBreakpointLabel(breakpoint, theme) {
    const breakpoints = getBreakpoints(theme);
    
    const labels = {
        xs: `XS - Base (<${breakpoints.sm}px)`,
        sm: `SM & Up (≥${breakpoints.sm}px)`,
        md: `MD & Up (≥${breakpoints.md}px)`,
        lg: `LG & Up (≥${breakpoints.lg}px)`,
        xl: `XL & Up (≥${breakpoints.xl}px)`,
    };
    
    return labels[breakpoint] || breakpoint;
}

