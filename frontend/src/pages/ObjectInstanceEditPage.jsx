import React, { useState, useEffect } from 'react'
import { useParams, useNavigate, Link, Navigate, useLocation } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
    ArrowLeft, Layout, FileText, Settings, Calendar, Users, History,
    Save, Eye
} from 'lucide-react'
import { objectInstancesApi, objectTypesApi } from '../api/objectStorage'
import { useGlobalNotifications } from '../contexts/GlobalNotificationContext'
import StatusBar from '../components/StatusBar'

// Import individual tab components
import ObjectContentView from '../components/objectEdit/ObjectContentView'
import ObjectSettingsView from '../components/objectEdit/ObjectSettingsView'
import ObjectPublishingView from '../components/objectEdit/ObjectPublishingView'
import ObjectSubObjectsView from '../components/objectEdit/ObjectSubObjectsView'
import ObjectVersionsView from '../components/objectEdit/ObjectVersionsView'

const ObjectInstanceEditPage = () => {
    const { instanceId, objectTypeId, tab = 'content' } = useParams()
    const navigate = useNavigate()
    const location = useLocation()
    const { addNotification } = useGlobalNotifications()
    const queryClient = useQueryClient()

    // Save state management
    const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false)

    // Save mutation
    const saveMutation = useMutation({
        mutationFn: (saveData) => {
            if (isNewInstance) {
                return objectInstancesApi.create(saveData)
            } else if (saveData.createNew) {
                // Create new version
                return objectInstancesApi.createVersion(instanceId, saveData)
            } else {
                // Update current version
                return objectInstancesApi.update(instanceId, saveData)
            }
        },
        onSuccess: (response, variables) => {
            queryClient.invalidateQueries(['objectInstances'])
            queryClient.invalidateQueries(['objectInstance'])

            const message = isNewInstance
                ? 'Object created successfully'
                : variables.createNew
                    ? 'New version created successfully'
                    : 'Object updated successfully'

            addNotification(message, 'success')
            setHasUnsavedChanges(false)

            // Navigate back or to the new instance
            if (isNewInstance && response.data?.id) {
                navigate(`/objects/${response.data.id}/edit/content`)
            } else {
                handleBack()
            }
        },
        onError: (error) => {
            console.error('Failed to save object:', error)
            addNotification('Failed to save object', 'error')
        }
    })

    // Extract parent ID from URL search params for new sub-objects
    const urlParams = new URLSearchParams(location.search)
    const parentIdFromUrl = urlParams.get('parent')

    const isNewInstance = !instanceId && objectTypeId
    const isEditingInstance = !!instanceId

    // Redirect if neither creating nor editing
    if (!isNewInstance && !isEditingInstance) {
        return <Navigate to="/objects" replace />
    }

    // Fetch object instance if editing
    const { data: instanceResponse, isLoading: instanceLoading } = useQuery({
        queryKey: ['objectInstance', instanceId],
        queryFn: () => objectInstancesApi.get(instanceId),
        enabled: !!instanceId
    })

    // Get object type ID from instance or params
    const actualObjectTypeId = instanceResponse?.data?.objectType?.id || objectTypeId

    // Fetch object type details
    const { data: objectTypeResponse, isLoading: typeLoading } = useQuery({
        queryKey: ['objectType', actualObjectTypeId],
        queryFn: () => objectTypesApi.get(actualObjectTypeId),
        enabled: !!actualObjectTypeId
    })

    const objectType = objectTypeResponse?.data
    const instance = instanceResponse?.data

    // Generate sub-objects tab label with allowed child types
    const getSubObjectsLabel = () => {
        const allowedChildTypes = objectType?.allowedChildTypes || []
        if (allowedChildTypes.length === 1) {
            return allowedChildTypes[0].label
        } else if (allowedChildTypes.length <= 3) {
            const typeNames = allowedChildTypes.map(t => t.label).join(', ')
            return typeNames
        } else {
            return `${allowedChildTypes.length} types`
        }
    }

    // Tab definitions with routing
    const tabs = [
        { id: 'content', label: 'Content', icon: Layout },
        // Only show sub-objects tab if there are allowed child types
        ...((objectType?.allowedChildTypes || []).length > 0 ? [{ id: 'subobjects', label: getSubObjectsLabel(), icon: Users }] : []),
        { id: 'settings', label: 'Settings', icon: Settings },
        { id: 'publishing', label: 'Publishing', icon: Calendar },
        ...(isEditingInstance ? [{ id: 'versions', label: 'Versions', icon: History }] : [])
    ]

    // Validate tab parameter
    const validTabs = tabs.map(t => t.id)
    if (!validTabs.includes(tab)) {
        const defaultTab = 'content'
        const redirectPath = isNewInstance
            ? `/objects/new/${objectTypeId}/${defaultTab}`
            : `/objects/${instanceId}/edit/${defaultTab}`
        return <Navigate to={redirectPath} replace />
    }

    // Save handlers
    const handleSave = async (saveType = 'update_current') => {
        // Collect data from all tabs - this is a simplified version
        // In a real implementation, you'd want to collect data from each tab component
        const saveData = {
            objectTypeId: actualObjectTypeId,
            title: instance?.title || 'Untitled',
            data: instance?.data || {},
            widgets: instance?.widgets || {},
            status: instance?.status || 'draft',
            parent: parentIdFromUrl || instance?.parent?.id || instance?.parent,
            createNew: saveType === 'create_new'
        }

        saveMutation.mutate(saveData)
    }

    const handleBack = () => {
        // If this object has a parent (either from URL param or instance data), 
        // navigate back to parent's sub-objects view
        const actualParentId = parentIdFromUrl || instance?.parent?.id || instance?.parent
        if (actualParentId) {
            navigate(`/objects/${actualParentId}/edit/subobjects`)
        } else {
            // If no parent, go to the list view filtered by this object's type
            const objectTypeName = objectType?.name
            if (objectTypeName) {
                navigate(`/objects/${objectTypeName}`)
            } else {
                navigate('/objects')
            }
        }
    }

    const getTabPath = (tabId) => {
        return isNewInstance
            ? `/objects/new/${objectTypeId}/${tabId}`
            : `/objects/${instanceId}/edit/${tabId}`
    }

    // Render current tab content
    const renderTabContent = () => {
        const commonProps = {
            objectType,
            instance,
            parentId: parentIdFromUrl || instance?.parent?.id || instance?.parent,
            isNewInstance,
            onUnsavedChanges: setHasUnsavedChanges,
            onSave: () => {
                // This is now handled by the footer buttons
                // Individual tabs can still trigger saves if needed
            },
            onCancel: handleBack
        }

        switch (tab) {
            case 'content':
                return <ObjectContentView {...commonProps} />
            case 'settings':
                return <ObjectSettingsView {...commonProps} />
            case 'publishing':
                return <ObjectPublishingView {...commonProps} />
            case 'subobjects':
                return <ObjectSubObjectsView {...commonProps} />
            case 'versions':
                return <ObjectVersionsView {...commonProps} />
            default:
                return <div>Tab not found</div>
        }
    }

    const isLoading = instanceLoading || typeLoading

    if (isLoading) {
        return (
            <div className="min-h-screen bg-gray-50 flex items-center justify-center">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
            </div>
        )
    }

    if (!objectType) {
        return (
            <div className="min-h-screen bg-gray-50 flex items-center justify-center">
                <div className="text-center">
                    <h2 className="text-xl font-semibold text-gray-900 mb-2">Object Type Not Found</h2>
                    <p className="text-gray-600 mb-4">The specified object type could not be found.</p>
                    <button
                        onClick={handleBack}
                        className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700"
                    >
                        Back to Objects
                    </button>
                </div>
            </div>
        )
    }

    return (
        <div className="h-screen bg-gray-50 flex flex-col">
            {/* Header - Fixed */}
            <div className="flex-shrink-0 bg-white shadow-sm border-b">
                <div className="max-w-7xl mx-auto px-6 py-4">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center">
                            <button
                                onClick={handleBack}
                                className="mr-4 p-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-md transition-colors"
                            >
                                <ArrowLeft className="h-5 w-5" />
                            </button>
                            <div>
                                <h1 className="text-2xl font-bold text-gray-900 flex items-center">
                                    {objectType?.iconImage ? (
                                        <img
                                            src={objectType.iconImage}
                                            alt={objectType.label}
                                            className="w-6 h-6 object-cover rounded mr-3"
                                        />
                                    ) : (
                                        <Layout className="h-6 w-6 mr-3" />
                                    )}
                                    {isNewInstance ? `New ${objectType?.label}` : instance?.title || 'Untitled'}
                                </h1>
                                <p className="text-gray-600 mt-1">
                                    {isNewInstance
                                        ? `Create a new ${objectType?.label?.toLowerCase()}`
                                        : `Edit ${objectType?.label?.toLowerCase()}`
                                    }
                                </p>
                            </div>
                        </div>
                    </div>

                    {/* Tab Navigation */}
                    <div className="mt-6">
                        <div className="flex items-center space-x-1">
                            {tabs.map((tabDef) => {
                                const Icon = tabDef.icon
                                const isActive = tab === tabDef.id

                                return (
                                    <Link
                                        key={tabDef.id}
                                        to={getTabPath(tabDef.id)}
                                        className={`flex items-center px-4 py-2 rounded-lg transition-colors ${isActive
                                            ? 'bg-blue-100 text-blue-700'
                                            : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
                                            }`}
                                    >
                                        <Icon className="w-4 h-4 mr-2" />
                                        {tabDef.label}
                                    </Link>
                                )
                            })}
                        </div>
                    </div>
                </div>
            </div>

            {/* Content Area - Scrollable */}
            <div className="flex-1 min-h-0">
                {renderTabContent()}
            </div>

            {/* Footer - Fixed with Save Buttons */}
            <div className="flex-shrink-0 bg-white border-t border-gray-200 shadow-lg">
                <div className="max-w-7xl mx-auto px-6 py-4">
                    <div className="flex items-center justify-between">
                        {/* Status Info */}
                        <div className="text-sm text-gray-600">
                            {isNewInstance ? 'Creating' : 'Editing'} {objectType?.label} - {tabs.find(t => t.id === tab)?.label}
                        </div>

                        {/* Save Buttons */}
                        <div className="flex items-center space-x-3">
                            {!isNewInstance && (
                                <>
                                    <button
                                        onClick={() => handleSave('update_current')}
                                        disabled={saveMutation.isPending || !hasUnsavedChanges}
                                        className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center transition-colors"
                                    >
                                        {saveMutation.isPending ? (
                                            <>
                                                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                                                Saving...
                                            </>
                                        ) : (
                                            <>
                                                <Save className="h-4 w-4 mr-2" />
                                                Save
                                            </>
                                        )}
                                    </button>
                                    <button
                                        onClick={() => handleSave('create_new')}
                                        disabled={saveMutation.isPending || !hasUnsavedChanges}
                                        className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center transition-colors"
                                    >
                                        {saveMutation.isPending ? (
                                            <>
                                                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                                                Saving...
                                            </>
                                        ) : (
                                            <>
                                                <Save className="h-4 w-4 mr-2" />
                                                Save as New...
                                            </>
                                        )}
                                    </button>
                                </>
                            )}
                            {isNewInstance && (
                                <button
                                    onClick={() => handleSave('create')}
                                    disabled={saveMutation.isPending || !hasUnsavedChanges}
                                    className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center transition-colors"
                                >
                                    {saveMutation.isPending ? (
                                        <>
                                            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                                            Creating...
                                        </>
                                    ) : (
                                        <>
                                            <Save className="h-4 w-4 mr-2" />
                                            Save
                                        </>
                                    )}
                                </button>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
}

export default ObjectInstanceEditPage
