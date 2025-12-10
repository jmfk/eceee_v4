/**
 * Secure imgproxy utilities for frontend
 * 
 * Uses server-side URL signing to keep imgproxy keys secure.
 * Never exposes signing keys to the client.
 */

import React from 'react';

const API_BASE_URL = '';
const IMGPROXY_SIGN_URL = `${API_BASE_URL}/api/v1/media/imgproxy/sign/`;
const IMGPROXY_BATCH_SIGN_URL = `${API_BASE_URL}/api/v1/media/imgproxy/sign-batch/`;
const IMGPROXY_RESPONSIVE_URL = `${API_BASE_URL}/api/v1/media/imgproxy/responsive/`;

// In-memory cache for generated URLs (prevents duplicate API calls)
const urlCache = new Map();
const CACHE_TTL = 60 * 60 * 1000; // 1 hour

/**
 * Get a signed imgproxy URL from the backend API
 * 
 * @param {string} sourceUrl - Source image URL (from MediaFile.imgproxy_base_url)
 * @param {Object} options - Image processing options
 * @returns {Promise<string>} Signed imgproxy URL
 * 
 * @example
 * const imageUrl = await getImgproxyUrl(
 *   'http://minio:9000/eceee-media/uploads/image.jpg',
 *   { width: 1280, height: 132, resize_type: 'fill', gravity: 'sm' }
 * );
 */
export async function getImgproxyUrl(sourceUrl, options = {}) {
    if (!sourceUrl) {
        console.warn('getImgproxyUrl: No source URL provided');
        return '';
    }

    // Generate cache key
    const cacheKey = JSON.stringify({ sourceUrl, ...options });

    // Check cache first
    const cached = urlCache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
        return cached.url;
    }

    try {
        const response = await fetch(IMGPROXY_SIGN_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                source_url: sourceUrl,
                ...options,
            }),
        });

        if (!response.ok) {
            throw new Error(`Failed to get imgproxy URL: ${response.statusText}`);
        }

        const data = await response.json();
        const imgproxyUrl = data.imgproxyUrl;

        // Cache the result
        urlCache.set(cacheKey, {
            url: imgproxyUrl,
            timestamp: Date.now(),
        });

        return imgproxyUrl;
    } catch (error) {
        console.error('Error getting imgproxy URL:', error);
        // Fallback to original URL
        return sourceUrl;
    }
}

/**
 * Get multiple signed imgproxy URLs in a single batch request
 * 
 * @param {Array} requests - Array of {sourceUrl, ...options} objects
 * @returns {Promise<Array>} Array of signed imgproxy URLs
 * 
 * @example
 * const urls = await getBatchImgproxyUrls([
 *   { sourceUrl: 'http://...', width: 800, height: 600 },
 *   { sourceUrl: 'http://...', width: 400, height: 400 }
 * ]);
 */
export async function getBatchImgproxyUrls(requests) {
    if (!requests || requests.length === 0) {
        return [];
    }

    try {
        // Transform requests to API format
        const apiRequests = requests.map(({ sourceUrl, ...options }) => ({
            source_url: sourceUrl,
            ...options,
        }));

        const response = await fetch(IMGPROXY_BATCH_SIGN_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                requests: apiRequests,
            }),
        });

        if (!response.ok) {
            throw new Error(`Failed to get batch imgproxy URLs: ${response.statusText}`);
        }

        const data = await response.json();
        return data.results.map(result => result.imgproxyUrl || result.sourceUrl);
    } catch (error) {
        console.error('Error getting batch imgproxy URLs:', error);
        // Fallback to original URLs
        return requests.map(req => req.sourceUrl);
    }
}

