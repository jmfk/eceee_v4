/**
 * WidgetConfigPanel - Shared widget configuration component
 * 
 * Provides a unified interface for configuring widgets across both
 * page and object editing contexts with context-aware adaptations.
 */

import React, { useState, useCallback, useEffect, useMemo } from 'react'
import { X, Save, RotateCcw, Eye, AlertTriangle, Info, Check } from 'lucide-react'
import { useWidgetContext } from '../context/WidgetContext'
import { useEditorContext } from '../context/EditorContext'
import { getWidgetEditorComponent, WIDGET_TYPE_REGISTRY } from '../utils/widgetFactory'
import { useRealTimeValidation } from '../hooks/useWidgetValidation'

/**
 * WidgetConfigPanel Component
 */
export function WidgetConfigPanel({
    widget,
    slotName,
    slotConfig = {},
    isOpen = false,
    onClose,
    onSave,
    onCancel,
    showPreview = true,
    className = ''
}) {
    const { context, updateWidget } = useWidgetContext()
    const { preferences } = useEditorContext()

    const [localConfig, setLocalConfig] = useState(widget?.config || {})
    const [hasChanges, setHasChanges] = useState(false)
    const [isSaving, setIsSaving] = useState(false)
    const [previewMode, setPreviewMode] = useState(false)

    // Real-time validation
    const {
        validateWidget,
        getWidgetValidation,
        hasWidgetErrors,
        hasWidgetWarnings
    } = useRealTimeValidation(slotName, slotConfig)

    // Get widget type information
    const widgetType = useMemo(() => {
        return WIDGET_TYPE_REGISTRY[widget?.slug] || null
    }, [widget?.slug])

    // Get appropriate editor component
    const EditorComponent = useMemo(() => {
        return getWidgetEditorComponent(widget?.slug)
    }, [widget?.slug])

    // Sync local config with widget changes
    useEffect(() => {
        if (widget?.config) {
            setLocalConfig(widget.config)
            setHasChanges(false)
        }
    }, [widget?.config])

    // Validate when config changes
    useEffect(() => {
        if (widget && hasChanges) {
            const updatedWidget = { ...widget, config: localConfig }
            validateWidget(updatedWidget)
        }
    }, [widget, localConfig, hasChanges, validateWidget])

    /**
     * Handle configuration changes
     */
    const handleConfigChange = useCallback((newConfig) => {
        setLocalConfig(newConfig)
        setHasChanges(true)
    }, [])

    /**
     * Handle save
     */
    const handleSave = useCallback(async () => {
        if (!widget || !hasChanges) return

        setIsSaving(true)

        try {
            const updatedWidget = { ...widget, config: localConfig }
            const validation = await validateWidget(updatedWidget)

            if (!validation.isValid && preferences.confirmDelete) {
                const confirmSave = window.confirm(
                    'This widget has validation errors. Save anyway?'
                )
                if (!confirmSave) {
                    setIsSaving(false)
                    return
                }
            }

            await updateWidget(slotName, widget.id, updatedWidget, slotConfig)
            setHasChanges(false)

            if (onSave) {
                onSave(updatedWidget)
            }
        } catch (error) {
            console.error('Failed to save widget:', error)
            // Could show error notification here
        } finally {
            setIsSaving(false)
        }
    }, [widget, localConfig, hasChanges, validateWidget, updateWidget, slotName, slotConfig, onSave, preferences.confirmDelete])

    /**
     * Handle cancel
     */
    const handleCancel = useCallback(() => {
        if (hasChanges && preferences.confirmDelete) {
            const confirmCancel = window.confirm(
                'You have unsaved changes. Discard them?'
            )
            if (!confirmCancel) return
        }

        setLocalConfig(widget?.config || {})
        setHasChanges(false)

        if (onCancel) {
            onCancel()
        }
    }, [widget?.config, hasChanges, onCancel, preferences.confirmDelete])

    /**
     * Handle reset to defaults
     */
    const handleReset = useCallback(() => {
        if (widgetType?.defaultConfig) {
            const confirmReset = window.confirm(
                'Reset widget to default configuration?'
            )
            if (confirmReset) {
                setLocalConfig(widgetType.defaultConfig)
                setHasChanges(true)
            }
        }
    }, [widgetType?.defaultConfig])

    /**
     * Toggle preview mode
     */
    const togglePreview = useCallback(() => {
        setPreviewMode(!previewMode)
    }, [previewMode])

    if (!isOpen || !widget) {
        return null
    }

    const validation = getWidgetValidation(widget.id)
    const hasErrors = hasWidgetErrors(widget.id)
    const hasWarnings = hasWidgetWarnings(widget.id)

    return (
        <div className={`widget-config-panel ${className}`}>
            <div className="fixed inset-0 bg-black bg-opacity-50 z-40" onClick={onClose} />

            <div className="fixed inset-y-0 right-0 w-96 bg-white shadow-xl z-50 flex flex-col">
                {/* Header */}
                <div className="flex items-center justify-between p-4 border-b">
                    <div className="flex items-center space-x-2">
                        <div className="w-3 h-3 rounded-full bg-blue-500" />
                        <h3 className="text-lg font-medium text-gray-900">
                            Configure {widget.type || widget.name}
                        </h3>
                    </div>

                    <div className="flex items-center space-x-2">
                        {showPreview && (
                            <button
                                onClick={togglePreview}
                                className={`p-2 rounded-md transition-colors ${previewMode
                                        ? 'bg-blue-100 text-blue-700'
                                        : 'text-gray-400 hover:text-gray-600'
                                    }`}
                                title="Toggle preview"
                            >
                                <Eye className="h-4 w-4" />
                            </button>
                        )}

                        <button
                            onClick={onClose}
                            className="p-2 text-gray-400 hover:text-gray-600 transition-colors"
                        >
                            <X className="h-4 w-4" />
                        </button>
                    </div>
                </div>

                {/* Validation Status */}
                {validation && (hasErrors || hasWarnings) && (
                    <ValidationStatus
                        validation={validation}
                        hasErrors={hasErrors}
                        hasWarnings={hasWarnings}
                    />
                )}

                {/* Content */}
                <div className="flex-1 overflow-y-auto">
                    {previewMode ? (
                        <WidgetPreview
                            widget={{ ...widget, config: localConfig }}
                            className="p-4"
                        />
                    ) : (
                        <div className="p-4">
                            {/* Widget Info */}
                            <div className="mb-6 p-3 bg-gray-50 rounded-lg">
                                <div className="flex items-center justify-between mb-2">
                                    <span className="text-sm font-medium text-gray-700">
                                        Widget Type
                                    </span>
                                    <span className="text-xs px-2 py-1 bg-blue-100 text-blue-800 rounded">
                                        {context}
                                    </span>
                                </div>
                                <div className="text-xs text-gray-500">
                                    {widgetType?.description || 'No description available'}
                                </div>
                            </div>

                            {/* Configuration Form */}
                            {EditorComponent ? (
                                <EditorComponent
                                    config={localConfig}
                                    onChange={handleConfigChange}
                                    widgetType={widgetType}
                                    context={context}
                                    slotConfig={slotConfig}
                                    errors={validation?.errors || []}
                                />
                            ) : (
                                <GenericConfigForm
                                    config={localConfig}
                                    onChange={handleConfigChange}
                                    widgetType={widgetType}
                                />
                            )}
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="flex items-center justify-between p-4 border-t bg-gray-50">
                    <div className="flex items-center space-x-2">
                        {widgetType?.defaultConfig && (
                            <button
                                onClick={handleReset}
                                className="flex items-center space-x-1 text-sm text-gray-600 hover:text-gray-800 transition-colors"
                                title="Reset to defaults"
                            >
                                <RotateCcw className="h-3 w-3" />
                                <span>Reset</span>
                            </button>
                        )}
                    </div>

                    <div className="flex items-center space-x-2">
                        <button
                            onClick={handleCancel}
                            className="px-3 py-2 text-sm text-gray-600 hover:text-gray-800 transition-colors"
                        >
                            Cancel
                        </button>

                        <button
                            onClick={handleSave}
                            disabled={!hasChanges || isSaving}
                            className={`px-4 py-2 text-sm font-medium rounded-md transition-colors ${hasChanges && !isSaving
                                    ? 'bg-blue-600 text-white hover:bg-blue-700'
                                    : 'bg-gray-200 text-gray-400 cursor-not-allowed'
                                }`}
                        >
                            {isSaving ? (
                                <div className="flex items-center space-x-2">
                                    <div className="w-3 h-3 border border-gray-300 border-t-blue-600 rounded-full animate-spin" />
                                    <span>Saving...</span>
                                </div>
                            ) : (
                                <div className="flex items-center space-x-1">
                                    <Save className="h-3 w-3" />
                                    <span>Save</span>
                                </div>
                            )}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    )
}

/**
 * Validation Status Component
 */
function ValidationStatus({ validation, hasErrors, hasWarnings }) {
    const { errors = [], warnings = [] } = validation

    return (
        <div className={`p-3 border-b ${hasErrors ? 'bg-red-50 border-red-200' : 'bg-yellow-50 border-yellow-200'}`}>
            <div className="flex items-center space-x-2 mb-2">
                {hasErrors ? (
                    <>
                        <AlertTriangle className="h-4 w-4 text-red-500" />
                        <span className="text-sm font-medium text-red-800">
                            {errors.length} error{errors.length !== 1 ? 's' : ''} found
                        </span>
                    </>
                ) : (
                    <>
                        <Info className="h-4 w-4 text-yellow-500" />
                        <span className="text-sm font-medium text-yellow-800">
                            {warnings.length} warning{warnings.length !== 1 ? 's' : ''}
                        </span>
                    </>
                )}
            </div>

            <div className="space-y-1">
                {errors.map((error, index) => (
                    <div key={index} className="text-xs text-red-700">
                        • {error.message}
                    </div>
                ))}
                {warnings.map((warning, index) => (
                    <div key={index} className="text-xs text-yellow-700">
                        • {warning.message}
                    </div>
                ))}
            </div>
        </div>
    )
}

/**
 * Generic Configuration Form
 */
function GenericConfigForm({ config, onChange, widgetType }) {
    const handleFieldChange = useCallback((field, value) => {
        onChange({ ...config, [field]: value })
    }, [config, onChange])

    const configFields = Object.keys(config || {})
    if (configFields.length === 0) {
        return (
            <div className="text-center py-8 text-gray-500">
                <Info className="h-8 w-8 mx-auto mb-2" />
                <p>No configuration options available</p>
            </div>
        )
    }

    return (
        <div className="space-y-4">
            {configFields.map(field => (
                <div key={field} className="space-y-2">
                    <label className="block text-sm font-medium text-gray-700 capitalize">
                        {field.replace(/([A-Z])/g, ' $1').toLowerCase()}
                    </label>

                    {typeof config[field] === 'boolean' ? (
                        <label className="flex items-center">
                            <input
                                type="checkbox"
                                checked={config[field]}
                                onChange={(e) => handleFieldChange(field, e.target.checked)}
                                className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                            />
                            <span className="ml-2 text-sm text-gray-600">
                                Enable {field}
                            </span>
                        </label>
                    ) : typeof config[field] === 'number' ? (
                        <input
                            type="number"
                            value={config[field]}
                            onChange={(e) => handleFieldChange(field, Number(e.target.value))}
                            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                    ) : (
                        <textarea
                            value={config[field] || ''}
                            onChange={(e) => handleFieldChange(field, e.target.value)}
                            rows={3}
                            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                    )}
                </div>
            ))}
        </div>
    )
}

/**
 * Widget Preview Component
 */
function WidgetPreview({ widget, className = '' }) {
    const previewContent = useMemo(() => {
        const config = widget.config || {}

        switch (widget.slug) {
            case 'text-block':
                return (
                    <div className="prose max-w-none">
                        {config.title && <h3>{config.title}</h3>}
                        <div dangerouslySetInnerHTML={{ __html: config.content || 'No content' }} />
                    </div>
                )

            case 'image':
                return (
                    <div className="text-center">
                        {config.src ? (
                            <img
                                src={config.src}
                                alt={config.alt || ''}
                                className="max-w-full h-auto rounded"
                            />
                        ) : (
                            <div className="bg-gray-200 h-32 rounded flex items-center justify-center">
                                <span className="text-gray-500">No image selected</span>
                            </div>
                        )}
                        {config.caption && (
                            <p className="text-sm text-gray-600 mt-2">{config.caption}</p>
                        )}
                    </div>
                )

            case 'button':
                return (
                    <button
                        className={`px-4 py-2 rounded font-medium ${config.style === 'primary'
                                ? 'bg-blue-600 text-white'
                                : 'bg-gray-200 text-gray-800'
                            }`}
                    >
                        {config.text || 'Button'}
                    </button>
                )

            default:
                return (
                    <div className="bg-gray-100 p-4 rounded">
                        <div className="flex items-center space-x-2 mb-2">
                            <Check className="h-4 w-4 text-green-500" />
                            <span className="text-sm font-medium">Widget Preview</span>
                        </div>
                        <pre className="text-xs text-gray-600 overflow-auto">
                            {JSON.stringify(config, null, 2)}
                        </pre>
                    </div>
                )
        }
    }, [widget])

    return (
        <div className={`widget-preview ${className}`}>
            <h4 className="text-sm font-medium text-gray-700 mb-3">Preview</h4>
            <div className="border rounded-lg p-4 bg-white">
                {previewContent}
            </div>
        </div>
    )
}

export default WidgetConfigPanel
