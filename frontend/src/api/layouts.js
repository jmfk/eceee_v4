/**
 * API client for code-based layout operations
 */

import axios from 'axios'

const API_BASE = '/api/v1/webpages'

export const layoutsApi = {
    // Code-based layouts
    codeLayouts: {
        // Get all code layouts
        list: async (activeOnly = true) => {
            const response = await axios.get(`${API_BASE}/layouts/`, {
                params: { active_only: activeOnly }
            })
            return response.data
        },

        // Get specific code layout
        get: async (name) => {
            const response = await axios.get(`${API_BASE}/layouts/${name}/`)
            return response.data
        },

        // Get layout choices for forms
        choices: async (activeOnly = true) => {
            const response = await axios.get(`${API_BASE}/layouts/choices/`, {
                params: { active_only: activeOnly }
            })
            return response.data
        },

        // Reload layouts (admin)
        reload: async () => {
            const response = await axios.post(`${API_BASE}/layouts/reload/`)
            return response.data
        },

        // Validate layouts (admin)
        validate: async () => {
            const response = await axios.get(`${API_BASE}/layouts/validate/`)
            return response.data
        }
    },

    // Layout operations
    combined: {
        // Get all layouts
        listAll: async () => {
            const codeLayouts = await layoutsApi.codeLayouts.list()
            return {
                code_layouts: codeLayouts.results || [],
                total_count: codeLayouts.count || 0,
                summary: codeLayouts.summary
            }
        },

        // Get layouts formatted for selection dropdowns
        getSelectionOptions: async () => {
            const allLayouts = await layoutsApi.combined.listAll()
            const options = []

            if (allLayouts.code_layouts) {
                allLayouts.code_layouts.forEach(layout => {
                    options.push({
                        value: layout.name,
                        label: layout.name,
                        type: 'code',
                        layout: layout
                    })
                })
            }

            return options
        },

        // Get layout with enhanced information
        getEnhancedLayout: async (layoutName) => {
            try {
                const layout = await layoutsApi.codeLayouts.get(layoutName)
                return {
                    ...layout,
                    type: 'code'
                }
            } catch (error) {
                console.error(`Failed to load layout ${layoutName}:`, error)
                throw error
            }
        }
    },

    // Page operations with code layout support
    pages: {
        // Update page layout (code-based only) - now uses versioned endpoint
        updateLayout: async (pageId, versionId, layoutName) => {
            const data = {
                code_layout: layoutName || ''
            }

            const response = await axios.patch(`${API_BASE}/pages/${pageId}/versions/${versionId}/`, data)
            return response.data
        }
    }
}

// Helper functions
export const layoutUtils = {
    // Determine layout type from a page object
    getPageLayoutType: (page) => {
        if (page.code_layout) {
            return 'code'
        }
        return 'inherited'
    },

    // Get effective layout name for display
    getEffectiveLayoutName: (page) => {
        if (page.effective_layout) {
            return page.effective_layout.name
        }
        return 'No layout'
    },

    // Check if layout can be edited (code layouts cannot be edited through UI)
    canEditLayout: () => {
        return false
    },

    // Format layout for display
    formatLayoutForDisplay: (layout) => {
        return {
            ...layout,
            displayName: `📝 ${layout.name}`,
            typeLabel: 'Code',
            canEdit: false,
            canDelete: false,
            type: 'code'
        }
    },

    // Parse layout selection value
    parseLayoutSelection: (value) => {
        if (!value) return null

        return {
            type: 'code',
            identifier: value,
            isCode: true,
            isDatabase: false
        }
    },

    // Get layout preview data
    getLayoutPreviewData: async (layoutName) => {
        try {
            const layout = await layoutsApi.combined.getEnhancedLayout(layoutName)
            return {
                ...layout,
                hasPreview: true,
                previewType: 'code'
            }
        } catch (error) {
            console.error(`Failed to get preview data for ${layoutName}:`, error)
            return {
                name: layoutName,
                hasPreview: false,
                previewError: error.message
            }
        }
    }
} 