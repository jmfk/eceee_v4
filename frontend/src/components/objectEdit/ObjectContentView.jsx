import React, { useState, useEffect, useRef, useCallback, forwardRef, useImperativeHandle } from 'react'
import { useMutation, useQueryClient, useQuery } from '@tanstack/react-query'
import { useNavigate, useParams } from 'react-router-dom'
import { Save, AlertCircle } from 'lucide-react'
import { objectInstancesApi, objectTypesApi } from '../../api/objectStorage'
import { namespacesApi } from '../../api'
import { useGlobalNotifications } from '../../contexts/GlobalNotificationContext'
import { getWidgetDisplayName } from '../../hooks/useWidgets'
import { widgetsApi } from '../../api'
import ObjectContentEditor from '../ObjectContentEditor'
import ObjectSchemaForm from '../ObjectSchemaForm'
import WidgetEditorPanel from '../WidgetEditorPanel'
import ObjectDataForm from './ObjectDataForm'
import { useUnifiedData, useObjectData, useFormData } from '../../contexts/unified-data'
import { WIDGET_EVENTS, WIDGET_CHANGE_TYPES } from '../../types/widgetEvents'

// Internal component that uses widget event hooks
const ObjectContentViewInternal = forwardRef(({ objectType, instance, parentId, isNewInstance, onSave, onCancel, onUnsavedChanges }, ref) => {
    const navigate = useNavigate()
    const { instanceId, objectTypeId, tab } = useParams()

    // Use UnifiedDataContext for all data management
    const objectId = instance?.id || instanceId || 'new'
    const formId = `object-${objectId}`

    // Use specialized hooks for object and form data
    const {
        object: unifiedObject,
        updateField: updateObjectField,
        updateTitle: updateObjectTitle,
        updateStatus: updateObjectStatus,
        updateSlot: updateObjectSlot,
        updateWidgets: updateObjectWidgets,
        hasUnsavedChanges: objectHasUnsavedChanges,
        isDirty: objectIsDirty
    } = useObjectData(objectId)

    const {
        initializeField: initializeFormField,
        updateField: updateFormField,
        hasUnsavedChanges: formHasUnsavedChanges,
        isDirty: formIsDirty,
        getFieldValue
    } = useFormData(formId, 'object')

    const [namespace, setNamespace] = useState(null)


    // Widget editor ref and state
    const objectContentEditorRef = useRef(null)
    const [widgetEditorUI, setWidgetEditorUI] = useState({
        isOpen: false,
        editingWidget: null,
        hasUnsavedChanges: false
    })

    // Combine unsaved changes from object and form data
    const hasUnsavedChanges = objectHasUnsavedChanges || formHasUnsavedChanges || objectIsDirty || formIsDirty

    // Notify parent about unsaved changes
    useEffect(() => {
        if (onUnsavedChanges) {
            onUnsavedChanges(hasUnsavedChanges)
        }
    }, [hasUnsavedChanges, onUnsavedChanges])

    // Fetch widget types for display names
    const { data: widgetTypes = [] } = useQuery({
        queryKey: ['widget-types'],
        queryFn: async () => {
            try {
                const response = await widgetsApi.getTypes(true)
                return Array.isArray(response) ? response : response?.data || response?.results || []
            } catch (error) {
                console.error('Error fetching widget types:', error)
                return []
            }
        },
        staleTime: 5 * 60 * 1000, // 5 minutes
    })

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

    // Get widget data from unified context or fallback to instance
    const localWidgets = unifiedObject?.widgets || instance?.widgets || {}

    // Subscribe to widget events for real-time updates and dirty state management
    const { subscribeToOperations } = useUnifiedData()

    useEffect(() => {
        // Handler for widget operations
        const handleWidgetOperation = (operation) => {
            if (operation.type === 'UPDATE_WIDGET_CONFIG') {
                // Widget changes are now handled by UnifiedDataContext
                // The unifiedObject will automatically update
                console.log('Widget config updated via UnifiedDataContext:', operation)
            }
        }

        // Subscribe to widget change events
        const unsubscribe = subscribeToOperations(handleWidgetOperation, ['UPDATE_WIDGET_CONFIG'])

        // Cleanup subscription
        return () => {
            unsubscribe()
        }
    }, [subscribeToOperations])

    // Handle real-time widget updates from WidgetEditorPanel
    const handleRealTimeWidgetUpdate = useCallback(async (updatedWidget) => {
        if (!updatedWidget || !updatedWidget.slotName) return

        // Update widget through unified context
        const slotName = updatedWidget.slotName
        const currentSlotWidgets = localWidgets[slotName] || []
        const updatedSlotWidgets = currentSlotWidgets.map(widget =>
            widget.id === updatedWidget.id ? updatedWidget : widget
        )

        // Update the slot through UnifiedDataContext
        await updateObjectSlot(slotName, updatedSlotWidgets)
    }, [localWidgets, updateObjectSlot])

    // Widget editor state management - direct callback approach instead of polling
    const handleWidgetEditorStateChange = useCallback((newState) => {
        setWidgetEditorUI(prevState => {
            // Only update if state has actually changed
            if (
                prevState.isOpen === newState.isOpen &&
                prevState.editingWidget === newState.editingWidget &&
                prevState.hasUnsavedChanges === newState.hasUnsavedChanges
            ) {
                return prevState
            }
            return { ...prevState, ...newState }
        })
    }, [])

    // Helper function to convert object type schema to ObjectSchemaForm format
    const getSchemaFromObjectType = (objectType) => {
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
                return {
                    name: propName,
                    required: required.includes(propName),
                    ...property,
                    // Map title to label for ObjectSchemaForm compatibility
                    label: property.title || property.label || propName
                }
            }
            return null
        }).filter(Boolean)

        return { fields }
    }
    const [errors, setErrors] = useState({})
    const [saveMode, setSaveMode] = useState('update_current') // 'update_current' or 'create_new'

    const queryClient = useQueryClient()
    const { addNotification } = useGlobalNotifications()

    // Form data is now managed through UnifiedDataContext
    const formData = {
        objectTypeId: getFieldValue('objectTypeId') || objectType?.id || '',
        title: getFieldValue('title') || unifiedObject?.title || instance?.title || '',
        data: getFieldValue('data') || unifiedObject?.data || instance?.data || {},
        status: getFieldValue('status') || unifiedObject?.status || instance?.status || 'draft',
        widgets: localWidgets,
        metadata: getFieldValue('metadata') || unifiedObject?.metadata || instance?.metadata || {}
    }

    // Fetch available object types for selection (when creating)
    const { data: typesResponse } = useQuery({
        queryKey: ['objectTypes'],
        queryFn: () => objectTypesApi.getActive(),
        enabled: Boolean(isNewInstance)
    })

    const availableTypes = typesResponse?.data || []


    // Initialize form data when instance changes (without setting dirty flag)
    useEffect(() => {
        if (instance && !isNewInstance) {
            // Initialize form fields with instance data (won't set dirty flag)
            initializeFormField('objectTypeId', instance.objectType?.id || '');
            initializeFormField('title', instance.title || '');
            initializeFormField('data', instance.data || {});
            initializeFormField('status', instance.status || 'draft');
            initializeFormField('metadata', instance.metadata || {});
        }
    }, [instance, isNewInstance, initializeFormField])

    // Internal save handler used by form buffer and direct saves
    const handleSaveInternal = useCallback(async (data, mode) => {
        let apiCall
        if (isNewInstance) {
            apiCall = objectInstancesApi.create(data)
        } else if (mode === 'update_current') {
            apiCall = objectInstancesApi.updateCurrentVersion(instance.id, data)
        } else {
            apiCall = objectInstancesApi.update(instance.id, data)
        }

        try {
            const response = await apiCall

            // Invalidate queries
            queryClient.invalidateQueries(['objectInstances'])
            queryClient.invalidateQueries(['objectInstance', instance?.id])
            // Widget changes are now tracked by UnifiedDataContext

            // Show success message based on save mode
            let successMessage
            if (isNewInstance) {
                successMessage = 'Object created successfully'
            } else if (mode === 'update_current') {
                successMessage = `Current version (v${instance?.version || 1}) updated successfully`
            } else {
                successMessage = `New version (v${(instance?.version || 1) + 1}) created successfully`
            }

            addNotification(successMessage, 'success')

            // For new instances, update URL to edit mode but stay on content tab
            if (isNewInstance && response?.data?.object?.id) {
                navigate(`/objects/${response.data.object.id}/edit/content`, { replace: true })
            }

            return response
        } catch (error) {
            console.error('Save failed:', error)
            const errorMessage = error.response?.data?.error || 'Failed to save object'
            addNotification(errorMessage, 'error')

            // Handle validation errors
            if (error.response?.data?.errors) {
                setErrors(error.response.data.errors)
            }
            throw error
        }
    }, [isNewInstance, instance?.id, instance?.version, queryClient, addNotification, navigate])


    // Update form field through unified context
    const handleInputChange = useCallback(async (field, value) => {
        try {
            if (field === 'title') {
                // Update object title directly
                await updateObjectTitle(value)
            } else if (field === 'status') {
                // Update object status directly
                await updateObjectStatus(value)
            } else {
                // Update form field
                await updateFormField(field, value)
            }

            // Clear error when user starts typing
            if (errors[field]) {
                setErrors(prev => ({ ...prev, [field]: null }))
            }
        } catch (error) {
            console.error('Failed to update field:', field, error)
        }
    }, [errors, updateObjectTitle, updateObjectStatus, updateFormField])

    // Update nested data field through unified context
    const handleDataFieldChange = useCallback(async (fieldName, value) => {
        try {
            // Update object field directly
            await updateObjectField(fieldName, value)

            // Clear error when user starts typing
            const errorKey = `data_${fieldName}`
            if (errors[errorKey]) {
                setErrors(prev => ({ ...prev, [errorKey]: null }))
            }
        } catch (error) {
            console.error('Failed to update data field:', fieldName, error)
        }
    }, [errors, updateObjectField])

    // hasUnsavedChanges is already defined above using unified context

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
        return Object.keys(newErrors).length === 0
    }, [formData, objectType])

    const handleSave = useCallback(async (mode = saveMode) => {
        if (!validateForm()) {
            addNotification('Please fix the validation errors', 'error')
            return
        }

        // Prepare save data
        const saveData = {
            ...formData,
            widgets: localWidgets,
            // Set parent if creating new instance and parentId is provided
            ...(isNewInstance && parentId && { parent: parentId })
        }

        try {
            await handleSaveInternal(saveData, mode)
            // Form dirty state is now managed by UnifiedDataContext
        } catch (error) {
            // Error handling is done in handleSaveInternal
            console.error('Save failed:', error)
        }
    }, [validateForm, addNotification, formData, localWidgets, isNewInstance, parentId, handleSaveInternal, saveMode])

    // Expose methods to parent component
    useImperativeHandle(ref, () => ({
        handleSave: (mode) => {
            // Map parent's save types to child's save modes
            let saveMode = 'update_current'
            if (mode === 'create_new') {
                saveMode = 'create_new'
            } else if (mode === 'create' || mode === 'update_current') {
                saveMode = 'update_current'
            }

            handleSave(saveMode)
        }
    }), [handleSave])

    // Get widget editor state directly from local state
    const isWidgetEditorOpen = widgetEditorUI.isOpen

    // Debug: console.log("ObjectContentViewInternal", isWidgetEditorOpen)

    return (
        <div className="h-full flex flex-col relative">
            {/* Content Header - Styled like PageEditor */}
            <div className="flex-shrink-0 bg-white border-b border-gray-200 shadow-sm px-4 py-3">
                <div className="flex items-center justify-between">
                    <h1 className="text-lg font-semibold text-gray-900 flex items-center">
                        Object Content & Data
                        {objectType && (
                            <span className="ml-3 text-sm font-medium text-blue-600 bg-blue-50 px-2 py-1 rounded">
                                {objectType.label}
                            </span>
                        )}
                    </h1>

                    {/* Auto-save Status */}
                    <div className="flex items-center space-x-3">
                        {hasUnsavedChanges && (
                            <span className="text-sm text-amber-600 flex items-center">
                                <div className="w-2 h-2 bg-amber-500 rounded-full mr-2"></div>
                                Unsaved changes
                            </span>
                        )}
                    </div>
                </div>
            </div>

            {/* Scrollable Content Area */}
            <div className={`flex-1 min-h-0 overflow-y-auto bg-white transition-all duration-300 ${isWidgetEditorOpen ? 'mr-0' : ''}`}>
                <div className="p-6">
                    {objectType?.slotConfiguration?.slots && objectType.slotConfiguration.slots.length > 0 ? (
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                            {/* Left Column - Widget Slots */}
                            <div className="space-y-6 border-r pr-6 border-gray-200">
                                <div>
                                    <ObjectContentEditor
                                        ref={objectContentEditorRef}
                                        objectType={objectType}
                                        widgets={localWidgets}
                                        onWidgetChange={async (newWidgets) => {
                                            // Update widgets through unified context
                                            await updateObjectWidgets(newWidgets)
                                        }}
                                        onWidgetEditorStateChange={handleWidgetEditorStateChange}
                                        mode="object"
                                    />
                                </div>
                            </div>

                            {/* Right Column - Object Data */}
                            <div className="space-y-6">
                                <ObjectDataForm
                                    objectType={objectType}
                                    isNewInstance={isNewInstance}
                                    availableTypes={availableTypes}
                                    formData={formData}
                                    errors={errors}
                                    handleInputChange={handleInputChange}
                                    handleDataFieldChange={handleDataFieldChange}
                                    getSchemaFromObjectType={getSchemaFromObjectType}
                                    formId={formId}
                                    enableUnifiedData={true}
                                />
                            </div>
                        </div>
                    ) : (
                        /* Single Column - Object Data Only */
                        <div className="space-y-6">
                            <div>
                                <h3 className="text-lg font-medium text-gray-900 mb-4 flex items-center">
                                    <div className="w-2 h-2 bg-green-500 rounded-full mr-2"></div>
                                    Object Data
                                </h3>
                            </div>

                            <ObjectDataForm
                                objectType={objectType}
                                isNewInstance={isNewInstance}
                                availableTypes={availableTypes}
                                formData={formData}
                                errors={errors}
                                handleInputChange={handleInputChange}
                                handleDataFieldChange={handleDataFieldChange}
                                getSchemaFromObjectType={getSchemaFromObjectType}
                                formId={formId}
                                enableUnifiedData={true}
                            />
                        </div>
                    )}
                </div>
            </div>

            {/* Widget Editor Panel - positioned at top level for full-screen slide-out */}
            {widgetEditorUI && (
                <WidgetEditorPanel
                    ref={widgetEditorUI.widgetEditorRef}
                    isOpen={widgetEditorUI.isOpen}
                    onClose={widgetEditorUI.handleCloseWidgetEditor}
                    onSave={widgetEditorUI.handleSaveWidget}
                    onRealTimeUpdate={handleRealTimeWidgetUpdate}
                    onUnsavedChanges={(hasChanges) => {
                        setWidgetEditorUI(prev => ({ ...prev, hasUnsavedChanges: hasChanges }))
                    }}
                    widgetData={widgetEditorUI.editingWidget}
                    title={widgetEditorUI.editingWidget ? `Edit ${getWidgetDisplayName(widgetEditorUI.editingWidget.type, widgetTypes)}` : 'Edit Widget'}
                    autoOpenSpecialEditor={widgetEditorUI.editingWidget?.type === 'core_widgets.ImageWidget'}
                    namespace={namespace}
                />
            )}
        </div>
    )
})

ObjectContentViewInternal.displayName = 'ObjectContentViewInternal'

// Main component that uses UnifiedDataContext (no wrapper needed)
const ObjectContentView = forwardRef((props, ref) => {
    return <ObjectContentViewInternal {...props} ref={ref} />
})

ObjectContentView.displayName = 'ObjectContentView'
export default ObjectContentView
