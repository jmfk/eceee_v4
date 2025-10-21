
import React, { useEffect, useState } from 'react'
import { Calendar, Clock, CheckCircle, XCircle, AlertCircle } from 'lucide-react'
import { useGlobalNotifications } from '../contexts/GlobalNotificationContext'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { versionsApi } from '../api/versions'

// Publishing Editor Tab - Version Timeline & Publishing Management
type PageVersionSummary = {
    id: number
    versionNumber: number
    changeSummary?: string | { summaryText?: string;[key: string]: any }
    createdAt: string
    effectiveDate?: string | null
    expiryDate?: string | null
    isPublished?: boolean
    publicationStatus?: 'draft' | 'scheduled' | 'published' | 'expired'
}

const PublishingEditor = ({ webpageData, pageVersionData, pageId, currentVersion, onVersionChange }) => {
    const [versions, setVersions] = useState<PageVersionSummary[]>([])
    const [isLoading, setIsLoading] = useState(true)
    const { addNotification } = useGlobalNotifications()
    const queryClient = useQueryClient()

    // Schedule modal state
    const [scheduleModalOpen, setScheduleModalOpen] = useState(false)
    const [selectedVersion, setSelectedVersion] = useState<PageVersionSummary | null>(null)
    const [effectiveDate, setEffectiveDate] = useState('')
    const [expiryDate, setExpiryDate] = useState('')

    // Load versions when component mounts
    useEffect(() => {
        loadVersions()
    }, [pageId])

    const loadVersions = async () => {
        if (!pageId) return
        setIsLoading(true)
        try {
            const response = await versionsApi.getPageVersionsList(pageId)
            setVersions(response.results || [])
        } catch (error) {
            console.error('Failed to load versions:', error)
            addNotification('Failed to load versions', 'error')
        } finally {
            setIsLoading(false)
        }
    }

    // Publishing mutations
    const publishMutation = useMutation({
        mutationFn: (versionId: number) => versionsApi.publishVersionNow(versionId),
        onSuccess: () => {
            addNotification('Version published successfully', 'success')
            loadVersions()
            // Invalidate to update the current version if needed
            queryClient.invalidateQueries({ queryKey: ['pageVersion', pageId] })
        },
        onError: (error) => {
            console.error('Failed to publish version:', error)
            addNotification('Failed to publish version', 'error')
        }
    })

    const unpublishMutation = useMutation({
        mutationFn: (versionId: number) => versionsApi.unpublishVersion(versionId),
        onSuccess: () => {
            addNotification('Version unpublished successfully', 'success')
            loadVersions()
            // Don't invalidate the pageVersion query to prevent switching to a different version
            // The user is likely still editing the version they just unpublished
            // queryClient.invalidateQueries({ queryKey: ['pageVersion', pageId] })
        },
        onError: (error) => {
            console.error('Failed to unpublish version:', error)
            addNotification('Failed to unpublish version', 'error')
        }
    })

    const scheduleMutation = useMutation({
        mutationFn: ({ versionId, effectiveDate, expiryDate }: { versionId: number, effectiveDate: string, expiryDate?: string | null }) =>
            versionsApi.scheduleVersion(versionId, effectiveDate, expiryDate),
        onSuccess: () => {
            addNotification('Version scheduled successfully', 'success')
            setScheduleModalOpen(false)
            loadVersions()
            // Invalidate to update the current version if the schedule makes this version current
            queryClient.invalidateQueries({ queryKey: ['pageVersion', pageId] })
        },
        onError: (error) => {
            console.error('Failed to schedule version:', error)
            addNotification('Failed to schedule version', 'error')
        }
    })

    // Handler functions
    const handlePublishNow = (version: PageVersionSummary) => {
        publishMutation.mutate(version.id)
    }

    const handleUnpublish = (version: PageVersionSummary) => {
        unpublishMutation.mutate(version.id)
    }

    const handleSchedule = (version: PageVersionSummary) => {
        setSelectedVersion(version)
        setEffectiveDate(version.effectiveDate || '')
        setExpiryDate(version.expiryDate || '')
        setScheduleModalOpen(true)
    }

    const handleScheduleSubmit = () => {
        if (!selectedVersion || !effectiveDate) return
        scheduleMutation.mutate({
            versionId: selectedVersion.id,
            effectiveDate,
            expiryDate: expiryDate || null
        })
    }

    const getStatusInfo = (version: PageVersionSummary) => {
        const status = version.publicationStatus || 'draft'
        const isCurrentPublished = currentVersion?.id === version.id && status === 'published'

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
                    <p className="text-gray-600">Loading versions...</p>
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
                        <h2 className="text-lg font-semibold text-gray-900 mb-2">Version Timeline & Publishing</h2>
                        <p className="text-gray-600">
                            Manage page versions, scheduling, and publishing workflow
                        </p>
                    </div>

                    {/* Version List */}
                    <div className="bg-white rounded-lg shadow">
                        <div className="p-6">
                            <h3 className="text-md font-semibold text-gray-900 mb-4">Page Versions</h3>

                            {versions.length === 0 ? (
                                <div className="text-center py-8 text-gray-500">
                                    <Calendar className="w-12 h-12 mx-auto mb-4 text-gray-400" />
                                    <p>No versions found for this page</p>
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
                                                        </div>

                                                        <p className="text-sm text-gray-600 mb-2">
                                                            {typeof version.changeSummary === 'string'
                                                                ? version.changeSummary
                                                                : version.changeSummary?.summaryText || 'No description'}
                                                        </p>

                                                        <div className="space-y-1 text-xs text-gray-500">
                                                            <p>Created: {new Date(version.createdAt).toLocaleString()}</p>
                                                            {version.effectiveDate && (
                                                                <p>Effective: {new Date(version.effectiveDate).toLocaleString()}</p>
                                                            )}
                                                            {version.expiryDate && (
                                                                <p>Expires: {new Date(version.expiryDate).toLocaleString()}</p>
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
                                                        <button
                                                            onClick={() => onVersionChange(version.id)}
                                                            className="px-3 py-1 text-sm text-blue-600 hover:text-blue-800 hover:bg-blue-50 rounded transition-colors whitespace-nowrap"
                                                        >
                                                            Switch to
                                                        </button>
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
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
                    <div className="bg-white rounded-lg shadow-xl max-w-md w-full mx-4">
                        <div className="px-6 py-4 border-b border-gray-200">
                            <h2 className="text-xl font-semibold text-gray-900">Schedule Version</h2>
                            <p className="text-sm text-gray-500 mt-1">
                                Version {selectedVersion?.versionNumber}
                            </p>
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
                                <p className="mt-1 text-xs text-gray-500">
                                    When this version should become live
                                </p>
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
                                <p className="mt-1 text-xs text-gray-500">
                                    When this version should stop being live
                                </p>
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
PublishingEditor.displayName = 'PublishingEditor';

export default PublishingEditor

