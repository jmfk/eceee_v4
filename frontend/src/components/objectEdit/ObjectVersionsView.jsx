import React, { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { History, Clock, User, FileText, Eye, RotateCcw } from 'lucide-react'
import { objectInstancesApi } from '../../api/objectStorage'
import { useGlobalNotifications } from '../../contexts/GlobalNotificationContext'
import Modal from '../Modal'

const ObjectVersionsView = ({ objectType, instance, isNewInstance, onSave, onCancel }) => {
    const [selectedVersion, setSelectedVersion] = useState(null)
    const [showVersionDetails, setShowVersionDetails] = useState(false)

    const { addNotification } = useGlobalNotifications()

    // Fetch version history
    const { data: versionsResponse, isLoading: versionsLoading } = useQuery({
        queryKey: ['objectInstance', instance?.id, 'versions'],
        queryFn: () => objectInstancesApi.getVersions(instance.id),
        enabled: !!instance?.id
    })

    const versions = versionsResponse?.data || []

    const handleViewVersion = (version) => {
        setSelectedVersion(version)
        setShowVersionDetails(true)
    }

    const handleRestoreVersion = (version) => {
        // This would require implementing a restore endpoint
        addNotification('Version restore functionality will be implemented in a future update', 'info')
    }

    const formatDate = (dateString) => {
        return new Date(dateString).toLocaleString()
    }

    const getChangesSummary = (version) => {
        // This would analyze the changes between versions
        // For now, return a simple summary
        return version.changeDescription || 'No description provided'
    }

    if (isNewInstance) {
        return (
            <div className="h-full flex relative">
                <div className="flex-1 min-w-0">
                    <div className="space-y-6">
                        <div className="bg-white p-6">
                            <h2 className="text-xl font-semibold text-gray-900 mb-6 flex items-center">
                                <History className="h-5 w-5 mr-2" />
                                Version History
                            </h2>

                            <div className="text-center py-12 bg-gray-50 rounded-lg">
                                <History className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                                <h3 className="text-lg font-medium text-gray-900 mb-2">No Version History Yet</h3>
                                <p className="text-gray-600 mb-4">
                                    Version history will be available after saving this {objectType?.label?.toLowerCase()}.
                                </p>
                                <button
                                    onClick={onSave}
                                    className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 transition-colors"
                                >
                                    Save to Start Version Tracking
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        )
    }

    return (
        <div className="h-full flex relative">
            <div className="flex-1 min-w-0">
                <div className="space-y-6">
                    <div className="bg-white p-6">
                        <h2 className="text-xl font-semibold text-gray-900 mb-6 flex items-center">
                            <History className="h-5 w-5 mr-2" />
                            Version History
                        </h2>

                        <div className="space-y-6">
                            {/* Version Control Info */}
                            <div className="bg-blue-50 border border-blue-200 rounded-md p-4">
                                <h3 className="text-sm font-medium text-blue-900 mb-2">About Version Control</h3>
                                <p className="text-blue-800 text-sm">
                                    All changes to this object are automatically tracked. You can view the complete
                                    version history, compare changes between versions, and restore previous versions if needed.
                                </p>
                            </div>

                            {/* Current Version Info */}
                            <div className="bg-gray-50 rounded-md p-4">
                                <h3 className="text-sm font-medium text-gray-900 mb-2">Current Version</h3>
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                                    <div>
                                        <span className="font-medium text-gray-700">Version:</span>
                                        <span className="ml-2 text-gray-600">{instance?.version || 1}</span>
                                    </div>
                                    <div>
                                        <span className="font-medium text-gray-700">Last Modified:</span>
                                        <span className="ml-2 text-gray-600">
                                            {instance?.updatedAt ? formatDate(instance.updatedAt) : 'Not saved yet'}
                                        </span>
                                    </div>
                                    <div>
                                        <span className="font-medium text-gray-700">Created By:</span>
                                        <span className="ml-2 text-gray-600">{instance?.createdBy?.username || instance?.createdBy || 'Current user'}</span>
                                    </div>
                                </div>
                            </div>

                            {/* Version List */}
                            <div>
                                <h3 className="text-lg font-medium text-gray-900 mb-4">
                                    Version History ({versions.length} versions)
                                </h3>

                                {versionsLoading ? (
                                    <div className="flex justify-center py-8">
                                        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                                    </div>
                                ) : versions.length > 0 ? (
                                    <div className="space-y-3">
                                        {versions.map((version, index) => (
                                            <div
                                                key={version.id}
                                                className="border border-gray-200 rounded-lg p-4 hover:bg-gray-50 transition-colors"
                                            >
                                                <div className="flex items-center justify-between">
                                                    <div className="flex items-center space-x-4">
                                                        <div className="flex items-center space-x-2">
                                                            <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                                                                v{version.versionNumber}
                                                            </span>
                                                            {index === 0 && (
                                                                <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">
                                                                    Current
                                                                </span>
                                                            )}
                                                        </div>
                                                        <div className="flex items-center text-sm text-gray-600">
                                                            <Clock className="h-4 w-4 mr-1" />
                                                            {formatDate(version.createdAt)}
                                                        </div>
                                                        <div className="flex items-center text-sm text-gray-600">
                                                            <User className="h-4 w-4 mr-1" />
                                                            {version.createdByName || 'Unknown'}
                                                        </div>
                                                    </div>

                                                    <div className="flex items-center space-x-2">
                                                        <button
                                                            onClick={() => handleViewVersion(version)}
                                                            className="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-md transition-colors"
                                                            title="View version details"
                                                        >
                                                            <Eye className="h-4 w-4" />
                                                        </button>
                                                        {index > 0 && (
                                                            <button
                                                                onClick={() => handleRestoreVersion(version)}
                                                                className="p-2 text-gray-400 hover:text-green-600 hover:bg-green-50 rounded-md transition-colors"
                                                                title="Restore this version"
                                                            >
                                                                <RotateCcw className="h-4 w-4" />
                                                            </button>
                                                        )}
                                                    </div>
                                                </div>

                                                <div className="mt-2">
                                                    <p className="text-sm text-gray-700">
                                                        {getChangesSummary(version)}
                                                    </p>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                ) : (
                                    <div className="text-center py-8 bg-gray-50 rounded-lg">
                                        <History className="h-8 w-8 text-gray-400 mx-auto mb-2" />
                                        <p className="text-gray-600">
                                            No version history available yet.
                                        </p>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* Version Details Modal */}
                    {showVersionDetails && selectedVersion && (
                        <Modal
                            title={`Version ${selectedVersion.versionNumber} Details`}
                            onClose={() => setShowVersionDetails(false)}
                            size="large"
                        >
                            <div className="space-y-6">
                                {/* Version Metadata */}
                                <div className="bg-gray-50 rounded-lg p-4">
                                    <h3 className="font-medium text-gray-900 mb-3">Version Information</h3>
                                    <div className="grid grid-cols-2 gap-4 text-sm">
                                        <div>
                                            <span className="font-medium text-gray-700">Version:</span>
                                            <span className="ml-2 text-gray-600">{selectedVersion.versionNumber}</span>
                                        </div>
                                        <div>
                                            <span className="font-medium text-gray-700">Created:</span>
                                            <span className="ml-2 text-gray-600">{formatDate(selectedVersion.createdAt)}</span>
                                        </div>
                                        <div>
                                            <span className="font-medium text-gray-700">Created By:</span>
                                            <span className="ml-2 text-gray-600">{selectedVersion.createdByName || 'Unknown'}</span>
                                        </div>
                                        <div>
                                            <span className="font-medium text-gray-700">Change Description:</span>
                                            <span className="ml-2 text-gray-600">
                                                {selectedVersion.changeDescription || 'No description provided'}
                                            </span>
                                        </div>
                                    </div>
                                </div>

                                {/* Version Data Preview */}
                                <div>
                                    <h3 className="font-medium text-gray-900 mb-3">Data Snapshot</h3>
                                    <div className="bg-gray-50 rounded-lg p-4">
                                        <pre className="text-sm text-gray-700 overflow-auto max-h-64">
                                            {JSON.stringify(selectedVersion.data, null, 2)}
                                        </pre>
                                    </div>
                                </div>

                                {/* Version Widgets Preview */}
                                {selectedVersion.widgets && Object.keys(selectedVersion.widgets).length > 0 && (
                                    <div>
                                        <h3 className="font-medium text-gray-900 mb-3">Widget Configuration</h3>
                                        <div className="bg-gray-50 rounded-lg p-4">
                                            <pre className="text-sm text-gray-700 overflow-auto max-h-64">
                                                {JSON.stringify(selectedVersion.widgets, null, 2)}
                                            </pre>
                                        </div>
                                    </div>
                                )}
                            </div>
                        </Modal>
                    )}

                </div>
            </div>
        </div>
    )
}

export default ObjectVersionsView
