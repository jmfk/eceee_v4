import React, { useState, useEffect } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Plus, Trash2, Settings, Hash, Type, Calendar, ToggleLeft } from 'lucide-react'
import { objectTypesApi } from '../api/objectStorage'
import VisualSchemaEditor from './VisualSchemaEditor'
import InlineImageUpload from './InlineImageUpload'
import { validateFieldName } from '../utils/schemaValidation'

const FIELD_TYPES = [
    { value: 'text', label: 'Text', icon: Type },
    { value: 'rich_text', label: 'Rich Text', icon: Type },
    { value: 'number', label: 'Number', icon: Hash },
    { value: 'date', label: 'Date', icon: Calendar },
    { value: 'datetime', label: 'Date & Time', icon: Calendar },
    { value: 'boolean', label: 'Boolean', icon: ToggleLeft },
    { value: 'image', label: 'Image', icon: Type },
    { value: 'file', label: 'File', icon: Type },
    { value: 'url', label: 'URL', icon: Type },
    { value: 'email', label: 'Email', icon: Type },
    { value: 'choice', label: 'Choice', icon: Type },
    { value: 'multi_choice', label: 'Multiple Choice', icon: Type },
    { value: 'user_reference', label: 'User Reference', icon: Type },
    { value: 'object_reference', label: 'Object Reference', icon: Type }
]

