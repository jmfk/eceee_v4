import { useState, useCallback } from 'react'
import { useQuery } from '@tanstack/react-query'
import { widgetsApi } from '../api'

/**
 * Custom hook for widget management
 * Provides shared functionality for both ContentEditor and ObjectContentEditor
 */

export const useWidgets = (initialWidgets = {}) => {
    const [widgets, setWidgets] = useState(initialWidgets)

    // Fetch available widget types from API
    const {
        data: widgetTypes = [],
        isLoading: isLoadingTypes,
        error: typesError,
        refetch: refetchTypes
    } = useQuery({
        queryKey: ['widget-types'],
        queryFn: async () => {
            try {
                const response = await widgetsApi.getTypes(true) // Include template JSON

                // Check if response has data property or is direct array
                let widgetData = null
                if (Array.isArray(response)) {
                    widgetData = response
                } else if (response?.data && Array.isArray(response.data)) {
                    widgetData = response.data
                } else if (response?.results && Array.isArray(response.results)) {
                    widgetData = response.results
                } else {
                    console.warn('Unexpected widget API response structure:', response)
                    widgetData = []
                }

                return widgetData || []
            } catch (error) {
                console.error('Error fetching widget types:', error)
                throw error
            }
        },
        staleTime: 5 * 60 * 1000, // 5 minutes
        retry: 3,
        retryDelay: 1000,
    })

    // Generate unique widget ID
    const generateWidgetId = useCallback(() => {
        return `widget-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
    }, [])

    // Add widget to a slot
    const addWidget = useCallback((slotName, widgetType, config = {}) => {
        const newWidget = {
            id: generateWidgetId(),
            name: getWidgetDisplayName(widgetType),
            type: widgetType,
            config: config,
            slotName: slotName
        }

        setWidgets(prev => ({
            ...prev,
            [slotName]: [...(prev[slotName] || []), newWidget]
        }))

        return newWidget
    }, [generateWidgetId])

    // Update widget configuration
    const updateWidget = useCallback((slotName, widgetIndex, updates) => {
        setWidgets(prev => {
            const slotWidgets = [...(prev[slotName] || [])]
            if (slotWidgets[widgetIndex]) {
                slotWidgets[widgetIndex] = {
                    ...slotWidgets[widgetIndex],
                    ...updates
                }
            }
            return {
                ...prev,
                [slotName]: slotWidgets
            }
        })
    }, [])

    // Delete widget from slot
    const deleteWidget = useCallback((slotName, widgetIndex) => {
        setWidgets(prev => {
            const slotWidgets = [...(prev[slotName] || [])]
            slotWidgets.splice(widgetIndex, 1)
            return {
                ...prev,
                [slotName]: slotWidgets
            }
        })
    }, [])

    // Move widget within slot or between slots
    const moveWidget = useCallback((fromSlot, fromIndex, toSlot, toIndex) => {
        setWidgets(prev => {
            const newWidgets = { ...prev }

            // Remove widget from source
            const sourceWidgets = [...(newWidgets[fromSlot] || [])]
            const [movedWidget] = sourceWidgets.splice(fromIndex, 1)

            // Add widget to destination
            const destWidgets = fromSlot === toSlot ? sourceWidgets : [...(newWidgets[toSlot] || [])]
            destWidgets.splice(toIndex, 0, { ...movedWidget, slotName: toSlot })

            // Update state
            newWidgets[fromSlot] = sourceWidgets
            if (fromSlot !== toSlot) {
                newWidgets[toSlot] = destWidgets
            }

            return newWidgets
        })
    }, [])

    // Clear all widgets from a slot
    const clearSlot = useCallback((slotName) => {
        setWidgets(prev => ({
            ...prev,
            [slotName]: []
        }))
    }, [])

    // Get widget by ID across all slots
    const getWidgetById = useCallback((widgetId) => {
        for (const slotName in widgets) {
            const widget = widgets[slotName].find(w => w.id === widgetId)
            if (widget) {
                return { widget, slotName, index: widgets[slotName].indexOf(widget) }
            }
        }
        return null
    }, [widgets])

    // Get widget count for a slot
    const getSlotWidgetCount = useCallback((slotName) => {
        return (widgets[slotName] || []).length
    }, [widgets])

    // Validate widget configuration against schema
    const validateWidget = useCallback(async (widget) => {
        try {
            const widgetType = widgetTypes.find(type => type.type === widget.type)
            if (!widgetType || !widgetType.schema) {
                return { isValid: true, errors: [] }
            }

            // TODO: Implement JSON schema validation
            // For now, return valid
            return { isValid: true, errors: [] }
        } catch (error) {
            console.error('Widget validation error:', error)
            return { isValid: false, errors: [error.message] }
        }
    }, [widgetTypes])

    return {
        // State
        widgets,
        setWidgets,
        widgetTypes,
        isLoadingTypes,
        typesError,

        // Actions
        addWidget,
        updateWidget,
        deleteWidget,
        moveWidget,
        clearSlot,

        // Utilities
        getWidgetById,
        getSlotWidgetCount,
        validateWidget,
        refetchTypes,
        generateWidgetId
    }
}

// Helper function to get display name for widget types (NEW FORMAT ONLY)
export const getWidgetDisplayName = (widgetType) => {
    const widgetMap = {
        'core_widgets.TextBlockWidget': 'Text Block',
        'core_widgets.ImageWidget': 'Image',
        'core_widgets.ButtonWidget': 'Button',
        'core_widgets.HtmlBlockWidget': 'HTML Block',
        'core_widgets.GalleryWidget': 'Gallery',
        'core_widgets.SpacerWidget': 'Spacer'
    }
    return widgetMap[widgetType] || widgetType
}

// Helper function to create default widget config
export const createDefaultWidgetConfig = (widgetType) => {
    const defaultConfigs = {
        'core_widgets.TextBlockWidget': {
            title: '',
            content: 'Click to edit this content...',
            style: 'normal',
            alignment: 'left'
        },
        'core_widgets.ImageWidget': {
            image_url: '',
            alt_text: '',
            caption: '',
            alignment: 'center'
        },
        'core_widgets.ButtonWidget': {
            text: 'Click me',
            url: '#',
            style: 'primary',
            target: '_self'
        },
        'core_widgets.HtmlBlockWidget': {
            html_content: '<p>HTML content goes here...</p>'
        },
        'core_widgets.GalleryWidget': {
            title: '',
            images: [],
            columns: 3,
            spacing: 'normal'
        },
        'core_widgets.SpacerWidget': {
            height: 'medium',
            custom_height: '32px'
        }
    }

    return defaultConfigs[widgetType] || {}
}

export default useWidgets
