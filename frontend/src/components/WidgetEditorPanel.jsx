import React, { useState, useEffect, useRef, useCallback, forwardRef, useImperativeHandle } from 'react'
import { X, Save, RotateCcw } from 'lucide-react'
import ValidatedInput from './validation/ValidatedInput.jsx'
import { getWidgetSchema, validateWidgetConfiguration } from '../api/widgetSchemas.js'
import { widgetsApi } from '../api'

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
    widgetData,
    schema,
    title = "Edit Widget"
}, ref) => {
    const [config, setConfig] = useState({})
    const [originalConfig, setOriginalConfig] = useState({})
    const [hasChanges, setHasChanges] = useState(false)
    const [validationResults, setValidationResults] = useState({})
    const [isValidating, setIsValidating] = useState(false)
    const [widgetTypeName, setWidgetTypeName] = useState(null)
    const [widgetTypeSlug, setWidgetTypeSlug] = useState(null)
    const [fetchedSchema, setFetchedSchema] = useState(null)
    const [isLoadingSchema, setIsLoadingSchema] = useState(false)
    const [schemaError, setSchemaError] = useState(null)
    const [panelWidth, setPanelWidth] = useState(400) // Default width in pixels
    const [isResizing, setIsResizing] = useState(false)

    const panelRef = useRef(null)
    const resizeRef = useRef(null)
    const startXRef = useRef(0)
    const startWidthRef = useRef(0)
    const rafRef = useRef(null)
    const updateTimeoutRef = useRef(null)
    const validationTimeoutRef = useRef(null)

    // Expose save method to parent component
    useImperativeHandle(ref, () => ({
        saveCurrentWidget: () => {
            const currentWidget = {
                ...widgetData,
                config
            }
            handleSave()
            return currentWidget
        },
        hasUnsavedChanges: hasChanges
    }), [widgetData, config, hasChanges, handleSave])

    // Initialize config when widget data changes
    useEffect(() => {
        if (widgetData?.config) {
            const initialConfig = { ...widgetData.config }
            setConfig(initialConfig)
            setOriginalConfig(initialConfig)
            setHasChanges(false)
        }
    }, [widgetData])

    // Fetch schema from backend when widget type changes
    useEffect(() => {
        if (widgetData && !schema) {
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

                        // Get the widget details to find the slug
                        const allWidgetTypes = await widgetsApi.getTypes()
                        const widgetWithSlug = allWidgetTypes.find(w => w.name === resolvedWidgetTypeName)
                        const slugToUse = widgetWithSlug?.slug || resolvedWidgetTypeName.toLowerCase().replace(/\s+/g, '-')
                        setWidgetTypeSlug(slugToUse)

                        const schemaData = await getWidgetSchema(slugToUse)
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
    }, [widgetData, schema])

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
                if (result.errors) {
                    Object.entries(result.errors).forEach(([field, messages]) => {
                        formattedResults[field] = {
                            isValid: false,
                            errors: Array.isArray(messages) ? messages : [messages],
                            warnings: result.warnings?.[field] || []
                        }
                    })
                }

                setValidationResults(formattedResults)
                setIsValidating(false)
            } catch (error) {
                console.error('Widget validation failed:', error)
                setIsValidating(false)
            }
        }, 300) // 300ms debounce
    }, [widgetTypeSlug])

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

    // Debounced real-time update function
    const triggerRealTimeUpdate = useCallback((newConfig) => {
        if (!onRealTimeUpdate || !widgetData) return

        // Clear any pending update
        if (updateTimeoutRef.current) {
            clearTimeout(updateTimeoutRef.current)
        }

        // Debounce updates to prevent too many calls
        updateTimeoutRef.current = setTimeout(() => {
            onRealTimeUpdate({
                ...widgetData,
                config: newConfig
            })
        }, 300) // 300ms debounce
    }, [onRealTimeUpdate, widgetData])

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

    // Handle save - commit changes to server
    const handleSave = () => {
        // Clear any pending real-time update
        if (updateTimeoutRef.current) {
            clearTimeout(updateTimeoutRef.current)
        }

        // Save the current config as the new original
        setOriginalConfig({ ...config })
        setHasChanges(false)

        // Notify parent that changes are saved
        if (onUnsavedChanges) {
            onUnsavedChanges(false)
        }

        // Commit changes to server
        onSave({
            ...widgetData,
            config
        })
    }

    // Handle reset - revert to original state
    const handleReset = () => {
        setConfig({ ...originalConfig })
        setHasChanges(false)

        // Notify parent that changes are reset
        if (onUnsavedChanges) {
            onUnsavedChanges(false)
        }

        // Apply reset immediately to the widget preview
        if (onRealTimeUpdate && widgetData) {
            onRealTimeUpdate({
                ...widgetData,
                config: originalConfig
            })
        }
    }

    // Handle close - revert changes if not saved
    const handleClose = () => {
        // Clear any pending real-time update
        if (updateTimeoutRef.current) {
            clearTimeout(updateTimeoutRef.current)
        }

        // If there are unsaved changes, revert to original state
        if (hasChanges && onRealTimeUpdate && widgetData) {
            onRealTimeUpdate({
                ...widgetData,
                config: originalConfig
            })
        }

        onClose()
    }

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

            {/* Slide-out panel - positioned relative to content area */}
            <div
                ref={panelRef}
                className={`absolute top-0 right-0 h-full bg-white shadow-xl transform transition-transform duration-300 ease-in-out z-50 flex ${isOpen ? 'translate-x-0' : 'translate-x-full'
                    }`}
                style={{ width: `${panelWidth}px` }}
            >
                {/* Resize handle */}
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

                {/* Panel content */}
                <div className="flex-1 flex flex-col">
                    {/* Header */}
                    <div className="flex items-center justify-between p-4 border-b border-gray-200 bg-gray-50">
                        <h3 className="text-lg font-semibold text-gray-900">{title}</h3>
                        <button
                            onClick={handleClose}
                            className="p-1 text-gray-400 hover:text-gray-600 transition-colors"
                        >
                            <X className="w-5 h-5" />
                        </button>
                    </div>

                    {/* Form content - scrollable */}
                    <div className="flex-1 overflow-y-auto p-4">
                        {isLoadingSchema ? (
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
                    <div className="border-t border-gray-200 p-4 bg-gray-50">
                        <div className="flex justify-between">
                            <button
                                onClick={handleReset}
                                disabled={!hasChanges}
                                className="inline-flex items-center px-3 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                            >
                                <RotateCcw className="w-4 h-4 mr-2" />
                                Reset
                            </button>

                            <div className="flex space-x-3">
                                <button
                                    onClick={handleClose}
                                    className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 transition-colors"
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={handleSave}
                                    disabled={!hasChanges}
                                    className="inline-flex items-center px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                                >
                                    <Save className="w-4 h-4 mr-2" />
                                    Save Changes
                                </button>
                            </div>
                        </div>

                        <div className="flex items-center justify-between mt-2">
                            <p className="text-xs text-gray-500">
                                Preview updates in real-time
                            </p>
                            {hasChanges && (
                                <p className="text-xs text-amber-600">
                                    Unsaved changes
                                </p>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </>
    )
})

// Add display name for debugging
WidgetEditorPanel.displayName = 'WidgetEditorPanel'

export default WidgetEditorPanel
