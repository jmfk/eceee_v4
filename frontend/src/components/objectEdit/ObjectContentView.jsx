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
    const [formValidationState, setFormValidationState] = useState({ isValid: true, errors: {} })

    const { useExternalChanges, publishUpdate } = useUnifiedData()

    const componentId = useMemo(() => `object-instance-editor-${instanceId || 'new'}`, [instanceId])

    // Subscribe to external changes from UDC
    useExternalChanges(componentId, (state) => {
        if (!instanceId) return;

        const objectData = state.objects?.[String(instanceId)];
        if (objectData) {
            // Sync widgets from UDC state
            if (objectData.widgets && JSON.stringify(objectData.widgets) !== JSON.stringify(localWidgets)) {
                setLocalWidgets(objectData.widgets);
            }
        }
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

    // Note: handleWidgetChange is no longer used by ObjectContentEditor
    // Widget updates now flow exclusively through UDC:
    // 1. ObjectContentEditor publishes updates via publishUpdate()
    // 2. This component receives updates via useExternalChanges() subscription
    // 3. localWidgets state is automatically synced from UDC
    // This prevents duplicate state updates and maintains single source of truth
    const handleWidgetChange = useCallback(async (widgets, widgetId) => {
        // Legacy callback - kept for compatibility but should not be called
        // Updates should only come through UDC now
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

    // Form validation callback - track validation state
    const handleValidationChange = useCallback((isValid, errors) => {
        setFormValidationState({ isValid, errors })
    }, [])


    const [currentFormData, setCurrentFormData] = useState(null)

    const queryClient = useQueryClient()
    const { addNotification } = useGlobalNotifications()
    const formRef = useRef(null)

    // Sync local widgets with instance
    useEffect(() => {
        if (instance) {
            setLocalWidgets(instance.widgets || {})
        }
    }, [instance])

    // Form change callback - track current form data
    const handleFormChange = useCallback((newFormData) => {
        // setCurrentFormData(newFormData)
        // onUnsavedChanges?.(true) // Mark as having unsaved changes
    }, [onUnsavedChanges])

    // Check if there are any unsaved changes (form data or widgets)
    const hasUnsavedChanges = currentFormData !== null

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

                    {/* Save Status */}
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
                                    ref={formRef}
                                    objectType={objectType}
                                    instance={instance}
                                    isNewInstance={isNewInstance}
                                    onFormChange={handleFormChange}
                                    onValidationChange={handleValidationChange}
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
                                ref={formRef}
                                objectType={objectType}
                                instance={instance}
                                isNewInstance={isNewInstance}
                                onFormChange={handleFormChange}
                                onValidationChange={handleValidationChange}
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
                    widgetData={widgetEditorUI.editingWidget}
                    title={widgetEditorUI.editingWidget ? `Edit ${getWidgetDisplayName(widgetEditorUI.editingWidget.type, widgetTypes)}` : 'Edit Widget'}
                    autoOpenSpecialEditor={true}
                    namespace={namespace}
                    context={{ ...context, instanceId }}
                />
            )}
        </div>
    )
})

ObjectContentView.displayName = 'ObjectContentView'
export default ObjectContentView