const ObjectTypeForm = ({ objectType, onSubmit, onCancel, isSubmitting }) => {
    const [formData, setFormData] = useState({
        name: '',
        label: '',
        pluralLabel: '',
        description: '',
        isActive: true,
        schema: { fields: [] },
        slotConfiguration: { slots: [] },
        allowedChildTypes: [],
        hierarchyLevel: 'both', // 'top_level_only', 'sub_object_only', 'both'
        metadata: {}
    })

    const [errors, setErrors] = useState({})
    const [activeTab, setActiveTab] = useState('basic')

    // Load existing object types for child type selection
    const { data: existingTypesResponse } = useQuery({
        queryKey: ['objectTypes'],
        queryFn: () => objectTypesApi.list()
    })

    const existingTypes = existingTypesResponse?.data?.results || existingTypesResponse?.data || []

    useEffect(() => {

        if (objectType) {
            // Convert allowedChildTypes from object array to name array for form handling
            const allowedChildTypeNames = objectType.allowedChildTypes
                ? objectType.allowedChildTypes.map(childType =>
                    typeof childType === 'string' ? childType : childType.name
                )
                : []

            setFormData({
                name: objectType.name || '',
                label: objectType.label || '',
                pluralLabel: objectType.pluralLabel || '',
                description: objectType.description || '',
                isActive: objectType.isActive ?? true,
                schema: objectType.schema || { fields: [] },
                slotConfiguration: objectType.slotConfiguration || { slots: [] },
                allowedChildTypes: allowedChildTypeNames,
                hierarchyLevel: objectType.hierarchyLevel || 'both',
                metadata: objectType.metadata || {}
            })
        }
    }, [objectType])

    // Only reset tab to 'basic' when creating a new object type (objectType becomes null)
    // or when switching to a different object type (different ID)
    const [previousObjectTypeId, setPreviousObjectTypeId] = useState(null)

    useEffect(() => {
        const currentObjectTypeId = objectType?.id || null

        // Reset to basic tab only when:
        // 1. Creating new (objectType becomes null from having an ID)
        // 2. Switching to a different object type (different ID)
        if (previousObjectTypeId !== currentObjectTypeId) {
            if (!currentObjectTypeId) {
                // Creating new object type
                setActiveTab('basic')
            } else if (previousObjectTypeId && previousObjectTypeId !== currentObjectTypeId) {
                // Switching to different existing object type
                setActiveTab('basic')
            }
            // If going from null to an ID (editing existing), preserve current tab
        }

        setPreviousObjectTypeId(currentObjectTypeId)
    }, [objectType?.id, previousObjectTypeId])

    const handleInputChange = (field, value) => {
        setFormData(prev => ({ ...prev, [field]: value }))

        // Clear field error when user starts typing
        if (errors[field]) {
            setErrors(prev => ({ ...prev, [field]: null }))
        }

        // Auto-generate plural label if not manually set
        if (field === 'label' && !objectType) {
            const plural = value.endsWith('s') ? value : `${value}s`
            setFormData(prev => ({ ...prev, pluralLabel: plural }))
        }

        // Auto-generate name from label if not manually set
        if (field === 'label' && !objectType) {
            const name = value.toLowerCase().replace(/[^a-z0-9]/g, '_').replace(/_+/g, '_').replace(/^_|_$/g, '')
            setFormData(prev => ({ ...prev, name }))
        }
    }

    const validateForm = () => {
        const newErrors = {}

        // Required fields
        if (!formData.name?.trim()) {
            newErrors.name = 'Name is required'
        } else if (!/^[a-z][a-z0-9_]*$/.test(formData.name)) {
            newErrors.name = 'Name must start with a letter and contain only lowercase letters, numbers, and underscores'
        }

        if (!formData.label?.trim()) {
            newErrors.label = 'Label is required'
        }

        if (!formData.pluralLabel?.trim()) {
            newErrors.pluralLabel = 'Plural label is required'
        }

        // Validate schema fields
        if (formData.schema?.fields) {
            const fieldNames = new Set()
            formData.schema.fields.forEach((field, index) => {
                if (!field.name?.trim()) {
                    newErrors[`schema_field_${index}_name`] = 'Field name is required'
                } else if (!validateFieldName(field.name)) {
                    newErrors[`schema_field_${index}_name`] = 'Invalid field name format'
                } else if (fieldNames.has(field.name)) {
                    newErrors[`schema_field_${index}_name`] = 'Duplicate field name'
                }
                fieldNames.add(field.name)

                if (!field.type) {
                    newErrors[`schema_field_${index}_type`] = 'Field type is required'
                }
            })
        }

        // Validate slot configuration
        if (formData.slotConfiguration?.slots) {
            const slotNames = new Set()
            formData.slotConfiguration.slots.forEach((slot, index) => {
                if (!slot.name?.trim()) {
                    newErrors[`slot_${index}_name`] = 'Slot name is required'
                } else if (slotNames.has(slot.name)) {
                    newErrors[`slot_${index}_name`] = 'Duplicate slot name'
                }
                slotNames.add(slot.name)

                if (!slot.label?.trim()) {
                    newErrors[`slot_${index}_label`] = 'Slot label is required'
                }
            })
        }

        setErrors(newErrors)
        return Object.keys(newErrors).length === 0
    }



    const handleSubmit = async (e) => {
        e.preventDefault()

        if (validateForm()) {
            // Submit as JSON data - image URL is already handled by InlineImageUpload
            onSubmit(formData)
        }
    }

    const handleSchemaChange = (newSchema) => {
        setFormData(prev => ({ ...prev, schema: newSchema }))
    }

    const handleSlotChange = (slots) => {
        setFormData(prev => ({
            ...prev,
            slotConfiguration: { slots }
        }))
    }

    return (
        <form onSubmit={handleSubmit} className="space-y-6">
            {/* Tab Navigation */}
            <div className="border-b border-gray-200">
                <nav className="-mb-px flex space-x-8">
                    {[
                        { id: 'basic', label: 'Basic Info' },
                        { id: 'schema', label: 'Schema Fields' },
                        { id: 'slots', label: 'Widget Slots' },
                        { id: 'relationships', label: 'Relationships' }
                    ].map((tab) => (
                        <button
                            key={tab.id}
                            type="button"
                            onClick={() => setActiveTab(tab.id)}
                            className={`py-2 px-1 border-b-2 font-medium text-sm ${activeTab === tab.id
                                ? 'border-blue-500 text-blue-600'
                                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                                }`}
                        >
                            {tab.label}
                        </button>
                    ))}
                </nav>
            </div>

            {/* Basic Info Tab */}
            {activeTab === 'basic' && (
                <div className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                                Name <span className="text-red-500">*</span>
                            </label>
                            <input
                                type="text"
                                value={formData.name}
                                onChange={(e) => handleInputChange('name', e.target.value)}
                                className={`w-full px-3 py-2 border rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${errors.name ? 'border-red-300' : 'border-gray-300'
                                    }`}
                                placeholder="e.g., news, blog, event"
                                disabled={!!objectType} // Don't allow editing name for existing types
                            />
                            {errors.name && <p className="text-red-600 text-sm mt-1">{errors.name}</p>}
                            <p className="text-gray-500 text-xs mt-1">
                                Unique identifier (lowercase, underscores allowed)
                            </p>
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                                Label <span className="text-red-500">*</span>
                            </label>
                            <input
                                type="text"
                                value={formData.label}
                                onChange={(e) => handleInputChange('label', e.target.value)}
                                className={`w-full px-3 py-2 border rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${errors.label ? 'border-red-300' : 'border-gray-300'
                                    }`}
                                placeholder="e.g., News Article, Blog Post"
                            />
                            {errors.label && <p className="text-red-600 text-sm mt-1">{errors.label}</p>}
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                                Plural Label <span className="text-red-500">*</span>
                            </label>
                            <input
                                type="text"
                                value={formData.pluralLabel}
                                onChange={(e) => handleInputChange('pluralLabel', e.target.value)}
                                className={`w-full px-3 py-2 border rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${errors.pluralLabel ? 'border-red-300' : 'border-gray-300'
                                    }`}
                                placeholder="e.g., News Articles, Blog Posts"
                            />
                            {errors.pluralLabel && <p className="text-red-600 text-sm mt-1">{errors.pluralLabel}</p>}
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                                Status
                            </label>
                            <div className="flex items-center">
                                <input
                                    type="checkbox"
                                    checked={formData.isActive}
                                    onChange={(e) => handleInputChange('isActive', e.target.checked)}
                                    className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                                />
                                <label className="ml-2 text-sm text-gray-700">
                                    Active (available for use)
                                </label>
                            </div>
                        </div>
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                            Description
                        </label>
                        <textarea
                            value={formData.description}
                            onChange={(e) => handleInputChange('description', e.target.value)}
                            rows={3}
                            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                            placeholder="Describe what this object type represents..."
                        />
                    </div>

                    {/* Icon Image Upload */}
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-3">
                            Icon Image
                        </label>
                        {objectType?.id ? (
                            <InlineImageUpload
                                currentImageUrl={objectType?.iconImage}
                                objectTypeId={objectType?.id}
                                placeholder="Upload icon image"
                                disabled={isSubmitting}
                            />
                        ) : (
                            <div className="bg-gray-50 border border-gray-200 rounded-md p-4 text-center">
                                <p className="text-gray-500 text-sm">
                                    Save the object type first to upload an icon image
                                </p>
                            </div>
                        )}
                        {errors.iconImage && (
                            <p className="text-red-600 text-sm mt-1">{errors.iconImage}</p>
                        )}
                    </div>
                </div>
            )}

            {/* Schema Fields Tab */}
            {activeTab === 'schema' && (
                <div>
                    <h3 className="text-lg font-medium text-gray-900 mb-4">Schema Fields</h3>
                    <p className="text-gray-600 mb-6">
                        Define the data fields that instances of this object type will have.
                    </p>
                    <VisualSchemaEditor
                        schema={formData.schema}
                        onChange={handleSchemaChange}
                        fieldTypes={FIELD_TYPES}
                    />
                </div>
            )}

            {/* Widget Slots Tab */}
            {activeTab === 'slots' && (
                <div>
                    <h3 className="text-lg font-medium text-gray-900 mb-4">Widget Slots</h3>
                    <p className="text-gray-600 mb-6">
                        Define widget slots where content editors can add widgets to object instances.
                    </p>
                    <SlotEditor
                        slots={formData.slotConfiguration.slots}
                        onChange={handleSlotChange}
                        errors={errors}
                    />
                </div>
            )}

            {/* Relationships Tab */}
            {activeTab === 'relationships' && (
                <div className="space-y-8">
                    {/* Hierarchy Level Configuration */}
                    <div>
                        <h3 className="text-lg font-medium text-gray-900 mb-4">Hierarchy Level</h3>
                        <p className="text-gray-600 mb-6">
                            Configure where this object type can appear in the content hierarchy.
                        </p>

                        <div className="space-y-3">
                            <label className="flex items-center">
                                <input
                                    type="radio"
                                    name="hierarchyLevel"
                                    value="top_level_only"
                                    checked={formData.hierarchyLevel === 'top_level_only'}
                                    onChange={(e) => handleInputChange('hierarchyLevel', e.target.value)}
                                    className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300"
                                />
                                <div className="ml-3">
                                    <span className="text-sm font-medium text-gray-900">Top-level only</span>
                                    <p className="text-sm text-gray-500">Can only exist at the root level, cannot be a child of other objects</p>
                                </div>
                            </label>

                            <label className="flex items-center">
                                <input
                                    type="radio"
                                    name="hierarchyLevel"
                                    value="sub_object_only"
                                    checked={formData.hierarchyLevel === 'sub_object_only'}
                                    onChange={(e) => handleInputChange('hierarchyLevel', e.target.value)}
                                    className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300"
                                />
                                <div className="ml-3">
                                    <span className="text-sm font-medium text-gray-900">Sub-object only</span>
                                    <p className="text-sm text-gray-500">Must be a child of another object, cannot exist at root level</p>
                                </div>
                            </label>

                            <label className="flex items-center">
                                <input
                                    type="radio"
                                    name="hierarchyLevel"
                                    value="both"
                                    checked={formData.hierarchyLevel === 'both'}
                                    onChange={(e) => handleInputChange('hierarchyLevel', e.target.value)}
                                    className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300"
                                />
                                <div className="ml-3">
                                    <span className="text-sm font-medium text-gray-900">Both levels</span>
                                    <p className="text-sm text-gray-500">Can exist at root level or as a child of other objects</p>
                                </div>
                            </label>
                        </div>
                    </div>

                    {/* Child Type Selection */}
                    <div>
                        <h3 className="text-lg font-medium text-gray-900 mb-4">Allowed Child Types</h3>
                        <p className="text-gray-600 mb-6">
                            Select which object types can be children of this type in hierarchical structures.
                        </p>
                        <ChildTypeSelector
                            selectedTypes={formData.allowedChildTypes}
                            availableTypes={existingTypes.filter(type =>
                                type.name !== formData.name &&
                                (type.hierarchyLevel === 'sub_object_only' || type.hierarchyLevel === 'both')
                            )}
                            onChange={(types) => handleInputChange('allowedChildTypes', types)}
                            hierarchyLevel={formData.hierarchyLevel}
                        />
                    </div>
                </div>
            )}

            {/* Form Actions */}
            <div className="flex justify-end space-x-3 px-6 py-4 border-t bg-gray-50">
                <button
                    type="button"
                    onClick={onCancel}
                    className="px-4 py-2 text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
                    disabled={isSubmitting}
                >
                    Cancel
                </button>
                <button
                    type="submit"
                    disabled={isSubmitting}
                    className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                    {isSubmitting ? (
                        <>
                            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                            Saving...
                        </>
                    ) : (
                        <>
                            <Settings className="w-4 h-4 mr-2" />
                            {objectType ? 'Update Object Type' : 'Create Object Type'}
                        </>
                    )}
                </button>
            </div>
        </form>
    )
}

