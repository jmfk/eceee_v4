import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useParams } from 'react-router-dom'
import { Download, Loader2, Monitor, RotateCcw, Save, Send, Smartphone, Tablet, Undo2 } from 'lucide-react'

import { designerThemesApi } from '../api/designerThemes'
import DesignerNavbar from '../components/DesignerNavbar'
import SemanticThemeWorkspace from '../components/designer/SemanticThemeWorkspace'
import StatusBar from '../components/StatusBar'
import { useGlobalNotifications } from '../contexts/GlobalNotificationContext'
import { buildResolvedRenderModel } from '../rendering/directRender'

const DesignerThemeWorkspacePage = () => {
    const { themeId } = useParams()
    const { addNotification } = useGlobalNotifications()
    const [workspace, setWorkspace] = useState(null)
    const [viewport, setViewport] = useState('desktop')
    const [mobilePane, setMobilePane] = useState('edit')
    const [preview, setPreview] = useState({ css: '', fontUrl: '' })
    const [loading, setLoading] = useState(true)
    const [saving, setSaving] = useState(false)
    const [publishing, setPublishing] = useState(false)
    const [restoring, setRestoring] = useState(false)
    const [dirty, setDirty] = useState(false)
    const [error, setError] = useState('')
    const [exporting, setExporting] = useState(false)
    const [exportProgress, setExportProgress] = useState(null)
    const [placeholderDrafts, setPlaceholderDrafts] = useState({})
    const previewRequestRef = useRef(0)

    const payload = useMemo(() => workspace ? ({
        draftVersion: workspace.draftVersion,
        name: workspace.name,
        description: workspace.description || '',
        colors: Object.fromEntries(workspace.colors.map((color) => [color.name, color.value])),
        fonts: workspace.fonts.filter((font) => font.family.trim()).map((font) => ({ family: font.family, variants: font.variants, display: font.display })),
        typography: workspace.typography.map((row) => ({ groupIndex: row.groupIndex, element: row.element, values: row.values })),
        spacing: workspace.spacing.map((row) => ({ scope: row.scope, groupIndex: row.groupIndex, element: row.element, part: row.part, breakpoint: row.breakpoint, values: row.values })),
    }) : null, [workspace])
    const previewPayload = useMemo(() => payload ? ({
        draftVersion: payload.draftVersion,
        colors: payload.colors,
        fonts: payload.fonts,
        typography: payload.typography,
        spacing: payload.spacing,
    }) : null, [payload])

    const loadWorkspace = useCallback(async () => {
        setLoading(true)
        setError('')
        try {
            const result = await designerThemesApi.workspace(themeId)
            setWorkspace(result)
            setDirty(false)
        } catch (err) {
            setError(err.message || 'Unable to open this Designer theme.')
        } finally {
            setLoading(false)
        }
    }, [themeId])

    useEffect(() => { loadWorkspace() }, [loadWorkspace])

    useEffect(() => {
        if (!previewPayload) return undefined
        const requestId = previewRequestRef.current + 1
        previewRequestRef.current = requestId
        const timer = window.setTimeout(async () => {
            try {
                const result = await designerThemesApi.preview(themeId, previewPayload)
                if (requestId !== previewRequestRef.current) return
                setPreview({ css: result.css || '', fontUrl: result.fontUrl || '' })
            } catch (err) {
                addNotification({ type: 'error', message: err.message || 'Preview could not be updated' })
            }
        }, 350)
        return () => window.clearTimeout(timer)
    }, [previewPayload, themeId, addNotification])

    const updateWorkspace = (updater) => {
        setWorkspace((current) => updater(structuredClone(current)))
        setDirty(true)
    }

    const saveDraft = async ({ silent = false } = {}) => {
        if (!payload) return null
        if (!dirty) return workspace
        if (!workspace.name.trim()) {
            addNotification({ type: 'error', message: 'Theme name is required' })
            return null
        }
        setSaving(true)
        try {
            const result = await designerThemesApi.save(themeId, payload)
            setWorkspace(result)
            setDirty(false)
            if (!silent) addNotification({ type: 'success', message: 'Draft saved' })
            return result
        } catch (err) {
            addNotification({ type: 'error', message: err.message || 'Draft could not be saved' })
            return null
        } finally {
            setSaving(false)
        }
    }

    const publish = async () => {
        let current = workspace
        if (dirty) current = await saveDraft({ silent: true })
        if (!current || !current.hasDraftChanges) return
        if (!window.confirm('Publish every saved Designer draft change to the live theme now?')) return
        setPublishing(true)
        try {
            const result = await designerThemesApi.publish(themeId, current.draftVersion)
            setWorkspace(result)
            setDirty(false)
            addNotification({ type: 'success', message: 'Designer draft published atomically' })
        } catch (err) {
            addNotification({ type: 'error', message: err.message || 'Draft could not be published' })
        } finally {
            setPublishing(false)
        }
    }

    const discardDraft = async () => {
        if (!window.confirm('Discard all saved and unsaved Designer draft changes?')) return
        try {
            const result = await designerThemesApi.discard(themeId, workspace.draftVersion)
            setWorkspace(result)
            setDirty(false)
            addNotification({ type: 'success', message: 'Designer draft discarded' })
        } catch (err) {
            addNotification({ type: 'error', message: err.message || 'Draft could not be discarded' })
        }
    }

    const undoPublish = async () => {
        if (!window.confirm('Restore the theme version from immediately before the latest Designer publish?')) return
        setRestoring(true)
        try {
            const result = await designerThemesApi.undo(themeId, workspace.draftVersion, workspace.liveSyncVersion)
            setWorkspace(result)
            setDirty(false)
            addNotification({ type: 'success', message: 'Latest Designer publish restored' })
        } catch (err) {
            addNotification({ type: 'error', message: err.message || 'Published revision could not be restored' })
        } finally {
            setRestoring(false)
        }
    }

    const replaceAsset = async (asset, file) => {
        if (!file) return
        try {
            const current = dirty ? await saveDraft({ silent: true }) : workspace
            if (!current) return
            const result = await designerThemesApi.replaceAsset(themeId, asset.assetKey, file, current.draftVersion)
            setWorkspace(result)
            setDirty(false)
            addNotification({ type: 'success', message: `${asset.displayName} replaced` })
        } catch (err) { addNotification({ type: 'error', message: err.message || 'Asset upload failed' }) }
    }

    const createPlaceholder = async (asset) => {
        const draft = placeholderDrafts[asset.assetKey] || {}
        const width = Number(draft.width || asset.requiredWidth)
        const height = Number(draft.height || asset.requiredHeight)
        if (!width || !height) {
            addNotification({ type: 'error', message: 'Enter the exact full-size width and height first' })
            return
        }
        try {
            const current = dirty ? await saveDraft({ silent: true }) : workspace
            if (!current) return
            const result = await designerThemesApi.createPlaceholder(themeId, {
                assetKey: asset.assetKey,
                displayName: draft.displayName || asset.displayName,
                width,
                height,
                draftVersion: current.draftVersion,
            })
            setWorkspace(result)
            setDirty(false)
            addNotification({ type: 'success', message: `${draft.displayName || asset.displayName} placeholder created` })
        } catch (err) { addNotification({ type: 'error', message: err.message || 'Placeholder could not be created' }) }
    }

    const savePreviewContent = async (viewId, texts) => {
        try {
            const current = dirty ? await saveDraft({ silent: true }) : workspace
            if (!current) return null
            const result = await designerThemesApi.savePreviewContent(themeId, viewId, texts, current.draftVersion)
            setWorkspace(result)
            setDirty(false)
            return result
        } catch (err) {
            addNotification({ type: 'error', message: err.message || 'Preview content could not be saved' })
            throw err
        }
    }

    const loadPageContent = useCallback(async (source) => {
        try {
            const result = await designerThemesApi.loadPreviewPage(themeId, source.id)
            return await buildResolvedRenderModel({
                resolved: source,
                page: result.page,
                version: result.version,
                rawInheritance: result.inheritance,
            })
        } catch (err) {
            addNotification({ type: 'error', message: err.message || 'Page content could not be loaded' })
            throw err
        }
    }, [addNotification, themeId])

    const loadObjectContent = useCallback(async (source) => {
        try {
            const result = await designerThemesApi.loadPreviewObject(themeId, source.id)
            return {
                layout: 'main_layout',
                slots: result.version?.widgets || {},
                context: {
                    objectId: result.object?.id,
                    objectData: result.version?.data || {},
                    objectType: result.objectType || {},
                },
            }
        } catch (err) {
            addNotification({ type: 'error', message: err.message || 'Object content could not be loaded' })
            throw err
        }
    }, [addNotification, themeId])

    const exportPackage = async () => {
        setExporting(true)
        try {
            let job = await designerThemesApi.createExport(themeId)
            setExportProgress(job.progress || { percent: 0, message: 'Starting export' })
            for (let attempt = 0; attempt < 60 && !job.downloadReady; attempt += 1) {
                await new Promise((resolve) => window.setTimeout(resolve, 1500))
                job = await designerThemesApi.getExport(job.id)
                setExportProgress(job.progress || null)
                if (job.status === 'failed') throw new Error(job.errors?.[0] || 'Designer export failed')
            }
            if (!job.downloadReady) throw new Error('Designer export is still processing. Try again shortly.')
            const download = await designerThemesApi.getExportDownload(job.id)
            window.location.assign(download.downloadUrl)
        } catch (err) { addNotification({ type: 'error', message: err.message || 'Designer export failed' }) }
        finally { setExporting(false); setExportProgress(null) }
    }

    const hasDraftChanges = dirty || workspace?.hasDraftChanges
    const themeNameMissing = !workspace?.name?.trim()
    const controlsDisabled = saving || publishing || restoring

    if (loading) return <div className="fixed inset-0 flex items-center justify-center bg-gray-50"><Loader2 className="h-8 w-8 animate-spin text-blue-600" /><span className="ml-3 text-gray-600">Loading Designer workspace…</span></div>

    if (error || !workspace) return <div className="fixed inset-0 flex flex-col bg-gray-50"><DesignerNavbar /><main className="m-auto max-w-lg p-6"><div role="alert" className="rounded-lg border border-red-200 bg-red-50 p-5 text-red-800"><h1 className="font-semibold">Designer workspace unavailable</h1><p className="mt-1 text-sm">{error}</p></div></main></div>

    return (
        <div className="fixed inset-0 flex flex-col bg-gray-50">
            <DesignerNavbar />
            <header className="flex flex-wrap items-center justify-between gap-3 border-b border-gray-200 bg-white px-4 py-3 sm:px-6">
                <div><h1 className="font-semibold text-gray-900">{workspace.name}</h1><p className="text-xs text-gray-500">Designer draft · live theme version {workspace.liveSyncVersion}</p></div>
                <div className="flex flex-wrap items-center gap-2">
                    <div className="hidden rounded-md border border-gray-300 p-1 sm:flex" aria-label="Preview size">{[
                        ['desktop', <Monitor className="h-4 w-4" />], ['tablet', <Tablet className="h-4 w-4" />], ['mobile', <Smartphone className="h-4 w-4" />],
                    ].map(([name, icon]) => <button type="button" key={name} onClick={() => setViewport(name)} aria-label={`${name} preview`} className={`rounded p-1.5 ${viewport === name ? 'bg-gray-200 text-gray-900' : 'text-gray-500'}`}>{icon}</button>)}</div>
                    <button type="button" onClick={exportPackage} disabled={exporting} title={exportProgress?.message} className="inline-flex items-center gap-2 rounded-md border border-gray-300 bg-white px-3 py-2 text-sm disabled:opacity-50">{exporting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}{exporting ? `Export ${exportProgress?.percent || 0}%` : 'Export'}</button>
                    <button type="button" onClick={undoPublish} disabled={!workspace.canUndo || hasDraftChanges || workspace.draftIsStale || controlsDisabled} title={hasDraftChanges ? 'Publish or discard draft changes before restoring' : 'Restore the version before the latest Designer publish'} className="inline-flex items-center gap-2 rounded-md border border-gray-300 bg-white px-3 py-2 text-sm disabled:opacity-40">{restoring ? <Loader2 className="h-4 w-4 animate-spin" /> : <Undo2 className="h-4 w-4" />}Undo publish</button>
                    <button type="button" onClick={discardDraft} disabled={(!hasDraftChanges && !workspace.draftIsStale) || controlsDisabled} className="inline-flex items-center gap-2 rounded-md border border-gray-300 bg-white px-3 py-2 text-sm disabled:opacity-40"><RotateCcw className="h-4 w-4" />Discard draft</button>
                    <button type="button" onClick={() => saveDraft()} disabled={!dirty || themeNameMissing || workspace.draftIsStale || controlsDisabled} className="inline-flex items-center gap-2 rounded-md border border-blue-600 bg-white px-3 py-2 text-sm font-medium text-blue-700 disabled:opacity-40">{saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}Save draft</button>
                    <button type="button" onClick={publish} disabled={!hasDraftChanges || themeNameMissing || workspace.draftIsStale || controlsDisabled} className="inline-flex items-center gap-2 rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-40">{publishing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}Publish changes</button>
                </div>
            </header>
            {workspace.draftIsStale && <div role="alert" className="border-b border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900 sm:px-6">The live theme changed after this draft was started. Discard the draft to reload the current live version before making or publishing more changes.</div>}
            <div className="flex border-b border-gray-200 bg-white lg:hidden"><button type="button" onClick={() => setMobilePane('edit')} className={`flex-1 px-4 py-2 text-sm ${mobilePane === 'edit' ? 'border-b-2 border-blue-600 font-medium' : ''}`}>Edit</button><button type="button" onClick={() => setMobilePane('preview')} className={`flex-1 px-4 py-2 text-sm ${mobilePane === 'preview' ? 'border-b-2 border-blue-600 font-medium' : ''}`}>Preview</button></div>
            <SemanticThemeWorkspace workspace={workspace} preview={preview} viewport={viewport} mobilePane={mobilePane} updateWorkspace={updateWorkspace} replaceAsset={replaceAsset} createPlaceholder={createPlaceholder} placeholderDrafts={placeholderDrafts} setPlaceholderDrafts={setPlaceholderDrafts} savePreviewContent={savePreviewContent} loadPageContent={loadPageContent} loadObjectContent={loadObjectContent} disabled={controlsDisabled} />
            <StatusBar customStatusContent={<span>{workspace.draftIsStale ? 'Draft is stale · discard to reload' : dirty ? 'Unsaved local draft changes' : workspace.hasDraftChanges ? 'Draft saved · not published' : 'Draft matches the live theme'}</span>} />
        </div>
    )
}

export default DesignerThemeWorkspacePage
