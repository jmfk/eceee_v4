import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { History, Loader2, Pencil, RotateCcw, Save, X } from 'lucide-react'

import { themesApi } from '../../api/themes'
import { useGlobalNotifications } from '../../contexts/GlobalNotificationContext'
import { extractErrorMessage } from '../../utils/errorHandling'

const formatDate = (value) => value
    ? new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value))
    : 'Unknown date'

const ThemeVersionsTab = ({ themeId, hasUnsavedChanges }) => {
    const queryClient = useQueryClient()
    const { addNotification } = useGlobalNotifications()
    const [checkpointName, setCheckpointName] = useState('')
    const [editingVersionId, setEditingVersionId] = useState(null)
    const [versionName, setVersionName] = useState('')

    const { data, isLoading, error } = useQuery({
        queryKey: ['theme-versions', String(themeId)],
        queryFn: async () => await themesApi.versions(themeId),
        enabled: Boolean(themeId),
    })
    const versions = data?.results || []

    const refreshVersions = () => queryClient.invalidateQueries({ queryKey: ['theme-versions', String(themeId)] })

    const checkpointMutation = useMutation({
        mutationFn: async (name) => await themesApi.createVersion(themeId, name),
        onSuccess: async () => {
            setCheckpointName('')
            await refreshVersions()
            addNotification({ type: 'success', message: 'Named theme version saved' })
        },
        onError: (mutationError) => addNotification({
            type: 'error',
            message: extractErrorMessage(mutationError, 'Failed to save theme version'),
        }),
    })

    const renameMutation = useMutation({
        mutationFn: async ({ versionId, name }) => await themesApi.renameVersion(themeId, versionId, name),
        onSuccess: async () => {
            setEditingVersionId(null)
            setVersionName('')
            await refreshVersions()
            addNotification({ type: 'success', message: 'Version name updated' })
        },
        onError: (mutationError) => addNotification({
            type: 'error',
            message: extractErrorMessage(mutationError, 'Failed to update version name'),
        }),
    })

    const restoreMutation = useMutation({
        mutationFn: async (versionId) => await themesApi.restoreVersion(themeId, versionId),
        onSuccess: async () => {
            await Promise.all([
                refreshVersions(),
                queryClient.invalidateQueries({ queryKey: ['themes', String(themeId)] }),
                queryClient.invalidateQueries({ queryKey: ['themes'] }),
            ])
            addNotification({ type: 'success', message: 'Theme version restored as the new current version' })
        },
        onError: (mutationError) => addNotification({
            type: 'error',
            message: extractErrorMessage(mutationError, 'Failed to restore theme version'),
        }),
    })

    const createCheckpoint = () => {
        const name = checkpointName.trim()
        if (!name || hasUnsavedChanges) return
        checkpointMutation.mutate(name)
    }

    const restore = (version) => {
        if (hasUnsavedChanges) return
        if (!window.confirm(`Restore v${version.versionNumber} “${version.name || 'Unnamed version'}” as the current theme? Existing history will be kept.`)) return
        restoreMutation.mutate(version.id)
    }

    return (
        <div className="space-y-6">
            <div>
                <div className="flex items-center gap-2 text-lg font-semibold text-gray-900" role="heading" aria-level="3"><History className="h-5 w-5" />Theme Versions</div>
                <p className="mt-1 text-sm text-gray-600">Save named design checkpoints and restore an earlier version without deleting the history that came after it.</p>
            </div>

            {hasUnsavedChanges && <div role="alert" className="rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">Save the current theme changes before creating or restoring a version.</div>}

            <section className="rounded-lg border border-gray-200 bg-gray-50 p-4" aria-label="Save named theme version">
                <label htmlFor="theme-version-name" className="text-sm font-medium text-gray-800">New version name</label>
                <div className="mt-2 flex flex-col gap-2 sm:flex-row">
                    <input id="theme-version-name" value={checkpointName} onChange={(event) => setCheckpointName(event.target.value)} maxLength={160} placeholder="For example: Approved conference design" className="min-w-0 flex-1 rounded-md border border-gray-300 bg-white px-3 py-2 text-sm" />
                    <button type="button" onClick={createCheckpoint} disabled={!checkpointName.trim() || hasUnsavedChanges || checkpointMutation.isPending} className="inline-flex items-center justify-center gap-2 rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-50">{checkpointMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}Save version</button>
                </div>
            </section>

            {isLoading && <div className="flex items-center gap-2 text-sm text-gray-600"><Loader2 className="h-4 w-4 animate-spin" />Loading version history…</div>}
            {error && <div role="alert" className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-800">{extractErrorMessage(error, 'Failed to load theme versions')}</div>}
            {!isLoading && !error && versions.length === 0 && <div className="rounded-lg border border-dashed border-gray-300 p-8 text-center text-sm text-gray-500">No saved versions yet.</div>}

            {versions.length > 0 && <ol className="divide-y divide-gray-200 rounded-lg border border-gray-200">
                {versions.map((version) => <li key={version.id} className="p-4">
                    {editingVersionId === version.id ? <div className="flex flex-col gap-2 sm:flex-row">
                        <input aria-label={`Name for version ${version.versionNumber}`} value={versionName} onChange={(event) => setVersionName(event.target.value)} maxLength={160} placeholder="Optional version name" className="min-w-0 flex-1 rounded-md border border-gray-300 px-3 py-2 text-sm" />
                        <button type="button" onClick={() => renameMutation.mutate({ versionId: version.id, name: versionName.trim() })} disabled={renameMutation.isPending} className="inline-flex items-center justify-center gap-1 rounded-md bg-blue-600 px-3 py-2 text-sm font-medium text-white disabled:opacity-50"><Save className="h-4 w-4" />Save</button>
                        <button type="button" onClick={() => { setEditingVersionId(null); setVersionName('') }} className="inline-flex items-center justify-center gap-1 rounded-md border border-gray-300 px-3 py-2 text-sm"><X className="h-4 w-4" />Cancel</button>
                    </div> : <div className="flex flex-wrap items-start justify-between gap-3">
                        <div className="min-w-0">
                            <div className="flex flex-wrap items-center gap-2"><span className="font-mono text-xs text-gray-500">v{version.versionNumber}</span><span className="font-medium text-gray-900">{version.name || 'Unnamed version'}</span>{version.isCurrent && <span className="rounded bg-green-50 px-2 py-0.5 text-xs font-medium text-green-700">Current</span>}</div>
                            <p className="mt-1 text-xs text-gray-500">{formatDate(version.createdAt)} · {version.sourceLabel || version.source}{version.createdBy ? ` · ${version.createdBy}` : ''}</p>
                        </div>
                        <div className="flex shrink-0 gap-2">
                            <button type="button" onClick={() => { setEditingVersionId(version.id); setVersionName(version.name || '') }} className="inline-flex items-center gap-1 rounded-md border border-gray-300 px-3 py-1.5 text-xs font-medium text-gray-700"><Pencil className="h-3.5 w-3.5" />{version.name ? 'Rename' : 'Name'}</button>
                            {!version.isCurrent && <button type="button" onClick={() => restore(version)} disabled={hasUnsavedChanges || restoreMutation.isPending} className="inline-flex items-center gap-1 rounded-md border border-gray-300 px-3 py-1.5 text-xs font-medium text-gray-700 disabled:opacity-50"><RotateCcw className="h-3.5 w-3.5" />Restore</button>}
                        </div>
                    </div>}
                </li>)}
            </ol>}
        </div>
    )
}

export default ThemeVersionsTab