// Slot Editor Component
const SlotEditor = ({ slots = [], onChange, errors }) => {
    const addSlot = () => {
        const newSlot = {
            name: '',
            label: '',
            allowedWidgets: [],
            maxWidgets: null,
            required: false
        }
        onChange([...slots, newSlot])
    }

    const updateSlot = (index, field, value) => {
        const updatedSlots = slots.map((slot, i) =>
            i === index ? { ...slot, [field]: value } : slot
        )
        onChange(updatedSlots)
    }

    const removeSlot = (index) => {
        onChange(slots.filter((_, i) => i !== index))
    }

    return (
        <div className="space-y-4">
            {slots.map((slot, index) => (
                <div key={index} className="border border-gray-200 rounded-md p-4">
                    <div className="flex justify-between items-center mb-3">
                        <h4 className="font-medium text-gray-900">Slot {index + 1}</h4>
                        <button
                            type="button"
                            onClick={() => removeSlot(index)}
                            className="text-red-600 hover:text-red-800"
                        >
                            <Trash2 className="h-4 w-4" />
                        </button>
                    </div>

                    <div className="grid grid-cols-2 gap-4 mb-3">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                                Slot Name <span className="text-red-500">*</span>
                            </label>
                            <input
                                type="text"
                                value={slot.name}
                                onChange={(e) => updateSlot(index, 'name', e.target.value)}
                                className={`w-full px-3 py-2 border rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${errors[`slot_${index}_name`] ? 'border-red-300' : 'border-gray-300'
                                    }`}
                                placeholder="e.g., main_content, sidebar"
                            />
                            {errors[`slot_${index}_name`] && (
                                <p className="text-red-600 text-sm mt-1">{errors[`slot_${index}_name`]}</p>
                            )}
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                                Display Label <span className="text-red-500">*</span>
                            </label>
                            <input
                                type="text"
                                value={slot.label}
                                onChange={(e) => updateSlot(index, 'label', e.target.value)}
                                className={`w-full px-3 py-2 border rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${errors[`slot_${index}_label`] ? 'border-red-300' : 'border-gray-300'
                                    }`}
                                placeholder="e.g., Main Content, Sidebar"
                            />
                            {errors[`slot_${index}_label`] && (
                                <p className="text-red-600 text-sm mt-1">{errors[`slot_${index}_label`]}</p>
                            )}
                        </div>
                    </div>

                    <div className="flex items-center space-x-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                                Max Widgets
                            </label>
                            <input
                                type="number"
                                value={slot.maxWidgets || ''}
                                onChange={(e) => updateSlot(index, 'maxWidgets', e.target.value ? parseInt(e.target.value) : null)}
                                className="w-20 px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                                placeholder="∞"
                                min="1"
                            />
                        </div>

                        <div className="flex items-center">
                            <input
                                type="checkbox"
                                checked={slot.required || false}
                                onChange={(e) => updateSlot(index, 'required', e.target.checked)}
                                className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                            />
                            <label className="ml-2 text-sm text-gray-700">
                                Required slot
                            </label>
                        </div>
                    </div>
                </div>
            ))}

            <button
                type="button"
                onClick={addSlot}
                className="w-full border-2 border-dashed border-gray-300 rounded-md p-4 text-gray-600 hover:border-gray-400 hover:text-gray-700 transition-colors flex items-center justify-center"
            >
                <Plus className="h-4 w-4 mr-2" />
                Add Widget Slot
            </button>
        </div>
    )
}

