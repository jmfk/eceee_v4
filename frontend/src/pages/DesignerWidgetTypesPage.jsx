import { useEffect, useState } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { compileRenderStyles } from '../rendering/themeCssCompiler'
import { useQueryClient } from '@tanstack/react-query'
import { Link, useNavigate, useParams } from 'react-router-dom'
import DesignerNavbar from '../components/DesignerNavbar'
import VisualSchemaEditor from '../components/VisualSchemaEditor'
import SchemaFieldRenderer from '../components/forms/SchemaFieldRenderer'
import { fieldTypeRegistry } from '../utils/fieldTypeRegistry'
import { designerThemesApi } from '../api/designerThemes'
import { ThemeWidgetRender } from '../rendering/ThemeWidgetRender'
import { emptyThemeWidgets, normalizeAuthoredWidgetSchema, resolveThemeWidget } from '../rendering/themeWidgets'
import SlotWidgetTypeSelect from '../components/designer/SlotWidgetTypeSelect'
import { slotWidgetTypeOptions } from '../components/designer/slotWidgetTypeOptions'

const areaLabels = { widget_types: 'Widget types', colors: 'Colors', fonts: 'Fonts', design_groups: 'Design groups', designer_preview: 'Preview content', layouts: 'Layouts', image: 'Theme image', site_icon: 'Site icon', name: 'Name', description: 'Description' }
const allowedFields = ['text', 'textarea', 'rich_text', 'image', 'url', 'number', 'boolean', 'choice']
const blankDefinition = () => ({ schema: { type: 'object', properties: {}, required: [] }, template: '<article>\n  <h2>{{title}}</h2>\n</article>', css: '' })
const inputClass = 'w-full border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 px-3 py-2 text-sm'