/**
 * Get responsive imgproxy URLs for different breakpoints and pixel densities
 * 
 * @param {string|Object} sourceUrlOrImage - Source URL or MediaFile image object
 * @param {Object} config - Configuration options
 * @param {Object} config.breakpoints - Breakpoint widths { mobile: 640, tablet: 1024, desktop: 1280 }
 * @param {Object} config.slotDimensions - Optional slot dimensions from layout system
 * @param {number} config.widthMultiplier - Multiplier for images that don't fill full slot (default: 1.0)
 * @param {Array} config.densities - Pixel densities to generate (default: [1, 2])
 * @param {string} config.resizeType - Resize type (default: 'fit')
 * @param {string} config.gravity - Gravity for cropping (default: 'sm')
 * @param {number} config.quality - Image quality (default: 85)
 * @param {string} config.format - Output format (optional, e.g., 'webp')
 * @returns {Promise<Object>} { srcset, sizes, urls, fallback }
 * 
 * @example
 * const responsive = await getResponsiveImgproxyUrls(
 *   image.imgproxyBaseUrl,
 *   {
 *     breakpoints: { mobile: 640, tablet: 1024, desktop: 1280 },
 *     widthMultiplier: 0.5,  // Half-width image
 *     densities: [1, 2]
 *   }
 * );
 * // Use: <img srcset={responsive.srcset} sizes={responsive.sizes} src={responsive.fallback} />
 */
export async function getResponsiveImgproxyUrls(sourceUrlOrImage, config = {}) {
    // Extract source URL from image object or use directly
    let sourceUrl = sourceUrlOrImage;
    let originalWidth = null;
    let originalHeight = null;
    
    if (typeof sourceUrlOrImage === 'object' && sourceUrlOrImage !== null) {
        sourceUrl = sourceUrlOrImage.imgproxyBaseUrl || sourceUrlOrImage.fileUrl;
        originalWidth = sourceUrlOrImage.width || sourceUrlOrImage.originalWidth;
        originalHeight = sourceUrlOrImage.height || sourceUrlOrImage.originalHeight;
    }
    
    if (!sourceUrl) {
        console.warn('getResponsiveImgproxyUrls: No source URL provided');
        return { srcset: '', sizes: '', urls: {}, fallback: '' };
    }

    // Extract configuration with defaults
    const {
        breakpoints = { mobile: 640, tablet: 1024, desktop: 1280 },
        slotDimensions = null,
        widthMultiplier = 1.0,
        densities = [1, 2],
        resizeType = 'fit',
        gravity = 'sm',
        quality = 85,
        format = null,
    } = config;

    // Use slot dimensions if provided, otherwise use standard breakpoints
    const finalBreakpoints = slotDimensions ? {
        mobile: slotDimensions.mobile?.width || breakpoints.mobile,
        tablet: slotDimensions.tablet?.width || breakpoints.tablet,
        desktop: slotDimensions.desktop?.width || breakpoints.desktop,
    } : breakpoints;

    // Generate cache key
    const cacheKey = JSON.stringify({
        sourceUrl,
        breakpoints: finalBreakpoints,
        originalWidth,
        originalHeight,
        widthMultiplier,
        densities,
        resizeType,
        gravity,
        quality,
        format,
    });

    // Check cache first
    const cached = urlCache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
        return cached.data;
    }

    try {
        const response = await fetch(IMGPROXY_RESPONSIVE_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                source_url: sourceUrl,
                breakpoints: finalBreakpoints,
                original_width: originalWidth,
                original_height: originalHeight,
                resize_type: resizeType,
                gravity,
                quality,
                format,
                densities,
                width_multiplier: widthMultiplier,
            }),
        });

        if (!response.ok) {
            throw new Error(`Failed to get responsive imgproxy URLs: ${response.statusText}`);
        }

        const data = await response.json();

        // Cache the result
        urlCache.set(cacheKey, {
            data,
            timestamp: Date.now(),
        });

        return data;
    } catch (error) {
        console.error('Error getting responsive imgproxy URLs:', error);
        // Fallback to simple single URL
        return {
            srcset: '',
            sizes: '',
            urls: {},
            fallback: sourceUrl,
        };
    }
}

