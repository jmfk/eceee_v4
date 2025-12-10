import { useState, useCallback } from 'react'
import { useQuery } from '@tanstack/react-query'
import { widgetsApi } from '../api'
import {
    getWidgetDisplayName as getDisplayNameFromRegistry,
    getWidgetDefaultConfig
} from '../widgets'

/**
 * Custom hook for widget management
 * Provides shared functionality for both ContentEditor and ObjectContentEditor
 */

// Helper function to filter valid widgets
const filterValidWidgets = (widgets) => {
    return Array.isArray(widgets)
        ? widgets.filter(w => w != null && typeof w === 'object' && w.id != null)
        : []
}

export const useWidgets = (initialWidgets = {}) => {
    // Filter initial widgets to ensure no undefined entries
    const filteredInitial = {}
    Object.keys(initialWidgets).forEach(slotName => {
        filteredInitial[slotName] = filterValidWidgets(initialWidgets[slotName] || [])
    })
    const [widgets, setWidgets] = useState(filteredInitial)

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
        // Use a counter to ensure uniqueness even within the same millisecond
        if (!generateWidgetId._counter) {
            generateWidgetId._counter = 0;
        }
        generateWidgetId._counter++;

        return `widget-${Date.now()}-${generateWidgetId._counter}-${Math.random().toString(36).substr(2, 9)}`
    }, [])

    // Add widget to a slot
    const addWidget = useCallback((slotName, widgetType, config = {}) => {
        const newWidget = {
            id: generateWidgetId(),
            name: getDisplayNameFromRegistry(widgetType, widgetTypes),
            type: widgetType,
            config: config,
            slotName: slotName
        }

        setWidgets(prev => {
            // Filter existing widgets to remove any undefined entries, then add new widget
            const existingWidgets = filterValidWidgets(prev[slotName] || [])
            return {
                ...prev,
                [slotName]: [...existingWidgets, newWidget]
            }
        })

        return newWidget
    }, [generateWidgetId, widgetTypes])

    // Update widget configuration
    const updateWidget = useCallback((slotName, widgetIndex, updates) => {
        setWidgets(prev => {
            // Filter valid widgets first to remove any undefined entries
            const slotWidgets = filterValidWidgets(prev[slotName] || [])
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
            // Filter valid widgets first, then remove by index
            const slotWidgets = filterValidWidgets(prev[slotName] || [])
            if (widgetIndex >= 0 && widgetIndex < slotWidgets.length) {
                slotWidgets.splice(widgetIndex, 1)
            }
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

            // Filter valid widgets first
            const sourceWidgets = filterValidWidgets(newWidgets[fromSlot] || [])
            if (fromIndex < 0 || fromIndex >= sourceWidgets.length) {
                return prev // Invalid index
            }
            
            const [movedWidget] = sourceWidgets.splice(fromIndex, 1)
            if (!movedWidget) {
                return prev // No widget to move
            }

            // Add widget to destination
            const destWidgets = fromSlot === toSlot ? sourceWidgets : filterValidWidgets(newWidgets[toSlot] || [])
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
            const validWidgets = filterValidWidgets(widgets[slotName] || [])
            const widget = validWidgets.find(w => w.id === widgetId)
            if (widget) {
                return { widget, slotName, index: validWidgets.indexOf(widget) }
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

// Helper function to get display name for widget types (uses registry)
export const getWidgetDisplayName = (widgetType) => {
    return getDisplayNameFromRegistry(widgetType)
}

// Helper function to create default widget config (uses registry)
export const createDefaultWidgetConfig = (widgetType) => {
    return getWidgetDefaultConfig(widgetType)
}

export default useWidgets
