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
import { useUnifiedData } from '../../contexts/unified-data/v2/context/UnifiedDataContext'
import { useObjectOperations } from '../../contexts/unified-data/v2/hooks/useObjectOperations'
import { useObjectRegistration } from '../../contexts/unified-data/v2/hooks/useObjectRegistration'
import SelfContainedObjectEditor from '../forms/SelfContainedObjectEditor'

// Internal component that uses unified data hooks
const ObjectContentViewInternal = forwardRef(({ objectType, instance, parentId, isNewInstance, onSave, onCancel, onUnsavedChanges }, ref) => {
    const navigate = useNavigate()
    const { instanceId, objectTypeId, tab } = useParams()

    // Use unified data management
    const objectId = instance?.id || instanceId || 'new'

    // Register object in context
    const { isRegistered } = useObjectRegistration(objectId, {
        initialData: instance,
        preserveLocalChanges: true,
        validateOnRegister: true
    })

    // Get unified operations
    const {
        titleOperations,
        dataOperations,
        widgetOperations,
        metadataOperations,
        statusOperations,
        getCurrentData,
        isDirty,
        hasUnsavedChanges
    } = useObjectOperations(objectId, instance)

    // Local state for UI
    const [namespace, setNamespace] = useState(null)
    const [errors, setErrors] = useState({})
    const [saveMode, setSaveMode] = useState('update_current')
    const [currentFormData, setCurrentFormData] = useState(() => getCurrentData())
    const [localWidgets, setLocalWidgets] = useState(() => getCurrentData()?.widgets || {})

    // Refs
    const objectContentEditorRef = useRef(null)
    const objectFormBufferRef = useRef(null)

    // Widget editor state
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

    // Fetch widget types
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
        staleTime: 5 * 60 * 1000
    })

    // Load namespace
    useEffect(() => {
        const loadNamespace = async () => {
            try {
                if (objectType?.namespace?.slug) {
                    setNamespace(objectType.namespace.slug)
                } else {
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

    // Handle real-time widget updates
    const handleRealTimeWidgetUpdate = useCallback(async (updatedWidget) => {
        if (!updatedWidget?.slotName) return

        try {
            const currentWidgets = getCurrentData()?.widgets || {}
            const currentSlotWidgets = currentWidgets[updatedWidget.slotName] || []
            const updatedSlotWidgets = currentSlotWidgets.map(widget =>
                widget.id === updatedWidget.id ? updatedWidget : widget
            )

            await widgetOperations.updateWidgetSlot(
                updatedWidget.slotName,
                updatedSlotWidgets,
                { source: 'user' }
            )

            // Update local state for UI
            setLocalWidgets(prev => ({
                ...prev,
                [updatedWidget.slotName]: updatedSlotWidgets
            }))
        } catch (error) {
            console.error('Failed to update widget:', error)
        }
    }, [getCurrentData, widgetOperations])

    // Widget editor state management
    const handleWidgetEditorStateChange = useCallback((newState) => {
        setWidgetEditorUI(prev => {
            if (
                prev.isOpen === newState.isOpen &&
                prev.editingWidget === newState.editingWidget &&
                prev.hasUnsavedChanges === newState.hasUnsavedChanges
            ) {
                return prev
            }
            return { ...prev, ...newState }
        })
    }, [])

    // Schema conversion helper
    const getSchemaFromObjectType = useCallback((objectType) => {
        if (!objectType?.schema?.properties) {
            return { fields: [] }
        }

        const properties = objectType.schema.properties
        const required = objectType.schema.required || []
        const propertyOrder = objectType.schema.propertyOrder || []
        const keysToProcess = propertyOrder.length > 0 ? propertyOrder : Object.keys(properties)

        const fields = keysToProcess
            .filter(propName => propName !== 'title')
            .map(propName => {
                if (properties[propName]) {
                    const property = properties[propName]
                    return {
                        name: propName,
                        required: required.includes(propName),
                        ...property,
                        label: property.title || property.label || propName
                    }
                }
                return null
            })
            .filter(Boolean)

        return { fields }
    }, [])

    // Query client and notifications
    const queryClient = useQueryClient()
    const { addNotification } = useGlobalNotifications()

    // Save handling
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

            // Show success message
            const successMessage = isNewInstance
                ? 'Object created successfully'
                : mode === 'update_current'
                    ? `Current version (v${instance?.version || 1}) updated successfully`
                    : `New version (v${(instance?.version || 1) + 1}) created successfully`

            addNotification(successMessage, 'success')

            // Update URL for new instances
            if (isNewInstance && response?.data?.object?.id) {
                navigate(`/objects/${response.data.object.id}/edit/content`, { replace: true })
            }

            return response
        } catch (error) {
            console.error('Save failed:', error)
            const errorMessage = error.response?.data?.error || 'Failed to save object'
            addNotification(errorMessage, 'error')

            if (error.response?.data?.errors) {
                setErrors(error.response.data.errors)
            }
            throw error
        }
    }, [isNewInstance, instance?.id, instance?.version, queryClient, addNotification, navigate])

    // Field change handlers
    const handleInputChange = useCallback((field, value) => {
        try {
            if (field === 'title') {
                titleOperations.updateTitle(value, { source: 'user' })
            } else if (field === 'status') {
                statusOperations.updateStatus(value, { source: 'user' })
            } else if (field.startsWith('metadata.')) {
                const metadataField = field.replace('metadata.', '')
                metadataOperations.updateMetadata({ [metadataField]: value }, { source: 'user' })
            }

            // Clear error
            if (errors[field]) {
                setErrors(prev => ({ ...prev, [field]: null }))
            }
        } catch (error) {
            console.error('Failed to update field:', field, error)
        }
    }, [errors, titleOperations, statusOperations, metadataOperations])

    const handleDataFieldChange = useCallback((fieldName, value) => {
        try {
            dataOperations.updateField(fieldName, value, { source: 'user' })

            // Clear error
            const errorKey = `data_${fieldName}`
            if (errors[errorKey]) {
                setErrors(prev => ({ ...prev, [errorKey]: null }))
            }
        } catch (error) {
            console.error('Failed to update data field:', fieldName, error)
        }
    }, [errors, dataOperations])

    // Form validation
    const validateForm = useCallback(() => {
        const newErrors = {}
        const dataToValidate = getCurrentData()

        if (!dataToValidate.objectTypeId && !objectType?.id) {
            newErrors.objectTypeId = 'Object type is required'
        }

        if (!dataToValidate.title?.trim()) {
            newErrors.title = 'Title is required'
        }

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
    }, [getCurrentData, objectType])

    // Save handler
    const handleSave = useCallback(async (mode = saveMode) => {
        if (!validateForm()) {
            addNotification('Please fix the validation errors', 'error')
            return
        }

        const saveData = {
            objectTypeId: objectType?.id || '',
            ...getCurrentData(),
            ...(isNewInstance && parentId && { parent: parentId })
        }

        try {
            await handleSaveInternal(saveData, mode)
        } catch (error) {
            console.error('Save failed:', error)
        }
    }, [validateForm, addNotification, getCurrentData, objectType?.id, isNewInstance, parentId, handleSaveInternal, saveMode])

    // Expose methods to parent
    useImperativeHandle(ref, () => ({
        handleSave: (mode) => {
            const actualMode = mode === 'create_new' ? 'create_new' : 'update_current'
            handleSave(actualMode)
        }
    }), [handleSave])

    // Fetch available types for new instances
    const { data: typesResponse } = useQuery({
        queryKey: ['objectTypes'],
        queryFn: () => objectTypesApi.getActive(),
        enabled: Boolean(isNewInstance)
    })

    const availableTypes = typesResponse?.data || []

    return (
        <div className="h-full flex flex-col relative">
            {/* Content Header */}
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

                    {/* Status */}
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

            {/* Content Area */}
            <div className={`flex-1 min-h-0 overflow-y-auto bg-white transition-all duration-300 ${widgetEditorUI.isOpen ? 'mr-0' : ''}`}>
                <div className="p-6">
                    {objectType?.slotConfiguration?.slots?.length > 0 ? (
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                            {/* Widget Slots */}
                            <div className="space-y-6 border-r pr-6 border-gray-200">
                                <ObjectContentEditor
                                    ref={objectContentEditorRef}
                                    objectType={objectType}
                                    widgets={localWidgets}
                                    onWidgetChange={(newWidgets) => {
                                        Object.entries(newWidgets).forEach(([slotName, widgets]) => {
                                            widgetOperations.updateWidgetSlot(slotName, widgets, { source: 'user' })
                                        })
                                        setLocalWidgets(newWidgets)
                                    }}
                                    onWidgetEditorStateChange={handleWidgetEditorStateChange}
                                    mode="object"
                                />
                            </div>

                            {/* Object Data */}
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
                                    enableUnifiedData={true}
                                />
                            </div>
                        </div>
                    ) : (
                        /* Single Column Layout */
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
                                enableUnifiedData={true}
                            />
                        </div>
                    )}
                </div>
            </div>

            {/* Widget Editor Panel */}
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

const ObjectContentView = forwardRef((props, ref) => {
    return <ObjectContentViewInternal {...props} ref={ref} />
})

ObjectContentView.displayName = 'ObjectContentView'

export default ObjectContentView
