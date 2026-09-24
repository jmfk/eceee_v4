import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useParams } from 'react-router-dom'
import { Download, Image as ImageIcon, Loader2, Monitor, Palette, Plus, Redo2, RotateCcw, Save, Send, Smartphone, Tablet, Trash2, Type } from 'lucide-react'
import DesignerNavbar from '../components/DesignerNavbar'
import StatusBar from '../components/StatusBar'
import { designerThemesApi } from '../api/designerThemes'
import { useGlobalNotifications } from '../contexts/GlobalNotificationContext'

const tabs = [
    { id: 'assets', label: 'Assets', icon: <ImageIcon className="h-4 w-4" /> },
    { id: 'colors', label: 'Colors', icon: <Palette className="h-4 w-4" /> },
    { id: 'typography', label: 'Typography', icon: <Type className="h-4 w-4" /> },
    { id: 'spacing', label: 'Spacing', icon: <Redo2 className="h-4 w-4" /> },
]

const previewCopy = {
    en: {
        eyebrow: 'Typography preview',
        fontFamily: 'Font family',
        typographyValues: 'Typography values',
        longText: 'Lorem ipsum dolor sit amet, consectetur adipiscing elit. Integer posuere, nibh at cursus facilisis, justo sapien consequat libero, vitae tincidunt enim neque eget augue.',
        listFallback: ['Readable headings and body copy', 'Balanced weight and line height', 'Clear rhythm across longer passages'],
    },
    sv: {
        eyebrow: 'Förhandsvisning av typografi',
        fontFamily: 'Typsnitt',
        typographyValues: 'Typografivärden',
        longText: 'Det här är en längre svensk exempeltext som visar hur typsnittet fungerar i löpande text. Flera ord och meningar gör radlängd, rytm och läsbarhet tydliga.',
        listFallback: ['Läsbara rubriker och brödtexter', 'Balanserad vikt och radhöjd', 'Tydlig rytm i längre textstycken'],
    },
}

const getPreviewCopy = () => {
    const language = (document.documentElement.lang || navigator.language || 'en').toLowerCase().split('-')[0]
    return previewCopy[language] || previewCopy.en
}

const formatFont = (font, copy) => {
    const family = font?.family?.trim() || copy.fontFamily
    const variants = (font?.variants || []).filter(Boolean).join(' / ') || '400'
    return `${family} · ${variants}`
}

const buildFontPreviewContent = (workspace) => {
    const copy = getPreviewCopy()
    const fonts = (workspace?.fonts || []).filter((font) => font.family?.trim())
    const primaryFont = fonts[0]
    const typography = (workspace?.typography || []).map((row) => {
        const values = Object.entries(row.values || {})
            .filter(([, value]) => value !== '' && value !== null && value !== undefined)
            .map(([name, value]) => `${name}: ${value}`)
            .join(', ')
        return values ? `${row.element} — ${values}` : row.element
    }).filter(Boolean)
    const listItems = [...fonts.map((font) => formatFont(font, copy)), ...typography, ...copy.listFallback].slice(0, 3)

    return {
        eyebrow: `${copy.eyebrow} · ${primaryFont?.family?.trim() || copy.fontFamily}`,
        title: formatFont(primaryFont, copy),
        lead: copy.longText,
        cardTitle: typography[0] || `${copy.fontFamily}: ${formatFont(primaryFont, copy)}`,
        cardBody: `${copy.typographyValues}: ${typography.slice(1).join(' · ') || formatFont(primaryFont, copy)}. ${copy.longText}`,
        listItems,
    }
}

