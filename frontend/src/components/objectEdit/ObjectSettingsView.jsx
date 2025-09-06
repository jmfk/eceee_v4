import React, { useState, useEffect } from 'react'
import { useMutation, useQueryClient, useQuery } from '@tanstack/react-query'
import { Save, Settings as SettingsIcon } from 'lucide-react'
import { objectInstancesApi } from '../../api/objectStorage'
import { useGlobalNotifications } from '../../contexts/GlobalNotificationContext'
import ParentObjectSelector from '../ParentObjectSelector'

const ObjectSettingsView = ({ objectType, instance, isNewInstance, parentId, onSave, onCancel, onUnsavedChanges }) => {
    const [formData, setFormData] = useState({
        parent: instance?.parent?.id || parentId || null,
        metadata: instance?.metadata || {}
    })
    const [isDirty, setIsDirty] = useState(false)

    const queryClient = useQueryClient()
    const { addNotification } = useGlobalNotifications()

    // Notify parent about unsaved changes
    useEffect(() => {
        if (onUnsavedChanges) {
            onUnsavedChanges(isDirty)
        }
    }, [isDirty, onUnsavedChanges])

    // Parent object selection is now handled by ParentObjectSelector component

    useEffect(() => {
        if (instance) {
            const parentValue = instance.parent?.id || parentId || null
            setFormData({
                parent: parentValue,
                metadata: instance.metadata || {}
            })
        } else if (isNewInstance && parentId) {
            // For new instances with parent parameter, set the parent automatically
            setFormData(prev => ({
                ...prev,
                parent: parentId
            }))
        }
    }, [instance, parentId, isNewInstance])

    // Save mutation
    const saveMutation = useMutation({
        mutationFn: (data) => {
            if (isNewInstance) {
                return objectInstancesApi.create({
                    objectTypeId: objectType?.id,
                    title: instance?.title || 'New Object',
                    data: instance?.data || {},
                    ...data
                })
            } else {
                // For updates, include required fields along with the settings data
                const updateData = {
                    objectTypeId: objectType?.id,
                    title: instance?.title,
                    data: instance?.data || {},
                    status: instance?.status || 'draft',
                    ...data
                }
                return objectInstancesApi.update(instance.id, updateData)
            }
        },
        onSuccess: () => {
            queryClient.invalidateQueries(['objectInstances'])
            queryClient.invalidateQueries(['objectInstance', instance?.id])
            setIsDirty(false)
            addNotification('Settings saved successfully', 'success')
        },
        onError: (error) => {
            console.error('Save failed:', error)

            // Handle validation errors
            let errorMessage = 'Failed to save settings'
            if (error.response?.data) {
                const data = error.response.data
                if (data.parent && Array.isArray(data.parent)) {
                    errorMessage = `Parent validation error: ${data.parent[0]}`
                } else if (data.error) {
                    errorMessage = data.error
                } else if (data.message) {
                    errorMessage = data.message
                }
            }

            addNotification(errorMessage, 'error')
        }
    })

    const handleInputChange = (field, value) => {
        setFormData(prev => ({ ...prev, [field]: value }))
        setIsDirty(true)
    }

    const handleSave = () => {
        saveMutation.mutate(formData)
    }

    return (
        <div className="h-full flex flex-col relative">
            {/* Content Header */}
            <div className="flex-shrink-0 bg-white border-b border-gray-200 p-6">
                <h2 className="text-xl font-semibold text-gray-900 flex items-center">
                    <SettingsIcon className="h-5 w-5 mr-2" />
                    Object Settings
                </h2>
            </div>

            {/* Scrollable Content Area */}
            <div className="flex-1 min-h-0 overflow-y-auto bg-white">
                <div className="p-6">
                    <div className="space-y-6">

                        <div className="space-y-6">
                            {/* Parent Object */}
                            <ParentObjectSelector
                                value={formData.parent}
                                onChange={(parentId) => {
                                    handleInputChange('parent', parentId)
                                    // Auto-save when parent changes
                                    const autoSaveData = {
                                        parent: parentId,
                                        metadata: formData.metadata
                                    }
                                    saveMutation.mutate(autoSaveData)
                                }}
                                currentObjectType={objectType}
                                currentObjectId={instance?.id}
                                placeholder="Search for parent object..."
                            />



                            {/* Object Info (read-only) */}
                            {!isNewInstance && instance && (
                                <div className="border-t pt-6">
                                    <h3 className="text-lg font-medium text-gray-900 mb-4">Object Information</h3>
                                    <div className="bg-gray-50 rounded-md p-4 space-y-2">
                                        <div className="grid grid-cols-2 gap-4 text-sm">
                                            <div>
                                                <span className="font-medium text-gray-700">ID:</span>
                                                <span className="ml-2 text-gray-600">{instance.id}</span>
                                            </div>
                                            <div>
                                                <span className="font-medium text-gray-700">Slug:</span>
                                                <span className="ml-2 text-gray-600">{instance.slug}</span>
                                            </div>
                                            <div>
                                                <span className="font-medium text-gray-700">Level:</span>
                                                <span className="ml-2 text-gray-600">{instance.level || 0}</span>
                                            </div>
                                            <div>
                                                <span className="font-medium text-gray-700">Tree ID:</span>
                                                <span className="ml-2 text-gray-600">{instance.treeId || 'N/A'}</span>
                                            </div>
                                            <div>
                                                <span className="font-medium text-gray-700">Created:</span>
                                                <span className="ml-2 text-gray-600">
                                                    {new Date(instance.createdAt).toLocaleString()}
                                                </span>
                                            </div>
                                            <div>
                                                <span className="font-medium text-gray-700">Updated:</span>
                                                <span className="ml-2 text-gray-600">
                                                    {new Date(instance.updatedAt).toLocaleString()}
                                                </span>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Save buttons are now in the main footer */}
                </div>
            </div>
        </div>
    )
}

export default ObjectSettingsView
