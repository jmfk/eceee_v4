/**
 * Self-Contained Object Editor
 * 
 * React wrapper component for the SelfContainedObjectForm vanilla JS class.
 * Provides a React-compatible interface while using the performant vanilla JS form internally.
 * 
 * Based on the proven SelfContainedWidgetEditor pattern used in PageEditor.
 */

import React, { useRef, useEffect, useState, useCallback, forwardRef, useImperativeHandle } from 'react'
import { SelfContainedObjectForm } from './SelfContainedObjectForm.js'
import { useObjectOperations } from '../../contexts/unified-data/hooks/useObjectOperations'

/**
 * Self-Contained Object Editor Component
 * 
 * Features:
 * - Uses vanilla JS form internally for zero rerenders
 * - Real-time server synchronization
 * - Automatic validation with visual feedback
 * - Self-contained state management
 * - Compatible with existing React architecture
 */
const SelfContainedObjectEditor = forwardRef(({
    objectData,
    onFieldChange,
    onWidgetChange,
    onValidationChange,
    onSave,
    onError,
    showValidationInline = true,
    showSaveStatus = true
}, ref) => {
    // Refs for form instance
    const formInstanceRef = useRef(null)
    const registryUnsubscribeRef = useRef(null)
    const isInitializingRef = useRef(false)

    // React state for validation feedback only
    const [isValid, setIsValid] = useState(true)
    const [validationErrors, setValidationErrors] = useState({})

    // Get write-only UnifiedDataContext operations
    const unifiedDataOperations = useObjectOperations(objectData?.id)

    // Initialize form instance
    const initializeForm = useCallback(async () => {
        if (!objectData || isInitializingRef.current || formInstanceRef.current) return

        isInitializingRef.current = true

        try {
            // Create form instance with UnifiedDataContext operations
            const formInstance = new SelfContainedObjectForm(objectData, {
                showValidationInline,
                showSaveStatus,
                unifiedDataOperations // Pass write-only operations
            })

            // Initialize the form
            await formInstance.initialize()

            formInstanceRef.current = formInstance

            // Set up event listeners
            setupRegistryEventListeners(formInstance)

        } catch (error) {
            console.error('SelfContainedObjectEditor: Failed to initialize form:', error)
            if (onError) {
                onError(error)
            }
        } finally {
            isInitializingRef.current = false
        }
    }, [objectData, showValidationInline, showSaveStatus, unifiedDataOperations, onError])

    // Cleanup form instance
    const cleanupForm = useCallback(() => {
        if (formInstanceRef.current) {
            formInstanceRef.current.destroy()
            formInstanceRef.current = null
        }

        if (registryUnsubscribeRef.current) {
            registryUnsubscribeRef.current()
            registryUnsubscribeRef.current = null
        }
    }, [])

    // Setup event listeners for registry events
    const setupRegistryEventListeners = useCallback((form) => {
        if (!window.objectFormRegistry) return

        const unsubscribers = []

        // Listen for field changes
        const fieldChangeUnsubscribe = window.objectFormRegistry.subscribe('FIELD_CHANGE', (event) => {
            if (event.objectId === objectData?.id) {
                // Notify parent of field changes
                if (onFieldChange) {
                    onFieldChange(event.fieldName, event.value, event.currentData)
                }
            }
        })
        unsubscribers.push(fieldChangeUnsubscribe)

        // Listen for widget slot changes
        const widgetChangeUnsubscribe = window.objectFormRegistry.subscribe('WIDGET_SLOT_CHANGE', (event) => {
            if (event.objectId === objectData?.id) {
                // Notify parent of widget changes
                if (onWidgetChange) {
                    onWidgetChange(event.slotName, event.widgets, event.currentData)
                }
            }
        })
        unsubscribers.push(widgetChangeUnsubscribe)

        // Dirty state is handled by UnifiedDataContext - no need for local state or callbacks

        // Listen for validation changes
        const validationUnsubscribe = window.objectFormRegistry.subscribe('VALIDATION_COMPLETE', (event) => {
            if (event.objectId === objectData?.id) {
                setIsValid(event.isValid)
                setValidationErrors(event.errors)
                if (onValidationChange) {
                    onValidationChange(event.isValid, event.errors)
                }
            }
        })
        unsubscribers.push(validationUnsubscribe)

        // Listen for save events (only for parent notification)
        const savedUnsubscribe = window.objectFormRegistry.subscribe('SAVED_TO_SERVER', (event) => {
            if (event.objectId === objectData?.id && onSave) {
                onSave(event.savedData)
            }
        })
        unsubscribers.push(savedUnsubscribe)

        // Listen for errors
        const errorUnsubscribe = window.objectFormRegistry.subscribe('SAVE_ERROR', (event) => {
            if (event.objectId === objectData?.id) {
                if (onError) {
                    onError(new Error(event.error))
                }
            }
        })
        unsubscribers.push(errorUnsubscribe)

        // Store cleanup function
        registryUnsubscribeRef.current = () => {
            unsubscribers.forEach(unsub => unsub())
        }
    }, [objectData?.id, onFieldChange, onWidgetChange, onValidationChange, onSave, onError])

    // Initialize form when objectData changes
    useEffect(() => {
        if (objectData) {
            initializeForm()
        }

        return () => {
            cleanupForm()
        }
    }, [objectData, initializeForm, cleanupForm])

    // Cleanup on unmount
    useEffect(() => {
        return () => {
            cleanupForm()
        }
    }, [cleanupForm])

    // Expose methods to parent component
    useImperativeHandle(ref, () => ({
        // Form data access
        getCurrentData: () => {
            return formInstanceRef.current?.getCurrentData() || null
        },
        getValidationResults: () => {
            return formInstanceRef.current?.getValidationResults() || {}
        },

        // Form state
        isDirty: () => {
            return formInstanceRef.current?.isDirty || false
        },
        hasUnsavedChanges: () => {
            return formInstanceRef.current?.hasUnsavedChanges || false
        },
        isValid: () => {
            return formInstanceRef.current?.isValid || true
        },

        // Form operations
        updateField: (fieldName, value, options = {}) => {
            formInstanceRef.current?.updateField(fieldName, value, options)
        },
        updateWidgetSlot: (slotName, widgets, options = {}) => {
            formInstanceRef.current?.updateWidgetSlot(slotName, widgets, options)
        },
        save: async () => {
            if (formInstanceRef.current) {
                return await formInstanceRef.current.save()
            }
            return { success: false, message: 'Form not initialized' }
        },
        reset: () => {
            formInstanceRef.current?.reset()
        },

        // Validation
        validateAllFields: async () => {
            if (formInstanceRef.current) {
                await formInstanceRef.current.validateAllFields()
            }
        },

        // Form instance access (for advanced usage)
        getFormInstance: () => {
            return formInstanceRef.current
        }
    }), [])

    // This component doesn't render any UI - it's just a controller
    // The actual form rendering is handled by the parent component using callbacks
    return null
})

SelfContainedObjectEditor.displayName = 'SelfContainedObjectEditor'

export default SelfContainedObjectEditor
