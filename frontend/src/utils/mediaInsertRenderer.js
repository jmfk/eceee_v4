/**
 * mediaInsertRenderer.js
 * Utilities for rendering media inserts in WYSIWYG editor
 */

import { mediaApi } from '../api';

/**
 * Fetch media data by ID and type
 * @param {string|number} mediaId - Media or collection ID
 * @param {string} mediaType - 'image' or 'collection'
 * @returns {Promise<Object>} Media or collection data
 */
export async function fetchMediaData(mediaId, mediaType) {
    try {
        if (mediaType === 'collection') {
            const collection = await mediaApi.collections.get(mediaId)();
            return collection;
        } else {
            const media = await mediaApi.files.get(mediaId)();
            return media;
        }
    } catch (error) {
        console.error('Failed to fetch media data:', error);
        throw error;
    }
}

/**
 * Generate imgproxy URL for an image
 * @param {string} baseUrl - Base URL or imgproxy base URL
 * @param {number} width - Desired width
 * @param {number} height - Desired height
 * @returns {string} Optimized image URL
 */
export function generateImgproxyUrl(baseUrl, width, height) {
    if (!baseUrl) return '';

    // If it's already an imgproxy URL or full URL, use it directly
    if (baseUrl.includes('http://') || baseUrl.includes('https://')) {
        return baseUrl;
    }

    // Build imgproxy URL
    // Format: /insecure/resize:fit:WIDTH:HEIGHT:0/plain/BASE_URL
    const encodedUrl = btoa(baseUrl).replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
    return `/imgproxy/insecure/resize:fit:${width}:${height}:0/plain/${encodedUrl}`;
}

/**
 * Render a single image with imgproxy optimization
 * @param {Object} mediaData - Media file data
 * @param {Object} config - Configuration (width, align, caption)
 * @returns {string} HTML string for image element
 */
export function renderMediaImage(mediaData, config) {
    const { width = 'full', align = 'center' } = config;

    // Determine image dimensions based on width setting
    const widthMap = {
        'full': 1200,
        'half': 600,
        'third': 400
    };
    const imgWidth = widthMap[width] || 1200;
    const imgHeight = Math.round(imgWidth * 0.75); // 4:3 aspect ratio default

    // Generate optimized image URL
    const imageUrl = generateImgproxyUrl(
        mediaData.imgproxyBaseUrl || mediaData.fileUrl || mediaData.file_url,
        imgWidth,
        imgHeight
    );

    const alt = mediaData.alt || mediaData.title || mediaData.original_filename || 'Image';

    return `<img src="${imageUrl}" alt="${escapeHtml(alt)}" width="${imgWidth}" height="${imgHeight}" loading="lazy" />`;
}

/**
 * Render a collection as a gallery
 * @param {Object} collectionData - Collection data with files
 * @param {Object} config - Configuration (width, align, caption)
 * @returns {string} HTML string for gallery
 */
export function renderMediaCollection(collectionData, config) {
    const files = collectionData.files || [];

    if (files.length === 0) {
        return '<div class="media-gallery-empty">No images in this collection</div>';
    }

    // Render as a simple grid gallery
    const imageElements = files.map(file => {
        const imageUrl = generateImgproxyUrl(
            file.imgproxyBaseUrl || file.fileUrl || file.file_url,
            400,
            300
        );
        const alt = file.alt || file.title || file.original_filename || 'Image';

        return `<div class="media-gallery-item">
            <img src="${imageUrl}" alt="${escapeHtml(alt)}" width="400" height="300" loading="lazy" />
        </div>`;
    }).join('');

    return `<div class="media-gallery">${imageElements}</div>`;
}

/**
 * Create complete media insert HTML
 * @param {Object} mediaData - Media or collection data
 * @param {Object} config - Configuration
 * @returns {string} Complete HTML string for media insert
 */
export async function createMediaInsertHTML(mediaData, config) {
    const {
        mediaType = 'image',
        mediaId,
        width = 'full',
        align = 'center',
        caption = ''
    } = config;

    // Generate inner content based on media type
    let innerContent;
    if (mediaType === 'collection') {
        innerContent = renderMediaCollection(mediaData, config);
    } else {
        innerContent = renderMediaImage(mediaData, config);
    }

    // Build caption HTML if provided
    const captionHtml = caption
        ? `<div class="media-caption">${escapeHtml(caption)}</div>`
        : '';

    // Build width and alignment classes
    const widthClass = `media-width-${width}`;
    const alignClass = `media-align-${align}`;

    // Create the complete media insert div
    const html = `<div 
        class="media-insert ${widthClass} ${alignClass}" 
        data-media-insert="true"
        data-media-type="${mediaType}"
        data-media-id="${mediaId}"
        data-width="${width}"
        data-align="${align}"
        contenteditable="false"
        draggable="true"
    >${innerContent}${captionHtml}</div>`;

    return html;
}

/**
 * Update existing media insert HTML
 * @param {HTMLElement} element - The media insert element
 * @param {Object} mediaData - Media or collection data
 * @param {Object} config - Updated configuration
 * @returns {string} Updated HTML string
 */
export function updateMediaInsertHTML(element, mediaData, config) {
    const {
        mediaType,
        width = 'full',
        align = 'center',
        caption = ''
    } = config;

    // Generate updated inner content
    let innerContent;
    if (mediaType === 'collection') {
        innerContent = renderMediaCollection(mediaData, config);
    } else {
        innerContent = renderMediaImage(mediaData, config);
    }

    // Build caption HTML if provided
    const captionHtml = caption
        ? `<div class="media-caption">${escapeHtml(caption)}</div>`
        : '';

    // Update classes
    const widthClass = `media-width-${width}`;
    const alignClass = `media-align-${align}`;

    // Remove old width/align classes
    element.className = element.className
        .replace(/media-width-\w+/g, '')
        .replace(/media-align-\w+/g, '')
        .trim();

    // Add new classes
    element.classList.add(widthClass, alignClass);

    // Update data attributes
    element.setAttribute('data-width', width);
    element.setAttribute('data-align', align);

    // Update innerHTML
    element.innerHTML = innerContent + captionHtml;

    return element.outerHTML;
}

/**
 * Extract configuration from media insert element
 * @param {HTMLElement} element - The media insert element
 * @returns {Object} Configuration object
 */
export function extractMediaConfig(element) {
    const caption = element.querySelector('.media-caption')?.textContent || '';

    return {
        mediaType: element.getAttribute('data-media-type') || 'image',
        mediaId: element.getAttribute('data-media-id'),
        width: element.getAttribute('data-width') || 'full',
        align: element.getAttribute('data-align') || 'center',
        caption: caption
    };
}

/**
 * Escape HTML to prevent XSS
 * @param {string} text - Text to escape
 * @returns {string} Escaped text
 */
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

