/**
 * ImagePropertyField Component
 * 
 * Reusable field for image properties in layoutProperties.
 * Uses DirectImageUpload for direct object storage uploads.
 * Displays validation warnings for undersized images.
 */

import React from 'react';
import { AlertTriangle, AlertCircle } from 'lucide-react';
import DirectImageUpload from './DirectImageUpload';

const ImagePropertyField = ({
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
                onChange={onChange}
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
                            className={`flex items-start gap-2 p-2 rounded text-xs ${
                                warning.severity === 'critical'
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
        </div>
    );
};

ImagePropertyField.displayName = 'ImagePropertyField';

export default ImagePropertyField;

