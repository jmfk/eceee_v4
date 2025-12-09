/**
 * OptimizedImage component with imgproxy integration
 * 
 * Supports both single-size and responsive multi-breakpoint images.
 * Uses secure backend API for imgproxy URL signing.
 */

import React, { useState, useCallback, useEffect } from 'react';
import { getImgproxyUrl, getResponsiveImgproxyUrls } from '../../utils/imgproxySecure';

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
    breakpoints = { mobile: 640, tablet: 1024, desktop: 1280 },
    slotDimensions = null,
    widthMultiplier = 1.0,
    densities = [1, 2],
    sizes = null, // Will be auto-generated if not provided
    placeholder = false,
    placeholderSize = 50,
    loading = 'lazy',
    onLoad,
    onError,
    fallback,
    ...props
}) => {
    const [imageLoaded, setImageLoaded] = useState(false);
    const [imageError, setImageError] = useState(false);
    const [showPlaceholder, setShowPlaceholder] = useState(false);
    const [optimizedSrc, setOptimizedSrc] = useState('');
    const [srcSet, setSrcSet] = useState('');
    const [sizesAttr, setSizesAttr] = useState('');

    // Load optimized image URL(s)
    useEffect(() => {
        if (!src) {
            setOptimizedSrc('');
            setSrcSet('');
            setSizesAttr('');
            return;
        }

        let cancelled = false;

        const loadImage = async () => {
            try {
                if (responsive) {
                    // Generate responsive URLs with multiple breakpoints
                    const result = await getResponsiveImgproxyUrls(src, {
                        breakpoints,
                        slotDimensions,
                        widthMultiplier,
                        densities,
                        resizeType,
                        gravity,
                        quality,
                        format,
                    });

                    if (!cancelled) {
                        setOptimizedSrc(result.fallback || src);
                        setSrcSet(result.srcset || '');
                        setSizesAttr(sizes || result.sizes || '100vw');
                    }
                } else {
                    // Single size optimization
                    const url = await getImgproxyUrl(src, {
                        width,
                        height,
                        resize_type: resizeType,
                        gravity,
                        quality,
                        format,
                    });

                    if (!cancelled) {
                        setOptimizedSrc(url || src);
                        setSrcSet('');
                        setSizesAttr('');
                    }
                }
            } catch (error) {
                console.error('Error loading optimized image:', error);
                if (!cancelled) {
                    setOptimizedSrc(src);
                    setSrcSet('');
                    setSizesAttr('');
                }
            }
        };

        loadImage();

        return () => {
            cancelled = true;
        };
    }, [src, responsive, width, height, resizeType, gravity, quality, format, 
        JSON.stringify(breakpoints), JSON.stringify(slotDimensions), 
        widthMultiplier, JSON.stringify(densities), sizes]);

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

    // Extract object-fit class from className prop (if present)
    const objectFitMatch = className.match(/object-(cover|contain|fill|none|scale-down)/);
    const objectFitClass = objectFitMatch ? objectFitMatch[0] : 'object-cover';
    const wrapperClassName = className.replace(/object-(cover|contain|fill|none|scale-down)/, '').trim();

    return (
        <div className={`relative overflow-hidden ${wrapperClassName}`} style={style}>
            {/* Placeholder image */}
            {showPlaceholder && placeholderSrc && (
                <img
                    src={placeholderSrc}
                    alt=""
                    className={`absolute inset-0 w-full h-full ${objectFitClass} filter blur-sm scale-110 transition-opacity duration-300`}
                    style={{
                        opacity: imageLoaded ? 0 : 1,
                    }}
                />
            )}

            {/* Main optimized image */}
            {optimizedSrc && (
                <img
                    src={optimizedSrc}
                    srcSet={srcSet || undefined}
                    sizes={sizesAttr || undefined}
                    alt={alt}
                    width={width}
                    height={height}
                    loading={loading}
                    className={`w-full h-full ${objectFitClass} transition-opacity duration-300 ${imageLoaded ? 'opacity-100' : 'opacity-0'
                        }`}
                    onLoad={handleLoad}
                    onError={handleError}
                    {...props}
                />
            )}

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
