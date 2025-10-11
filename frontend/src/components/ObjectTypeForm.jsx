import React, { useState, useEffect, useCallback } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Plus, Trash2, Settings, Hash, Type, Calendar, ToggleLeft, Check, Users, CheckCircle, XCircle, FolderOpen } from 'lucide-react'
import { objectTypesApi } from '../api/objectStorage'
import { namespacesApi } from '../api'
import { SchemaEditor } from './schema-editor'
import InlineImageUpload from './InlineImageUpload'
import { validateFieldName } from '../utils/schemaValidation'
import { getAllFieldTypes } from '../utils/fieldTypeRegistry'
import {
    getWidgetIcon,
    getWidgetCategory,
    getWidgetDescription
} from '../widgets'

// Get field types from the registry
const FIELD_TYPES = getAllFieldTypes().map(fieldType => ({
    value: fieldType.key,
    label: fieldType.label,
    icon: fieldType.icon
}))

const ObjectTypeForm = ({ objectType, onSubmit, onCancel, isSubmitting, activeTab = 'basic', onTabChange }) => {
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
        namespaceId: null, // Use null for default namespace
        metadata: {}
    })

    const [errors, setErrors] = useState({})
    const [hasUnsavedSchemaChanges, setHasUnsavedSchemaChanges] = useState(false)
    const [originalSchema, setOriginalSchema] = useState(null)
    const [isSavingSchema, setIsSavingSchema] = useState(false)
    const [schemaError, setSchemaError] = useState(null)
    const [schemaValidationErrors, setSchemaValidationErrors] = useState({})

    const [hasUnsavedBasicChanges, setHasUnsavedBasicChanges] = useState(false)
    const [originalBasicInfo, setOriginalBasicInfo] = useState(null)
    const [isSavingBasicInfo, setIsSavingBasicInfo] = useState(false)
    const [basicInfoError, setBasicInfoError] = useState(null)

    const [hasUnsavedSlotsChanges, setHasUnsavedSlotsChanges] = useState(false)
    const [originalSlotConfiguration, setOriginalSlotConfiguration] = useState(null)
    const [isSavingSlots, setIsSavingSlots] = useState(false)
    const [slotsError, setSlotsError] = useState(null)
    const [slotsWarnings, setSlotsWarnings] = useState([])

    const [hasUnsavedRelationshipsChanges, setHasUnsavedRelationshipsChanges] = useState(false)
    const [originalRelationships, setOriginalRelationships] = useState(null)
    const [isSavingRelationships, setIsSavingRelationships] = useState(false)
    const [relationshipsError, setRelationshipsError] = useState(null)

    // Load existing object types for child type selection
    const { data: existingTypesResponse } = useQuery({
        queryKey: ['objectTypes'],
        queryFn: () => objectTypesApi.list()
    })

    // Load available namespaces
    const { data: namespacesResponse } = useQuery({
        queryKey: ['namespaces'],
        queryFn: () => namespacesApi.list()
    })

    const existingTypes = existingTypesResponse?.data?.results || existingTypesResponse?.data || []
    const availableNamespaces = namespacesResponse?.results || namespacesResponse || []

    useEffect(() => {

        if (objectType) {
            // Convert allowedChildTypes from object array to name array for form handling
            const allowedChildTypeNames = objectType.allowedChildTypes
                ? objectType.allowedChildTypes.map(childType =>
                    typeof childType === 'string' ? childType : childType.name
                )
                : []

            const schema = objectType.schema || { fields: [] }
            setFormData({
                name: objectType.name || '',
                label: objectType.label || '',
                pluralLabel: objectType.pluralLabel || '',
                description: objectType.description || '',
                isActive: objectType.isActive ?? true,
                schema: schema,
                slotConfiguration: objectType.slotConfiguration || { slots: [] },
                allowedChildTypes: allowedChildTypeNames,
                hierarchyLevel: objectType.hierarchyLevel || 'both',
                namespaceId: objectType.namespace?.id || null,
                metadata: objectType.metadata || {}
            })
            setOriginalSchema(JSON.parse(JSON.stringify(schema))) // Deep copy
            setHasUnsavedSchemaChanges(false)

            // Track original basic info
            const basicInfo = {
                name: objectType.name || '',
                label: objectType.label || '',
                pluralLabel: objectType.pluralLabel || '',
                description: objectType.description || '',
                isActive: objectType.isActive ?? true,
                hierarchyLevel: objectType.hierarchyLevel || 'both',
                namespaceId: objectType.namespace?.id || null
            }
            setOriginalBasicInfo(JSON.parse(JSON.stringify(basicInfo)))
            setHasUnsavedBasicChanges(false)

            // Track original slot configuration
            const slotConfig = objectType.slotConfiguration || { slots: [] }
            setOriginalSlotConfiguration(JSON.parse(JSON.stringify(slotConfig)))
            setHasUnsavedSlotsChanges(false)

            // Track original relationships
            const relationships = {
                hierarchyLevel: objectType.hierarchyLevel || 'both',
                allowedChildTypes: allowedChildTypeNames
            }
            setOriginalRelationships(JSON.parse(JSON.stringify(relationships)))
            setHasUnsavedRelationshipsChanges(false)
        } else {
            // For new object types
            const emptySchema = { fields: [] }
            setOriginalSchema(JSON.parse(JSON.stringify(emptySchema)))
            setHasUnsavedSchemaChanges(false)

            const emptyBasicInfo = {
                name: '',
                label: '',
                pluralLabel: '',
                description: '',
                isActive: true,
                hierarchyLevel: 'both'
            }
            setOriginalBasicInfo(JSON.parse(JSON.stringify(emptyBasicInfo)))
            setHasUnsavedBasicChanges(false)

            const emptySlotConfig = { slots: [] }
            setOriginalSlotConfiguration(JSON.parse(JSON.stringify(emptySlotConfig)))
            setHasUnsavedSlotsChanges(false)
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
                // Creating new object type - navigate to basic tab if onTabChange is available
                onTabChange?.('basic')
            } else if (previousObjectTypeId && previousObjectTypeId !== currentObjectTypeId) {
                // Switching to different existing object type - navigate to basic tab
                onTabChange?.('basic')
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

        // Track relationships changes
        if (['hierarchyLevel', 'allowedChildTypes'].includes(field)) {
            // Check if relationships have changed from original
            const currentRelationships = {
                hierarchyLevel: field === 'hierarchyLevel' ? value : formData.hierarchyLevel,
                allowedChildTypes: field === 'allowedChildTypes' ? value : formData.allowedChildTypes
            }
            const hasChanges = JSON.stringify(currentRelationships) !== JSON.stringify(originalRelationships)
            setHasUnsavedRelationshipsChanges(hasChanges)

            // Clear any existing relationships errors when user makes changes
            if (relationshipsError) {
                setRelationshipsError(null)
            }
        }

        // Check if basic info has changed
        if (['name', 'label', 'pluralLabel', 'description', 'isActive', 'hierarchyLevel', 'namespaceId'].includes(field)) {
            setTimeout(() => {
                const currentBasicInfo = {
                    name: formData.name,
                    label: formData.label,
                    pluralLabel: formData.pluralLabel,
                    description: formData.description,
                    isActive: formData.isActive,
                    hierarchyLevel: formData.hierarchyLevel,
                    namespaceId: formData.namespaceId
                }

                // Apply the current change
                currentBasicInfo[field] = value

                const hasChanges = JSON.stringify(currentBasicInfo) !== JSON.stringify(originalBasicInfo)
                setHasUnsavedBasicChanges(hasChanges)

                // Clear any existing basic info errors when user makes changes
                if (basicInfoError) {
                    setBasicInfoError(null)
                }
            }, 0)
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

        // Check if schema has changed from original
        const hasChanges = JSON.stringify(newSchema) !== JSON.stringify(originalSchema)
        setHasUnsavedSchemaChanges(hasChanges)

        // Clear any existing schema errors when user makes changes
        if (schemaError) {
            setSchemaError(null)
        }
    }

    const handleSchemaValidationChange = (isValid, errors) => {
        setSchemaValidationErrors(errors)
    }

    const handleSlotChange = (slots) => {
        const newSlotConfig = { slots }
        setFormData(prev => ({
            ...prev,
            slotConfiguration: newSlotConfig
        }))

        // Check if slot configuration has changed
        const hasChanges = JSON.stringify(newSlotConfig) !== JSON.stringify(originalSlotConfiguration)
        setHasUnsavedSlotsChanges(hasChanges)

        // Clear any existing slots errors when user makes changes
        if (slotsError) {
            setSlotsError(null)
        }
    }

    const validateSchema = (schema) => {
        // Basic validation to match backend expectations
        if (!schema || typeof schema !== 'object') {
            return 'Schema must be a valid object'
        }

        // Check for properties object
        if (!schema.properties || typeof schema.properties !== 'object') {
            return 'Schema must have a "properties" object'
        }

        // Validate propertyOrder if present
        if (schema.propertyOrder && !Array.isArray(schema.propertyOrder)) {
            return 'Schema "propertyOrder" must be an array'
        }

        // Validate required array if present
        if (schema.required && !Array.isArray(schema.required)) {
            return 'Schema "required" must be an array'
        }

        // Validate each property in the properties object
        for (const [propName, propDef] of Object.entries(schema.properties)) {
            // Validate property name format
            if (!/^[a-zA-Z][a-zA-Z0-9_]*$/.test(propName)) {
                return `Property name "${propName}" is invalid. Names must start with a letter and contain only letters, numbers, and underscores.`
            }

            if (!propDef || typeof propDef !== 'object') {
                return `Property "${propName}" must be a valid object`
            }
            if (!propDef.type || typeof propDef.type !== 'string') {
                return `Property "${propName}" must have a valid type`
            }
        }

        // Validate required array references
        if (schema.required) {
            for (const requiredProp of schema.required) {
                if (!(requiredProp in schema.properties)) {
                    return `Required property "${requiredProp}" not found in properties`
                }
            }
        }

        // Validate propertyOrder references
        if (schema.propertyOrder) {
            for (const orderedProp of schema.propertyOrder) {
                if (!(orderedProp in schema.properties)) {
                    return `PropertyOrder property "${orderedProp}" not found in properties`
                }
            }
        }

        return null // No errors
    }

    const handleSaveSchema = async () => {
        if (!objectType || !hasUnsavedSchemaChanges || isSavingSchema) return

        // Client-side validation before sending to backend
        const validationError = validateSchema(formData.schema)
        if (validationError) {
            setSchemaError(`Schema validation error: ${validationError}`)
            return
        }

        // Clear any previous errors
        setSchemaError(null)
        setIsSavingSchema(true)

        try {
            // Use the dedicated schema update endpoint
            const response = await objectTypesApi.updateSchema(objectType.id, formData.schema)

            // Update the original schema to reflect the save
            setOriginalSchema(JSON.parse(JSON.stringify(formData.schema)))
            setHasUnsavedSchemaChanges(false)

            // Schema saved successfully

            // TODO: Add success notification using global notification system
            // addNotification('Schema saved successfully', 'success')

        } catch (error) {
            // Failed to save schema
            let errorMessage = 'Failed to save schema'

            if (error.response?.data?.error) {
                const backendError = error.response.data.error

                // Handle specific validation errors with user-friendly messages
                if (backendError.includes('Invalid schema format')) {
                    errorMessage = 'Invalid schema format. Please ensure your schema has a valid properties array.'
                } else if (backendError.includes('properties')) {
                    errorMessage = 'Schema validation failed. Please check that all properties are properly configured.'
                } else {
                    errorMessage = backendError
                }
            }

            // TODO: Add error notification using global notification system  
            // addNotification(errorMessage, 'error')

            // Set the error in state for display
            setSchemaError(errorMessage)

        } finally {
            setIsSavingSchema(false)
        }
    }

    const handleSaveBasicInfo = async () => {
        if (!objectType || !hasUnsavedBasicChanges || isSavingBasicInfo) return

        setIsSavingBasicInfo(true)

        try {
            const basicInfoData = {
                name: formData.name,
                label: formData.label,
                pluralLabel: formData.pluralLabel,
                description: formData.description,
                isActive: formData.isActive,
                hierarchyLevel: formData.hierarchyLevel,
                namespaceId: formData.namespaceId
            }

            // Use the dedicated basic info update endpoint
            const response = await objectTypesApi.updateBasicInfo(objectType.id, basicInfoData)

            // Update the original basic info to reflect the save
            setOriginalBasicInfo(JSON.parse(JSON.stringify(basicInfoData)))
            setHasUnsavedBasicChanges(false)

            // Basic info saved successfully

        } catch (error) {
            // Failed to save basic info
            let errorMessage = 'Failed to save basic info'

            if (error.response?.data?.error) {
                errorMessage = error.response.data.error
            }

            setBasicInfoError(errorMessage)

        } finally {
            setIsSavingBasicInfo(false)
        }
    }

    const validateSlots = (slotConfiguration) => {
        const slots = slotConfiguration.slots || []

        for (let i = 0; i < slots.length; i++) {
            const slot = slots[i]

            if (!slot.name || slot.name.trim() === '') {
                return `Slot ${i + 1}: Slot Name is required`
            }

            if (!slot.label || slot.label.trim() === '') {
                return `Slot ${i + 1}: Display Label is required`
            }

            // Check for duplicate slot names
            const duplicateIndex = slots.findIndex((s, idx) =>
                idx !== i && s.name === slot.name && s.name.trim() !== ''
            )
            if (duplicateIndex !== -1) {
                return `Slot ${i + 1}: Slot name "${slot.name}" is already used in Slot ${duplicateIndex + 1}`
            }
        }

        return null // No errors
    }

    const handleSaveSlots = async () => {
        if (!objectType || !hasUnsavedSlotsChanges || isSavingSlots) return

        // Validate slots before saving
        const validationError = validateSlots(formData.slotConfiguration)
        if (validationError) {
            setSlotsError(validationError)
            return
        }

        // Clear any previous errors
        setSlotsError(null)
        setIsSavingSlots(true)

        try {
            // Use the dedicated slots update endpoint
            const response = await objectTypesApi.updateSlots(objectType.id, formData.slotConfiguration)

            // Update the original slot configuration to reflect the save
            setOriginalSlotConfiguration(JSON.parse(JSON.stringify(formData.slotConfiguration)))
            setHasUnsavedSlotsChanges(false)

            // Check for warnings in the response
            if (response?.data?.warnings && response.data.warnings.length > 0) {
                setSlotsWarnings(response.data.warnings)
            } else {
                setSlotsWarnings([])
            }

        } catch (error) {
            // Failed to save widget slots
            let errorMessage = 'Failed to save widget slots'

            if (error.response?.data?.error) {
                const backendError = error.response.data.error

                // Handle specific validation errors
                if (backendError.includes('slot')) {
                    errorMessage = 'Slot validation failed. Please check that all slots have valid names and labels.'
                } else {
                    errorMessage = backendError
                }
            }

            setSlotsError(errorMessage)

        } finally {
            setIsSavingSlots(false)
        }
    }

    const handleSaveRelationships = async () => {
        if (!objectType || !hasUnsavedRelationshipsChanges || isSavingRelationships) return

        setIsSavingRelationships(true)

        try {
            // Prepare relationships data
            const relationshipsData = {
                hierarchyLevel: formData.hierarchyLevel,
                allowedChildTypes: formData.allowedChildTypes
            }

            // Use the dedicated relationships update endpoint
            const response = await objectTypesApi.updateRelationships(objectType.id, relationshipsData)

            // Update the original relationships to reflect the save
            setOriginalRelationships(JSON.parse(JSON.stringify(relationshipsData)))
            setHasUnsavedRelationshipsChanges(false)

            // Relationships saved successfully
            // TODO: Add success notification using global notification system
            // addNotification('Relationships saved successfully', 'success')

        } catch (error) {
            console.error('Failed to save relationships:', error)
            const errorMessage = error.response?.data?.error || 'Failed to save relationships'
            setRelationshipsError(errorMessage)

            // TODO: Add error notification using global notification system
            // addNotification(errorMessage, 'error')
        } finally {
            setIsSavingRelationships(false)
        }
    }

    // Navigation guard for unsaved changes
    const handleTabChangeWithGuard = useCallback((newTab) => {
        // Check for unsaved schema changes
        if (activeTab === 'schema' && hasUnsavedSchemaChanges) {
            const confirmLeave = window.confirm(
                'You have unsaved schema changes. Do you want to leave without saving?'
            )
            if (!confirmLeave) {
                return // Don't change tab
            }
        }

        // Check for unsaved basic info changes
        if (activeTab === 'basic' && hasUnsavedBasicChanges) {
            const confirmLeave = window.confirm(
                'You have unsaved basic info changes. Do you want to leave without saving?'
            )
            if (!confirmLeave) {
                return // Don't change tab
            }
        }

        // Check for unsaved slots changes
        if (activeTab === 'slots' && hasUnsavedSlotsChanges) {
            const confirmLeave = window.confirm(
                'You have unsaved widget slots changes. Do you want to leave without saving?'
            )
            if (!confirmLeave) {
                return // Don't change tab
            }
        }

        // Check for unsaved relationships changes
        if (activeTab === 'relationships' && hasUnsavedRelationshipsChanges) {
            const confirmLeave = window.confirm(
                'You have unsaved relationships changes. Do you want to leave without saving?'
            )
            if (!confirmLeave) {
                return // Don't change tab
            }
        }

        onTabChange?.(newTab)
    }, [activeTab, hasUnsavedSchemaChanges, hasUnsavedBasicChanges, hasUnsavedSlotsChanges, hasUnsavedRelationshipsChanges, onTabChange])

    // Browser navigation guard
    useEffect(() => {
        const handleBeforeUnload = (e) => {
            if ((activeTab === 'schema' && hasUnsavedSchemaChanges) ||
                (activeTab === 'basic' && hasUnsavedBasicChanges) ||
                (activeTab === 'slots' && hasUnsavedSlotsChanges) ||
                (activeTab === 'relationships' && hasUnsavedRelationshipsChanges)) {
                e.preventDefault()
                const message = activeTab === 'schema'
                    ? 'You have unsaved schema changes. Are you sure you want to leave?'
                    : activeTab === 'basic'
                        ? 'You have unsaved basic info changes. Are you sure you want to leave?'
                        : activeTab === 'slots'
                            ? 'You have unsaved widget slots changes. Are you sure you want to leave?'
                            : 'You have unsaved relationships changes. Are you sure you want to leave?'
                e.returnValue = message
                return e.returnValue
            }
        }

        window.addEventListener('beforeunload', handleBeforeUnload)
        return () => window.removeEventListener('beforeunload', handleBeforeUnload)
    }, [activeTab, hasUnsavedSchemaChanges, hasUnsavedBasicChanges, hasUnsavedSlotsChanges, hasUnsavedRelationshipsChanges])

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
                            onClick={() => handleTabChangeWithGuard(tab.id)}
                            className={`py-2 px-1 border-b-2 font-medium text-sm ${activeTab === tab.id
                                ? 'border-blue-500 text-blue-600'
                                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                                }`}
                        >
                            {tab.label}
                            {tab.id === 'schema' && hasUnsavedSchemaChanges && (
                                <span className="ml-1 w-2 h-2 bg-orange-400 rounded-full inline-block" title="Unsaved changes" />
                            )}
                            {tab.id === 'basic' && hasUnsavedBasicChanges && (
                                <span className="ml-1 w-2 h-2 bg-orange-400 rounded-full inline-block" title="Unsaved changes" />
                            )}
                            {tab.id === 'slots' && hasUnsavedSlotsChanges && (
                                <span className="ml-1 w-2 h-2 bg-orange-400 rounded-full inline-block" title="Unsaved changes" />
                            )}
                            {tab.id === 'relationships' && hasUnsavedRelationshipsChanges && (
                                <span className="ml-1 w-2 h-2 bg-orange-400 rounded-full inline-block" title="Unsaved changes" />
                            )}
                        </button>
                    ))}
                </nav>
            </div>

            {/* Basic Info Tab */}
            {activeTab === 'basic' && (
                <div className="space-y-4">
                    {/* Basic Info Error Display */}
                    {basicInfoError && (
                        <div className="bg-red-50 border border-red-200 rounded-md p-4 flex items-start">
                            <div className="flex-shrink-0">
                                <svg className="h-5 w-5 text-red-400" viewBox="0 0 20 20" fill="currentColor">
                                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                                </svg>
                            </div>
                            <div className="ml-3">
                                <h3 className="text-sm font-medium text-red-800">
                                    Basic Info Validation Error
                                </h3>
                                <div className="mt-1 text-sm text-red-700">
                                    {basicInfoError}
                                </div>
                                <div className="mt-2">
                                    <button
                                        type="button"
                                        onClick={() => setBasicInfoError(null)}
                                        className="text-sm text-red-600 hover:text-red-500 underline"
                                    >
                                        Dismiss
                                    </button>
                                </div>
                            </div>
                        </div>
                    )}

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

                    {/* Namespace Selection */}
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                            <FolderOpen className="inline w-4 h-4 mr-1" />
                            Namespace
                        </label>
                        <select
                            value={formData.namespaceId || ''}
                            onChange={(e) => handleInputChange('namespaceId', e.target.value || null)}
                            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                        >
                            <option value="">Use Default Namespace</option>
                            {availableNamespaces.map((namespace) => (
                                <option key={namespace.id} value={namespace.id}>
                                    {namespace.name} ({namespace.slug})
                                    {namespace.isDefault && ' - Default'}
                                </option>
                            ))}
                        </select>
                        <p className="text-gray-500 text-xs mt-1">
                            Namespace for organizing content and media for this object type. Leave empty to use the default namespace.
                        </p>
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

                    {/* Schema Error Display */}
                    {schemaError && (
                        <div className="mb-6 bg-red-50 border border-red-200 rounded-md p-4 flex items-start">
                            <div className="flex-shrink-0">
                                <svg className="h-5 w-5 text-red-400" viewBox="0 0 20 20" fill="currentColor">
                                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                                </svg>
                            </div>
                            <div className="ml-3">
                                <h3 className="text-sm font-medium text-red-800">
                                    Schema Validation Error
                                </h3>
                                <div className="mt-1 text-sm text-red-700">
                                    {schemaError}
                                </div>
                                <div className="mt-2">
                                    <button
                                        type="button"
                                        onClick={() => setSchemaError(null)}
                                        className="text-sm text-red-600 hover:text-red-500 underline"
                                    >
                                        Dismiss
                                    </button>
                                </div>
                            </div>
                        </div>
                    )}

                    <SchemaEditor
                        schema={formData.schema}
                        onChange={handleSchemaChange}
                        onValidationChange={handleSchemaValidationChange}
                        showPreview={true}
                        showJsonView={true}
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

                    {/* Widget Slots Warnings Display */}
                    {slotsWarnings.length > 0 && (
                        <div className="mb-6 bg-yellow-50 border-2 border-yellow-400 rounded-md p-4">
                            <div className="flex items-start">
                                <div className="flex-shrink-0">
                                    <svg className="h-6 w-6 text-yellow-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                                    </svg>
                                </div>
                                <div className="ml-3 flex-1">
                                    <h3 className="text-base font-semibold text-yellow-800 mb-2">
                                        ⚠️ Widget Controls Filtered ({slotsWarnings.length} issue{slotsWarnings.length !== 1 ? 's' : ''})
                                    </h3>
                                    <p className="text-sm text-yellow-700 mb-3">
                                        Some widget controls were removed during save because they reference widget types that don't exist:
                                    </p>
                                    <ul className="list-disc list-inside space-y-1 text-sm text-yellow-800">
                                        {slotsWarnings.map((warning, idx) => (
                                            <li key={idx} className="ml-2">
                                                <span className="font-medium">{warning.slot}:</span> {warning.message}
                                            </li>
                                        ))}
                                    </ul>
                                    <div className="mt-3">
                                        <button
                                            type="button"
                                            onClick={() => setSlotsWarnings([])}
                                            className="text-sm text-yellow-700 hover:text-yellow-600 underline font-medium"
                                        >
                                            Dismiss
                                        </button>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Widget Slots Error Display */}
                    {slotsError && (
                        <div className="mb-6 bg-red-50 border border-red-200 rounded-md p-4 flex items-start">
                            <div className="flex-shrink-0">
                                <svg className="h-5 w-5 text-red-400" viewBox="0 0 20 20" fill="currentColor">
                                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                                </svg>
                            </div>
                            <div className="ml-3">
                                <h3 className="text-sm font-medium text-red-800">
                                    Widget Slots Validation Error
                                </h3>
                                <div className="mt-1 text-sm text-red-700">
                                    {slotsError}
                                </div>
                                <div className="mt-2">
                                    <button
                                        type="button"
                                        onClick={() => setSlotsError(null)}
                                        className="text-sm text-red-600 hover:text-red-500 underline"
                                    >
                                        Dismiss
                                    </button>
                                </div>
                            </div>
                        </div>
                    )}

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

                {activeTab === 'basic' && objectType ? (
                    // Basic info-specific save button
                    <button
                        type="button"
                        onClick={handleSaveBasicInfo}
                        disabled={!hasUnsavedBasicChanges || isSavingBasicInfo}
                        className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                    >
                        {isSavingBasicInfo ? (
                            <>
                                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                                Saving...
                            </>
                        ) : (
                            <>
                                <Settings className="w-4 h-4 mr-2" />
                                Save Basic Info
                            </>
                        )}
                    </button>
                ) : activeTab === 'slots' && objectType ? (
                    // Widget slots-specific save button
                    <button
                        type="button"
                        onClick={handleSaveSlots}
                        disabled={!hasUnsavedSlotsChanges || isSavingSlots}
                        className="inline-flex items-center px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                    >
                        {isSavingSlots ? (
                            <>
                                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                                Saving...
                            </>
                        ) : (
                            <>
                                <Settings className="w-4 h-4 mr-2" />
                                Save Widget Slots
                            </>
                        )}
                    </button>
                ) : activeTab === 'schema' && objectType ? (
                    // Schema-specific save button
                    <button
                        type="button"
                        onClick={handleSaveSchema}
                        disabled={!hasUnsavedSchemaChanges || isSavingSchema || Object.keys(schemaValidationErrors).length > 0}
                        className="inline-flex items-center px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                        title={Object.keys(schemaValidationErrors).length > 0 ? 'Please fix validation errors before saving' : ''}
                    >
                        {isSavingSchema ? (
                            <>
                                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                                Saving...
                            </>
                        ) : (
                            <>
                                <Hash className="w-4 h-4 mr-2" />
                                Save Schema
                            </>
                        )}
                    </button>
                ) : activeTab === 'relationships' && objectType ? (
                    // Relationships-specific save button
                    <button
                        type="button"
                        onClick={handleSaveRelationships}
                        disabled={!hasUnsavedRelationshipsChanges || isSavingRelationships}
                        className="inline-flex items-center px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                    >
                        {isSavingRelationships ? (
                            <>
                                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                                Saving...
                            </>
                        ) : (
                            <>
                                <Users className="w-4 h-4 mr-2" />
                                Save Relationships
                            </>
                        )}
                    </button>
                ) : (
                    // Regular form submit button for other tabs
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
                )}
            </div>
        </form>
    )
}

// Slot Editor Component
const SlotEditor = ({ slots = [], onChange, errors }) => {
    const [availableWidgets, setAvailableWidgets] = useState([])
    const [loadingWidgets, setLoadingWidgets] = useState(false)

    // Fetch available widgets on component mount
    useEffect(() => {
        const fetchWidgets = async () => {
            setLoadingWidgets(true)
            try {
                // Import the authenticated API client
                const { widgetsApi } = await import('../api')
                // Use the correct endpoint with authentication
                const data = await widgetsApi.getTypes(true) // Include template JSON
                setAvailableWidgets(data || [])
            } catch (error) {
                console.error('Failed to fetch available widgets:', error)
                setAvailableWidgets([])
            } finally {
                setLoadingWidgets(false)
            }
        }

        fetchWidgets()
    }, [])

    const addSlot = () => {
        const newSlot = {
            name: '',
            label: '',
            widgetControls: [],
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
                                className={`w-full px-3 py-2 border rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${(errors[`slot_${index}_name`] || (!slot.name || !slot.name.trim())) ? 'border-red-300' : 'border-gray-300'
                                    }`}
                                placeholder="e.g., main_content, sidebar"
                            />
                            {errors[`slot_${index}_name`] && (
                                <p className="text-red-600 text-sm mt-1">{errors[`slot_${index}_name`]}</p>
                            )}
                            {(!slot.name || !slot.name.trim()) && (
                                <p className="text-red-600 text-sm mt-1">Slot Name is required</p>
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
                                className={`w-full px-3 py-2 border rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${(errors[`slot_${index}_label`] || (!slot.label || !slot.label.trim())) ? 'border-red-300' : 'border-gray-300'
                                    }`}
                                placeholder="e.g., Main Content, Sidebar"
                            />
                            {errors[`slot_${index}_label`] && (
                                <p className="text-red-600 text-sm mt-1">{errors[`slot_${index}_label`]}</p>
                            )}
                            {(!slot.label || !slot.label.trim()) && (
                                <p className="text-red-600 text-sm mt-1">Display Label is required</p>
                            )}
                        </div>
                    </div>

                    <div className="flex items-center space-x-4 mb-4">
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

                    {/* Widget Control Definitions */}
                    <div className="border-t border-gray-200 pt-4">
                        <h5 className="text-sm font-medium text-gray-900 mb-3">Widget Control Definitions</h5>
                        <p className="text-xs text-gray-500 mb-4">
                            Configure individual widget types that can be used in this slot, including their settings and behavior.
                        </p>

                        {loadingWidgets ? (
                            <div className="text-sm text-gray-500">Loading available widgets...</div>
                        ) : (
                            <WidgetControlManager
                                widgetControls={slot.widgetControls || []}
                                availableWidgets={availableWidgets}
                                loadingWidgets={loadingWidgets}
                                onChange={(newControls) => updateSlot(index, 'widgetControls', newControls)}
                            />
                        )}
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

// Widget Control Manager Component
const WidgetControlManager = ({ widgetControls = [], availableWidgets = [], loadingWidgets = false, onChange }) => {
    const [selectedWidgetType, setSelectedWidgetType] = useState('')

    const addWidgetControl = () => {
        if (!selectedWidgetType) return

        const selectedWidget = availableWidgets.find(w => {
            const widgetType = w.type || w.slug || w.widget_type
            return widgetType === selectedWidgetType
        })
        const widgetName = selectedWidget?.display_name || selectedWidget?.name || selectedWidget?.label || selectedWidgetType
        const newControl = {
            id: `control_${Date.now()}`,
            widgetType: selectedWidgetType,
            label: widgetName,
            maxInstances: null,
            required: false,
            preCreate: false,
            defaultConfig: {}
        }
        onChange([...widgetControls, newControl])
        setSelectedWidgetType('') // Reset selection
    }

    // Add all available widget types as controls
    const addAllWidgetControls = () => {
        const newControls = []

        // Get widgets that aren't already added
        const availableToAdd = availableWidgets.filter(widget => {
            const widgetType = widget.type || widget.widget_type
            return !widgetControls.some(control => control.widgetType === widgetType)
        })

        // Create controls for all available widgets
        availableToAdd.forEach(widget => {
            const widgetType = widget.type || widget.widget_type
            const widgetName = widget.display_name || widget.name || widget.label || widgetType
            const newControl = {
                id: `control_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
                widgetType: widgetType,
                label: widgetName,
                maxInstances: null,
                required: false,
                preCreate: false,
                defaultConfig: {}
            }
            newControls.push(newControl)
        })

        if (newControls.length > 0) {
            onChange([...widgetControls, ...newControls])
        }
    }

    const updateWidgetControl = (index, field, value) => {
        const updatedControls = widgetControls.map((control, i) =>
            i === index ? { ...control, [field]: value } : control
        )
        onChange(updatedControls)
    }

    const removeWidgetControl = (index) => {
        onChange(widgetControls.filter((_, i) => i !== index))
    }

    const updateDefaultConfig = (index, configField, configValue) => {
        const updatedControls = widgetControls.map((control, i) =>
            i === index
                ? {
                    ...control,
                    defaultConfig: {
                        ...control.defaultConfig,
                        [configField]: configValue
                    }
                }
                : control
        )
        onChange(updatedControls)
    }

    const getSelectedWidget = (widgetType) => {
        return availableWidgets.find(w => w.slug === widgetType)
    }

    return (
        <div className="space-y-4">
            {widgetControls.map((control, index) => {
                const selectedWidget = getSelectedWidget(control.widgetType)

                const IconComponent = getWidgetIcon(control.widgetType) || Settings
                const category = getWidgetCategory(control.widgetType) || 'other'
                const description = getWidgetDescription(control.widgetType) || selectedWidget?.description || 'No description provided'

                return (
                    <div key={control.id || index} className="bg-white border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow">
                        <div className="flex items-start justify-between">
                            <div className="flex items-start space-x-3 flex-1">
                                {/* Widget Icon */}
                                <div className="flex-shrink-0">
                                    <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                                        {IconComponent && typeof IconComponent === 'function' ? (
                                            React.createElement(IconComponent, { className: "w-5 h-5 text-blue-600" })
                                        ) : (
                                            <Settings className="w-5 h-5 text-blue-600" />
                                        )}
                                    </div>
                                </div>

                                {/* Widget Info */}
                                <div className="flex-1 min-w-0">
                                    <div className="flex items-center space-x-2 mb-1">
                                        <h3 className="text-lg font-medium text-gray-900 truncate">
                                            {control?.label || selectedWidget?.name || 'Unknown Widget'}
                                        </h3>
                                        <div className="flex items-center space-x-1">
                                            <CheckCircle className="w-4 h-4 text-green-500" />
                                            <span className="text-xs font-medium text-green-600">
                                                Active
                                            </span>
                                        </div>
                                    </div>

                                    <p className="text-gray-600 text-sm mb-2">
                                        {description}
                                    </p>

                                    <div className="flex flex-wrap gap-2 text-xs">
                                        <span className="bg-gray-100 text-gray-700 px-2 py-1 rounded">
                                            Type: {control.widgetType}
                                        </span>
                                        <span className="bg-gray-100 text-gray-700 px-2 py-1 rounded">
                                            Category: {category}
                                        </span>
                                        {control.maxInstances && (
                                            <span className="bg-blue-100 text-blue-700 px-2 py-1 rounded">
                                                Max: {control.maxInstances}
                                            </span>
                                        )}
                                        {control.required && (
                                            <span className="bg-red-100 text-red-700 px-2 py-1 rounded">
                                                Required
                                            </span>
                                        )}
                                        {control.preCreate && (
                                            <span className="bg-green-100 text-green-700 px-2 py-1 rounded">
                                                Auto-create
                                            </span>
                                        )}
                                    </div>
                                </div>
                            </div>

                            {/* Actions */}
                            <div className="flex-shrink-0 ml-4">
                                <button
                                    type="button"
                                    onClick={() => removeWidgetControl(index)}
                                    className="text-red-600 hover:text-red-800 p-1"
                                    title="Remove widget control"
                                >
                                    <Trash2 className="h-4 w-4" />
                                </button>
                            </div>
                        </div>

                        {/* Additional Configuration Details */}
                        <div className="mt-4 pt-4 border-t border-gray-100">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                {/* Max Instances */}
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">
                                        Max Instances
                                    </label>
                                    <input
                                        type="number"
                                        value={control.maxInstances || ''}
                                        onChange={(e) => updateWidgetControl(index, 'maxInstances', e.target.value ? parseInt(e.target.value) : null)}
                                        className="w-20 px-3 py-2 border bg-white border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                                        placeholder="∞"
                                        min="1"
                                    />
                                </div>

                                {/* Control Flags */}
                                <div className="md:col-span-2">
                                    <div className="flex items-center space-x-6">
                                        <label className="flex items-center">
                                            <input
                                                type="checkbox"
                                                checked={control.required || false}
                                                onChange={(e) => updateWidgetControl(index, 'required', e.target.checked)}
                                                className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                                            />
                                            <span className="ml-2 text-sm text-gray-700">Required widget</span>
                                        </label>

                                        <label className="flex items-center">
                                            <input
                                                type="checkbox"
                                                checked={control.preCreate || false}
                                                onChange={(e) => updateWidgetControl(index, 'preCreate', e.target.checked)}
                                                className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                                            />
                                            <span className="ml-2 text-sm text-gray-700">Auto-create on new objects</span>
                                        </label>
                                    </div>
                                </div>

                                {/* Default Configuration */}
                                {selectedWidget && (
                                    <div className="md:col-span-2">
                                        <label className="block text-sm font-medium text-gray-700 mb-2">
                                            Default Configuration
                                        </label>
                                        <div className="bg-white border border-gray-200 rounded-md p-3 space-y-3">
                                            {/* Common configuration fields */}
                                            {selectedWidget.slug === 'text-block' && (
                                                <>
                                                    <div>
                                                        <label className="block text-xs font-medium text-gray-600 mb-1">
                                                            Default Title
                                                        </label>
                                                        <input
                                                            type="text"
                                                            value={control.defaultConfig?.title || ''}
                                                            onChange={(e) => updateDefaultConfig(index, 'title', e.target.value)}
                                                            className="w-full px-2 py-1 text-sm border border-gray-300 rounded"
                                                            placeholder="Enter default title..."
                                                        />
                                                    </div>
                                                    <div>
                                                        <label className="block text-xs font-medium text-gray-600 mb-1">
                                                            Default Content
                                                        </label>
                                                        <textarea
                                                            value={control.defaultConfig?.content || ''}
                                                            onChange={(e) => updateDefaultConfig(index, 'content', e.target.value)}
                                                            className="w-full px-2 py-1 text-sm border border-gray-300 rounded"
                                                            rows={3}
                                                            placeholder="Enter default content..."
                                                        />
                                                    </div>
                                                </>
                                            )}

                                            {selectedWidget.slug === 'image' && (
                                                <>
                                                    <div>
                                                        <label className="block text-xs font-medium text-gray-600 mb-1">
                                                            Default Alt Text
                                                        </label>
                                                        <input
                                                            type="text"
                                                            value={control.defaultConfig?.alt || ''}
                                                            onChange={(e) => updateDefaultConfig(index, 'alt', e.target.value)}
                                                            className="w-full px-2 py-1 text-sm border border-gray-300 rounded"
                                                            placeholder="Enter default alt text..."
                                                        />
                                                    </div>
                                                    <div>
                                                        <label className="block text-xs font-medium text-gray-600 mb-1">
                                                            Default Caption
                                                        </label>
                                                        <input
                                                            type="text"
                                                            value={control.defaultConfig?.caption || ''}
                                                            onChange={(e) => updateDefaultConfig(index, 'caption', e.target.value)}
                                                            className="w-full px-2 py-1 text-sm border border-gray-300 rounded"
                                                            placeholder="Enter default caption..."
                                                        />
                                                    </div>
                                                </>
                                            )}

                                            {selectedWidget.slug === 'button' && (
                                                <>
                                                    <div>
                                                        <label className="block text-xs font-medium text-gray-600 mb-1">
                                                            Default Button Text
                                                        </label>
                                                        <input
                                                            type="text"
                                                            value={control.defaultConfig?.text || ''}
                                                            onChange={(e) => updateDefaultConfig(index, 'text', e.target.value)}
                                                            className="w-full px-2 py-1 text-sm border border-gray-300 rounded"
                                                            placeholder="Enter default button text..."
                                                        />
                                                    </div>
                                                    <div>
                                                        <label className="block text-xs font-medium text-gray-600 mb-1">
                                                            Default Button Style
                                                        </label>
                                                        <select
                                                            value={control.defaultConfig?.style || 'primary'}
                                                            onChange={(e) => updateDefaultConfig(index, 'style', e.target.value)}
                                                            className="w-full px-2 py-1 text-sm border border-gray-300 rounded"
                                                        >
                                                            <option value="primary">Primary</option>
                                                            <option value="secondary">Secondary</option>
                                                            <option value="outline">Outline</option>
                                                        </select>
                                                    </div>
                                                </>
                                            )}

                                            {/* Generic JSON editor for other widget types */}
                                            {!['text-block', 'image', 'button'].includes(selectedWidget.slug) && (
                                                <div>
                                                    <label className="block text-xs font-medium text-gray-600 mb-1">
                                                        Default Configuration (JSON)
                                                    </label>
                                                    <textarea
                                                        value={JSON.stringify(control.defaultConfig || {}, null, 2)}
                                                        onChange={(e) => {
                                                            try {
                                                                const config = JSON.parse(e.target.value)
                                                                updateWidgetControl(index, 'defaultConfig', config)
                                                            } catch (err) {
                                                                // Invalid JSON, ignore for now
                                                            }
                                                        }}
                                                        className="w-full px-2 py-1 text-sm border border-gray-300 rounded font-mono"
                                                        rows={4}
                                                        placeholder='{"key": "value"}'
                                                    />
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                )
            })}

            {/* Add Widget Control - Select + Button */}
            <div className="border border-gray-200 rounded-lg p-4 bg-gray-50">
                <div className="flex items-center justify-between mb-3">
                    <h6 className="text-sm font-medium text-gray-900">Add Widget Control</h6>
                    {/* Add All Button */}
                    {availableWidgets.length > 0 && (
                        <button
                            type="button"
                            onClick={addAllWidgetControls}
                            disabled={loadingWidgets || availableWidgets.filter(widget => {
                                const widgetType = widget.type || widget.widget_type
                                return !widgetControls.some(control => control.widgetType === widgetType)
                            }).length === 0}
                            className="px-3 py-1 bg-green-600 text-white rounded text-sm hover:bg-green-700 disabled:bg-gray-300 disabled:cursor-not-allowed flex items-center"
                            title="Add all available widget types as controls"
                        >
                            <Plus className="h-3 w-3 mr-1" />
                            Add All ({availableWidgets.filter(widget => {
                                const widgetType = widget.type || widget.widget_type
                                return !widgetControls.some(control => control.widgetType === widgetType)
                            }).length})
                        </button>
                    )}
                </div>
                <div className="flex items-center space-x-3">
                    <div className="flex-1">
                        <select
                            value={selectedWidgetType}
                            onChange={(e) => setSelectedWidgetType(e.target.value)}
                            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                        >
                            <option value="">
                                {loadingWidgets ? 'Loading widgets...' :
                                    availableWidgets.length === 0 ? 'No widgets available' :
                                        'Select a widget type to add...'}
                            </option>
                            {availableWidgets
                                .filter(widget => {
                                    const widgetType = widget.type || widget.widget_type
                                    return !widgetControls.some(control => control.widgetType === widgetType)
                                })
                                .map((widget, index) => {
                                    const widgetType = widget.type || widget.widget_type
                                    const widgetName = widget.display_name || widget.name || widget.label || widgetType
                                    return (
                                        <option key={widgetType || index} value={widgetType}>
                                            {widgetName}
                                        </option>
                                    )
                                })}
                        </select>
                    </div>
                    <button
                        type="button"
                        onClick={addWidgetControl}
                        disabled={!selectedWidgetType}
                        className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed flex items-center"
                    >
                        <Plus className="h-4 w-4 mr-1" />
                        Add
                    </button>
                </div>
                {selectedWidgetType && (
                    <div className="mt-2 p-2 bg-blue-50 border border-blue-200 rounded text-sm text-blue-800">
                        <strong>{availableWidgets.find(w => w.type === selectedWidgetType)?.name}</strong>: {availableWidgets.find(w => w.type === selectedWidgetType)?.description}
                    </div>
                )}
            </div>

            {widgetControls.length > 0 && (
                <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded-md">
                    <h6 className="text-sm font-medium text-blue-900 mb-1">
                        Widget Controls Summary
                    </h6>
                    <div className="text-sm text-blue-800">
                        {widgetControls.length} widget control(s) configured
                        {widgetControls.filter(c => c.preCreate).length > 0 && (
                            <span className="block">
                                • {widgetControls.filter(c => c.preCreate).length} will be auto-created
                            </span>
                        )}
                        {widgetControls.filter(c => c.required).length > 0 && (
                            <span className="block">
                                • {widgetControls.filter(c => c.required).length} are required
                            </span>
                        )}
                    </div>
                </div>
            )}
        </div>
    )
}

export default ObjectTypeForm
