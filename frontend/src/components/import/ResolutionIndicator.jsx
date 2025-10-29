/**
 * ResolutionIndicator - Display resolution badge on images
 * 
 * Shows a small pill badge (e.g., "2×", "3×") on images that have
 * high-resolution versions detected by the proxy system.
 */

import React from 'react';

const ResolutionIndicator = ({ multiplier, source, dimensions, className = '' }) => {
    if (!multiplier || multiplier <= 1.0) {
        return null; // Don't show badge for 1x images
    }

    // Format multiplier (e.g., 2.0 -> "2×", 2.5 -> "2.5×")
    const multiplierText = multiplier === Math.floor(multiplier)
        ? `${Math.floor(multiplier)}×`
        : `${multiplier.toFixed(1)}×`;

    // Color scheme based on resolution
    const colorClass = multiplier >= 3
        ? 'bg-green-600 text-white'
        : multiplier >= 2
            ? 'bg-blue-600 text-white'
            : 'bg-gray-600 text-white';

    // Source icon or indicator
    const sourceIcon = source === 'srcset'
        ? '📱'
        : source?.includes('url-pattern')
            ? '🔍'
            : '';

    return (
        <div
            className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-semibold shadow-md ${colorClass} ${className}`}
            title={`High-resolution image detected: ${multiplierText} (${source || 'auto-detected'})${dimensions ? `\nDimensions: ${dimensions}` : ''}`}
        >
            {sourceIcon && <span className="text-xs">{sourceIcon}</span>}
            <span>{multiplierText}</span>
        </div>
    );
};

export default ResolutionIndicator;

