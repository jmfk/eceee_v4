/**
 * Utility functions for image resolution display
 */

/**
 * Get resolution badge color class based on multiplier
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
    getResolutionBadgeColor,
};

