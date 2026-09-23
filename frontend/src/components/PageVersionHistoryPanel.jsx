import { useCallback, useEffect, useMemo, useState } from 'react'
import { AlertTriangle, Eye, History, RefreshCw, RotateCcw } from 'lucide-react'
import { endpoints } from '../api/endpoints'
import { versionsApi } from '../api/versions'

const statusStyles = {
    published: 'bg-green-50 text-green-700 border-green-200',
    scheduled: 'bg-blue-50 text-blue-700 border-blue-200',
    expired: 'bg-gray-100 text-gray-600 border-gray-200',
    draft: 'bg-amber-50 text-amber-700 border-amber-200',
}

const PageVersionHistoryPanel = ({ pageId, workflow, onRestored, confirmRestore }) => {
    const [versions, setVersions] = useState([])
    const [loading, setLoading] = useState(true)
    const [restoringId, setRestoringId] = useState(null)
    const [compareIds, setCompareIds] = useState([])
    const [comparison, setComparison] = useState(null)

    const load = useCallback(async () => {
        setLoading(true)
        try {
            const response = await versionsApi.getPageVersionsList(pageId)
            setVersions(response.results || response || [])
        } finally {
            setLoading(false)
        }
    }, [pageId])

    useEffect(() => {
        load()
    }, [load])

    const legacyCount = useMemo(() => {
        const conflicts = workflow?.legacyConflicts || {}
        return (conflicts.olderDraftCount || 0) + (conflicts.additionalScheduledCount || 0)
    }, [workflow])

    const toggleCompare = async (id) => {
        const next = compareIds.includes(id)
            ? compareIds.filter(item => item !== id)
            : [...compareIds.slice(-1), id]
        setCompareIds(next)
        setComparison(null)
        if (next.length === 2) {
            setComparison(await versionsApi.compare(next[0], next[1]))
        }
    }

    const restore = async (id) => {
        if (confirmRestore && !(await confirmRestore())) return
        setRestoringId(id)
        try {
            const result = await versionsApi.restore(id, workflow?.editableVersion?.updatedAt || null)
            await load()
            await onRestored?.(result.version)
        } finally {
            setRestoringId(null)
        }
    }

    return (
        <section id="page-version-history" className="rounded-lg border border-gray-200 bg-white">
            <div className="flex items-center justify-between border-b border-gray-200 px-4 py-3">
                <div>
                    <div className="flex items-center gap-2 font-semibold text-gray-900">
                        <History className="h-4 w-4" /> History
                    </div>
                    <p className="mt-0.5 text-xs text-gray-500">Technical version details are kept here, outside the normal editing flow.</p>
                </div>
                <button type="button" onClick={load} className="rounded p-2 text-gray-500 hover:bg-gray-100" aria-label="Refresh history">
                    <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
                </button>
            </div>

            {legacyCount > 0 && (
                <div className="m-4 flex gap-2 rounded border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
                    <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                    <div>
                        This page contains legacy parallel drafts or schedules. They are preserved as read-only history. Resolve additional schedules before creating a new one.
                    </div>
                </div>
            )}

            {comparison && (
                <div className="mx-4 mb-4 rounded border border-blue-200 bg-blue-50 p-3 text-sm text-blue-900">
                    Comparison selected: {comparison.changes?.fieldsChanged?.length || 0} changed fields, {comparison.changes?.widgetsAdded?.length || 0} widgets added, {comparison.changes?.widgetsRemoved?.length || 0} removed.
                </div>
            )}

            <div className="divide-y divide-gray-100">
                {versions.map(version => {
                    const isWorking = String(version.id) === String(workflow?.editableVersion?.id)
                    return (
                        <div key={version.id} className="flex flex-col gap-3 px-4 py-3 md:flex-row md:items-center">
                            <label className="flex min-w-0 flex-1 items-start gap-3">
                                <input
                                    type="checkbox"
                                    checked={compareIds.includes(version.id)}
                                    onChange={() => toggleCompare(version.id)}
                                    aria-label={`Compare version ${version.versionNumber}`}
                                    className="mt-1"
                                />
                                <span className="min-w-0">
                                    <span className="flex flex-wrap items-center gap-2">
                                        <span className="font-mono text-xs text-gray-500">v{version.versionNumber}</span>
                                        <span className={`rounded border px-2 py-0.5 text-xs font-medium ${statusStyles[version.publicationStatus] || statusStyles.draft}`}>
                                            {isWorking ? 'Working' : version.publicationStatus}
                                        </span>
                                    </span>
                                    <span className="mt-1 block truncate text-sm text-gray-800">{version.versionTitle || 'Untitled version'}</span>
                                    <span className="block text-xs text-gray-500">{new Date(version.createdAt).toLocaleString()}</span>
                                </span>
                            </label>
                            <div className="flex items-center gap-2">
                                <button
                                    type="button"
                                    onClick={() => window.open(endpoints.previewSizes.preview(pageId, version.id), '_blank', 'noopener,noreferrer')}
                                    className="flex items-center gap-1 rounded border border-gray-300 px-2.5 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50"
                                >
                                    <Eye className="h-3.5 w-3.5" /> Preview
                                </button>
                                {!isWorking && (
                                    <button
                                        type="button"
                                        onClick={() => restore(version.id)}
                                        disabled={restoringId === version.id}
                                        className="flex items-center gap-1 rounded border border-blue-300 px-2.5 py-1.5 text-xs font-medium text-blue-700 hover:bg-blue-50 disabled:opacity-50"
                                    >
                                        <RotateCcw className="h-3.5 w-3.5" /> Restore as working
                                    </button>
                                )}
                            </div>
                        </div>
                    )
                })}
                {!loading && versions.length === 0 && <div className="p-6 text-center text-sm text-gray-500">No history yet.</div>}
            </div>
        </section>
    )
}

export default PageVersionHistoryPanel
