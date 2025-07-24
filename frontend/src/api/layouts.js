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

    // Template-based layouts (subset of code layouts with template data)
    templateLayouts: {
        // Get all template-based layouts
        list: async (activeOnly = true) => {
            const allLayouts = await layoutsApi.codeLayouts.list(activeOnly)
            // Filter to only template-based layouts
            const templateLayouts = allLayouts.results?.filter(layout =>
                layout.template_based || layout.html
            ) || []

            return {
                ...allLayouts,
                results: templateLayouts,
                count: templateLayouts.length
            }
        },

        // Get specific template layout with full template data
        get: async (name) => {
            const layout = await layoutsApi.codeLayouts.get(name)
            if (layout.template_based || layout.html) {
                try {
                    const templateData = await layoutsApi.codeLayouts.getTemplateData(name)
                    return {
                        ...layout,
                        ...templateData,
                        template_data_loaded: true
                    }
                } catch (error) {
                    console.warn(`Could not load template data for ${name}:`, error)
                    return {
                        ...layout,
                        template_data_loaded: false,
                        template_error: error.message
                    }
                }
            }
            throw new Error(`Layout ${name} is not template-based`)
        },

        // Get template layouts for preview with enhanced data
        listWithTemplateData: async (activeOnly = true) => {
            const templateLayouts = await layoutsApi.templateLayouts.list(activeOnly)
            const enhancedResults = await Promise.all(
                templateLayouts.results.map(async (layout) => {
                    try {
                        const templateData = await layoutsApi.codeLayouts.getTemplateData(layout.name)
                        return {
                            ...layout,
                            ...templateData,
                            template_data_loaded: true
                        }
                    } catch (error) {
                        return {
                            ...layout,
                            template_data_loaded: false,
                            template_error: error.message
                        }
                    }
                })
            )

            return {
                ...templateLayouts,
                results: enhancedResults
            }
        }
    },

    // Layout operations (combined code and template)
    combined: {
        // Get all layouts (both code and template-based)
        listAll: async () => {
            const codeLayouts = await layoutsApi.codeLayouts.list()
            return {
                code_layouts: codeLayouts.results || [],
                template_layouts: codeLayouts.results?.filter(layout =>
                    layout.template_based || layout.html
                ) || [],
                total_count: codeLayouts.count || 0,
                summary: codeLayouts.summary
            }
        },

        // Get layouts formatted for selection dropdowns
        getSelectionOptions: async () => {
            const allLayouts = await layoutsApi.combined.listAll()
            const options = []

            // Add code-based layouts (non-template)
            if (allLayouts.code_layouts) {
                allLayouts.code_layouts
                    .filter(layout => !layout.template_based && !layout.html)
                    .forEach(layout => {
                        options.push({
                            value: layout.name,
                            label: layout.name,
                            type: 'code',
                            layout: layout,
                            template_based: false
                        })
                    })
            }

            // Add template-based layouts
            if (allLayouts.template_layouts) {
                allLayouts.template_layouts.forEach(layout => {
                    options.push({
                        value: layout.name,
                        label: layout.name,
                        type: 'template',
                        layout: layout,
                        template_based: true
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
                            template_data_loaded: true,
                            type: 'template'
                        }
                    } catch (templateError) {
                        console.warn(`Could not load template data for ${layoutName}:`, templateError)
                        return {
                            ...layout,
                            template_data_loaded: false,
                            template_error: templateError.message,
                            type: 'template'
                        }
                    }
                }

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
        if (page.code_layout) {
            // Check if the layout is template-based
            const effectiveLayout = page.effective_layout
            if (effectiveLayout && (effectiveLayout.template_based || effectiveLayout.html)) {
                return 'template'
            }
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

    // Check if layout can be edited (both types are read-only in current implementation)
    canEditLayout: () => {
        return false  // Both code and template layouts cannot be edited through UI
    },

    // Format layout for display with proper type detection
    formatLayoutForDisplay: (layout) => {
        const isTemplate = layout.template_based || layout.html || layout.type === 'template'

        return {
            ...layout,
            displayName: isTemplate ? `🎨 ${layout.name}` : `📝 ${layout.name}`,
            typeLabel: isTemplate ? 'Template' : 'Code',
            canEdit: false,
            canDelete: false,
            type: isTemplate ? 'template' : 'code',
            template_based: isTemplate
        }
    },

    // Parse layout selection value (handles both types)
    parseLayoutSelection: (value) => {
        if (!value) return null

        return {
            type: 'code', // Both are stored as code layout names
            identifier: value,
            isCode: true,
            isDatabase: false
        }
    },

    // Check if layout is template-based
    isTemplateLayout: (layout) => {
        return !!(layout.template_based || layout.html || layout.type === 'template')
    },

    // Get layout preview data with enhanced information
    getLayoutPreviewData: async (layoutName) => {
        try {
            const layout = await layoutsApi.combined.getEnhancedLayout(layoutName)
            return {
                ...layout,
                hasPreview: true,
                previewType: layout.type || (layoutUtils.isTemplateLayout(layout) ? 'template' : 'code')
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