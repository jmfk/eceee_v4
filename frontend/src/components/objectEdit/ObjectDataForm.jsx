import React, { useState, useEffect, useCallback, forwardRef, useImperativeHandle, useMemo, useRef } from 'react'
import { useQuery } from '@tanstack/react-query'
import { AlertCircle } from 'lucide-react'
import { namespacesApi } from '../../api'
import { objectTypesApi } from '../../api/objectStorage'
import ObjectSchemaForm from '../ObjectSchemaForm'
import { useUnifiedData } from '../../contexts/unified-data/context/UnifiedDataContext'
import { OperationTypes } from '../../contexts/unified-data/types/operations'
import { useEditorContext } from '../../contexts/unified-data/hooks'

/**
 * Self-contained form component for object data management
 * Handles form state, validation, and change tracking internally
 */
const ObjectDataForm = forwardRef(({
    objectType,
    instance,
    isNewInstance,
    onSave,
    onValidationChange,
    onFormChange,
    context
}, ref) => {
    const [namespace, setNamespace] = useState(null)

    // ODC Integration
    const { useExternalChanges, publishUpdate } = useUnifiedData()
    const componentId = useMemo(() => `object-data-form-${instance?.id || 'new'}`, [instance?.id])
    const contextType = useEditorContext()

    // Form state management
    const [formData, setFormData] = useState({
        objectTypeId: objectType?.id || '',
        title: instance?.title || '',
        data: instance?.data || {},
        status: instance?.status || 'draft',
        widgets: instance?.widgets || {},
        metadata: instance?.metadata || {}
    })

    const [errors, setErrors] = useState({})

    // Ref for debouncing data field updates
    const dataFieldTimeoutRef = useRef(null)

    // Fetch available object types for selection (when creating)
    const { data: typesResponse } = useQuery({
        queryKey: ['objectTypes'],
        queryFn: () => objectTypesApi.getActive(),
        enabled: Boolean(isNewInstance)
    })

    const availableTypes = typesResponse?.data || []

    // Subscribe to external changes from ODC
    useExternalChanges(componentId, (state) => {
        if (!instance?.id) return;

        const objectData = state.objects?.[String(instance.id)];
        if (objectData) {
            const newFormData = {
                objectTypeId: objectData.objectType?.id || objectData.objectTypeId || '',
                title: objectData.title || '',
                data: objectData.data || {},
                status: objectData.status || 'draft',
                widgets: objectData.widgets || {},
                metadata: objectData.metadata || {}
            };

            // Only update if data has actually changed to avoid unnecessary re-renders
            const hasChanged = JSON.stringify(formData) !== JSON.stringify(newFormData);
            if (hasChanged) {
                setFormData(newFormData);
                onFormChange?.(newFormData);
            }
        }
    });

    // Load namespace for media operations (object type's namespace or default)
    useEffect(() => {
        const loadNamespace = async () => {
            try {
                if (objectType?.namespace?.slug) {
                    // Use the object type's specific namespace
                    setNamespace(objectType.namespace.slug)
                } else {
                    // Fall back to default namespace
                    const defaultNamespace = await namespacesApi.getDefault()
                    setNamespace(defaultNamespace?.slug || null)
                }
            } catch (error) {
                console.error('Failed to load namespace:', error)
                setNamespace(null)
            }
        }

        loadNamespace()
    }, [objectType?.namespace])

    // Initialize ODC object data when instance changes
    useEffect(() => {
        if (instance && instance.id) {
            // Initialize object in ODC
            publishUpdate(componentId, OperationTypes.INIT_OBJECT, {
                id: String(instance.id),
                data: {
                    ...instance,
                    id: String(instance.id),
                    type: instance?.objectType?.name || 'unknown',
                    status: instance?.status || 'draft',
                    metadata: instance?.metadata || {},
                    widgets: instance?.widgets || {}
                }
            });
        }
    }, [instance, componentId, publishUpdate])

    // Update form data when instance changes (keep local state for immediate UI feedback)
    useEffect(() => {
        if (instance) {
            const newFormData = {
                objectTypeId: instance.objectType?.id || '',
                title: instance.title || '',
                data: instance.data || {},
                status: instance.status || 'draft',
                widgets: instance.widgets || {},
                metadata: instance.metadata || {}
            }

            setFormData(newFormData)
            setErrors({}) // Clear errors when instance changes
        }
    }, [instance])

    // Cleanup timeout on component unmount
    useEffect(() => {
        return () => {
            if (dataFieldTimeoutRef.current) {
                clearTimeout(dataFieldTimeoutRef.current);
            }
        };
    }, [])

    // Helper function to map componentType to React component name
    const mapComponentTypeToComponent = (componentType) => {
        const mapping = {
            // Basic types
            'text': 'TextInput',
            'textarea': 'TextareaInput',
            'number': 'NumberInput',
            'boolean': 'BooleanInput',
            'password': 'PasswordInput',
            'email': 'EmailInput',
            'url': 'URLInput',

            // Date/Time
            'date': 'DateInput',
            'datetime': 'DateTimeInput',
            'time': 'TimeInput',
            'date_range': 'DateRangeInput',

            // Selection
            'select': 'SelectInput',
            'multi_select': 'MultiSelectInput',
            'radio': 'RadioInput',
            'checkbox': 'CheckboxInput',
            'tags': 'TagInput',

            // Advanced
            'color': 'ColorInput',
            'slider': 'SliderInput',

            // Media
            'image': 'ImageInput',
            'file': 'FileInput',
            'document': 'DocumentInput',
            'video': 'VideoInput',
            'audio': 'AudioInput',

            // Rich Text
            'rich_text': 'RichTextInput',

            // References
            'user_selector': 'UserSelectorInput',
            'object_selector': 'ObjectSelectorInput',
            'object_type_selector': 'ObjectTypeSelectorInput',
            'object_reference': 'ObjectReferenceInput',

            // List/Complex
            'items_list': 'ItemsListField',
            'conditional_group': 'ConditionalGroupField',
        }

        return mapping[componentType] || 'TextInput' // Default fallback
    }

    // Helper function to convert object type schema to ObjectSchemaForm format
    const getSchemaFromObjectType = useCallback((objectType) => {
        if (!objectType?.schema?.properties) {
            return { fields: [] }
        }

        const properties = objectType.schema.properties
        const required = objectType.schema.required || []
        const propertyOrder = objectType.schema.propertyOrder || []

        // Use propertyOrder if available, otherwise use object keys
        const keysToProcess = propertyOrder.length > 0 ? propertyOrder : Object.keys(properties)

        const fields = keysToProcess.map(propName => {
            // Skip 'title' field as it's handled by the model, not schema data
            if (propName === 'title') {
                return null
            }

            if (properties[propName]) {
                const property = properties[propName]

                // Filter out schema-specific properties that shouldn't be passed to form components
                const {
                    componentType,
                    helpText,
                    propertyOrder,
                    relationshipType,
                    allowedObjectTypes,
                    maxItems,
                    type,
                    properties: nestedProps,
                    items,
                    ...componentRelevantProps
                } = property

                const field = {
                    name: propName,
                    required: required.includes(propName),
                    ...componentRelevantProps,
                    // Map title to label for ObjectSchemaForm compatibility
                    label: property.title || property.label || propName,
                    // Use helpText for description if available
                    description: property.helpText || property.description,
                    // Map componentType to component name
                    component: componentType ? mapComponentTypeToComponent(componentType) : undefined
                }

                // Add special props for object_reference fields (snake_case for component)
                if (componentType === 'object_reference') {
                    if (relationshipType) field.relationship_type = relationshipType
                    if (allowedObjectTypes) field.allowed_object_types = allowedObjectTypes
                    if (maxItems !== undefined) field.max_items = maxItems
                }

                return field
            }
            return null
        }).filter(Boolean)

        return { fields }
    }, [])

    // Form validation
    const validateForm = useCallback(() => {
        const newErrors = {}

        if (!formData.objectTypeId) {
            newErrors.objectTypeId = 'Object type is required'
        }

        if (!formData.title?.trim()) {
            newErrors.title = 'Title is required'
        }

        // Validate required schema fields
        if (objectType?.schema?.properties) {
            const required = objectType.schema.required || []
            required.forEach(fieldName => {
                if (!formData.data[fieldName] || formData.data[fieldName] === '') {
                    newErrors[`data_${fieldName}`] = `${fieldName} is required`
                }
            })
        }

        setErrors(newErrors)
        const isValid = Object.keys(newErrors).length === 0

        // Notify parent about validation state
        onValidationChange?.(isValid, newErrors)

        return isValid
    }, [formData, objectType, onValidationChange])

    // Update form field and mark as dirty
    const handleInputChange = useCallback(async (field, value) => {
        // Update local state immediately for UI responsiveness
        setFormData(prev => {
            const newData = { ...prev, [field]: value }
            onFormChange?.(newData)
            return newData
        })

        // Clear error when user starts typing
        if (errors[field]) {
            setErrors(prev => ({ ...prev, [field]: null }))
        }

        // Publish update to ODC if we have an instance ID
        if (instance?.id) {
            await publishUpdate(componentId, OperationTypes.UPDATE_OBJECT, {
                id: String(instance.id),
                updates: { [field]: value }
            });
        }
    }, [errors, onFormChange, instance?.id, componentId, publishUpdate])

    // Update nested data field with debouncing
    const handleDataFieldChange = useCallback((fieldName, value) => {
        // Update local state immediately for instant UI feedback
        setFormData(prev => {
            const updated = {
                ...prev,
                data: { ...prev.data, [fieldName]: value }
            };
            return updated;
        });

        // Clear error when user starts typing
        const errorKey = `data_${fieldName}`;
        if (errors[errorKey]) {
            setErrors(prev => ({ ...prev, [errorKey]: null }));
        }

        // Cancel any pending publish (debounce pattern)
        if (dataFieldTimeoutRef.current) {
            clearTimeout(dataFieldTimeoutRef.current);
        }

        // Schedule publish of final state after user stops typing
        if (instance?.id) {
            dataFieldTimeoutRef.current = setTimeout(() => {
                // Capture current form state at time of publish
                setFormData(current => {
                    // Notify parent of the change (outside render cycle)
                    Promise.resolve().then(() => onFormChange?.(current));

                    publishUpdate(componentId, OperationTypes.UPDATE_OBJECT, {
                        id: String(instance.id),
                        updates: { data: current.data }
                    });
                    return current; // No change to state
                });
            }, 300); // 300ms delay - responsive for typing
        }
    }, [errors, onFormChange, instance?.id, componentId, publishUpdate])



    // Expose methods to parent component
    useImperativeHandle(ref, () => ({
        validate: validateForm,
        getFormData: () => formData,
        hasErrors: () => Object.keys(errors).length > 0,
        getErrors: () => errors
    }), [validateForm, formData, errors])

    return (
        <>
            {/* Object Type Selection (only for new instances) */}
            {isNewInstance && (
                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                        Object Type <span className="text-red-500">*</span>
                    </label>
                    <select
                        value={formData.objectTypeId || ''}
                        onChange={(e) => handleInputChange('objectTypeId', e.target.value)}
                        className={`w-full px-3 py-2 border rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${errors.objectTypeId ? 'border-red-300' : 'border-gray-300'
                            }`}
                    >
                        <option value="">Select object type...</option>
                        {availableTypes.map((type) => (
                            <option key={type.id} value={type.id}>
                                {type.label}
                            </option>
                        ))}
                    </select>
                    {errors.objectTypeId && (
                        <div className="text-red-600 text-sm mt-1 flex items-center">
                            <AlertCircle className="h-4 w-4 mr-1" />
                            {errors.objectTypeId}
                        </div>
                    )}
                </div>
            )}

            {/* Title - Model Field */}
            <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                    Object Title <span className="text-red-500">*</span>
                </label>
                <input
                    type="text"
                    value={formData.title || ''}
                    onChange={(e) => handleInputChange('title', e.target.value)}
                    className={`w-full px-3 py-2 border rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${errors.title ? 'border-red-300' : 'border-gray-300'
                        }`}
                    placeholder="Enter object title..."
                />
                {errors.title && (
                    <div className="text-red-600 text-sm mt-1 flex items-center">
                        <AlertCircle className="h-4 w-4 mr-1" />
                        {errors.title}
                    </div>
                )}
                <div className="text-gray-500 text-sm mt-1">
                    This is the object's display title (stored on the object, not in schema data)
                </div>
            </div>

            {/* Dynamic Schema Fields */}
            {objectType && (
                <div className="border-t pt-4">
                    <div className="font-medium text-gray-900 mb-4" role="heading" aria-level="4">
                        {objectType.label} Fields
                    </div>
                    <ObjectSchemaForm
                        schema={getSchemaFromObjectType(objectType)}
                        data={formData.data || {}}
                        onChange={handleDataFieldChange}
                        namespace={namespace}
                    />
                </div>
            )}
        </>
    )
})

ObjectDataForm.displayName = 'ObjectDataForm'
export default ObjectDataForm
