/**
 * Self-Contained Widget Editor
 * 
 * React wrapper component for the SelfContainedWidgetForm vanilla JS class.
 * Provides a React-compatible interface while using the performant vanilla JS form internally.
 */

import React, { useRef, useEffect, useState, useCallback, forwardRef, useImperativeHandle } from 'react'
import { X, Save, RotateCcw, RefreshCw } from 'lucide-react'
import { SelfContainedWidgetForm } from './SelfContainedWidgetForm.js'
import { useUnifiedData } from '../../contexts/unified-data/context/UnifiedDataContext'
import '../../styles/self-contained-form.css'

/**
 * Self-Contained Widget Editor Panel
 * 
 * Features:
 * - Uses vanilla JS form internally for zero rerenders
 * - Real-time server synchronization
 * - Automatic validation with visual feedback
 * - Self-contained state management
 * - Compatible with existing React architecture
 */
const SelfContainedWidgetEditor = forwardRef(({
    isOpen,
    onClose,
    onSave,
    onRealTimeUpdate,
    onUnsavedChanges,
    widgetData,
    title = "Edit Widget",
    autoSave = true,
    showValidationInline = true,
    showSaveStatus = true,
    panelWidth = 400
}, ref) => {
    // Refs for DOM and form instance
    const containerRef = useRef(null)
    const formInstanceRef = useRef(null)
    const panelRef = useRef(null)

    // React state for panel UI (minimal state)
    const [isLoading, setIsLoading] = useState(false)
    const [error, setError] = useState(null)
    const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false)
    const [isResizing, setIsResizing] = useState(false)
    const [currentPanelWidth, setCurrentPanelWidth] = useState(panelWidth)

    // Update lock for preventing feedback loops
    const { useExternalChanges } = useUnifiedData()

    // Registry event subscription cleanup
    const registryUnsubscribeRef = useRef(null)

    // Initialize form when panel opens
    useEffect(() => {
        if (isOpen && widgetData && containerRef.current && !formInstanceRef.current) {
            // Use setTimeout to ensure DOM is ready
            setTimeout(() => {
                initializeForm()
            }, 100)
        }

        return () => {
            // Cleanup when closing or unmounting
            if (formInstanceRef.current) {
                try {
                    formInstanceRef.current.destroy()
                } catch (error) {
                    console.warn('Error destroying form instance:', error)
                }
                formInstanceRef.current = null
            }

            if (registryUnsubscribeRef.current) {
                try {
                    registryUnsubscribeRef.current()
                } catch (error) {
                    console.warn('Error unsubscribing from registry:', error)
                }
                registryUnsubscribeRef.current = null
            }
        }
    }, [isOpen, widgetData])

    // Initialize the vanilla JS form
    const initializeForm = async () => {
        if (!widgetData || !containerRef.current) return

        setIsLoading(true)
        setError(null)

        try {
            // Create form instance
            const formOptions = {
                autoSave,
                showValidationInline,
                showSaveStatus,
                registry: window.widgetRegistry
            }

            const form = new SelfContainedWidgetForm(widgetData, formOptions)

            // Initialize the form
            const success = await form.initialize(containerRef.current)

            if (success) {
                formInstanceRef.current = form

                // Subscribe to registry events for this widget
                setupRegistryEventListeners(form)

                setIsLoading(false)
            } else {
                throw new Error('Form initialization failed')
            }

        } catch (err) {
            console.error('Failed to initialize self-contained widget form:', err)
            setError(err.message)
            setIsLoading(false)
        }
    }

    // Setup event listeners for registry events
    const setupRegistryEventListeners = (form) => {
        if (!window.widgetRegistry) return

        const unsubscribers = []

        // Listen for config changes
        const configChangeUnsubscribe = window.widgetRegistry.subscribe('CONFIG_CHANGE', async (event) => {
            if (event.widgetId === widgetData.id) {
                // Update form instance if it's not the source of the change
                if (!formInstanceRef.current.isUpdateLocked()) {
                    formInstanceRef.current.updateConfig(event.config);
                }

                // Notify parent of real-time updates
                if (onRealTimeUpdate) {
                    onRealTimeUpdate({
                        ...widgetData,
                        config: event.config
                    });
                }
            }
        })
        unsubscribers.push(configChangeUnsubscribe)

        // Listen for dirty state changes
        const dirtyStateUnsubscribe = window.widgetRegistry.subscribe('DIRTY_STATE_CHANGED', (event) => {
            if (event.widgetId === widgetData.id) {
                setHasUnsavedChanges(event.isDirty)
                if (onUnsavedChanges) {
                    onUnsavedChanges(event.isDirty)
                }
            }
        })
        unsubscribers.push(dirtyStateUnsubscribe)

        // Listen for save events
        const savedUnsubscribe = window.widgetRegistry.subscribe('SAVED_TO_SERVER', (event) => {
            if (event.widgetId === widgetData.id) {
                setHasUnsavedChanges(false)
                if (onUnsavedChanges) {
                    onUnsavedChanges(false)
                }
            }
        })
        unsubscribers.push(savedUnsubscribe)

        // Store cleanup function
        registryUnsubscribeRef.current = () => {
            unsubscribers.forEach(unsub => unsub())
        }
    }

    // Handle manual save
    const handleSave = useCallback(async () => {
        if (!formInstanceRef.current) return

        try {
            await formInstanceRef.current.save()

            // Get current state and notify parent
            const state = formInstanceRef.current.getState()
            if (onSave) {
                onSave({
                    ...widgetData,
                    config: state.currentConfig
                })
            }

            // Close panel after successful save
            onClose()

        } catch (error) {
            console.error('Failed to save widget:', error)
            // Error is already shown by the form instance
        }
    }, [widgetData, onSave, onClose])

    // Handle reset
    const handleReset = useCallback(() => {
        if (!formInstanceRef.current) return

        formInstanceRef.current.reset()
        setHasUnsavedChanges(false)

        if (onUnsavedChanges) {
            onUnsavedChanges(false)
        }
    }, [onUnsavedChanges])

    // Handle close
    const handleClose = useCallback(() => {
        // Cleanup form instance
        if (formInstanceRef.current) {
            formInstanceRef.current.destroy()
            formInstanceRef.current = null
        }

        // Cleanup registry subscriptions
        if (registryUnsubscribeRef.current) {
            registryUnsubscribeRef.current()
            registryUnsubscribeRef.current = null
        }

        onClose()
    }, [onClose])

    // Expose methods to parent component
    useImperativeHandle(ref, () => ({
        getCurrentConfig: () => {
            return formInstanceRef.current?.getState()?.currentConfig || {}
        },
        hasUnsavedChanges: () => {
            return formInstanceRef.current?.getState()?.hasUnsavedChanges || false
        },
        resetToOriginal: () => {
            handleReset()
        },
        save: () => {
            return handleSave()
        },
        getFormInstance: () => {
            return formInstanceRef.current
        }
    }), [handleReset, handleSave])

    // Resize handlers (keeping existing resize functionality)
    const handleResizeStart = useCallback((e) => {
        setIsResizing(true)
        document.body.style.cursor = 'col-resize'
        document.body.style.userSelect = 'none'

        const handleMouseMove = (e) => {
            const containerRect = panelRef.current?.parentElement?.getBoundingClientRect()
            if (containerRect) {
                const distanceFromRight = containerRect.right - e.clientX
                const newWidth = Math.max(300, Math.min(800, distanceFromRight))
                setCurrentPanelWidth(newWidth)
            }
        }

        const handleMouseUp = () => {
            setIsResizing(false)
            document.body.style.cursor = ''
            document.body.style.userSelect = ''
            document.removeEventListener('mousemove', handleMouseMove)
            document.removeEventListener('mouseup', handleMouseUp)
        }

        document.addEventListener('mousemove', handleMouseMove)
        document.addEventListener('mouseup', handleMouseUp)

        e.preventDefault()
    }, [])

    if (!isOpen) return null

    return (
        <>
            {/* Backdrop overlay for mobile */}
            <div
                className={`absolute inset-0 bg-black transition-opacity duration-300 z-40 lg:hidden ${isOpen ? 'opacity-25' : 'opacity-0 pointer-events-none'
                    }`}
                onClick={handleClose}
            />

            {/* Slide-out panel */}
            <div
                ref={panelRef}
                className={`absolute top-0 right-0 bottom-0 bg-white transform transition-all duration-300 ease-in-out z-50 flex ${isOpen ? 'translate-x-0' : 'translate-x-full'
                    }`}
                style={{
                    width: `${currentPanelWidth}px`,
                    boxShadow: '-4px 0 6px -1px rgba(0, 0, 0, 0.1), -2px 0 4px -1px rgba(0, 0, 0, 0.06)'
                }}
            >
                {/* Resize handle */}
                <div
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

                {/* Panel content */}
                <div className="flex-1 flex flex-col">
                    {/* Header */}
                    <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 bg-gray-50">
                        <div className="flex items-center space-x-3">
                            <h3 className="text-md font-medium text-gray-900">{title}</h3>
                            {hasUnsavedChanges && (
                                <span className="text-xs text-yellow-600 bg-yellow-100 px-2 py-1 rounded">
                                    Unsaved changes
                                </span>
                            )}
                        </div>
                        <div className="flex items-center space-x-2">
                            {/* Reset button */}
                            {hasUnsavedChanges && (
                                <button
                                    onClick={handleReset}
                                    className="p-1 text-gray-400 hover:text-gray-600 transition-colors"
                                    title="Reset to original"
                                >
                                    <RotateCcw className="w-4 h-4" />
                                </button>
                            )}

                            {/* Manual save button (when auto-save is disabled) */}
                            {!autoSave && (
                                <button
                                    onClick={handleSave}
                                    disabled={!hasUnsavedChanges}
                                    className="p-1 text-gray-400 hover:text-gray-600 transition-colors disabled:opacity-50"
                                    title="Save changes"
                                >
                                    <Save className="w-4 h-4" />
                                </button>
                            )}

                            {/* Close button */}
                            <button
                                onClick={handleClose}
                                className="p-1 text-gray-400 hover:text-gray-600 transition-colors"
                            >
                                <X className="w-4 h-4" />
                            </button>
                        </div>
                    </div>

                    {/* Form content - scrollable */}
                    <div className="flex-1 overflow-y-auto">
                        {isLoading ? (
                            <div className="flex items-center justify-center py-8">
                                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mr-3"></div>
                                <span className="text-gray-600">Loading widget form...</span>
                            </div>
                        ) : error ? (
                            <div className="p-4">
                                <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                                    <p className="text-red-800 font-medium">Failed to load widget form</p>
                                    <p className="text-red-600 text-sm mt-1">{error}</p>
                                    <button
                                        onClick={() => {
                                            setError(null)
                                            setTimeout(() => initializeForm(), 100)
                                        }}
                                        className="mt-2 text-sm text-red-600 hover:text-red-800 underline"
                                    >
                                        Try again
                                    </button>
                                </div>
                            </div>
                        ) : (
                            // Container for the vanilla JS form
                            <div
                                ref={containerRef}
                                className="self-contained-form-container"
                            />
                        )}
                    </div>
                </div>
            </div>
        </>
    )
})

SelfContainedWidgetEditor.displayName = 'SelfContainedWidgetEditor'

export default SelfContainedWidgetEditor
