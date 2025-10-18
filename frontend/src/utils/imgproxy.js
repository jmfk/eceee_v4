/**
 * imgproxy utilities for frontend image optimization
 */
import CryptoJS from 'crypto-js';

// Default imgproxy configuration
const IMGPROXY_CONFIG = {
    baseUrl: import.meta.env.VITE_IMGPROXY_URL || 'http://localhost:8080',
    key: import.meta.env.VITE_IMGPROXY_KEY || '',
    salt: import.meta.env.VITE_IMGPROXY_SALT || '',
    signatureSize: parseInt(import.meta.env.VITE_IMGPROXY_SIGNATURE_SIZE || '32'),
};

/**
 * Generate HMAC signature for imgproxy URL
 * @param {string} path - The path to sign (without leading slash)
 * @returns {string} Base64 URL-safe signature
 */
function generateSignature(path) {
    if (!IMGPROXY_CONFIG.key || !IMGPROXY_CONFIG.salt) {
        console.warn('imgproxy key or salt not configured, falling back to unsafe mode');
        return null;
    }

    try {
        // Convert hex key and salt to word arrays
        const keyBinary = CryptoJS.enc.Hex.parse(IMGPROXY_CONFIG.key);
        const saltBinary = CryptoJS.enc.Hex.parse(IMGPROXY_CONFIG.salt);

        // Create message: salt + path
        const message = saltBinary.concat(CryptoJS.enc.Utf8.parse(path));

        // Generate HMAC-SHA256
        const hmac = CryptoJS.HmacSHA256(message, keyBinary);

        // Convert to base64 and make URL-safe
        let signature = CryptoJS.enc.Base64.stringify(hmac);
        signature = signature.replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');

        // Return full signature (don't truncate for imgproxy)
        return signature;
    } catch (error) {
        console.error('Failed to generate imgproxy signature:', error);
        return null;
    }
}


/**
 * Generate imgproxy URL for image processing
 * @param {string} sourceUrl - Source image URL
 * @param {Object} options - Processing options
 * @returns {string} imgproxy URL
 */
export function generateImgproxyUrl(sourceUrl, options = {}) {
    const {
        width,
        height,
        resizeType = 'fit',
        gravity = 'sm',
        quality,
        format,
        ...additionalOptions
    } = options;
    try {
        // Build processing options with actual dimensions
        const processingOptions = [];

        // Always use actual dimensions instead of presets
        if (resizeType && (width || height)) {
            const w = width || 0;
            const h = height || 0;
            processingOptions.push(`resize:${resizeType}:${w}:${h}`);
        }

        if (gravity && gravity !== 'sm') {
            processingOptions.push(`gravity:${gravity}`);
        }

        if (quality) {
            processingOptions.push(`quality:${quality}`);
        }

        if (format) {
            processingOptions.push(`format:${format}`);
        }

        // Add additional options
        Object.entries(additionalOptions).forEach(([key, value]) => {
            if (value !== null && value !== undefined) {
                processingOptions.push(`${key}:${value}`);
            }
        });

        // Encode source URL
        const encodedSourceUrl = btoa(sourceUrl).replace(/=/g, '');

        // Build path
        const processingPath = processingOptions.length > 0 ? processingOptions.join('/') : '';
        const path = `/${processingPath}/${encodedSourceUrl}`;

        // Generate signature for secure URLs
        const signature = generateSignature(path);

        if (signature) {
            // Use signed URL for production security
            return `${IMGPROXY_CONFIG.baseUrl}/${signature}${path}`;
        } else {
            // Fallback to unsafe mode if signature generation fails
            console.warn('Using unsafe imgproxy URL - configure VITE_IMGPROXY_KEY and VITE_IMGPROXY_SALT for production');
            return `${IMGPROXY_CONFIG.baseUrl}/unsafe${path}`;
        }
    } catch (error) {
        console.error('Failed to generate imgproxy URL:', error);
        return sourceUrl; // Fallback to original URL
    }
}

/**
 * Generate responsive image URLs for different screen sizes
 * @param {string} sourceUrl - Source image URL
 * @param {Object} sizes - Size configurations
 * @param {Object} options - Additional options
 * @returns {Object} Responsive image URLs
 */
