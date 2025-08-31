import React, { useState, useEffect } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Save, Calendar, Eye, EyeOff, Archive } from 'lucide-react'
import { objectInstancesApi } from '../../api/objectStorage'
import { useGlobalNotifications } from '../../contexts/GlobalNotificationContext'

const ObjectPublishingView = ({ objectType, instance, isNewInstance, onSave, onCancel }) => {
    const [formData, setFormData] = useState({
        status: instance?.status || 'draft',
        publishDate: instance?.publishDate || '',
        unpublishDate: instance?.unpublishDate || ''
    })
    const [isDirty, setIsDirty] = useState(false)

    const queryClient = useQueryClient()
    const { addNotification } = useGlobalNotifications()

    useEffect(() => {
        if (instance) {
            setFormData({
                status: instance.status || 'draft',
                publishDate: instance.publishDate || '',
                unpublishDate: instance.unpublishDate || ''
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
            addNotification('Publishing settings saved successfully', 'success')
        },
        onError: (error) => {
            console.error('Save failed:', error)
            const errorMessage = error.response?.data?.error || 'Failed to save publishing settings'
            addNotification(errorMessage, 'error')
        }
    })

    // Publish/Unpublish actions
    const publishMutation = useMutation({
        mutationFn: () => objectInstancesApi.publish(instance.id),
        onSuccess: () => {
            queryClient.invalidateQueries(['objectInstances'])
            queryClient.invalidateQueries(['objectInstance', instance?.id])
            addNotification('Object published successfully', 'success')
        },
        onError: (error) => {
            console.error('Publish failed:', error)
            const errorMessage = error.response?.data?.error || 'Failed to publish object'
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

    const handleQuickPublish = () => {
        if (isNewInstance) {
            addNotification('Please save the object first before publishing', 'warning')
            return
        }
        publishMutation.mutate()
    }

    const handleQuickUnpublish = () => {
        if (isNewInstance) {
            addNotification('Please save the object first', 'warning')
            return
        }
        saveMutation.mutate({ status: 'draft' })
    }

    const getStatusColor = (status) => {
        switch (status) {
            case 'published': return 'text-green-700 bg-green-100'
            case 'draft': return 'text-yellow-700 bg-yellow-100'
            case 'archived': return 'text-gray-700 bg-gray-100'
            default: return 'text-gray-700 bg-gray-100'
        }
    }

    const getStatusIcon = (status) => {
        switch (status) {
            case 'published': return Eye
            case 'draft': return EyeOff
            case 'archived': return Archive
            default: return EyeOff
        }
    }

    const isPublished = instance?.isPublished || false
    const StatusIcon = getStatusIcon(formData.status)

    return (
        <div className="space-y-6">
            <div className="bg-white rounded-lg shadow-sm border p-6">
                <h2 className="text-xl font-semibold text-gray-900 mb-6 flex items-center">
                    <Calendar className="h-5 w-5 mr-2" />
                    Publishing & Visibility
                </h2>

                <div className="space-y-6">
                    {/* Current Status */}
                    {!isNewInstance && (
                        <div className="bg-gray-50 rounded-lg p-4">
                            <h3 className="text-sm font-medium text-gray-900 mb-2">Current Status</h3>
                            <div className="flex items-center space-x-4">
                                <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${getStatusColor(instance?.status)}`}>
                                    <StatusIcon className="h-4 w-4 mr-1" />
                                    {instance?.status?.charAt(0).toUpperCase() + instance?.status?.slice(1)}
                                </span>
                                {isPublished && (
                                    <span className="text-green-600 text-sm font-medium">
                                        ✓ Currently visible to public
                                    </span>
                                )}
                            </div>
                        </div>
                    )}

                    {/* Status Selection */}
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                            Publication Status
                        </label>
                        <select
                            value={formData.status}
                            onChange={(e) => handleInputChange('status', e.target.value)}
                            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                        >
                            <option value="draft">Draft - Not visible to public</option>
                            <option value="published">Published - Visible to public</option>
                            <option value="archived">Archived - Hidden from listings</option>
                        </select>
                        <p className="text-gray-500 text-sm mt-1">
                            {formData.status === 'draft' && 'Object is saved but not visible to the public'}
                            {formData.status === 'published' && 'Object is live and visible to the public'}
                            {formData.status === 'archived' && 'Object is hidden from public listings but still accessible via direct link'}
                        </p>
                    </div>

                    {/* Publishing Schedule */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                                Publish Date (Optional)
                            </label>
                            <input
                                type="datetime-local"
                                value={formData.publishDate}
                                onChange={(e) => handleInputChange('publishDate', e.target.value)}
                                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                            />
                            <p className="text-gray-500 text-sm mt-1">
                                When to automatically publish this object
                            </p>
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                                Unpublish Date (Optional)
                            </label>
                            <input
                                type="datetime-local"
                                value={formData.unpublishDate}
                                onChange={(e) => handleInputChange('unpublishDate', e.target.value)}
                                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                            />
                            <p className="text-gray-500 text-sm mt-1">
                                When to automatically unpublish this object
                            </p>
                        </div>
                    </div>

                    {/* Publishing Info */}
                    {!isNewInstance && instance && (
                        <div className="border-t pt-6">
                            <h3 className="text-lg font-medium text-gray-900 mb-4">Publishing Information</h3>
                            <div className="bg-gray-50 rounded-md p-4 space-y-2">
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                                    <div>
                                        <span className="font-medium text-gray-700">Version:</span>
                                        <span className="ml-2 text-gray-600">{instance.version || 1}</span>
                                    </div>
                                    <div>
                                        <span className="font-medium text-gray-700">Created By:</span>
                                        <span className="ml-2 text-gray-600">
                                            {instance.createdBy?.username || instance.createdBy?.firstName || 'Unknown'}
                                        </span>
                                    </div>
                                    {instance.publishDate && (
                                        <div>
                                            <span className="font-medium text-gray-700">Scheduled Publish:</span>
                                            <span className="ml-2 text-gray-600">
                                                {new Date(instance.publishDate).toLocaleString()}
                                            </span>
                                        </div>
                                    )}
                                    {instance.unpublishDate && (
                                        <div>
                                            <span className="font-medium text-gray-700">Scheduled Unpublish:</span>
                                            <span className="ml-2 text-gray-600">
                                                {new Date(instance.unpublishDate).toLocaleString()}
                                            </span>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {/* Quick Actions */}
            {!isNewInstance && (
                <div className="bg-white rounded-lg shadow-sm border p-6">
                    <h3 className="text-lg font-semibold text-gray-900 mb-4">Quick Actions</h3>
                    <div className="flex space-x-4">
                        <button
                            onClick={handleQuickPublish}
                            disabled={publishMutation.isPending || instance?.status === 'published'}
                            className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center transition-colors"
                        >
                            <Eye className="h-4 w-4 mr-2" />
                            Publish Now
                        </button>
                        <button
                            onClick={handleQuickUnpublish}
                            disabled={saveMutation.isPending || instance?.status === 'draft'}
                            className="px-4 py-2 bg-yellow-600 text-white rounded-md hover:bg-yellow-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center transition-colors"
                        >
                            <EyeOff className="h-4 w-4 mr-2" />
                            Unpublish
                        </button>
                    </div>
                </div>
            )}

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
                            Save Publishing Settings
                        </>
                    )}
                </button>
            </div>
        </div>
    )
}

export default ObjectPublishingView
