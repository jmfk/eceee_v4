import { useEffect, useMemo, useRef, useState } from 'react'
import { Box, Check, ChevronDown, Copy, FileText, Image as ImageIcon, Loader2, Save } from 'lucide-react'

import { buildSemanticPreviewDocument } from './semanticPreview'

const typographyLabels = {
    fontFamily: 'Font family', fontSize: 'Size', fontWeight: 'Weight', fontStyle: 'Style',
    lineHeight: 'Line height', letterSpacing: 'Letter spacing',
}

const spacingLabels = {
    margin: 'Outer spacing', marginTop: 'Space above', marginRight: 'Space right', marginBottom: 'Space below', marginLeft: 'Space left',
    padding: 'Inner spacing', paddingTop: 'Inner top', paddingRight: 'Inner right', paddingBottom: 'Inner bottom', paddingLeft: 'Inner left',
}

const defaultBreakpoints = { xs: 0, sm: 640, md: 768, lg: 1024, xl: 1280 }

const assetProperty = (asset) => asset.property || asset.assetKey?.split(':').at(-1)

const humanize = (value) => String(value || '')
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replace(/[-_]+/g, ' ')
    .replace(/^./, (character) => character.toUpperCase())

const listNames = (names) => names.length < 2
    ? names.join('')
    : `${names.slice(0, -1).join(', ')} and ${names.at(-1)}`

const imageBreakpointUsage = (asset, family, breakpoints) => {
    if (!asset.breakpoint) return null
    const sizes = Object.entries({ ...defaultBreakpoints, ...(breakpoints || {}) })
        .map(([name, width]) => ({ name: name.toUpperCase(), key: name, width: Number(width) }))
        .filter((size) => Number.isFinite(size.width))
        .sort((left, right) => left.width - right.width)
    const start = sizes.find((size) => size.key === asset.breakpoint)
    if (!start) return { badge: asset.breakpoint.toUpperCase(), summary: `Configured for the ${asset.breakpoint.toUpperCase()} theme size.`, range: '' }
    const familyStarts = new Set(family.map((candidate) => candidate.breakpoint))
    const next = sizes.find((size) => size.width > start.width && familyStarts.has(size.key))
    const effectiveSizes = sizes.filter((size) => size.width >= start.width && (!next || size.width < next.width))
    const allSizes = effectiveSizes.length === sizes.length
    const badge = allSizes
        ? 'All sizes'
        : next
            ? start.width === 0 ? `Below ${next.width}px` : `${start.width}–${next.width - 1}px`
            : `${start.width}px+`
    const summary = allSizes
        ? `Used for all theme sizes: ${listNames(effectiveSizes.map((size) => size.name))}.`
        : `Used for theme ${effectiveSizes.length === 1 ? 'size' : 'sizes'}: ${listNames(effectiveSizes.map((size) => size.name))}.`
    const range = allSizes
        ? 'Shown at every screen width.'
        : next
            ? start.width === 0 ? `Shown on screens narrower than ${next.width} px.` : `Shown from ${start.width} px to ${next.width - 1} px wide.`
            : `Shown from ${start.width} px wide and up.`
    return { badge, summary, range }
}

const imageAspectKey = (asset) => asset.kind === 'design-group'
    ? `design:${asset.groupIndex}:${asset.part}:${assetProperty(asset)}`
    : asset.assetKey

