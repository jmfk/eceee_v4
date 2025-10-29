/**
 * ImageUpload Component
 * 
 * Specialized component for theme image uploads with Django integration
 * - Shows current image with overlay controls
 * - Replace/Remove buttons on hover
 * - Upload button when no image exists
 */

import React, { useState } from 'react';
import { Upload, X, RefreshCw } from 'lucide-react';

const ImageUpload = ({ imageUrl, onUpload, onRemove, isUploading = false }) => {
    const [isHovering, setIsHovering] = useState(false);

    return (
        <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
                Preview Image
            </label>

            {imageUrl ? (
                /* Image exists - show with replace/remove controls */
                <div
                    className="relative inline-block group"
                    onMouseEnter={() => setIsHovering(true)}
                    onMouseLeave={() => setIsHovering(false)}
                >
                    <img
                        src={imageUrl}
                        alt="Theme preview"
                        className="w-full max-w-2xl h-48 object-cover rounded-lg border-2 border-gray-300 transition-opacity group-hover:opacity-75"
                    />

                    {/* Overlay controls on hover */}
                    <div className={`absolute inset-0 flex items-center justify-center gap-3 transition-opacity ${isHovering ? 'opacity-100' : 'opacity-0'
                        }`}>
                        <label className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 cursor-pointer shadow-lg transition-colors">
                            <RefreshCw className="w-4 h-4 mr-2" />
                            Replace
                            <input
                                type="file"
                                accept="image/*"
                                onChange={(e) => {
                                    const file = e.target.files?.[0];
                                    if (file) {
                                        onUpload(file);
                                    }
                                    e.target.value = ''; // Reset input
                                }}
                                className="hidden"
                                disabled={isUploading}
                            />
                        </label>

                        <button
                            type="button"
                            onClick={onRemove}
                            className="inline-flex items-center px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 shadow-lg transition-colors"
                            disabled={isUploading}
                        >
                            <X className="w-4 h-4 mr-2" />
                            Remove
                        </button>
                    </div>

                    {isUploading && (
                        <div className="absolute inset-0 bg-white/75 flex items-center justify-center rounded-lg">
                            <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                        </div>
                    )}
                </div>
            ) : (
                /* No image - show upload prompt */
                <div className="border-2 border-dashed border-gray-300 rounded-lg p-12 text-center hover:border-gray-400 transition-colors">
                    <Upload className="w-12 h-12 mx-auto text-gray-400 mb-3" />
                    <p className="text-sm text-gray-600 mb-4">No preview image</p>
                    <label className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 cursor-pointer transition-colors">
                        <Upload className="w-4 h-4 mr-2" />
                        Upload Image
                        <input
                            type="file"
                            accept="image/*"
                            onChange={(e) => {
                                const file = e.target.files?.[0];
                                if (file) {
                                    onUpload(file);
                                }
                                e.target.value = ''; // Reset input
                            }}
                            className="hidden"
                            disabled={isUploading}
                        />
                    </label>
                    <p className="mt-3 text-xs text-gray-500">
                        Recommended: 1200x600px
                    </p>
                </div>
            )}
        </div>
    );
};

export default ImageUpload;