// Child Type Selector Component
const ChildTypeSelector = ({ selectedTypes, availableTypes, onChange, hierarchyLevel }) => {

    const toggleType = (typeName) => {
        const isSelected = selectedTypes.includes(typeName)
        if (isSelected) {
            onChange(selectedTypes.filter(name => name !== typeName))
        } else {
            onChange([...selectedTypes, typeName])
        }
    }



    return (
        <div className="space-y-2">
            {availableTypes.length === 0 ? (
                <div className="bg-gray-50 border border-gray-200 rounded-md p-4">
                    <p className="text-gray-500 text-sm">
                        No object types available as children. Only object types configured as "Sub-object only" or "Both levels" can be children of other types.
                    </p>
                </div>
            ) : (
                <>
                    <p className="text-sm text-gray-600 mb-4">
                        {availableTypes.length} object type{availableTypes.length !== 1 ? 's' : ''} available as potential children:
                    </p>
                    {availableTypes.map((type) => (
                        <div key={type.name} className="flex items-center p-3 bg-gray-50 rounded-md hover:bg-gray-100 transition-colors">
                            <input
                                type="checkbox"
                                checked={selectedTypes.includes(type.name)}
                                onChange={() => toggleType(type.name)}
                                className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                            />
                            <div className="ml-3 flex-1">
                                <div className="flex items-center justify-between">
                                    <div>
                                        <span className="font-medium text-gray-900">{type.label}</span>
                                        <span className="text-gray-500 ml-2">({type.name})</span>
                                    </div>
                                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${type.hierarchyLevel === 'sub_object_only'
                                        ? 'bg-orange-100 text-orange-800'
                                        : 'bg-blue-100 text-blue-800'
                                        }`}>
                                        {type.hierarchyLevel === 'sub_object_only' ? 'Sub-object only' : 'Both levels'}
                                    </span>
                                </div>
                                {type.description && (
                                    <p className="text-sm text-gray-600 mt-1">{type.description}</p>
                                )}
                            </div>
                        </div>
                    ))}
                </>
            )}
        </div>
    )
}

export default ObjectTypeForm
