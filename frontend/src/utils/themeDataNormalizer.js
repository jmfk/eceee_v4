/**
 * Theme Data Normalization Utility
 * 
 * Ensures theme data is compatible with current schema by:
 * - Merging deprecated galleryStyles/carouselStyles into imageStyles
 * - Ensuring all imageStyles have required fields (styleType, template)
 * - Removing deprecated fields before save
 */

/**
 * Normalize theme data to ensure compatibility with current schema
 * @param {Object} themeData - Raw theme data from API or UDC
 * @returns {Object} Normalized theme data
 */
export function normalizeThemeData(themeData) {
    if (!themeData) return themeData;
    
    const normalized = { ...themeData };
    
    // Step 1: Get all image styles (unified + legacy)
    let imageStyles = { ...(normalized.imageStyles || {}) };
    const galleryStyles = normalized.galleryStyles || {};
    const carouselStyles = normalized.carouselStyles || {};
    
    // Step 2: Merge legacy galleryStyles into imageStyles
    Object.entries(galleryStyles).forEach(([key, style]) => {
        if (!imageStyles[key]) {
            imageStyles[key] = { ...style, styleType: 'gallery' };
        }
    });
    
    // Step 3: Merge legacy carouselStyles into imageStyles
    Object.entries(carouselStyles).forEach(([key, style]) => {
        if (!imageStyles[key]) {
            imageStyles[key] = { ...style, styleType: 'carousel' };
        }
    });
    
    // Step 4: Ensure all imageStyles have required fields
    imageStyles = normalizeImageStyles(imageStyles);
    
    // Step 5: Update normalized data
    normalized.imageStyles = imageStyles;
    
    // Step 6: Remove deprecated fields (don't send them back to API)
    delete normalized.galleryStyles;
    delete normalized.carouselStyles;
    
    return normalized;
}

/**
 * Ensure all image styles have required fields
 * @param {Object} imageStyles - Image styles object
 * @returns {Object} Normalized image styles
 */
function normalizeImageStyles(imageStyles) {
    const normalized = {};
    
    Object.entries(imageStyles).forEach(([key, style]) => {
        if (typeof style !== 'object' || style === null) {
            return; // Skip invalid styles
        }
        
        normalized[key] = {
            ...style,
            // Ensure styleType exists (default to 'gallery')
            styleType: style.styleType || 'gallery',
            // Ensure template exists
            template: style.template || getDefaultTemplate(),
        };
    });
    
    return normalized;
}

/**
 * Get default template for image styles
 * @returns {string} Default Mustache template
 */
function getDefaultTemplate() {
    return '<div class="image-gallery">\n  {{#images}}\n    <img src="{{url}}" alt="{{alt}}" loading="lazy">\n  {{/images}}\n</div>';
}







