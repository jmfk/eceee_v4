import { useState, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
    History,
    Plus,
    Edit3,
    Trash2,
    Eye,
    GitBranch,
    Upload,
    Download,
    Clock,
    CheckCircle,
    AlertCircle,
    Users,
    Calendar,
    FileText,
    Settings,
    ArrowLeft,
    ArrowRight
} from 'lucide-react'
import { useNotificationContext } from './NotificationManager'
import { useGlobalNotifications } from '../contexts/GlobalNotificationContext'
import {
    getVersion,
    createVersion,
    updateVersion,
    deleteVersion,
    publishVersion,
    createDraftFromPublished,
    restoreVersion,
    compareVersions,
    getVersionStats,
    getPageVersionsList,
    canEditVersion,
    canPublishVersion,
    canDeleteVersion,
    canCreateDraft,
    formatVersionForDisplay
} from '../api/versions'

const VersionManager = ({ pageId, onClose }) => {
    const [activeTab, setActiveTab] = useState('list')
    const [selectedVersion, setSelectedVersion] = useState(null)
    const [compareVersions, setCompareVersions] = useState({ version1: null, version2: null })
    const [editingVersion, setEditingVersion] = useState(null)
    const [showCreateForm, setShowCreateForm] = useState(false)
    const queryClient = useQueryClient()
    const { showConfirm, showPrompt } = useNotificationContext()
    const { addNotification } = useGlobalNotifications()

    // Fetch page versions
    const { data: versionsData, isLoading: versionsLoading } = useQuery({
        queryKey: ['page-versions', pageId],
        queryFn: () => getPageVersionsList(pageId),
        enabled: !!pageId
    })

    // Fetch version statistics
    const { data: versionStats } = useQuery({
        queryKey: ['version-stats', pageId],
        queryFn: () => getVersionStats(pageId),
        enabled: !!pageId
    })

    // Fetch comparison data
    const { data: comparisonData, isLoading: comparisonLoading } = useQuery({
        queryKey: ['version-comparison', compareVersions.version1?.id, compareVersions.version2?.id],
        queryFn: () => compareVersions(compareVersions.version1.id, compareVersions.version2.id),
        enabled: !!(compareVersions.version1 && compareVersions.version2)
    })

    // Mutations
    const publishMutation = useMutation({
        mutationFn: publishVersion,
        onSuccess: () => {
            addNotification('Version published successfully!', 'success', 'version-publish')
            queryClient.invalidateQueries(['page-versions', pageId])
            queryClient.invalidateQueries(['version-stats', pageId])
        },
        onError: (error) => {
            addNotification('Failed to publish version', 'error', 'version-publish')
        }
    })

    const deleteMutation = useMutation({
        mutationFn: deleteVersion,
        onSuccess: () => {
            addNotification('Version deleted successfully!', 'success', 'version-delete')
            queryClient.invalidateQueries(['page-versions', pageId])
            queryClient.invalidateQueries(['version-stats', pageId])
        },
        onError: (error) => {
            addNotification('Failed to delete version', 'error', 'version-delete')
        }
    })

    const createDraftMutation = useMutation({
        mutationFn: ({ versionId, description }) => createDraftFromPublished(versionId, description),
        onSuccess: () => {
            addNotification('Draft created successfully!', 'success', 'version-draft')
            queryClient.invalidateQueries(['page-versions', pageId])
            queryClient.invalidateQueries(['version-stats', pageId])
        },
        onError: (error) => {
            addNotification('Failed to create draft', 'error', 'version-draft')
        }
    })

    const restoreMutation = useMutation({
        mutationFn: restoreVersion,
        onSuccess: () => {
            addNotification('Version restored successfully!', 'success', 'version-restore')
            queryClient.invalidateQueries(['page-versions', pageId])
            queryClient.invalidateQueries(['version-stats', pageId])
        },
        onError: (error) => {
            addNotification('Failed to restore version', 'error', 'version-restore')
        }
    })

    const versions = versionsData?.results || []
    const formattedVersions = versions.map(formatVersionForDisplay)

    const handlePublish = async (version) => {
        const confirmed = await showConfirm({
            title: 'Publish Version',
            message: `Are you sure you want to publish version ${version.versionNumber}?`,
            confirmText: 'Publish',
            confirmButtonStyle: 'primary'
        })

        if (confirmed) {
            publishMutation.mutate(version.id)
        }
    }

    const handleDelete = async (version) => {
        const confirmed = await showConfirm({
            title: 'Delete Version',
            message: `Are you sure you want to delete version ${version.versionNumber}?`,
            confirmText: 'Delete',
            confirmButtonStyle: 'danger'
        })

        if (confirmed) {
            deleteMutation.mutate(version.id)
        }
    }

    const handleCreateDraft = async (version) => {
        const description = await showPrompt({
            title: 'Create Draft',
            message: 'Enter description for the new draft:',
            placeholder: 'Draft description...',
            submitText: 'Create Draft'
        })

        if (description !== null) {
            createDraftMutation.mutate({ versionId: version.id, description })
        }
    }

    const handleRestore = async (version) => {
        const confirmed = await showConfirm({
            title: 'Restore Version',
            message: `Are you sure you want to restore to version ${version.versionNumber}?`,
            confirmText: 'Restore',
            confirmButtonStyle: 'warning'
        })

        if (confirmed) {
            restoreMutation.mutate(version.id)
        }
    }

    const handleCompare = (version1, version2) => {
        setCompareVersions({ version1, version2 })
        setActiveTab('compare')
    }

    const VersionCard = ({ version }) => (
        <div className={`border rounded-lg p-4 ${version.isCurrentPublished ? 'border-blue-500 bg-blue-50' : 'border-gray-200'}`}>
            <div className="flex items-center justify-between mb-3">
                <div className="flex items-center space-x-3">
                    <span className="text-lg font-semibold">v{version.versionNumber}</span>
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${version.statusBadge.color === 'green' ? 'bg-green-100 text-green-800' :
                        version.statusBadge.color === 'yellow' ? 'bg-yellow-100 text-yellow-800' :
                            'bg-gray-100 text-gray-800'
                        }`}>
                        {version.statusBadge.text}
                    </span>
                    {version.isCurrentPublished && (
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                            Current
                        </span>
                    )}
                </div>
                <div className="flex items-center space-x-2">
                    {canPublishVersion(version) && (
                        <button
                            onClick={() => handlePublish(version)}
                            className="p-1 text-green-600 hover:text-green-800"
                            title="Publish version"
                        >
                            <Upload className="h-4 w-4" />
                        </button>
                    )}
                    {canCreateDraft(version) && (
                        <button
                            onClick={() => handleCreateDraft(version)}
                            className="p-1 text-blue-600 hover:text-blue-800"
                            title="Create draft"
                        >
                            <GitBranch className="h-4 w-4" />
                        </button>
                    )}
                    <button
                        onClick={() => handleRestore(version)}
                        className="p-1 text-purple-600 hover:text-purple-800"
                        title="Restore version"
                    >
                        <Download className="h-4 w-4" />
                    </button>
                    {canDeleteVersion(version) && (
                        <button
                            onClick={() => handleDelete(version)}
                            className="p-1 text-red-600 hover:text-red-800"
                            title="Delete version"
                        >
                            <Trash2 className="h-4 w-4" />
                        </button>
                    )}
                </div>
            </div>

            <div className="space-y-2 text-sm text-gray-600">
                {version.description && (
                    <p className="text-gray-800">{version.description}</p>
                )}
                <div className="flex items-center space-x-4">
                    <span className="flex items-center">
                        <Users className="h-4 w-4 mr-1" />
                        {version.createdBy?.username || 'Unknown'}
                    </span>
                    <span className="flex items-center">
                        <Calendar className="h-4 w-4 mr-1" />
                        {version.formattedDate}
                    </span>
                    {version.publishedAt && (
                        <span className="flex items-center">
                            <CheckCircle className="h-4 w-4 mr-1" />
                            Published {version.formattedPublishDate}
                        </span>
                    )}
                </div>
            </div>

            <div className="mt-3 flex space-x-2">
                <button
                    onClick={() => setSelectedVersion(version)}
                    className="text-xs bg-gray-100 text-gray-700 px-2 py-1 rounded hover:bg-gray-200"
                >
                    View Details
                </button>
                {versions.length > 1 && (
                    <button
                        onClick={() => {
                            if (!compareVersions.version1) {
                                setCompareVersions({ version1: version, version2: null })
                                addNotification('Select second version to compare', 'info', 'version-compare')
                            } else if (!compareVersions.version2 && compareVersions.version1.id !== version.id) {
                                setCompareVersions({ ...compareVersions, version2: version })
                                handleCompare(compareVersions.version1, version)
                            }
                        }}
                        className="text-xs bg-blue-100 text-blue-700 px-2 py-1 rounded hover:bg-blue-200"
                    >
                        {compareVersions.version1?.id === version.id ? 'Selected for Compare' : 'Compare'}
                    </button>
                )}
            </div>
        </div>
    )

    const VersionStats = () => (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
            <div className="bg-blue-50 p-4 rounded-lg">
                <div className="text-2xl font-bold text-blue-600">{versionStats?.totalDrafts || 0}</div>
                <div className="text-sm text-blue-600">Drafts</div>
            </div>
            <div className="bg-green-50 p-4 rounded-lg">
                <div className="text-2xl font-bold text-green-600">{versionStats?.totalPublished || 0}</div>
                <div className="text-sm text-green-600">Published</div>
            </div>
            <div className="bg-purple-50 p-4 rounded-lg">
                <div className="text-2xl font-bold text-purple-600">{versions.length}</div>
                <div className="text-sm text-purple-600">Total Versions</div>
            </div>
            <div className="bg-gray-50 p-4 rounded-lg">
                <div className="text-2xl font-bold text-gray-600">
                    {versionStats?.currentVersion?.versionNumber || 'N/A'}
                </div>
                <div className="text-sm text-gray-600">Current Version</div>
            </div>
        </div>
    )

    const ComparisonView = () => (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold">Version Comparison</h3>
                <button
                    onClick={() => {
                        setActiveTab('list')
                        setCompareVersions({ version1: null, version2: null })
                    }}
                    className="text-gray-500 hover:text-gray-700"
                >
                    Back to List
                </button>
            </div>

            {comparisonLoading ? (
                <div className="flex justify-center py-8">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                </div>
            ) : comparisonData ? (
                <div className="space-y-6">
                    <div className="grid grid-cols-2 gap-6">
                        <div className="border rounded-lg p-4">
                            <h4 className="font-semibold mb-2">Version {compareVersions.version1.versionNumber}</h4>
                            <p className="text-sm text-gray-600">{compareVersions.version1.description}</p>
                            <p className="text-xs text-gray-500 mt-2">{compareVersions.version1.formattedDate}</p>
                        </div>
                        <div className="border rounded-lg p-4">
                            <h4 className="font-semibold mb-2">Version {compareVersions.version2.versionNumber}</h4>
                            <p className="text-sm text-gray-600">{compareVersions.version2.description}</p>
                            <p className="text-xs text-gray-500 mt-2">{compareVersions.version2.formattedDate}</p>
                        </div>
                    </div>

                    <div className="border rounded-lg p-4">
                        <h4 className="font-semibold mb-4">Changes</h4>
                        {comparisonData.changes.fieldsChanged.length > 0 && (
                            <div className="mb-4">
                                <h5 className="font-medium text-sm mb-2">Field Changes:</h5>
                                <div className="space-y-2">
                                    {comparisonData.changes.fieldsChanged.map((change, index) => (
                                        <div key={index} className="text-sm bg-yellow-50 p-2 rounded">
                                            <strong>{change.field}:</strong> {String(change.oldValue)} → {String(change.newValue)}
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        {comparisonData.changes.widgetsAdded.length > 0 && (
                            <div className="mb-4">
                                <h5 className="font-medium text-sm mb-2">Widgets Added:</h5>
                                <div className="text-sm text-green-600">{comparisonData.changes.widgetsAdded.length} widgets added</div>
                            </div>
                        )}

                        {comparisonData.changes.widgetsRemoved.length > 0 && (
                            <div className="mb-4">
                                <h5 className="font-medium text-sm mb-2">Widgets Removed:</h5>
                                <div className="text-sm text-red-600">{comparisonData.changes.widgetsRemoved.length} widgets removed</div>
                            </div>
                        )}

                        {comparisonData.changes.widgetsModified.length > 0 && (
                            <div className="mb-4">
                                <h5 className="font-medium text-sm mb-2">Widgets Modified:</h5>
                                <div className="text-sm text-blue-600">{comparisonData.changes.widgetsModified.length} widgets modified</div>
                            </div>
                        )}

                        {Object.values(comparisonData.changes).every(arr => arr.length === 0) && (
                            <p className="text-gray-500 text-sm">No changes detected between these versions.</p>
                        )}
                    </div>
                </div>
            ) : null}
        </div>
    )

    return (
        <div className="fixed inset-0 bg-black bg-opacity-10 z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-lg max-w-4xl w-full max-h-[90vh] overflow-hidden">
                <div className="p-6 border-b border-gray-200">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-3">
                            <History className="h-6 w-6 text-blue-600" />
                            <h2 className="text-xl font-semibold">Version Manager</h2>
                        </div>
                        <button
                            onClick={onClose}
                            className="text-gray-400 hover:text-gray-600"
                        >
                            ×
                        </button>
                    </div>

                    <div className="flex space-x-4 mt-4">
                        <button
                            onClick={() => setActiveTab('list')}
                            className={`px-4 py-2 rounded-md text-sm font-medium ${activeTab === 'list'
                                ? 'bg-blue-100 text-blue-700'
                                : 'text-gray-500 hover:text-gray-700'
                                }`}
                        >
                            Versions
                        </button>
                        <button
                            onClick={() => setActiveTab('compare')}
                            className={`px-4 py-2 rounded-md text-sm font-medium ${activeTab === 'compare'
                                ? 'bg-blue-100 text-blue-700'
                                : 'text-gray-500 hover:text-gray-700'
                                }`}
                            disabled={!compareVersions.version1 || !compareVersions.version2}
                        >
                            Compare
                        </button>
                    </div>
                </div>

                <div className="p-6 overflow-y-auto max-h-[calc(90vh-120px)]">
                    {versionsLoading ? (
                        <div className="flex justify-center py-8">
                            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                        </div>
                    ) : (
                        <>
                            {activeTab === 'list' && (
                                <div className="space-y-6">
                                    <VersionStats />

                                    <div className="space-y-4">
                                        {formattedVersions.map((version) => (
                                            <VersionCard key={version.id} version={version} />
                                        ))}

                                        {formattedVersions.length === 0 && (
                                            <div className="text-center py-8 text-gray-500">
                                                <History className="h-12 w-12 mx-auto mb-3 text-gray-300" />
                                                <p>No versions found for this page.</p>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            )}

                            {activeTab === 'compare' && <ComparisonView />}
                        </>
                    )}
                </div>
            </div>
        </div>
    )
}

export default VersionManager 