/**
 * mediaInsertRenderer.js
 * Utilities for rendering media inserts in WYSIWYG editor
 */

import { mediaApi } from '../api';
import { getImageAspectRatio, getGridSpan } from './imageGridLayout';
import { getImgproxyUrl } from './imgproxySecure';

export const DEFAULT_IMGPROXY_CONFIG = {
    resize_type: 'fit',
    quality: 85,
    format: 'webp',
};

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
 * Render a single image with imgproxy optimization
 * @param {Object} mediaData - Media file data
 * @param {Object} config - Configuration (width, align, caption, imgproxyConfig)
 * @param {Object} slotDimensions - Slot dimensions object with mobile/tablet/desktop sizes
 * @returns {Promise<string>} HTML string for image element
 */
export async function renderMediaImage(mediaData, config, slotDimensions = null) {
    const { width = 'full', align = 'center', altText = '' } = config;
    const imgproxyConfig = config.imgproxyConfig || DEFAULT_IMGPROXY_CONFIG;

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
        : null;

    // Generate optimized image URL with calculated dimensions and optional style config
    // Use the secure backend API for URL signing to ensure production compatibility
    const baseUrl = mediaData.imgproxyBaseUrl || mediaData.fileUrl || mediaData.file_url;
    
    let imageUrl = '';
    if (baseUrl) {
        imageUrl = await getImgproxyUrl(baseUrl, {
            width: imgWidth,
            height: imgHeight,
            ...imgproxyConfig
        });
    }

    // Use altText from config if provided, otherwise fallback to media data
    const alt = altText || mediaData.alt || mediaData.title || mediaData.original_filename || 'Image';

    const widthClass = `img-width-${width}`;

    const imgEl = `<img 
        src="${imageUrl}" 
        alt="${escapeHtml(alt)}" 
        class="${widthClass}"
        loading="lazy" 
    />`;

    // Wrap with lightbox anchor if enabled
    if (config.enableLightbox) {
        const lbStyle = config.lightboxStyle || 'default';
        const lbGroup = config.lightboxGroup || '';
        const lbImgproxyConfig = config.lightboxImgproxyConfig || DEFAULT_IMGPROXY_CONFIG;
        const lbWidth = lbImgproxyConfig.max_width || lbImgproxyConfig.maxWidth || lbImgproxyConfig.width || originalWidth || 1920;
        const lbHeight = lbImgproxyConfig.max_height || lbImgproxyConfig.maxHeight || lbImgproxyConfig.height || 0;
        
        const fullSrc = baseUrl
            ? await getImgproxyUrl(baseUrl, {
                width: lbWidth,
                height: lbHeight,
                ...lbImgproxyConfig
            })
            : imageUrl;

        const caption = config.caption || mediaData.title || '';
        return `<a data-lightbox data-lightbox-style="${escapeHtml(lbStyle)}"${lbGroup ? ` data-lightbox-group="${escapeHtml(lbGroup)}"` : ''} data-lightbox-src="${escapeHtml(fullSrc)}" data-lightbox-caption="${escapeHtml(caption)}">${imgEl}</a>`;
    }

    return imgEl;
}

/**
 * Render a collection as a gallery
 * @param {Object} collectionData - Collection data with files
 * @param {Object} config - Configuration (width, align, caption)
 * @param {Object} slotDimensions - Slot dimensions object with mobile/tablet/desktop sizes
 * @returns {Promise<string>} HTML string for gallery
 */
