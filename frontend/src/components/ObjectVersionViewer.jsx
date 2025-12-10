import React, { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { History, Eye, GitBranch, Calendar, User, FileText, ArrowLeft, ArrowRight } from 'lucide-react'
import { objectInstancesApi } from '../api/objectStorage'
import Modal from './Modal'

const ObjectVersionViewer = ({ instanceId, isVisible, onClose }) => {
    const [selectedVersions, setSelectedVersions] = useState([])
    const [compareMode, setCompareMode] = useState(false)

    // Fetch version history
    const { data: versionsResponse, isLoading, error } = useQuery({
        queryKey: ['objectVersions', instanceId],
        queryFn: () => objectInstancesApi.getVersions(instanceId),
        enabled: !!instanceId && isVisible
    })

    const versions = versionsResponse?.data || []

    const handleVersionSelect = (versionId) => {
        if (compareMode) {
            setSelectedVersions(prev => {
                if (prev.includes(versionId)) {
                    return prev.filter(id => id !== versionId)
                } else if (prev.length < 2) {
                    return [...prev, versionId]
                } else {
                    // Replace oldest selection
                    return [prev[1], versionId]
                }
            })
        }
    }

    const getVersionById = (id) => versions.find(v => v.id === id)

    if (!isVisible) return null

    return (
        <Modal
            title="Version History"
            onClose={onClose}
            size="large"
        >
            <div className="space-y-6">
                {/* Header Controls */}
                <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-4">
                        <div className="text-lg font-medium text-gray-900 flex items-center" role="heading" aria-level="3">
                            <History className="h-5 w-5 mr-2" />
                            Version History
                        </div>
                        {versions.length > 0 && (
                            <span className="text-sm text-gray-600">
                                {versions.length} version{versions.length !== 1 ? 's' : ''}
                            </span>
                        )}
                    </div>

                    <div className="flex items-center space-x-2">
                        <button
                            onClick={() => {
                                setCompareMode(!compareMode)
                                setSelectedVersions([])
                            }}
                            className={`px-3 py-1 text-sm rounded-md transition-colors ${compareMode
                                ? 'bg-blue-100 text-blue-700 border border-blue-300'
                                : 'bg-gray-100 text-gray-700 border border-gray-300 hover:bg-gray-200'
                                }`}
                        >
                            <GitBranch className="h-4 w-4 mr-1" />
                            {compareMode ? 'Exit Compare' : 'Compare Versions'}
                        </button>
                    </div>
                </div>

                {compareMode && (
                    <div className="bg-blue-50 border border-blue-200 rounded-md p-3">
                        <div className="text-sm text-blue-800">
                            Select up to 2 versions to compare.
                            {selectedVersions.length > 0 && (
                                <span className="ml-2 font-medium">
                                    {selectedVersions.length} selected
                                </span>
                            )}
                        </div>
                    </div>
                )}

                {/* Loading State */}
                {isLoading && (
                    <div className="flex justify-center py-8">
                        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                    </div>
                )}

                {/* Error State */}
                {error && (
                    <div className="bg-red-50 border border-red-200 rounded-md p-4">
                        <div className="text-red-800">Error loading versions: {error.message}</div>
                    </div>
                )}

                {/* Version List */}
                {!isLoading && !error && (
                    <>
                        {versions.length === 0 ? (
                            <div className="text-center py-8">
                                <History className="mx-auto h-12 w-12 text-gray-400 mb-4" />
                                <div className="text-gray-600">No version history available</div>
                            </div>
                        ) : compareMode && selectedVersions.length === 2 ? (
                            <VersionComparison
                                version1={getVersionById(selectedVersions[0])}
                                version2={getVersionById(selectedVersions[1])}
                            />
                        ) : (
                            <div className="space-y-3">
                                {versions.map((version, index) => (
                                    <VersionItem
                                        key={version.id}
                                        version={version}
                                        isLatest={index === 0}
                                        isSelected={selectedVersions.includes(version.id)}
                                        onSelect={() => handleVersionSelect(version.id)}
                                        compareMode={compareMode}
                                    />
                                ))}
                            </div>
                        )}
                    </>
                )}
            </div>
        </Modal>
    )
}

// Version Item Component
const VersionItem = ({ version, isLatest, isSelected, onSelect, compareMode }) => {
    const [expanded, setExpanded] = useState(false)

    return (
        <div className={`border rounded-md p-4 transition-colors ${isSelected ? 'border-blue-300 bg-blue-50' : 'border-gray-200 hover:border-gray-300'
            }`}>
            <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                    {compareMode && (
                        <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={onSelect}
                            className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                        />
                    )}

                    <div>
                        <div className="flex items-center space-x-2">
                            <span className="font-medium text-gray-900">
                                Version {version.versionNumber}
                            </span>
                            {isLatest && (
                                <span className="px-2 py-1 bg-green-100 text-green-800 text-xs rounded-full">
                                    Current
                                </span>
                            )}
                        </div>

                        <div className="flex items-center space-x-4 mt-1 text-sm text-gray-600">
                            <span className="flex items-center">
                                <User className="h-3 w-3 mr-1" />
                                {version.createdBy?.username || version.createdBy || 'Unknown'}
                            </span>
                            <span className="flex items-center">
                                <Calendar className="h-3 w-3 mr-1" />
                                {new Date(version.createdAt).toLocaleDateString()}
                            </span>
                        </div>

                        {version.changeDescription && (
                            <div className="text-sm text-gray-700 mt-2">
                                {version.changeDescription}
                            </div>
                        )}
                    </div>
                </div>

                <button
                    onClick={() => setExpanded(!expanded)}
                    className="text-gray-400 hover:text-gray-600"
                >
                    <Eye className="h-4 w-4" />
                </button>
            </div>

            {/* Expanded Details */}
            {expanded && (
                <div className="mt-4 pt-4 border-t border-gray-200">
                    <div className="text-sm font-medium text-gray-900 mb-2" role="heading" aria-level="4">Data Snapshot</div>
                    <div className="bg-gray-50 rounded-md p-3 max-h-60 overflow-y-auto">
                        <pre className="text-xs text-gray-700 whitespace-pre-wrap">
                            {JSON.stringify(version.data, null, 2)}
                        </pre>
                    </div>

                    {version.widgets && Object.keys(version.widgets).length > 0 && (
                        <div className="mt-3">
                            <div className="text-sm font-medium text-gray-900 mb-2" role="heading" aria-level="4">Widget Configuration</div>
                            <div className="bg-gray-50 rounded-md p-3 max-h-40 overflow-y-auto">
                                <pre className="text-xs text-gray-700 whitespace-pre-wrap">
                                    {JSON.stringify(version.widgets, null, 2)}
                                </pre>
                            </div>
                        </div>
                    )}
                </div>
            )}
        </div>
    )
}

// Version Comparison Component
const VersionComparison = ({ version1, version2 }) => {
    const [compareField, setCompareField] = useState('data')

    const getFieldDifferences = (obj1, obj2) => {
        const keys = new Set([...Object.keys(obj1 || {}), ...Object.keys(obj2 || {})])
        const differences = []

        keys.forEach(key => {
            const val1 = obj1?.[key]
            const val2 = obj2?.[key]

            if (JSON.stringify(val1) !== JSON.stringify(val2)) {
                differences.push({
                    field: key,
                    oldValue: val1,
                    newValue: val2,
                    type: !val1 ? 'added' : !val2 ? 'removed' : 'changed'
                })
            }
        })

        return differences
    }

    const dataDifferences = getFieldDifferences(version1?.data, version2?.data)
    const widgetDifferences = getFieldDifferences(version1?.widgets, version2?.widgets)

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div className="text-lg font-medium text-gray-900" role="heading" aria-level="3">
                    Compare Versions {version1?.versionNumber} & {version2?.versionNumber}
                </div>

                <div className="flex bg-gray-100 rounded-md p-1">
                    <button
                        onClick={() => setCompareField('data')}
                        className={`px-3 py-1 rounded text-sm font-medium transition-colors ${compareField === 'data'
                            ? 'bg-white text-gray-900 shadow-sm'
                            : 'text-gray-600 hover:text-gray-900'
                            }`}
                    >
                        Data
                    </button>
                    <button
                        onClick={() => setCompareField('widgets')}
                        className={`px-3 py-1 rounded text-sm font-medium transition-colors ${compareField === 'widgets'
                            ? 'bg-white text-gray-900 shadow-sm'
                            : 'text-gray-600 hover:text-gray-900'
                            }`}
                    >
                        Widgets
                    </button>
                </div>
            </div>

            {/* Version Info */}
            <div className="grid grid-cols-2 gap-4">
                <div className="bg-gray-50 rounded-md p-3">
                    <div className="font-medium text-gray-900" role="heading" aria-level="4">Version {version1?.versionNumber}</div>
                    <div className="text-sm text-gray-600 mt-1">
                        {version1?.createdBy?.username || version1?.createdBy || 'Unknown'} • {new Date(version1?.createdAt).toLocaleString()}
                    </div>
                    {version1?.changeDescription && (
                        <div className="text-sm text-gray-700 mt-2">{version1.changeDescription}</div>
                    )}
                </div>

                <div className="bg-gray-50 rounded-md p-3">
                    <div className="font-medium text-gray-900" role="heading" aria-level="4">Version {version2?.versionNumber}</div>
                    <div className="text-sm text-gray-600 mt-1">
                        {version2?.createdBy?.username || version2?.createdBy || 'Unknown'} • {new Date(version2?.createdAt).toLocaleString()}
                    </div>
                    {version2?.changeDescription && (
                        <div className="text-sm text-gray-700 mt-2">{version2.changeDescription}</div>
                    )}
                </div>
            </div>

            {/* Differences */}
            <div>
                <div className="font-medium text-gray-900 mb-3" role="heading" aria-level="4">
                    {compareField === 'data' ? 'Data' : 'Widget'} Changes
                </div>

                {(compareField === 'data' ? dataDifferences : widgetDifferences).length === 0 ? (
                    <div className="text-gray-600 text-sm italic">
                        No {compareField} changes between these versions
                    </div>
                ) : (
                    <div className="space-y-2">
                        {(compareField === 'data' ? dataDifferences : widgetDifferences).map((diff, index) => (
                            <div key={index} className={`p-3 rounded-md border-l-4 ${diff.type === 'added' ? 'bg-green-50 border-green-400' :
                                diff.type === 'removed' ? 'bg-red-50 border-red-400' :
                                    'bg-yellow-50 border-yellow-400'
                                }`}>
                                <div className="flex items-center justify-between">
                                    <span className="font-medium text-gray-900">{diff.field}</span>
                                    <span className={`text-xs px-2 py-1 rounded ${diff.type === 'added' ? 'bg-green-100 text-green-800' :
                                        diff.type === 'removed' ? 'bg-red-100 text-red-800' :
                                            'bg-yellow-100 text-yellow-800'
                                        }`}>
                                        {diff.type}
                                    </span>
                                </div>

                                <div className="mt-2 grid grid-cols-2 gap-4 text-sm">
                                    <div>
                                        <span className="text-gray-600">Version {version1?.versionNumber}:</span>
                                        <div className="mt-1 p-2 bg-white rounded border text-gray-900 font-mono text-xs">
                                            {diff.oldValue ? JSON.stringify(diff.oldValue, null, 2) : '(not set)'}
                                        </div>
                                    </div>

                                    <div>
                                        <span className="text-gray-600">Version {version2?.versionNumber}:</span>
                                        <div className="mt-1 p-2 bg-white rounded border text-gray-900 font-mono text-xs">
                                            {diff.newValue ? JSON.stringify(diff.newValue, null, 2) : '(not set)'}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    )
}

export default ObjectVersionViewer
