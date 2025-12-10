import React, { useState, useEffect, useMemo, useCallback } from 'react'
import { useQuery, useQueryClient, useMutation } from '@tanstack/react-query'
import { Calendar, Clock, CheckCircle, XCircle, AlertCircle, Star } from 'lucide-react'
import { objectInstancesApi, objectVersionsApi } from '../../api/objectStorage'
import { useGlobalNotifications } from '../../contexts/GlobalNotificationContext'
import { useUnifiedData } from '../../contexts/unified-data/context/UnifiedDataContext'
import { OperationTypes } from '../../contexts/unified-data/types/operations'

const ObjectPublishingView = ({ objectType, instance, isNewInstance, onSave, onCancel, onUnsavedChanges, context }) => {
    const [versions, setVersions] = useState([])
    const [isLoading, setIsLoading] = useState(true)
    const { addNotification } = useGlobalNotifications()
    const { useExternalChanges, publishUpdate, setIsDirty: setUDCDirty } = useUnifiedData()
    const componentId = useMemo(() => `object-publishing-view-${instance?.id || 'new'}`, [instance?.id])
    const queryClient = useQueryClient()

    // Schedule modal state
    const [scheduleModalOpen, setScheduleModalOpen] = useState(false)
    const [selectedVersion, setSelectedVersion] = useState(null)
    const [effectiveDate, setEffectiveDate] = useState('')
    const [expiryDate, setExpiryDate] = useState('')
    const [isFeatured, setIsFeatured] = useState(false)

    // Load versions when component mounts
    useEffect(() => {
        loadVersions()
    }, [instance?.id])

    const loadVersions = async () => {
        if (!instance?.id || isNewInstance) {
            setIsLoading(false)
            return
        }
        setIsLoading(true)
        try {
            const response = await objectVersionsApi.getByObject(instance.id)
            setVersions(response.data || [])
        } catch (error) {
            console.error('Failed to load versions:', error)
            addNotification('Failed to load versions', 'error')
        } finally {
            setIsLoading(false)
        }
    }

    // Subscribe to external changes from UDC
    useExternalChanges(componentId, (state) => {
        if (!instance?.id) return;

        const objectData = state.objects?.[String(instance.id)];
        if (objectData) {
            // Sync any publishing-related state changes from UDC
            // This subscription ensures we stay in sync if other components update the object
        }
    });

    // Publishing mutations
    const publishMutation = useMutation({
        mutationFn: ({ versionId, isFeatured }) => objectVersionsApi.publish(versionId, { is_featured: isFeatured }),
        onSuccess: () => {
            addNotification('Version published successfully', 'success')
            loadVersions()
            // Invalidate both the single object and the list
            queryClient.invalidateQueries({ queryKey: ['objectInstance', instance?.id] })
            queryClient.invalidateQueries({ queryKey: ['objectInstances'] })

            // Notify UDC that publishing state changed
            if (instance?.id) {
                publishUpdate(componentId, OperationTypes.UPDATE_OBJECT, {
                    id: String(instance.id),
                    updates: {
                        isPublished: true,
                        metadata: { ...instance.metadata, lastPublishAction: 'published' }
                    }
                });
            }
        },
        onError: (error) => {
            console.error('Failed to publish version:', error)
            addNotification('Failed to publish version', 'error')
        }
    })

    const unpublishMutation = useMutation({
        mutationFn: (versionId) => objectVersionsApi.unpublish(versionId),
        onSuccess: () => {
            addNotification('Version unpublished successfully', 'success')
            loadVersions()
            // Don't invalidate queries to prevent switching to a different version
            // The user is likely still editing the version they just unpublished
            // queryClient.invalidateQueries({ queryKey: ['objectInstance', instance?.id] })
            // queryClient.invalidateQueries({ queryKey: ['objectInstances'] })

            // Notify UDC that publishing state changed
            if (instance?.id) {
                publishUpdate(componentId, OperationTypes.UPDATE_OBJECT, {
                    id: String(instance.id),
                    updates: {
                        isPublished: false,
                        metadata: { ...instance.metadata, lastPublishAction: 'unpublished' }
                    }
                });
            }
        },
        onError: (error) => {
            console.error('Failed to unpublish version:', error)
            addNotification('Failed to unpublish version', 'error')
        }
    })

    const scheduleMutation = useMutation({
        mutationFn: ({ versionId, effectiveDate, expiryDate, isFeatured }) =>
            objectVersionsApi.schedule(versionId, {
                effective_date: effectiveDate,
                expiry_date: expiryDate,
                is_featured: isFeatured
            }),
        onSuccess: () => {
            addNotification('Version scheduled successfully', 'success')
            setScheduleModalOpen(false)
            loadVersions()
            // Invalidate both the single object and the list
            queryClient.invalidateQueries({ queryKey: ['objectInstance', instance?.id] })
            queryClient.invalidateQueries({ queryKey: ['objectInstances'] })

            // Notify UDC that publishing state changed
            if (instance?.id) {
                publishUpdate(componentId, OperationTypes.UPDATE_OBJECT, {
                    id: String(instance.id),
                    updates: {
                        metadata: { ...instance.metadata, lastPublishAction: 'scheduled' }
                    }
                });
            }
        },
        onError: (error) => {
            console.error('Failed to schedule version:', error)
            addNotification('Failed to schedule version', 'error')
        }
    })

    const toggleFeaturedMutation = useMutation({
        mutationFn: ({ versionId, isFeatured }) =>
            objectVersionsApi.update(versionId, { is_featured: isFeatured }),
        onSuccess: (data, variables) => {
            const action = variables.isFeatured ? 'marked as featured' : 'unmarked as featured'
            addNotification(`Version ${action}`, 'success')
            loadVersions()
            // Invalidate both the single object and the list
            queryClient.invalidateQueries({ queryKey: ['objectInstance', instance?.id] })
            queryClient.invalidateQueries({ queryKey: ['objectInstances'] })
        },
        onError: (error) => {
            console.error('Failed to toggle featured status:', error)
            addNotification('Failed to update featured status', 'error')
        }
    })

    // Handler functions
    const handlePublishNow = (version) => {
        publishMutation.mutate({
            versionId: version.id,
            isFeatured: version.isFeatured || false
        })
    }

    const handleUnpublish = (version) => {
        unpublishMutation.mutate(version.id)
    }

    const handleSchedule = (version) => {
        setSelectedVersion(version)
        setEffectiveDate(version.effectiveDate || '')
        setExpiryDate(version.expiryDate || '')
        setIsFeatured(version.isFeatured || false)
        setScheduleModalOpen(true)
    }

    const handleScheduleSubmit = () => {
        if (!selectedVersion || !effectiveDate) return
        scheduleMutation.mutate({
            versionId: selectedVersion.id,
            effectiveDate,
            expiryDate: expiryDate || null,
            isFeatured
        })
    }

    const handleToggleFeatured = (version) => {
        toggleFeaturedMutation.mutate({
            versionId: version.id,
            isFeatured: !version.isFeatured
        })
    }

    const getStatusInfo = (version) => {
        const status = version.publicationStatus || 'draft'
        const isCurrentPublished = version.isCurrentPublished

        const statusConfig = {
            draft: { label: 'Draft', color: 'bg-gray-100 text-gray-800', icon: AlertCircle },
            scheduled: { label: 'Scheduled', color: 'bg-yellow-100 text-yellow-800', icon: Clock },
            published: { label: isCurrentPublished ? 'Current' : 'Published', color: isCurrentPublished ? 'bg-blue-100 text-blue-800' : 'bg-green-100 text-green-800', icon: CheckCircle },
            expired: { label: 'Expired', color: 'bg-red-100 text-red-800', icon: XCircle }
        }

        return statusConfig[status] || statusConfig.draft
    }

    if (isLoading) {
        return (
            <div className="h-full flex items-center justify-center bg-gray-50">
                <div className="text-center">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-2"></div>
                    <div className="text-gray-600">Loading versions...</div>
                </div>
            </div>
        )
    }

    if (isNewInstance) {
        return (
            <div className="h-full flex items-center justify-center bg-gray-50">
                <div className="text-center max-w-md mx-auto p-6">
                    <Calendar className="w-16 h-16 mx-auto mb-4 text-gray-400" />
                    <div className="text-lg font-medium text-gray-900 mb-2" role="heading" aria-level="3">Save Object First</div>
                    <div className="text-gray-600">
                        You need to save this object before you can manage publishing and versions.
                    </div>
                </div>
            </div>
        )
    }

    return (
        <>
            <div className="h-full p-6 overflow-y-auto">
                <div className="max-w-4xl mx-auto space-y-6">
                    {/* Header */}
                    <div className="bg-white rounded-lg shadow p-6">
                        <div className="text-lg font-semibold text-gray-900 mb-2" role="heading" aria-level="2">Version Timeline & Publishing</div>
                        <div className="text-gray-600">
                            Manage object versions, scheduling, and publishing workflow
                        </div>
                    </div>

                    {/* Version List */}
                    <div className="bg-white rounded-lg shadow">
                        <div className="p-6">
                            <div className="text-md font-semibold text-gray-900 mb-4" role="heading" aria-level="3">Object Versions</div>

                            {versions.length === 0 ? (
                                <div className="text-center py-8 text-gray-500">
                                    <Calendar className="w-12 h-12 mx-auto mb-4 text-gray-400" />
                                    <div>No versions found for this object</div>
                                </div>
                            ) : (
                                <div className="space-y-4">
                                    {versions.map((version) => {
                                        const statusInfo = getStatusInfo(version)
                                        const StatusIcon = statusInfo.icon
                                        const status = version.publicationStatus || 'draft'

                                        return (
                                            <div
                                                key={version.id}
                                                className="border rounded-lg p-4 bg-white hover:shadow-md transition-shadow"
                                            >
                                                <div className="flex items-start justify-between">
                                                    <div className="flex-1">
                                                        <div className="flex items-center space-x-2 mb-2">
                                                            <span className="font-medium text-gray-900">
                                                                Version {version.versionNumber}
                                                            </span>
                                                            <span className={`px-2 py-1 text-xs rounded-full flex items-center space-x-1 ${statusInfo.color}`}>
                                                                <StatusIcon className="w-3 h-3" />
                                                                <span>{statusInfo.label}</span>
                                                            </span>
                                                            <button
                                                                onClick={() => handleToggleFeatured(version)}
                                                                disabled={toggleFeaturedMutation.isPending}
                                                                className={`p-1 rounded transition-colors ${version.isFeatured
                                                                    ? 'text-yellow-500 hover:text-yellow-600'
                                                                    : 'text-gray-300 hover:text-yellow-400'
                                                                    }`}
                                                                title={version.isFeatured ? 'Remove featured status' : 'Mark as featured'}
                                                            >
                                                                <Star className={`w-5 h-5 ${version.isFeatured ? 'fill-current' : ''}`} />
                                                            </button>
                                                        </div>

                                                        <div className="text-sm text-gray-600 mb-2">
                                                            {version.changeDescription || 'No description'}
                                                        </div>

                                                        <div className="space-y-1 text-xs text-gray-500">
                                                            <div>Created: {new Date(version.createdAt).toLocaleString()}</div>
                                                            {version.effectiveDate && (
                                                                <div>Effective: {new Date(version.effectiveDate).toLocaleString()}</div>
                                                            )}
                                                            {version.expiryDate && (
                                                                <div>Expires: {new Date(version.expiryDate).toLocaleString()}</div>
                                                            )}
                                                        </div>
                                                    </div>

                                                    <div className="flex flex-col space-y-2 ml-4">
                                                        {status === 'draft' && (
                                                            <>
                                                                <button
                                                                    onClick={() => handlePublishNow(version)}
                                                                    className="px-3 py-1 text-sm bg-green-600 text-white hover:bg-green-700 rounded transition-colors whitespace-nowrap"
                                                                >
                                                                    Publish Now
                                                                </button>
                                                                <button
                                                                    onClick={() => handleSchedule(version)}
                                                                    className="px-3 py-1 text-sm bg-yellow-600 text-white hover:bg-yellow-700 rounded transition-colors whitespace-nowrap"
                                                                >
                                                                    Schedule
                                                                </button>
                                                            </>
                                                        )}
                                                        {status === 'scheduled' && (
                                                            <>
                                                                <button
                                                                    onClick={() => handlePublishNow(version)}
                                                                    className="px-3 py-1 text-sm bg-green-600 text-white hover:bg-green-700 rounded transition-colors whitespace-nowrap"
                                                                >
                                                                    Publish Now
                                                                </button>
                                                                <button
                                                                    onClick={() => handleSchedule(version)}
                                                                    className="px-3 py-1 text-sm bg-blue-600 text-white hover:bg-blue-700 rounded transition-colors whitespace-nowrap"
                                                                >
                                                                    Edit Schedule
                                                                </button>
                                                                <button
                                                                    onClick={() => handleUnpublish(version)}
                                                                    className="px-3 py-1 text-sm bg-gray-600 text-white hover:bg-gray-700 rounded transition-colors whitespace-nowrap"
                                                                >
                                                                    Unpublish
                                                                </button>
                                                            </>
                                                        )}
                                                        {status === 'published' && (
                                                            <>
                                                                <button
                                                                    onClick={() => handleSchedule(version)}
                                                                    className="px-3 py-1 text-sm bg-blue-600 text-white hover:bg-blue-700 rounded transition-colors whitespace-nowrap"
                                                                >
                                                                    Set Expiry
                                                                </button>
                                                                <button
                                                                    onClick={() => handleUnpublish(version)}
                                                                    className="px-3 py-1 text-sm bg-gray-600 text-white hover:bg-gray-700 rounded transition-colors whitespace-nowrap"
                                                                >
                                                                    Unpublish
                                                                </button>
                                                            </>
                                                        )}
                                                        {status === 'expired' && (
                                                            <button
                                                                onClick={() => handlePublishNow(version)}
                                                                className="px-3 py-1 text-sm bg-green-600 text-white hover:bg-green-700 rounded transition-colors whitespace-nowrap"
                                                            >
                                                                Re-publish
                                                            </button>
                                                        )}
                                                    </div>
                                                </div>
                                            </div>
                                        )
                                    })}
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </div>

            {/* Schedule Modal */}
            {scheduleModalOpen && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
                    <div className="bg-white rounded-lg shadow-xl max-w-md w-full mx-4">
                        <div className="px-6 py-4 border-b border-gray-200">
                            <div className="text-xl font-semibold text-gray-900" role="heading" aria-level="2">Schedule Version</div>
                            <div className="text-sm text-gray-500 mt-1">
                                Version {selectedVersion?.versionNumber}
                            </div>
                        </div>

                        <div className="px-6 py-4 space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                    Effective Date <span className="text-red-500">*</span>
                                </label>
                                <input
                                    type="datetime-local"
                                    value={effectiveDate ? new Date(effectiveDate).toISOString().slice(0, 16) : ''}
                                    onChange={(e) => setEffectiveDate(e.target.value ? new Date(e.target.value).toISOString() : '')}
                                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                                    required
                                />
                                <div className="mt-1 text-xs text-gray-500">
                                    When this version should become live
                                </div>
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                    Expiry Date (Optional)
                                </label>
                                <input
                                    type="datetime-local"
                                    value={expiryDate ? new Date(expiryDate).toISOString().slice(0, 16) : ''}
                                    onChange={(e) => setExpiryDate(e.target.value ? new Date(e.target.value).toISOString() : '')}
                                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                                />
                                <div className="mt-1 text-xs text-gray-500">
                                    When this version should stop being live
                                </div>
                            </div>

                            <div className="flex items-start">
                                <div className="flex items-center h-5">
                                    <input
                                        id="featured-checkbox"
                                        type="checkbox"
                                        checked={isFeatured}
                                        onChange={(e) => setIsFeatured(e.target.checked)}
                                        className="h-4 w-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                                    />
                                </div>
                                <div className="ml-3 text-sm">
                                    <label htmlFor="featured-checkbox" className="font-medium text-gray-700 flex items-center">
                                        <Star className="w-4 h-4 mr-1 text-yellow-500" />
                                        Mark as Featured
                                    </label>
                                    <div className="text-gray-500">Featured items appear first in listings</div>
                                </div>
                            </div>
                        </div>

                        <div className="px-6 py-4 border-t border-gray-200 flex justify-end space-x-3">
                            <button
                                type="button"
                                onClick={() => setScheduleModalOpen(false)}
                                className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500"
                            >
                                Cancel
                            </button>
                            <button
                                type="button"
                                onClick={handleScheduleSubmit}
                                disabled={!effectiveDate || scheduleMutation.isPending}
                                className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                {scheduleMutation.isPending ? 'Saving...' : 'Save Schedule'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </>
    )
}

// Add display name for debugging
ObjectPublishingView.displayName = 'ObjectPublishingView';

export default ObjectPublishingView
