import React, { useState, useEffect, useRef, useCallback, forwardRef, useImperativeHandle } from 'react'
import { X, Save, RotateCcw, RefreshCw } from 'lucide-react'
import ValidatedInput from './validation/ValidatedInput.jsx'
import { getWidgetSchema, validateWidgetConfiguration } from '../api/widgetSchemas.js'
import { widgetsApi } from '../api'
import { validateWidgetType, clearWidgetTypesCache } from '../utils/widgetTypeValidation.js'
import DeletedWidgetWarning from './DeletedWidgetWarning.jsx'
import { useWidgetEventEmitter } from '../contexts/WidgetEventContext'
import { WIDGET_CHANGE_TYPES } from '../types/widgetEvents'
import { SpecialEditorRenderer, hasSpecialEditor } from './special-editors'

/**
 * WidgetEditorPanel - Slide-out panel for editing widgets
 * 
 * Features:
 * - Slides out from the right side with animation
 * - Contains widget editing form
 * - Scrollable content area
 * - Resizable with drag handle
 * - Save/Cancel actions
 */
const WidgetEditorPanel = forwardRef(({
    isOpen,
    onClose,
    onSave,
    onRealTimeUpdate,
    onUnsavedChanges,
    onValidatedWidgetSync,
    widgetData,
    schema,
    title = "Edit Widget",
    autoOpenSpecialEditor = false
}, ref) => {
    const [config, setConfig] = useState({})
    const [originalConfig, setOriginalConfig] = useState({})
    const [hasChanges, setHasChanges] = useState(false)
    const [validationResults, setValidationResults] = useState({})
    const [isValidating, setIsValidating] = useState(false)
    const [isWidgetValid, setIsWidgetValid] = useState(true)
    const [showValidationWarning, setShowValidationWarning] = useState(false)
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
    const validationTimeoutRef = useRef(null)

    // Event system for widget communication (with fallback)
    let emitWidgetChanged = null, emitWidgetValidated = null, emitWidgetSaved = null
    try {
        const eventEmitter = useWidgetEventEmitter()
        emitWidgetChanged = eventEmitter.emitWidgetChanged
        emitWidgetValidated = eventEmitter.emitWidgetValidated
        emitWidgetSaved = eventEmitter.emitWidgetSaved
    } catch (error) {
        // Fallback when context is not available
        console.warn('WidgetEventContext not available in WidgetEditorPanel, using callback-only mode')
    }

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


    // Initialize config when widget data changes
    useEffect(() => {
        if (widgetData?.config) {
            const initialConfig = { ...widgetData.config }
            setConfig(initialConfig)
            setOriginalConfig(initialConfig)
            setHasChanges(false)
        }
        // Reset special editor state when switching to a different widget
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

    // Fetch schema from backend when widget type changes (only if widget type is valid)
    useEffect(() => {
        if (widgetData && !schema && widgetTypeValidation?.canEdit !== false) {
            setIsLoadingSchema(true)
            setSchemaError(null)

            const fetchSchemaForWidget = async () => {
                try {
                    // First, try to use the widget name directly if available
                    let resolvedWidgetTypeName = widgetData.name ||
                        widgetData.widgetType?.name ||
                        widgetData.widget_type?.name

                    // If we don't have a name, we need to look it up from the widget type registry
                    if (!resolvedWidgetTypeName && widgetData.type) {
                        // Fetch all widget types to find the name for this type
                        const allWidgetTypes = await widgetsApi.getTypes()
                        const matchingWidget = allWidgetTypes.find(w => w.type === widgetData.type)

                        if (matchingWidget) {
                            resolvedWidgetTypeName = matchingWidget.name
                        } else {
                            throw new Error(`Widget type "${widgetData.type}" not found in registry`)
                        }
                    }

                    if (resolvedWidgetTypeName) {
                        setWidgetTypeName(resolvedWidgetTypeName)

                        // Use the widget type (new format) instead of slug for API calls
                        let widgetTypeToUse = widgetData.type

                        // If we don't have the type, find it from the name
                        if (!widgetTypeToUse) {
                            const allWidgetTypes = await widgetsApi.getTypes()
                            const widgetWithType = allWidgetTypes.find(w => w.name === resolvedWidgetTypeName)
                            widgetTypeToUse = widgetWithType?.type || widgetWithType?.slug || resolvedWidgetTypeName.toLowerCase().replace(/\s+/g, '-')
                        }

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

    // Simple widget validation function using dedicated API
    const validateWidget = useCallback(async (configToValidate) => {
        if (!widgetTypeSlug) return

        // Clear any pending validation
        if (validationTimeoutRef.current) {
            clearTimeout(validationTimeoutRef.current)
        }

        // Debounce validation calls
        validationTimeoutRef.current = setTimeout(async () => {
            setIsValidating(true)


            try {
                const result = await validateWidgetConfiguration(widgetTypeSlug, configToValidate)

                // Convert API response to format expected by ValidatedInput
                const formattedResults = {}
                let hasValidationErrors = false

                if (result.errors) {
                    Object.entries(result.errors).forEach(([field, messages]) => {
                        formattedResults[field] = {
                            isValid: false,
                            errors: Array.isArray(messages) ? messages : [messages],
                            warnings: result.warnings?.[field] || []
                        }
                        hasValidationErrors = true
                    })
                }

                setValidationResults(formattedResults)
                const isValid = (result.is_valid || result.isValid) && !hasValidationErrors
                setIsWidgetValid(isValid)
                setIsValidating(false)

                // Emit validation event (no prop drilling!)
                if (widgetData && emitWidgetValidated) {
                    emitWidgetValidated(widgetData.id, widgetData.slotName, {
                        isValid,
                        errors: formattedResults,
                        warnings: result.warnings || {}
                    })
                }

                // Keep backward compatibility
                if (isValid && onValidatedWidgetSync && widgetData) {
                    onValidatedWidgetSync({
                        ...widgetData,
                        config: configToValidate
                    })
                }
            } catch (error) {
                console.error('Widget validation failed:', error)
                setIsValidating(false)
            }
        }, 300) // 300ms debounce
    }, [widgetTypeSlug, onValidatedWidgetSync, widgetData])

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

            // Cancel any pending validation
            if (validationTimeoutRef.current) {
                clearTimeout(validationTimeoutRef.current)
            }

            document.removeEventListener('mousemove', handleResizeMove)
            document.removeEventListener('mouseup', handleResizeEnd)

            // Reset body styles
            document.body.style.cursor = ''
            document.body.style.userSelect = ''
        }
    }, [handleResizeMove, handleResizeEnd])

    // Enhanced real-time update function with event emission
    const triggerRealTimeUpdate = useCallback((newConfig) => {
        if (!widgetData) return

        // Clear any pending update
        if (updateTimeoutRef.current) {
            clearTimeout(updateTimeoutRef.current)
        }

        // Debounce updates to prevent too many calls
        updateTimeoutRef.current = setTimeout(() => {
            const updatedWidget = {
                ...widgetData,
                config: newConfig
            }

            // Emit event for real-time updates (no prop drilling!)
            if (emitWidgetChanged) {
                emitWidgetChanged(
                    widgetData.id,
                    widgetData.slotName,
                    updatedWidget,
                    WIDGET_CHANGE_TYPES.CONFIG
                )
            }

            // Fallback for components not yet using event system
            if (onRealTimeUpdate && !emitWidgetChanged) {
                onRealTimeUpdate(updatedWidget)
            }
        }, 300) // 300ms debounce
    }, [widgetData, emitWidgetChanged, onRealTimeUpdate])

    // Handle form field changes with real-time updates and validation
    const handleFieldChange = useCallback((fieldName, value) => {
        const newConfig = {
            ...config,
            [fieldName]: value
        }

        setConfig(newConfig)

        // Check if we have changes compared to original
        const hasActualChanges = JSON.stringify(newConfig) !== JSON.stringify(originalConfig)
        setHasChanges(hasActualChanges)

        // Notify parent about unsaved changes state
        if (onUnsavedChanges) {
            onUnsavedChanges(hasActualChanges)
        }

        // Trigger widget validation using dedicated API
        validateWidget(newConfig)

        // Trigger real-time preview update
        triggerRealTimeUpdate(newConfig)
    }, [config, originalConfig, triggerRealTimeUpdate, validateWidget])

    // Handle config changes from special editor
    const handleSpecialEditorConfigChange = useCallback((newConfig) => {
        setConfig(newConfig)

        // Check if we have changes compared to original
        const hasActualChanges = JSON.stringify(newConfig) !== JSON.stringify(originalConfig)
        setHasChanges(hasActualChanges)

        // Notify parent about unsaved changes state
        if (onUnsavedChanges) {
            onUnsavedChanges(hasActualChanges)
        }

        // Trigger real-time preview update
        triggerRealTimeUpdate(newConfig)
    }, [originalConfig, triggerRealTimeUpdate, onUnsavedChanges])

    // Handle close - revert changes if not saved
    const handleClose = () => {
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

    // Generate form fields from schema using ValidatedInput
    const renderFormField = (fieldName, fieldSchema) => {
        const activeSchema = fetchedSchema || schema
        const value = config[fieldName] || ''
        const fieldType = fieldSchema.type || 'string'
        const fieldTitle = fieldSchema.title || fieldName
        const fieldDescription = fieldSchema.description
        // Determine if field should show as required in UI
        // Don't show as required if it's a string field that allows empty values (no min_length constraint)
        const isSchemaRequired = activeSchema?.required?.includes(fieldName) || false
        const isStringField = fieldType === 'string'
        const hasMinLength = fieldSchema.minLength > 0 || fieldSchema.min_length > 0
        const isRequired = isSchemaRequired && (!isStringField || hasMinLength)
        const validation = validationResults[fieldName]
        const fieldIsValidating = isValidating // Use global validation state

        const handleChange = (e) => {
            const newValue = e.target.value
            handleFieldChange(fieldName, newValue)
        }

        switch (fieldType) {
            case 'string':
                if (fieldSchema.format === 'textarea') {
                    return (
                        <ValidatedInput
                            key={fieldName}
                            type="textarea"
                            value={value}
                            onChange={handleChange}
                            label={fieldTitle}
                            description={fieldDescription}
                            placeholder={fieldSchema.placeholder || ''}
                            required={isRequired}
                            validation={validation}
                            isValidating={fieldIsValidating}
                            rows={3}
                        />
                    )
                }
                return (
                    <ValidatedInput
                        key={fieldName}
                        type="text"
                        value={value}
                        onChange={handleChange}
                        label={fieldTitle}
                        description={fieldDescription}
                        placeholder={fieldSchema.placeholder || ''}
                        required={isRequired}
                        validation={validation}
                        isValidating={isValidating}
                    />
                )

            case 'boolean':
                return (
                    <div key={fieldName} className="space-y-2">
                        <div className="flex items-start">
                            <div className="flex items-center h-5">
                                <input
                                    type="checkbox"
                                    checked={Boolean(value)}
                                    onChange={(e) => handleFieldChange(fieldName, e.target.checked)}
                                    className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                                />
                            </div>
                            <div className="ml-3">
                                <label className="text-sm font-medium text-gray-700">
                                    {fieldTitle}
                                </label>
                                {fieldDescription && (
                                    <p className="text-xs text-gray-500 mt-1">{fieldDescription}</p>
                                )}
                            </div>
                        </div>
                    </div>
                )

            case 'number':
                return (
                    <ValidatedInput
                        key={fieldName}
                        type="number"
                        value={value}
                        onChange={(e) => handleFieldChange(fieldName, parseFloat(e.target.value) || 0)}
                        label={fieldTitle}
                        description={fieldDescription}
                        placeholder={fieldSchema.placeholder || ''}
                        required={isRequired}
                        validation={validation}
                        isValidating={isValidating}
                        min={fieldSchema.minimum}
                        max={fieldSchema.maximum}
                    />
                )

            case 'array':
                if (fieldSchema.items?.enum) {
                    // Multi-select dropdown
                    return (
                        <div key={fieldName} className="space-y-2">
                            <label className="block text-sm font-medium text-gray-700">
                                {fieldTitle}
                            </label>
                            {fieldDescription && (
                                <p className="text-xs text-gray-500">{fieldDescription}</p>
                            )}
                            <select
                                multiple
                                value={Array.isArray(value) ? value : []}
                                onChange={(e) => {
                                    const selectedValues = Array.from(e.target.selectedOptions, option => option.value)
                                    handleFieldChange(fieldName, selectedValues)
                                }}
                                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                                size={Math.min(5, fieldSchema.items.enum.length)}
                            >
                                {fieldSchema.items.enum.map(option => (
                                    <option key={option} value={option}>{option}</option>
                                ))}
                            </select>
                        </div>
                    )
                }
                break

            default:
                if (fieldSchema.enum) {
                    // Dropdown select
                    return (
                        <ValidatedInput
                            key={fieldName}
                            type="select"
                            value={value}
                            onChange={handleChange}
                            label={fieldTitle}
                            description={fieldDescription}
                            required={isRequired}
                            validation={validation}
                            isValidating={fieldIsValidating}
                        >
                            <option value="">Select an option</option>
                            {fieldSchema.enum.map(option => (
                                <option key={option} value={option}>{option}</option>
                            ))}
                        </ValidatedInput>
                    )
                }
                return (
                    <ValidatedInput
                        key={fieldName}
                        type="text"
                        value={value}
                        onChange={handleChange}
                        label={fieldTitle}
                        description={fieldDescription}
                        placeholder={fieldSchema.placeholder || ''}
                        required={isRequired}
                        validation={validation}
                        isValidating={isValidating}
                    />
                )
        }
    }

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
                        onConfigChange={handleSpecialEditorConfigChange}
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
                    <div className={`flex-1 overflow-y-auto p-4 transition-all duration-500 ${showSpecialEditor && isAnimatingSpecialEditor ? 'animate-fade-in-up delay-300' : ''
                        } ${showSpecialEditor && isClosingSpecialEditor ? 'animate-fade-out-down' : ''
                        }`}>
                        {isValidatingType ? (
                            <div className="flex items-center justify-center py-8">
                                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mr-3"></div>
                                <span className="text-gray-600">Validating widget type...</span>
                            </div>
                        ) : widgetTypeValidation && !widgetTypeValidation.canEdit ? (
                            <div className="space-y-4">
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
                            <div className="text-center py-8">
                                <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                                    <p className="text-red-800 font-medium">Failed to load widget configuration</p>
                                    <p className="text-red-600 text-sm mt-1">{schemaError}</p>
                                </div>
                            </div>
                        ) : (
                            <div className="space-y-4">
                                {(() => {
                                    const activeSchema = fetchedSchema || schema
                                    return activeSchema?.properties ? (
                                        Object.entries(activeSchema.properties).map(([fieldName, fieldSchema]) =>
                                            renderFormField(fieldName, fieldSchema)
                                        )
                                    ) : (
                                        <div className="text-center text-gray-500 py-8">
                                            <p>No configuration options available for this widget.</p>
                                        </div>
                                    )
                                })()}
                            </div>
                        )}
                    </div>

                    {/* Footer with action buttons */}
                    {showValidationWarning && (
                        <div className="border-t border-gray-200 p-4 bg-gray-50">
                            {/* Validation warning snackbar */}
                            <div className="mt-3 p-3 bg-red-50 border border-red-200 rounded-md">
                                <p className="text-sm text-red-800 font-medium">
                                    Cannot save: Please fix validation errors first
                                </p>
                                <p className="text-xs text-red-600 mt-1">
                                    Check the form fields above for errors and correct them before saving.
                                </p>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </>
    )
})

// Add display name for debugging
WidgetEditorPanel.displayName = 'WidgetEditorPanel'

export default WidgetEditorPanel
