/**
 * Media API client for file management operations.
 * 
 * Provides comprehensive API integration for:
 * - File uploads with progress tracking
 * - Media file CRUD operations
 * - Advanced search and filtering
 * - Tag and collection management
 * - AI-powered suggestions
 */

import { wrapApiCall } from './utils';
import apiClient from './client';
import { endpoints } from './endpoints';

/**
 * Media Files API
 */
export const mediaFilesApi = {
    /**
     * List media files with pagination and filtering
     * @param {Object} params - Query parameters
     * @param {string} params.page - Page number
     * @param {string} params.pageSize - Items per page
     * @param {string} params.search - Search query
     * @param {string} params.fileType - Filter by file type
     * @param {string} params.accessLevel - Filter by access level
     * @param {string} params.namespace - Filter by namespace
     * @param {string} params.ordering - Sort order
     * @returns {Promise} API response with file list
     */
    list: (params = {}) => wrapApiCall(() =>
        apiClient.get(endpoints.media.files, { params })
    ),

    /**
     * Get detailed information about a specific media file
     * @param {string} id - Media file ID
     * @returns {Promise} API response with file details
     */
    get: (id) => wrapApiCall(() =>
        apiClient.get(endpoints.media.file(id))
    ),

    /**
     * Update media file metadata
     * @param {string} id - Media file ID
     * @param {Object} data - Updated file data
     * @returns {Promise} API response with updated file
     */
    update: (id, data) => wrapApiCall(() =>
        apiClient.patch(endpoints.media.file(id), data)
    ),

    /**
     * Delete a media file
     * @param {string} id - Media file ID
     * @returns {Promise} API response
     */
    delete: (id) => wrapApiCall(() =>
        apiClient.delete(endpoints.media.file(id))
    ),

    /**
     * Get download URL for a media file
     * @param {string} id - Media file ID
     * @returns {string} Download URL
     */
    getDownloadUrl: (id) => `${endpoints.media.file(id)}download/`,

    /**
     * Get thumbnail URL for an image file
     * @param {string} id - Media file ID
     * @param {string} size - Thumbnail size (small, medium, large, xlarge)
     * @returns {string} Thumbnail URL
     */
    getThumbnailUrl: (id, size = 'medium') =>
        `${endpoints.media.file(id)}thumbnail/?size=${size}`,
};

/**
 * Media Upload API
 */
export const mediaUploadApi = {
    /**
     * Upload multiple files with progress tracking
     * @param {Object} uploadData - Upload configuration
     * @param {FileList|File[]} uploadData.files - Files to upload
     * @param {string} uploadData.namespace - Target namespace ID
     * @param {string} uploadData.folderPath - Optional folder path
     * @param {Function} onProgress - Progress callback function
     * @returns {Promise} API response with upload results
     */
    upload: (uploadData, onProgress) => {
        const formData = new FormData();

        // Add files to form data
        Array.from(uploadData.files).forEach((file, index) => {
            formData.append('files', file);
        });

        // Add metadata
        formData.append('namespace', uploadData.namespace);
        if (uploadData.folderPath) {
            formData.append('folder_path', uploadData.folderPath);
        }

        return wrapApiCall(() =>
            apiClient.post(endpoints.media.upload, formData, {
                headers: {
                    'Content-Type': 'multipart/form-data',
                },
                onUploadProgress: (progressEvent) => {
                    if (onProgress && progressEvent.total) {
                        const percentCompleted = Math.round(
                            (progressEvent.loaded * 100) / progressEvent.total
                        );
                        onProgress(percentCompleted, progressEvent);
                    }
                },
            })
        );
    },

    /**
     * Validate files before upload
     * @param {FileList|File[]} files - Files to validate
     * @returns {Object} Validation result
     */
    validateFiles: (files) => {
        const maxFileSize = 100 * 1024 * 1024; // 100MB
        const allowedTypes = [
            'image/jpeg', 'image/png', 'image/gif', 'image/webp',
            'application/pdf', 'application/msword',
            'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
            'video/mp4', 'video/webm', 'audio/mpeg', 'audio/wav'
        ];

        const errors = [];
        const validFiles = [];

        Array.from(files).forEach((file) => {
            // Check file size
            if (file.size > maxFileSize) {
                errors.push({
                    file: file.name,
                    error: `File too large. Maximum size is ${maxFileSize / (1024 * 1024)}MB.`
                });
                return;
            }

            // Check file type
            if (!allowedTypes.includes(file.type)) {
                errors.push({
                    file: file.name,
                    error: `File type ${file.type} is not allowed.`
                });
                return;
            }

            validFiles.push(file);
        });

        return {
            valid: errors.length === 0,
            errors,
            validFiles,
            totalSize: validFiles.reduce((sum, file) => sum + file.size, 0)
        };
    },
};

/**
 * Media Search API
 */