const imageAspectsFor = (workspace) => {
    const aspects = new Map()
    ;(workspace.assets || [])
        .filter((asset) => asset.replaceable !== false && ['design-group', 'preview', 'site-icon'].includes(asset.kind))
        .forEach((asset) => {
            const key = imageAspectKey(asset)
            if (!aspects.has(key)) {
                const group = asset.kind === 'design-group'
                    ? workspace.catalog.designGroups.find((candidate) => candidate.groupIndex === asset.groupIndex)
                    : null
                const part = group?.parts?.find((candidate) => candidate.part === asset.part)
                const details = asset.kind === 'design-group'
                    ? [part?.label || humanize(asset.part), humanize(assetProperty(asset))].filter(Boolean)
                    : []
                aspects.set(key, {
                    key,
                    label: group?.label || asset.displayName,
                    details: [...new Set(details)].join(' · '),
                    assets: [],
                })
            }
            aspects.get(key).assets.push(asset)
        })
    return [...aspects.values()]
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
    const [viewId, setViewId] = useState(
        initialViews.find((view) => view.isSourceHomepage)?.id
        || initialViews.find((view) => view.referenceHtml)?.id
        || initialViews[0]?.id
        || '',
    )
    const [selectedTarget, setSelectedTarget] = useState(null)
    const [selectionExpanded, setSelectionExpanded] = useState(true)
    const [workspaceView, setWorkspaceView] = useState('preview')
    const [selectedImageAspectKey, setSelectedImageAspectKey] = useState('')
    const [previewDirty, setPreviewDirty] = useState(false)
    const [savingPreview, setSavingPreview] = useState(false)
    const [pendingImages, setPendingImages] = useState({})
    const [sourceSiteId, setSourceSiteId] = useState(workspace.contentSources?.[0]?.id || '')
    const [importingSite, setImportingSite] = useState(false)
    const iframeRef = useRef(null)
    const previewFrameRef = useRef(null)
    const uploadRefs = useRef({})
    const previewImageInputRef = useRef(null)
    const [previewFrameWidth, setPreviewFrameWidth] = useState(1280)

    useEffect(() => {
        const views = workspace.previewContent?.views || workspace.catalog.previewViews || []
        setPreviewContent({ views })
        setViewId((current) => views.some((view) => view.id === current)
            ? current
            : views.find((view) => view.isSourceHomepage)?.id
                || views.find((view) => view.referenceHtml)?.id
                || views[0]?.id
                || '')
    }, [workspace.previewContent, workspace.catalog.previewViews])

    useEffect(() => {
        setSourceSiteId((current) => workspace.contentSources?.some((source) => String(source.id) === String(current))
            ? current
            : workspace.contentSources?.[0]?.id || '')
    }, [workspace.contentSources])

    useEffect(() => {
        if (!previewFrameRef.current || typeof ResizeObserver === 'undefined') return undefined
        const observer = new ResizeObserver(([entry]) => {
            if (entry.contentRect.width > 0) setPreviewFrameWidth(entry.contentRect.width)
        })
        observer.observe(previewFrameRef.current)
        return () => observer.disconnect()
    }, [])

    useEffect(() => {
        const receive = (event) => {
            if (event.source !== iframeRef.current?.contentWindow || event.data?.source !== 'eceee-designer-preview') return
            const alternatives = Array.isArray(event.data.alternatives)
                ? event.data.alternatives.filter((option) => option?.id && option?.label).map((option) => ({
                    id: option.id,
                    kind: option.kind,
                    label: option.label,
                    text: option.text || '',
                    editable: option.editable !== false,
                }))
                : []
            const target = {
                id: event.data.targetId,
                kind: event.data.kind,
                label: event.data.label,
                text: event.data.text || '',
                editable: event.data.editable !== false,
                alternatives,
            }
            if (target.kind === 'asset') {
                const asset = workspace.assets.find((candidate) => `asset:${candidate.assetKey}` === target.id)
                if (asset) {
                    setSelectedImageAspectKey(imageAspectKey(asset))
                    setSelectedTarget(target)
                    setSelectionExpanded(true)
                    return
                }
            }
            if (event.data.action === 'contentChange' && target.kind === 'element') {
                setSelectedTarget((current) => current?.id === target.id ? { ...current, text: target.text } : current)
                setPreviewContent((current) => ({
                    views: current.views.map((view) => view.id === viewId
                        ? { ...view, texts: { ...(view.texts || {}), [target.id]: target.text } }
                        : view),
                }))
                setPreviewDirty(true)
                return
            }
            setSelectedTarget(target)
            setSelectionExpanded(true)
        }
        window.addEventListener('message', receive)
        return () => window.removeEventListener('message', receive)
    }, [viewId, workspace.assets])

    const selectedView = previewContent.views.find((view) => view.id === viewId) || previewContent.views[0]
    const previewWorkspace = useMemo(() => ({ ...workspace, previewContent }), [workspace, previewContent])
    const imageAspects = useMemo(() => imageAspectsFor(workspace), [workspace])
    const selectedImageAspect = imageAspects.find((aspect) => aspect.key === selectedImageAspectKey) || imageAspects[0]

    useEffect(() => {
        if (selectedImageAspect && selectedImageAspect.key !== selectedImageAspectKey) {
            setSelectedImageAspectKey(selectedImageAspect.key)
        }
    }, [selectedImageAspect, selectedImageAspectKey])

    const previewDocument = useMemo(() => buildSemanticPreviewDocument({
        workspace: previewWorkspace, css: preview.css, fontUrl: preview.fontUrl, viewId, viewport,
    }), [previewWorkspace, preview, viewId, viewport])

    const selectedLayout = workspace.catalog.layouts.find((layout) => layout.key === selectedView?.layout)
        || workspace.catalog.layouts[0]
    const primarySlot = (selectedLayout?.slots || []).find((slot) => ['main', 'content', 'body', 'landing_page'].includes(slot.name))?.name
        || selectedLayout?.slots?.[0]?.name || 'main'
    const previewImageTarget = selectedView
        ? { id: `preview:${selectedView.id}:image:${primarySlot}`, kind: 'previewImage', label: 'Page content image' }
        : null
    const previewCanvasWidth = viewport === 'mobile' ? 390 : viewport === 'tablet' ? 768 : 1280
    const previewScale = Math.min(1, previewFrameWidth / previewCanvasWidth)
    const previewOffset = Math.max(0, (previewFrameWidth - previewCanvasWidth * previewScale) / 2)

    const selectedGroupIndex = Number(selectedTarget?.id?.match(/^group:(\d+)/)?.[1])
    const selectedGroup = Number.isInteger(selectedGroupIndex)
        ? workspace.catalog.designGroups.find((group) => group.groupIndex === selectedGroupIndex)
        : null
    const targetTypography = workspace.typography.map((row, index) => ({ row, index })).filter(({ row }) => (
        selectedTarget?.kind === 'group' && selectedGroup
            ? row.groupIndex === selectedGroup.groupIndex
            : row.targetId === selectedTarget?.id
    ))
    const targetSpacing = workspace.spacing.map((row, index) => ({ row, index })).filter(({ row }) => (
        selectedTarget?.kind === 'group' && selectedGroup
            ? row.groupIndex === selectedGroup.groupIndex
            : row.targetId === selectedTarget?.id
    ))
    const relevantColors = (selectedGroup?.colorNames || []).map((name) => ({ name, index: workspace.colors.findIndex((color) => color.name === name) })).filter(({ index }) => index >= 0)
    const previewText = selectedTarget?.kind === 'element'
        ? selectedView?.texts?.[selectedTarget.id] ?? selectedTarget.text ?? ''
        : ''

    const chooseTargetAlternative = (alternative) => {
        setSelectedTarget((current) => ({ ...alternative, alternatives: current?.alternatives || [] }))
        setSelectionExpanded(true)
        iframeRef.current?.contentWindow?.postMessage({
            source: 'eceee-designer-host',
            action: 'selectTarget',
            targetId: alternative.id,
        }, '*')
    }

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

    const themeImageEditor = selectedImageAspect && (
        <section className="space-y-4">
            <div><p className="text-xs font-semibold uppercase tracking-wide text-blue-700">Theme image</p><h2 className="mt-1 text-lg font-semibold text-gray-900">{selectedImageAspect.label}</h2>{selectedImageAspect.details && <p className="mt-1 text-sm text-gray-500">{selectedImageAspect.details}</p>}<p className="mt-2 text-sm text-gray-600">View and replace every size and variation used here.</p></div>
            <div className="grid gap-4">
                {selectedImageAspect.assets.map((asset) => {
                    const usage = imageBreakpointUsage(asset, selectedImageAspect.assets, workspace.breakpoints)
                    return (
                    <article key={asset.assetKey} className="space-y-3 rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
                        <div className="flex items-start justify-between gap-2"><div className="min-w-0"><h4 className="truncate text-sm font-medium text-gray-900">{asset.displayName}</h4><p className="truncate text-xs text-gray-500">{asset.filename || 'No file yet'}</p></div>{usage && <span className="shrink-0 rounded bg-blue-50 px-2 py-1 text-xs font-semibold text-blue-700">{usage.badge}</span>}</div>
                        {asset.url ? <img src={asset.url} alt="" className="h-32 w-full rounded-md border border-gray-200 bg-gray-50 object-contain" /> : <div className="flex h-32 items-center justify-center rounded-md border border-dashed border-gray-300 bg-gray-50 text-sm text-gray-500">Placeholder image</div>}
                        {usage && <div className="rounded-md bg-gray-50 px-3 py-2"><p className="text-sm font-medium text-gray-800">{usage.summary}</p><p className="mt-0.5 text-xs text-gray-600">{usage.range}</p></div>}
                        <p className="text-xs text-gray-600">{asset.requiredWidth || asset.recommendedWidth || '?'} × {asset.requiredHeight || '?'} px · {asset.dpr || 2}x</p>
                        {asset.kind === 'design-group' && !asset.url && <div className="grid gap-2"><input aria-label={`${asset.displayName} placeholder name`} value={placeholderDrafts[asset.assetKey]?.displayName ?? asset.displayName} onChange={(event) => setPlaceholderDrafts((current) => ({ ...current, [asset.assetKey]: { ...current[asset.assetKey], displayName: event.target.value } }))} className="rounded-md border border-gray-300 px-2 py-1.5 text-sm" /><div className="grid grid-cols-2 gap-2"><input aria-label={`${asset.displayName} placeholder width`} type="number" min="16" max="8000" value={placeholderDrafts[asset.assetKey]?.width ?? asset.requiredWidth ?? ''} onChange={(event) => setPlaceholderDrafts((current) => ({ ...current, [asset.assetKey]: { ...current[asset.assetKey], width: event.target.value } }))} placeholder="Width px" className="rounded-md border border-gray-300 px-2 py-1.5 text-sm" /><input aria-label={`${asset.displayName} placeholder height`} type="number" min="16" max="8000" value={placeholderDrafts[asset.assetKey]?.height ?? asset.requiredHeight ?? ''} onChange={(event) => setPlaceholderDrafts((current) => ({ ...current, [asset.assetKey]: { ...current[asset.assetKey], height: event.target.value } }))} placeholder="Height px" className="rounded-md border border-gray-300 px-2 py-1.5 text-sm" /></div><button type="button" onClick={() => createPlaceholder(asset)} className="rounded-md border border-gray-300 px-3 py-2 text-sm">Create placeholder</button></div>}
                        <input ref={(node) => { uploadRefs.current[asset.assetKey] = node }} type="file" accept="image/png,image/jpeg,image/gif,image/webp,image/svg+xml" onChange={(event) => replaceAsset(asset, event.target.files?.[0])} className="sr-only" />
                        <button type="button" aria-label={`Replace ${asset.displayName}`} onClick={() => uploadRefs.current[asset.assetKey]?.click()} className="w-full rounded-md bg-blue-600 px-3 py-2 text-sm font-medium text-white">Replace theme image</button>
                    </article>
                    )
                })}
            </div>
        </section>
    )

    const previewOptions = (
        <div className="space-y-6">
            {previewImageTarget && <section className="space-y-2"><h3 className="text-xs font-semibold uppercase tracking-wide text-gray-500">Preview content</h3><button type="button" onClick={() => { setSelectedTarget(previewImageTarget); setSelectionExpanded(true) }} className="inline-flex w-full items-center gap-2 rounded-lg border border-gray-200 px-3 py-2 text-left text-sm font-medium text-gray-900 hover:bg-gray-50"><ImageIcon className="h-4 w-4 text-gray-500" />Page content image</button></section>}
            {(workspace.contentSources || []).length > 0 && <section className="space-y-2 border-t border-gray-200 pt-4"><h3 className="text-xs font-semibold uppercase tracking-wide text-gray-500">Demo content</h3><label htmlFor="preview-source-site" className="sr-only">Demo content from site</label><select id="preview-source-site" value={sourceSiteId} onChange={(event) => setSourceSiteId(event.target.value)} disabled={disabled || importingSite} className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-700"><option value="">Choose site</option>{workspace.contentSources.map((source) => <option key={source.id} value={source.id}>{source.label}</option>)}</select><button type="button" onClick={copySiteContent} disabled={!sourceSiteId || disabled || importingSite} className="inline-flex w-full items-center justify-center gap-2 rounded-md bg-gray-100 px-3 py-2 text-sm font-medium text-gray-800 hover:bg-gray-200 disabled:opacity-50">{importingSite ? <Loader2 className="h-4 w-4 animate-spin" /> : <Copy className="h-4 w-4" />}Use site content</button></section>}
        </div>
    )

    const imageAspectOverview = (
        <section className="space-y-5">
            <div><h2 className="text-xl font-semibold text-gray-900">Theme images</h2><p className="mt-1 text-sm text-gray-600">Choose an image to see and replace all of its sizes in the left panel.</p></div>
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                {imageAspects.map((aspect) => {
                    const previewAsset = aspect.assets.find((asset) => asset.url) || aspect.assets[0]
                    return <button type="button" key={aspect.key} aria-label={`Select image aspect ${aspect.label}${aspect.details ? ` ${aspect.details}` : ''}`} aria-pressed={aspect.key === selectedImageAspect?.key} onClick={() => setSelectedImageAspectKey(aspect.key)} className={`overflow-hidden rounded-lg border bg-white text-left shadow-sm transition ${aspect.key === selectedImageAspect?.key ? 'border-blue-500 ring-2 ring-blue-200' : 'border-gray-200 hover:border-gray-300 hover:shadow'}`}>
                        {previewAsset?.url ? <img src={previewAsset.url} alt="" className="h-36 w-full border-b border-gray-200 bg-gray-50 object-contain" /> : <div className="flex h-36 items-center justify-center border-b border-dashed border-gray-300 bg-gray-50 text-sm text-gray-500">Placeholder image</div>}
                        <span className="block p-4"><span className="block text-sm font-semibold text-gray-900">{aspect.label}</span>{aspect.details && <span className="mt-1 block text-xs text-gray-500">{aspect.details}</span>}<span className="mt-2 block text-xs text-gray-500">{aspect.assets.length} {aspect.assets.length === 1 ? 'version' : 'versions'}</span></span>
                    </button>
                })}
            </div>
        </section>
    )

    const selectedEditor = selectedTarget && (
        <section className="overflow-hidden rounded-lg border border-blue-200 bg-white shadow-sm">
            <button
                type="button"
                aria-expanded={selectionExpanded}
                aria-controls="selected-element-editor"
                aria-label={`${selectionExpanded ? 'Collapse' : 'Expand'} ${selectedTarget.label} settings`}
                onClick={() => setSelectionExpanded((current) => !current)}
                className="flex w-full items-center gap-3 bg-blue-50 px-4 py-3 text-left hover:bg-blue-100"
            >
                <div className="min-w-0 flex-1">
                    <p className="text-xs font-semibold uppercase tracking-wide text-blue-700">Selected element</p>
                    <h2 className="truncate text-base font-semibold text-gray-900">{selectedTarget.label}</h2>
                </div>
                <ChevronDown className={`h-5 w-5 shrink-0 text-blue-700 transition-transform ${selectionExpanded ? 'rotate-180' : ''}`} />
            </button>
            {selectionExpanded && (
                <div id="selected-element-editor" className="space-y-5 border-t border-blue-200 p-4">
                    {selectedTarget.alternatives?.length > 1 && <section className="space-y-2"><h3 className="text-sm font-medium text-gray-900">Choose what to edit</h3><p className="text-xs text-gray-500">These elements share the same area.</p><div className="grid gap-2">{selectedTarget.alternatives.map((alternative) => <button key={alternative.id} type="button" aria-pressed={alternative.id === selectedTarget.id} onClick={() => chooseTargetAlternative(alternative)} className={`rounded-md border px-3 py-2 text-left text-sm ${alternative.id === selectedTarget.id ? 'border-blue-500 bg-blue-50 font-medium text-blue-800' : 'border-gray-200 bg-white text-gray-800 hover:bg-gray-50'}`}>{alternative.label}</button>)}</div></section>}
                    {selectedTarget.kind === 'element' && selectedTarget.editable && <section className="space-y-2"><label className="text-sm font-medium text-gray-900" htmlFor="preview-text">Preview text</label><textarea id="preview-text" value={previewText} onChange={(event) => updatePreviewText(event.target.value)} rows={5} className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm" /><p className="text-xs text-gray-500">This changes demo content only, not published page content.</p></section>}
                    {selectedTarget.kind === 'previewImage' && <section className="space-y-3"><div><h3 className="font-medium text-gray-900">Preview image</h3><p className="text-xs text-gray-500">Choose temporary content for this preview view.</p></div><input ref={previewImageInputRef} type="file" accept="image/png,image/jpeg,image/gif,image/webp,image/svg+xml" onChange={(event) => choosePreviewImage(event.target.files?.[0])} className="sr-only" /><button type="button" onClick={() => previewImageInputRef.current?.click()} className="inline-flex w-full items-center justify-center gap-2 rounded-md border border-gray-300 px-3 py-2 text-sm font-medium"><ImageIcon className="h-4 w-4" />Choose preview image</button></section>}
                    {targetTypography.map(({ row, index }) => <section key={`type-${index}`} className="space-y-3 border-t border-gray-200 pt-4"><h3 className="font-medium text-gray-900">Typography{row.element ? ` · ${selectedGroup?.elements?.find((element) => element.element === row.element)?.label || row.element}` : ''}</h3><ValueFields values={row.values} fields={workspace.constraints.editableTypographyProperties} labels={typographyLabels} onChange={(field, value) => updateWorkspace((next) => { next.typography[index].values[field] = value; return next })} /></section>)}
                    {targetSpacing.map(({ row, index }) => <section key={`space-${index}`} className="space-y-3 border-t border-gray-200 pt-4"><h3 className="font-medium text-gray-900">Spacing{row.part ? ` · ${selectedGroup?.parts?.find((part) => part.part === row.part)?.label || row.part}` : ''}{row.breakpoint ? ` · ${row.breakpoint}` : ''}</h3><ValueFields values={row.values} fields={workspace.constraints.editableSpacingProperties} labels={spacingLabels} onChange={(field, value) => updateWorkspace((next) => { next.spacing[index].values[field] = value; return next })} /></section>)}
                    {relevantColors.length > 0 && <section className="space-y-3 border-t border-gray-200 pt-4"><h3 className="font-medium text-gray-900">Colors used here</h3>{relevantColors.map(({ name, index }) => <label key={name} className="flex items-center gap-3"><input type="color" value={/^#[0-9a-f]{6}$/i.test(workspace.colors[index].value) ? workspace.colors[index].value : '#000000'} onChange={(event) => updateWorkspace((next) => { next.colors[index].value = event.target.value; return next })} className="h-10 w-12 rounded border border-gray-300" /><span className="min-w-0 flex-1 text-sm font-medium">{name}</span><input aria-label={`${name} value`} value={workspace.colors[index].value} onChange={(event) => updateWorkspace((next) => { next.colors[index].value = event.target.value; return next })} className="w-28 rounded-md border border-gray-300 px-2 py-1.5 font-mono text-xs" /></label>)}</section>}
                    {!targetTypography.length && !targetSpacing.length && !relevantColors.length && !['element', 'previewImage'].includes(selectedTarget.kind) && <p className="rounded-lg border border-dashed border-gray-300 p-4 text-sm text-gray-500">Choose a more specific text or image inside this area to edit its details.</p>}
                </div>
            )}
        </section>
    )

    return (
        <main className="grid min-h-0 flex-1 lg:grid-cols-[360px_minmax(0,1fr)]">
            <section className={`${mobilePane === 'preview' ? 'hidden' : 'flex'} min-h-0 min-w-0 flex-col border-r border-gray-200 bg-white lg:flex`}>
                <fieldset disabled={disabled || savingPreview} className="min-h-0 flex-1 overflow-y-auto p-4">
                    {workspaceView === 'images' || selectedTarget?.kind === 'asset'
                        ? themeImageEditor
                        : <div className="space-y-6">{selectedEditor}{previewOptions}</div>}
                </fieldset>
            </section>
            <section className={`${mobilePane === 'edit' ? 'hidden' : 'flex'} min-h-0 flex-col bg-gray-100 p-3 lg:flex lg:p-5`}>
                <div className="mb-3 flex flex-wrap items-center gap-2">
                    <nav className="flex min-w-0 flex-1 gap-1 overflow-x-auto" aria-label="Designer views">{previewContent.views.map((view) => <button type="button" key={view.id} onClick={() => { setWorkspaceView('preview'); setViewId(view.id); setSelectedTarget(null) }} className={`inline-flex shrink-0 items-center gap-2 rounded-md px-3 py-2 text-sm font-medium ${workspaceView === 'preview' && view.id === viewId ? 'bg-white text-blue-700 shadow-sm ring-1 ring-gray-200' : 'text-gray-600 hover:bg-white/70'}`}>{view.kind === 'object' ? <Box className="h-4 w-4" /> : <FileText className="h-4 w-4" />}{view.label}</button>)}<button type="button" onClick={() => { setWorkspaceView('images'); setSelectedTarget(null) }} className={`inline-flex shrink-0 items-center gap-2 rounded-md px-3 py-2 text-sm font-medium ${workspaceView === 'images' ? 'bg-white text-blue-700 shadow-sm ring-1 ring-gray-200' : 'text-gray-600 hover:bg-white/70'}`}><ImageIcon className="h-4 w-4" />Theme images</button></nav>
                    {workspaceView === 'preview' && previewDirty && <button type="button" onClick={saveCurrentPreview} disabled={savingPreview} className="inline-flex items-center gap-2 rounded-md bg-blue-600 px-3 py-2 text-sm font-medium text-white disabled:opacity-50">{savingPreview ? <Check className="h-4 w-4" /> : <Save className="h-4 w-4" />}{savingPreview ? 'Saving…' : 'Save preview content'}</button>}
                    <span className="text-xs capitalize text-gray-500">{workspaceView === 'images' ? 'Theme images' : viewport}</span>
                </div>
                <div ref={previewFrameRef} className={`relative min-h-0 flex-1 rounded-lg border border-gray-300 bg-white shadow-sm ${workspaceView === 'images' ? 'overflow-y-auto p-4 lg:p-6' : 'overflow-hidden'}`}>
                    {workspaceView === 'images' ? imageAspectOverview : <iframe
                        ref={iframeRef}
                        title="Live theme preview"
                        sandbox="allow-scripts"
                        srcDoc={previewDocument}
                        className="absolute top-0 border-0 bg-white"
                        style={{
                            left: previewOffset,
                            width: previewCanvasWidth,
                            height: `${100 / previewScale}%`,
                            transform: `scale(${previewScale})`,
                            transformOrigin: 'top left',
                        }}
                    />}
                </div>
            </section>
        </main>
    )
}

export default SemanticThemeWorkspace
