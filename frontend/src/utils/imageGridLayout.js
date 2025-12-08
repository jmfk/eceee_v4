/**
 * Image Grid Layout Utilities
 * Provides aspect ratio-based grid spanning logic for image galleries
 */

/**
 * Aspect ratio thresholds for determining image orientation
 */
const ASPECT_RATIO_THRESHOLDS = {
    HORIZONTAL: 1.3,  // aspect > 1.3 = horizontal
    VERTICAL: 0.7,    // aspect < 0.7 = vertical
    // between 0.7 and 1.3 = square
};

/**
 * Extract aspect ratio from image metadata
 * @param {Object} image - Image object with width/height properties
 * @returns {number|null} - Aspect ratio (width/height) or null if unavailable
 */
export function getImageAspectRatio(image) {
    // Try different property name variations (camelCase and snake_case)
    const width = image.width || image.originalWidth || image.original_width;
    const height = image.height || image.originalHeight || image.original_height;
    
    if (!width || !height || width <= 0 || height <= 0) {
        return null;
    }
    
    return width / height;
}

/**
 * Determine grid span and object-fit based on aspect ratio
 * @param {number|null} aspectRatio - Image aspect ratio
 * @returns {Object} - { colSpan, rowSpan, objectFit, orientation }
 */
export function getGridSpan(aspectRatio) {
    // Default to single cell with cover if aspect ratio unknown
    if (aspectRatio === null || aspectRatio === undefined) {
        return {
            colSpan: 1,
            rowSpan: 1,
            objectFit: 'cover',
            orientation: 'square'
        };
    }
    
    // Horizontal image - spans 2 columns
    if (aspectRatio > ASPECT_RATIO_THRESHOLDS.HORIZONTAL) {
        return {
            colSpan: 2,
            rowSpan: 1,
            objectFit: 'contain',
            orientation: 'horizontal'
        };
    }
    
    // Vertical image - spans 2 rows
    if (aspectRatio < ASPECT_RATIO_THRESHOLDS.VERTICAL) {
        return {
            colSpan: 1,
            rowSpan: 2,
            objectFit: 'contain',
            orientation: 'vertical'
        };
    }
    
    // Square image - single cell
    return {
        colSpan: 1,
        rowSpan: 1,
        objectFit: 'cover',
        orientation: 'square'
    };
}

/**
 * Calculate complete grid layout with image metadata
 * @param {Array} images - Array of image objects
 * @param {number} baseCols - Base number of columns
 * @param {number} baseRows - Base number of rows (optional)
 * @returns {Array} - Images with added layout metadata
 */
export function calculateGridLayout(images, baseCols, baseRows = null) {
    return images.map(image => {
        const aspectRatio = getImageAspectRatio(image);
        const span = getGridSpan(aspectRatio);
        
        return {
            ...image,
            layout: {
                aspectRatio,
                ...span
            }
        };
    });
}

/**
 * Get CSS Grid style object for an image based on its aspect ratio
 * @param {Object} image - Image object with width/height
 * @returns {Object} - CSS style object with grid properties
 */
export function getGridStyle(image) {
    const aspectRatio = getImageAspectRatio(image);
    const { colSpan, rowSpan } = getGridSpan(aspectRatio);
    
    const style = {};
    
    if (colSpan > 1) {
        style.gridColumn = `span ${colSpan}`;
    }
    
    if (rowSpan > 1) {
        style.gridRow = `span ${rowSpan}`;
    }
    
    return style;
}

/**
 * Get object-fit class name based on aspect ratio
 * @param {Object} image - Image object with width/height
 * @returns {string} - CSS class for object-fit
 */
export function getObjectFitClass(image) {
    const aspectRatio = getImageAspectRatio(image);
    const { objectFit } = getGridSpan(aspectRatio);
    
    return `object-${objectFit}`;
}

/**
 * Get complete CSS class string for grid item including object-fit
 * @param {Object} image - Image object with width/height
 * @param {string} baseClasses - Base CSS classes to include
 * @returns {string} - Complete class string
 */
export function getGridItemClasses(image, baseClasses = '') {
    const objectFitClass = getObjectFitClass(image);
    return baseClasses ? `${baseClasses} ${objectFitClass}` : objectFitClass;
}

