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
        publicationStatus: `${BASE_PATH}/webpages/pages/publication_status/`,
        // DEPRECATED: Version-related endpoints moved to versions API
        versions: (id) => `${BASE_PATH}/webpages/pages/${id}/versions/`, // Use versions.byPage(id) instead
        versionCurrent: (pageId) => `${BASE_PATH}/webpages/pages/${pageId}/versions/current/`, // Use versions.currentForPage(pageId) instead  
        versionDetail: (pageId, versionId) => `${BASE_PATH}/webpages/pages/${pageId}/versions/${versionId}/` // Use versions.detail(versionId) instead
    },

    // Versions endpoints (NEW SEPARATED API)
    versions: {
        base: `${BASE_PATH}/webpages/versions`,
        list: `${BASE_PATH}/webpages/versions/`,
        detail: (id) => `${BASE_PATH}/webpages/versions/${id}/`,
        publish: (id) => `${BASE_PATH}/webpages/versions/${id}/publish/`,
        createDraft: (id) => `${BASE_PATH}/webpages/versions/${id}/create_draft/`,
        restore: (id) => `${BASE_PATH}/webpages/versions/${id}/restore/`,
        compare: `${BASE_PATH}/webpages/versions/compare/`,
        search: `${BASE_PATH}/webpages/versions/search/`,
        // NEW: Direct version endpoints (replaces page-nested endpoints)
        byPage: (pageId) => `${BASE_PATH}/webpages/versions/by-page/${pageId}/`,
        forPage: (pageId) => `${BASE_PATH}/webpages/versions/?page=${pageId}`,
        currentForPage: (pageId) => `${BASE_PATH}/webpages/versions/?page=${pageId}&current=true`,
        latestForPage: (pageId) => `${BASE_PATH}/webpages/versions/?page=${pageId}&latest=true`,
        // DEPRECATED: Legacy page-nested endpoints (will be removed)
        legacy: {
            byPage: (pageId) => `${BASE_PATH}/webpages/pages/${pageId}/versions/`,
            current: (pageId) => `${BASE_PATH}/webpages/pages/${pageId}/versions/current/`,
            latest: (pageId) => `${BASE_PATH}/webpages/pages/${pageId}/versions/latest/`,
            detail: (pageId, versionId) => `${BASE_PATH}/webpages/pages/${pageId}/versions/${versionId}/`
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
        effective: (layoutName) => `${BASE_PATH}/webpages/page-data-schemas/effective/${layoutName ? `?layout_name=${encodeURIComponent(layoutName)}` : ''}`
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
        publicationStatus: '/api/webpages/publication_status/'
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