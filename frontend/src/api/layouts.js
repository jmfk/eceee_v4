/**
 * API client for layout-related operations
 * Supports both code-based and database layouts
 */

import axios from 'axios'

const API_BASE = '/api/v1/webpages'

export const layoutsApi = {
    // Code-based layouts
    codeLayouts: {
        // Get all code layouts
        list: async (activeOnly = true) => {
            const response = await axios.get(`${API_BASE}/code-layouts/`, {
                params: { active_only: activeOnly }
            })
            return response.data
        },

        // Get specific code layout
        get: async (name) => {
            const response = await axios.get(`${API_BASE}/code-layouts/${name}/`)
            return response.data
        },

        // Get template data for layout (Phase 3.1)
        getTemplateData: async (name) => {
            const response = await axios.get(`${API_BASE}/code-layouts/${name}/template/`)
            return response.data
        },

        // Get layout choices for forms
        choices: async (activeOnly = true) => {
            const response = await axios.get(`${API_BASE}/code-layouts/choices/`, {
                params: { active_only: activeOnly }
            })
            return response.data
        },

        // Reload layouts (admin)
        reload: async () => {
            const response = await axios.post(`${API_BASE}/code-layouts/reload/`)
            return response.data
        },

        // Validate layouts (admin)
        validate: async () => {
            const response = await axios.get(`${API_BASE}/code-layouts/validate/`)
            return response.data
        }
    },

    // Database layouts removed - now using code-based layouts only

    // Layout operations (code-based only)
    combined: {
        // Get all code layouts
        listAll: async () => {
            const response = await axios.get(`${API_BASE}/code-layouts/all_layouts/`)
            return response.data
        },

        // Get layouts formatted for selection dropdowns
        getSelectionOptions: async () => {
            const allLayouts = await layoutsApi.combined.listAll()

            const options = []

            // Add code layouts
            if (allLayouts.code_layouts) {
                allLayouts.code_layouts.forEach(layout => {
                    options.push({
                        value: layout.name,
                        label: layout.name,
                        type: 'code',
                        layout: layout,
                        template_based: layout.template_based || false
                    })
                })
            }

            return options
        },

        // Get enhanced layout with template data (Phase 3.1)
        getEnhancedLayout: async (layoutName) => {
            try {
                // First get basic layout info
                const layout = await layoutsApi.codeLayouts.get(layoutName)

                // If it's template-based, get template data
                if (layout.template_based || layout.html) {
                    try {
                        const templateData = await layoutsApi.codeLayouts.getTemplateData(layoutName)
                        return {
                            ...layout,
                            ...templateData,
                            template_data_loaded: true
                        }
                    } catch (templateError) {
                        console.warn(`Could not load template data for ${layoutName}:`, templateError)
                        return {
                            ...layout,
                            template_data_loaded: false,
                            template_error: templateError.message
                        }
                    }
                }

                return layout
            } catch (error) {
                console.error(`Failed to load layout ${layoutName}:`, error)
                throw error
            }
        }
    },

    // Page operations with code layout support
    pages: {
        // Update page layout (code-based only)
        updateLayout: async (pageId, layoutName) => {
            const data = {
                code_layout: layoutName || ''
            }

            const response = await axios.patch(`${API_BASE}/pages/${pageId}/`, data)
            return response.data
        }
    }
}

// Helper functions
export const layoutUtils = {
    // Determine layout type from a page object
    getPageLayoutType: (page) => {
        if (page.code_layout) return 'code'
        return 'inherited'
    },

    // Get effective layout name for display
    getEffectiveLayoutName: (page) => {
        if (page.effective_layout) {
            return page.effective_layout.name
        }
        return 'No layout'
    },

    // Check if layout can be edited (code layouts are read-only)
    canEditLayout: (layout) => {
        return false  // Code layouts cannot be edited through UI
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

    // Parse layout selection value (simplified for code layouts)
    parseLayoutSelection: (value) => {
        if (!value) return null

        return {
            type: 'code',
            identifier: value,
            isCode: true,
            isDatabase: false
        }
    }
} 