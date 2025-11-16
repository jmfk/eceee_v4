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
    
    // Default styles (no media query)
    if (cssObj.default) {
        parts.push(cssObj.default);
    }
    
    // Generate media queries for each breakpoint (mobile-first)
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
 * @returns {Object} - CSS object with default key
 */
export function migrateLegacyCSS(css) {
    if (typeof css === 'object' && css !== null) {
        return css; // Already in new format
    }
    
    return {
        default: css || ''
    };
}

/**
 * Convert CSS object to string (for backwards compatibility)
 * 
 * @param {Object} cssObj - CSS object with breakpoints
 * @returns {string} - CSS as string (only default breakpoint)
 */
export function cssObjectToString(cssObj) {
    if (typeof cssObj === 'string') {
        return cssObj;
    }
    
    return cssObj.default || '';
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
    
    return ['sm', 'md', 'lg', 'xl'].some(bp => cssObj[bp] && cssObj[bp].trim());
}

/**
 * Copy CSS from one breakpoint to another
 * 
 * @param {Object} cssObj - CSS object
 * @param {string} fromBreakpoint - Source breakpoint (default, sm, md, lg, xl)
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
 * Get breakpoint keys in order
 * 
 * @param {boolean} includeDefault - Whether to include 'default'
 * @returns {Array} - Array of breakpoint keys
 */
export function getBreakpointKeys(includeDefault = true) {
    const keys = ['sm', 'md', 'lg', 'xl'];
    return includeDefault ? ['default', ...keys] : keys;
}

/**
 * Get breakpoint label for UI display
 * 
 * @param {string} breakpoint - Breakpoint key
 * @param {Object} theme - Theme object with breakpoints
 * @returns {string} - Display label
 */
export function getBreakpointLabel(breakpoint, theme) {
    if (breakpoint === 'default') {
        return 'Default';
    }
    
    const breakpoints = getBreakpoints(theme);
    const pixels = breakpoints[breakpoint];
    
    return `${breakpoint.toUpperCase()} (${pixels}px)`;
}

/**
 * Migrate old layout properties format to new format
 * Converts desktop/tablet/mobile to default/sm/md/lg/xl
 * 
 * @param {Object} layoutProperties - Layout properties object
 * @returns {Object} - Migrated layout properties
 */
export function migrateLayoutProperties(layoutProperties) {
    if (!layoutProperties) return layoutProperties;
    
    const migrated = {};
    
    for (const [part, breakpoints] of Object.entries(layoutProperties)) {
        // Check if already using new format
        if (breakpoints.default !== undefined || breakpoints.sm !== undefined ||
            breakpoints.md !== undefined || breakpoints.lg !== undefined ||
            breakpoints.xl !== undefined) {
            // Already in new format
            migrated[part] = breakpoints;
            continue;
        }
        
        // Migrate from old format
        migrated[part] = {};
        
        if (breakpoints.desktop) {
            migrated[part].default = breakpoints.desktop;
        }
        
        if (breakpoints.mobile) {
            migrated[part].sm = breakpoints.mobile;
        }
        
        if (breakpoints.tablet) {
            migrated[part].md = breakpoints.tablet;
        }
    }
    
    return migrated;
}