export default function DesignerWidgetTypesPage() {
    const { themeId, widgetTypeId } = useParams()
    const navigate = useNavigate()
    const queryClient = useQueryClient()
    const [workspace, setWorkspace] = useState(null)
    const [document, setDocument] = useState(emptyThemeWidgets)
    const [compiled, setCompiled] = useState(null)
    const [error, setError] = useState('')
    const [previewError, setPreviewError] = useState('')
    const [busy, setBusy] = useState(false)
    const [dirty, setDirty] = useState(false)
    const [width, setWidth] = useState(768)
    const [fieldsReady, setFieldsReady] = useState(false)
    const item = document.items.find(candidate => candidate.id === widgetTypeId)
    const sample = item?.example_data || {}
    const working = item?.working || item?.releases?.find(release => release.version === item.active_version)
    const baseRelease = working?.kind === 'derived' ? (working.base_type?.startsWith('theme_widgets.')
        ? resolveThemeWidget(document, working)
        : { schema: workspace?.widgetSchemas?.[working.base_type], defaults: {} }) : working
    const slotNames = working?.kind === 'derived' ? (workspace?.catalog?.widgetSlots || [])
        .find(candidate => candidate.widgetType === working.base_type)?.slots?.map(slot => slot.name) || [] : []
    const choices = workspace ? slotWidgetTypeOptions(workspace).filter(option => !option.value.includes('*')) : []
    const bases = choices.filter(option => !option.value.startsWith('theme_widgets.') ||
        document.items.some(candidate => `theme_widgets.${candidate.id}` === option.value &&
            candidate.releases.some(release => release.version === candidate.active_version && release.kind !== 'derived')))

    const accept = (value) => {
        setWorkspace(value)
        setDocument(value.widgetTypes || emptyThemeWidgets())
        setDirty(false)
    }
    useEffect(() => {
        let active = true
        designerThemesApi.workspace(themeId).then(value => { if (active) accept(value) })
            .catch(err => { if (active) setError(err.message) })
        fieldTypeRegistry.ensureLoaded().then(() => { if (active) setFieldsReady(true) })
            .catch(err => { if (active) setError(err.message) })
        return () => { active = false }
    }, [themeId])

    useEffect(() => {
        setCompiled(null)
        setPreviewError('')
        if (!item || !working) return
        let active = true
        const timer = setTimeout(() => designerThemesApi.previewWidget(themeId, item.id, working, document)
            .then(value => { if (active) setCompiled(value.definition) })
            .catch(err => { if (active) setPreviewError(err.response?.data ? JSON.stringify(err.response.data) : err.message) }), 350)
        return () => { active = false; clearTimeout(timer) }
    }, [themeId, item?.id, working])

    useEffect(() => {
        if (!dirty) return
        const guard = event => { event.preventDefault(); event.returnValue = '' }
        window.addEventListener('beforeunload', guard)
        return () => window.removeEventListener('beforeunload', guard)
    }, [dirty])

    const changeItem = (patch) => {
        setDocument(current => ({ ...current, items: current.items.map(candidate => candidate.id === widgetTypeId ? { ...candidate, ...patch } : candidate) }))
        setDirty(true)
    }
    const changeDefinition = patch => changeItem({ working: { ...working, ...patch } })
    const createItem = async (newItem) => {
        setBusy(true); setError('')
        try {
            const next = { ...document, items: [...document.items, newItem] }
            accept(await designerThemesApi.save(themeId, { draftVersion: workspace.draftVersion, widgetTypes: next }))
            navigate(`/designer/themes/${themeId}/widgets/${newItem.id}`)
        } catch (err) { setError(err.response?.data ? JSON.stringify(err.response.data) : err.message) }
        finally { setBusy(false) }
    }
    const create = () => {
        const id = crypto.randomUUID()
        const definition = blankDefinition()
        definition.schema.properties.title = { type: 'string', title: 'Title', default: '', fieldType: 'text' }
        createItem({ id, name: 'New widget', status: 'active', active_version: 0, releases: [], working: definition })
    }
    const createDerived = (baseType) => {
        if (!baseType) return
        const id = crypto.randomUUID()
        const base = document.items.find(candidate => `theme_widgets.${candidate.id}` === baseType)
        const definition = { kind: 'derived', base_type: baseType, base_version: base?.active_version || null,
            defaults: {}, slot_policies: {} }
        createItem({ id, name: 'New derived widget', status: 'active', active_version: 0, releases: [], working: definition })
    }
    const save = async () => {
        const value = await designerThemesApi.save(themeId, { draftVersion: workspace.draftVersion, widgetTypes: document })
        accept(value)
        return value
    }
    const act = async (publish) => {
        setBusy(true); setError('')
        try {
            const value = dirty ? await save() : workspace
            if (publish) {
                accept(await designerThemesApi.publish(themeId, value.draftVersion))
                queryClient.invalidateQueries({ queryKey: ["themes"] })
                queryClient.invalidateQueries({ queryKey: ["widget-types"] })
            }
        } catch (err) { setError(err.response?.data ? JSON.stringify(err.response.data) : err.message) }
        finally { setBusy(false) }
    }
    if (!workspace) return <main className="p-6">{error ? <p role="alert">{error}</p> : 'Loading widget types…'}</main>
    const themeStyles = compileRenderStyles({ theme: workspace.themeConfig })
    const previewDocument = compiled && item ? { ...document, items: document.items.map(candidate => candidate.id === item.id
        ? { ...candidate, releases: [...candidate.releases.filter(release => release.version !== compiled.version), compiled] }
        : candidate) } : null
    const previewMarkup = compiled && previewDocument ? renderToStaticMarkup(<ThemeWidgetRender widget={{ id: "preview", type: `theme_widgets.${item.id}`, typeVersion: compiled.version, config: { ...compiled.defaults, ...sample } }} context={{ preview: true, themeWidgetTypes: previewDocument }} renderWidgets={() => null} />) : ""
    const previewHtml = `<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"><style>body{margin:16px;font-family:system-ui}${themeStyles.css}</style></head><body class="cms-content">${previewMarkup}</body></html>`
    return <div className="min-h-screen bg-white text-gray-900 dark:bg-gray-900 dark:text-gray-100" onClickCapture={event => { if (dirty && event.target.closest?.("a")) { event.preventDefault(); setError("Save the draft before leaving this editor.") } }}>
        <DesignerNavbar />
        <main className="p-6"><fieldset disabled={busy} className="min-w-0 space-y-6">
            <header className="flex flex-wrap items-center justify-between gap-4">
                <div><Link to={`/designer/themes/${themeId}`} onClick={event => { if (dirty) event.preventDefault() }} className="text-sm underline">{workspace.name}</Link><h1 className="text-2xl font-semibold">Widget types</h1></div>
                <div className="flex flex-wrap gap-3">
                    {dirty && <button className="border border-gray-300 px-3 py-2" onClick={() => { setDocument(workspace.widgetTypes || emptyThemeWidgets()); setDirty(false); setError(''); if (!workspace.widgetTypes?.items.some(type => type.id === widgetTypeId)) navigate(`/designer/themes/${themeId}/widgets`) }}>Discard local changes</button>}
                    <button className="border border-gray-300 px-3 py-2 disabled:opacity-40" disabled={busy || !dirty} onClick={() => act(false)}>Save draft</button>
                    <button className="border border-blue-600 bg-blue-600 px-3 py-2 text-white disabled:opacity-40" disabled={busy || (!dirty && !workspace.hasDraftChanges)} onClick={() => act(true)}>Publish theme</button>
                </div>
            </header>
            <p className="text-sm text-gray-500">Publishing applies the complete shared theme draft. Existing widgets keep their type version.</p>
            {workspace.hasDraftChanges && <p className="text-sm">Unpublished areas: {(workspace.draftChangedAreas || []).map(key => areaLabels[key] || key.replaceAll("_", " ")).join(", ") || "theme settings"}. Review the <Link className="underline" to={`/designer/themes/${themeId}`} onClick={event => { if (dirty) event.preventDefault() }}>theme draft</Link> before publishing.</p>}
            {dirty && <p role="status" className="text-sm">Unsaved changes. Save the draft before leaving this editor.</p>}
            {error && <p role="alert" className="text-red-700">{error}</p>}
            {!widgetTypeId ? <section className="space-y-4">
                <button className="border border-blue-600 bg-blue-600 px-3 py-2 text-white" onClick={create}>Create widget type</button>
                <label className="block max-w-md text-sm">Create from existing widget
                    <select aria-label="Create from existing widget" className={inputClass} value="" onChange={event => createDerived(event.target.value)}>
                        <option value="">Choose a base widget…</option>
                        {bases.map(base => <option key={base.value} value={base.value}>{base.label}</option>)}
                    </select>
                </label>
                {!document.items.length && <p>No widget types yet.</p>}
                {document.items.map(type => <div key={type.id} className="flex justify-between py-3 border-b">
                    <Link className="underline" to={`/designer/themes/${themeId}/widgets/${type.id}`}>{type.name}</Link>
                    <span className="text-sm text-gray-500">{type.working?.base_type || type.releases.find(release => release.version === type.active_version)?.base_type ? `From ${type.working?.base_type || type.releases.find(release => release.version === type.active_version)?.base_type} · ` : ''}{type.status === 'archived' ? 'Archived' : `Version ${type.active_version || 'unpublished'}`}{type.working ? ' · Draft' : ''}</span>
                </div>)}
            </section> : item ? <>
                <button className="underline text-sm" disabled={dirty} onClick={() => { navigate(`/designer/themes/${themeId}/widgets`) }}>All widget types</button>
                <div className="grid grid-cols-1 xl:grid-cols-2 gap-8">
                    <section className="space-y-6">
                        <label className="block text-sm">Name<input className={inputClass} value={item.name} onChange={event => changeItem({ name: event.target.value })} /></label>
                        <label className="block text-sm">Description<input className={inputClass} value={item.description || ''} onChange={event => changeItem({ description: event.target.value })} /></label>
                        <label className="flex gap-2 text-sm"><input type="checkbox" checked={item.status === 'archived'} onChange={event => changeItem({ status: event.target.checked ? 'archived' : 'active' })} />Archived — keep existing instances, hide from new selections</label>
                        {working?.kind === 'derived' ? <>
                            <p className="text-sm">Base: {working.base_type}{working.base_version ? ` · version ${working.base_version}` : ''}. The base cannot change after publication.</p>
                            {!item.releases.length && <label className="block text-sm">Base widget<select className={inputClass} value={working.base_type} onChange={event => {
                                const base = document.items.find(candidate => `theme_widgets.${candidate.id}` === event.target.value)
                                changeDefinition({ base_type: event.target.value, base_version: base?.active_version || null, defaults: {}, slot_policies: {} })
                            }}>{bases.map(base => <option key={base.value} value={base.value}>{base.label}</option>)}</select></label>}
                            <h2 className="text-lg font-semibold">Inherited fields and defaults</h2>
                            {Object.entries(baseRelease?.schema?.properties || {}).filter(([name]) => name !== 'slots').map(([name, field]) => <SchemaFieldRenderer key={name} fieldName={name} fieldSchema={field} schema={baseRelease.schema} value={working.defaults?.[name] ?? field.default} context={{ theme: workspace.themeConfig }} namespace={workspace.mediaNamespace} onChange={(key, value) => changeDefinition({ defaults: { ...working.defaults, [key]: value } })} />)}
                            <h2 className="text-lg font-semibold">Inherited slots</h2>
                            {slotNames.length ? slotNames.map(name => {
                                const policy = working.slot_policies?.[name] || { mode: 'inherit' }
                                return <fieldset key={name} className="space-y-2 border-b pb-3"><legend className="text-sm font-medium">{name}</legend>
                                    <label className="block text-sm">Allowed children<select className={inputClass} value={policy.mode} onChange={event => changeDefinition({ slot_policies: { ...working.slot_policies, [name]: { mode: event.target.value } } })}>
                                        <option value="inherit">Inherit base policy</option><option value="allow">Allow selected types</option><option value="none">No widgets</option>
                                    </select></label>
                                    {policy.mode === 'allow' && <SlotWidgetTypeSelect label={`Allowed in ${name}`} value={policy.allowed_widget_types || []} options={choices} onChange={types => changeDefinition({ slot_policies: { ...working.slot_policies, [name]: { mode: 'allow', allowed_widget_types: types } } })} />}
                                </fieldset>
                            }) : <p className="text-sm text-gray-500">This base has no child slots.</p>}
                        </> : <>
                            <h2 className="text-lg font-semibold">Fields</h2>
                            {fieldsReady && <VisualSchemaEditor key={item.id} schema={working?.schema} allowedFieldTypes={allowedFields} onChange={schema => changeDefinition({ schema: normalizeAuthoredWidgetSchema(schema) })} />}
                            <label className="block text-sm">HTML / Mustache<textarea className={`${inputClass} font-mono min-h-48`} value={working?.template || ''} onChange={event => changeDefinition({ template: event.target.value })} /></label>
                            <label className="block text-sm">CSS<textarea className={`${inputClass} font-mono min-h-40`} value={working?.css || ''} onChange={event => changeDefinition({ css: event.target.value })} /></label>
                        </>}
                    </section>
                    <section className="min-w-0 space-y-4">
                        <h2 className="text-lg font-semibold">Preview</h2>
                        <label className="block text-sm">Viewport<select className={inputClass} value={width} onChange={event => setWidth(Number(event.target.value))}><option value={375}>Mobile — 375px</option><option value={768}>Tablet — 768px</option><option value={1280}>Desktop — 1280px</option></select></label>
                        {previewError && <p role="alert" className="text-red-700">{previewError}</p>}
                        <div className="overflow-auto border p-4"><iframe title="Widget preview" sandbox="" srcDoc={previewHtml} style={{ width, height: 420, border: 0, pointerEvents: 'none' }} /></div>
                        <h2 className="text-lg font-semibold">Example data</h2>
                        {fieldsReady && Object.entries(baseRelease?.schema?.properties || {}).filter(([name]) => name !== 'slots').map(([name, field]) => <SchemaFieldRenderer key={`${item.id}:${name}`} fieldName={name} fieldSchema={field} schema={baseRelease.schema} value={sample[name] ?? field.default} namespace={workspace.mediaNamespace} onChange={(key, value) => changeItem({ example_data: { ...sample, [key]: value } })} context={{ theme: workspace.themeConfig }} />)}
                    </section>
                </div>
            </> : <p role="alert">Widget type not found in this theme.</p>}
        </fieldset></main>
    </div>
}
