/**
 * SpecialEditorRenderer Component
 * 
 * Renders the appropriate special editor based on widget type.
 * This component serves as a registry and renderer for different special editors.
 */
import React, { useCallback, useEffect, useMemo } from 'react'
import MediaSpecialEditor from './MediaSpecialEditor'
import { useUnifiedData } from '../../contexts/unified-data/context/UnifiedDataContext'
import { OperationTypes } from '../../contexts/unified-data/types/operations'
import { useEditorContext } from '../../contexts/unified-data/hooks'
import { lookupWidget, hasWidgetContentChanged } from '../../utils/widgetUtils'

// Registry of special editors mapped to widget types
const SPECIAL_EDITORS = {
    'core_widgets.ImageWidget': MediaSpecialEditor,
    // Future editors can be added here:
    // 'core_widgets.FormsWidget': FormsSpecialEditor,
    // 'core_widgets.TableWidget': TableSpecialEditor,
    // 'custom_widgets.ChartWidget': ChartSpecialEditor,
}

// Function to check if a widget type has a special editor
export const hasSpecialEditor = (widgetType) => {
    return widgetType && SPECIAL_EDITORS[widgetType] !== undefined
}

// Function to get the special editor component for a widget type
export const getSpecialEditor = (widgetType) => {
    return SPECIAL_EDITORS[widgetType] || null
}

const SpecialEditorRenderer = ({
    widgetData,
    specialEditorWidth = 60,
    isAnimating = false,
    isClosing = false,
    namespace = null,
    contextType = null,
    widgetId = null,
    slotName = null
}) => {

    if (!widgetData?.type || !hasSpecialEditor(widgetData.type)) {
        return null
    }

    const SpecialEditorComponent = getSpecialEditor(widgetData.type)

    if (!SpecialEditorComponent) {
        return null
    }

    // Pure ODC integration
    const { publishUpdate, useExternalChanges, getState } = useUnifiedData()
    const componentId = useMemo(() => `special-editor-${widgetData?.id || 'unknown'}`, [widgetData?.id])

    // ODC Config Synchronization - Initialize from ODC state if available
    useEffect(() => {
        if (!widgetData?.id || !slotName || !contextType) return

        const currentState = getState()
        const widget = lookupWidget(currentState, widgetData.id, slotName, contextType)
        if (widget && widget.config) {
            console.log("SpecialEditorRenderer: Initialized from ODC state", {
                widgetId: widgetData.id,
                slotName,
                contextType,
                displayType: widget.config?.displayType,
                collectionConfig: widget.config?.collectionConfig
            })
        }
    }, [widgetData?.id, slotName, contextType, getState])

    // ODC External Changes Subscription - Listen for updates from other components
    useExternalChanges(componentId, (state) => {
        if (!widgetData?.id || !slotName || !contextType) return

        const widget = lookupWidget(state, widgetData.id, slotName, contextType)
        if (widget && widget.config) {
            console.log("SpecialEditorRenderer: Received external ODC update", {
                widgetId: widgetData.id,
                slotName,
                contextType,
                displayType: widget.config?.displayType,
                collectionConfig: widget.config?.collectionConfig
            })

            // Note: Special editors manage their own state internally
            // This subscription is mainly for logging and potential future synchronization needs
        }
    })

    // Direct ODC integration for special editors
    const handleConfigChange = useCallback((newConfig) => {
        console.log("SpecialEditorRenderer: Publishing ODC update", {
            widgetId: widgetData?.id,
            slotName: widgetData?.slotName || slotName,
            contextType,
            displayType: newConfig?.displayType,
            collectionConfig: newConfig?.collectionConfig
        })

        if (!widgetData?.id) {
            console.warn("SpecialEditorRenderer: Missing widgetId, cannot publish update")
            return
        }

        publishUpdate(componentId, OperationTypes.UPDATE_WIDGET_CONFIG, {
            id: widgetData.id,
            slotName: widgetData.slotName || slotName,
            contextType: contextType,
            config: newConfig
        })
    }, [publishUpdate, componentId, widgetData?.id, widgetData?.slotName, slotName, contextType])



    return (
        <div
            className={`flex-shrink-0 border-r border-gray-200 bg-gray-50 transition-all duration-500 ease-out ${isAnimating ? 'animate-slide-in-left' : ''
                } ${isClosing ? 'animate-slide-out-left' : ''
                }`}
            style={{ width: `${specialEditorWidth}%` }}
        >
            <SpecialEditorComponent
                widgetData={widgetData}
                isAnimating={isAnimating}
                isClosing={isClosing}
                onConfigChange={handleConfigChange}
                namespace={namespace}
                contextType={contextType}
                widgetId={widgetId}
                slotName={slotName}
            />
        </div>
    )
}

SpecialEditorRenderer.displayName = 'SpecialEditorRenderer'

export default SpecialEditorRenderer