const escapeHtml = (value) => String(value ?? '').replace(/[&<>'"]/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[char]))

const buildPreviewDocument = (css, fontUrl, content, viewport) => `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width">${fontUrl ? `<link rel="stylesheet" href="${escapeHtml(fontUrl)}">` : ''}<style>
html,body{margin:0;min-height:100%;background:#fff}body{padding:24px}.preview-shell{max-width:${viewport === 'desktop' ? '1120px' : viewport === 'tablet' ? '720px' : '390px'};margin:auto}.preview-header,.preview-footer,.preview-card,.preview-table-wrap{border:1px solid #d1d5db;padding:20px;margin-bottom:20px}.preview-grid{display:grid;grid-template-columns:repeat(${viewport === 'mobile' ? 1 : 2},minmax(0,1fr));gap:20px}.preview-image{min-height:150px;background:linear-gradient(135deg,#e5e7eb,#f9fafb);display:flex;align-items:center;justify-content:center;border:1px dashed #9ca3af}.preview-table{width:100%;border-collapse:collapse}.preview-table th,.preview-table td{border:1px solid #d1d5db;padding:8px;text-align:left}${css || ''}</style></head><body><div class="designer-preview preview-shell cms-content">
<header class="preview-header header-widget"><small>${escapeHtml(content.eyebrow)}</small><h1>${escapeHtml(content.title)}</h1><p>${escapeHtml(content.lead)}</p><button type="button">Primary action</button> <a href="#">Text link</a></header>
<main><div class="preview-grid"><article class="preview-card content-card"><h2>${escapeHtml(content.cardTitle)}</h2><p>${escapeHtml(content.cardBody)}</p><ul>${(content.listItems || []).map((item) => `<li>${escapeHtml(item)}</li>`).join('')}</ul></article><div class="preview-image image">Representative image</div></div>
<div class="preview-table-wrap"><h2>Table example</h2><table class="preview-table"><thead><tr><th>Item</th><th>Value</th></tr></thead><tbody><tr><td>First row</td><td>42</td></tr><tr><td>Second row</td><td>84</td></tr></tbody></table><blockquote>A representative quotation demonstrates spacing and emphasis.</blockquote></div></main>
<footer class="preview-footer footer-widget"><strong>Footer heading</strong><p>Footer and secondary content example.</p></footer></div></body></html>`

const EditableValueGrid = ({ values, fields, onChange }) => (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {fields.map((field) => (
            <label key={field} className="text-xs font-medium text-gray-700">
                {field.replace(/([A-Z])/g, ' $1').replace(/^./, (char) => char.toUpperCase())}
                <input value={values[field] || ''} onChange={(event) => onChange(field, event.target.value)} className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm" placeholder="Theme default" />
            </label>
        ))}
    </div>
)

const DesignerThemeWorkspacePage = () => {
    const { themeId } = useParams()
    const { addNotification } = useGlobalNotifications()
    const [workspace, setWorkspace] = useState(null)
    const [activeTab, setActiveTab] = useState('assets')
    const [viewport, setViewport] = useState('desktop')
    const [mobilePane, setMobilePane] = useState('edit')
    const [preview, setPreview] = useState({ css: '', fontUrl: '' })
    const [loading, setLoading] = useState(true)
    const [saving, setSaving] = useState(false)
    const [publishing, setPublishing] = useState(false)
    const [dirty, setDirty] = useState(false)
    const [error, setError] = useState('')
    const [exporting, setExporting] = useState(false)
    const [exportProgress, setExportProgress] = useState(null)
    const [placeholderDrafts, setPlaceholderDrafts] = useState({})
    const uploadRefs = useRef({})
    const previewRequestRef = useRef(0)

    const payload = useMemo(() => workspace ? ({
        draftVersion: workspace.draftVersion,
        colors: Object.fromEntries(workspace.colors.map((color) => [color.name, color.value])),
        fonts: workspace.fonts.filter((font) => font.family.trim()).map((font) => ({ family: font.family, variants: font.variants, display: font.display })),
        typography: workspace.typography.map((row) => ({ groupIndex: row.groupIndex, element: row.element, values: row.values })),
        spacing: workspace.spacing.map((row) => ({ scope: row.scope, groupIndex: row.groupIndex, element: row.element, part: row.part, breakpoint: row.breakpoint, values: row.values })),
    }) : null, [workspace])

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
        if (!payload) return undefined
        const requestId = previewRequestRef.current + 1
        previewRequestRef.current = requestId
        const timer = window.setTimeout(async () => {
            try {
                const result = await designerThemesApi.preview(themeId, payload)
                if (requestId !== previewRequestRef.current) return
                setPreview({ css: result.css || '', fontUrl: result.fontUrl || '' })
            } catch (err) {
                addNotification({ type: 'error', message: err.message || 'Preview could not be updated' })
            }
        }, 350)
        return () => window.clearTimeout(timer)
    }, [payload, themeId, addNotification])

    const updateWorkspace = (updater) => {
        setWorkspace((current) => updater(structuredClone(current)))
        setDirty(true)
    }

    const saveDraft = async ({ silent = false } = {}) => {
        if (!payload) return null
        if (!dirty) return workspace
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

    const previewContent = useMemo(() => buildFontPreviewContent(workspace), [workspace])
    const previewDocument = useMemo(() => buildPreviewDocument(preview.css, preview.fontUrl, previewContent, viewport), [preview, previewContent, viewport])
    const hasDraftChanges = dirty || workspace?.hasDraftChanges

    if (loading) return <div className="fixed inset-0 flex items-center justify-center bg-gray-50"><Loader2 className="h-8 w-8 animate-spin text-blue-600" /><span className="ml-3 text-gray-600">Loading Designer workspace…</span></div>

    if (error || !workspace) return <div className="fixed inset-0 flex flex-col bg-gray-50"><DesignerNavbar /><main className="m-auto max-w-lg p-6"><div role="alert" className="rounded-lg border border-red-200 bg-red-50 p-5 text-red-800"><h1 className="font-semibold">Designer workspace unavailable</h1><p className="mt-1 text-sm">{error}</p></div></main></div>

    return (
        <div className="fixed inset-0 flex flex-col bg-gray-50">
            <DesignerNavbar />
            <header className="flex flex-wrap items-center justify-between gap-3 border-b border-gray-200 bg-white px-4 py-3 sm:px-6">
                <div><h1 className="font-semibold text-gray-900">{workspace.name}</h1><p className="text-xs text-gray-500">Designer draft · live theme version {workspace.liveSyncVersion}</p></div>
                <div className="flex flex-wrap items-center gap-2">
                    <div className="hidden rounded-md border border-gray-300 p-1 sm:flex" aria-label="Preview size">
                        {[['desktop', <Monitor className="h-4 w-4" />], ['tablet', <Tablet className="h-4 w-4" />], ['mobile', <Smartphone className="h-4 w-4" />]].map(([name, icon]) => <button key={name} onClick={() => setViewport(name)} aria-label={`${name} preview`} className={`rounded p-1.5 ${viewport === name ? 'bg-gray-200 text-gray-900' : 'text-gray-500'}`}>{icon}</button>)}
                    </div>
                    <button onClick={exportPackage} disabled={exporting} title={exportProgress?.message} className="inline-flex items-center gap-2 rounded-md border border-gray-300 bg-white px-3 py-2 text-sm disabled:opacity-50">{exporting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}{exporting ? `Export ${exportProgress?.percent || 0}%` : 'Export'}</button>
                    <button onClick={discardDraft} disabled={(!hasDraftChanges && !workspace.draftIsStale) || saving || publishing} className="inline-flex items-center gap-2 rounded-md border border-gray-300 bg-white px-3 py-2 text-sm disabled:opacity-40"><RotateCcw className="h-4 w-4" />Discard draft</button>
                    <button onClick={() => saveDraft()} disabled={!dirty || workspace.draftIsStale || saving || publishing} className="inline-flex items-center gap-2 rounded-md border border-blue-600 bg-white px-3 py-2 text-sm font-medium text-blue-700 disabled:opacity-40">{saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}Save draft</button>
                    <button onClick={publish} disabled={!hasDraftChanges || workspace.draftIsStale || saving || publishing} className="inline-flex items-center gap-2 rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-40">{publishing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}Publish changes</button>
                </div>
            </header>
            {workspace.draftIsStale && <div role="alert" className="border-b border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900 sm:px-6">The live theme changed after this draft was started. Discard the draft to reload the current live version before making or publishing more changes.</div>}
            <div className="flex border-b border-gray-200 bg-white lg:hidden"><button onClick={() => setMobilePane('edit')} className={`flex-1 px-4 py-2 text-sm ${mobilePane === 'edit' ? 'border-b-2 border-blue-600 font-medium' : ''}`}>Edit</button><button onClick={() => setMobilePane('preview')} className={`flex-1 px-4 py-2 text-sm ${mobilePane === 'preview' ? 'border-b-2 border-blue-600 font-medium' : ''}`}>Preview</button></div>
            <main className="grid min-h-0 flex-1 lg:grid-cols-2">
                <section className={`${mobilePane === 'preview' ? 'hidden' : 'flex'} min-h-0 min-w-0 flex-col border-r border-gray-200 bg-white lg:flex`}>
                    <fieldset disabled={saving || publishing} aria-busy={saving || publishing} className="flex min-h-0 flex-1 flex-col">
                    <nav className="flex overflow-x-auto border-b border-gray-200 px-3" aria-label="Designer sections">{tabs.map(({ id, label, icon }) => <button key={id} onClick={() => setActiveTab(id)} className={`inline-flex items-center gap-2 whitespace-nowrap border-b-2 px-3 py-3 text-sm ${activeTab === id ? 'border-blue-600 font-medium text-blue-700' : 'border-transparent text-gray-600'}`}>{icon}{label}</button>)}</nav>
                    <div className="min-h-0 flex-1 overflow-y-auto p-4 sm:p-6">
                        {activeTab === 'assets' && (
                            <div className="space-y-4">
                                <div><h2 className="text-lg font-semibold">Theme assets</h2><p className="text-sm text-gray-600">Upload full-size artwork. Pixel dimensions and DPR determine the available 1×/2× variants; the image service only downsizes.</p></div>
                                {workspace.assets.length === 0 && <p className="rounded-lg border border-dashed border-gray-300 p-6 text-center text-sm text-gray-500">No configured theme assets.</p>}
                                {workspace.assets.map((asset) => (
                                    <article key={asset.assetKey} className="rounded-lg border border-gray-200 p-4">
                                        <div className="flex gap-4">
                                            {asset.url ? <img src={asset.url} alt="" className="h-24 w-28 rounded border border-gray-200 bg-gray-50 object-contain" /> : <div className="flex h-24 w-28 items-center justify-center rounded border border-dashed border-gray-300 text-xs text-gray-500">Missing</div>}
                                            <div className="min-w-0 flex-1">
                                                <h3 className="font-medium text-gray-900">{asset.displayName}</h3>
                                                <p className="truncate text-xs text-gray-500">{asset.filename || 'No file'}</p>
                                                <p className="mt-2 text-xs text-gray-600">Actual: {asset.width || '?'} × {asset.height || '?'} px · {asset.requirementSource === 'explicit' ? `Required: ${asset.requiredWidth || '?'} × ${asset.requiredHeight || '?'} px` : `Recommended width: ${asset.recommendedWidth || '?'} px · height not specified`} @ {asset.dpr || 2}x</p>
                                                <p className="mt-1 text-xs text-gray-500">{asset.usage?.join(', ')}</p>
                                                {asset.validation?.message && <p className={`mt-2 text-xs ${asset.validation.status === 'error' ? 'text-red-700' : asset.validation.status === 'warning' ? 'text-amber-700' : 'text-green-700'}`}>{asset.validation.message}</p>}
                                                {asset.isPlaceholder && <span className="mt-2 inline-block rounded bg-amber-100 px-2 py-1 text-xs text-amber-800">Placeholder</span>}
                                            </div>
                                        </div>
                                        {asset.kind === 'design-group' && (
                                            <div className="mt-3 grid gap-2 rounded-md bg-gray-50 p-3 sm:grid-cols-3">
                                                <input aria-label={`${asset.displayName} placeholder name`} value={placeholderDrafts[asset.assetKey]?.displayName ?? asset.displayName} onChange={(event) => setPlaceholderDrafts((current) => ({ ...current, [asset.assetKey]: { ...current[asset.assetKey], displayName: event.target.value } }))} className="rounded-md border border-gray-300 px-2 py-1.5 text-sm" />
                                                <input aria-label={`${asset.displayName} placeholder width`} type="number" min="16" max="8000" value={placeholderDrafts[asset.assetKey]?.width ?? asset.requiredWidth ?? ''} onChange={(event) => setPlaceholderDrafts((current) => ({ ...current, [asset.assetKey]: { ...current[asset.assetKey], width: event.target.value } }))} placeholder="Full width px" className="rounded-md border border-gray-300 px-2 py-1.5 text-sm" />
                                                <input aria-label={`${asset.displayName} placeholder height`} type="number" min="16" max="8000" value={placeholderDrafts[asset.assetKey]?.height ?? asset.requiredHeight ?? ''} onChange={(event) => setPlaceholderDrafts((current) => ({ ...current, [asset.assetKey]: { ...current[asset.assetKey], height: event.target.value } }))} placeholder="Full height px" className="rounded-md border border-gray-300 px-2 py-1.5 text-sm" />
                                            </div>
                                        )}
                                        <div className="mt-3 flex flex-wrap justify-end gap-2">
                                            {asset.kind === 'design-group' && <button onClick={() => createPlaceholder(asset)} disabled={workspace.draftIsStale} className="rounded-md border border-gray-300 px-3 py-2 text-sm disabled:opacity-40">Create placeholder</button>}
                                            <input ref={(node) => { uploadRefs.current[asset.assetKey] = node }} type="file" accept="image/png,image/jpeg,image/gif,image/webp,image/svg+xml" onChange={(event) => replaceAsset(asset, event.target.files?.[0])} className="sr-only" />
                                            {asset.replaceable === false ? <span className="text-xs text-gray-500">Unused library assets are read-only in drafts.</span> : <button onClick={() => uploadRefs.current[asset.assetKey]?.click()} disabled={workspace.draftIsStale} className="rounded-md border border-gray-300 px-3 py-2 text-sm disabled:opacity-40">Upload to draft</button>}
                                        </div>
                                    </article>
                                ))}
                            </div>
                        )}
                        {activeTab === 'colors' && <div className="space-y-4"><div><h2 className="text-lg font-semibold">Color palette</h2><p className="text-sm text-gray-600">Change existing named colors without changing selectors or theme structure.</p></div>{workspace.colors.map((color, index) => <label key={color.name} className="flex items-center gap-4 rounded-lg border border-gray-200 p-4"><input type="color" value={/^#[0-9a-f]{6}$/i.test(color.value) ? color.value : '#000000'} onChange={(event) => updateWorkspace((next) => { next.colors[index].value = event.target.value; return next })} className="h-11 w-14 rounded border border-gray-300" /><span className="min-w-0 flex-1"><span className="block font-medium text-gray-900">{color.name}</span><span className="block truncate text-xs text-gray-500">{color.usage?.join(', ') || 'Currently unused'}</span></span><input aria-label={`${color.name} value`} value={color.value} onChange={(event) => updateWorkspace((next) => { next.colors[index].value = event.target.value; return next })} className="w-32 rounded-md border border-gray-300 px-3 py-2 font-mono text-sm" /></label>)}</div>}
                        {activeTab === 'typography' && <div className="space-y-5"><div><h2 className="text-lg font-semibold">Fonts and typography</h2><p className="text-sm text-gray-600">Manage available Google Font variants and their approved element settings.</p></div><section className="rounded-lg border border-gray-200 p-4"><div className="flex items-center justify-between"><h3 className="font-medium">Font families</h3><button onClick={() => updateWorkspace((next) => { next.fonts.push({ family: '', variants: ['400'], display: 'swap', usage: [] }); return next })} className="inline-flex items-center gap-1 rounded-md border border-gray-300 px-2 py-1.5 text-sm"><Plus className="h-4 w-4" />Add font</button></div><div className="mt-3 space-y-3">{workspace.fonts.map((font, index) => <div key={`${font.family}-${index}`} className="grid gap-2 sm:grid-cols-[1fr_1fr_auto]"><input aria-label="Font family" value={font.family} onChange={(event) => updateWorkspace((next) => { next.fonts[index].family = event.target.value; return next })} className="rounded-md border border-gray-300 px-3 py-2 text-sm" /><input aria-label="Font variants" value={(font.variants || []).join(', ')} onChange={(event) => updateWorkspace((next) => { next.fonts[index].variants = event.target.value.split(',').map((item) => item.trim()).filter(Boolean); return next })} className="rounded-md border border-gray-300 px-3 py-2 text-sm" placeholder="400, 700, 400italic" /><button aria-label={`Remove ${font.family || 'font'}`} onClick={() => updateWorkspace((next) => { next.fonts.splice(index, 1); return next })} className="rounded-md border border-gray-300 p-2 text-gray-500 hover:text-red-600"><Trash2 className="h-4 w-4" /></button></div>)}</div></section>{workspace.typography.map((row, index) => <details key={`${row.groupIndex}-${row.element}`} className="rounded-lg border border-gray-200" open={index === 0}><summary className="cursor-pointer px-4 py-3 font-medium text-gray-900">{row.groupName} · {row.element}</summary><div className="border-t border-gray-200 p-4"><EditableValueGrid values={row.values} fields={workspace.constraints.editableTypographyProperties} onChange={(field, value) => updateWorkspace((next) => { next.typography[index].values[field] = value; return next })} /></div></details>)}</div>}
                        {activeTab === 'spacing' && <div className="space-y-4"><div><h2 className="text-lg font-semibold">Margins and padding</h2><p className="text-sm text-gray-600">Only spacing values can be changed here; layout targeting remains protected.</p></div>{workspace.spacing.map((row, index) => <details key={`${row.scope}-${row.groupIndex}-${row.element || row.part}-${row.breakpoint || ''}`} className="rounded-lg border border-gray-200" open={index === 0}><summary className="cursor-pointer px-4 py-3 font-medium text-gray-900">{row.groupName} · {row.element || row.part}{row.breakpoint ? ` · ${row.breakpoint}` : ''}</summary><div className="border-t border-gray-200 p-4"><EditableValueGrid values={row.values} fields={workspace.constraints.editableSpacingProperties} onChange={(field, value) => updateWorkspace((next) => { next.spacing[index].values[field] = value; return next })} /></div></details>)}</div>}
                    </div>
                    </fieldset>
                </section>
                <section className={`${mobilePane === 'edit' ? 'hidden' : 'flex'} min-h-0 flex-col bg-gray-100 p-3 lg:flex lg:p-6`}><div className="mb-3 flex items-center justify-between"><h2 className="text-sm font-semibold text-gray-800">Live preview</h2><span className="text-xs capitalize text-gray-500">{viewport}</span></div><iframe title="Live theme preview" sandbox="" srcDoc={previewDocument} className="min-h-0 flex-1 rounded-lg border border-gray-300 bg-white shadow-sm" /></section>
            </main>
            <StatusBar customStatusContent={<span>{workspace.draftIsStale ? 'Draft is stale · discard to reload' : dirty ? 'Unsaved local draft changes' : workspace.hasDraftChanges ? 'Draft saved · not published' : 'Draft matches the live theme'}</span>} />
        </div>
    )
}

export default DesignerThemeWorkspacePage
