import React, { useState, useEffect, useRef, useCallback, forwardRef, useImperativeHandle } from 'react'
import { X, RefreshCw } from 'lucide-react'
import { getWidgetSchema } from '../api/widgetSchemas.js'
import { validateWidgetType, clearWidgetTypesCache } from '../utils/widgetTypeValidation.js'
import DeletedWidgetWarning from './DeletedWidgetWarning.jsx'

import { SpecialEditorRenderer, hasSpecialEditor } from './special-editors'
import IsolatedFormRenderer from './IsolatedFormRenderer.jsx'

import { useUnifiedData } from '../contexts/unified-data/context/UnifiedDataContext'
import { OperationTypes } from '../contexts/unified-data/types/operations'
import { useEditorContext } from '../contexts/unified-data/hooks'

/**
 * WidgetEditorPanel - Slide-out panel for editing widgets
 * 
 * Features:
 * - Slides out from the right side with animation
 * - Contains isolated form fields to prevent excessive rerenders
 * - Scrollable content area
 * - Resizable with drag handle
 * - Save/Cancel actions
 */
const WidgetEditorPanel = forwardRef(({
    isOpen,
    onClose,
    onSave,
    onRealTimeUpdate,
    widgetData,
    schema,
    title = "Edit Widget",
    autoOpenSpecialEditor = false,
    namespace = null
}, ref) => {
    const [hasChanges, setHasChanges] = useState(false)
    const [widgetTypeName, setWidgetTypeName] = useState(null)
    const [widgetTypeSlug, setWidgetTypeSlug] = useState(null)
    const [fetchedSchema, setFetchedSchema] = useState(null)
    const [isLoadingSchema, setIsLoadingSchema] = useState(false)
    const [schemaError, setSchemaError] = useState(null)
    const [panelWidth, setPanelWidth] = useState(400) // Default width in pixels
    const [isResizing, setIsResizing] = useState(false)
    const [widgetTypeValidation, setWidgetTypeValidation] = useState(null)
    const [isValidatingType, setIsValidatingType] = useState(false)
    const [showSpecialEditor, setShowSpecialEditor] = useState(false) // For special editor mode
    const [specialEditorWidth, setSpecialEditorWidth] = useState(60) // Percentage of total width
    const [isAnimatingSpecialEditor, setIsAnimatingSpecialEditor] = useState(false) // Animation state
    const [isClosingSpecialEditor, setIsClosingSpecialEditor] = useState(false) // Closing animation state

    const panelRef = useRef(null)
    const resizeRef = useRef(null)
    const startXRef = useRef(0)
    const startWidthRef = useRef(0)
    const rafRef = useRef(null)
    const updateTimeoutRef = useRef(null)

    const { publishUpdate } = useUnifiedData()

    const contextType = useEditorContext();

    // Unified Data Context update function (replaces event emitter)
    const emitWidgetChanged = useCallback((arg1, arg2, arg3, _changeType = 'config') => {
        // Supports both signatures:
        // 1) (data, changeType)
        // 2) (widgetId, slotName, updatedWidget, changeType)
        let widgetId
        let slotName
        let updatedWidget

        if (typeof arg1 === 'object' && arg1 !== null && !arg3) {
            const data = arg1
            widgetId = data?.id
            slotName = data?.slotName || data?.slot
            updatedWidget = data
        } else {
            widgetId = arg1
            slotName = arg2
            updatedWidget = arg3
        }

        if (!widgetId || !slotName || !updatedWidget) {
            return
        }

        const config = updatedWidget.config || {}
        publishUpdate(String(widgetId), OperationTypes.UPDATE_WIDGET_CONFIG, {
            id: widgetId,
            slotName: slotName,
            contextType: contextType,
            config: config
        })
    }, [publishUpdate])

    // Check if widget supports special editor mode
    const supportsSpecialEditor = useCallback(() => {
        return hasSpecialEditor(widgetData?.type)
    }, [widgetData?.type])

    // Close special editor with animation
    const closeSpecialEditor = useCallback(() => {
        if (showSpecialEditor) {
            setIsClosingSpecialEditor(true)
            // Wait for exit animation to complete before hiding
            setTimeout(() => {
                setShowSpecialEditor(false)
                setIsClosingSpecialEditor(false)
                setIsAnimatingSpecialEditor(false)
            }, 500) // 500ms for exit animation
        }
    }, [showSpecialEditor])

    // Reset special editor state when switching to a different widget
    useEffect(() => {
        if (widgetData && showSpecialEditor && !supportsSpecialEditor()) {
            closeSpecialEditor()
        }
    }, [widgetData, showSpecialEditor, supportsSpecialEditor, closeSpecialEditor])

    // Auto-open special editor when panel opens for supported widgets
    useEffect(() => {
        if (isOpen && autoOpenSpecialEditor && supportsSpecialEditor() && !showSpecialEditor) {
            setShowSpecialEditor(true)
            setIsAnimatingSpecialEditor(true)
            setTimeout(() => setIsAnimatingSpecialEditor(false), 800)
        }
    }, [isOpen, autoOpenSpecialEditor, supportsSpecialEditor, showSpecialEditor])

    // Reset special editor state when panel closes
    useEffect(() => {
        if (!isOpen && showSpecialEditor) {
            closeSpecialEditor()
        }
    }, [isOpen, showSpecialEditor, closeSpecialEditor])

    // Validate widget type availability when widget data changes
    useEffect(() => {
        if (widgetData) {
            setIsValidatingType(true)
            validateWidgetType(widgetData)
                .then(validation => {
                    setWidgetTypeValidation(validation)
                    setIsValidatingType(false)
                })
                .catch(error => {
                    console.error('Error validating widget type:', error)
                    setWidgetTypeValidation({
                        isValid: false,
                        error: `Failed to validate widget type: ${error.message}`,
                        canEdit: false,
                        shouldHide: false
                    })
                    setIsValidatingType(false)
                })
        } else {
            setWidgetTypeValidation(null)
            setIsValidatingType(false)
        }
    }, [widgetData])

    // Set widget type name and slug for display purposes
    useEffect(() => {
        if (widgetData) {
            const resolvedWidgetTypeName = widgetData.name ||
                widgetData.widgetType?.name ||
                widgetData.widget_type?.name ||
                widgetData.type

            setWidgetTypeName(resolvedWidgetTypeName)
            setWidgetTypeSlug(widgetData.type)
        }
    }, [widgetData])

    // Fetch schema from backend when widget type changes (only if widget type is valid)
    useEffect(() => {
        if (widgetData && !schema && widgetTypeValidation?.canEdit !== false) {
            setIsLoadingSchema(true)
            setSchemaError(null)

            const fetchSchemaForWidget = async () => {
                try {
                    let resolvedWidgetTypeName = widgetData.name ||
                        widgetData.widgetType?.name ||
                        widgetData.widget_type?.name

                    if (!resolvedWidgetTypeName && widgetData.type) {
                        // Use the widget type directly
                        resolvedWidgetTypeName = widgetData.type
                    }

                    if (resolvedWidgetTypeName) {
                        setWidgetTypeName(resolvedWidgetTypeName)
                        const widgetTypeToUse = widgetData.type

                        setWidgetTypeSlug(widgetTypeToUse)

                        const schemaData = await getWidgetSchema(widgetTypeToUse)
                        setFetchedSchema(schemaData)
                        setIsLoadingSchema(false)
                    } else {
                        throw new Error('Widget type name could not be determined')
                    }
                } catch (error) {
                    console.error('Failed to fetch widget schema:', error)
                    setSchemaError(error.message || 'Failed to load widget schema')
                    setIsLoadingSchema(false)
                }
            }

            fetchSchemaForWidget()
        } else if (schema) {
            // Use provided schema if available
            setFetchedSchema(schema)
        }
    }, [widgetData, schema, widgetTypeValidation])

    // Handle unsaved changes from isolated form
    const handleUnsavedChanges = useCallback(async (hasUnsavedChanges) => {
        setHasChanges(hasUnsavedChanges);
        // if (onUnsavedChanges) {
        //     onUnsavedChanges(hasUnsavedChanges)
        // }
    }, [])

    // Handle resize drag with useCallback and RAF for smooth performance
    const handleResizeMove = useCallback((e) => {
        if (!isResizing) return

        e.preventDefault()

        // Cancel any pending animation frame
        if (rafRef.current) {
            cancelAnimationFrame(rafRef.current)
        }

        // Use requestAnimationFrame for smooth updates
        rafRef.current = requestAnimationFrame(() => {
            const currentX = e.clientX
            const containerRect = panelRef.current?.parentElement?.getBoundingClientRect()

            if (containerRect) {
                // Calculate width based on distance from right edge of container
                const distanceFromRight = containerRect.right - currentX
                const newWidth = Math.max(300, Math.min(800, distanceFromRight))
                setPanelWidth(newWidth)
            }
        })
    }, [isResizing])

    const handleResizeEnd = useCallback(() => {
        setIsResizing(false)

        // Cancel any pending animation frame
        if (rafRef.current) {
            cancelAnimationFrame(rafRef.current)
            rafRef.current = null
        }

        document.removeEventListener('mousemove', handleResizeMove)
        document.removeEventListener('mouseup', handleResizeEnd)
        document.body.style.cursor = ''
        document.body.style.userSelect = ''
    }, [handleResizeMove])

    const handleResizeStart = useCallback((e) => {
        setIsResizing(true)

        // Prevent text selection and set cursor globally
        document.body.style.cursor = 'col-resize'
        document.body.style.userSelect = 'none'

        document.addEventListener('mousemove', handleResizeMove, { passive: false })
        document.addEventListener('mouseup', handleResizeEnd, { passive: false })
        e.preventDefault()
        e.stopPropagation()
    }, [handleResizeMove, handleResizeEnd])

    // Cleanup resize listeners, animation frames, and timeouts on unmount
    useEffect(() => {
        return () => {
            // Cancel any pending animation frame
            if (rafRef.current) {
                cancelAnimationFrame(rafRef.current)
            }

            // Cancel any pending real-time update
            if (updateTimeoutRef.current) {
                clearTimeout(updateTimeoutRef.current)
            }

            document.removeEventListener('mousemove', handleResizeMove)
            document.removeEventListener('mouseup', handleResizeEnd)

            // Reset body styles
            document.body.style.cursor = ''
            document.body.style.userSelect = ''
        }
    }, [handleResizeMove, handleResizeEnd])

    // Expose methods to parent component
    useImperativeHandle(ref, () => ({
        getCurrentConfig: () => {
            // This will be handled by the isolated form
            return widgetData?.config || {}
        },
        hasUnsavedChanges: () => hasChanges,
        resetToOriginal: () => {
            setHasChanges(false)
        }
    }), [hasChanges, widgetData])

    // Handle close - revert changes if not saved
    const handleClose = async () => {
        // Clear any pending real-time update
        if (updateTimeoutRef.current) {
            clearTimeout(updateTimeoutRef.current)
        }

        // If special editor is open, animate it closed first, then close panel
        if (showSpecialEditor) {
            setIsClosingSpecialEditor(true)
            // Wait for exit animation, then close the panel
            setTimeout(() => {
                setShowSpecialEditor(false)
                setIsClosingSpecialEditor(false)
                setIsAnimatingSpecialEditor(false)
                onClose()
            }, 500)
        } else {
            // Close immediately if special editor is not open
            onClose()
        }
    }

    // Handle refresh widget types
    const handleRefreshWidgetTypes = useCallback(async () => {
        if (!widgetData) return
        // Clear cache and re-validate
        clearWidgetTypesCache()
        setIsValidatingType(true)

        try {
            const validation = await validateWidgetType(widgetData)
            setWidgetTypeValidation(validation)

            // If the widget type is now available, try to fetch schema
            if (validation.canEdit && !schema) {
                setIsLoadingSchema(true)
                setSchemaError(null)
                // The schema fetch effect will trigger due to widgetTypeValidation change
            }
        } catch (error) {
            console.error('Error refreshing widget type:', error)
            setWidgetTypeValidation({
                isValid: false,
                error: `Failed to refresh widget type: ${error.message}`,
                canEdit: false,
                shouldHide: false
            })
        } finally {
            setIsValidatingType(false)
        }
    }, [widgetData, schema])

    if (!isOpen) return null

    return (
        <>
            {/* Backdrop overlay for mobile */}
            <div
                className={`absolute inset-0 bg-black transition-opacity duration-300 z-40 lg:hidden ${isOpen ? 'opacity-25' : 'opacity-0 pointer-events-none'
                    }`}
                onClick={handleClose}
            />

            {/* Slide-out panel - positioned to extend from header to footer */}
            <div
                ref={panelRef}
                className={`absolute top-0 right-0 bottom-0 bg-white transform transition-all duration-300 ease-in-out z-50 flex ${isOpen ? 'translate-x-0' : 'translate-x-full'
                    } ${showSpecialEditor ? 'left-0' : ''
                    }`}
                style={{
                    width: showSpecialEditor ? '100vw' : `${panelWidth}px`,
                    boxShadow: '-4px 0 6px -1px rgba(0, 0, 0, 0.1), -2px 0 4px -1px rgba(0, 0, 0, 0.06)'
                }}
            >
                {/* Resize handle - hidden in special editor mode */}
                {!showSpecialEditor && (
                    <div
                        ref={resizeRef}
                        onMouseDown={handleResizeStart}
                        className={`w-2 bg-gray-300 hover:bg-blue-400 cursor-col-resize flex-shrink-0 relative group transition-colors duration-150 ${isResizing ? 'bg-blue-500' : ''
                            }`}
                    >
                        {/* Visual indicator dots for resize handle */}
                        <div className="absolute inset-y-0 left-0 w-full flex flex-col justify-center items-center space-y-1 opacity-60 group-hover:opacity-100 transition-opacity">
                            <div className="w-0.5 h-1 bg-gray-600 rounded-full"></div>
                            <div className="w-0.5 h-1 bg-gray-600 rounded-full"></div>
                            <div className="w-0.5 h-1 bg-gray-600 rounded-full"></div>
                            <div className="w-0.5 h-1 bg-gray-600 rounded-full"></div>
                            <div className="w-0.5 h-1 bg-gray-600 rounded-full"></div>
                        </div>
                    </div>
                )}

                {/* Special Editor Area - Left Side */}
                {showSpecialEditor && (
                    <SpecialEditorRenderer
                        widgetData={widgetData}
                        specialEditorWidth={specialEditorWidth}
                        isAnimating={isAnimatingSpecialEditor}
                        isClosing={isClosingSpecialEditor}
                        namespace={namespace}
                    />
                )}

                {/* Panel content */}
                <div className={`flex-1 flex flex-col ${showSpecialEditor ? 'border-l border-gray-200' : ''}`}>
                    {/* Header */}
                    <div className={`flex items-center justify-between px-4 py-3 border-b border-gray-200 bg-gray-50 transition-all duration-300 ${showSpecialEditor && isAnimatingSpecialEditor ? 'animate-fade-in-up delay-100' : ''
                        } ${showSpecialEditor && isClosingSpecialEditor ? 'animate-fade-out-down' : ''
                        }`}>
                        <div className="flex items-center space-x-3">
                            <h3 className="text-md font-medium text-gray-900">{title}</h3>
                        </div>
                        <button
                            onClick={handleClose}
                            className="p-1 text-gray-400 hover:text-gray-600 transition-colors"
                        >
                            <X className={`w-4 h-4 transition-all duration-300 ${showSpecialEditor && isAnimatingSpecialEditor ? 'animate-bounce-in delay-200' : ''
                                }`} />
                        </button>
                    </div>

                    {/* Form content - scrollable */}
                    <div className={`flex-1 overflow-y-auto transition-all duration-500 ${showSpecialEditor && isAnimatingSpecialEditor ? 'animate-fade-in-up delay-300' : ''
                        } ${showSpecialEditor && isClosingSpecialEditor ? 'animate-fade-out-down' : ''
                        }`}>
                        {isValidatingType ? (
                            <div className="flex items-center justify-center py-8">
                                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mr-3"></div>
                                <span className="text-gray-600">Validating widget type...</span>
                            </div>
                        ) : widgetTypeValidation && !widgetTypeValidation.canEdit ? (
                            <div className="space-y-4 p-4">
                                <DeletedWidgetWarning
                                    widget={widgetData}
                                    onRefresh={handleRefreshWidgetTypes}
                                    className="mb-4"
                                />
                                <div className="text-center text-gray-500 py-8">
                                    <p>Widget editing is disabled because the widget type is not available.</p>
                                </div>
                            </div>
                        ) : isLoadingSchema ? (
                            <div className="flex items-center justify-center py-8">
                                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mr-3"></div>
                                <span className="text-gray-600">Loading widget configuration...</span>
                            </div>
                        ) : schemaError ? (
                            <div className="text-center py-8 p-4">
                                <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                                    <p className="text-red-800 font-medium">Failed to load widget configuration</p>
                                    <p className="text-red-600 text-sm mt-1">{schemaError}</p>
                                </div>
                            </div>
                        ) : widgetData ? (
                            <IsolatedFormRenderer
                                initWidgetData={widgetData}
                                initschema={fetchedSchema || schema}
                                onRealTimeUpdate={onRealTimeUpdate}
                                onUnsavedChanges={handleUnsavedChanges}
                                emitWidgetChanged={emitWidgetChanged}
                                namespace={namespace}
                                context={widgetData?.context || {
                                    widgetId: widgetData?.id,
                                    slotName: widgetData?.slotName || widgetData?.slot,
                                    mode: 'edit',
                                    contextType
                                }}
                            />
                        ) : (
                            <div className="text-center text-gray-500 py-8 p-4">
                                <p>No widget selected for editing.</p>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </>
    )
})

// Add display name for debugging
WidgetEditorPanel.displayName = 'WidgetEditorPanel'

export default WidgetEditorPanel
