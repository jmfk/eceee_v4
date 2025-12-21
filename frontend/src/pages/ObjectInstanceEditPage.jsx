import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react'
import { useParams, useNavigate, Link, Navigate, useLocation } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
    ArrowLeft, Layout, FileText, Settings, Calendar, Users, History,
    Eye
} from 'lucide-react'
import { objectInstancesApi, objectTypesApi, objectVersionsApi } from '../api/objectStorage'
import { useUnifiedData } from '../contexts/unified-data/context/UnifiedDataContext'
import { OperationTypes } from '../contexts/unified-data/types/operations'
import { useGlobalNotifications } from '../contexts/GlobalNotificationContext'
import StatusBar from '../components/StatusBar'
import { useDocumentTitle } from '../hooks/useDocumentTitle'
import Breadcrumbs from '../components/common/Breadcrumbs'

// Import individual tab components
import ObjectContentView from '../components/objectEdit/ObjectContentView'
import ObjectSettingsView from '../components/objectEdit/ObjectSettingsView'
import ObjectPublishingView from '../components/objectEdit/ObjectPublishingView'
import ObjectSubObjectsView from '../components/objectEdit/ObjectSubObjectsView'
import ObjectVersionsView from '../components/objectEdit/ObjectVersionsView'

const ObjectInstanceEditPage = () => {
    // --- 1. ALL HOOKS AT THE TOP (Never conditional, never after returns) ---
    const { instanceId, objectTypeId, tab = 'content' } = useParams()
    const navigate = useNavigate()
    const location = useLocation()
    const queryClient = useQueryClient()
    const { addNotification } = useGlobalNotifications()
    const { useExternalChanges, publishUpdate, saveCurrentVersion } = useUnifiedData()

    const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false)
    const [currentVersion, setCurrentVersion] = useState(null)
    const [availableVersions, setAvailableVersions] = useState([])
    const [showEssentialFieldsModal, setShowEssentialFieldsModal] = useState(false)
    const [udcInitError, setUdcInitError] = useState(null)
    const [isSaving, setIsSaving] = useState(false)
    
    const contentTabRef = useRef(null)
    const componentId = useMemo(() => `object-instance-editor-${instanceId || 'new'}`, [instanceId])

    const handleStateChange = useCallback((state) => {
        setHasUnsavedChanges(state.metadata.isDirty);
    }, []);

    useExternalChanges(componentId, handleStateChange);

    const urlParams = new URLSearchParams(location.search)
    const parentIdFromUrl = urlParams.get('parent')
    const isNewInstance = !instanceId && objectTypeId
    const isEditingInstance = !!instanceId

    // Query hooks
    const { data: instanceResponse, isLoading: instanceLoading } = useQuery({
        queryKey: ['objectInstance', instanceId],
        queryFn: () => objectInstancesApi.get(instanceId),
        enabled: !!instanceId
    })

    const actualObjectTypeId = instanceResponse?.data?.objectType?.id || objectTypeId

    const { data: objectTypeResponse, isLoading: typeLoading } = useQuery({
        queryKey: ['objectType', actualObjectTypeId],
        queryFn: () => objectTypesApi.get(actualObjectTypeId),
        enabled: !!actualObjectTypeId
    })

    const { data: versionsResponse, isLoading: versionsLoading } = useQuery({
        queryKey: ['objectInstance', instanceId, 'versions'],
        queryFn: () => objectInstancesApi.getVersions(instanceId),
        enabled: !!instanceId && !isNewInstance
    })

    const { data: parentResponse } = useQuery({
        queryKey: ['objectInstance', parentIdFromUrl, 'metadata'],
        queryFn: () => objectInstancesApi.get(parentIdFromUrl),
        enabled: isNewInstance && !!parentIdFromUrl
    })

    const { data: pathToRootResponse, isLoading: pathLoading } = useQuery({
        queryKey: ['objectInstance', instanceId, 'pathToRoot'],
        queryFn: () => objectInstancesApi.getPathToRoot(instanceId),
        enabled: !!instanceId && !isNewInstance
    })

    const { data: parentPathToRootResponse } = useQuery({
        queryKey: ['objectInstance', parentIdFromUrl, 'pathToRoot'],
        queryFn: () => objectInstancesApi.getPathToRoot(parentIdFromUrl),
        enabled: isNewInstance && !!parentIdFromUrl
    })

    const objectType = objectTypeResponse?.data
    const instance = instanceResponse?.data
    const pathToRoot = pathToRootResponse?.data || []
    const parentPathToRoot = parentPathToRootResponse?.data || []
    const parentMetadata = parentResponse?.data

    // Mutation hooks
    const createNewObjectMutation = useMutation({
        mutationFn: async (essentialFields) => {
            const objectData = {
                object_type_id: actualObjectTypeId,
                title: essentialFields.title,
                status: 'draft',
                parent: parentIdFromUrl || null,
                data: {},
                widgets: {}
            }
            return await objectInstancesApi.create(objectData)
        },
        onSuccess: (newObject) => {
            setShowEssentialFieldsModal(false)
            addNotification('Object created successfully', 'success')
            queryClient.invalidateQueries(['objectInstances'])
            navigate(`/objects/${newObject.data.id}/edit/content`)
        },
        onError: (error) => {
            console.error('Failed to create object:', error)
            addNotification('Failed to create object', 'error')
        }
    })

    const saveMutation = useMutation({
        mutationFn: (saveData) => {
            if (saveData.createNew) return objectInstancesApi.createVersion(instanceId, saveData)
            else return objectInstancesApi.update(instanceId, saveData)
        },
        onSuccess: (response, variables) => {
            queryClient.invalidateQueries(['objectInstances'])
            queryClient.invalidateQueries(['objectInstance'])
            const message = variables.createNew ? 'New version created successfully' : 'Object updated successfully'
            addNotification(message, 'success')
            setHasUnsavedChanges(false)
        },
        onError: (error) => {
            console.error('Failed to save object:', error)
            addNotification('Failed to save object', 'error')
        }
    })

    // Other hooks
    const documentTitle = isNewInstance 
        ? `New ${objectType?.label || 'Object'}` 
        : (instance?.title || 'Loading...')
    useDocumentTitle(documentTitle)

    useEffect(() => {
        if (isNewInstance && !instance && objectType) {
            setShowEssentialFieldsModal(true)
        }
    }, [isNewInstance, instance, objectType])

    useEffect(() => {
        if (versionsResponse?.data) {
            setAvailableVersions(versionsResponse.data)
            if (!currentVersion && instance) {
                const current = versionsResponse.data.find(v => v.versionNumber === instance.version)
                    || versionsResponse.data[0]
                setCurrentVersion(current)
            }
        }
    }, [versionsResponse, instance])

    useEffect(() => {
        if (!instanceId || !instance || !versionsResponse?.data) return
        try {
            setUdcInitError(null)
            const allVersions = Array.isArray(versionsResponse.data) ? versionsResponse.data : []
            const currentVersionEntry = allVersions.find(v => v.versionNumber === instance.version) || allVersions[0]
            const currentVersionId = currentVersionEntry ? String(currentVersionEntry.id) : undefined
            const versionIds = allVersions.map(v => String(v.id))

            publishUpdate(componentId, OperationTypes.INIT_OBJECT, {
                id: String(instance.id),
                data: {
                    ...instance,
                    id: String(instance.id),
                    type: instance?.objectType?.name || instance?.objectType?.id || 'unknown',
                    status: instance?.status || 'draft',
                    metadata: instance?.metadata || {},
                    created_at: instance?.createdAt || new Date().toISOString(),
                    updated_at: instance?.updatedAt || new Date().toISOString(),
                    parentId: instance?.parent?.id || instance?.parent || null,
                    currentVersionId: currentVersionId,
                    availableVersions: versionIds
                }
            })
        } catch (e) {
            console.error('UDC init (objects) failed', e)
            setUdcInitError(e)
            addNotification('Failed to initialize editor.', 'error')
        }
    }, [instanceId, instance, versionsResponse, publishUpdate, componentId, addNotification])

    const handleSave = useCallback(async () => {
        setIsSaving(true);
        try {
            await saveCurrentVersion();
            addNotification('Current version saved', 'success');
        } catch (error) {
            console.error('Save failed:', error);
            addNotification(`Save failed: ${error?.message || 'Unknown error'}`, 'error');
        } finally {
            setIsSaving(false);
        }
    }, [saveCurrentVersion, addNotification]);

    const breadcrumbItems = useMemo(() => {
        const items = [{ label: 'Objects', path: '/objects', icon: Layout }]
        
        // Helper to get type list breadcrumb
        const addTypeListCrumb = (typeName, typeLabel) => {
            items.push({ 
                label: typeLabel + 's', // Simple pluralization fallback
                path: `/objects/${typeName}`
            })
        }

        if (isNewInstance) {
            // New sub-object flow
            const pathFromRoot = [...parentPathToRoot].reverse()
            
            if (pathFromRoot.length > 0) {
                pathFromRoot.forEach((node) => {
                    addTypeListCrumb(node.objectTypeName, node.objectTypeLabel)
                    items.push({ 
                        label: node.title, 
                        path: `/objects/${node.id}/edit/content` 
                    })
                })
                // Link last parent crumb to its sub-objects tab
                const lastCrumb = items[items.length - 1]
                if (lastCrumb && lastCrumb.path) {
                    lastCrumb.path = lastCrumb.path.replace('/edit/content', '/edit/subobjects')
                }
            } else if (objectType) {
                // New root object flow
                addTypeListCrumb(objectType.name, objectType.label)
            }
            items.push({ label: `New ${objectType?.label || 'Object'}` })
        } else if (pathToRoot.length > 0) {
            // Edit flow
            // pathToRoot is returned as [Self, Parent, Root] from backend due to .reverse() in models.py
            const pathFromRoot = [...pathToRoot].reverse()

            pathFromRoot.forEach((node, index) => {
                const isCurrent = index === pathFromRoot.length - 1
                
                // Add type crumb
                addTypeListCrumb(node.objectTypeName, node.objectTypeLabel)

                if (isCurrent) {
                    // Current objectcrumb
                    items.push({ label: node.title })
                    
                    // If we are on sub-objects tab, add the type being listed
                    if (tab === 'subobjects' && objectType?.allowedChildTypes?.length === 1) {
                        const childType = objectType.allowedChildTypes[0]
                        items.push({ label: childType.pluralLabel || (childType.label + 's') })
                    }
                } else {
                    // Ancestor crumb
                    items.push({ 
                        label: node.title, 
                        path: `/objects/${node.id}/edit/content` 
                    })
                }
            })
        }
        return items
    }, [objectType, pathToRoot, parentPathToRoot, isNewInstance, tab])

    const parentObject = useMemo(() => {
        // pathToRoot is [Self, Parent, Root]
        if (!isNewInstance) {
            if (pathToRoot.length > 1) return pathToRoot[1] // Parent
        } else if (parentIdFromUrl && parentMetadata) {
            return parentMetadata
        }
        return null
    }, [pathToRoot, isNewInstance, parentIdFromUrl, parentMetadata])

    const handleBack = useCallback(() => {
        if (parentObject) {
            // If sub-object, go to parent's sub-objects view
            navigate(`/objects/${parentObject.id || parentObject.instanceId}/edit/subobjects`)
            return
        }
        // If root object, go to its type list
        const objectTypeName = objectType?.name || instance?.objectTypeName
        if (objectTypeName) navigate(`/objects/${objectTypeName}`)
        else navigate('/objects')
    }, [parentObject, objectType, instance, navigate])

    const switchToVersion = useCallback(async (versionId) => {
        if (!versionId || versionId === instance?.id) return
        try {
            const response = await objectVersionsApi.get(versionId)
            const versionData = response.data
            const version = availableVersions.find(v => v.id === versionId)
            setCurrentVersion(version)
            const reconstructedInstance = {
                ...instance,
                data: versionData.data,
                widgets: versionData.widgets,
                version: versionData.versionNumber,
                updatedAt: versionData.createdAt,
                objectType: instance.objectType
            }
            queryClient.setQueryData(['objectInstance', instanceId], { data: reconstructedInstance })
            addNotification(`Switched to version ${version?.versionNumber || 'Unknown'}`, 'info')
        } catch (error) {
            console.error('Failed to switch version:', error)
            addNotification('Failed to switch version', 'error')
        }
    }, [instance, availableVersions, queryClient, instanceId, addNotification])

    const handleCreateNewObject = useCallback((essentialFields) => {
        createNewObjectMutation.mutate(essentialFields)
    }, [createNewObjectMutation])

    const getSubObjectsLabel = useCallback(() => {
        const allowedChildTypes = objectType?.allowedChildTypes || []
        if (allowedChildTypes.length === 1) return allowedChildTypes[0].label
        if (allowedChildTypes.length <= 3) return allowedChildTypes.map(t => t.label).join(', ')
        return `${allowedChildTypes.length} types`
    }, [objectType])

    const tabs = useMemo(() => {
        if (!objectType) return []
        return [
            { id: 'content', label: 'Content', icon: Layout },
            ...((objectType?.allowedChildTypes || []).length > 0 ? [{ id: 'subobjects', label: getSubObjectsLabel(), icon: Users }] : []),
            { id: 'settings', label: 'Settings', icon: Settings },
            { id: 'publishing', label: 'Publishing', icon: Calendar },
            ...(isEditingInstance ? [{ id: 'versions', label: 'Versions', icon: History }] : [])
        ]
    }, [objectType, isEditingInstance, getSubObjectsLabel])

    const commonTabProps = useMemo(() => ({
        objectType, instance,
        parentId: parentIdFromUrl || instance?.parent?.id || instance?.parent,
        isNewInstance, onUnsavedChanges: setHasUnsavedChanges,
        onSave: () => {}, onCancel: handleBack, context: { contextType: 'object' }
    }), [objectType, instance, parentIdFromUrl, isNewInstance, handleBack])

    const getTabPath = useCallback((tabId) => isNewInstance ? `/objects/new/${objectTypeId}/${tabId}` : `/objects/${instanceId}/edit/${tabId}`, [isNewInstance, objectTypeId, instanceId])

    // --- 2. LOGIC-BASED RETURNS (After all hooks) ---
    
    if (!isNewInstance && !isEditingInstance) return <Navigate to="/objects" replace />
    
    if (instanceLoading || typeLoading || pathLoading) return (
        <div className="min-h-screen bg-gray-50 flex items-center justify-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        </div>
    )

    if (!objectType) return (
        <div className="min-h-screen bg-gray-50 flex items-center justify-center">
            <div className="text-center">
                <div className="text-xl font-semibold text-gray-900 mb-2" role="heading" aria-level="2">Object Type Not Found</div>
                <div className="text-gray-600 mb-4">The specified object type could not be found.</div>
                <button onClick={handleBack} className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700">Back to Objects</button>
            </div>
        </div>
    )

    if (!tabs.find(t => t.id === tab)) {
        return <Navigate to={getTabPath('content')} replace />
    }

    // Determine Back button label
    const backButtonLabel = parentObject 
        ? `Back to ${parentObject.title}` 
        : `Back to ${objectType?.pluralLabel || (objectType?.label + 's') || 'Objects'}`

    return (
        <div className="h-screen bg-gray-50 flex flex-col">
            <div className="flex-shrink-0 bg-white border-b border-gray-200 shadow-sm">
                <div className="px-4 py-3">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-4">
                            <button onClick={handleBack} className="flex items-center px-3 py-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors" title={backButtonLabel}>
                                <ArrowLeft className="w-4 h-4 mr-2" />
                                {backButtonLabel}
                            </button>
                            <div className="h-6 w-px bg-gray-300"></div>
                            <div className="min-w-0">
                                <Breadcrumbs items={breadcrumbItems} className="mb-0.5" />
                                <div className="text-lg font-semibold text-gray-900 truncate flex items-center" role="heading" aria-level="1">
                                    {objectType?.iconImage ? <img src={objectType.iconImage} alt={objectType.label} className="w-5 h-5 object-cover rounded mr-2" /> : <Layout className="h-5 w-5 mr-2" />}
                                    {isNewInstance ? `New ${objectType?.label}` : instance?.title || 'Untitled'}
                                </div>
                                <div className="text-sm text-gray-500">{isNewInstance ? `Create a new ${objectType?.label?.toLowerCase()}` : `Edit ${objectType?.label?.toLowerCase()}`}</div>
                            </div>
                        </div>
                        <div className="flex items-center space-x-3">
                            <div className="hidden lg:flex items-center space-x-1">
                                {tabs.map((tabDef) => {
                                    const Icon = tabDef.icon
                                    const isActive = tab === tabDef.id
                                    return (
                                        <Link key={tabDef.id} to={getTabPath(tabDef.id)} className={`flex items-center px-4 py-2 rounded-lg transition-colors ${isActive ? 'bg-blue-100 text-blue-700' : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'}`}>
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
            <div className="flex-1 min-h-0 overflow-y-auto">
                {udcInitError && (
                    <div className="bg-yellow-50 border-l-4 border-yellow-400 p-4 mx-4 mt-4">
                        <div className="flex">
                            <div className="flex-shrink-0"><svg className="h-5 w-5 text-yellow-400" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" /></svg></div>
                            <div className="ml-3 flex-1">
                                <div className="text-sm text-yellow-700"><span className="font-bold">Editor initialization warning:</span> Some features may not work correctly.</div>
                                <button onClick={() => { setUdcInitError(null); queryClient.invalidateQueries(['objectInstance', instanceId]); }} className="mt-2 text-sm font-medium text-yellow-700 hover:text-yellow-600 underline">Retry initialization</button>
                            </div>
                        </div>
                    </div>
                )}
                {tab === 'content' && <ObjectContentView ref={contentTabRef} {...commonTabProps} />}
                {tab === 'settings' && <ObjectSettingsView {...commonTabProps} />}
                {tab === 'publishing' && <ObjectPublishingView {...commonTabProps} />}
                {tab === 'subobjects' && <ObjectSubObjectsView {...commonTabProps} />}
                {tab === 'versions' && <ObjectVersionsView {...commonTabProps} />}
            </div>
            <StatusBar
                isDirty={hasUnsavedChanges} currentVersion={currentVersion} availableVersions={availableVersions}
                onVersionChange={switchToVersion} onSaveClick={() => handleSave()}
                isSaving={saveMutation.isPending} isNewPage={isNewInstance}
                customStatusContent={<div className="text-sm text-gray-600">{isNewInstance ? 'Creating' : 'Editing'} {objectType?.label} - {tabs.find(t => t.label === tab)?.label}</div>}
            />
            {showEssentialFieldsModal && (
                <ObjectEssentialFieldsModal
                    objectType={objectType} onSave={handleCreateNewObject}
                    onCancel={() => { setShowEssentialFieldsModal(false); navigate('/objects') }}
                    isLoading={createNewObjectMutation.isPending}
                />
            )}
        </div>
    )
}

const ObjectEssentialFieldsModal = ({ objectType, onSave, onCancel, isLoading = false }) => {
    const [title, setTitle] = useState('')
    const handleSubmit = (e) => {
        e.preventDefault()
        if (!title.trim()) return
        onSave({ title })
    }
    return (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg shadow-xl max-w-md w-full mx-4">
                <div className="p-6">
                    <div className="text-xl font-semibold mb-4" role="heading" aria-level="2">Create New {objectType?.label || 'Object'}</div>
                    <form onSubmit={handleSubmit} className="space-y-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Title *</label>
                            <input type="text" value={title} onChange={(e) => setTitle(e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500" placeholder="Enter title" required autoFocus />
                        </div>
                        <div className="flex justify-end gap-3 mt-6">
                            <button type="button" onClick={onCancel} className="px-4 py-2 text-gray-700 border border-gray-300 rounded-md hover:bg-gray-50" disabled={isLoading}>Cancel</button>
                            <button type="submit" className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50" disabled={isLoading || !title.trim()}>{isLoading ? 'Creating...' : 'Create'}</button>
                        </div>
                    </form>
                </div>
            </div>
        </div>
    )
}

export default ObjectInstanceEditPage
