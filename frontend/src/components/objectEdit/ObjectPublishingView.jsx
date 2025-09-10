import React, { useState, useEffect } from 'react'
import { useMutation, useQueryClient, useQuery } from '@tanstack/react-query'
import { Save, Calendar, Eye, EyeOff, Archive, Clock, CheckCircle } from 'lucide-react'
import { objectInstancesApi, objectVersionsApi } from '../../api/objectStorage'
import { useGlobalNotifications } from '../../contexts/GlobalNotificationContext'

const ObjectPublishingView = ({ objectType, instance, isNewInstance, onSave, onCancel, onUnsavedChanges }) => {
    const [formData, setFormData] = useState({
        effectiveDate: '',
        expiryDate: ''
    })
    const [isDirty, setIsDirty] = useState(false)

    const queryClient = useQueryClient()
    const { addNotification } = useGlobalNotifications()

    // Fetch current published version for the object
    const { data: currentPublishedVersion, isLoading: currentVersionLoading } = useQuery({
        queryKey: ['objectInstance', instance?.id, 'currentPublishedVersion'],
        queryFn: () => objectInstancesApi.getCurrentPublishedVersion(instance.id),
        enabled: Boolean(instance?.id && !isNewInstance),
        retry: false
    })

    // Fetch all versions for this object
    const { data: versionsResponse, isLoading: versionsLoading } = useQuery({
        queryKey: ['objectVersions', instance?.id],
        queryFn: () => objectVersionsApi.getByObject(instance.id),
        enabled: Boolean(instance?.id && !isNewInstance)
    })

    const versions = versionsResponse?.data || []

    // Notify parent about unsaved changes
    useEffect(() => {
        if (onUnsavedChanges) {
            onUnsavedChanges(isDirty)
        }
    }, [isDirty, onUnsavedChanges])

    useEffect(() => {
        if (currentPublishedVersion?.data) {
            const version = currentPublishedVersion.data
            setFormData({
                effectiveDate: version.effectiveDate ? new Date(version.effectiveDate).toISOString().slice(0, 16) : '',
                expiryDate: version.expiryDate ? new Date(version.expiryDate).toISOString().slice(0, 16) : ''
            })
        }
    }, [currentPublishedVersion])

    // Schedule version publication
    const scheduleMutation = useMutation({
        mutationFn: (data) => {
            const latestVersion = versions[0] // Versions are ordered by version_number desc
            if (!latestVersion) {
                throw new Error('No version found to schedule')
            }
            return objectVersionsApi.schedule(latestVersion.id, {
                effectiveDate: data.effectiveDate,
                expiryDate: data.expiryDate || null
            })
        },
        onSuccess: () => {
            queryClient.invalidateQueries(['objectInstances'])
            queryClient.invalidateQueries(['objectInstance', instance?.id])
            queryClient.invalidateQueries(['objectVersions', instance?.id])
            queryClient.invalidateQueries(['objectInstance', instance?.id, 'currentPublishedVersion'])
            setIsDirty(false)
            addNotification('Publication scheduled successfully', 'success')
        },
        onError: (error) => {
            console.error('Schedule failed:', error)
            const errorMessage = error.response?.data?.error || 'Failed to schedule publication'
            addNotification(errorMessage, 'error')
        }
    })

    // Publish immediately
    const publishMutation = useMutation({
        mutationFn: () => {
            const latestVersion = versions[0] // Versions are ordered by version_number desc
            if (!latestVersion) {
                throw new Error('No version found to publish')
            }
            return objectVersionsApi.publish(latestVersion.id)
        },
        onSuccess: () => {
            queryClient.invalidateQueries(['objectInstances'])
            queryClient.invalidateQueries(['objectInstance', instance?.id])
            queryClient.invalidateQueries(['objectVersions', instance?.id])
            queryClient.invalidateQueries(['objectInstance', instance?.id, 'currentPublishedVersion'])
            addNotification('Version published successfully', 'success')
        },
        onError: (error) => {
            console.error('Publish failed:', error)
            const errorMessage = error.response?.data?.error || 'Failed to publish version'
            addNotification(errorMessage, 'error')
        }
    })

    // Unpublish current version
    const unpublishMutation = useMutation({
        mutationFn: () => {
            if (!currentPublishedVersion?.data) {
                throw new Error('No published version to unpublish')
            }
            return objectVersionsApi.unpublish(currentPublishedVersion.data.id)
        },
        onSuccess: () => {
            queryClient.invalidateQueries(['objectInstances'])
            queryClient.invalidateQueries(['objectInstance', instance?.id])
            queryClient.invalidateQueries(['objectVersions', instance?.id])
            queryClient.invalidateQueries(['objectInstance', instance?.id, 'currentPublishedVersion'])
            addNotification('Version unpublished successfully', 'success')
        },
        onError: (error) => {
            console.error('Unpublish failed:', error)
            const errorMessage = error.response?.data?.error || 'Failed to unpublish version'
            addNotification(errorMessage, 'error')
        }
    })

    const handleInputChange = (field, value) => {
        setFormData(prev => ({ ...prev, [field]: value }))
        setIsDirty(true)
    }

    const handleSchedule = () => {
        if (isNewInstance) {
            addNotification('Please save the object first before scheduling', 'warning')
            return
        }
        if (!formData.effectiveDate) {
            addNotification('Please set an effective date', 'warning')
            return
        }
        scheduleMutation.mutate(formData)
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
        unpublishMutation.mutate()
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

    return (
        <div className="h-full flex flex-col relative">
            {/* Content Header */}
            <div className="flex-shrink-0 bg-white border-b border-gray-200 shadow-sm px-4 py-3">
                <h1 className="text-lg font-semibold text-gray-900 flex items-center">
                    <Calendar className="h-5 w-5 mr-2" />
                    Publishing & Visibility
                </h1>
            </div>

            {/* Scrollable Content Area */}
            <div className="flex-1 min-h-0 overflow-y-auto bg-white">
                <div className="p-6">
                    <div className="space-y-6">

                        <div className="space-y-6">
                            {/* Current Status */}
                            {!isNewInstance && (
                                <div className="bg-gray-50 rounded-lg p-4">
                                    <h3 className="text-sm font-medium text-gray-900 mb-2">Current Status</h3>
                                    <div className="flex items-center space-x-4">
                                        <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${isPublished ? 'text-green-700 bg-green-100' : 'text-gray-700 bg-gray-100'}`}>
                                            {isPublished ? (
                                                <Eye className="h-4 w-4 mr-1" />
                                            ) : (
                                                <EyeOff className="h-4 w-4 mr-1" />
                                            )}
                                            {isPublished ? 'Published' : 'Not Published'}
                                        </span>
                                        {isPublished && (
                                            <span className="text-green-600 text-sm font-medium">
                                                ✓ Currently visible to public
                                            </span>
                                        )}
                                    </div>
                                </div>
                            )}

                            {/* Current Published Version Info */}
                            {!isNewInstance && currentPublishedVersion && (
                                <div className="bg-blue-50 rounded-lg p-4">
                                    <h3 className="text-sm font-medium text-blue-900 mb-2">Currently Published Version</h3>
                                    <div className="space-y-1 text-sm text-blue-800">
                                        <div>Version {currentPublishedVersion.data.versionNumber}</div>
                                        <div>Effective: {currentPublishedVersion.data.effectiveDate ? new Date(currentPublishedVersion.data.effectiveDate).toLocaleString() : 'Immediately'}</div>
                                        <div>Expires: {currentPublishedVersion.data.expiryDate ? new Date(currentPublishedVersion.data.expiryDate).toLocaleString() : 'Never'}</div>
                                    </div>
                                </div>
                            )}

                            {/* Version Publishing Schedule */}
                            <div className="space-y-4">
                                <h3 className="text-lg font-medium text-gray-900">Schedule Latest Version</h3>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-2">
                                            Effective Date <span className="text-red-500">*</span>
                                        </label>
                                        <input
                                            type="datetime-local"
                                            value={formData.effectiveDate}
                                            onChange={(e) => handleInputChange('effectiveDate', e.target.value)}
                                            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                                        />
                                        <p className="text-gray-500 text-sm mt-1">
                                            When this version becomes active/published
                                        </p>
                                    </div>

                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-2">
                                            Expiry Date (Optional)
                                        </label>
                                        <input
                                            type="datetime-local"
                                            value={formData.expiryDate}
                                            onChange={(e) => handleInputChange('expiryDate', e.target.value)}
                                            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                                        />
                                        <p className="text-gray-500 text-sm mt-1">
                                            When this version expires (leave blank for no expiry)
                                        </p>
                                    </div>
                                </div>

                                <div className="flex justify-end">
                                    <button
                                        onClick={handleSchedule}
                                        disabled={scheduleMutation.isPending || !formData.effectiveDate || isNewInstance}
                                        className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center transition-colors"
                                    >
                                        <Clock className="h-4 w-4 mr-2" />
                                        {scheduleMutation.isPending ? 'Scheduling...' : 'Schedule Version'}
                                    </button>
                                </div>
                            </div>

                            {/* Version Information */}
                            {!isNewInstance && versions.length > 0 && (
                                <div className="border-t pt-6">
                                    <h3 className="text-lg font-medium text-gray-900 mb-4">Version History</h3>
                                    <div className="bg-gray-50 rounded-md p-4">
                                        <div className="space-y-3">
                                            {versions.slice(0, 3).map((version) => (
                                                <div key={version.id} className="flex justify-between items-center text-sm">
                                                    <div>
                                                        <span className="font-medium text-gray-700">Version {version.versionNumber}</span>
                                                        {version.changeDescription && (
                                                            <span className="ml-2 text-gray-600">- {version.changeDescription}</span>
                                                        )}
                                                    </div>
                                                    <div className="text-right">
                                                        <div className="text-gray-600">
                                                            {new Date(version.createdAt).toLocaleDateString()}
                                                        </div>
                                                        {version.effectiveDate && (
                                                            <div className="text-xs text-blue-600">
                                                                Effective: {new Date(version.effectiveDate).toLocaleDateString()}
                                                            </div>
                                                        )}
                                                    </div>
                                                </div>
                                            ))}
                                            {versions.length > 3 && (
                                                <div className="text-sm text-gray-500 text-center pt-2">
                                                    ... and {versions.length - 3} more versions
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
                                    disabled={publishMutation.isPending || isPublished}
                                    className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center transition-colors"
                                >
                                    <Eye className="h-4 w-4 mr-2" />
                                    {publishMutation.isPending ? 'Publishing...' : 'Publish Now'}
                                </button>
                                <button
                                    onClick={handleQuickUnpublish}
                                    disabled={unpublishMutation.isPending || !isPublished}
                                    className="px-4 py-2 bg-yellow-600 text-white rounded-md hover:bg-yellow-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center transition-colors"
                                >
                                    <EyeOff className="h-4 w-4 mr-2" />
                                    {unpublishMutation.isPending ? 'Unpublishing...' : 'Unpublish'}
                                </button>
                            </div>
                        </div>
                    )}

                    {/* Save buttons are now in the main footer */}
                </div>
            </div>
        </div>
    )
}

export default ObjectPublishingView
