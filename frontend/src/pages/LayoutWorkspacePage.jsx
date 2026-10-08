import { useCallback, useEffect, useRef, useState } from 'react'
import { ArrowLeft, Loader2, RotateCcw, Save, Send } from 'lucide-react'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'

import { layoutWorkspacesApi } from '../api/layoutWorkspaces'
import LayoutDesignerWorkspace from '../components/designer/LayoutDesignerWorkspace'
import { useGlobalNotifications } from '../contexts/GlobalNotificationContext'
import { useDocumentTitle } from '../hooks/useDocumentTitle'

const signature = (workspace) => JSON.stringify(workspace?.layouts || null)

const LayoutWorkspacePage = () => {
    const { themeId } = useParams()
    const navigate = useNavigate()
    const [searchParams, setSearchParams] = useSearchParams()
    const { addNotification } = useGlobalNotifications()
    const [workspace, setWorkspace] = useState(null)
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState('')
    const [dirty, setDirty] = useState(false)
    const [saving, setSaving] = useState(false)
    const [publishing, setPublishing] = useState(false)
    const baselineRef = useRef('')
    useDocumentTitle('Settings - Layout Editor')

    const acceptWorkspace = useCallback((next) => {
        baselineRef.current = signature(next)
        setWorkspace(next)
        setDirty(false)
    }, [])

    useEffect(() => {
        let active = true
        setLoading(true)
        layoutWorkspacesApi.workspace(themeId)
            .then((result) => { if (active) acceptWorkspace(result) })
            .catch((requestError) => { if (active) setError(requestError.message || 'Unable to open the Layout Editor.') })
            .finally(() => { if (active) setLoading(false) })
        return () => { active = false }
    }, [acceptWorkspace, themeId])

    const updateWorkspace = (updater) => {
        const next = updater(structuredClone(workspace))
        setWorkspace(next)
        setDirty(signature(next) !== baselineRef.current)
    }

    const saveDraft = async ({ silent = false } = {}) => {
        if (!dirty) return workspace
        setSaving(true)
        try {
            const result = await layoutWorkspacesApi.save(themeId, workspace.draftVersion, workspace.layouts)
            acceptWorkspace(result)
            if (!silent) addNotification({ type: 'success', message: 'Layout draft saved' })
            return result
        } catch (saveError) {
            addNotification({ type: 'error', message: saveError.message || 'Layout draft could not be saved' })
            return null
        } finally {
            setSaving(false)
        }
    }

    const publish = async () => {
        const current = dirty ? await saveDraft({ silent: true }) : workspace
        if (!current?.hasLayoutDraftChanges) return
        if (!window.confirm('Publish the saved layout changes? Theme Designer changes will not be published.')) return
        setPublishing(true)
        try {
            acceptWorkspace(await layoutWorkspacesApi.publish(themeId, current.draftVersion))
            addNotification({ type: 'success', message: 'Layouts published' })
        } catch (publishError) {
            addNotification({ type: 'error', message: publishError.message || 'Layouts could not be published' })
        } finally {
            setPublishing(false)
        }
    }

    const discard = async () => {
        if (!window.confirm('Discard only the saved and unsaved layout changes?')) return
        try {
            acceptWorkspace(await layoutWorkspacesApi.discard(themeId, workspace.draftVersion))
            addNotification({ type: 'success', message: 'Layout changes discarded' })
        } catch (discardError) {
            addNotification({ type: 'error', message: discardError.message || 'Layout changes could not be discarded' })
        }
    }

    const handleInitialAction = useCallback(() => {
        const next = new URLSearchParams(searchParams)
        next.delete('action')
        setSearchParams(next, { replace: true })
    }, [searchParams, setSearchParams])

    if (loading) return <div className="flex min-h-[60vh] items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-blue-600" /><span className="ml-3 text-gray-600">Loading Layout Editor…</span></div>
    if (error || !workspace) return <div role="alert" className="rounded-lg border border-red-200 bg-red-50 p-5 text-red-800"><h1 className="font-semibold">Layout Editor unavailable</h1><p className="mt-1 text-sm">{error}</p></div>

    const controlsDisabled = saving || publishing
    const editorDisabled = controlsDisabled || workspace.draftIsStale
    const hasLayoutChanges = dirty || workspace.hasLayoutDraftChanges
    return <div className="flex h-[calc(100vh-12rem)] min-h-[640px] flex-col overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm">
        <header className="flex flex-wrap items-center justify-between gap-3 border-b border-gray-200 px-4 py-3 sm:px-5">
            <div className="flex items-center gap-3"><button type="button" onClick={() => navigate(`/settings/themes/${themeId}/layouts`)} className="inline-flex min-h-9 items-center gap-1.5 rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50"><ArrowLeft className="h-4 w-4" />Theme layouts</button><div><h1 className="font-semibold text-gray-900">Layout Editor</h1><p className="text-xs text-gray-500">{workspace.name} · theme-owned layout draft</p></div></div>
            <div className="flex flex-wrap gap-2"><button type="button" onClick={discard} disabled={!hasLayoutChanges || controlsDisabled} className="inline-flex min-h-9 items-center gap-2 rounded-md border border-gray-300 px-3 py-2 text-sm disabled:opacity-40"><RotateCcw className="h-4 w-4" />Discard layout changes</button><button type="button" onClick={() => saveDraft()} disabled={!dirty || editorDisabled} className="inline-flex min-h-9 items-center gap-2 rounded-md border border-blue-600 px-3 py-2 text-sm font-medium text-blue-700 disabled:opacity-40">{saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}Save layout draft</button><button type="button" onClick={publish} disabled={!hasLayoutChanges || editorDisabled} className="inline-flex min-h-9 items-center gap-2 rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-40">{publishing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}Publish layouts</button></div>
        </header>
        {workspace.hasOtherDraftChanges && <div className="border-b border-blue-200 bg-blue-50 px-4 py-2 text-sm text-blue-900">This theme also has separate Theme Designer changes. Saving, publishing, or discarding here affects layouts only.</div>}
        {workspace.draftIsStale && <div role="alert" className="border-b border-amber-200 bg-amber-50 px-4 py-2 text-sm text-amber-900">The live theme changed after this layout draft started. Discard layout changes here, then resolve the separate Theme Designer draft before continuing.</div>}
        <LayoutDesignerWorkspace workspace={workspace} viewport="xl" updateWorkspace={updateWorkspace} disabled={editorDisabled} initialLayoutKey={searchParams.get('layout') || ''} initialAction={searchParams.get('action') || ''} onInitialActionHandled={handleInitialAction} />
    </div>
}

export default LayoutWorkspacePage
