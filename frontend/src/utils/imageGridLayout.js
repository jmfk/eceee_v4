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
 * Determine if an image has an extended aspect ratio (tall or wide)
 * that would have previously used multi-cell grid spans
 * @param {number|null} aspectRatio - Image aspect ratio
 * @returns {boolean} - True if image is extended (tall or wide)
 */
export function isExtendedImage(aspectRatio) {
    if (aspectRatio === null || aspectRatio === undefined) {
        return false;
    }

    // Image is extended if it's very wide or very tall
    return (
        aspectRatio > ASPECT_RATIO_THRESHOLDS.WIDE || // Wide images
        aspectRatio < ASPECT_RATIO_THRESHOLDS.TALL    // Tall images
    );
}

/**
 * Get orientation label for an image based on aspect ratio
 * @param {number|null} aspectRatio - Image aspect ratio
 * @returns {string} - Orientation label
 */
export function getImageOrientation(aspectRatio) {
    if (aspectRatio === null || aspectRatio === undefined) {
        return 'square';
    }

    if (aspectRatio > ASPECT_RATIO_THRESHOLDS.ULTRA_ULTRA_WIDE) {
        return 'ultra-ultra-wide';
    }
    if (aspectRatio > ASPECT_RATIO_THRESHOLDS.ULTRA_WIDE) {
        return 'ultra-wide';
    }
    if (aspectRatio > ASPECT_RATIO_THRESHOLDS.WIDE) {
        return 'wide';
    }
    if (aspectRatio < ASPECT_RATIO_THRESHOLDS.ULTRA_TALL) {
        return 'ultra-tall';
    }
    if (aspectRatio < ASPECT_RATIO_THRESHOLDS.TALL) {
        return 'tall';
    }
    return 'square';
}

/**
 * Determine grid span and object-fit based on aspect ratio
 * Wide images get 2x1 or 4x1, tall images and square images get 1x1
 * @param {number|null} aspectRatio - Image aspect ratio
 * @returns {Object} - { colSpan, rowSpan, objectFit, orientation }
 */
export function getGridSpan(aspectRatio) {
    if (aspectRatio === null || aspectRatio === undefined) {
        return {
            colSpan: 4,
            rowSpan: 1,
            objectFit: 'cover',
            orientation: 'square'
        };
    }

    // Ultra-ultra-wide images - 4x1
    if (aspectRatio > ASPECT_RATIO_THRESHOLDS.ULTRA_ULTRA_WIDE) {
        return {
            colSpan: 12,
            rowSpan: 1,
            objectFit: 'cover',
            orientation: 'ultra-ultra-wide'
        };
    }

    // Ultra-wide images - 4x1
    if (aspectRatio > ASPECT_RATIO_THRESHOLDS.ULTRA_WIDE) {
        return {
            colSpan: 8,
            rowSpan: 1,
            objectFit: 'cover',
            orientation: 'ultra-wide'
        };
    }

    // Wide images - 2x1
    if (aspectRatio > ASPECT_RATIO_THRESHOLDS.WIDE) {
        return {
            colSpan: 6,
            rowSpan: 1,
            objectFit: 'cover',
            orientation: 'wide'
        };
    }

    // All other images (tall and square) - 1x1
    return {
        colSpan: 4,
        rowSpan: 1,
        objectFit: 'cover',
        orientation: getImageOrientation(aspectRatio)
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

