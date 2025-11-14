/**
 * Font Selector - Font family and weight selector based ONLY on theme fonts
 */

import React from 'react';

const FontSelector = ({ fontFamily, fontWeight, onFontFamilyChange, onFontWeightChange, fonts = {}, label, className = '' }) => {
    const googleFonts = fonts?.googleFonts || [];

    // Parse current font family to extract base font
    // Handle malformed values like 'Source Sans 3"", sans-serif' or "Source Sans 3"", sans-serif"
    let currentFont = fontFamily?.split(',')[0]?.replace(/['"]/g, '').trim();
    // Remove any remaining quotes that might be escaped or duplicated
    currentFont = currentFont?.replace(/\\"/g, '').replace(/""/g, '').trim();
    const currentWeight = fontWeight || '400';

    // Get all available font+weight combinations from theme
    const getFontWeightPairs = () => {
        const pairs = [];
        googleFonts.forEach((font) => {
            font.variants.forEach((variant) => {
                pairs.push({
                    family: font.family,
                    weight: variant,
                    label: `${font.family} - ${variant}`,
                    value: `${font.family}|${variant}`,
                });
            });
        });
        return pairs;
    };

    const fontWeightPairs = getFontWeightPairs();
    const currentPair = `${currentFont}|${currentWeight}`;

    const handlePairChange = (pairValue) => {
        const [family, weight] = pairValue.split('|');
        onFontFamilyChange(`'${family}', sans-serif`);
        if (onFontWeightChange) {
            onFontWeightChange(weight);
        }
    };

    return (
        <div className={className}>
            {label && <label className="block text-xs font-medium text-gray-600 mb-1">{label}</label>}

            {fontWeightPairs.length > 0 ? (
                <select
                    value={currentPair}
                    onChange={(e) => handlePairChange(e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                    <option value="">Select font...</option>
                    {fontWeightPairs.map((pair) => (
                        <option key={pair.value} value={pair.value}>
                            {pair.label}
                        </option>
                    ))}
                </select>
            ) : (
                <div className="text-sm text-gray-500 italic">No fonts available. Add fonts in the Fonts tab.</div>
            )}
        </div>
    );
};

export default FontSelector;
