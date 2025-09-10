import React, { useState, useEffect, useRef } from 'react'
import { useParams, useNavigate, Link, Navigate, useLocation } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
    ArrowLeft, Layout, FileText, Settings, Calendar, Users, History,
    Eye
} from 'lucide-react'
import { objectInstancesApi, objectTypesApi, objectVersionsApi } from '../api/objectStorage'
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

    // Version management state
    const [currentVersion, setCurrentVersion] = useState(null)
    const [availableVersions, setAvailableVersions] = useState([])

    // Refs for tab components
    const contentTabRef = useRef(null)

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

    // Load versions for existing instances
    const { data: versionsResponse } = useQuery({
        queryKey: ['objectInstance', instanceId, 'versions'],
        queryFn: () => objectInstancesApi.getVersions(instanceId),
        enabled: !!instanceId && !isNewInstance
    })

    // Update available versions when data loads
    useEffect(() => {
        if (versionsResponse?.data) {
            setAvailableVersions(versionsResponse.data)
            // Set current version if not already set
            if (!currentVersion && instance) {
                // Find the version that matches the instance's current version number
                const current = versionsResponse.data.find(v => v.versionNumber === instance.version)
                    || versionsResponse.data[0] // Fallback to first (latest) version
                setCurrentVersion(current)
            }
        }
    }, [versionsResponse, instance, currentVersion])

    // Switch to a different version
    const switchToVersion = async (versionId) => {
        if (!versionId || versionId === instance?.id) return

        try {
            const response = await objectVersionsApi.get(versionId)
            const versionData = response.data

            // Update current version
            const version = availableVersions.find(v => v.id === versionId)
            setCurrentVersion(version)

            // Reconstruct instance object with version data
            const reconstructedInstance = {
                ...instance, // Keep original instance structure (id, objectType, etc.)
                data: versionData.data, // Use version's data
                widgets: versionData.widgets, // Use version's widgets
                version: versionData.versionNumber, // Update version number
                updatedAt: versionData.createdAt, // Use version's creation time
                // Explicitly preserve objectType for UI components
                objectType: instance.objectType
            }

            // Update instance data with reconstructed object
            queryClient.setQueryData(['objectInstance', instanceId], { data: reconstructedInstance })

            addNotification(`Switched to version ${version?.versionNumber || 'Unknown'}`, 'info')
        } catch (error) {
            console.error('Failed to switch version:', error)
            addNotification('Failed to switch version', 'error')
        }
    }

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
        // If we're on the content tab, delegate to the child component's save method
        // which has access to the current localWidgets and formData state
        if (tab === 'content' && contentTabRef.current?.handleSave) {
            contentTabRef.current.handleSave(saveType)
        } else {
            // Fallback to original logic for other tabs
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
                return <ObjectContentView ref={contentTabRef} {...commonProps} />
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
            {/* Header - Fixed - Styled like PageEditor */}
            <div className="flex-shrink-0 bg-white border-b border-gray-200 shadow-sm">
                <div className="px-4 py-3">
                    <div className="flex items-center justify-between">
                        {/* Left section - Back button and object info */}
                        <div className="flex items-center space-x-4">
                            <button
                                onClick={handleBack}
                                className="flex items-center px-3 py-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors"
                            >
                                <ArrowLeft className="w-4 h-4 mr-2" />
                                Back to Objects
                            </button>

                            <div className="h-6 w-px bg-gray-300"></div>

                            <div>
                                <h1 className="text-lg font-semibold text-gray-900 truncate flex items-center">
                                    {objectType?.iconImage ? (
                                        <img
                                            src={objectType.iconImage}
                                            alt={objectType.label}
                                            className="w-5 h-5 object-cover rounded mr-2"
                                        />
                                    ) : (
                                        <Layout className="h-5 w-5 mr-2" />
                                    )}
                                    {isNewInstance ? `New ${objectType?.label}` : instance?.title || 'Untitled'}
                                </h1>
                                <p className="text-sm text-gray-500">
                                    {isNewInstance
                                        ? `Create a new ${objectType?.label?.toLowerCase()}`
                                        : `Edit ${objectType?.label?.toLowerCase()}`
                                    }
                                </p>
                            </div>
                        </div>

                        {/* Center section - Tab navigation */}
                        <div className="flex items-center space-x-3">
                            <div className="hidden lg:flex items-center space-x-1">
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
            </div>

            {/* Content Area - Scrollable */}
            <div className="flex-1 min-h-0">
                {renderTabContent()}
            </div>

            {/* Status bar with notifications and save buttons */}
            <StatusBar
                isDirty={hasUnsavedChanges}
                currentVersion={currentVersion}
                availableVersions={availableVersions}
                onVersionChange={switchToVersion}
                onSaveClick={() => handleSave('update_current')}
                onSaveNewClick={() => handleSave('create_new')}
                isSaving={saveMutation.isPending}
                isNewPage={isNewInstance}
                customStatusContent={
                    <div className="text-sm text-gray-600">
                        {isNewInstance ? 'Creating' : 'Editing'} {objectType?.label} - {tabs.find(t => t.id === tab)?.label}
                    </div>
                }
            />
        </div>
    )
}

export default ObjectInstanceEditPage
