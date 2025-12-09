/**
 * Image Grid Layout Utilities
 * Provides aspect ratio-based grid spanning logic for image galleries
 */

/**
 * Aspect ratio thresholds for determining image orientation
 */
const ASPECT_RATIO_THRESHOLDS = {
    ULTRA_ULTRA_WIDE: 3.5,  // aspect > 3.5 = ultra-ultra-wide (full width)
    ULTRA_WIDE: 2.5,        // 2.5 < aspect <= 3.5 = ultra-wide (4x1)
    WIDE: 1.7,              // 1.7 < aspect <= 2.5 = wide (3x1)
    TALL: 0.7,              // 0.3 <= aspect < 0.7 = tall (1x2)
    ULTRA_TALL: 0.3,        // aspect < 0.3 = ultra-tall (2x3)
    // between 0.7 and 1.7 = square (1x1)
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
            colSpan: 4,
            rowSpan: 1,
            objectFit: 'cover',
            orientation: 'square'
        };
    }

    // Ultra-ultra-wide image - spans full width (12x1)
    if (aspectRatio > ASPECT_RATIO_THRESHOLDS.ULTRA_ULTRA_WIDE) {
        return {
            colSpan: 12,
            rowSpan: 1,
            objectFit: 'contain',
            orientation: 'ultra-ultra-wide'
        };
    }

    // Ultra-wide image - spans 4 columns (4x1)
    if (aspectRatio > ASPECT_RATIO_THRESHOLDS.ULTRA_WIDE) {
        return {
            colSpan: 8,
            rowSpan: 1,
            objectFit: 'contain',
            orientation: 'ultra-wide'
        };
    }

    // Wide image - spans 3 columns (3x1)
    if (aspectRatio > ASPECT_RATIO_THRESHOLDS.WIDE) {
        return {
            colSpan: 6,
            rowSpan: 1,
            objectFit: 'contain',
            orientation: 'wide'
        };
    }

    // Ultra-tall image - spans 4 columns and 3 rows (4x3)
    if (aspectRatio < ASPECT_RATIO_THRESHOLDS.ULTRA_TALL) {
        return {
            colSpan: 4,
            rowSpan: 3,
            objectFit: 'contain',
            orientation: 'ultra-tall'
        };
    }

    // Tall image - spans 2 rows (1x2)
    if (aspectRatio < ASPECT_RATIO_THRESHOLDS.TALL) {
        return {
            colSpan: 1,
            rowSpan: 2,
            objectFit: 'contain',
            orientation: 'tall'
        };
    }

    // Square image - 4x1 cell (same as ultra-wide)
    return {
        colSpan: 4,
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