export function generateResponsiveUrls(sourceUrl, sizes = null, options = {}) {
    const defaultSizes = {
        thumbnail: { width: 150, height: 150 },
        small: { width: 300, height: 300 },
        medium: { width: 600, height: 600 },
        large: { width: 1200, height: 1200 },
        xlarge: { width: 1920, height: 1920 },
    };

    const sizesToUse = sizes || defaultSizes;
    const urls = {};

    Object.entries(sizesToUse).forEach(([sizeName, dimensions]) => {
        urls[sizeName] = generateImgproxyUrl(sourceUrl, {
            ...options,
            ...dimensions,
            resizeType: 'fit',
        });
    });

    return urls;
}

/**
 * Generate thumbnail URL
 * @param {string} sourceUrl - Source image URL
 * @param {number} size - Thumbnail size (square)
 * @returns {string} Thumbnail URL
 */
export function generateThumbnailUrl(sourceUrl, size = 150) {
    return generateImgproxyUrl(sourceUrl, {
        width: size,
        height: size,
        resizeType: 'fill',
        gravity: 'sm',
    });
}

/**
 * Generate avatar URL with WebP format
 * @param {string} sourceUrl - Source image URL
 * @param {number} size - Avatar size (square)
 * @returns {string} Avatar URL
 */
export function generateAvatarUrl(sourceUrl, size = 128) {
    return generateImgproxyUrl(sourceUrl, {
        width: size,
        height: size,
        resizeType: 'fill',
        gravity: 'sm',
        format: 'webp',
        quality: 90,
    });
}

/**
 * Generate hero image URL
 * @param {string} sourceUrl - Source image URL
 * @param {number} width - Hero width
 * @param {number} height - Hero height
 * @returns {string} Hero image URL
 */
export function generateHeroUrl(sourceUrl, width = 1920, height = 1080) {
    return generateImgproxyUrl(sourceUrl, {
        width,
        height,
        resizeType: 'fill',
        gravity: 'sm',
        quality: 90,
    });
}

/**
 * Generate optimized image URL with modern format support
 * @param {string} sourceUrl - Source image URL
 * @param {Object} options - Optimization options
 * @returns {string} Optimized image URL
 */
export function generateOptimizedUrl(sourceUrl, options = {}) {
    const {
        width,
        height,
        webp = true,
        quality = 85,
        ...otherOptions
    } = options;

    return generateImgproxyUrl(sourceUrl, {
        width,
        height,
        resizeType: 'fit',
        format: webp ? 'webp' : undefined,
        quality,
        ...otherOptions,
    });
}

/**
 * Get srcSet string for responsive images
 * @param {string} sourceUrl - Source image URL
 * @param {Array} widths - Array of widths for srcSet
 * @param {Object} options - Additional options
 * @returns {string} srcSet string
 */
export function generateSrcSet(sourceUrl, widths = [300, 600, 900, 1200], options = {}) {
    return widths
        .map(width => {
            const url = generateImgproxyUrl(sourceUrl, {
                ...options,
                width,
                resizeType: 'fit',
            });
            return `${url} ${width}w`;
        })
        .join(', ');
}

/**
 * Check if imgproxy is available
 * @returns {Promise<boolean>} True if available
 */
export async function checkImgproxyHealth() {
    try {
        const response = await fetch(`${IMGPROXY_CONFIG.baseUrl}/health`);
        return response.ok;
    } catch (error) {
        console.error('imgproxy health check failed:', error);
        return false;
    }
}

/**
 * React hook for imgproxy URLs
 * @param {string} sourceUrl - Source image URL
 * @param {Object} options - Processing options
 * @returns {string} imgproxy URL
 */
export function useImgproxyUrl(sourceUrl, options = {}) {
    if (!sourceUrl) return '';
    return generateImgproxyUrl(sourceUrl, options);
}

/**
 * React hook for responsive imgproxy URLs
 * @param {string} sourceUrl - Source image URL
 * @param {Object} sizes - Size configurations
 * @param {Object} options - Additional options
 * @returns {Object} Responsive image URLs
 */
export function useResponsiveUrls(sourceUrl, sizes = null, options = {}) {
    if (!sourceUrl) return {};
    return generateResponsiveUrls(sourceUrl, sizes, options);
}

// Default export
export default {
    generateImgproxyUrl,
    generateResponsiveUrls,
    generateThumbnailUrl,
    generateAvatarUrl,
    generateHeroUrl,
    generateOptimizedUrl,
    generateSrcSet,
    checkImgproxyHealth,
    useImgproxyUrl,
    useResponsiveUrls,
};
