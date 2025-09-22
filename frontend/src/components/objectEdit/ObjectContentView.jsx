import React, { useState, useEffect, useRef, useCallback, forwardRef, useImperativeHandle, useMemo } from 'react'
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
import { useUnifiedData } from '../../contexts/unified-data'
import { useObjectTitleOperations } from '../../contexts/unified-data/hooks/useObjectTitleOperations'
import { useObjectDataOperations } from '../../contexts/unified-data/hooks/useObjectDataOperations'
import { useObjectWidgetOperations } from '../../contexts/unified-data/hooks/useObjectWidgetOperations'
import { useObjectMetadataOperations } from '../../contexts/unified-data/hooks/useObjectMetadataOperations'
import { useObjectStatusOperations } from '../../contexts/unified-data/hooks/useObjectStatusOperations'
import { WIDGET_EVENTS, WIDGET_CHANGE_TYPES } from '../../types/widgetEvents'
import SelfContainedObjectEditor from '../forms/SelfContainedObjectEditor'

// Internal component that uses widget event hooks
const ObjectContentViewInternal = forwardRef(({ objectType, instance, parentId, isNewInstance, onSave, onCancel, onUnsavedChanges }, ref) => {
    const navigate = useNavigate()
    const { instanceId, objectTypeId, tab } = useParams()

    // Use buffer-based data management (no reactive hooks - no re-renders!)
    const objectId = instance?.id || instanceId || 'new'

    // Refs for buffer instances (no re-renders)
    const objectFormBufferRef = useRef(null)

    // Get dirty state directly from buffer (no local state needed)
    const isDirty = objectFormBufferRef.current?.isDirty || false
    const hasUnsavedChanges = objectFormBufferRef.current?.hasUnsavedChanges || false

    const [namespace, setNamespace] = useState(null)


    // Widget editor ref and state
    const objectContentEditorRef = useRef(null)
    const [widgetEditorUI, setWidgetEditorUI] = useState({
        isOpen: false,
        editingWidget: null,
        hasUnsavedChanges: false
    })

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

    // Get widget data from buffer or fallback to instance (no reactive subscriptions)
    const getCurrentWidgets = useCallback(() => {
        if (objectFormBufferRef.current) {
            return objectFormBufferRef.current.getCurrentData()?.widgets || {}
        }
        return instance?.widgets || {}
    }, [instance])

    // Get current widgets for initial render
    const [localWidgets, setLocalWidgets] = useState(() => getCurrentWidgets())

    // Handle real-time widget updates from WidgetEditorPanel
    const handleRealTimeWidgetUpdate = useCallback(async (updatedWidget) => {
        if (!updatedWidget || !updatedWidget.slotName) return;

        try {
            if (objectFormBufferRef.current) {
                // Update through buffer (no re-renders!)
                const slotName = updatedWidget.slotName;
                const currentWidgets = objectFormBufferRef.current.getCurrentData()?.widgets || {};
                const currentSlotWidgets = currentWidgets[slotName] || [];
                const updatedSlotWidgets = currentSlotWidgets.map(widget =>
                    widget.id === updatedWidget.id ? updatedWidget : widget
                );

                // Update the slot through buffer
                objectFormBufferRef.current.updateWidgetSlot(slotName, updatedSlotWidgets, { source: 'user' });
            } else {
                // Use widget operations hook directly
                const currentWidgets = widgetOperations.getCurrentSlotWidgets(updatedWidget.slotName);
                const updatedSlotWidgets = currentWidgets.map(widget =>
                    widget.id === updatedWidget.id ? updatedWidget : widget
                );

                await widgetOperations.updateWidgetSlot(
                    updatedWidget.slotName,
                    updatedSlotWidgets,
                    { source: 'user' }
                );
            }
        } catch (error) {
            console.error('Failed to update widget:', error);
        }
    }, [widgetOperations])

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

    // Form data is now managed through buffer (no reactive state)
    const getCurrentFormData = useCallback(() => {
        if (objectFormBufferRef.current) {
            const bufferData = objectFormBufferRef.current.getCurrentData()
            return {
                objectTypeId: objectType?.id || '',
                title: bufferData.title || '',
                data: bufferData.data || {},
                status: bufferData.status || 'draft',
                widgets: bufferData.widgets || {},
                metadata: bufferData.metadata || {}
            }
        }
        return {
            objectTypeId: objectType?.id || '',
            title: instance?.title || '',
            data: instance?.data || {},
            status: instance?.status || 'draft',
            widgets: instance?.widgets || {},
            metadata: instance?.metadata || {}
        }
    }, [objectType, instance])

    // Initialize form data from instance or defaults
    const formData = useMemo(() => getCurrentFormData(), [objectType, instance])

    // State for current form data (updated by buffer events)
    const [currentFormData, setCurrentFormData] = useState(formData)

    // Fetch available object types for selection (when creating)
    const { data: typesResponse } = useQuery({
        queryKey: ['objectTypes'],
        queryFn: () => objectTypesApi.getActive(),
        enabled: Boolean(isNewInstance)
    })

    const availableTypes = typesResponse?.data || []


    // Buffer callbacks for handling form changes (minimal re-renders only for UI updates)
    const handleBufferFieldChange = useCallback((fieldName, value, currentData) => {
        // Update form data state so form fields get new values
        setCurrentFormData(currentData)

        // Update local widgets state for UI consistency
        if (fieldName.includes('widgets') || currentData?.widgets) {
            setLocalWidgets(currentData.widgets || {})
        }
    }, [])

    const handleBufferWidgetChange = useCallback((slotName, widgets, currentData) => {
        // Update form data and local widgets state for UI consistency
        setCurrentFormData(currentData)
        setLocalWidgets(currentData.widgets || {})
    }, [])

    // Buffer dirty state is now read directly from buffer.isDirty and buffer.hasUnsavedChanges
    const handleBufferDirtyStateChange = useCallback(() => {
        // No need to maintain local state - we read directly from buffer
    }, [])

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


    // Get specialized operations for direct updates (when buffer not available)
    const titleOperations = useObjectTitleOperations(objectId);
    const dataOperations = useObjectDataOperations(objectId);
    const widgetOperations = useObjectWidgetOperations(objectId);
    const metadataOperations = useObjectMetadataOperations(objectId);
    const statusOperations = useObjectStatusOperations(objectId);

    // Update form field through buffer or specialized hooks
    const handleInputChange = useCallback((field, value) => {
        try {
            if (objectFormBufferRef.current) {
                // Update through buffer - no re-renders!
                objectFormBufferRef.current.updateField(field, value, { source: 'user' });
            } else {
                // Use specialized operations based on field type
                if (field === 'title') {
                    titleOperations.updateTitle(value, { source: 'user' });
                } else if (field === 'status') {
                    statusOperations.updateStatus(value, { source: 'user' });
                } else if (field.startsWith('metadata.')) {
                    const metadataField = field.replace('metadata.', '');
                    metadataOperations.updateMetadata({ [metadataField]: value }, { source: 'user' });
                }
            }

            // Clear error when user starts typing
            if (errors[field]) {
                setErrors(prev => ({ ...prev, [field]: null }));
            }
        } catch (error) {
            console.error('Failed to update field:', field, error);
        }
    }, [errors, titleOperations, statusOperations, metadataOperations]);

    // Update nested data field through buffer or specialized hooks
    const handleDataFieldChange = useCallback((fieldName, value) => {
        try {
            if (objectFormBufferRef.current) {
                // Update data field through buffer - no re-renders!
                objectFormBufferRef.current.updateField(`data.${fieldName}`, value, { source: 'user' });
            } else {
                // Use data operations hook directly
                dataOperations.updateField(fieldName, value, { source: 'user' });
            }

            // Clear error when user starts typing
            const errorKey = `data_${fieldName}`;
            if (errors[errorKey]) {
                setErrors(prev => ({ ...prev, [errorKey]: null }));
            }
        } catch (error) {
            console.error('Failed to update data field:', fieldName, error);
        }
    }, [errors, dataOperations]);

    // hasUnsavedChanges is already defined above using unified context

    const validateForm = useCallback(() => {
        const newErrors = {}

        // Get current data from buffer for validation
        const dataToValidate = objectFormBufferRef.current ?
            objectFormBufferRef.current.getCurrentData() :
            currentFormData

        if (!dataToValidate.objectTypeId && !objectType?.id) {
            newErrors.objectTypeId = 'Object type is required'
        }

        if (!dataToValidate.title?.trim()) {
            newErrors.title = 'Title is required'
        }

        // Validate required schema fields
        if (objectType?.schema?.properties) {
            const required = objectType.schema.required || []
            required.forEach(fieldName => {
                const fieldValue = dataToValidate.data?.[fieldName]
                if (!fieldValue || fieldValue === '') {
                    newErrors[`data_${fieldName}`] = `${fieldName} is required`
                }
            })
        }

        setErrors(newErrors)
        return Object.keys(newErrors).length === 0
    }, [currentFormData, objectType])

    const handleSave = useCallback(async (mode = saveMode) => {
        if (!validateForm()) {
            addNotification('Please fix the validation errors', 'error')
            return
        }

        // Get current data from buffer (this contains all the latest changes!)
        let saveData
        if (objectFormBufferRef.current) {
            const bufferData = objectFormBufferRef.current.getCurrentData()
            saveData = {
                objectTypeId: objectType?.id || '',
                title: bufferData.title,
                data: bufferData.data,
                status: bufferData.status,
                widgets: bufferData.widgets,
                metadata: bufferData.metadata,
                // Set parent if creating new instance and parentId is provided
                ...(isNewInstance && parentId && { parent: parentId })
            }
        } else {
            // Fallback to current form data if buffer not available
            saveData = {
                ...formData,
                widgets: localWidgets,
                // Set parent if creating new instance and parentId is provided
                ...(isNewInstance && parentId && { parent: parentId })
            }
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
                                        onWidgetChange={(newWidgets) => {
                                            // Update widgets through buffer (no re-renders!)
                                            if (objectFormBufferRef.current) {
                                                // Update each slot individually
                                                Object.entries(newWidgets).forEach(([slotName, widgets]) => {
                                                    objectFormBufferRef.current.updateWidgetSlot(slotName, widgets, { source: 'user' })
                                                })
                                            }
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
                                    formData={currentFormData}
                                    errors={errors}
                                    handleInputChange={handleInputChange}
                                    handleDataFieldChange={handleDataFieldChange}
                                    getSchemaFromObjectType={getSchemaFromObjectType}
                                    objectFormBuffer={objectFormBufferRef.current}
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
                                formData={currentFormData}
                                errors={errors}
                                handleInputChange={handleInputChange}
                                handleDataFieldChange={handleDataFieldChange}
                                getSchemaFromObjectType={getSchemaFromObjectType}
                                objectFormBuffer={objectFormBufferRef.current}
                                enableUnifiedData={true}
                            />
                        </div>
                    )}
                </div>
            </div>

            {/* Self-Contained Object Editor - Buffer for zero re-renders */}
            {instance && (
                <SelfContainedObjectEditor
                    objectData={instance}
                    onFieldChange={handleBufferFieldChange}
                    onWidgetChange={handleBufferWidgetChange}
                    // Dirty state is handled by UnifiedDataContext
                    onValidationChange={(isValid, errors) => {
                        // Handle validation changes if needed
                    }}
                    onSave={async (savedData) => {
                        // Save to server through handleSaveInternal
                        try {
                            await handleSaveInternal(savedData, saveMode)
                        } catch (error) {
                            // Error handling is done in handleSaveInternal
                            console.error('Save failed:', error)
                        }
                    }}
                    onError={(error) => {
                        console.error('SelfContainedObjectEditor error:', error)
                    }}
                    ref={(editor) => {
                        if (editor) {
                            objectFormBufferRef.current = editor.getFormInstance()
                        }
                    }}
                />
            )}

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
