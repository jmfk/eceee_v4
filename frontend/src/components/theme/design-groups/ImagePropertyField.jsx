/**
 * ImagePropertyField Component
 * 
 * Reusable field for image properties in layoutProperties.
 * Wraps ImageInput component for media library integration.
 */

import React from 'react';
import { X, Image as ImageIcon } from 'lucide-react';
import ImageInput from '../../form-fields/ImageInput';

const ImagePropertyField = ({
    value,
    onChange,
    label,
    breakpoint,
    part,
    disabled = false,
}) => {
    const handleImageChange = (mediaFile) => {
        onChange(mediaFile);
    };

    const handleRemove = () => {
        onChange(null);
    };

    // Extract image info for display
    const imageUrl = value?.fileUrl || value?.file_url;
    const imageTitle = value?.title;

    return (
        <div className="space-y-2">
            <label className="block text-xs font-medium text-gray-700">
                {label}
            </label>

            {imageUrl ? (
                <div className="border border-gray-300 rounded-lg p-3 bg-white">
                    <div className="flex items-start gap-3">
                        {/* Thumbnail */}
                        <div className="flex-shrink-0">
                            <img
                                src={imageUrl}
                                alt={imageTitle || 'Header image'}
                                className="w-20 h-20 object-cover rounded border border-gray-200"
                            />
                        </div>

                        {/* Info */}
                        <div className="flex-1 min-w-0">
                            <div className="text-sm font-medium text-gray-900 truncate">
                                {imageTitle || 'Header Image'}
                            </div>
                            <div className="text-xs text-gray-500 mt-1">
                                Breakpoint: {breakpoint.toUpperCase()}
                            </div>
                            {value?.width && value?.height && (
                                <div className="text-xs text-gray-500">
                                    {value.width} × {value.height}px
                                </div>
                            )}
                        </div>

                        {/* Remove button */}
                        <button
                            type="button"
                            onClick={handleRemove}
                            disabled={disabled}
                            className="flex-shrink-0 p-1 text-gray-400 hover:text-red-600 transition disabled:opacity-50"
                            title="Remove image"
                        >
                            <X className="h-4 w-4" />
                        </button>
                    </div>

                    {/* Change button */}
                    <div className="mt-3 pt-3 border-t border-gray-200">
                        <ImageInput
                            value={value}
                            onChange={handleImageChange}
                            label="Change Image"
                            namespace="headers"
                            autoTags={`header,${breakpoint}`}
                            disabled={disabled}
                            allowCollections={false}
                            multiple={false}
                        />
                    </div>
                </div>
            ) : (
                <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 bg-gray-50 hover:bg-gray-100 transition">
                    <div className="flex flex-col items-center justify-center text-center">
                        <ImageIcon className="h-8 w-8 text-gray-400 mb-2" />
                        <div className="text-sm text-gray-600 mb-3">
                            No image selected
                        </div>
                        <ImageInput
                            value={value}
                            onChange={handleImageChange}
                            label="Upload Image"
                            namespace="headers"
                            autoTags={`header,${breakpoint}`}
                            disabled={disabled}
                            allowCollections={false}
                            multiple={false}
                        />
                    </div>
                </div>
            )}
        </div>
    );
};

ImagePropertyField.displayName = 'ImagePropertyField';

export default ImagePropertyField;

