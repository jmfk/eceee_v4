/**
 * Property Form Fields Component
 * 
 * Reusable form field renderer for CSS properties with:
 * - Color selector for color properties
 * - Font selector for font properties
 * - Numeric input for numeric properties
 * - Select dropdown for predefined options
 * - Text input for other properties
 */

import React from 'react';
import ColorSelector from '../../form-fields/ColorSelector';
import FontSelector from '../../form-fields/FontSelector';
import NumericInput from '../../form-fields/NumericInput';

const PropertyFormFields = ({
    property,
    value,
    config,
    groupIndex,
    element,
    elementStyles,
    colors,
    fonts,
    onChange,
    onBlur,
}) => {
    if (!config) {
        return (
            <input
                type="text"
                value={value}
                onChange={(e) => onChange(e.target.value)}
                onBlur={onBlur}
                className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md"
            />
        );
    }

    switch (config.type) {
        case 'color':
            return (
                <ColorSelector
                    value={value}
                    onChange={(newValue) => onChange(newValue, true)}
                    colors={colors}
                    className="w-full"
                />
            );

        case 'font':
            return (
                <FontSelector
                    fontFamily={value}
                    fontWeight={elementStyles.fontWeight}
                    onFontFamilyChange={(newValue) => onChange(newValue, true)}
                    onFontWeightChange={(newWeight) => onChange(newWeight, true, 'fontWeight')}
                    fonts={fonts}
                    className="w-full"
                />
            );

        case 'numeric':
            return (
                <NumericInput
                    value={value}
                    onChange={(newValue) => onChange(newValue)}
                    onBlur={onBlur}
                    property={property}
                    className="w-full"
                />
            );

        case 'select':
            return (
                <select
                    value={value}
                    onChange={(e) => onChange(e.target.value, true)}
                    className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                    <option value="">None</option>
                    {config.options.map(opt => (
                        <option key={opt} value={opt}>{opt}</option>
                    ))}
                </select>
            );

        case 'text':
        default:
            return (
                <input
                    type="text"
                    value={value}
                    onChange={(e) => onChange(e.target.value)}
                    onBlur={onBlur}
                    className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
            );
    }
};

export default PropertyFormFields;







