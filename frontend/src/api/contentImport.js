/**
 * API client for Content Import functionality
 */

import apiClient from './client';

/**
 * Proxy an external webpage with URL rewriting (for iframe display)
 * @param {string} url - URL to proxy
 * @param {boolean} stripDesign - Whether to strip original design
 * @returns {Promise<Object>} Proxied page data
 */
export const proxyPage = async (url, stripDesign = true) => {
    const response = await apiClient.post('/api/v1/content-import/proxy-page/', {
        url,
        strip_design: stripDesign,
    });
    return response.data;
};

/**
 * Capture screenshot of external website
 * @param {string} url - URL to capture
 * @param {Object} options - Optional viewport settings
 * @returns {Promise<Object>} Screenshot data
 */
export const captureScreenshot = async (url, options = {}) => {
    const response = await apiClient.post('/content-import/capture/', {
        url,
        viewport_width: options.viewportWidth || 1920,
        viewport_height: options.viewportHeight || 1080,
        full_page: options.fullPage || false,
    });
    return response.data;
};

/**
 * Extract HTML content at specific coordinates
 * @param {string} url - URL to extract from
 * @param {number} x - X coordinate
 * @param {number} y - Y coordinate
 * @returns {Promise<Object>} Extracted element data
 */
export const extractContent = async (url, x, y) => {
    const response = await apiClient.post('/content-import/extract/', {
        url,
        x,
        y,
        timeout: 30000,
    });
    return response.data;
};

/**
 * Extract page metadata (title and tags) from HTML
 * @param {Object} data - Object with html, headHtml, and namespace
 * @returns {Promise<Object>} Extracted metadata
 */
export const extractMetadata = async (data) => {
    const response = await apiClient.post('/api/v1/content-import/extract-metadata/', {
        html: data.html,
        head_html: data.headHtml,
        namespace: data.namespace || 'default',
    });
    return response.data;
};

/**
 * Analyze HTML elements hierarchy and return content statistics
 * @param {Object} data - Object with elements array
 * @returns {Promise<Object>} Analysis results with statistics for each element
 */
export const analyzeHierarchy = async (data) => {
    const response = await apiClient.post('/api/v1/content-import/analyze-hierarchy/', {
        elements: data.elements,
    });
    return response.data;
};

/**
 * Process imported content and create widgets
 * @param {Object} importData - Import configuration
 * @returns {Promise<Object>} Import results
 */
export const processImport = async (importData) => {
    const response = await apiClient.post('/api/v1/content-import/process/', {
        html: importData.html,
        slot_name: importData.slotName,
        page_id: importData.pageId,
        mode: importData.mode || 'append',
        namespace: importData.namespace || 'default',
        source_url: importData.sourceUrl || '',
        uploaded_media_urls: importData.uploadedMediaUrls || {},  // Pre-uploaded media
        page_metadata: importData.pageMetadata || {},  // Page title and tags
    });
    return response.data;
};

/**
 * Generate AI metadata for a media file
 * @param {Object} mediaData - Media file information
 * @returns {Promise<Object>} Generated metadata
 */
export const generateMediaMetadata = async (mediaData) => {
    const response = await apiClient.post('/api/v1/content-import/generate-metadata/', mediaData);
    return response.data;
};

/**
 * Upload a single media file to media manager
 * @param {Object} uploadData - Upload configuration
 * @returns {Promise<Object>} Upload result
 */
export const uploadMediaFile = async (uploadData) => {
    const response = await apiClient.post('/api/v1/content-import/upload-media/', uploadData);
    return response.data;
};

export default {
    proxyPage,
    captureScreenshot,
    extractContent,
    extractMetadata,
    analyzeHierarchy,
    processImport,
    generateMediaMetadata,
    uploadMediaFile,
};

