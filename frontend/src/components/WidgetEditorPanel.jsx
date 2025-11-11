import React, { useState, useEffect, useRef, useCallback, forwardRef, useImperativeHandle } from 'react'
import { X, RefreshCw, Save, HelpCircle } from 'lucide-react'
import { getWidgetSchema } from '../api/widgetSchemas.js'
import { validateWidgetType, clearWidgetTypesCache } from '../utils/widgetTypeValidation.js'
import DeletedWidgetWarning from './DeletedWidgetWarning.jsx'
import { useAutoSave } from '../hooks/useAutoSave'

import { SpecialEditorRenderer, hasSpecialEditor } from './special-editors'
import IsolatedFormRenderer from './IsolatedFormRenderer.jsx'
import WidgetPublishingInheritanceFields from './WidgetPublishingInheritanceFields.jsx'
import WidgetQuickReference from './widget-help/WidgetQuickReference'


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
    widgetData,
    schema,
    title = "Edit Widget",
    autoOpenSpecialEditor = false,
    namespace = null,
    context = {},
    webpageData = null,
    pageVersionData = null
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
    const [showQuickReference, setShowQuickReference] = useState(false) // Quick Reference modal

    const panelRef = useRef(null)
    const resizeRef = useRef(null)
    const rafRef = useRef(null)
    const updateTimeoutRef = useRef(null)
    const isResizingRef = useRef(false)
    const resizeHandlersRef = useRef(null)

    // Get contextType from widget context or parent context
    const contextType = widgetData?.context?.contextType || context?.contextType

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
                        widgetData.widgetType?.name

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


    // Setup vanilla JS resize handlers (no React state, pure DOM manipulation)
    useEffect(() => {
        if (!resizeHandlersRef.current) {
            // Create handlers once and reuse them (no recreations, no React dependencies)
            const handleResizeMove = (e) => {
                if (!isResizingRef.current) return
                e.preventDefault()

                // Cancel any pending animation frame
                if (rafRef.current) {
                    cancelAnimationFrame(rafRef.current)
                }

                // Use RAF for smooth 60fps updates
                rafRef.current = requestAnimationFrame(() => {
                    const containerRect = panelRef.current?.parentElement?.getBoundingClientRect()
                    if (containerRect && panelRef.current) {
                        const distanceFromRight = containerRect.right - e.clientX
                        const newWidth = Math.max(300, Math.min(800, distanceFromRight))

                        // Direct DOM manipulation - zero React involvement
                        panelRef.current.style.width = `${newWidth}px`
                    }
                })
            }

            const handleResizeEnd = () => {
                isResizingRef.current = false

                // Cancel any pending RAF
                if (rafRef.current) {
                    cancelAnimationFrame(rafRef.current)
                    rafRef.current = null
                }

                // Re-enable transitions
                if (panelRef.current) {
                    panelRef.current.style.transition = ''
                    // Update React state with final width (optional - only for persistence)
                    const finalWidth = parseInt(panelRef.current.style.width, 10)
                    if (!isNaN(finalWidth)) {
                        setPanelWidth(finalWidth)
                    }
                }

                // Visual feedback - update state to change handle color
                setIsResizing(false)

                // Cleanup
                document.removeEventListener('mousemove', handleResizeMove)
                document.removeEventListener('mouseup', handleResizeEnd)
                document.body.style.cursor = ''
                document.body.style.userSelect = ''
            }

            const handleResizeStart = (e) => {
                isResizingRef.current = true

                // Read current actual width from DOM to prevent jumping
                if (panelRef.current) {
                    const currentWidth = panelRef.current.getBoundingClientRect().width
                    panelRef.current.style.width = `${currentWidth}px`

                    // Disable transitions during resize for instant feedback
                    panelRef.current.style.transition = 'none'
                }

                // Visual feedback - update state to change handle color
                setIsResizing(true)

                // Prevent text selection and set cursor globally
                document.body.style.cursor = 'col-resize'
                document.body.style.userSelect = 'none'

                document.addEventListener('mousemove', handleResizeMove, { passive: false })
                document.addEventListener('mouseup', handleResizeEnd, { passive: false })
                e.preventDefault()
                e.stopPropagation()
            }

            // Store handlers in ref so they're stable across renders
            resizeHandlersRef.current = {
                handleResizeMove,
                handleResizeEnd,
                handleResizeStart
            }
        }

        return () => {
            // Cleanup on unmount
            if (resizeHandlersRef.current) {
                document.removeEventListener('mousemove', resizeHandlersRef.current.handleResizeMove)
                document.removeEventListener('mouseup', resizeHandlersRef.current.handleResizeEnd)
                document.body.style.cursor = ''
                document.body.style.userSelect = ''
            }
            if (rafRef.current) {
                cancelAnimationFrame(rafRef.current)
            }
        }
    }, []) // Empty deps - handlers created once and never recreated

    // Set initial width when panel opens
    useEffect(() => {
        if (isOpen && panelRef.current) {
            if (showSpecialEditor) {
                panelRef.current.style.width = '100vw'
            } else {
                // Set to saved width or default
                panelRef.current.style.width = `${panelWidth}px`
            }
        }
    }, [isOpen, showSpecialEditor, panelWidth])

    // Cleanup timeouts on unmount
    useEffect(() => {
        return () => {
            if (updateTimeoutRef.current) {
                clearTimeout(updateTimeoutRef.current)
            }
        }
    }, [])

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
                className={`absolute inset-0 bg-black transition-opacity duration-300 lg:hidden ${isOpen ? 'opacity-25' : 'opacity-0 pointer-events-none'
                    }`}
                style={{ zIndex: 9999 }}
                onClick={handleClose}
            />

            {/* Slide-out panel - positioned to extend from header to footer */}
            <div
                ref={panelRef}
                className={`absolute top-0 right-0 bottom-0 bg-white transform transition-all duration-300 ease-in-out flex ${isOpen ? 'translate-x-0' : 'translate-x-full'
                    } ${showSpecialEditor ? 'left-0' : ''
                    }`}
                style={{
                    // Width controlled purely via DOM manipulation (see useEffect below)
                    boxShadow: '-4px 0 6px -1px rgba(0, 0, 0, 0.1), -2px 0 4px -1px rgba(0, 0, 0, 0.06)',
                    zIndex: 10000
                }}
            >
                {/* Resize handle - hidden in special editor mode */}
                {!showSpecialEditor && (
                    <div
                        ref={resizeRef}
                        onMouseDown={resizeHandlersRef.current?.handleResizeStart}
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
                        contextType={contextType}
                        widgetId={widgetData?.id}
                        slotName={widgetData?.slotName || widgetData?.slot}
                        context={{
                            pageId: context?.pageId || webpageData?.id,
                            versionId: context?.versionId || pageVersionData?.versionId,
                            webpageData: context?.webpageData || webpageData,
                            pageVersionData: context?.pageVersionData || pageVersionData,
                            contextType
                        }}
                    />
                )}

                {/* Panel content */}
                <div className={`flex-1 flex flex-col min-w-0 ${showSpecialEditor ? 'border-l border-gray-200' : ''}`}>
                    {/* Header */}
                    <div className={`flex items-center justify-between gap-2 px-4 py-3 border-b border-gray-200 bg-gray-50 transition-all duration-300 min-w-0 ${showSpecialEditor && isAnimatingSpecialEditor ? 'animate-fade-in-up delay-100' : ''
                        } ${showSpecialEditor && isClosingSpecialEditor ? 'animate-fade-out-down' : ''
                        }`}>
                        <div className="flex items-center space-x-3 min-w-0 flex-1">
                            <h3 className="text-md font-medium text-gray-900 truncate">{title}</h3>
                            {hasChanges && (
                                <span className="flex items-center text-xs text-blue-600 flex-shrink-0">
                                    <Save className="w-3 h-3 mr-1" />
                                    Changes will auto-save
                                </span>
                            )}
                        </div>
                        <div className="flex items-center gap-2 flex-shrink-0">
                            {/* Help Button */}
                            {widgetData?.type && (
                                <button
                                    onClick={() => setShowQuickReference(true)}
                                    className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors"
                                    title="Quick Reference & Examples"
                                >
                                    <HelpCircle className="w-4 h-4" />
                                </button>
                            )}
                            <button
                                onClick={handleClose}
                                className="p-1 text-gray-400 hover:text-gray-600 transition-colors"
                            >
                                <X className={`w-4 h-4 transition-all duration-300 ${showSpecialEditor && isAnimatingSpecialEditor ? 'animate-bounce-in delay-200' : ''
                                    }`} />
                            </button>
                        </div>
                    </div>

                    {/* Form content - scrollable */}
                    <div className={`flex-1 overflow-y-auto overflow-x-hidden min-w-0 transition-all duration-500 ${showSpecialEditor && isAnimatingSpecialEditor ? 'animate-fade-in-up delay-300' : ''
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
                            <>
                                <IsolatedFormRenderer
                                    initWidgetData={widgetData}
                                    initschema={fetchedSchema || schema}
                                    namespace={namespace}
                                    contextType={contextType}
                                    widgetId={widgetData?.id}
                                    slotName={widgetData?.slotName || widgetData?.slot}
                                    context={{
                                        ...(widgetData?.context || {}),
                                        widgetId: widgetData?.id,
                                        slotName: widgetData?.slotName || widgetData?.slot,
                                        mode: 'edit',
                                        contextType,
                                        pageId: context?.pageId || webpageData?.id,
                                        versionId: context?.versionId || pageVersionData?.versionId,
                                        webpageData: context?.webpageData || webpageData,
                                        pageVersionData: context?.pageVersionData || pageVersionData,
                                        theme: pageVersionData?.effectiveTheme
                                    }}
                                />
                                <WidgetPublishingInheritanceFields
                                    widgetData={widgetData}
                                    widgetType={widgetTypeValidation}
                                    contextType={context?.contextType}
                                    componentId={`widget-editor-${widgetData?.id}`}
                                />
                            </>
                        ) : (
                            <div className="text-center text-gray-500 py-8 p-4">
                                <p>No widget selected for editing.</p>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* Quick Reference Modal */}
            <WidgetQuickReference
                widgetType={widgetData?.type}
                isOpen={showQuickReference}
                onClose={() => setShowQuickReference(false)}
            />
        </>
    )
})

// Add display name for debugging
WidgetEditorPanel.displayName = 'WidgetEditorPanel'

export default WidgetEditorPanel
