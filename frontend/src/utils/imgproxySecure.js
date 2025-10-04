/**
 * Secure imgproxy utilities for frontend
 * 
 * Uses server-side URL signing to keep imgproxy keys secure.
 * Never exposes signing keys to the client.
 */

import React from 'react';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';
const IMGPROXY_SIGN_URL = `${API_BASE_URL}/api/v1/media/imgproxy/sign/`;
const IMGPROXY_BATCH_SIGN_URL = `${API_BASE_URL}/api/v1/media/imgproxy/sign-batch/`;

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

    // Extract source URL from image object (camelCase for JS)
    const sourceUrl = imageObj.imgproxyBaseUrl || imageObj.fileUrl;
    if (!sourceUrl) {
        console.warn('getImgproxyUrlFromImage: No valid URL in image object');
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

/**
 * Common preset configurations
 */
export const IMGPROXY_PRESETS = {
    thumbnail: { width: 150, height: 150, resizeType: 'fill', gravity: 'sm' },
    small: { width: 300, height: 300, resizeType: 'fit' },
    medium: { width: 600, height: 600, resizeType: 'fit' },
    large: { width: 1200, height: 1200, resizeType: 'fit' },
    hero: { width: 1920, height: 1080, resizeType: 'fill', gravity: 'sm' },
    avatar: { width: 128, height: 128, resizeType: 'fill', gravity: 'face', format: 'webp' },
    header: { width: 1280, height: 132, resizeType: 'fill', gravity: 'sm' },
};

/**
 * Get imgproxy URL using a preset configuration
 * 
 * @param {string} sourceUrl - Source image URL
 * @param {string} presetName - Preset name from IMGPROXY_PRESETS
 * @param {Object} overrides - Optional overrides for preset options
 * @returns {Promise<string>} Signed imgproxy URL
 * 
 * @example
 * const heroUrl = await getImgproxyUrlWithPreset(
 *   image.imgproxy_base_url,
 *   'hero'
 * );
 */
export async function getImgproxyUrlWithPreset(sourceUrl, presetName, overrides = {}) {
    const preset = IMGPROXY_PRESETS[presetName];
    if (!preset) {
        console.warn(`Unknown preset: ${presetName}`);
        return getImgproxyUrl(sourceUrl);
    }

    return getImgproxyUrl(sourceUrl, { ...preset, ...overrides });
}

// Default export
export default {
    getImgproxyUrl,
    getBatchImgproxyUrls,
    getImgproxyUrlFromImage,
    useImgproxyUrl,
    preloadImgproxyUrls,
    clearImgproxyCache,
    getImgproxyUrlWithPreset,
    IMGPROXY_PRESETS,
};

