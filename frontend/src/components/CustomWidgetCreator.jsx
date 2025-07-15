import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import {
    Plus,
    Trash2,
    Save,
    Code,
    Settings,
    Eye,
    FileText,
    Type,
    Image as ImageIcon,
    Calendar,
    CheckSquare
} from 'lucide-react'
import axios from 'axios'

const CustomWidgetCreator = ({ onClose, onWidgetCreated }) => {
    const [widgetData, setWidgetData] = useState({
        name: '',
        description: '',
        template_content: '',
        schema_properties: {},
        required_fields: []
    })

    const [fields, setFields] = useState([])
    const [preview, setPreview] = useState(null)
    const [activeTab, setActiveTab] = useState('basic')

    const queryClient = useQueryClient()

    // Field types for schema generation
    const fieldTypes = [
        { value: 'string', label: 'Text', icon: Type },
        { value: 'integer', label: 'Number', icon: FileText },
        { value: 'boolean', label: 'Checkbox', icon: CheckSquare },
        { value: 'array', label: 'List', icon: FileText }
    ]

    const fieldFormats = [
        { value: '', label: 'Default' },
        { value: 'textarea', label: 'Textarea' },
        { value: 'email', label: 'Email' },
        { value: 'uri', label: 'URL' },
        { value: 'date', label: 'Date' },
        { value: 'datetime-local', label: 'Date & Time' }
    ]

    // Mutation for creating custom widget
    const createWidgetMutation = useMutation({
        mutationFn: async (data) => {
            const response = await axios.post('/api/webpages/api/widget-types/create_custom/', data)
            return response.data
        },
        onSuccess: (data) => {
            queryClient.invalidateQueries(['widget-types'])
            onWidgetCreated?.(data.widget_type)
            onClose?.()
        }
    })

    // Mutation for generating schema preview
    const generateSchemaMutation = useMutation({
        mutationFn: async (fields) => {
            const response = await axios.post('/api/webpages/api/widget-types/generate_schema/', {
                fields
            })
            return response.data
        },
        onSuccess: (data) => {
            setWidgetData(prev => ({
                ...prev,
                schema_properties: data.schema.properties,
                required_fields: data.schema.required
            }))
        }
    })

    const addField = () => {
        setFields(prev => [...prev, {
            name: '',
            type: 'string',
            title: '',
            required: false,
            default: '',
            description: '',
            format: '',
            enum: []
        }])
    }

    const updateField = (index, updates) => {
        setFields(prev => prev.map((field, i) =>
            i === index ? { ...field, ...updates } : field
        ))
    }

    const removeField = (index) => {
        setFields(prev => prev.filter((_, i) => i !== index))
    }

    const generateSchema = () => {
        generateSchemaMutation.mutate(fields)
    }

    const generateDefaultTemplate = () => {
        const templateContent = `{% load static %}

<div class="${widgetData.name.toLowerCase().replace(/\s+/g, '-')}-widget widget-custom" data-widget-type="${widgetData.name.toLowerCase()}">
    <div class="widget-content">
        ${fields.map(field => {
            if (field.type === 'boolean') {
                return `{% if config.${field.name} %}
        <div class="field-${field.name}">
            <strong>${field.title}:</strong> Yes
        </div>
        {% endif %}`
            } else {
                return `{% if config.${field.name} %}
        <div class="field-${field.name}">
            <strong>${field.title}:</strong> {{ config.${field.name} }}
        </div>
        {% endif %}`
            }
        }).join('\n        ')}
    </div>
</div>

<style>
.${widgetData.name.toLowerCase().replace(/\s+/g, '-')}-widget {
    border: 1px solid #e1e5e9;
    border-radius: 8px;
    padding: 1.5rem;
    margin: 1rem 0;
    background: #fff;
    box-shadow: 0 2px 4px rgba(0,0,0,0.1);
}

.widget-content > div {
    margin-bottom: 0.75rem;
}

.widget-content > div:last-child {
    margin-bottom: 0;
}
</style>`

        setWidgetData(prev => ({
            ...prev,
            template_content: templateContent
        }))
    }

    const handleSubmit = (e) => {
        e.preventDefault()

        if (!widgetData.name || !widgetData.template_content || fields.length === 0) {
            alert('Please fill in all required fields and add at least one field.')
            return
        }

        generateSchema()

        // Create the widget after schema is generated
        setTimeout(() => {
            createWidgetMutation.mutate(widgetData)
        }, 100)
    }

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-lg shadow-xl w-full max-w-4xl max-h-[90vh] overflow-hidden">
                <div className="flex items-center justify-between p-4 border-b">
                    <h2 className="text-xl font-semibold">Create Custom Widget</h2>
                    <button
                        onClick={onClose}
                        className="text-gray-500 hover:text-gray-700"
                    >
                        ✕
                    </button>
                </div>

                <div className="flex border-b">
                    {[
                        { id: 'basic', label: 'Basic Info', icon: Settings },
                        { id: 'fields', label: 'Fields', icon: Plus },
                        { id: 'template', label: 'Template', icon: Code },
                        { id: 'preview', label: 'Preview', icon: Eye }
                    ].map(tab => (
                        <button
                            key={tab.id}
                            onClick={() => setActiveTab(tab.id)}
                            className={`flex items-center gap-2 px-4 py-2 border-b-2 transition-colors ${activeTab === tab.id
                                    ? 'border-blue-500 text-blue-600'
                                    : 'border-transparent text-gray-600 hover:text-gray-900'
                                }`}
                        >
                            <tab.icon size={16} />
                            {tab.label}
                        </button>
                    ))}
                </div>

                <div className="p-4 overflow-y-auto max-h-[calc(90vh-200px)]">
                    {activeTab === 'basic' && (
                        <div className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                    Widget Name *
                                </label>
                                <input
                                    type="text"
                                    value={widgetData.name}
                                    onChange={(e) => setWidgetData(prev => ({ ...prev, name: e.target.value }))}
                                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                                    placeholder="My Custom Widget"
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                    Description
                                </label>
                                <textarea
                                    value={widgetData.description}
                                    onChange={(e) => setWidgetData(prev => ({ ...prev, description: e.target.value }))}
                                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                                    rows="3"
                                    placeholder="Describe what this widget does..."
                                />
                            </div>
                        </div>
                    )}

                    {activeTab === 'fields' && (
                        <div className="space-y-4">
                            <div className="flex items-center justify-between">
                                <h3 className="text-lg font-medium">Widget Fields</h3>
                                <button
                                    onClick={addField}
                                    className="flex items-center gap-2 px-3 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
                                >
                                    <Plus size={16} />
                                    Add Field
                                </button>
                            </div>

                            {fields.map((field, index) => (
                                <div key={index} className="border rounded-lg p-4 space-y-3">
                                    <div className="flex items-center justify-between">
                                        <h4 className="font-medium">Field {index + 1}</h4>
                                        <button
                                            onClick={() => removeField(index)}
                                            className="text-red-600 hover:text-red-800"
                                        >
                                            <Trash2 size={16} />
                                        </button>
                                    </div>

                                    <div className="grid grid-cols-2 gap-3">
                                        <div>
                                            <label className="block text-sm font-medium text-gray-700 mb-1">
                                                Field Name
                                            </label>
                                            <input
                                                type="text"
                                                value={field.name}
                                                onChange={(e) => updateField(index, { name: e.target.value })}
                                                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                                                placeholder="field_name"
                                            />
                                        </div>

                                        <div>
                                            <label className="block text-sm font-medium text-gray-700 mb-1">
                                                Display Title
                                            </label>
                                            <input
                                                type="text"
                                                value={field.title}
                                                onChange={(e) => updateField(index, { title: e.target.value })}
                                                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                                                placeholder="Field Title"
                                            />
                                        </div>

                                        <div>
                                            <label className="block text-sm font-medium text-gray-700 mb-1">
                                                Type
                                            </label>
                                            <select
                                                value={field.type}
                                                onChange={(e) => updateField(index, { type: e.target.value })}
                                                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                                            >
                                                {fieldTypes.map(type => (
                                                    <option key={type.value} value={type.value}>
                                                        {type.label}
                                                    </option>
                                                ))}
                                            </select>
                                        </div>

                                        <div>
                                            <label className="block text-sm font-medium text-gray-700 mb-1">
                                                Format
                                            </label>
                                            <select
                                                value={field.format}
                                                onChange={(e) => updateField(index, { format: e.target.value })}
                                                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                                            >
                                                {fieldFormats.map(format => (
                                                    <option key={format.value} value={format.value}>
                                                        {format.label}
                                                    </option>
                                                ))}
                                            </select>
                                        </div>
                                    </div>

                                    <div className="flex items-center gap-4">
                                        <label className="flex items-center gap-2">
                                            <input
                                                type="checkbox"
                                                checked={field.required}
                                                onChange={(e) => updateField(index, { required: e.target.checked })}
                                                className="w-4 h-4 text-blue-600"
                                            />
                                            Required
                                        </label>
                                    </div>
                                </div>
                            ))}

                            {fields.length > 0 && (
                                <div className="flex justify-center">
                                    <button
                                        onClick={generateSchema}
                                        className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700"
                                        disabled={generateSchemaMutation.isPending}
                                    >
                                        {generateSchemaMutation.isPending ? 'Generating...' : 'Generate Schema'}
                                    </button>
                                </div>
                            )}
                        </div>
                    )}

                    {activeTab === 'template' && (
                        <div className="space-y-4">
                            <div className="flex items-center justify-between">
                                <h3 className="text-lg font-medium">Widget Template</h3>
                                <button
                                    onClick={generateDefaultTemplate}
                                    className="px-3 py-2 bg-purple-600 text-white rounded-md hover:bg-purple-700"
                                >
                                    Generate Default
                                </button>
                            </div>

                            <div>
                                <textarea
                                    value={widgetData.template_content}
                                    onChange={(e) => setWidgetData(prev => ({ ...prev, template_content: e.target.value }))}
                                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono text-sm"
                                    rows="20"
                                    placeholder="Enter your Django template here..."
                                />
                            </div>

                            <div className="text-sm text-gray-600">
                                <p>Use Django template syntax. Widget configuration is available as <code>config</code>.</p>
                                <p>Example: <code>{'{{ config.field_name }}'}</code></p>
                            </div>
                        </div>
                    )}

                    {activeTab === 'preview' && (
                        <div className="space-y-4">
                            <h3 className="text-lg font-medium">Schema Preview</h3>

                            {Object.keys(widgetData.schema_properties).length > 0 ? (
                                <div className="bg-gray-100 rounded-lg p-4">
                                    <pre className="text-sm overflow-x-auto">
                                        {JSON.stringify({
                                            type: 'object',
                                            properties: widgetData.schema_properties,
                                            required: widgetData.required_fields
                                        }, null, 2)}
                                    </pre>
                                </div>
                            ) : (
                                <p className="text-gray-500">No schema generated yet. Add fields and generate schema first.</p>
                            )}
                        </div>
                    )}
                </div>

                <div className="flex items-center justify-between p-4 border-t bg-gray-50">
                    <div className="text-sm text-gray-600">
                        * Required fields
                    </div>
                    <div className="flex gap-2">
                        <button
                            onClick={onClose}
                            className="px-4 py-2 text-gray-600 hover:text-gray-800"
                        >
                            Cancel
                        </button>
                        <button
                            onClick={handleSubmit}
                            disabled={createWidgetMutation.isPending}
                            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50"
                        >
                            <Save size={16} />
                            {createWidgetMutation.isPending ? 'Creating...' : 'Create Widget'}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    )
}

export default CustomWidgetCreator 