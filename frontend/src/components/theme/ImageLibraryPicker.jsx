import React, { useState, useEffect } from 'react';
import { X, Search, Image as ImageIcon, Loader2, CheckCircle, AlertCircle } from 'lucide-react';
import { themesApi } from '../../api/themes';
import { useGlobalNotifications } from '../../contexts/GlobalNotificationContext';

const ImageLibraryPicker = ({ themeId, onSelect, onCancel, currentSelection }) => {
    const [images, setImages] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedImage, setSelectedImage] = useState(currentSelection);
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

    const filteredImages = images.filter(image =>
        image.filename.toLowerCase().includes(searchTerm.toLowerCase())
    );

    const handleSelect = (image) => {
        setSelectedImage(image);
    };

    const handleConfirm = () => {
        if (selectedImage && onSelect) {
            onSelect({
                url: selectedImage.url,
                filename: selectedImage.filename,
                size: selectedImage.size
            });
        }
    };

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[10010]">
            <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full mx-4 max-h-[90vh] flex flex-col">
                {/* Header */}
                <div className="px-6 py-4 border-b border-gray-200">
                    <div className="flex items-center justify-between mb-4">
                        <h3 className="text-lg font-semibold text-gray-900">
                            Select Image from Library
                        </h3>
                        <button
                            onClick={onCancel}
                            className="text-gray-400 hover:text-gray-600 transition"
                        >
                            <X className="h-5 w-5" />
                        </button>
                    </div>
                    
                    {/* Search */}
                    <div className="relative">
                        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                        <input
                            type="text"
                            placeholder="Search images..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="pl-10 pr-4 py-2 border border-gray-300 rounded-md w-full focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
                        />
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
                            <h4 className="text-lg font-medium text-gray-900 mb-2">
                                {searchTerm ? 'No matching images' : 'No images in library'}
                            </h4>
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
                                            <img
                                                key={`${image.filename}-${image.uploadedAt || 'initial'}-${image.pageLoadTime}`}
                                                src={`${image.publicUrl || image.url}?v=${image.uploadedAt ? new Date(image.uploadedAt).getTime() : image.pageLoadTime}`}
                                                alt={image.filename}
                                                className="w-full h-auto max-h-96 object-contain"
                                                onError={(e) => {
                                                    e.target.style.display = 'none';
                                                    e.target.parentElement.innerHTML = '<div class="text-gray-400 py-12"><svg class="h-12 w-12 mx-auto" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg></div>';
                                                }}
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