export async function renderMediaCollection(collectionData, config, slotDimensions = null) {
    const files = collectionData.files || [];

    if (files.length === 0) {
        return '<div class="media-gallery-empty">No images in this collection</div>';
    }

    // Get desktop slot width for thumbnail calculation
    const slotWidth = slotDimensions?.desktop?.width || 896;
    // Use 1/3 of slot width for gallery thumbnails
    const thumbnailWidth = Math.round(slotWidth * 0.33);

    // Render as a simple grid gallery with aspect ratio-based spanning
    const imageElements = await Promise.all(files.map(async (file) => {
        // Calculate height based on original aspect ratio if available
        const originalWidth = file.width || file.originalWidth;
        const originalHeight = file.height || file.originalHeight;
        const thumbnailHeight = (originalWidth && originalHeight)
            ? Math.round((originalHeight / originalWidth) * thumbnailWidth)
            : null;

        const baseUrl = file.imgproxyBaseUrl || file.fileUrl || file.file_url;
        let imageUrl = '';
        if (baseUrl) {
            imageUrl = await getImgproxyUrl(baseUrl, {
                width: thumbnailWidth,
                height: thumbnailHeight,
                ...(config.imgproxyConfig || DEFAULT_IMGPROXY_CONFIG)
            });
        }

        const alt = file.alt || file.title || file.original_filename || 'Image';
        
        // Calculate grid span based on aspect ratio
        const aspectRatio = getImageAspectRatio(file);
        const { colSpan, rowSpan, objectFit } = getGridSpan(aspectRatio);
        
        // Build inline styles for grid spanning
        const gridStyles = [];
        if (colSpan > 1) {
            gridStyles.push(`grid-column: span ${colSpan}`);
        }
        if (rowSpan > 1) {
            gridStyles.push(`grid-row: span ${rowSpan}`);
        }
        const styleAttr = gridStyles.length > 0 ? ` style="${gridStyles.join('; ')}"` : '';

        return `<div class="media-gallery-item"${styleAttr}>
            <img src="${imageUrl}" alt="${escapeHtml(alt)}" loading="lazy" style="object-fit: ${objectFit}" />
        </div>`;
    }));

    return `<div class="media-gallery" style="grid-auto-flow: dense">${imageElements.join('')}</div>`;
}

/**
 * Create complete media insert HTML
 * @param {Object} mediaData - Media or collection data
 * @param {Object} config - Configuration
 * @param {Object} slotDimensions - Slot dimensions object with mobile/tablet/desktop sizes
 * @returns {Promise<string>} Complete HTML string for media insert
 */
