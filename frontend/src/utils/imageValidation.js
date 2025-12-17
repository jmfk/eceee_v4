/**
 * Image Validation Utilities
 * 
 * Validates images for design groups to ensure proper sizing for retina displays
 * and optimal performance across breakpoints.
 */

import { getBreakpoints } from './themeUtils';

/**
 * Validate an image for use in a design group at a specific breakpoint
 * 
 * @param {Object} imageData - Image metadata { width, height, size, filename }
 * @param {string} breakpoint - Breakpoint key ('sm', 'md', 'lg', 'xl')
 * @param {Object} theme - Theme object with breakpoints configuration
 * @returns {Array} Array of validation warnings/errors
 */
export function validateDesignGroupImage(imageData, breakpoint, theme) {
    const warnings = [];
    
    // Skip validation if no dimensions available (e.g., SVG)
    if (!imageData.width || !imageData.height) {
        return warnings;
    }
    
    const breakpoints = getBreakpoints(theme);
    const breakpointWidth = breakpoints[breakpoint];
    
    // Check 1: Image too small for breakpoint (ERROR)
    if (imageData.width < breakpointWidth) {
        warnings.push({
            type: 'error',
            severity: 'high',
            message: `Image width (${imageData.width}px) is smaller than ${breakpoint} breakpoint (${breakpointWidth}px). Image will be stretched and look blurry.`,
            suggestion: `Upload an image at least ${breakpointWidth}px wide.`
        });
    }
    
    // Check 2: Not optimal @2x size (WARNING)
    const expected2xWidth = breakpointWidth * 2;
    if (imageData.width >= breakpointWidth && imageData.width < expected2xWidth) {
        warnings.push({
            type: 'warning',
            severity: 'medium',
            message: `Image should be ${expected2xWidth}px wide for optimal @2x display (current: ${imageData.width}px).`,
            suggestion: `For best quality on retina displays, upload at ${expected2xWidth}px width.`
        });
    }
    
    // Check 3: Image is close to @2x size (INFO - good!)
    if (imageData.width >= expected2xWidth && imageData.width < expected2xWidth * 1.2) {
        warnings.push({
            type: 'success',
            severity: 'low',
            message: `Image size is optimal for @2x retina displays at ${breakpoint} breakpoint.`,
            suggestion: null
        });
    }
    
    // Check 4: File size too large (> 2MB error, > 500KB warning)
    if (imageData.size > 2 * 1024 * 1024) {
        warnings.push({
            type: 'error',
            severity: 'high',
            message: `File size (${(imageData.size / 1024 / 1024).toFixed(1)}MB) is too large. This will slow down page loading.`,
            suggestion: 'Compress the image or use a smaller resolution. Maximum recommended: 2MB.'
        });
    } else if (imageData.size > 500 * 1024) {
        warnings.push({
            type: 'warning',
            severity: 'medium',
            message: `File size (${(imageData.size / 1024).toFixed(0)}KB) is large. Consider optimizing for better performance.`,
            suggestion: 'Use image compression tools to reduce file size while maintaining quality.'
        });
    }
    
    // Check 5: Aspect ratio warning for very wide/tall images
    const aspectRatio = imageData.width / imageData.height;
    if (aspectRatio > 5 || aspectRatio < 0.2) {
        warnings.push({
            type: 'warning',
            severity: 'low',
            message: `Unusual aspect ratio (${aspectRatio.toFixed(2)}:1). Verify this is intentional.`,
            suggestion: 'Very wide or tall images may not display well in all layouts.'
        });
    }
    
    return warnings;
}

/**
 * Validate all images in a design group across all breakpoints
 * 
 * @param {Object} designGroup - Design group object with layoutProperties
 * @param {Object} theme - Theme object with breakpoints configuration
 * @returns {Object} Validation results grouped by part and breakpoint
 */
export function validateDesignGroupImages(designGroup, theme) {
    const results = {};
    
    if (!designGroup.layoutProperties) {
        return results;
    }
    
    // Iterate through each layout part (header, footer, etc.)
    for (const [part, breakpointData] of Object.entries(designGroup.layoutProperties)) {
        results[part] = {};
        
        // Iterate through each breakpoint
        for (const [breakpoint, props] of Object.entries(breakpointData)) {
            if (!props.images) continue;
            
            results[part][breakpoint] = {};
            
            // Validate each image
            for (const [imageKey, imageData] of Object.entries(props.images)) {
                if (!imageData || typeof imageData !== 'object') continue;
                
                const warnings = validateDesignGroupImage(imageData, breakpoint, theme);
                if (warnings.length > 0) {
                    results[part][breakpoint][imageKey] = warnings;
                }
            }
        }
    }
    
    return results;
}

/**
 * Get summary statistics of validation results
 * 
 * @param {Object} validationResults - Results from validateDesignGroupImages
 * @returns {Object} Summary with counts by severity
 */
export function getValidationSummary(validationResults) {
    const summary = {
        total: 0,
        errors: 0,
        warnings: 0,
        success: 0,
        byPart: {}
    };
    
    for (const [part, breakpoints] of Object.entries(validationResults)) {
        summary.byPart[part] = { errors: 0, warnings: 0, success: 0 };
        
        for (const [breakpoint, images] of Object.entries(breakpoints)) {
            for (const [imageKey, warnings] of Object.entries(images)) {
                for (const warning of warnings) {
                    summary.total++;
                    
                    if (warning.type === 'error') {
                        summary.errors++;
                        summary.byPart[part].errors++;
                    } else if (warning.type === 'warning') {
                        summary.warnings++;
                        summary.byPart[part].warnings++;
                    } else if (warning.type === 'success') {
                        summary.success++;
                        summary.byPart[part].success++;
                    }
                }
            }
        }
    }
    
    return summary;
}

/**
 * Get recommended dimensions for a breakpoint
 * 
 * @param {string} breakpoint - Breakpoint key
 * @param {Object} theme - Theme object
 * @returns {Object} Recommended dimensions { width1x, width2x, note }
 */
export function getRecommendedDimensions(breakpoint, theme) {
    const breakpoints = getBreakpoints(theme);
    const width1x = breakpoints[breakpoint];
    const width2x = width1x * 2;
    
    return {
        width1x,
        width2x,
        note: `Upload images at ${width2x}px width for optimal @2x retina display. Minimum: ${width1x}px.`
    };
}

