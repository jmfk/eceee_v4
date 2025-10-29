import React, { useState, useEffect } from 'react'
import { X, Save, RotateCcw, Settings } from 'lucide-react'
import { EnhancedWidgetForm } from './forms'

/**
 * EnhancedWidgetEditorDemo Component
 * 
 * Demonstration of how the WidgetEditorPanel can be enhanced with the new field system.
 * This shows the integration approach that can be applied to the existing WidgetEditorPanel.
 */
const EnhancedWidgetEditorDemo = ({
    isOpen = true,
    onClose = () => { },
    widgetData = null,
    schema = null,
    title = "Enhanced Widget Editor Demo"
}) => {
    const [config, setConfig] = useState({})
    const [hasChanges, setHasChanges] = useState(false)
    const [validation, setValidation] = useState({})
    const [isValidating, setIsValidating] = useState(false)

    // Sample widget data and schema for demonstration
    const demoWidgetData = widgetData || {
        id: 'demo-widget',
        type: 'eceee_widgets.ContentWidget',
        config: {
            title: 'Sample Content',
            content: 'This is sample content for the demo.',
            titleTag: 'h2',
            alignment: 'left',
            showBorder: true,
            backgroundColor: '#ffffff',
            textColor: '#333333',
            padding: 16,
            borderRadius: 8
        }
    }

    const demoSchema = schema || {
        type: 'object',
        properties: {
            title: {
                type: 'string',
                title: 'Title',
                description: 'The main title for the content widget'
            },
            content: {
                type: 'string',
                format: 'textarea',
                title: 'Content',
                description: 'The main content text',
                maxLength: 1000
            },
            titleTag: {
                type: 'string',
                title: 'Title Tag',
                description: 'HTML tag for the title',
                enum: ['h1', 'h2', 'h3', 'h4', 'h5', 'h6']
            },
            alignment: {
                type: 'string',
                title: 'Text Alignment',
                description: 'How to align the text',
                enum: ['left', 'center', 'right', 'justify']
            },
            showBorder: {
                type: 'boolean',
                title: 'Show Border',
                description: 'Whether to show a border around the content'
            },
            backgroundColor: {
                type: 'string',
                format: 'color',
                title: 'Background Color',
                description: 'Background color for the widget'
            },
            textColor: {
                type: 'string',
                format: 'color',
                title: 'Text Color',
                description: 'Color for the text content'
            },
            padding: {
                type: 'number',
                title: 'Padding',
                description: 'Internal padding in pixels',
                minimum: 0,
                maximum: 100
            },
            borderRadius: {
                type: 'number',
                title: 'Border Radius',
                description: 'Corner radius in pixels',
                minimum: 0,
                maximum: 50
            }
        },
        required: ['title', 'content'],
        propertyOrder: ['title', 'content', 'titleTag', 'alignment', 'showBorder', 'backgroundColor', 'textColor', 'padding', 'borderRadius']
    }

    // Initialize config
    useEffect(() => {
        if (demoWidgetData?.config) {
            setConfig({ ...demoWidgetData.config })
            setHasChanges(false)
        }
    }, [demoWidgetData])

    const handleFieldChange = (fieldName, value) => {
        setConfig(prev => ({
            ...prev,
            [fieldName]: value
        }))
        setHasChanges(true)
    }

    const handleSave = () => {
        setHasChanges(false)
        // In real implementation, this would call the onSave prop
    }

    const handleReset = () => {
        setConfig({ ...demoWidgetData.config })
        setHasChanges(false)
    }

    if (!isOpen) return null

    return (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg shadow-xl w-full max-w-4xl h-5/6 flex flex-col">
                {/* Header */}
                <div className="flex items-center justify-between p-4 border-b border-gray-200">
                    <div className="flex items-center space-x-3">
                        <Settings className="w-5 h-5 text-blue-600" />
                        <h2 className="text-lg font-semibold text-gray-900">{title}</h2>
                        {hasChanges && (
                            <span className="px-2 py-1 bg-yellow-100 text-yellow-800 text-xs rounded-full">
                                Unsaved changes
                            </span>
                        )}
                    </div>
                    <button
                        onClick={onClose}
                        className="p-2 hover:bg-gray-100 rounded-full transition-colors"
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-hidden flex">
                    {/* Form Panel */}
                    <div className="w-1/2 p-6 overflow-y-auto border-r border-gray-200">
                        <div className="mb-4">
                            <h3 className="text-md font-medium text-gray-900 mb-2">Widget Configuration</h3>
                            <p className="text-sm text-gray-600">
                                This demo shows how the enhanced field system can be integrated into the widget editor.
                            </p>
                        </div>

                        <EnhancedWidgetForm
                            schema={demoSchema}
                            config={config}
                            onChange={handleFieldChange}
                            validation={validation}
                            isValidating={isValidating}
                            widgetType={demoWidgetData.type}
                        />
                    </div>

                    {/* Preview Panel */}
                    <div className="w-1/2 p-6 bg-gray-50">
                        <h3 className="text-md font-medium text-gray-900 mb-4">Live Preview</h3>
                        <div className="bg-white rounded-lg p-4 shadow-sm">
                            <div
                                style={{
                                    backgroundColor: config.backgroundColor || '#ffffff',
                                    color: config.textColor || '#333333',
                                    padding: `${config.padding || 16}px`,
                                    borderRadius: `${config.borderRadius || 8}px`,
                                    border: config.showBorder ? '1px solid #e5e7eb' : 'none',
                                    textAlign: config.alignment || 'left'
                                }}
                            >
                                {React.createElement(
                                    config.titleTag || 'h2',
                                    {
                                        className: 'font-bold mb-2',
                                        style: { color: config.textColor || '#333333' }
                                    },
                                    config.title || 'Sample Title'
                                )}
                                <div style={{ color: config.textColor || '#333333' }}>
                                    {config.content || 'Sample content text'}
                                </div>
                            </div>
                        </div>

                        {/* Config Display */}
                        <div className="mt-6">
                            <h4 className="text-sm font-medium text-gray-900 mb-2">Current Configuration</h4>
                            <pre className="bg-gray-100 p-3 rounded text-xs overflow-auto max-h-40">
                                {JSON.stringify(config, null, 2)}
                            </pre>
                        </div>
                    </div>
                </div>

                {/* Footer */}
                <div className="p-4 border-t border-gray-200 flex items-center justify-between">
                    <div className="text-sm text-gray-600">
                        Powered by Enhanced Field System • {Object.keys(demoSchema.properties).length} fields
                    </div>
                    <div className="flex items-center space-x-3">
                        <button
                            onClick={handleReset}
                            disabled={!hasChanges}
                            className="px-4 py-2 text-gray-700 border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-2"
                        >
                            <RotateCcw className="w-4 h-4" />
                            <span>Reset</span>
                        </button>
                        <button
                            onClick={handleSave}
                            disabled={!hasChanges}
                            className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-2"
                        >
                            <Save className="w-4 h-4" />
                            <span>Save Changes</span>
                        </button>
                    </div>
                </div>
            </div>
        </div>
    )
}

EnhancedWidgetEditorDemo.displayName = 'EnhancedWidgetEditorDemo'

export default EnhancedWidgetEditorDemo
