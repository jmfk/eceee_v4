import React, { useEffect, useState } from 'react'
import { Calendar, Clock, Globe, Radio, Upload } from 'lucide-react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { versionsApi } from '../api/versions'
import { useNotificationContext } from './NotificationManager'
import { useGlobalNotifications } from '../contexts/GlobalNotificationContext'
import PageVersionHistoryPanel from './PageVersionHistoryPanel'

type WorkflowVersion = {
    id: number
    effectiveDate?: string | null
    updatedAt?: string
}

type Workflow = {
    state: string
    editableVersion?: WorkflowVersion | null
    liveVersion?: WorkflowVersion | null
    scheduledVersion?: WorkflowVersion | null
    scheduledAt?: string | null
    legacyConflicts?: {
        olderDraftCount?: number
        additionalScheduledCount?: number
    }
}

const stateLabels: Record<string, string> = {
    notPublished: 'Not published',
    not_published: 'Not published',
    live: 'Live',
    liveWithUnpublishedChanges: 'Live · unpublished changes',
    live_with_unpublished_changes: 'Live · unpublished changes',
    scheduled: 'Scheduled',
    liveWithScheduledChanges: 'Live · scheduled changes',
    live_with_scheduled_changes: 'Live · scheduled changes',
    publicationEnded: 'Publication ended',
    publication_ended: 'Publication ended',
}

type PublishingEditorProps = {
    pageId: number | string
    isDirty?: boolean
    onSave?: () => Promise<WorkflowVersion | undefined>
    onWorkflowChange?: () => Promise<unknown>
}

