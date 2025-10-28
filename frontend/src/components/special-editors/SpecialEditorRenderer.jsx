/**
 * SpecialEditorRenderer Component
 * 
 * Renders the appropriate special editor based on widget metadata.
 * Special editors are now declared in widget metadata for better modularity.
 */
import React, { useCallback, useEffect, useMemo } from 'react'
import MediaSpecialEditor from './MediaSpecialEditor'
import TableSpecialEditor from './TableSpecialEditor'
import FooterWidgetEditor from '../../widgets/eceee-widgets/FooterWidgetEditor'
import { useUnifiedData } from '../../contexts/unified-data/context/UnifiedDataContext'
import { OperationTypes } from '../../contexts/unified-data/types/operations'
import { useEditorContext } from '../../contexts/unified-data/hooks'
import { lookupWidget, hasWidgetContentChanged } from '../../utils/widgetUtils'
import { getWidgetMetadata } from '../../widgets'

// Map of special editor names to components
const SPECIAL_EDITOR_COMPONENTS = {
    'MediaSpecialEditor': MediaSpecialEditor,
    'TableSpecialEditor': TableSpecialEditor,
    'FooterWidgetEditor': FooterWidgetEditor,
}

// Legacy registry for backward compatibility (deprecated - use widget metadata instead)
const LEGACY_SPECIAL_EDITORS = {
    'eceee_widgets.ImageWidget': 'MediaSpecialEditor',
}

/**
 * Get special editor component for a widget type
 * First checks widget metadata, then falls back to legacy registry
 * @param {string} widgetType - Widget type identifier
 * @returns {React.Component|null} Special editor component or null
 */
export const getSpecialEditor = (widgetType) => {
    if (!widgetType) return null

    // Try to get from widget metadata first (preferred approach)
    const widgetEntry = getWidgetMetadata(widgetType)
    // The metadata is nested inside the registry entry
    const metadata = widgetEntry?.metadata
    if (metadata?.specialEditor) {
        const editorComponent = SPECIAL_EDITOR_COMPONENTS[metadata.specialEditor]
        if (editorComponent) {
            return editorComponent
        }
        console.warn(`[SpecialEditor] Editor "${metadata.specialEditor}" declared in metadata but not found in SPECIAL_EDITOR_COMPONENTS`)
    }

    // Fall back to legacy registry
    const legacyEditorName = LEGACY_SPECIAL_EDITORS[widgetType]
    if (legacyEditorName) {
        return SPECIAL_EDITOR_COMPONENTS[legacyEditorName]
    }

    return null
}

/**
 * Check if a widget type has a special editor
 * @param {string} widgetType - Widget type identifier
 * @returns {boolean} True if widget has a special editor
 */
export const hasSpecialEditor = (widgetType) => {
    return getSpecialEditor(widgetType) !== null
}

const SpecialEditorRenderer = ({
    widgetData,
    specialEditorWidth = 60,
    isAnimating = false,
    isClosing = false,
    namespace = null,
    contextType = null,
    widgetId = null,
    slotName = null,
    context = {}
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
        const widgetPath = widgetData?.context?.widgetPath || widgetData?.widgetPath
        const widget = lookupWidget(currentState, widgetData.id, slotName, contextType, widgetPath)
        if (widget && widget.config) {
            // Initialize from ODC state
        }
    }, [widgetData?.id, slotName, contextType, getState])

    // ODC External Changes Subscription - Listen for updates from other components
    useExternalChanges(componentId, (state) => {
        if (!widgetData?.id || !slotName || !contextType) return

        const widgetPath = widgetData?.context?.widgetPath || widgetData?.widgetPath
        const widget = lookupWidget(state, widgetData.id, slotName, contextType, widgetPath)
        if (widget && widget.config) {
            // Note: Special editors manage their own state internally
            // This subscription is mainly for logging and potential future synchronization needs
        }
    })

    // Direct ODC integration for special editors
    const handleConfigChange = useCallback((newConfig) => {

        if (!widgetData?.id) {
            console.warn("SpecialEditorRenderer: Missing widgetId, cannot publish update")
            return
        }

        // Extract widgetPath from context for nested widget support
        const widgetPath = widgetData?.context?.widgetPath || widgetData?.widgetPath

        publishUpdate(componentId, OperationTypes.UPDATE_WIDGET_CONFIG, {
            id: widgetData.id,
            slotName: widgetData.slotName || slotName,
            contextType: contextType,
            config: newConfig,
            // NEW: Path-based approach (supports infinite nesting)
            widgetPath: widgetPath && widgetPath.length > 0 ? widgetPath : undefined
        })
    }, [publishUpdate, componentId, widgetData?.id, widgetData?.slotName, widgetData?.context?.widgetPath, widgetData?.widgetPath, slotName, contextType])



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
                context={context}
            />
        </div>
    )
}

SpecialEditorRenderer.displayName = 'SpecialEditorRenderer'

export default SpecialEditorRenderer
