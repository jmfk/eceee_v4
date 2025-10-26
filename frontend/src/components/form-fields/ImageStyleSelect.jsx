import React, { useMemo } from 'react';
import { useTheme } from '../../hooks/useTheme';

/**
 * Smart select for image styles that shows only applicable styles
 * based on displayType (gallery or carousel)
 */
const ImageStyleSelect = ({ value, onChange, displayType = 'gallery' }) => {
    const { currentTheme } = useTheme();
    
    // Get appropriate styles based on display type
    const availableStyles = useMemo(() => {
        if (!currentTheme) return [];
        
        const styles = displayType === 'carousel' 
            ? currentTheme.carouselStyles || {}
            : currentTheme.galleryStyles || {};
        
        return Object.entries(styles).map(([key, style]) => ({
            value: key,
            label: style.name || key,
            description: style.description
        }));
    }, [currentTheme, displayType]);
    
    const hasStyles = availableStyles.length > 0;
    const displayValue = value || 'default';
    
    if (!hasStyles) {
        return (
            <div className="px-3 py-2 bg-gray-100 border border-gray-300 rounded-md text-sm text-gray-600">
                Default {displayType === 'carousel' ? 'Carousel' : 'Gallery'}
            </div>
        );
    }
    
    return (
        <select
            value={displayValue}
            onChange={(e) => onChange(e.target.value === 'default' ? null : e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
            <option value="default">Default</option>
            {availableStyles.map(style => (
                <option key={style.value} value={style.value}>
                    {style.label}
                    {style.description && ` - ${style.description}`}
                </option>
            ))}
        </select>
    );
};

export default ImageStyleSelect;

