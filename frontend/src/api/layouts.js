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

    // Database layouts (legacy)
    databaseLayouts: {
        // Get all database layouts
        list: async () => {
            const response = await axios.get(`${API_BASE}/layouts/`)
            return response.data
        },

        // Get specific database layout
        get: async (id) => {
            const response = await axios.get(`${API_BASE}/layouts/${id}/`)
            return response.data
        },

        // Create database layout
        create: async (data) => {
            const response = await axios.post(`${API_BASE}/layouts/`, data)
            return response.data
        },

        // Update database layout
        update: async (id, data) => {
            const response = await axios.put(`${API_BASE}/layouts/${id}/`, data)
            return response.data
        },

        // Delete database layout
        delete: async (id) => {
            const response = await axios.delete(`${API_BASE}/layouts/${id}/`)
            return response.data
        },

        // Get active database layouts only
        active: async () => {
            const response = await axios.get(`${API_BASE}/layouts/active/`)
            return response.data
        }
    },

    // Combined layout operations
    combined: {
        // Get all layouts (both types)
        listAll: async () => {
            const response = await axios.get(`${API_BASE}/layouts/all_layouts/`)
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
                        value: `code:${layout.name}`,
                        label: `${layout.name} (Code)`,
                        type: 'code',
                        layout: layout
                    })
                })
            }

            // Add database layouts
            if (allLayouts.database_layouts) {
                allLayouts.database_layouts.forEach(layout => {
                    options.push({
                        value: `db:${layout.id}`,
                        label: `${layout.name} (Database)`,
                        type: 'database',
                        layout: layout
                    })
                })
            }

            return options
        }
    },

    // Page operations with layout support
    pages: {
        // Update page layout (supports both types)
        updateLayout: async (pageId, layoutData) => {
            const data = {}

            if (layoutData.type === 'code') {
                data.code_layout = layoutData.name
                data.layout_id = null  // Clear database layout
            } else if (layoutData.type === 'database') {
                data.layout_id = layoutData.id
                data.code_layout = ''  // Clear code layout
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
        if (page.layout) return 'database'
        return 'inherited'
    },

    // Get effective layout name for display
    getEffectiveLayoutName: (page) => {
        if (page.effective_layout) {
            return page.effective_layout.name
        }
        return 'No layout'
    },

    // Check if layout can be edited
    canEditLayout: (layout) => {
        return layout.type === 'database'
    },

    // Format layout for display
    formatLayoutForDisplay: (layout) => {
        const typeIndicator = layout.type === 'code' ? '📝' : '🗄️'
        const typeLabel = layout.type === 'code' ? 'Code' : 'Database'

        return {
            ...layout,
            displayName: `${typeIndicator} ${layout.name}`,
            typeLabel,
            canEdit: layout.type === 'database',
            canDelete: layout.type === 'database'
        }
    },

    // Parse layout selection value
    parseLayoutSelection: (value) => {
        if (!value) return null

        const [type, identifier] = value.split(':')
        return {
            type,
            identifier,
            isCode: type === 'code',
            isDatabase: type === 'db'
        }
    }
} 