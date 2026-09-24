import { Box, FileText, Plus, Trash2 } from 'lucide-react'

const parseJsonObject = (value) => {
    const parsed = JSON.parse(value || '{}')
    if (!parsed || Array.isArray(parsed) || typeof parsed !== 'object') throw new Error('Use a JSON object')
    return parsed
}

const PreviewViewsTab = ({ designerPreview, onChange }) => {
    const views = Array.isArray(designerPreview?.views) ? designerPreview.views : []

    const updateView = (index, updates) => {
        const next = views.map((view, viewIndex) => viewIndex === index ? { ...view, ...updates } : view)
        onChange({ ...(designerPreview || {}), views: next })
    }

    const addView = (kind) => {
        const number = views.length + 1
        onChange({
            ...(designerPreview || {}),
            views: [...views, {
                id: `${kind}-preview-${number}`,
                label: kind === 'object' ? `Object preview ${number}` : `Page preview ${number}`,
                kind,
                layout: 'main_layout',
                texts: {},
                images: {},
            }],
        })
    }

    return (
        <div className="space-y-6">
            <div className="flex flex-wrap items-start justify-between gap-3">
                <div><h2 className="text-lg font-semibold text-gray-900">Designer preview views</h2><p className="mt-1 max-w-3xl text-sm text-gray-600">Define the page and object examples shown to designers. Demo content is stored with the theme and never becomes published page or object content.</p></div>
                <div className="flex gap-2"><button type="button" onClick={() => addView('page')} className="inline-flex items-center gap-2 rounded-md border border-gray-300 px-3 py-2 text-sm"><FileText className="h-4 w-4" />Add page preview</button><button type="button" onClick={() => addView('object')} className="inline-flex items-center gap-2 rounded-md border border-gray-300 px-3 py-2 text-sm"><Box className="h-4 w-4" />Add object preview</button></div>
            </div>
            {views.length === 0 && <div className="rounded-lg border border-dashed border-gray-300 p-6 text-center text-sm text-gray-500">No custom preview views. Designer will generate one page preview for every registered layout.</div>}
            {views.map((view, index) => (
                <section key={`${view.id}-${index}`} className="space-y-4 rounded-lg border border-gray-200 p-4">
                    <div className="flex items-center gap-3"><div className="rounded-md bg-gray-100 p-2">{view.kind === 'object' ? <Box className="h-5 w-5" /> : <FileText className="h-5 w-5" />}</div><h3 className="flex-1 font-medium text-gray-900">{view.label || view.id || `Preview ${index + 1}`}</h3><button type="button" aria-label={`Remove ${view.label || view.id}`} onClick={() => onChange({ ...(designerPreview || {}), views: views.filter((_, viewIndex) => viewIndex !== index) })} className="rounded-md p-2 text-red-600 hover:bg-red-50"><Trash2 className="h-4 w-4" /></button></div>
                    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                        <label className="text-sm font-medium text-gray-700">Visible name<input value={view.label || ''} onChange={(event) => updateView(index, { label: event.target.value })} className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2" /></label>
                        <label className="text-sm font-medium text-gray-700">Stable id<input value={view.id || ''} onChange={(event) => updateView(index, { id: event.target.value })} className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 font-mono text-xs" /></label>
                        <label className="text-sm font-medium text-gray-700">Preview type<select value={view.kind || 'page'} onChange={(event) => updateView(index, { kind: event.target.value })} className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2"><option value="page">Page</option><option value="object">Object</option></select></label>
                        <label className="text-sm font-medium text-gray-700">Layout key<input value={view.layout || ''} onChange={(event) => updateView(index, { layout: event.target.value })} className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 font-mono text-xs" /></label>
                    </div>
                    <div className="grid gap-4 lg:grid-cols-2">
                        <label className="text-sm font-medium text-gray-700">Demo text by element id<textarea key={`texts-${view.id}-${JSON.stringify(view.texts || {})}`} defaultValue={JSON.stringify(view.texts || {}, null, 2)} onBlur={(event) => { try { updateView(index, { texts: parseJsonObject(event.target.value) }); event.target.setCustomValidity('') } catch (error) { event.target.setCustomValidity(error.message); event.target.reportValidity() } }} rows={8} className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 font-mono text-xs" /></label>
                        <label className="text-sm font-medium text-gray-700">Demo images by element id<textarea key={`images-${view.id}-${JSON.stringify(view.images || {})}`} defaultValue={JSON.stringify(view.images || {}, null, 2)} onBlur={(event) => { try { updateView(index, { images: parseJsonObject(event.target.value) }); event.target.setCustomValidity('') } catch (error) { event.target.setCustomValidity(error.message); event.target.reportValidity() } }} rows={8} className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 font-mono text-xs" /></label>
                    </div>
                </section>
            ))}
            <p className="flex items-center gap-2 text-xs text-gray-500"><Plus className="h-3.5 w-3.5" />Designers can replace these text and image values from the visual preview without seeing layout, group, or component-style terminology.</p>
        </div>
    )
}

export default PreviewViewsTab
