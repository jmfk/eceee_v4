import { useState } from 'react'
import { Plus, Trash2, GripVertical, Settings, Send } from 'lucide-react'
import BaseWidgetEditor from './BaseWidgetEditor'

/**
 * FormsEditor - Specialized editor for Forms widgets
 * 
 * Features:
 * - Form title and description editing
 * - Drag-and-drop form field builder
 * - Field type selection and configuration
 * - Form submission settings
 * - Live form preview
 * - Validation rules management
 */
const FormsEditor = ({ config, onChange, errors, widgetType }) => {
    const [editingField, setEditingField] = useState(null)

    const fieldTypes = [
        { value: 'text', label: 'Text Input', icon: '📝' },
        { value: 'email', label: 'Email', icon: '📧' },
        { value: 'phone', label: 'Phone', icon: '📞' },
        { value: 'textarea', label: 'Text Area', icon: '📄' },
        { value: 'select', label: 'Dropdown', icon: '📋' },
        { value: 'checkbox', label: 'Checkbox', icon: '☑️' },
        { value: 'radio', label: 'Radio Buttons', icon: '🔘' }
    ]

    // Add new field
    const addField = (type) => {
        const newField = {
            id: Date.now().toString(),
            name: `field_${Date.now()}`,
            label: `${type.charAt(0).toUpperCase() + type.slice(1)} Field`,
            type,
            required: false,
            placeholder: '',
            options: type === 'select' || type === 'radio' ? ['Option 1', 'Option 2'] : undefined
        }

        const fields = config?.fields || []
        onChange({
            ...config,
            fields: [...fields, newField]
        })
    }

    // Update field
    const updateField = (fieldId, updates) => {
        const fields = config?.fields || []
        const updatedFields = fields.map(field =>
            field.id === fieldId ? { ...field, ...updates } : field
        )
        onChange({
            ...config,
            fields: updatedFields
        })
    }

    // Delete field
    const deleteField = (fieldId) => {
        const fields = config?.fields || []
        const updatedFields = fields.filter(field => field.id !== fieldId)
        onChange({
            ...config,
            fields: updatedFields
        })
    }

    // Move field up/down
    const moveField = (fieldId, direction) => {
        const fields = config?.fields || []
        const currentIndex = fields.findIndex(field => field.id === fieldId)
        const newIndex = direction === 'up' ? currentIndex - 1 : currentIndex + 1

        if (newIndex >= 0 && newIndex < fields.length) {
            const newFields = [...fields]
            const [movedField] = newFields.splice(currentIndex, 1)
            newFields.splice(newIndex, 0, movedField)
            onChange({
                ...config,
                fields: newFields
            })
        }
    }

    // Render form preview
    const renderFormPreview = () => {
        const previewConfig = config || {}
        const fields = previewConfig.fields || []

        return (
            <div className="bg-white border border-gray-200 rounded-lg p-6 shadow-sm">
                {/* Form Header */}
                <div className="mb-6">
                    <h3 className="text-xl font-bold text-gray-900 mb-2">
                        {previewConfig.form_title || 'Contact Form'}
                    </h3>
                    {previewConfig.form_description && (
                        <p className="text-gray-600">{previewConfig.form_description}</p>
                    )}
                </div>

                {/* Form Fields */}
                <div className="space-y-4">
                    {fields.map(field => (
                        <div key={field.id}>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                                {field.label}
                                {field.required && <span className="text-red-500 ml-1">*</span>}
                            </label>

                            {field.type === 'text' || field.type === 'email' || field.type === 'phone' ? (
                                <input
                                    type={field.type}
                                    placeholder={field.placeholder}
                                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                                    disabled
                                />
                            ) : field.type === 'textarea' ? (
                                <textarea
                                    placeholder={field.placeholder}
                                    rows={4}
                                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                                    disabled
                                />
                            ) : field.type === 'select' ? (
                                <select className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" disabled>
                                    <option>Select {field.label}</option>
                                    {field.options?.map((option, idx) => (
                                        <option key={idx} value={option}>{option}</option>
                                    ))}
                                </select>
                            ) : field.type === 'checkbox' ? (
                                <div className="flex items-center">
                                    <input type="checkbox" className="mr-2" disabled />
                                    <span className="text-sm text-gray-700">{field.label}</span>
                                </div>
                            ) : field.type === 'radio' ? (
                                <div className="space-y-2">
                                    {field.options?.map((option, idx) => (
                                        <div key={idx} className="flex items-center">
                                            <input type="radio" name={field.name} className="mr-2" disabled />
                                            <span className="text-sm text-gray-700">{option}</span>
                                        </div>
                                    ))}
                                </div>
                            ) : null}
                        </div>
                    ))}
                </div>

                {/* Submit Button */}
                <div className="mt-6 pt-6 border-t border-gray-200">
                    <button
                        className="w-full bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 transition-colors flex items-center justify-center space-x-2"
                        disabled
                    >
                        <Send className="w-4 h-4" />
                        <span>{previewConfig.submit_button_text || 'Submit'}</span>
                    </button>

                    {previewConfig.submit_url && (
                        <div className="mt-2 text-xs text-gray-500 text-center">
                            Form will submit to: {previewConfig.submit_url}
                        </div>
                    )}
                </div>
            </div>
        )
    }

    // Field editor component
    const FieldEditor = ({ field, onUpdate, onCancel }) => {
        const [fieldData, setFieldData] = useState({ ...field })

        const updateOptions = (options) => {
            setFieldData({ ...fieldData, options })
        }

        const addOption = () => {
            const newOptions = [...(fieldData.options || []), `Option ${(fieldData.options?.length || 0) + 1}`]
            updateOptions(newOptions)
        }

        const removeOption = (index) => {
            const newOptions = fieldData.options?.filter((_, i) => i !== index) || []
            updateOptions(newOptions)
        }

        const updateOption = (index, value) => {
            const newOptions = [...(fieldData.options || [])]
            newOptions[index] = value
            updateOptions(newOptions)
        }

        return (
            <div className="p-4 border border-blue-200 rounded-lg bg-blue-50">
                <div className="space-y-4">
                    <div className="flex items-center justify-between">
                        <h4 className="font-medium text-blue-900">Edit Field</h4>
                        <button
                            onClick={onCancel}
                            className="text-blue-600 hover:text-blue-800"
                        >
                            ×
                        </button>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                                Field Label
                            </label>
                            <input
                                type="text"
                                value={fieldData.label}
                                onChange={(e) => setFieldData({ ...fieldData, label: e.target.value })}
                                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                                Field Name (ID)
                            </label>
                            <input
                                type="text"
                                value={fieldData.name}
                                onChange={(e) => setFieldData({ ...fieldData, name: e.target.value.replace(/[^a-z0-9_]/g, '') })}
                                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                                Placeholder Text
                            </label>
                            <input
                                type="text"
                                value={fieldData.placeholder || ''}
                                onChange={(e) => setFieldData({ ...fieldData, placeholder: e.target.value })}
                                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                            />
                        </div>

                        <div className="flex items-center">
                            <input
                                type="checkbox"
                                checked={fieldData.required}
                                onChange={(e) => setFieldData({ ...fieldData, required: e.target.checked })}
                                className="mr-2"
                            />
                            <label className="text-sm font-medium text-gray-700">
                                Required field
                            </label>
                        </div>
                    </div>

                    {/* Options for select/radio fields */}
                    {(fieldData.type === 'select' || fieldData.type === 'radio') && (
                        <div>
                            <div className="flex items-center justify-between mb-2">
                                <label className="block text-sm font-medium text-gray-700">
                                    Options
                                </label>
                                <button
                                    onClick={addOption}
                                    className="text-xs bg-blue-600 text-white px-2 py-1 rounded hover:bg-blue-700"
                                >
                                    + Add Option
                                </button>
                            </div>
                            <div className="space-y-2">
                                {fieldData.options?.map((option, index) => (
                                    <div key={index} className="flex items-center space-x-2">
                                        <input
                                            type="text"
                                            value={option}
                                            onChange={(e) => updateOption(index, e.target.value)}
                                            className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                                        />
                                        <button
                                            onClick={() => removeOption(index)}
                                            className="text-red-600 hover:text-red-800"
                                        >
                                            <Trash2 className="w-4 h-4" />
                                        </button>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    <div className="flex space-x-3">
                        <button
                            onClick={() => onUpdate(fieldData)}
                            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                        >
                            Update Field
                        </button>
                        <button
                            onClick={onCancel}
                            className="px-4 py-2 bg-gray-300 text-gray-700 rounded-lg hover:bg-gray-400"
                        >
                            Cancel
                        </button>
                    </div>
                </div>
            </div>
        )
    }

    return (
        <BaseWidgetEditor
            config={config}
            onChange={onChange}
            errors={errors}
            widgetType={widgetType}
        >
            {({
                config: localConfig,
                handleFieldChange,
                renderTextField,
                renderTextArea,
                renderUrlField
            }) => (
                <>
                    {/* Form Title */}
                    {renderTextField('form_title', 'Form Title', {
                        placeholder: 'Enter a title for your form'
                    })}

                    {/* Form Description */}
                    {renderTextArea('form_description', 'Form Description (Optional)', {
                        placeholder: 'Optional description or instructions for form users',
                        rows: 3
                    })}

                    {/* Form Fields Builder */}
                    <div className="space-y-4">
                        <div className="flex items-center justify-between">
                            <label className="block text-sm font-medium text-gray-700">
                                Form Fields
                            </label>
                            <div className="text-xs text-gray-500">
                                {(localConfig.fields || []).length} fields
                            </div>
                        </div>

                        {/* Field Type Selector */}
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                            {fieldTypes.map(type => (
                                <button
                                    key={type.value}
                                    onClick={() => addField(type.value)}
                                    className="flex items-center space-x-2 p-3 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors text-left"
                                >
                                    <span>{type.icon}</span>
                                    <div>
                                        <div className="text-sm font-medium">{type.label}</div>
                                    </div>
                                </button>
                            ))}
                        </div>

                        {/* Field Editor */}
                        {editingField && (
                            <FieldEditor
                                field={editingField}
                                onUpdate={(updatedField) => {
                                    updateField(editingField.id, updatedField)
                                    setEditingField(null)
                                }}
                                onCancel={() => setEditingField(null)}
                            />
                        )}

                        {/* Fields List */}
                        <div className="space-y-2">
                            {(localConfig.fields || []).map((field, index) => (
                                <div key={field.id} className="flex items-center justify-between p-3 border border-gray-200 rounded-lg bg-gray-50">
                                    <div className="flex items-center space-x-3">
                                        <GripVertical className="w-4 h-4 text-gray-400" />
                                        <div className="flex-1">
                                            <div className="font-medium text-sm">{field.label}</div>
                                            <div className="text-xs text-gray-500">
                                                {field.type} • {field.name}
                                                {field.required && ' • Required'}
                                            </div>
                                        </div>
                                    </div>
                                    <div className="flex items-center space-x-1">
                                        <button
                                            onClick={() => moveField(field.id, 'up')}
                                            disabled={index === 0}
                                            className="p-1 text-gray-400 hover:text-gray-600 disabled:opacity-30"
                                        >
                                            ↑
                                        </button>
                                        <button
                                            onClick={() => moveField(field.id, 'down')}
                                            disabled={index === (localConfig.fields || []).length - 1}
                                            className="p-1 text-gray-400 hover:text-gray-600 disabled:opacity-30"
                                        >
                                            ↓
                                        </button>
                                        <button
                                            onClick={() => setEditingField(field)}
                                            className="p-1 text-gray-400 hover:text-blue-600"
                                        >
                                            ⚙️
                                        </button>
                                        <button
                                            onClick={() => deleteField(field.id)}
                                            className="p-1 text-gray-400 hover:text-red-600"
                                        >
                                            <Trash2 className="w-4 h-4" />
                                        </button>
                                    </div>
                                </div>
                            ))}

                            {(!localConfig.fields || localConfig.fields.length === 0) && (
                                <div className="text-center text-gray-500 py-8 border-2 border-dashed border-gray-300 rounded-lg">
                                    <Settings className="w-8 h-8 mx-auto mb-2 text-gray-400" />
                                    <p>No form fields added yet</p>
                                    <p className="text-xs">Click a field type above to get started</p>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Form Settings */}
                    <div className="space-y-4 p-4 bg-gray-50 rounded-lg border border-gray-200">
                        <h4 className="text-sm font-medium text-gray-900 flex items-center space-x-2">
                            <Settings className="w-4 h-4" />
                            <span>Form Settings</span>
                        </h4>

                        {renderUrlField('submit_url', 'Submit URL (Optional)', {
                            placeholder: 'https://example.com/submit'
                        })}

                        {renderTextField('submit_button_text', 'Submit Button Text', {
                            placeholder: 'Submit'
                        })}

                        {renderTextField('success_message', 'Success Message', {
                            placeholder: 'Thank you for your submission!'
                        })}
                    </div>

                    {/* Form Preview */}
                    <div className="space-y-2">
                        <label className="block text-sm font-medium text-gray-700">
                            Form Preview
                        </label>
                        <div className="border border-gray-200 rounded-lg p-4 bg-gray-50">
                            {renderFormPreview()}
                        </div>
                        <div className="text-xs text-gray-500 space-y-1">
                            <p>• Preview shows how the form will appear to users</p>
                            <p>• Fields are disabled in preview mode</p>
                            <p>• Required fields are marked with a red asterisk</p>
                        </div>
                    </div>

                    {/* Form Tips */}
                    <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                        <div className="flex items-start space-x-2">
                            <Send className="w-4 h-4 text-blue-600 mt-0.5 flex-shrink-0" />
                            <div className="space-y-1">
                                <h4 className="text-sm font-medium text-blue-900">Form Best Practices</h4>
                                <ul className="text-xs text-blue-800 space-y-1">
                                    <li>• Keep forms as short as possible for better completion rates</li>
                                    <li>• Use clear, descriptive field labels</li>
                                    <li>• Mark required fields clearly</li>
                                    <li>• Provide helpful placeholder text</li>
                                    <li>• Group related fields together logically</li>
                                    <li>• Test form submission functionality before going live</li>
                                </ul>
                            </div>
                        </div>
                    </div>
                </>
            )}
        </BaseWidgetEditor>
    )
}

export default FormsEditor 