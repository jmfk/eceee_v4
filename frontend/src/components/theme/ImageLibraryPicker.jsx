import React, { useState, useEffect } from 'react';
import { X, Search, Image as ImageIcon, Loader2, CheckCircle, AlertCircle, Filter } from 'lucide-react';
import { themesApi } from '../../api/themes';
import { useGlobalNotifications } from '../../contexts/GlobalNotificationContext';
import OptimizedImage from '../media/OptimizedImage';

const ImageLibraryPicker = ({ themeId, onSelect, onCancel, currentSelection }) => {
    const [images, setImages] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedImage, setSelectedImage] = useState(currentSelection);
    const [minWidth, setMinWidth] = useState('');
    const [maxWidth, setMaxWidth] = useState('');
    const [minHeight, setMinHeight] = useState('');
    const [maxHeight, setMaxHeight] = useState('');
    const [use2x, setUse2x] = useState(false);
    const { addNotification } = useGlobalNotifications();

    useEffect(() => {
        loadImages();
    }, [themeId]);

    const loadImages = async () => {
        setLoading(true);
        try {
            const result = await themesApi.listLibraryImages(themeId);
            // Add page load timestamp for cache busting
            const pageLoadTime = Date.now();
            setImages((result.images || []).map(img => ({
                ...img,
                pageLoadTime
            })));
        } catch (error) {
            addNotification({
                type: 'error',
                message: error.message || 'Failed to load library images'
            });
        } finally {
            setLoading(false);
        }
    };

    const filteredImages = images.filter(image => {
        // Text search
        if (!image.filename.toLowerCase().includes(searchTerm.toLowerCase())) {
            return false;
        }

        // Dimension filters (only apply if dimensions are available)
        if (image.width && image.height) {
            const multiplier = use2x ? 2 : 1;
            const minW = minWidth ? parseInt(minWidth, 10) * multiplier : null;
            const maxW = maxWidth ? parseInt(maxWidth, 10) * multiplier : null;
            const minH = minHeight ? parseInt(minHeight, 10) * multiplier : null;
            const maxH = maxHeight ? parseInt(maxHeight, 10) * multiplier : null;

            if (minW && image.width < minW) return false;
            if (maxW && image.width > maxW) return false;
            if (minH && image.height < minH) return false;
            if (maxH && image.height > maxH) return false;
        }

        return true;
    });

    const handleSelect = (image) => {
        setSelectedImage(image);
    };

    const handleConfirm = () => {
        if (selectedImage && onSelect) {
            const imageData = {
                url: selectedImage.url,
                filename: selectedImage.filename,
                size: selectedImage.size
            };
            
            // Include dimensions if available
            if (selectedImage.width && selectedImage.height) {
                imageData.width = selectedImage.width;
                imageData.height = selectedImage.height;
            }
            
            onSelect(imageData);
        }
    };

    const clearFilters = () => {
        setSearchTerm('');
        setMinWidth('');
        setMaxWidth('');
        setMinHeight('');
        setMaxHeight('');
        setUse2x(false);
    };

    const hasActiveFilters = searchTerm || minWidth || maxWidth || minHeight || maxHeight;

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[10010]">
            <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full mx-4 max-h-[90vh] flex flex-col">
                {/* Header */}
                <div className="px-6 py-4 border-b border-gray-200">
                    <div className="flex items-center justify-between mb-4">
                        <div className="text-lg font-semibold text-gray-900">
                            Select Image from Library
                        </div>
                        <button
                            onClick={onCancel}
                            className="text-gray-400 hover:text-gray-600 transition"
                        >
                            <X className="h-5 w-5" />
                        </button>
                    </div>
                    
                    {/* Search */}
                    <div className="relative mb-3">
                        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                        <input
                            type="text"
                            placeholder="Search images..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="pl-10 pr-4 py-2 border border-gray-300 rounded-md w-full focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
                        />
                    </div>

                    {/* Dimension Filters */}
                    <div className="space-y-2">
                        <div className="flex items-center gap-2 text-sm text-gray-700">
                            <Filter className="h-4 w-4" />
                            <span className="font-medium">Filter by Dimensions</span>
                            <label className="ml-auto flex items-center gap-1.5 cursor-pointer">
                                <input
                                    type="checkbox"
                                    checked={use2x}
                                    onChange={(e) => setUse2x(e.target.checked)}
                                    className="w-4 h-4 text-purple-600 border-gray-300 rounded focus:ring-purple-500"
                                />
                                <span className="text-xs font-medium">×2 (Retina)</span>
                            </label>
                            {hasActiveFilters && (
                                <button
                                    onClick={clearFilters}
                                    className="text-xs text-purple-600 hover:text-purple-700 underline"
                                >
                                    Clear all filters
                                </button>
                            )}
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                            <div>
                                <label className="block text-xs text-gray-600 mb-1">Min Width (px)</label>
                                <input
                                    type="number"
                                    placeholder="e.g. 800"
                                    value={minWidth}
                                    onChange={(e) => setMinWidth(e.target.value)}
                                    className="w-full px-3 py-1.5 text-sm border border-gray-300 rounded-md focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
                                />
                            </div>
                            <div>
                                <label className="block text-xs text-gray-600 mb-1">Max Width (px)</label>
                                <input
                                    type="number"
                                    placeholder="e.g. 1920"
                                    value={maxWidth}
                                    onChange={(e) => setMaxWidth(e.target.value)}
                                    className="w-full px-3 py-1.5 text-sm border border-gray-300 rounded-md focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
                                />
                            </div>
                            <div>
                                <label className="block text-xs text-gray-600 mb-1">Min Height (px)</label>
                                <input
                                    type="number"
                                    placeholder="e.g. 600"
                                    value={minHeight}
                                    onChange={(e) => setMinHeight(e.target.value)}
                                    className="w-full px-3 py-1.5 text-sm border border-gray-300 rounded-md focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
                                />
                            </div>
                            <div>
                                <label className="block text-xs text-gray-600 mb-1">Max Height (px)</label>
                                <input
                                    type="number"
                                    placeholder="e.g. 1080"
                                    value={maxHeight}
                                    onChange={(e) => setMaxHeight(e.target.value)}
                                    className="w-full px-3 py-1.5 text-sm border border-gray-300 rounded-md focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
                                />
                            </div>
                        </div>
                    </div>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto p-6">
                    {loading ? (
                        <div className="flex items-center justify-center py-12">
                            <Loader2 className="h-8 w-8 text-purple-600 animate-spin" />
                        </div>
                    ) : filteredImages.length === 0 ? (
                        <div className="text-center py-12">
                            <ImageIcon className="h-16 w-16 text-gray-400 mx-auto mb-4" />
                            <div className="text-lg font-medium text-gray-900 mb-2">
                                {searchTerm ? 'No matching images' : 'No images in library'}
                            </div>
                            <p className="text-gray-600">
                                {searchTerm 
                                    ? 'Try a different search term' 
                                    : 'Upload images to the library to get started'
                                }
                            </p>
                        </div>
                    ) : (
                        <div className="space-y-4">
                            {filteredImages.map((image) => {
                                const isSelected = selectedImage?.filename === image.filename;
                                return (
                                    <div
                                        key={image.filename}
                                        className={`relative cursor-pointer overflow-hidden border-2 transition bg-white shadow-sm ${
                                            isSelected
                                                ? 'border-purple-500 ring-2 ring-purple-200'
                                                : 'border-gray-200 hover:border-gray-300'
                                        }`}
                                        onClick={() => handleSelect(image)}
                                    >
                                        {/* Image - Full Width */}
                                        <div className="w-full bg-gray-100 flex items-center justify-center overflow-hidden max-h-96">
                                            <OptimizedImage
                                                src={image.imgproxyBaseUrl || image.publicUrl || image.url}
                                                alt={image.filename}
                                                width={image.width}
                                                height={image.height}
                                                actualWidth={image.width}
                                                actualHeight={image.height}
                                                className="w-full h-auto max-h-96 object-contain"
                                                resizeType="fit"
                                                quality={85}
                                            />
                                        </div>

                                        {/* Selected Indicator */}
                                        {isSelected && (
                                            <div className="absolute top-3 right-3 bg-white rounded-full p-1 shadow-lg">
                                                <CheckCircle className="h-6 w-6 text-purple-600" />
                                            </div>
                                        )}

                                        {/* Info Below Image */}
                                        <div className="p-3 bg-white">
                                            <div className="flex items-start justify-between gap-3">
                                                {/* Left side: Name and details */}
                                                <div className="flex-1 min-w-0">
                                                    <div className="text-sm font-medium text-gray-900 truncate mb-1" title={image.filename}>
                                                        {image.filename}
                                                    </div>
                                                    <div className="flex items-center gap-3 text-xs text-gray-600">
                                                        {image.width && image.height && (
                                                            <span className="font-medium text-gray-700">{image.width} × {image.height}</span>
                                                        )}
                                                        <span>{(image.size / 1024).toFixed(1)} KB</span>
                                                        {image.uploadedAt && (
                                                            <span>{new Date(image.uploadedAt).toLocaleDateString()}</span>
                                                        )}
                                                        {image.usedIn && image.usedIn.length > 0 && (
                                                            <span className="px-2 py-0.5 bg-blue-100 text-blue-700 rounded-full inline-flex items-center gap-1" title={image.usedIn.join(', ')}>
                                                                <AlertCircle className="h-3 w-3" />
                                                                Used: {image.usedIn.length}
                                                            </span>
                                                        )}
                                                    </div>
                                                </div>
                                                
                                                {/* Right side: Select indicator */}
                                                {isSelected && (
                                                    <div className="flex items-center gap-2 text-purple-600 text-sm font-medium">
                                                        <CheckCircle className="h-4 w-4" />
                                                        Selected
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="px-6 py-4 border-t border-gray-200 flex items-center justify-between">
                    <div className="text-sm text-gray-600">
                        {selectedImage ? (
                            <span>Selected: <span className="font-medium">{selectedImage.filename}</span></span>
                        ) : (
                            <span>Select an image to continue</span>
                        )}
                    </div>
                    <div className="flex items-center gap-3">
                        <button
                            onClick={onCancel}
                            className="px-4 py-2 border border-gray-300 text-gray-700 rounded-md hover:bg-gray-50 transition"
                        >
                            Cancel
                        </button>
                        <button
                            onClick={handleConfirm}
                            className="px-4 py-2 bg-purple-600 text-white rounded-md hover:bg-purple-700 transition disabled:opacity-50 disabled:cursor-not-allowed"
                            disabled={!selectedImage}
                        >
                            Select Image
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default ImageLibraryPicker;

