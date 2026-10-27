import { useEffect, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Calendar, Globe, History, Radio, Upload } from 'lucide-react'
import { objectInstancesApi, objectVersionsApi } from '../../api/objectStorage'
import { useNotificationContext } from '../NotificationManager'

const stateLabels = {
    notPublished: 'Not published', not_published: 'Not published',
    live: 'Live',
    liveWithUnpublishedChanges: 'Live · unpublished changes', live_with_unpublished_changes: 'Live · unpublished changes',
    liveWithScheduledChanges: 'Live · scheduled changes', live_with_scheduled_changes: 'Live · scheduled changes',
    scheduled: 'Scheduled', publicationEnded: 'Publication ended', publication_ended: 'Publication ended',
}

const actionClass = 'rounded border border-gray-300 px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50'

const ObjectPublishingView = ({ instance, isNewInstance, isDirty = false, onSave, onWorkflowChange, onRestored, onViewVersion, isFeatured = false, onFeaturedChange, showHistory = false }) => {
    const queryClient = useQueryClient()
    const { showConfirm } = useNotificationContext()
    const [scheduleDate, setScheduleDate] = useState('')
    const [busy, setBusy] = useState(false)
    const [error, setError] = useState('')
    const [notice, setNotice] = useState('')
    const workflowQuery = useQuery({
        queryKey: ['objectWorkflow', String(instance?.id)],
        queryFn: async () => await objectInstancesApi.getWorkflow(instance.id),
        enabled: Boolean(instance?.id) && !isNewInstance,
    })
    const historyQuery = useQuery({
        queryKey: ['objectInstance', String(instance?.id), 'versions'],
        queryFn: async () => await objectInstancesApi.getVersions(instance.id),
        enabled: Boolean(instance?.id) && !isNewInstance,
    })
    const workflow = workflowQuery.data?.data
    const versions = historyQuery.data?.data || []

    useEffect(() => {
        if (!workflow?.scheduledAt) { setScheduleDate(''); return }
        const date = new Date(workflow.scheduledAt)
        setScheduleDate(new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().slice(0, 16))
    }, [workflow?.scheduledAt])

    const refresh = async () => {
        await Promise.all([
            workflowQuery.refetch(), historyQuery.refetch(),
            queryClient.invalidateQueries({ queryKey: ['objectInstances'] }),
            onWorkflowChange?.(),
        ])
    }

    const run = async (action, success, shouldRefresh = true) => {
        setBusy(true); setError(''); setNotice('')
        try {
            await action()
            setNotice(success)
            if (shouldRefresh) await refresh()
        } catch (failure) {
            const serverError = failure.response?.data
            const detail = serverError?.message || serverError?.detail || (serverError && JSON.stringify(serverError)) || failure.message
            setError(typeof detail === 'string' ? detail : JSON.stringify(detail))
            await Promise.allSettled([workflowQuery.refetch(), historyQuery.refetch()])
        } finally { setBusy(false) }
    }

    const workingVersion = async () => {
        if (isDirty) {
            const saved = await onSave?.()
            if (!saved) throw new Error('Save the current changes before publishing.')
            return saved
        }
        if (!workflow?.editableVersion) throw new Error('Save changes to create a working copy first.')
        return workflow.editableVersion
    }

    const publish = () => run(async () => {
        const version = await workingVersion()
        await objectVersionsApi.publish(version.id, version.editRevision)
    }, 'Changes published.')

    const schedule = () => run(async () => {
        const effectiveDate = new Date(scheduleDate)
        if (!scheduleDate || effectiveDate <= new Date()) throw new Error('Choose a future publication time.')
        const version = await workingVersion()
        await objectVersionsApi.schedule(version.id, { effective_date: effectiveDate.toISOString() }, version.editRevision)
    }, 'Working copy scheduled.')

    const restore = async (source) => {
        const confirmed = await showConfirm({
            title: 'Restore historical version',
            message: isDirty ? 'Replace the working copy and discard unsaved changes? Live content will stay unchanged.' : 'Copy this historical content into the working copy? Live content will stay unchanged.',
            confirmText: 'Restore as working', confirmButtonStyle: 'primary',
        })
        if (!confirmed) return
        return run(async () => {
            const reviewed = workflow.editableVersion || workflow.liveVersion || versions[0]
            await objectVersionsApi.restore(source.id, reviewed)
            await onRestored?.()
        }, 'Historical content restored into the working copy.')
    }

    useEffect(() => {
        if (showHistory) {
            document.getElementById('object-version-history')?.scrollIntoView?.({ block: 'start' })
        }
    }, [showHistory, workflow])


    if (isNewInstance) return <p className="p-6 text-sm text-gray-600">Save this Object before publishing.</p>
    if (workflowQuery.isLoading) return <p role="status" className="p-6 text-sm text-gray-600">Loading publishing state…</p>
    if (workflowQuery.isError) return <div role="alert" className="p-6"><p>Couldn’t load publishing state.</p><button type="button" onClick={() => workflowQuery.refetch()} className={actionClass}>Retry</button></div>

    const canPublish = Boolean(workflow?.editableVersion || isDirty)
    const legacy = workflow?.legacyConflicts || {}
    return (
        <div className="mx-auto max-w-5xl space-y-5 p-4 md:p-6">
            {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
            {notice && <p role="status" className="text-sm text-gray-700">{notice}</p>}
            <section className="rounded-lg border border-gray-200 bg-white p-5">
                <div className="flex flex-col justify-between gap-4 md:flex-row md:items-start">
                    <div>
                        <h2 className="flex items-center gap-2 text-lg font-semibold text-gray-900"><Radio className="h-5 w-5 text-blue-600" />Publishing</h2>
                        <p className="mt-1 text-sm text-gray-600">Current state: <span className="font-medium text-gray-900">{stateLabels[workflow?.state] || 'Not published'}</span></p>
                        {workflow?.liveVersion && <p className="mt-1 text-sm text-gray-600">Visitors see version {workflow.liveVersion.versionNumber}.</p>}
                    </div>
                    <div className="flex flex-wrap gap-2">
                        <button type="button" onClick={publish} disabled={busy || !canPublish} className="flex items-center gap-1.5 rounded bg-blue-700 px-3 py-2 text-sm font-medium text-white hover:bg-blue-800 disabled:opacity-50"><Upload className="h-4 w-4" />Publish changes</button>
                        {workflow?.liveVersion && <button type="button" disabled={busy || isDirty} onClick={() => run(async () => await objectVersionsApi.unpublish(workflow.liveVersion.id, workflow.liveVersion.editRevision), 'Object unpublished; history was kept.')} className={`flex items-center gap-1.5 ${actionClass}`}><Globe className="h-4 w-4" />Unpublish</button>}
                    </div>
                </div>
                {onFeaturedChange && <label className="mt-4 flex items-center gap-2 text-sm text-gray-700"><input type="checkbox" checked={isFeatured} disabled={busy} onChange={event => onFeaturedChange(event.target.checked)} />Featured in lists after publishing</label>}
                <div className="mt-5 space-y-3">
                    <h3 className="flex items-center gap-2 font-medium text-gray-900"><Calendar className="h-4 w-4" />Schedule working copy</h3>
                    <div className="flex flex-wrap items-end gap-2">
                        <label className="text-sm text-gray-700">Publish at<input type="datetime-local" value={scheduleDate} onChange={event => setScheduleDate(event.target.value)} className="mt-1 block rounded border border-gray-300 px-3 py-2 text-sm" /></label>
                        <button type="button" onClick={schedule} disabled={busy || !scheduleDate || !canPublish} className={actionClass}>{workflow?.scheduledVersion ? 'Update schedule' : 'Schedule'}</button>
                        {workflow?.scheduledVersion && <button type="button" disabled={busy || isDirty} onClick={() => run(async () => await objectVersionsApi.cancelSchedule(workflow.scheduledVersion), 'Schedule cancelled; working copy kept.')} className={actionClass}>Cancel schedule</button>}
                    </div>
                    <p className="text-xs text-gray-500">Scheduled content remains editable until it goes live. Save unsaved changes before cancelling a schedule or unpublishing.</p>
                </div>
            </section>
            <section id="object-version-history" className="rounded-lg border border-gray-200 bg-white p-5">
                <h2 className="flex items-center gap-2 font-semibold text-gray-900"><History className="h-4 w-4" />History</h2>
                <p className="mt-1 text-sm text-gray-600">Saved content and previous publications. Restoring creates unpublished changes.</p>
                {(legacy.olderDraftCount > 0 || legacy.additionalScheduledCount > 0) && <p className="mt-3 text-sm text-amber-800">Older drafts and additional schedules were preserved. Cancel additional schedules before publishing or scheduling new changes.</p>}
                {historyQuery.isLoading && <p role="status" className="mt-4 text-sm">Loading history…</p>}
                {historyQuery.isError && <p role="alert" className="mt-4 text-sm">Couldn’t load history. <button type="button" onClick={() => historyQuery.refetch()} className={actionClass}>Retry</button></p>}
                <div className="mt-3 divide-y divide-gray-100">
                    {versions.map(version => {
                        const isWorking = String(version.id) === String(workflow?.editableVersion?.id)
                        const isLive = String(version.id) === String(workflow?.liveVersion?.id)
                        return <div key={version.id} className="flex flex-col justify-between gap-3 py-3 md:flex-row md:items-center">
                            <div><p className="text-sm font-medium text-gray-900">v{version.versionNumber} · {isWorking ? 'Working copy' : isLive ? 'Live' : version.publicationStatus === 'scheduled' ? 'Scheduled' : 'Historical'}</p><p className="text-sm text-gray-600">{version.title || version.changeDescription || 'Saved version'}</p><p className="text-xs text-gray-500">{new Date(version.createdAt).toLocaleString()}{version.effectiveDate && ` · Publication: ${new Date(version.effectiveDate).toLocaleString()}`}</p></div>
                            <div className="flex flex-wrap gap-2">
                                <button type="button" disabled={busy} onClick={() => onViewVersion?.(version.id)} className={actionClass}>View</button>
                                {!isWorking && <button type="button" disabled={busy} onClick={() => restore(version)} className={actionClass}>Restore as working</button>}
                                {version.publicationStatus === 'scheduled' && String(version.id) !== String(workflow?.scheduledVersion?.id) && <button type="button" disabled={busy || isDirty} onClick={() => run(async () => await objectVersionsApi.cancelSchedule(version), 'Additional schedule cancelled.')} className={actionClass}>Cancel schedule v{version.versionNumber}</button>}
                            </div>
                        </div>
                    })}
                    {!historyQuery.isLoading && !historyQuery.isError && versions.length === 0 && <p className="py-4 text-sm text-gray-500">No history yet.</p>}
                </div>
            </section>
        </div>
    )
}

export default ObjectPublishingView
