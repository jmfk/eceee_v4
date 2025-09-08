import React, { useState, useEffect, useRef, useCallback, forwardRef, useImperativeHandle } from 'react'
import { useMutation, useQueryClient, useQuery } from '@tanstack/react-query'
import { useNavigate, useParams } from 'react-router-dom'
import { Save, AlertCircle } from 'lucide-react'
import { objectInstancesApi, objectTypesApi } from '../../api/objectStorage'
import { useGlobalNotifications } from '../../contexts/GlobalNotificationContext'
import { getWidgetDisplayName } from '../../hooks/useWidgets'
import { widgetsApi } from '../../api'
import ObjectContentEditor from '../ObjectContentEditor'
import ObjectSchemaForm from '../ObjectSchemaForm'
import WidgetEditorPanel from '../WidgetEditorPanel'

const ObjectContentView = forwardRef(({ objectType, instance, parentId, isNewInstance, onSave, onCancel, onUnsavedChanges }, ref) => {
    const navigate = useNavigate()
    const { instanceId, objectTypeId, tab } = useParams()

    // Track widget changes locally (don't auto-save)
    const [localWidgets, setLocalWidgets] = useState(instance?.widgets || {})

    // Widget editor ref and state
    const objectContentEditorRef = useRef(null)
    const [widgetEditorUI, setWidgetEditorUI] = useState({
        isOpen: false,
        editingWidget: null,
        hasUnsavedChanges: false
    })
    const [hasWidgetChanges, setHasWidgetChanges] = useState(false)

    // Notify parent about unsaved changes
    useEffect(() => {
        if (onUnsavedChanges) {
            onUnsavedChanges(hasWidgetChanges)
        }
    }, [hasWidgetChanges, onUnsavedChanges])

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

    // Update local widgets when instance changes
    useEffect(() => {
        setLocalWidgets(instance?.widgets || {})
        setHasWidgetChanges(false)
    }, [instance])

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

        // Mark as having changes but don't auto-save
        setHasWidgetChanges(true)
    }, [])

    // Sync widget editor state with ObjectContentEditor
    useEffect(() => {
        const updateWidgetEditorState = () => {
            if (objectContentEditorRef.current) {
                const editorState = objectContentEditorRef.current
                setWidgetEditorUI({
                    isOpen: editorState.widgetEditorOpen || false,
                    editingWidget: editorState.editingWidget || null,
                    hasUnsavedChanges: editorState.widgetHasUnsavedChanges || false,
                    widgetEditorRef: editorState.widgetEditorRef,
                    handleCloseWidgetEditor: editorState.handleCloseWidgetEditor,
                    handleSaveWidget: editorState.handleSaveWidget
                })
            }
        }

        // Set up polling to sync state (since we can't use React context here)
        const interval = setInterval(updateWidgetEditorState, 100)

        return () => clearInterval(interval)
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
                return {
                    name: propName,
                    required: required.includes(propName),
                    ...properties[propName]
                }
            }
            return null
        }).filter(Boolean)

        return { fields }
    }
    const [formData, setFormData] = useState({
        objectTypeId: objectType?.id || '',
        title: instance?.title || '',
        data: instance?.data || {},
        status: instance?.status || 'draft',
        widgets: instance?.widgets || {},
        metadata: instance?.metadata || {}
    })
    const [errors, setErrors] = useState({})
    const [isDirty, setIsDirty] = useState(false)
    const [saveMode, setSaveMode] = useState('update_current') // 'update_current' or 'create_new'

    const queryClient = useQueryClient()
    const { addNotification } = useGlobalNotifications()

    // Fetch available object types for selection (when creating)
    const { data: typesResponse } = useQuery({
        queryKey: ['objectTypes'],
        queryFn: () => objectTypesApi.getActive(),
        enabled: Boolean(isNewInstance)
    })

    const availableTypes = typesResponse?.data || []

    useEffect(() => {
        if (instance) {
            setFormData({
                objectTypeId: instance.objectType?.id || '',
                title: instance.title || '',
                data: instance.data || {},
                status: instance.status || 'draft',
                widgets: instance.widgets || {},
                metadata: instance.metadata || {}
            })
            // Sync local widgets with instance
            setLocalWidgets(instance.widgets || {})
            setHasWidgetChanges(false)
        }
    }, [instance])

    // Save mutation
    const saveMutation = useMutation({
        mutationFn: ({ data, mode }) => {
            if (isNewInstance) {
                return objectInstancesApi.create(data)
            } else if (mode === 'update_current') {
                return objectInstancesApi.updateCurrentVersion(instance.id, data)
            } else {
                return objectInstancesApi.update(instance.id, data)
            }
        },
        onSuccess: (response, variables) => {
            queryClient.invalidateQueries(['objectInstances'])
            queryClient.invalidateQueries(['objectInstance', instance?.id])
            setIsDirty(false)
            setHasWidgetChanges(false)

            // Show success message based on save mode
            let successMessage
            if (isNewInstance) {
                successMessage = 'Object created successfully'
            } else if (variables.mode === 'update_current') {
                successMessage = `Current version (v${instance?.version || 1}) updated successfully`
            } else {
                successMessage = `New version (v${(instance?.version || 1) + 1}) created successfully`
            }

            addNotification(successMessage, 'success')

            // For new instances, update URL to edit mode but stay on content tab
            if (isNewInstance && response?.data?.object?.id) {
                navigate(`/objects/${response.data.object.id}/edit/content`, { replace: true })
            }
        },
        onError: (error) => {
            console.error('Save failed:', error)
            const errorMessage = error.response?.data?.error || 'Failed to save object'
            addNotification(errorMessage, 'error')

            // Handle validation errors
            if (error.response?.data?.errors) {
                setErrors(error.response.data.errors)
            }
        }
    })

    const handleInputChange = (field, value) => {
        setFormData(prev => ({ ...prev, [field]: value }))
        setIsDirty(true)

        // Clear error when user starts typing
        if (errors[field]) {
            setErrors(prev => ({ ...prev, [field]: null }))
        }
    }

    // Check if there are any unsaved changes (form data or widgets)
    const hasUnsavedChanges = isDirty || hasWidgetChanges

    const handleDataFieldChange = (fieldName, value) => {
        setFormData(prev => ({
            ...prev,
            data: { ...prev.data, [fieldName]: value }
        }))
        setIsDirty(true)

        // Clear error when user starts typing
        const errorKey = `data_${fieldName}`
        if (errors[errorKey]) {
            setErrors(prev => ({ ...prev, [errorKey]: null }))
        }
    }

    const validateForm = () => {
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
    }

    const handleSave = (mode = saveMode) => {
        if (!validateForm()) {
            addNotification('Please fix the validation errors', 'error')
            return
        }

        // Include local widget changes and parent ID in the save data
        const saveData = {
            ...formData,
            widgets: localWidgets,
            // Set parent if creating new instance and parentId is provided
            ...(isNewInstance && parentId && { parent: parentId })
        }
        saveMutation.mutate({ data: saveData, mode })
    }

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

    // Get widget editor state from ObjectContentEditor
    const editorState = objectContentEditorRef.current
    const isWidgetEditorOpen = editorState?.widgetEditorOpen || false

    return (
        <div className="h-full flex flex-col relative">
            {/* Content Header */}
            <div className="flex-shrink-0 bg-white border-b border-gray-200 p-6">
                <h2 className="text-xl font-semibold text-gray-900 flex items-center">
                    Object Content & Data
                    {objectType && (
                        <span className="ml-3 text-sm font-medium text-blue-600 bg-blue-50 px-2 py-1 rounded">
                            {objectType.label}
                        </span>
                    )}
                </h2>
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
                                            setLocalWidgets(newWidgets)
                                            setHasWidgetChanges(true)
                                        }}
                                        mode="object"
                                    />
                                </div>
                            </div>

                            {/* Right Column - Object Data */}
                            <div className="space-y-6">
                                {/* Object Type Selection (only for new instances) */}
                                {isNewInstance && (
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-2">
                                            Object Type <span className="text-red-500">*</span>
                                        </label>
                                        <select
                                            value={formData.objectTypeId}
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
                                            <p className="text-red-600 text-sm mt-1 flex items-center">
                                                <AlertCircle className="h-4 w-4 mr-1" />
                                                {errors.objectTypeId}
                                            </p>
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
                                        value={formData.title}
                                        onChange={(e) => handleInputChange('title', e.target.value)}
                                        className={`w-full px-3 py-2 border rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${errors.title ? 'border-red-300' : 'border-gray-300'
                                            }`}
                                        placeholder="Enter object title..."
                                    />
                                    {errors.title && (
                                        <p className="text-red-600 text-sm mt-1 flex items-center">
                                            <AlertCircle className="h-4 w-4 mr-1" />
                                            {errors.title}
                                        </p>
                                    )}
                                    <p className="text-gray-500 text-sm mt-1">
                                        This is the object's display title (stored on the object, not in schema data)
                                    </p>
                                </div>

                                {/* Dynamic Schema Fields */}
                                {objectType && (
                                    <div className="border-t pt-4">
                                        <h4 className="font-medium text-gray-900 mb-4">
                                            {objectType.label} Fields
                                        </h4>
                                        <ObjectSchemaForm
                                            schema={getSchemaFromObjectType(objectType)}
                                            data={formData.data}
                                            onChange={handleDataFieldChange}
                                            errors={errors}
                                        />
                                    </div>
                                )}
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

                            {/* Object Type Selection (only for new instances) */}
                            {isNewInstance && (
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-2">
                                        Object Type <span className="text-red-500">*</span>
                                    </label>
                                    <select
                                        value={formData.objectTypeId}
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
                                        <p className="text-red-600 text-sm mt-1 flex items-center">
                                            <AlertCircle className="h-4 w-4 mr-1" />
                                            {errors.objectTypeId}
                                        </p>
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
                                    value={formData.title}
                                    onChange={(e) => handleInputChange('title', e.target.value)}
                                    className={`w-full px-3 py-2 border rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${errors.title ? 'border-red-300' : 'border-gray-300'
                                        }`}
                                    placeholder="Enter object title..."
                                />
                                {errors.title && (
                                    <p className="text-red-600 text-sm mt-1 flex items-center">
                                        <AlertCircle className="h-4 w-4 mr-1" />
                                        {errors.title}
                                    </p>
                                )}
                                <p className="text-gray-500 text-sm mt-1">
                                    This is the object's display title (stored on the object, not in schema data)
                                </p>
                            </div>

                            {/* Dynamic Schema Fields */}
                            {objectType && (
                                <div className="border-t pt-4">
                                    <h4 className="font-medium text-gray-900 mb-4">
                                        {objectType.label} Fields
                                    </h4>
                                    <ObjectSchemaForm
                                        schema={getSchemaFromObjectType(objectType)}
                                        data={formData.data}
                                        onChange={handleDataFieldChange}
                                        errors={errors}
                                    />
                                </div>
                            )}
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
                />
            )}
        </div>
    )
})

ObjectContentView.displayName = 'ObjectContentView'
export default ObjectContentView