/**
 * Helper function to get imgproxy URL from MediaFile image object
 * 
 * @param {Object} imageObj - MediaFile image object from API
 * @param {Object} options - Image processing options
 * @returns {Promise<string>} Signed imgproxy URL
 * 
 * @example
 * const imageUrl = await getImgproxyUrlFromImage(
 *   config.image,
 *   { width: 1280, height: 132, resizeType: 'fill' }
 * );
 */
export async function getImgproxyUrlFromImage(imageObj, options = {}) {
    if (!imageObj) return '';
    
    // Handle accidental array wrapping (defensive fix)
    if (Array.isArray(imageObj)) {
        console.warn('getImgproxyUrlFromImage: Received array, extracting first item');
        imageObj = imageObj[0];
        if (!imageObj) return '';
    }

    // Try camelCase first (from API via djangorestframework-camel-case)
    let sourceUrl = imageObj.imgproxyBaseUrl || imageObj.fileUrl;
    
    // Fallback to snake_case (for any legacy data or direct DB access)
    if (!sourceUrl) {
        sourceUrl = imageObj.imgproxy_base_url || imageObj.file_url;
    }
    
    if (!sourceUrl) {
        console.error('getImgproxyUrlFromImage: No valid URL in image object', {
            imageObject: imageObj,
            hasImgproxyBaseUrl: !!imageObj.imgproxyBaseUrl,
            hasImgproxy_base_url: !!imageObj.imgproxy_base_url,
            hasFileUrl: !!imageObj.fileUrl,
            hasFile_url: !!imageObj.file_url,
            availableKeys: Object.keys(imageObj),
            imageObjType: typeof imageObj,
            isDict: imageObj && typeof imageObj === 'object' && !Array.isArray(imageObj)
        });
        return '';
    }

    return getImgproxyUrl(sourceUrl, options);
}

/**
 * React hook for getting imgproxy URL with automatic updates
 * 
 * @param {string} sourceUrl - Source image URL
 * @param {Object} options - Image processing options
 * @returns {Object} { url, loading, error }
 * 
 * @example
 * const { url, loading, error } = useImgproxyUrl(
 *   image.imgproxy_base_url,
 *   { width: 800, height: 600 }
 * );
 */
export function useImgproxyUrl(sourceUrl, options = {}) {
    const [state, setState] = React.useState({
        url: '',
        loading: true,
        error: null,
    });

    React.useEffect(() => {
        if (!sourceUrl) {
            setState({ url: '', loading: false, error: null });
            return;
        }

        let cancelled = false;

        getImgproxyUrl(sourceUrl, options)
            .then(url => {
                if (!cancelled) {
                    setState({ url, loading: false, error: null });
                }
            })
            .catch(error => {
                if (!cancelled) {
                    setState({ url: sourceUrl, loading: false, error });
                }
            });

        return () => {
            cancelled = true;
        };
    }, [sourceUrl, JSON.stringify(options)]);

    return state;
}

/**
 * Preload imgproxy URLs to improve perceived performance
 * 
 * @param {Array} requests - Array of {sourceUrl, ...options} objects
 * @returns {Promise<void>}
 * 
 * @example
 * // Preload images that will be needed soon
 * preloadImgproxyUrls([
 *   { sourceUrl: image1.imgproxy_base_url, width: 800 },
 *   { sourceUrl: image2.imgproxy_base_url, width: 800 }
 * ]);
 */
export async function preloadImgproxyUrls(requests) {
    try {
        await getBatchImgproxyUrls(requests);
    } catch (error) {
        console.error('Error preloading imgproxy URLs:', error);
    }
}

/**
 * Clear the URL cache (useful for testing or memory management)
 */
export function clearImgproxyCache() {
    urlCache.clear();
}

// Default export
export default {
    getImgproxyUrl,
    getBatchImgproxyUrls,
    getResponsiveImgproxyUrls,
    getImgproxyUrlFromImage,
    useImgproxyUrl,
    preloadImgproxyUrls,
    clearImgproxyCache,
};

