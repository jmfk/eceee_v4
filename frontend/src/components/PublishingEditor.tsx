
import React, { useEffect, useState } from 'react'
import { Calendar } from 'lucide-react'
import { useGlobalNotifications } from '../contexts/GlobalNotificationContext'
import { versionsApi } from '../api/versions'

// Publishing Editor Tab - Version Timeline & Publishing Management
type PageVersionSummary = {
    id: number
    versionNumber: number
    changeSummary?: string
    createdAt: string
}

const PublishingEditor = ({ webpageData, pageVersionData, pageId, currentVersion, onVersionChange }) => {
    const [versions, setVersions] = useState<PageVersionSummary[]>([])
    const [isLoading, setIsLoading] = useState(true)
    const { addNotification } = useGlobalNotifications()

    // Load versions when component mounts
    useEffect(() => {
        loadVersions()
    }, [pageId])

    const loadVersions = async () => {
        if (!pageId) return
        setIsLoading(true)
        try {
            const response = await versionsApi.getPageVersionsList(pageId)
            setVersions(response.versions || [])
        } catch (error) {
            console.error('Failed to load versions:', error)
            addNotification('Failed to load versions', 'error')
        } finally {
            setIsLoading(false)
        }
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
                                        const isCurrentVersion = currentVersion?.id === version.id

                                        return (
                                            <div
                                                key={version.id}
                                                className={`border rounded-lg p-4 ${isCurrentVersion ? 'border-blue-300 bg-blue-50' : 'border-gray-200'}`}
                                            >
                                                <div className="flex items-center justify-between">
                                                    <div className="flex items-center space-x-4">
                                                        <div>
                                                            <div className="flex items-center space-x-2">
                                                                <span className="font-medium text-gray-900">
                                                                    Version {version.versionNumber}
                                                                </span>
                                                                {isCurrentVersion && (
                                                                    <span className="px-2 py-1 text-xs rounded-full bg-indigo-100 text-indigo-800">
                                                                        Current
                                                                    </span>
                                                                )}
                                                            </div>
                                                            <p className="text-sm text-gray-600 mt-1">
                                                                {version.changeSummary || 'No description'}
                                                            </p>
                                                            <p className="text-xs text-gray-500 mt-1">
                                                                Created {new Date(version.createdAt).toLocaleDateString()}
                                                            </p>
                                                        </div>
                                                    </div>

                                                    <div className="flex items-center space-x-2">
                                                        {!isCurrentVersion && (
                                                            <button
                                                                onClick={() => onVersionChange(version)}
                                                                className="px-3 py-1 text-sm text-blue-600 hover:text-blue-800 hover:bg-blue-50 rounded transition-colors"
                                                            >
                                                                Switch to
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
        </>
    )
}

// Add display name for debugging
PublishingEditor.displayName = 'PublishingEditor';

export default PublishingEditor

