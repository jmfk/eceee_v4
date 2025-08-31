import React, { useState, useEffect } from 'react'
import { useMutation, useQueryClient, useQuery } from '@tanstack/react-query'
import { Save, Settings as SettingsIcon } from 'lucide-react'
import { objectInstancesApi } from '../../api/objectStorage'
import { useGlobalNotifications } from '../../contexts/GlobalNotificationContext'

const ObjectSettingsView = ({ objectType, instance, isNewInstance, onSave, onCancel }) => {
    const [formData, setFormData] = useState({
        parent: instance?.parent || null,
        metadata: instance?.metadata || {}
    })
    const [isDirty, setIsDirty] = useState(false)

    const queryClient = useQueryClient()
    const { addNotification } = useGlobalNotifications()

    // Fetch potential parent objects
    const { data: potentialParentsResponse } = useQuery({
        queryKey: ['objectInstances', 'potential-parents', objectType?.id],
        queryFn: () => objectInstancesApi.getByType(objectType?.name || ''),
        enabled: !!objectType
    })

    const potentialParents = potentialParentsResponse?.data || []

    useEffect(() => {
        if (instance) {
            setFormData({
                parent: instance.parent || null,
                metadata: instance.metadata || {}
            })
        }
    }, [instance])

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
                return objectInstancesApi.update(instance.id, data)
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
            const errorMessage = error.response?.data?.error || 'Failed to save settings'
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
        <div className="space-y-6">
            <div className="bg-white rounded-lg shadow-sm border p-6">
                <h2 className="text-xl font-semibold text-gray-900 mb-6 flex items-center">
                    <SettingsIcon className="h-5 w-5 mr-2" />
                    Object Settings
                </h2>

                <div className="space-y-6">
                    {/* Parent Object */}
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                            Parent Object
                        </label>
                        <select
                            value={formData.parent || ''}
                            onChange={(e) => handleInputChange('parent', e.target.value || null)}
                            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                        >
                            <option value="">No parent (root level)</option>
                            {potentialParents
                                .filter(p => p.id !== instance?.id) // Don't allow self as parent
                                .map((parent) => (
                                    <option key={parent.id} value={parent.id}>
                                        {'  '.repeat(parent.level || 0)}{parent.title}
                                    </option>
                                ))}
                        </select>
                        <p className="text-gray-500 text-sm mt-1">
                            Select a parent object to create hierarchical relationships
                        </p>
                    </div>



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

            {/* Action Buttons */}
            <div className="flex justify-end space-x-4">
                <button
                    type="button"
                    onClick={onCancel}
                    className="px-4 py-2 text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-md transition-colors"
                >
                    Cancel
                </button>
                <button
                    onClick={handleSave}
                    disabled={saveMutation.isPending || !isDirty}
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
                            Save Settings
                        </>
                    )}
                </button>
            </div>
        </div>
    )
}

export default ObjectSettingsView
