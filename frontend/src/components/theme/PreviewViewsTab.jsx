import { useEffect, useMemo, useRef, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Box, Copy, FileText, Loader2, Plus, Trash2 } from 'lucide-react'

import { themesApi } from '../../api'
import ObjectContentEditor from '../ObjectContentEditor'
import WidgetEditorPanel from '../WidgetEditorPanel'
import ObjectDataForm from '../objectEdit/ObjectDataForm'
import PageContentEditor from '../../editors/page-editor/PageContentEditor'
import { applyWidgetUpdateToWidgetMap } from '../../utils/pageEditorWidgetState'

const newId = (kind) => `${kind}-${globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(36).slice(2)}`}`

const PreviewViewsTab = ({ designerPreview, onChange, themeId }) => {
    const views = useMemo(() => Array.isArray(designerPreview?.views) ? designerPreview.views : [], [designerPreview?.views])
    const [selectedId, setSelectedId] = useState(views[0]?.id || '')
    const [objectTypeKey, setObjectTypeKey] = useState('')
    const [importKind, setImportKind] = useState('page')
    const [importSourceId, setImportSourceId] = useState('')
    const [importing, setImporting] = useState(false)
    const [importError, setImportError] = useState('')
    const [widgetEditor, setWidgetEditor] = useState({ open: false, widget: null })
    const objectFormRef = useRef(null)

    const canUseSources = Boolean(themeId && themeId !== 'new')
    const { data: sources = { layouts: [], pages: [], objects: [], objectTypes: [] }, isLoading: sourcesLoading } = useQuery({
        queryKey: ['theme-preview-content-sources', themeId],
        queryFn: async () => await themesApi.previewContentSources(themeId),
        enabled: canUseSources,
    })

    useEffect(() => {
        if (!views.some((view) => view.id === selectedId)) setSelectedId(views[0]?.id || '')
    }, [selectedId, views])

    useEffect(() => {
        const candidates = importKind === 'page' ? sources.pages : sources.objects
        setImportSourceId((current) => candidates?.some((source) => String(source.id) === String(current))
            ? current
            : candidates?.[0]?.id || '')
    }, [importKind, sources.objects, sources.pages])

    useEffect(() => {
        setObjectTypeKey((current) => sources.objectTypes?.some((type) => type.key === current)
            ? current
            : sources.objectTypes?.[0]?.key || '')
    }, [sources.objectTypes])

    const selectedIndex = views.findIndex((view) => view.id === selectedId)
    const selected = selectedIndex >= 0 ? views[selectedIndex] : null
    const updateViews = (nextViews) => onChange({ ...(designerPreview || {}), views: nextViews })
    const updateView = (updates) => {
        if (selectedIndex < 0) return
        updateViews(views.map((view, index) => index === selectedIndex ? { ...view, ...updates } : view))
    }
    const updateContent = (updates) => updateView({ content: { ...(selected?.content || {}), ...updates } })

    const addPage = () => {
        const layout = sources.layouts?.[0]?.key || 'main_layout'
        const view = {
            id: newId('page'), label: 'New preview page', kind: 'page', layout,
            content: { title: 'New preview page', pageData: {}, widgets: {}, codeLayout: layout },
        }
        updateViews([...views, view])
        setSelectedId(view.id)
    }

    const addObject = () => {
        const sourceType = sources.objectTypes?.find((type) => type.key === objectTypeKey)
        if (!sourceType) return
        const objectType = { ...sourceType, id: `theme-preview-${sourceType.key}` }
        const view = {
            id: newId('object'), label: `New ${sourceType.label}`, kind: 'object', layout: 'main_layout',
            objectType,
            content: { title: `New ${sourceType.label}`, data: {}, widgets: {} },
        }
        updateViews([...views, view])
        setSelectedId(view.id)
    }

    const importContent = async () => {
        if (!importSourceId) return
        setImportError('')
        setImporting(true)
        try {
            const response = await themesApi.importPreviewContent(themeId, importKind, importSourceId)
            const imported = response.designer_preview?.views?.[0] || response.designerPreview?.views?.[0]
            if (!imported) throw new Error('The imported preview was empty')
            updateViews([...views, imported])
            setSelectedId(imported.id)
        } catch (error) {
            setImportError(error?.response?.data?.error || error?.response?.data?.detail || error?.message || 'Could not copy the selected content')
        } finally {
            setImporting(false)
        }
    }

    const removeSelected = () => {
        if (!selected) return
        if (!window.confirm(`Remove “${selected.label || selected.id}” from this theme?`)) return
        updateViews(views.filter((view) => view.id !== selected.id))
    }

    const pageWidgets = selected?.content?.widgets || {}
    const pageVersion = selected?.kind === 'page' ? {
        id: selected.id,
        versionId: selected.id,
        codeLayout: selected.content?.codeLayout || selected.layout || 'main_layout',
        pageData: selected.content?.pageData || {},
        widgets: pageWidgets,
    } : null
    const pageData = selected?.kind === 'page' ? {
        id: selected.id,
        title: selected.content?.title || selected.label,
    } : null
    const objectType = useMemo(() => selected?.kind === 'object'
        ? { ...(selected.objectType || {}), id: selected.objectType?.id || `theme-preview-${selected.objectType?.key || selected.id}` }
        : null, [selected])
    const objectInstance = selected?.kind === 'object' ? {
        id: selected.id,
        title: selected.content?.title || selected.label,
        status: 'draft',
        data: selected.content?.data || {},
        widgets: selected.content?.widgets || {},
        metadata: {},
        objectType,
    } : null

    const savePageWidget = async (updatedWidget) => {
        updateContent({ widgets: applyWidgetUpdateToWidgetMap(pageWidgets, updatedWidget) })
        setWidgetEditor({ open: false, widget: null })
    }

    return (
        <div className="space-y-6">
            <div>
                <div role="heading" aria-level="2" className="text-lg font-semibold text-gray-900">Preview content</div>
                <p className="mt-1 max-w-3xl text-sm text-gray-600">Create complete example pages and objects for this theme, or copy existing content from your sites. Imported content becomes an independent copy owned by the theme.</p>
            </div>

            <section className="grid gap-3 rounded-lg border border-gray-200 bg-gray-50 p-4 lg:grid-cols-[auto_minmax(220px,1fr)_auto]">
                <button type="button" onClick={addPage} className="inline-flex items-center justify-center gap-2 rounded-md border border-gray-300 bg-white px-3 py-2 text-sm font-medium"><FileText className="h-4 w-4" />New page</button>
                <div className="flex min-w-0 gap-2">
                    <select aria-label="Object type for new preview" value={objectTypeKey} onChange={(event) => setObjectTypeKey(event.target.value)} disabled={!sources.objectTypes?.length} className="min-w-0 flex-1 rounded-md border border-gray-300 bg-white px-3 py-2 text-sm">
                        {!sources.objectTypes?.length && <option value="">No object types available</option>}
                        {sources.objectTypes?.map((type) => <option key={type.key} value={type.key}>{type.label}</option>)}
                    </select>
                    <button type="button" onClick={addObject} disabled={!objectTypeKey} className="inline-flex items-center gap-2 rounded-md border border-gray-300 bg-white px-3 py-2 text-sm font-medium disabled:opacity-50"><Box className="h-4 w-4" />New object</button>
                </div>
                {sourcesLoading && <span className="inline-flex items-center gap-2 text-sm text-gray-500"><Loader2 className="h-4 w-4 animate-spin" />Loading sources</span>}
            </section>

            <section className="space-y-3 rounded-lg border border-gray-200 p-4">
                <div><h3 className="font-medium text-gray-900">Copy existing content</h3><p className="mt-1 text-xs text-gray-500">The source stays unchanged. Site, hierarchy, publishing, and version links are removed; managed images are copied to this theme’s image library.</p></div>
                {canUseSources ? <div className="grid gap-3 md:grid-cols-[160px_minmax(0,1fr)_auto]">
                    <select aria-label="Content type to import" value={importKind} onChange={(event) => setImportKind(event.target.value)} className="rounded-md border border-gray-300 bg-white px-3 py-2 text-sm"><option value="page">Page</option><option value="object">Object</option></select>
                    <select aria-label="Content to import" value={importSourceId} onChange={(event) => setImportSourceId(event.target.value)} className="min-w-0 rounded-md border border-gray-300 bg-white px-3 py-2 text-sm">
                        {(importKind === 'page' ? sources.pages : sources.objects)?.map((source) => <option key={source.id} value={source.id}>{source.label}</option>)}
                    </select>
                    <button type="button" onClick={importContent} disabled={!importSourceId || importing} className="inline-flex items-center justify-center gap-2 rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-50">{importing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Copy className="h-4 w-4" />}Copy into theme</button>
                </div> : <p className="text-sm text-amber-700">Save the new theme before importing content or creating an object preview.</p>}
                {importError && <p role="alert" className="text-sm text-red-700">{importError}</p>}
            </section>

            {views.length === 0 ? <div className="rounded-lg border border-dashed border-gray-300 p-8 text-center text-sm text-gray-500">No preview content yet. Create a page or object, or copy existing content.</div> : (
                <div className="grid min-h-[560px] gap-4 lg:grid-cols-[240px_minmax(0,1fr)]">
                    <nav aria-label="Theme preview content" className="space-y-2 rounded-lg border border-gray-200 p-3">
                        {views.map((view) => <button key={view.id} type="button" onClick={() => setSelectedId(view.id)} className={`flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-sm ${view.id === selectedId ? 'bg-blue-50 font-medium text-blue-800' : 'text-gray-700 hover:bg-gray-50'}`}>{view.kind === 'object' ? <Box className="h-4 w-4" /> : <FileText className="h-4 w-4" />}<span className="min-w-0 flex-1 truncate">{view.label || view.id}</span></button>)}
                    </nav>

                    {selected && <section className="min-w-0 space-y-4 rounded-lg border border-gray-200 bg-white p-4">
                        <div className="flex flex-wrap items-end gap-3">
                            <label className="min-w-[220px] flex-1 text-sm font-medium text-gray-700">Preview name<input value={selected.label || ''} onChange={(event) => updateView({ label: event.target.value })} className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2" /></label>
                            <button type="button" onClick={removeSelected} className="inline-flex items-center gap-2 rounded-md border border-red-200 px-3 py-2 text-sm font-medium text-red-700 hover:bg-red-50"><Trash2 className="h-4 w-4" />Remove</button>
                        </div>

                        {selected.kind === 'page' && <div className="space-y-4">
                            <div className="grid gap-3 md:grid-cols-2">
                                <label className="text-sm font-medium text-gray-700">Page title<input value={selected.content?.title || ''} onChange={(event) => updateContent({ title: event.target.value })} className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2" /></label>
                                <label className="text-sm font-medium text-gray-700">Layout<select value={pageVersion.codeLayout} onChange={(event) => updateView({ layout: event.target.value, content: { ...selected.content, codeLayout: event.target.value } })} className="mt-1 w-full rounded-md border border-gray-300 bg-white px-3 py-2">{sources.layouts?.map((layout) => <option key={layout.key} value={layout.key}>{layout.label}</option>)}{!sources.layouts?.some((layout) => layout.key === pageVersion.codeLayout) && <option value={pageVersion.codeLayout}>{pageVersion.codeLayout}</option>}</select></label>
                            </div>
                            <div className="min-h-[440px] overflow-hidden rounded-lg border border-gray-200">
                                <PageContentEditor webpageData={pageData} pageVersionData={pageVersion} editable applyPageTheme={false} localWidgets={pageWidgets} onLocalWidgetUpdate={(widgets) => updateContent({ widgets })} onOpenWidgetEditor={(widget) => setWidgetEditor({ open: true, widget })} inheritedWidgets={{}} slotInheritanceRules={{}} context={{ pageId: selected.id, mode: 'theme-preview', contextType: 'page' }} />
                            </div>
                            <WidgetEditorPanel isOpen={widgetEditor.open} onClose={() => setWidgetEditor({ open: false, widget: null })} onSave={savePageWidget} onRealTimeUpdate={(widget) => updateContent({ widgets: applyWidgetUpdateToWidgetMap(pageWidgets, widget) })} widgetData={widgetEditor.widget} title={widgetEditor.widget ? `Edit ${widgetEditor.widget.name || widgetEditor.widget.type}` : 'Edit widget'} autoOpenSpecialEditor webpageData={pageData} pageVersionData={pageVersion} context={{ pageId: selected.id, versionId: selected.id, contextType: 'page' }} />
                        </div>}

                        {selected.kind === 'object' && objectType && <div className="grid gap-6 xl:grid-cols-2">
                            <div className="min-w-0 rounded-lg border border-gray-200 p-4"><ObjectContentEditor key={selected.id} objectType={objectType} widgets={selected.content?.widgets || {}} onWidgetChange={(widgets) => updateContent({ widgets })} context={{ instanceId: selected.id, mode: 'theme-preview', contextType: 'object' }} /></div>
                            <div className="min-w-0 rounded-lg border border-gray-200 p-4"><ObjectDataForm key={selected.id} ref={objectFormRef} objectType={objectType} instance={objectInstance} isNewInstance={false} onFormChange={(form) => updateContent({ title: form.title, data: form.data })} context={{ instanceId: selected.id, mode: 'theme-preview', contextType: 'object' }} /></div>
                        </div>}
                    </section>}
                </div>
            )}

            <p className="flex items-center gap-2 text-xs text-gray-500"><Plus className="h-3.5 w-3.5" />Preview content is saved with the theme and is never published as a real page or object.</p>
        </div>
    )
}

export default PreviewViewsTab
