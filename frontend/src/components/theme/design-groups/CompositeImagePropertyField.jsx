/**
 * CompositeImagePropertyField Component
 * 
 * Enhanced image property field that manages multiple CSS attributes:
 * - background-image (url)
 * - background-size
 * - background-position
 * - background-repeat
 * - aspect-ratio (calculated from image dimensions)
 */

import React, { useEffect } from 'react';
import { AlertTriangle, AlertCircle } from 'lucide-react';
import DirectImageUpload from './DirectImageUpload';

const CompositeImagePropertyField = ({
    themeId,
    value,
    onChange,
    label,
    breakpoint,
    part,
    groupIndex,
    imageKey = 'background',
    warnings = [],
    disabled = false,
}) => {

    // Filter warnings for this specific image
    const imageWarnings = warnings.filter(w =>
        w.group_index === groupIndex &&
        w.part === part &&
        w.breakpoint === breakpoint &&
        w.image_key === imageKey
    );

    const hasCritical = imageWarnings.some(w => w.severity === 'critical');
    const hasWarning = imageWarnings.some(w => w.severity === 'warning');

    // Extract current values
    const imageUrl = value?.url;
    const imageWidth = value?.width;
    const imageHeight = value?.height;
    const backgroundSize = value?.backgroundSize || 'auto';
    const backgroundPosition = value?.backgroundPosition || 'top left';
    const backgroundRepeat = value?.backgroundRepeat || 'no-repeat';
    const useAspectRatio = value?.useAspectRatio === true; // Default to false (opt-in)
    const aspectRatio = value?.aspectRatio || (imageWidth && imageHeight ? `${imageWidth}/${imageHeight}` : '');

    // Calculate aspect ratio from dimensions
    useEffect(() => {
        if (value && value.width && value.height && !value.aspectRatio) {
            // Auto-calculate aspect ratio when image has dimensions but no custom ratio set
            onChange({
                ...value,
                aspectRatio: `${value.width}/${value.height}`
            });
        }
    }, [value?.width, value?.height]);

    const handleImageChange = (newImageData) => {
        if (!newImageData) {
            // Image removed
            onChange(null);
            return;
        }

        // Calculate aspect ratio from new image dimensions
        const calculatedAspectRatio = newImageData.width && newImageData.height
            ? `${newImageData.width}/${newImageData.height}`
            : '';

        // Merge with existing composite data
        onChange({
            ...value,
            ...newImageData,
            // Preserve existing CSS properties with defaults from header widget
            backgroundSize: value?.backgroundSize || 'auto',
            backgroundPosition: value?.backgroundPosition || 'top left',
            backgroundRepeat: value?.backgroundRepeat || 'no-repeat',
            // Only preserve existing useAspectRatio if explicitly set, default to false
            useAspectRatio: value?.useAspectRatio === true ? true : false,
            aspectRatio: calculatedAspectRatio || value?.aspectRatio || '',
        });
    };

    const handlePropertyChange = (property, propertyValue) => {
        if (!value) return;

        onChange({
            ...value,
            [property]: propertyValue
        });
    };

    const handleDprChange = (newDpr) => {
        if (value && typeof value === 'object') {
            onChange({
                ...value,
                dpr: newDpr || 2
            });
        }
    };

    return (
        <div className="space-y-2">
            <DirectImageUpload
                themeId={themeId}
                value={value}
                onChange={handleImageChange}
                label={label}
                disabled={disabled}
            />

            {/* DPR selector (only show if image has dimensions) */}
            {value && value.width && value.height && (
                <div className="flex items-center gap-2 text-xs">
                    <label className="text-gray-600">Device Pixel Ratio:</label>
                    <select
                        value={value.dpr || 2}
                        onChange={(e) => handleDprChange(parseInt(e.target.value))}
                        disabled={disabled}
                        className="px-2 py-1 border border-gray-300 rounded text-xs focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                        <option value={1}>1x (Standard)</option>
                        <option value={2}>2x (Retina)</option>
                        <option value={3}>3x (High DPI)</option>
                    </select>
                    <span className="text-gray-500">
                        ({value.width}×{value.height}px @ {value.dpr || 2}x)
                    </span>
                </div>
            )}

            {/* Display validation warnings */}
            {imageWarnings.length > 0 && (
                <div className="space-y-1">
                    {imageWarnings.map((warning, idx) => (
                        <div
                            key={idx}
                            className={`flex items-start gap-2 p-2 rounded text-xs ${warning.severity === 'critical'
                                ? 'bg-red-50 text-red-800 border border-red-200'
                                : 'bg-amber-50 text-amber-800 border border-amber-200'
                                }`}
                        >
                            {warning.severity === 'critical' ? (
                                <AlertCircle className="h-4 w-4 flex-shrink-0 mt-0.5" />
                            ) : (
                                <AlertTriangle className="h-4 w-4 flex-shrink-0 mt-0.5" />
                            )}
                            <div className="flex-1">
                                <div className="font-medium mb-1">
                                    {warning.severity === 'critical' ? 'Critical' : 'Warning'}
                                </div>
                                <div>{warning.message}</div>
                                <div className="mt-1 text-xs opacity-75">
                                    Actual: {warning.actual_width}×{warning.actual_height}px
                                    {' • '}
                                    Minimum: {warning.min_width}px wide for retina display
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {/* Background CSS Properties (always visible) */}
            {imageUrl && (
                <div className="border border-gray-200 rounded-lg overflow-hidden">
                    <div className="px-3 py-2 bg-gray-50 text-sm font-medium text-gray-700">
                        <span>Background Properties</span>
                    </div>

                    <div className="p-3 space-y-3 bg-white">
                        {/* Background Size */}
                        <div>
                            <label className="block text-xs font-medium text-gray-700 mb-1">
                                Background Size
                            </label>
                            <select
                                value={backgroundSize}
                                onChange={(e) => handlePropertyChange('backgroundSize', e.target.value)}
                                disabled={disabled}
                                className="w-full px-2 py-1.5 border border-gray-300 rounded text-xs focus:outline-none focus:ring-2 focus:ring-blue-500"
                            >
                                <option value="">Not set (use widget CSS)</option>
                                <option value="contain">Contain (fit inside)</option>
                                <option value="cover">Cover (fill container)</option>
                                <option value="auto">Auto (original size)</option>
                                <option value="100% 100%">Stretch (100% 100%)</option>
                            </select>
                        </div>

                        {/* Background Position */}
                        <div>
                            <label className="block text-xs font-medium text-gray-700 mb-1">
                                Background Position
                            </label>
                            <select
                                value={backgroundPosition}
                                onChange={(e) => handlePropertyChange('backgroundPosition', e.target.value)}
                                disabled={disabled}
                                className="w-full px-2 py-1.5 border border-gray-300 rounded text-xs focus:outline-none focus:ring-2 focus:ring-blue-500"
                            >
                                <option value="">Not set (use widget CSS)</option>
                                <option value="top left">Top Left</option>
                                <option value="top center">Top Center</option>
                                <option value="top right">Top Right</option>
                                <option value="center left">Center Left</option>
                                <option value="center">Center</option>
                                <option value="center right">Center Right</option>
                                <option value="bottom left">Bottom Left</option>
                                <option value="bottom center">Bottom Center</option>
                                <option value="bottom right">Bottom Right</option>
                            </select>
                        </div>

                        {/* Background Repeat */}
                        <div>
                            <label className="block text-xs font-medium text-gray-700 mb-1">
                                Background Repeat
                            </label>
                            <select
                                value={backgroundRepeat}
                                onChange={(e) => handlePropertyChange('backgroundRepeat', e.target.value)}
                                disabled={disabled}
                                className="w-full px-2 py-1.5 border border-gray-300 rounded text-xs focus:outline-none focus:ring-2 focus:ring-blue-500"
                            >
                                <option value="">Not set (use widget CSS)</option>
                                <option value="no-repeat">No Repeat</option>
                                <option value="repeat">Repeat</option>
                                <option value="repeat-x">Repeat X (horizontal)</option>
                                <option value="repeat-y">Repeat Y (vertical)</option>
                                <option value="space">Space</option>
                                <option value="round">Round</option>
                            </select>
                        </div>

                        {/* Aspect Ratio Section */}
                        <div className="pt-3 border-t border-gray-200">
                            <div className="flex items-center gap-2 mb-2">
                                <input
                                    type="checkbox"
                                    id={`aspect-ratio-${part}-${breakpoint}`}
                                    checked={useAspectRatio}
                                    onChange={(e) => handlePropertyChange('useAspectRatio', e.target.checked)}
                                    disabled={disabled}
                                    className="h-4 w-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                                />
                                <label
                                    htmlFor={`aspect-ratio-${part}-${breakpoint}`}
                                    className="text-xs font-medium text-gray-700"
                                >
                                    Use Aspect Ratio
                                </label>
                            </div>

                            {useAspectRatio && (
                                <div>
                                    <label className="block text-xs font-medium text-gray-700 mb-1">
                                        Aspect Ratio
                                        {imageWidth && imageHeight && (
                                            <span className="ml-2 text-gray-500 font-normal">
                                                (auto: {imageWidth}/{imageHeight})
                                            </span>
                                        )}
                                    </label>
                                    <input
                                        type="text"
                                        value={aspectRatio}
                                        onChange={(e) => handlePropertyChange('aspectRatio', e.target.value)}
                                        disabled={disabled}
                                        placeholder="16/9 or 1.777"
                                        className="w-full px-2 py-1.5 border border-gray-300 rounded text-xs focus:outline-none focus:ring-2 focus:ring-blue-500"
                                    />
                                    <p className="mt-1 text-xs text-gray-500">
                                        Format: width/height (e.g., 16/9) or decimal (e.g., 1.777)
                                    </p>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

CompositeImagePropertyField.displayName = 'CompositeImagePropertyField';

export default CompositeImagePropertyField;

