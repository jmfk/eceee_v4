/**
 * Centralized API Endpoints Configuration
 * 
 * Single source of truth for all backend API endpoints.
 * Prevents hardcoded URLs scattered throughout the codebase.
 */

const API_VERSION = 'v1'
const BASE_PATH = `/api/${API_VERSION}`

// Base endpoint builders
export const endpoints = {
    // Core paths
    base: BASE_PATH,
    webpages: `${BASE_PATH}/webpages`,
    content: `${BASE_PATH}/content`,
    namespaces: `${BASE_PATH}/namespaces`,

    // Authentication & System
    auth: {
        csrfToken: '/csrf-token/',
        login: '/admin/login/',
        logout: '/admin/logout/',
        health: '/health/'
    },

    // Pages endpoints
    pages: {
        base: `${BASE_PATH}/webpages/pages`,
        list: `${BASE_PATH}/webpages/pages/`,
        detail: (id) => `${BASE_PATH}/webpages/pages/${id}/`,
        publish: (id) => `${BASE_PATH}/webpages/pages/${id}/publish/`,
        unpublish: (id) => `${BASE_PATH}/webpages/pages/${id}/unpublish/`,
        linkObject: (id) => `${BASE_PATH}/webpages/pages/${id}/link-object/`,
        unlinkObject: (id) => `${BASE_PATH}/webpages/pages/${id}/unlink-object/`,
        syncObject: (id) => `${BASE_PATH}/webpages/pages/${id}/sync-object/`,
        widgetInheritance: (id) => `${BASE_PATH}/webpages/pages/${id}/widget-inheritance/`,
        publicationStatus: `${BASE_PATH}/webpages/pages/publicationStatus/`,
        // DEPRECATED: Version-related endpoints moved to versions API (but URLs remain consistent)
        versions: (id) => `${BASE_PATH}/webpages/pages/${id}/versions/`, // Still works, now consistent path-based
        versionCurrent: (pageId) => `${BASE_PATH}/webpages/pages/${pageId}/versions/current/`, // Still works, now consistent path-based
        versionDetail: (pageId, versionId) => `${BASE_PATH}/webpages/pages/${pageId}/versions/${versionId}/` // Still works, now consistent path-based
    },

    // Versions endpoints (CONSISTENT PATH-BASED API)
    versions: {
        base: `${BASE_PATH}/webpages/versions`,
        list: `${BASE_PATH}/webpages/versions/`,
        detail: (id) => `${BASE_PATH}/webpages/versions/${id}/`,
        publish: (id) => `${BASE_PATH}/webpages/versions/${id}/publish/`,
        createDraft: (id) => `${BASE_PATH}/webpages/versions/${id}/create_draft/`,
        restore: (id) => `${BASE_PATH}/webpages/versions/${id}/restore/`,
        updatePublishing: (id) => `${BASE_PATH}/webpages/versions/${id}/publishing/`,
        compare: `${BASE_PATH}/webpages/versions/compare/`,
        search: `${BASE_PATH}/webpages/versions/search/`,
        // NEW: Consistent path-based endpoints (no query strings)
        byPage: (pageId) => `${BASE_PATH}/webpages/pages/${pageId}/versions/`,
        currentForPage: (pageId) => `${BASE_PATH}/webpages/pages/${pageId}/versions/current/`,
        latestForPage: (pageId) => `${BASE_PATH}/webpages/pages/${pageId}/versions/latest/`,
        pageVersionDetail: (pageId, versionId) => `${BASE_PATH}/webpages/pages/${pageId}/versions/${versionId}/`,
        // DEPRECATED: Query string endpoints (will be removed)
        legacy: {
            forPage: (pageId) => `${BASE_PATH}/webpages/versions/?page=${pageId}`,
            currentQuery: (pageId) => `${BASE_PATH}/webpages/versions/?page=${pageId}&current=true`,
            latestQuery: (pageId) => `${BASE_PATH}/webpages/versions/?page=${pageId}&latest=true`,
            byPageAction: (pageId) => `${BASE_PATH}/webpages/versions/by-page/${pageId}/`
        }
    },

    // Layouts endpoints  
    layouts: {
        base: `${BASE_PATH}/webpages/layouts`,
        list: `${BASE_PATH}/webpages/layouts/`,
        detail: (name) => `${BASE_PATH}/webpages/layouts/${name}/`,
        choices: `${BASE_PATH}/webpages/layouts/choices/`,
        reload: `${BASE_PATH}/webpages/layouts/reload/`,
        validate: `${BASE_PATH}/webpages/layouts/validate/`,
        json: (name) => `${BASE_PATH}/webpages/layouts/${name}/json/`,
        combined: `${BASE_PATH}/webpages/layouts/combined/`
    },

    // Page Data Schemas endpoints
    pageDataSchemas: {
        base: `${BASE_PATH}/webpages/page-data-schemas`,
        list: `${BASE_PATH}/webpages/page-data-schemas/`,
        detail: (id) => `${BASE_PATH}/webpages/page-data-schemas/${id}/`,
        effective: (layoutName) => `${BASE_PATH}/webpages/page-data-schemas/effective/${layoutName ? `?layout_name=${encodeURIComponent(layoutName)}` : ''}`,
        validate: `${BASE_PATH}/webpages/page-data-schemas/validate/`
    },

    // Widgets endpoints
    widgets: {
        base: `${BASE_PATH}/webpages/widgets`,
        list: `${BASE_PATH}/webpages/widgets/`,
        detail: (id) => `${BASE_PATH}/webpages/widgets/${id}/`,
        byPage: (pageId) => `${BASE_PATH}/webpages/widgets/by_page/${pageId}/`,
        reorder: (id) => `${BASE_PATH}/webpages/widgets/${id}/reorder/`,
        types: `${BASE_PATH}/webpages/widget-types/`,
        typesWithJson: `${BASE_PATH}/webpages/widget-types/?include_template_json=true`
    },

    // Themes endpoints
    themes: {
        base: `${BASE_PATH}/webpages/themes`,
        list: `${BASE_PATH}/webpages/themes/`,
        detail: (id) => `${BASE_PATH}/webpages/themes/${id}/`,
    },

    // Namespaces endpoints
    namespaces: {
        base: `${BASE_PATH}/namespaces`,
        list: `${BASE_PATH}/namespaces/`,
        detail: (id) => `${BASE_PATH}/namespaces/${id}/`,
        setDefault: (id) => `${BASE_PATH}/namespaces/${id}/set_as_default/`,
        contentSummary: (id) => `${BASE_PATH}/namespaces/${id}/get_content_summary/`
    },

    // Content endpoints
    content: {
        base: `${BASE_PATH}/content`,
        all: `${BASE_PATH}/content/all/`,
        byType: (type) => `${BASE_PATH}/content/${type}/`,
        detail: (type, id) => `${BASE_PATH}/content/${type}/${id}/`
    },

    // Publishing endpoints  
    publishing: {
        bulkPublish: '/api/webpages/bulk_publish/',
        bulkSchedule: '/api/webpages/bulk_schedule/',
        schedule: '/api/webpages/schedule/',
        publicationStatus: '/api/webpages/publicationStatus/'
    },

    // Media endpoints
    media: {
        base: `${BASE_PATH}/media`,
        files: `${BASE_PATH}/media/files/`,
        file: (id) => `${BASE_PATH}/media/files/${id}/`,
        upload: `${BASE_PATH}/media/upload/`,
        search: `${BASE_PATH}/media/search/`,
        tags: `${BASE_PATH}/media/tags/`,
        tag: (id) => `${BASE_PATH}/media/tags/${id}/`,
        collections: `${BASE_PATH}/media/collections/`,
        collection: (id) => `${BASE_PATH}/media/collections/${id}/`,
        // Pending files endpoints
        pendingFiles: `${BASE_PATH}/media/pending-files/`,
        pendingFile: (id) => `${BASE_PATH}/media/pending-files/${id}/`,
        approvePendingFile: (id) => `${BASE_PATH}/media/pending-files/${id}/approve/`,
        rejectPendingFile: (id) => `${BASE_PATH}/media/pending-files/${id}/reject/`,
        bulkApprovePendingFiles: `${BASE_PATH}/media/pending-files/bulk_approve/`,
        bulkRejectPendingFiles: `${BASE_PATH}/media/pending-files/bulk_reject/`,
        // AI and bulk operations
        aiSuggestions: `${BASE_PATH}/media/ai-suggestions/`,
        bulkOperations: `${BASE_PATH}/media/bulk-operations/`,
        // Slug validation
        validateSlug: `${BASE_PATH}/media/validate-slug/`
    }
}

/**
 * Build endpoint URL with parameters
 * @param {string} template - Endpoint template with {param} placeholders
 * @param {Object} params - Parameters to substitute
 * @returns {string} Built endpoint URL
 */
export const buildEndpoint = (template, params = {}) => {
    let url = template
    Object.entries(params).forEach(([key, value]) => {
        url = url.replace(`{${key}}`, encodeURIComponent(value))
    })
    return url
}

export default endpoints