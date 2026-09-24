import { useEffect, useMemo, useRef, useState } from 'react'
import { Box, Check, Copy, FileText, Image as ImageIcon, Loader2, MousePointer2, Save, X } from 'lucide-react'

import { buildSemanticPreviewDocument } from './semanticPreview'

const typographyLabels = {
    fontFamily: 'Font family', fontSize: 'Size', fontWeight: 'Weight', fontStyle: 'Style',
    lineHeight: 'Line height', letterSpacing: 'Letter spacing',
}

const spacingLabels = {
    margin: 'Outer spacing', marginTop: 'Space above', marginRight: 'Space right', marginBottom: 'Space below', marginLeft: 'Space left',
    padding: 'Inner spacing', paddingTop: 'Inner top', paddingRight: 'Inner right', paddingBottom: 'Inner bottom', paddingLeft: 'Inner left',
}

const ValueFields = ({ values, fields, labels, onChange }) => (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2">
        {fields.map((field) => (
            <label key={field} className="text-xs font-medium text-gray-700">
                {labels[field] || field}
                <input value={values[field] || ''} onChange={(event) => onChange(field, event.target.value)} className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm" placeholder="Theme default" />
            </label>
        ))}
    </div>
)

const SemanticThemeWorkspace = ({
    workspace, preview, viewport, updateWorkspace, replaceAsset, createPlaceholder,
    placeholderDrafts, setPlaceholderDrafts, savePreviewContent, replacePreviewImage,
    importPreviewFromSite, disabled, mobilePane,
}) => {
    const initialViews = workspace.previewContent?.views || workspace.catalog.previewViews || []
    const [previewContent, setPreviewContent] = useState({ views: initialViews })
    const [viewId, setViewId] = useState(initialViews[0]?.id || '')
    const [selectedTarget, setSelectedTarget] = useState(null)
    const [previewDirty, setPreviewDirty] = useState(false)
    const [savingPreview, setSavingPreview] = useState(false)
    const [pendingImages, setPendingImages] = useState({})
    const [sourceSiteId, setSourceSiteId] = useState(workspace.contentSources?.[0]?.id || '')
    const [importingSite, setImportingSite] = useState(false)
    const iframeRef = useRef(null)
    const uploadRefs = useRef({})
    const previewImageInputRef = useRef(null)

    useEffect(() => {
        const views = workspace.previewContent?.views || workspace.catalog.previewViews || []
        setPreviewContent({ views })
        setViewId((current) => views.some((view) => view.id === current) ? current : views[0]?.id || '')
    }, [workspace.previewContent, workspace.catalog.previewViews])

    useEffect(() => {
        setSourceSiteId((current) => workspace.contentSources?.some((source) => String(source.id) === String(current))
            ? current
            : workspace.contentSources?.[0]?.id || '')
    }, [workspace.contentSources])

    useEffect(() => {
        const receive = (event) => {
            if (event.source !== iframeRef.current?.contentWindow || event.data?.source !== 'eceee-designer-preview') return
            const target = { id: event.data.targetId, kind: event.data.kind, label: event.data.label, text: event.data.text || '' }
            setSelectedTarget(target)
            if (event.data.action === 'contentChange' && target.kind === 'element') {
                setPreviewContent((current) => ({
                    views: current.views.map((view) => view.id === viewId
                        ? { ...view, texts: { ...(view.texts || {}), [target.id]: target.text } }
                        : view),
                }))
                setPreviewDirty(true)
            }
        }
        window.addEventListener('message', receive)
        return () => window.removeEventListener('message', receive)
    }, [viewId])

    const selectedView = previewContent.views.find((view) => view.id === viewId) || previewContent.views[0]
    const previewWorkspace = useMemo(() => ({ ...workspace, previewContent }), [workspace, previewContent])
    const previewDocument = useMemo(() => buildSemanticPreviewDocument({
        workspace: previewWorkspace, css: preview.css, fontUrl: preview.fontUrl, viewId, viewport,
    }), [previewWorkspace, preview, viewId, viewport])

    const selectedGroupIndex = Number(selectedTarget?.id?.match(/^group:(\d+)/)?.[1])
    const selectedGroup = Number.isInteger(selectedGroupIndex)
        ? workspace.catalog.designGroups.find((group) => group.groupIndex === selectedGroupIndex)
        : null
    const targetTypography = workspace.typography.map((row, index) => ({ row, index })).filter(({ row }) => row.targetId === selectedTarget?.id)
    const targetSpacing = workspace.spacing.map((row, index) => ({ row, index })).filter(({ row }) => row.targetId === selectedTarget?.id)
    const selectedAsset = selectedTarget?.id?.startsWith('asset:') ? workspace.assets.find((asset) => `asset:${asset.assetKey}` === selectedTarget.id) : null
    const relevantColors = (selectedGroup?.colorNames || []).map((name) => ({ name, index: workspace.colors.findIndex((color) => color.name === name) })).filter(({ index }) => index >= 0)
    const previewText = selectedTarget?.kind === 'element'
        ? selectedView?.texts?.[selectedTarget.id] ?? selectedTarget.text ?? ''
        : ''

    const updatePreviewText = (value) => {
        setSelectedTarget((current) => ({ ...current, text: value }))
        setPreviewContent((current) => ({
            views: current.views.map((view) => view.id === viewId
                ? { ...view, texts: { ...(view.texts || {}), [selectedTarget.id]: value } }
                : view),
        }))
        setPreviewDirty(true)
    }

    const choosePreviewImage = (file) => {
        if (!file || !selectedTarget) return
        const reader = new FileReader()
        reader.onload = () => {
            setPreviewContent((current) => ({
                views: current.views.map((view) => view.id === viewId
                    ? { ...view, images: { ...(view.images || {}), [selectedTarget.id]: { url: reader.result, filename: file.name } } }
                    : view),
            }))
            setPendingImages((current) => ({ ...current, [selectedTarget.id]: { file, viewId } }))
            setPreviewDirty(true)
        }
        reader.readAsDataURL(file)
    }

    const saveCurrentPreview = async () => {
        if (!selectedView || !previewDirty) return
        setSavingPreview(true)
        try {
            let saved = previewContent
            for (const [targetId, pending] of Object.entries(pendingImages)) {
                const response = await replacePreviewImage(pending.viewId, targetId, pending.file)
                saved = response.previewContent
            }
            for (const view of previewContent.views) {
                const response = await savePreviewContent(view.id, view.texts || {})
                saved = response.previewContent || saved
            }
            setPreviewContent(saved)
            setPendingImages({})
            setPreviewDirty(false)
        } finally {
            setSavingPreview(false)
        }
    }

    const copySiteContent = async () => {
        if (!sourceSiteId || !importPreviewFromSite) return
        if (!window.confirm('Replace saved and unsaved preview content with published content from this site?')) return
        setImportingSite(true)
        try {
            const result = await importPreviewFromSite(sourceSiteId)
            const saved = result.previewContent || { views: [] }
            setPreviewContent(saved)
            setViewId(saved.views?.[0]?.id || '')
            setSelectedTarget(null)
            setPendingImages({})
            setPreviewDirty(false)
        } finally {
            setImportingSite(false)
        }
    }

    const assetEditor = selectedAsset && (
        <section className="space-y-3 border-t border-gray-200 pt-4">
            <div><h3 className="font-medium text-gray-900">Theme image</h3><p className="text-xs text-gray-500">This image belongs to the theme and changes with the theme draft.</p></div>
            {selectedAsset.url ? <img src={selectedAsset.url} alt="" className="h-36 w-full rounded-md border border-gray-200 bg-gray-50 object-contain" /> : <div className="flex h-36 items-center justify-center rounded-md border border-dashed border-gray-300 bg-gray-50 text-sm text-gray-500">Placeholder image</div>}
            <div className="text-xs text-gray-600"><p>{selectedAsset.filename || 'No file yet'}</p><p>{selectedAsset.requiredWidth || selectedAsset.recommendedWidth || '?'} × {selectedAsset.requiredHeight || '?'} px · {selectedAsset.dpr || 2}x</p></div>
            {selectedAsset.kind === 'design-group' && !selectedAsset.url && <div className="grid gap-2"><input aria-label={`${selectedAsset.displayName} placeholder name`} value={placeholderDrafts[selectedAsset.assetKey]?.displayName ?? selectedAsset.displayName} onChange={(event) => setPlaceholderDrafts((current) => ({ ...current, [selectedAsset.assetKey]: { ...current[selectedAsset.assetKey], displayName: event.target.value } }))} className="rounded-md border border-gray-300 px-2 py-1.5 text-sm" /><div className="grid grid-cols-2 gap-2"><input aria-label={`${selectedAsset.displayName} placeholder width`} type="number" min="16" max="8000" value={placeholderDrafts[selectedAsset.assetKey]?.width ?? selectedAsset.requiredWidth ?? ''} onChange={(event) => setPlaceholderDrafts((current) => ({ ...current, [selectedAsset.assetKey]: { ...current[selectedAsset.assetKey], width: event.target.value } }))} placeholder="Width px" className="rounded-md border border-gray-300 px-2 py-1.5 text-sm" /><input aria-label={`${selectedAsset.displayName} placeholder height`} type="number" min="16" max="8000" value={placeholderDrafts[selectedAsset.assetKey]?.height ?? selectedAsset.requiredHeight ?? ''} onChange={(event) => setPlaceholderDrafts((current) => ({ ...current, [selectedAsset.assetKey]: { ...current[selectedAsset.assetKey], height: event.target.value } }))} placeholder="Height px" className="rounded-md border border-gray-300 px-2 py-1.5 text-sm" /></div><button type="button" onClick={() => createPlaceholder(selectedAsset)} className="rounded-md border border-gray-300 px-3 py-2 text-sm">Create placeholder</button></div>}
            <input ref={(node) => { uploadRefs.current[selectedAsset.assetKey] = node }} type="file" accept="image/png,image/jpeg,image/gif,image/webp,image/svg+xml" onChange={(event) => replaceAsset(selectedAsset, event.target.files?.[0])} className="sr-only" />
            <button type="button" onClick={() => uploadRefs.current[selectedAsset.assetKey]?.click()} className="w-full rounded-md bg-blue-600 px-3 py-2 text-sm font-medium text-white">Replace theme image</button>
        </section>
    )

    return (
        <main className="grid min-h-0 flex-1 lg:grid-cols-[360px_minmax(0,1fr)]">
            <section className={`${mobilePane === 'preview' ? 'hidden' : 'flex'} min-h-0 min-w-0 flex-col border-r border-gray-200 bg-white lg:flex`}>
                <fieldset disabled={disabled || savingPreview} className="min-h-0 flex-1 overflow-y-auto p-4">
                    {!selectedTarget ? (
                        <div className="flex h-full flex-col items-center justify-center rounded-lg border border-dashed border-gray-300 p-6 text-center">
                            <MousePointer2 className="mb-3 h-8 w-8 text-gray-400" />
                            <h2 className="font-semibold text-gray-900">Select something on the page</h2>
                            <p className="mt-1 text-sm text-gray-500">Click text, an image, or another visible element to edit only the values that apply to it.</p>
                        </div>
                    ) : (
                        <div className="space-y-5">
                            <div className="flex items-start gap-3"><div className="min-w-0 flex-1"><p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Selected element</p><h2 className="truncate text-xl font-semibold text-gray-900">{selectedTarget.label}</h2></div><button type="button" aria-label="Close selection" onClick={() => setSelectedTarget(null)} className="rounded-md p-1 text-gray-500 hover:bg-gray-100"><X className="h-5 w-5" /></button></div>
                            {selectedTarget.kind === 'element' && <section className="space-y-2"><label className="text-sm font-medium text-gray-900" htmlFor="preview-text">Preview text</label><textarea id="preview-text" value={previewText} onChange={(event) => updatePreviewText(event.target.value)} rows={5} className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm" /><p className="text-xs text-gray-500">This changes demo content only, not published page content.</p></section>}
                            {selectedTarget.kind === 'previewImage' && <section className="space-y-3"><div><h3 className="font-medium text-gray-900">Preview image</h3><p className="text-xs text-gray-500">Choose temporary content for this preview view.</p></div><input ref={previewImageInputRef} type="file" accept="image/png,image/jpeg,image/gif,image/webp,image/svg+xml" onChange={(event) => choosePreviewImage(event.target.files?.[0])} className="sr-only" /><button type="button" onClick={() => previewImageInputRef.current?.click()} className="inline-flex w-full items-center justify-center gap-2 rounded-md border border-gray-300 px-3 py-2 text-sm font-medium"><ImageIcon className="h-4 w-4" />Choose preview image</button></section>}
                            {targetTypography.map(({ row, index }) => <section key={`type-${index}`} className="space-y-3 border-t border-gray-200 pt-4"><h3 className="font-medium text-gray-900">Typography</h3><ValueFields values={row.values} fields={workspace.constraints.editableTypographyProperties} labels={typographyLabels} onChange={(field, value) => updateWorkspace((next) => { next.typography[index].values[field] = value; return next })} /></section>)}
                            {targetSpacing.map(({ row, index }) => <section key={`space-${index}`} className="space-y-3 border-t border-gray-200 pt-4"><h3 className="font-medium text-gray-900">Spacing{row.breakpoint ? ` · ${row.breakpoint}` : ''}</h3><ValueFields values={row.values} fields={workspace.constraints.editableSpacingProperties} labels={spacingLabels} onChange={(field, value) => updateWorkspace((next) => { next.spacing[index].values[field] = value; return next })} /></section>)}
                            {relevantColors.length > 0 && <section className="space-y-3 border-t border-gray-200 pt-4"><h3 className="font-medium text-gray-900">Colors used here</h3>{relevantColors.map(({ name, index }) => <label key={name} className="flex items-center gap-3"><input type="color" value={/^#[0-9a-f]{6}$/i.test(workspace.colors[index].value) ? workspace.colors[index].value : '#000000'} onChange={(event) => updateWorkspace((next) => { next.colors[index].value = event.target.value; return next })} className="h-10 w-12 rounded border border-gray-300" /><span className="min-w-0 flex-1 text-sm font-medium">{name}</span><input aria-label={`${name} value`} value={workspace.colors[index].value} onChange={(event) => updateWorkspace((next) => { next.colors[index].value = event.target.value; return next })} className="w-28 rounded-md border border-gray-300 px-2 py-1.5 font-mono text-xs" /></label>)}</section>}
                            {assetEditor}
                            {!targetTypography.length && !targetSpacing.length && !relevantColors.length && !selectedAsset && !['element', 'previewImage'].includes(selectedTarget.kind) && <p className="rounded-lg border border-dashed border-gray-300 p-4 text-sm text-gray-500">Choose a more specific text or image inside this area to edit its details.</p>}
                        </div>
                    )}
                </fieldset>
            </section>
            <section className={`${mobilePane === 'edit' ? 'hidden' : 'flex'} min-h-0 flex-col bg-gray-100 p-3 lg:flex lg:p-5`}>
                <div className="mb-3 flex flex-wrap items-center gap-2">
                    <nav className="flex min-w-0 flex-1 gap-1 overflow-x-auto" aria-label="Preview views">{previewContent.views.map((view) => <button type="button" key={view.id} onClick={() => { setViewId(view.id); setSelectedTarget(null) }} className={`inline-flex shrink-0 items-center gap-2 rounded-md px-3 py-2 text-sm font-medium ${view.id === viewId ? 'bg-white text-blue-700 shadow-sm ring-1 ring-gray-200' : 'text-gray-600 hover:bg-white/70'}`}>{view.kind === 'object' ? <Box className="h-4 w-4" /> : <FileText className="h-4 w-4" />}{view.label}</button>)}</nav>
                    {(workspace.contentSources || []).length > 0 && <div className="flex items-center gap-1 rounded-md border border-gray-300 bg-white p-1"><label htmlFor="preview-source-site" className="sr-only">Demo content from site</label><select id="preview-source-site" value={sourceSiteId} onChange={(event) => setSourceSiteId(event.target.value)} disabled={disabled || importingSite} className="max-w-44 rounded border-0 bg-transparent px-2 py-1 text-sm text-gray-700"><option value="">Choose site</option>{workspace.contentSources.map((source) => <option key={source.id} value={source.id}>{source.label}</option>)}</select><button type="button" onClick={copySiteContent} disabled={!sourceSiteId || disabled || importingSite} className="inline-flex items-center gap-1.5 rounded bg-gray-100 px-2.5 py-1.5 text-sm font-medium text-gray-800 hover:bg-gray-200 disabled:opacity-50">{importingSite ? <Loader2 className="h-4 w-4 animate-spin" /> : <Copy className="h-4 w-4" />}Use site content</button></div>}
                    {previewDirty && <button type="button" onClick={saveCurrentPreview} disabled={savingPreview} className="inline-flex items-center gap-2 rounded-md bg-blue-600 px-3 py-2 text-sm font-medium text-white disabled:opacity-50">{savingPreview ? <Check className="h-4 w-4" /> : <Save className="h-4 w-4" />}{savingPreview ? 'Saving…' : 'Save preview content'}</button>}
                    <span className="text-xs capitalize text-gray-500">{viewport}</span>
                </div>
                <iframe ref={iframeRef} title="Live theme preview" sandbox="allow-scripts" srcDoc={previewDocument} className="min-h-0 flex-1 rounded-lg border border-gray-300 bg-white shadow-sm" />
            </section>
        </main>
    )
}

export default SemanticThemeWorkspace