export const mediaSearchApi = {
    /**
     * Advanced search for media files
     * @param {Object} searchParams - Search parameters
     * @param {string} searchParams.q - Search query
     * @param {string} searchParams.fileType - File type filter
     * @param {string[]} searchParams.tags - Tag IDs to filter by
     * @param {string[]} searchParams.collections - Collection IDs to filter by
     * @param {string} searchParams.accessLevel - Access level filter
     * @param {string} searchParams.namespace - Namespace filter
     * @param {string} searchParams.createdAfter - Created after date
     * @param {string} searchParams.createdBefore - Created before date
     * @param {number} searchParams.minSize - Minimum file size
     * @param {number} searchParams.maxSize - Maximum file size
     * @param {number} searchParams.page - Page number
     * @param {number} searchParams.pageSize - Items per page
     * @returns {Promise} API response with search results
     */
    search: (searchParams = {}) => wrapApiCall(() =>
        apiClient.get(endpoints.media.search, { params: searchParams })
    ),

    /**
     * Get search suggestions based on query
     * @param {string} query - Search query
     * @returns {Promise} API response with suggestions
     */
    getSuggestions: (query) => {
        // This could be enhanced with a dedicated suggestions endpoint
        return mediaSearchApi.search({ q: query, pageSize: 5 });
    },
};

/**
 * Media Tags API
 */
export const mediaTagsApi = {
    /**
     * List all media tags
     * @param {Object} params - Query parameters
     * @returns {Promise} API response with tags
     */
    list: (params = {}) => wrapApiCall(() =>
        apiClient.get(endpoints.media.tags, { params })
    ),

    /**
     * Create a new media tag
     * @param {Object} tagData - Tag data
     * @param {string} tagData.name - Tag name
     * @param {string} tagData.color - Tag color (hex)
     * @param {string} tagData.description - Tag description
     * @param {string} tagData.namespace - Namespace ID
     * @returns {Promise} API response with created tag
     */
    create: (tagData) => wrapApiCall(() =>
        apiClient.post(endpoints.media.tags, tagData)
    ),

    /**
     * Update a media tag
     * @param {string} id - Tag ID
     * @param {Object} tagData - Updated tag data
     * @returns {Promise} API response with updated tag
     */
    update: (id, tagData) => wrapApiCall(() =>
        apiClient.patch(endpoints.media.tag(id), tagData)
    ),

    /**
     * Delete a media tag
     * @param {string} id - Tag ID
     * @returns {Promise} API response
     */
    delete: (id) => wrapApiCall(() =>
        apiClient.delete(endpoints.media.tag(id))
    ),
};

/**
 * Media Collections API
 */
export const mediaCollectionsApi = {
    /**
     * List all media collections
     * @param {Object} params - Query parameters
     * @returns {Promise} API response with collections
     */
    list: (params = {}) => wrapApiCall(() =>
        apiClient.get(endpoints.media.collections, { params })
    ),

    /**
     * Get detailed information about a collection
     * @param {string} id - Collection ID
     * @returns {Promise} API response with collection details
     */
    get: (id) => wrapApiCall(() =>
        apiClient.get(endpoints.media.collection(id))
    ),

    /**
     * Create a new media collection
     * @param {Object} collectionData - Collection data
     * @param {string} collectionData.title - Collection title
     * @param {string} collectionData.description - Collection description
     * @param {string} collectionData.namespace - Namespace ID
     * @param {string} collectionData.accessLevel - Access level
     * @param {string[]} collectionData.tagIds - Tag IDs
     * @returns {Promise} API response with created collection
     */
    create: (collectionData) => wrapApiCall(() =>
        apiClient.post(endpoints.media.collections, collectionData)
    ),

    /**
     * Update a media collection
     * @param {string} id - Collection ID
     * @param {Object} collectionData - Updated collection data
     * @returns {Promise} API response with updated collection
     */
    update: (id, collectionData) => wrapApiCall(() =>
        apiClient.patch(endpoints.media.collection(id), collectionData)
    ),

    /**
     * Delete a media collection
     * @param {string} id - Collection ID
     * @returns {Promise} API response
     */
    delete: (id) => wrapApiCall(() =>
        apiClient.delete(endpoints.media.collection(id))
    ),

    /**
     * Add files to a collection
     * @param {string} id - Collection ID
     * @param {string[]} fileIds - File IDs to add
     * @returns {Promise} API response
     */
    addFiles: (id, fileIds) => wrapApiCall(() =>
        apiClient.post(`${endpoints.media.collection(id)}add_files/`, {
            file_ids: fileIds
        })
    ),

    /**
     * Remove files from a collection
     * @param {string} id - Collection ID
     * @param {string[]} fileIds - File IDs to remove
     * @returns {Promise} API response
     */
    removeFiles: (id, fileIds) => wrapApiCall(() =>
        apiClient.post(`${endpoints.media.collection(id)}remove_files/`, {
            file_ids: fileIds
        })
    ),
};

/**
 * Unified Media API
 * Combines all media-related API functions
 */
export const mediaApi = {
    files: mediaFilesApi,
    upload: mediaUploadApi,
    search: mediaSearchApi,
    tags: mediaTagsApi,
    collections: mediaCollectionsApi,
};

export default mediaApi;
