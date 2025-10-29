/**
 * Utility functions for detecting image resolution from proxy responses
 */

/**
 * Fetch image resolution information from proxy response headers
 * @param {string} imageUrl - The image URL (proxied)
 * @returns {Promise<Object|null>} Resolution info or null
 */
export const fetchImageResolution = async (imageUrl) => {
    if (!imageUrl || !imageUrl.includes('proxy-asset')) {
        return null; // Only works for proxied images
    }

    try {
        const response = await fetch(imageUrl, { method: 'HEAD' });

        const resolution = response.headers.get('X-Image-Resolution');
        const source = response.headers.get('X-Resolution-Source');
        const dimensions = response.headers.get('X-Image-Dimensions');

        if (!resolution || resolution === '1x') {
            return null; // Standard resolution, not worth noting
        }

        return {
            multiplier: resolution, // e.g., "2x", "3x"
            source: source || 'unknown', // e.g., "srcset", "url-pattern-retina-suffix"
            dimensions: dimensions || null, // e.g., "1920x1080"
        };
    } catch (error) {
        console.debug('Failed to fetch image resolution:', error);
        return null;
    }
};

/**
 * Format resolution info for display
 * @param {Object} resolutionInfo - Resolution data
 * @returns {string} Formatted string
 */
export const formatResolution = (resolutionInfo) => {
    if (!resolutionInfo) return '';

    const parts = [resolutionInfo.multiplier];

    if (resolutionInfo.dimensions) {
        parts.push(resolutionInfo.dimensions);
    }

    return parts.join(' • ');
};

/**
 * Get resolution badge color class
 * @param {string} multiplier - Resolution multiplier (e.g., "2x", "3x")
 * @returns {string} Tailwind color classes
 */
export const getResolutionBadgeColor = (multiplier) => {
    if (!multiplier) return 'bg-gray-100 text-gray-800 border-gray-300';

    const value = parseFloat(multiplier);

    if (value >= 3) {
        return 'bg-green-100 text-green-800 border-green-600';
    } else if (value >= 2) {
        return 'bg-blue-100 text-blue-800 border-blue-600';
    }

    return 'bg-gray-100 text-gray-800 border-gray-300';
};

export default {
    fetchImageResolution,
    formatResolution,
    getResolutionBadgeColor,
};