export async function createMediaInsertHTML(mediaData, config, slotDimensions = null) {
    const {
        mediaType = 'image',
        mediaId,
        width = 'full',
        align = 'center',
        caption = '',
        altText = '',
        galleryStyle = null,
        imageStyle = null,
        lightboxImageStyle = null,
        imgproxyConfig = null
    } = config;

    // Generate inner content based on media type
    let innerContent;
    if (mediaType === 'collection') {
        innerContent = await renderMediaCollection(mediaData, config, slotDimensions);
    } else {
        innerContent = await renderMediaImage(mediaData, config, slotDimensions);
    }

    // Build caption HTML if provided
    const captionHtml = caption
        ? `<div class="media-caption">${escapeHtml(caption)}</div>`
        : '';

    // Build width and alignment classes
    const widthClass = `media-width-${width}`;
    const alignClass = `media-align-${align}`;

    // Get media title for data attribute
    const mediaTitle = mediaData?.title || mediaData?.original_filename || '';

    // Create the complete media insert div
    const resolvedStyle = imageStyle || galleryStyle;
    const galleryStyleAttr = resolvedStyle ? `data-gallery-style="${resolvedStyle}"` : '';
    const imageStyleAttr = resolvedStyle ? `data-image-style="${resolvedStyle}"` : '';
    const imgproxyConfigAttr = imgproxyConfig ? `data-imgproxy-config='${JSON.stringify(imgproxyConfig)}'` : '';
    const lbImageStyleAttr = lightboxImageStyle ? `data-lightbox-image-style="${lightboxImageStyle}"` : '';
    const captionAttr = caption ? `data-caption="${escapeHtml(caption)}"` : '';
    const altTextAttr = altText ? `data-alt-text="${escapeHtml(altText)}"` : '';
    const titleAttr = mediaTitle ? `data-title="${escapeHtml(mediaTitle)}"` : '';
    const html = `<div 
        class="media-insert ${widthClass} ${alignClass}" 
        data-media-insert="true"
        data-media-type="${mediaType}"
        data-media-id="${mediaId}"
        data-width="${width}"
        data-align="${align}"
        ${galleryStyleAttr}
        ${imageStyleAttr}
        ${imgproxyConfigAttr}
        ${lbImageStyleAttr}
        ${captionAttr}
        ${altTextAttr}
        ${titleAttr}
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
 * @returns {Promise<string>} Updated HTML string
 */
export async function updateMediaInsertHTML(element, mediaData, config, slotDimensions = null) {
    const {
        mediaType,
        width = 'full',
        align = 'center',
        caption = '',
        altText = '',
        galleryStyle = null,
        imageStyle = null,
        lightboxImageStyle = null
    } = config;

    // Generate updated inner content
    let innerContent;
    if (mediaType === 'collection') {
        innerContent = await renderMediaCollection(mediaData, config, slotDimensions);
    } else {
        innerContent = await renderMediaImage(mediaData, config, slotDimensions);
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
    
    // Update gallery/image style attributes
    const resolvedStyle = imageStyle || galleryStyle;
    if (resolvedStyle) {
        element.setAttribute('data-gallery-style', resolvedStyle);
        element.setAttribute('data-image-style', resolvedStyle);
        
        // Ensure imgproxyConfig is updated if it was provided in config
        if (config.imgproxyConfig) {
            element.setAttribute('data-imgproxy-config', JSON.stringify(config.imgproxyConfig));
        }
    } else {
        element.removeAttribute('data-gallery-style');
        element.removeAttribute('data-image-style');
        element.removeAttribute('data-imgproxy-config');
    }

    if (lightboxImageStyle) {
        element.setAttribute('data-lightbox-image-style', lightboxImageStyle);
    } else {
        element.removeAttribute('data-lightbox-image-style');
    }
    
    // Update caption, altText and title attributes
    if (caption) {
        element.setAttribute('data-caption', caption);
    } else {
        element.removeAttribute('data-caption');
    }
    
    if (altText) {
        element.setAttribute('data-alt-text', altText);
    } else {
        element.removeAttribute('data-alt-text');
    }
    
    const mediaTitle = mediaData?.title || mediaData?.original_filename || '';
    if (mediaTitle) {
        element.setAttribute('data-title', mediaTitle);
    } else {
        element.removeAttribute('data-title');
    }

    // Update innerHTML
    element.innerHTML = innerContent + captionHtml;
    
    // renderMediaImage already handles lightbox anchor generation,
    // so no additional annotation is needed here.

    return element.outerHTML;
}

/**
 * Extract configuration from media insert element
 * @param {HTMLElement} element - The media insert element
 * @returns {Object} Configuration object
 */
export function extractMediaConfig(element) {
    const caption = element.querySelector('.media-caption')?.textContent || '';
    const styleKey = element.getAttribute('data-image-style') || element.getAttribute('data-gallery-style') || null;
    
    // Extract imgproxyConfig if present
    let imgproxyConfig = null;
    const imgproxyConfigStr = element.getAttribute('data-imgproxy-config');
    if (imgproxyConfigStr) {
        try {
            imgproxyConfig = JSON.parse(imgproxyConfigStr);
        } catch (e) {
            console.warn('Failed to parse imgproxyConfig from data-imgproxy-config', e);
        }
    }

    // Extract lightbox state from inner anchor element
    const lbAnchor = element.querySelector('[data-lightbox]');
    const enableLightbox = !!lbAnchor;
    const lightboxStyle = lbAnchor?.getAttribute('data-lightbox-style') || 'default';
    const lightboxGroup = lbAnchor?.getAttribute('data-lightbox-group') || '';

    return {
        mediaType: element.getAttribute('data-media-type') || 'image',
        mediaId: element.getAttribute('data-media-id'),
        width: element.getAttribute('data-width') || 'full',
        align: element.getAttribute('data-align') || 'center',
        caption: caption,
        altText: element.getAttribute('data-alt-text') || '',
        galleryStyle: styleKey,
        imageStyle: styleKey,
        imgproxyConfig,
        lightboxImageStyle: element.getAttribute('data-lightbox-image-style') || null,
        enableLightbox,
        lightboxStyle,
        lightboxGroup
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
