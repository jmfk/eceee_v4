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
 * @param {number} height - Desired height (optional, will maintain aspect ratio if null/0)
 * @returns {string} Optimized image URL
 */
export function generateImgproxyUrl(baseUrl, width, height = null) {
    if (!baseUrl) return '';

    // If it's already an imgproxy URL or full URL, use it directly
    if (baseUrl.includes('http://') || baseUrl.includes('https://')) {
        return baseUrl;
    }

    // Build imgproxy URL with width and optional height
    // Format: /insecure/resize:fit:WIDTH:HEIGHT:0/plain/BASE_URL
    const h = height || 0; // 0 means maintain aspect ratio
    const encodedUrl = btoa(baseUrl).replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
    return `/imgproxy/insecure/resize:fit:${width}:${h}:0/plain/${encodedUrl}`;
}

/**
 * Render a single image with imgproxy optimization
 * @param {Object} mediaData - Media file data
 * @param {Object} config - Configuration (width, align, caption)
 * @param {Object} slotDimensions - Slot dimensions object with mobile/tablet/desktop sizes
 * @returns {string} HTML string for image element
 */
export function renderMediaImage(mediaData, config, slotDimensions = null) {
    const { width = 'full', align = 'center' } = config;

    // Get desktop slot width (default to 896px if not available)
    const slotWidth = slotDimensions?.desktop?.width || 896;

    // Calculate imgproxy width based on width setting
    const widthMultipliers = {
        'full': 1.0,
        'half': 0.5,
        'third': 0.33
    };
    const imgWidth = Math.round(slotWidth * widthMultipliers[width]);

    // Calculate height based on original image aspect ratio
    const originalWidth = mediaData.width || mediaData.originalWidth;
    const originalHeight = mediaData.height || mediaData.originalHeight;
    const imgHeight = (originalWidth && originalHeight)
        ? Math.round((originalHeight / originalWidth) * imgWidth)
        : null; // Let imgproxy maintain aspect ratio if we don't know it

    // Generate optimized image URL with calculated dimensions
    const imageUrl = generateImgproxyUrl(
        mediaData.imgproxyBaseUrl || mediaData.fileUrl || mediaData.file_url,
        imgWidth,
        imgHeight
    );

    const alt = mediaData.alt || mediaData.title || mediaData.original_filename || 'Image';

    // Add CSS class for responsive width (full/half/third)
    // These will be defined to use percentages: 100%, 50%, ~33%
    const widthClass = `img-width-${width}`;

    return `<img 
        src="${imageUrl}" 
        alt="${escapeHtml(alt)}" 
        class="${widthClass}"
        loading="lazy" 
    />`;
}

/**
 * Render a collection as a gallery
 * @param {Object} collectionData - Collection data with files
 * @param {Object} config - Configuration (width, align, caption)
 * @param {Object} slotDimensions - Slot dimensions object with mobile/tablet/desktop sizes
 * @returns {string} HTML string for gallery
 */
export function renderMediaCollection(collectionData, config, slotDimensions = null) {
    const files = collectionData.files || [];

    if (files.length === 0) {
        return '<div class="media-gallery-empty">No images in this collection</div>';
    }

    // Get desktop slot width for thumbnail calculation
    const slotWidth = slotDimensions?.desktop?.width || 896;
    // Use 1/3 of slot width for gallery thumbnails
    const thumbnailWidth = Math.round(slotWidth * 0.33);

    // Render as a simple grid gallery
    const imageElements = files.map(file => {
        // Calculate height based on original aspect ratio if available
        const originalWidth = file.width || file.originalWidth;
        const originalHeight = file.height || file.originalHeight;
        const thumbnailHeight = (originalWidth && originalHeight)
            ? Math.round((originalHeight / originalWidth) * thumbnailWidth)
            : null;

        const imageUrl = generateImgproxyUrl(
            file.imgproxyBaseUrl || file.fileUrl || file.file_url,
            thumbnailWidth,
            thumbnailHeight
        );
        const alt = file.alt || file.title || file.original_filename || 'Image';

        return `<div class="media-gallery-item">
            <img src="${imageUrl}" alt="${escapeHtml(alt)}" loading="lazy" />
        </div>`;
    }).join('');

    return `<div class="media-gallery">${imageElements}</div>`;
}

/**
 * Create complete media insert HTML
 * @param {Object} mediaData - Media or collection data
 * @param {Object} config - Configuration
 * @param {Object} slotDimensions - Slot dimensions object with mobile/tablet/desktop sizes
 * @returns {string} Complete HTML string for media insert
 */
export async function createMediaInsertHTML(mediaData, config, slotDimensions = null) {
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
        innerContent = renderMediaCollection(mediaData, config, slotDimensions);
    } else {
        innerContent = renderMediaImage(mediaData, config, slotDimensions);
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
 * @param {Object} slotDimensions - Slot dimensions object with mobile/tablet/desktop sizes
 * @returns {string} Updated HTML string
 */
export function updateMediaInsertHTML(element, mediaData, config, slotDimensions = null) {
    const {
        mediaType,
        width = 'full',
        align = 'center',
        caption = ''
    } = config;

    // Generate updated inner content
    let innerContent;
    if (mediaType === 'collection') {
        innerContent = renderMediaCollection(mediaData, config, slotDimensions);
    } else {
        innerContent = renderMediaImage(mediaData, config, slotDimensions);
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
    element.setAttribute('data-media-id', mediaData.id);
    element.setAttribute('data-media-type', mediaType);

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