const PublishingEditor = ({ pageId, isDirty = false, onSave, onWorkflowChange }: PublishingEditorProps) => {
    const [scheduleDate, setScheduleDate] = useState('')
    const [busyAction, setBusyAction] = useState<string | null>(null)
    const queryClient = useQueryClient()
    const { showConfirm } = useNotificationContext()
    const { addNotification } = useGlobalNotifications()
    const { data: workflow, refetch } = useQuery<Workflow>({
        queryKey: ['pageWorkflow', pageId],
        queryFn: () => versionsApi.getWorkflow(pageId),
    })

    useEffect(() => {
        if (workflow?.scheduledAt) {
            const date = new Date(workflow.scheduledAt)
            const local = new Date(date.getTime() - date.getTimezoneOffset() * 60000)
            setScheduleDate(local.toISOString().slice(0, 16))
        }
    }, [workflow?.scheduledAt])

    const refresh = async () => {
        await refetch()
        await onWorkflowChange?.()
        await queryClient.invalidateQueries({ queryKey: ['pages'] })
    }

    const workingVersion = async () => {
        if (isDirty) {
            if (!onSave) {
                throw new Error('Save the current changes before publishing.')
            }
            const saved = await onSave()
            if (!saved) {
                throw new Error('The current changes could not be saved.')
            }
            return saved
        }
        if (workflow?.editableVersion) return workflow.editableVersion
        const result = await versionsApi.getOrCreateWorkingCopy(pageId)
        return result.version
    }

    const publish = async () => {
        const confirmed = await showConfirm({
            title: 'Publish changes',
            message: 'Publish this saved working version now?',
            confirmText: 'Publish changes',
            confirmButtonStyle: 'primary',
        })
        if (!confirmed) return
        setBusyAction('publish')
        try {
            const version = await workingVersion()
            await versionsApi.publish(version.id, version.updatedAt)
            addNotification('Changes published', 'success')
            await refresh()
        } catch (error: any) {
            addNotification(error.message || 'Publishing failed', 'error')
        } finally {
            setBusyAction(null)
        }
    }

    const schedule = async () => {
        if (!scheduleDate) return
        setBusyAction('schedule')
        try {
            const version = await workingVersion()
            await versionsApi.scheduleWorkingCopy(
                version.id,
                new Date(scheduleDate).toISOString(),
                null,
                version.updatedAt,
            )
            addNotification('Working version scheduled', 'success')
            await refresh()
        } catch (error: any) {
            addNotification(error.message || 'Scheduling failed', 'error')
        } finally {
            setBusyAction(null)
        }
    }

    const cancelSchedule = async () => {
        if (!workflow?.editableVersion) return
        setBusyAction('cancel')
        try {
            await versionsApi.cancelWorkingCopySchedule(workflow.editableVersion.id)
            setScheduleDate('')
            addNotification('Schedule cancelled; the content is a working version again', 'success')
            await refresh()
        } finally {
            setBusyAction(null)
        }
    }

    const unpublish = async () => {
        if (!workflow?.liveVersion) return
        const confirmed = await showConfirm({
            title: 'Unpublish page',
            message: 'Take this page offline? Content and history will be kept.',
            confirmText: 'Unpublish',
            confirmButtonStyle: 'danger',
        })
        if (!confirmed) return
        setBusyAction('unpublish')
        try {
            await versionsApi.unpublishExplicit(pageId, workflow.liveVersion.id)
            addNotification('Page unpublished; history was kept', 'success')
            await refresh()
        } finally {
            setBusyAction(null)
        }
    }

    return (
        <div className="mx-auto max-w-5xl space-y-5 p-4 md:p-6">
            <section className="rounded-lg border border-gray-200 bg-white p-5">
                <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                    <div>
                        <div className="flex items-center gap-2 text-lg font-semibold text-gray-900">
                            <Radio className="h-5 w-5 text-blue-600" /> Publishing
                        </div>
                        <p className="mt-1 text-sm text-gray-600">Current state: <span className="font-medium text-gray-900">{stateLabels[workflow?.state || ''] || 'Not published'}</span></p>
                        {workflow?.scheduledAt && <p className="mt-1 text-sm text-blue-700">Scheduled for {new Date(workflow.scheduledAt).toLocaleString()}</p>}
                    </div>
                    <div className="flex flex-wrap gap-2">
                        {workflow?.editableVersion && (
                            <button type="button" onClick={publish} disabled={Boolean(busyAction)} className="flex items-center gap-1.5 rounded bg-blue-700 px-3 py-2 text-sm font-medium text-white hover:bg-blue-800 disabled:opacity-50">
                                <Upload className="h-4 w-4" /> Publish changes
                            </button>
                        )}
                        {workflow?.liveVersion && (
                            <button type="button" onClick={unpublish} disabled={Boolean(busyAction)} className="flex items-center gap-1.5 rounded border border-red-300 px-3 py-2 text-sm font-medium text-red-700 hover:bg-red-50 disabled:opacity-50">
                                <Globe className="h-4 w-4" /> Unpublish
                            </button>
                        )}
                    </div>
                </div>

                <div className="mt-5 rounded border border-gray-200 bg-gray-50 p-4">
                    <div className="flex items-center gap-2 font-medium text-gray-900"><Calendar className="h-4 w-4" /> Schedule working version</div>
                    <div className="mt-3 flex flex-col gap-2 sm:flex-row">
                        <input type="datetime-local" value={scheduleDate} onChange={event => setScheduleDate(event.target.value)} className="rounded border border-gray-300 bg-white px-3 py-2 text-sm" />
                        <button type="button" onClick={schedule} disabled={!scheduleDate || Boolean(busyAction)} className="rounded bg-blue-600 px-3 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50">
                            {workflow?.scheduledVersion ? 'Update schedule' : 'Schedule'}
                        </button>
                        {workflow?.scheduledVersion && <button type="button" onClick={cancelSchedule} disabled={Boolean(busyAction)} className="rounded border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100">Cancel schedule</button>}
                    </div>
                    <p className="mt-2 flex items-center gap-1 text-xs text-gray-500"><Clock className="h-3.5 w-3.5" /> Scheduled content remains editable until it goes live.</p>
                </div>
            </section>

            <PageVersionHistoryPanel pageId={pageId} workflow={workflow} onRestored={refresh} />

        </div>
    )
}

export default PublishingEditor
