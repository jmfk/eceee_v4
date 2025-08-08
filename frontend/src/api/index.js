/**
 * Unified API Client for ECEEE v4 Frontend
 * 
 * Central module that exports all API functionality with consistent patterns:
 * - Unified error handling
 * - Consistent endpoint management  
 * - Standardized request/response processing
 * - Type safety and documentation
 * 
 * Usage:
 *   import { pagesApi, versionsApi, layoutsApi, etc } from '../api'
 *   const pages = await pagesApi.list()
 */

// Core client
export { default as apiClient, api, getCsrfToken, refreshCsrfToken } from './client.js'

// Endpoint configuration
export { endpoints } from './endpoints.js'

// API modules
export { pagesApi } from './pages.js'
export { versionsApi } from './versions.js'
export { layoutsApi } from './layouts.js'
export { namespacesApi } from './namespaces.js'
export { widgetsApi } from './widgets.js'
export { themesApi } from './themes.js'
export { contentApi } from './content.js'
export { publishingApi } from './publishing.js'
export { pageDataSchemasApi } from './pageDataSchemas.js'

// Utility functions
export { buildEndpoint, handleApiError } from './utils.js'

// Default export for convenience
import { pagesApi } from './pages.js'
import { versionsApi } from './versions.js'
import { layoutsApi } from './layouts.js'
import { namespacesApi } from './namespaces.js'
import { widgetsApi } from './widgets.js'
import { themesApi } from './themes.js'
import { contentApi } from './content.js'
import { publishingApi } from './publishing.js'
import { pageDataSchemasApi } from './pageDataSchemas.js'

export default {
    pages: pagesApi,
    versions: versionsApi,
    layouts: layoutsApi,
    namespaces: namespacesApi,
    widgets: widgetsApi,
    themes: themesApi,
    content: contentApi,
    publishing: publishingApi,
    pageDataSchemas: pageDataSchemasApi
}