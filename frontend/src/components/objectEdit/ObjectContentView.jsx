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
import WidgetEditorPanel from '../WidgetEditorPanel'
import ObjectDataForm from './ObjectDataForm'
import { useUnifiedData } from '../../contexts/unified-data/context/UnifiedDataContext';
import { OperationTypes } from '../../contexts/unified-data/types/operations';

const ObjectContentView = forwardRef(({ objectType, instance, parentId, isNewInstance, onSave, onCancel, onUnsavedChanges, context }, ref) => {
    const navigate = useNavigate()
    const { instanceId, objectTypeId, tab } = useParams()
    const [localWidgets, setLocalWidgets] = useState(instance?.widgets || {})
    const [namespace, setNamespace] = useState(null)

    const { useExternalChanges, publishUpdate } = useUnifiedData()


    const componentId = useMemo(() => `object-instance-editor-${instanceId || 'new'}`, [instanceId])

    useExternalChanges(componentId, state => {
        //console.log("useExternalChanges::ObjectContentView")
        //console.log(state)
        // setLocalWidgets(prevWidgets => {
        //     const newWidgets = { ...prevWidgets }
        //     const slotName = payload.slotName

        //     if (newWidgets[slotName]) {
        //         newWidgets[slotName] = newWidgets[slotName].map(widget =>
        //             widget.id === payload.widgetId ? payload.widget : widget
        //         )
        //     }

        //     return newWidgets
        // })
    });

    // Widget editor state
    const [widgetEditorUI, setWidgetEditorUI] = useState({
        isOpen: false,
        editingWidget: null,
        hasUnsavedChanges: false
    })

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

    // Handle real-time widget updates from WidgetEditorPanel
    const handleRealTimeWidgetUpdate = useCallback((updatedWidget) => {
        if (!updatedWidget || !updatedWidget.slotName) return

        // Update local widgets state for real-time preview
        setLocalWidgets(prevWidgets => {
            const newWidgets = { ...prevWidgets }
            const slotName = updatedWidget.slotName

            if (newWidgets[slotName]) {
                newWidgets[slotName] = newWidgets[slotName].map(widget =>
                    widget.id === updatedWidget.id ? updatedWidget : widget
                )
            }

            return newWidgets
        })

    }, [])

    const handleWidgetChange = useCallback(async (widgets, widgetId) => {
        setLocalWidgets(widgets)

        await publishUpdate(componentId, OperationTypes.MOVE_WIDGET, {
            //id: instanceId,
            //slot: slotName,
            contextType: 'object',
            widgets: widgets
        });
    }, [])

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

    // Simple form state management
    const [formData, setFormData] = useState({
        objectTypeId: objectType?.id || '',
        title: instance?.title || '',
        data: instance?.data || {},
        status: instance?.status || 'draft',
        widgets: instance?.widgets || {},
        metadata: instance?.metadata || {}
    })

    // Track if form has been modified
    // const [isFormDirty, setIsFormDirty] = useState(false)

    // Fetch available object types for selection (when creating)
    const { data: typesResponse } = useQuery({
        queryKey: ['objectTypes'],
        queryFn: () => objectTypesApi.getActive(),
        enabled: Boolean(isNewInstance)
    })

    const availableTypes = typesResponse?.data || []


    // Update form data when instance changes
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
            //setIsFormDirty(false)

            // Sync local widgets with instance
            setLocalWidgets(instance.widgets || {})
            //setHasWidgetChanges(false)
        }
    }, [instance])

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
            //setHasWidgetChanges(false)

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


    // Update form field and mark as dirty
    const handleInputChange = useCallback((field, value) => {
        setFormData(prev => ({ ...prev, [field]: value }))
        //setIsFormDirty(true)

        // Clear error when user starts typing
        if (errors[field]) {
            setErrors(prev => ({ ...prev, [field]: null }))
        }
    }, [errors])

    // Update nested data field
    const handleDataFieldChange = useCallback((fieldName, value) => {
        setFormData(prev => ({
            ...prev,
            data: { ...prev.data, [fieldName]: value }
        }))
        // setIsFormDirty(true)

        // Clear error when user starts typing
        const errorKey = `data_${fieldName}`
        if (errors[errorKey]) {
            setErrors(prev => ({ ...prev, [errorKey]: null }))
        }
    }, [errors])

    // Check if there are any unsaved changes (form data or widgets)
    const hasUnsavedChanges = false;

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
                                        objectType={objectType}
                                        widgets={localWidgets}
                                        onWidgetChange={handleWidgetChange}
                                        onWidgetEditorStateChange={handleWidgetEditorStateChange}
                                        mode="object"
                                        context={{ ...context, instanceId }}
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
                                    context={{ ...context, instanceId }}
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
                                context={{ ...context, instanceId }}
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
                    context={{ ...context, instanceId }}
                />
            )}
        </div>
    )
})

ObjectContentView.displayName = 'ObjectContentView'
export default ObjectContentView
