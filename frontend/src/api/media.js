/**
 * Media API client for file management operations.
 * 
 * Provides comprehensive API integration for:
 * - File uploads with progress tracking
 * - Media file CRUD operations
 * - Advanced search and filtering
 * - Tag and collection management
 * - AI-powered suggestions
 * 
 * IMPORTANT: Django Parameter Handling
 * When sending multiple values for the same parameter (like multiple tags),
 * Django expects repeated parameter names, NOT array notation:
 * ✅ CORRECT: ?tag_names=tag1&tag_names=tag2&tag_names=tag3
 * ❌ WRONG:   ?tag_names[]=tag1&tag_names[]=tag2&tag_names[]=tag3 (PHP style)
 * 
 * Use arrays in params object: { tag_names: ['tag1', 'tag2', 'tag3'] }
 * 
 * NOTE: We use buildQueryParams() instead of axios params to avoid axios
 * converting arrays to PHP-style notation. All list endpoints manually
 * build query strings to ensure Django-compatible parameter serialization.
 */

import { wrapApiCall, buildQueryParams } from './utils';
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
    list: (params = {}) => wrapApiCall(() => {
        // Convert showDeleted to show_deleted for Django
        if ('showDeleted' in params) {
            params.show_deleted = params.showDeleted;
            delete params.showDeleted;
        }
        // Use our custom buildQueryParams to handle Django-style array parameters
        const queryString = buildQueryParams(params);
        return apiClient.get(`${endpoints.media.files}${queryString}`);
    }),

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
     * Get references to a media file
     * @param {string} id - Media file ID
     * @returns {Promise} API response with reference information
     */
    references: (id) => wrapApiCall(() =>
        apiClient.get(`${endpoints.media.file(id)}references/`)
    ),

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
    upload: async (uploadData, onProgress) => {
        const formData = new FormData();

        // Add files to form data
        Array.from(uploadData.files).forEach((file) => {
            formData.append('files', file);
        });

        // Add metadata
        formData.append('namespace', uploadData.namespace);
        if (uploadData.folderPath) {
            formData.append('folder_path', uploadData.folderPath);
        }
        if (uploadData.forceUpload) {
            formData.append('force_upload', 'true');
        }

        try {
            const wrappedCall = wrapApiCall(() =>
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
                }),
                'media-upload'
            );

            return await wrappedCall();
        } catch (error) {
            // Access the original axios error to get the response data
            const responseData = error.context.data
            if (responseData && responseData?.errorCount && responseData?.errorCount > 0) {
                return {
                    uploadedFiles: responseData.uploadedFiles || [],
                    rejectedFiles: responseData.rejectedFiles || [],
                    successCount: responseData.successCount || 0,
                    rejectedCount: responseData.rejectedCount || 0,
                    errorCount: responseData.errorCount || 0,
                    errors: responseData.errors || [],
                    hasErrors: true // Flag to indicate this is an error response
                };
            }

            // Re-throw other errors (500, network issues, etc.)
            throw error;
        }
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
    search: (searchParams = {}) => {
        return wrapApiCall(() => {
            const queryString = buildQueryParams(searchParams);
            return apiClient.get(`${endpoints.media.search}${queryString}`);
        })();
    },

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
    list: (params = {}) => wrapApiCall(() => {
        // Use our custom buildQueryParams to handle Django-style array parameters
        const queryString = buildQueryParams(params);
        return apiClient.get(`${endpoints.media.tags}${queryString}`);
    }),

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
    list: (params = {}) => wrapApiCall(() => {
        // Use our custom buildQueryParams to handle Django-style array parameters
        const queryString = buildQueryParams(params);
        return apiClient.get(`${endpoints.media.collections}${queryString}`);
    }),

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
        apiClient.post(`${endpoints.media.collection(id)}/add_files/`, {
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

    /**
     * Get files in a collection
     * @param {string} id - Collection ID
     * @param {Object} params - Query parameters (page, page_size, etc.)
     * @returns {Promise} API response with files in collection
     */
    getFiles: (id, params = {}) => wrapApiCall(() => {
        // Use our custom buildQueryParams to handle Django-style array parameters
        const queryString = buildQueryParams(params);
        return apiClient.get(`${endpoints.media.collection(id)}/files/${queryString}`);
    }),
};

/**
 * Media AI Suggestions API
 */
export const mediaAIApi = {
    /**
     * Generate AI suggestions for a media file
     * @param {string} fileId - Media file ID
     * @returns {Promise} API response with AI suggestions
     */
    getSuggestions: (fileId) => wrapApiCall(() =>
        apiClient.post(endpoints.media.aiSuggestions, { file_id: fileId })
    ),

    /**
     * Generate slug suggestions from title
     * @param {string} title - Title to generate slugs from
     * @param {string[]} existingSlugs - Existing slugs to avoid conflicts
     * @returns {Promise} API response with slug suggestions
     */
    generateSlugs: (title, existingSlugs = []) => wrapApiCall(() =>
        apiClient.post(`${endpoints.media.aiSuggestions}slugs/`, {
            title,
            existing_slugs: existingSlugs
        })
    ),

    /**
     * Extract text from uploaded file using OCR
     * @param {File} file - File to extract text from
     * @returns {Promise} API response with extracted text
     */
    extractText: (file) => {
        const formData = new FormData();
        formData.append('file', file);

        return wrapApiCall(() =>
            apiClient.post(`${endpoints.media.aiSuggestions}extract-text/`, formData, {
                headers: {
                    'Content-Type': 'multipart/form-data',
                }
            })
        );
    },
};

/**
 * Media Bulk Operations API
 */
export const mediaBulkOperationsApi = {
    /**
     * Execute bulk operation on multiple files
     * @param {Object} operationData - Bulk operation data
     * @param {string[]} operationData.file_ids - Array of file IDs
     * @param {string} operationData.operation - Operation type
     * @param {string[]} operationData.tag_ids - Tag IDs (for tag operations)
     * @param {string} operationData.collection_id - Collection ID (for collection operations)
     * @param {string} operationData.access_level - Access level (for access level operations)
     * @returns {Promise} API response with operation results
     */
    execute: (operationData) => wrapApiCall(() =>
        apiClient.post(endpoints.media.bulkOperations, operationData)
    ),

    /**
     * Get bulk operation status
     * @param {string} operationId - Operation ID
     * @returns {Promise} API response with operation status
     */
    getStatus: (operationId) => wrapApiCall(() =>
        apiClient.get(`${endpoints.media.bulkOperations}${operationId}/status/`)
    ),

    /**
     * Cancel bulk operation
     * @param {string} operationId - Operation ID
     * @returns {Promise} API response
     */
    cancel: (operationId) => wrapApiCall(() =>
        apiClient.post(`${endpoints.media.bulkOperations}${operationId}/cancel/`)
    ),
};

/**
 * Pending Media Files API
 */
export const pendingMediaFilesApi = {
    /**
     * List pending media files
     * @param {Object} params - Query parameters
     * @returns {Promise} API response with pending files list
     */
    list: (params = {}) => {
        return wrapApiCall(() => {
            // Use our custom buildQueryParams to handle Django-style array parameters
            const queryString = buildQueryParams(params);
            return apiClient.get(`${endpoints.media.pendingFiles}${queryString}`);
        })();
    },

    /**
     * Get detailed information about a specific pending media file
     * @param {string} id - Pending media file ID
     * @returns {Promise} API response with pending file details
     */
    get: (id) => wrapApiCall(() =>
        apiClient.get(endpoints.media.pendingFile(id))
    ),

    /**
     * Approve a pending media file
     * @param {string} id - Pending media file ID
     * @param {Object} approvalData - Approval data (title, slug, description, etc.)
     * @returns {Promise} API response with created media file
     */
    approve: (id, approvalData) => wrapApiCall(() =>
        apiClient.post(endpoints.media.approvePendingFile(id), approvalData)
    ),

    /**
     * Reject a pending media file
     * @param {string} id - Pending media file ID
     * @returns {Promise} API response
     */
    reject: (id) => wrapApiCall(() =>
        apiClient.post(endpoints.media.rejectPendingFile(id))
    ),

    /**
     * Bulk approve multiple pending files
     * @param {Array} approvals - Array of approval objects
     * @returns {Promise} API response with bulk operation results
     */
    bulkApprove: (approvals) => wrapApiCall(() =>
        apiClient.post(endpoints.media.bulkApprovePendingFiles, { approvals })
    ),

    /**
     * Bulk reject multiple pending files
     * @param {Array} fileIds - Array of pending file IDs
     * @returns {Promise} API response with bulk operation results
     */
    bulkReject: (fileIds) => wrapApiCall(() =>
        apiClient.post(endpoints.media.bulkRejectPendingFiles, { file_ids: fileIds })
    ),
};

/**
 * Slug Validation API
 */
export const slugValidationApi = {
    /**
     * Validate slug uniqueness and get alternative if needed
     * @param {Object} data - Validation data
     * @param {string} data.title - Original title
     * @param {string} data.namespace - Namespace to check within
     * @returns {Promise} API response with validated slug
     */
    validate: (data) => {
        return wrapApiCall(() => {
            return apiClient.post(endpoints.media.validateSlug, data);
        })();
    },
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
    ai: mediaAIApi,
    bulkOperations: mediaBulkOperationsApi,
    pendingFiles: pendingMediaFilesApi,
    validateSlug: slugValidationApi.validate,
};

export default mediaApi;
