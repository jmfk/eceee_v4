/**
 * OptimizedImage component with imgproxy integration
 */

import React, { useState, useCallback } from 'react';
import { generateImgproxyUrl, generateSrcSet, generateThumbnailUrl } from '../../utils/imgproxy';

const OptimizedImage = ({
    src,
    alt,
    width,
    height,
    className = '',
    style = {},
    quality = 85,
    format,
    resizeType = 'fit',
    gravity = 'sm',
    responsive = false,
    responsiveWidths = [300, 600, 900, 1200],
    sizes = '100vw',
    placeholder = true,
    placeholderSize = 50,
    loading = 'lazy',
    onLoad,
    onError,
    fallback,
    ...props
}) => {
    const [imageLoaded, setImageLoaded] = useState(false);
    const [imageError, setImageError] = useState(false);
    const [showPlaceholder, setShowPlaceholder] = useState(placeholder);

    // Generate optimized image URL with actual dimensions
    const optimizedSrc = src ? generateImgproxyUrl(src, {
        width,
        height,
        quality,
        format,
        resizeType,
        gravity,
    }) : '';
    // Generate placeholder URL
    const placeholderSrc = src && placeholder ? generateThumbnailUrl(src, placeholderSize) : '';
    // Generate responsive srcSet
    const srcSet = src && responsive ? generateSrcSet(src, responsiveWidths, {
        quality,
        format,
        resizeType,
        gravity,
    }) : '';

    const handleLoad = useCallback((event) => {
        setImageLoaded(true);
        setShowPlaceholder(false);
        onLoad?.(event);
    }, [onLoad]);

    const handleError = useCallback((event) => {
        setImageError(true);
        setShowPlaceholder(false);
        onError?.(event);
    }, [onError]);

    // If there's an error and a fallback is provided
    if (imageError && fallback) {
        return fallback;
    }

    // If no src is provided
    if (!src) {
        return (
            <div
                className={`bg-gray-200 flex items-center justify-center ${className}`}
                style={{ width, height, ...style }}
            >
                <span className="text-gray-400 text-sm">No image</span>
            </div>
        );
    }

    return (
        <div className={`relative overflow-hidden ${className}`} style={style}>
            {/* Placeholder image */}
            {showPlaceholder && placeholderSrc && (
                <img
                    src={placeholderSrc}
                    alt=""
                    className="absolute inset-0 w-full h-full object-cover filter blur-sm scale-110 transition-opacity duration-300"
                    style={{
                        opacity: imageLoaded ? 0 : 1,
                    }}
                />
            )}

            {/* Main optimized image */}
            <img
                src={optimizedSrc}
                srcSet={responsive ? srcSet : undefined}
                sizes={responsive ? sizes : undefined}
                alt={alt}
                width={width}
                height={height}
                loading={loading}
                className={`w-full h-full object-cover transition-opacity duration-300 ${imageLoaded ? 'opacity-100' : 'opacity-0'
                    }`}
                onLoad={handleLoad}
                onError={handleError}
                {...props}
            />

            {/* Loading indicator */}
            {!imageLoaded && !imageError && !showPlaceholder && (
                <div className="absolute inset-0 bg-gray-200 animate-pulse flex items-center justify-center">
                    <div className="w-8 h-8 border-2 border-gray-300 border-t-blue-500 rounded-full animate-spin"></div>
                </div>
            )}

            {/* Error state */}
            {imageError && !fallback && (
                <div className="absolute inset-0 bg-gray-100 flex items-center justify-center">
                    <div className="text-center text-gray-400">
                        <svg className="w-12 h-12 mx-auto mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                        </svg>
                        <p className="text-sm">Failed to load image</p>
                    </div>
                </div>
            )}
        </div>
    );
};

export default OptimizedImage;
