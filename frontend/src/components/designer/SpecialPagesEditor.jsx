import { useEffect, useMemo, useRef, useState } from 'react'
import { FileKey, Plus, ShieldAlert, Trash2 } from 'lucide-react'

import { useUnifiedData } from '../../contexts/unified-data/context/UnifiedDataContext'
import { OperationTypes } from '../../contexts/unified-data/types/operations'
import PageContentEditor from '../../editors/page-editor/PageContentEditor'
import { buildDesignerTheme } from '../../utils/editorThemeCSS'
import { applyWidgetUpdateToWidgetMap } from '../../utils/pageEditorWidgetState'
import WidgetEditorPanel from '../WidgetEditorPanel'

const newId = () => globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(36).slice(2)}`
const routeKey = (route) => `route_${String(route || 'special').replace(/[^a-z0-9]+/gi, '_').replace(/^_+|_+$/g, '').toLowerCase()}`
const widgetTypeMatches = (widgetType, patterns) => typeof widgetType === 'string' && patterns.some((pattern) => (
    pattern === '*' || widgetType === pattern || (pattern.endsWith('.*') && widgetType.startsWith(pattern.slice(0, -1)))
))

const SpecialPagesEditor = ({ workspace, updateWorkspace, disabled }) => {
    const layouts = workspace.layouts
    const pages = useMemo(() => layouts.special_pages || [], [layouts.special_pages])
    const [selectedId, setSelectedId] = useState(pages[0]?.id || '')
    const [widgetEditor, setWidgetEditor] = useState({ open: false, widget: null })
    const pendingSelectionRef = useRef('')
    const { publishUpdate } = useUnifiedData()

    useEffect(() => {
        if (pendingSelectionRef.current) {
            if (pages.some((page) => page.id === pendingSelectionRef.current)) pendingSelectionRef.current = ''
            else return
        }
        if (!pages.some((page) => page.id === selectedId)) setSelectedId(pages[0]?.id || '')
    }, [pages, selectedId])

    const selectedIndex = pages.findIndex((page) => page.id === selectedId)
    const selected = selectedIndex >= 0 ? pages[selectedIndex] : null
    const updatePages = (nextPages) => updateWorkspace((current) => ({
        ...current,
        layouts: { ...current.layouts, special_pages: nextPages },
    }))
    const updateSelected = (updates) => {
        if (selectedIndex < 0) return
        updatePages(pages.map((page, index) => index === selectedIndex ? { ...page, ...updates } : page))
    }
    const changeLayout = (layoutKey) => {
        const nextLayout = layouts.items.find((layout) => layout.key === layoutKey)
        if (!nextLayout) return
        let removedWidgetCount = 0
        const nextWidgets = Object.fromEntries(Object.entries(widgets).flatMap(([slot, items]) => {
            const policy = nextLayout.slots?.[slot]
            if (!policy || !Array.isArray(items)) {
                removedWidgetCount += Array.isArray(items) ? items.length : 0
                return []
            }
            const allowedTypes = policy.allowed_widget_types || []
            const disallowedTypes = policy.disallowed_widget_types || []
            let compatible = items.filter((widget) => (
                (!allowedTypes.length || widgetTypeMatches(widget.type, allowedTypes))
                && !widgetTypeMatches(widget.type, disallowedTypes)
            ))
            if (Number.isInteger(policy.max_widgets) && policy.max_widgets >= 0) {
                compatible = compatible.slice(0, policy.max_widgets)
            }
            removedWidgetCount += items.length - compatible.length
            return compatible.length ? [[slot, compatible]] : []
        }))
        if (removedWidgetCount > 0 && !window.confirm(
            `Switch layouts and remove ${removedWidgetCount} widget${removedWidgetCount === 1 ? '' : 's'} from slots that are not available in “${nextLayout.label}”?`,
        )) return
        updateSelected({ layout_key: layoutKey, widgets: nextWidgets })
    }

    const addRoutePage = () => {
        const id = newId()
        const page = {
            id,
            key: `special_${id.replace(/-/g, '').slice(0, 12)}`,
            label: 'New special page',
            kind: 'route',
            route: 'special-page',
            layout_key: layouts.default_layout_key || layouts.items[0]?.key || 'main_layout',
            widgets: {},
        }
        pendingSelectionRef.current = id
        updatePages([...pages, page])
        setSelectedId(id)
    }

    const removeSelected = () => {
        if (!selected || selected.kind === 'error') return
        if (!window.confirm(`Remove “${selected.label}” from this theme?`)) return
        updatePages(pages.filter((page) => page.id !== selected.id))
    }

    const widgets = useMemo(() => selected?.widgets || {}, [selected?.widgets])
    const effectiveTheme = useMemo(() => buildDesignerTheme(workspace), [workspace])
    const pageVersion = useMemo(() => selected ? ({
        id: selected.id,
        versionId: selected.id,
        versionNumber: 1,
        codeLayout: selected.layout_key,
        layoutKey: selected.layout_key,
        pageData: { title: selected.label, specialPageKey: selected.key },
        widgets,
        effectiveTheme,
    }) : null, [effectiveTheme, selected, widgets])
    const pageData = selected ? { id: selected.id, title: selected.label } : null

    useEffect(() => {
        if (!selected) return
        const componentId = `theme-special-page-${selected.id}`
        void publishUpdate(componentId, OperationTypes.INIT_PAGE, {
            id: selected.id,
            data: { id: selected.id, title: selected.label },
        })
        void publishUpdate(`${componentId}-version`, OperationTypes.INIT_VERSION, {
            id: selected.id,
            data: pageVersion,
        })
    }, [pageVersion, publishUpdate, selected])

    const updateWidget = (widget) => updateSelected({ widgets: applyWidgetUpdateToWidgetMap(widgets, widget) })
    const saveWidget = async (widget) => {
        updateWidget(widget)
        setWidgetEditor({ open: false, widget: null })
    }

    return <div className="min-h-0 flex-1 overflow-auto bg-gray-50 p-4">
        <div className="mx-auto max-w-[1500px] space-y-4">
            <header className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-gray-200 bg-white p-4">
                <div><h2 className="font-semibold text-gray-900">Special pages</h2><p className="mt-1 text-sm text-gray-600">Error and system routes live in the theme. Their widgets are static theme data and do not create page versions. An exact special route takes precedence over a CMS page at the same path.</p></div>
                <button type="button" onClick={addRoutePage} disabled={disabled} className="inline-flex items-center gap-2 rounded-md bg-blue-600 px-3 py-2 text-sm font-medium text-white disabled:opacity-40"><Plus className="h-4 w-4" />New special page</button>
            </header>

            <div className="grid min-h-[640px] gap-4 xl:grid-cols-[260px_minmax(0,1fr)]">
                <nav aria-label="Theme special pages" className="space-y-1 rounded-lg border border-gray-200 bg-white p-3">
                    {pages.map((page) => <button key={page.id} type="button" onClick={() => setSelectedId(page.id)} className={`flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-sm ${page.id === selectedId ? 'bg-blue-50 font-medium text-blue-800' : 'text-gray-700 hover:bg-gray-50'}`}>{page.kind === 'error' ? <ShieldAlert className="h-4 w-4" /> : <FileKey className="h-4 w-4" />}<span className="min-w-0 flex-1 truncate">{page.label}</span>{page.kind === 'route' && <span className="text-[10px] text-gray-400">/{page.route}</span>}</button>)}
                </nav>

                {selected && <section className="relative min-w-0 space-y-4 rounded-lg border border-gray-200 bg-white p-4">
                    <fieldset disabled={disabled} className="space-y-3">
                        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-[minmax(180px,1fr)_minmax(180px,1fr)_minmax(180px,1fr)_auto]">
                            <label className="text-xs font-medium text-gray-700">Name<input value={selected.label} onChange={(event) => updateSelected({ label: event.target.value })} className="mt-1 w-full rounded border border-gray-300 px-3 py-2 text-sm" /></label>
                            <label className="text-xs font-medium text-gray-700">Key<input value={selected.key} disabled={selected.kind === 'error'} onChange={(event) => updateSelected({ key: event.target.value.toLowerCase().replace(/[^a-z0-9_]/g, '_') })} className="mt-1 w-full rounded border border-gray-300 px-3 py-2 font-mono text-sm disabled:bg-gray-100" /></label>
                            {selected.kind === 'route' ? <label className="text-xs font-medium text-gray-700">Public route<input value={selected.route || ''} onChange={(event) => { const route = event.target.value.replace(/^\/+/, ''); updateSelected({ route, key: selected.key.startsWith('special_') ? routeKey(route) : selected.key }) }} placeholder="login" className="mt-1 w-full rounded border border-gray-300 px-3 py-2 text-sm" /></label> : <label className="text-xs font-medium text-gray-700">HTTP status<input value={selected.status_code} disabled className="mt-1 w-full rounded border border-gray-300 bg-gray-100 px-3 py-2 text-sm" /></label>}
                            <label className="text-xs font-medium text-gray-700">Layout<select value={selected.layout_key} onChange={(event) => changeLayout(event.target.value)} className="mt-1 w-full rounded border border-gray-300 bg-white px-3 py-2 text-sm">{layouts.items.filter((layout) => layout.status !== 'archived').map((layout) => <option key={layout.key} value={layout.key}>{layout.label}</option>)}</select></label>
                            {selected.kind === 'route' && <button type="button" onClick={removeSelected} className="self-end inline-flex min-h-10 items-center justify-center gap-2 rounded border border-red-200 px-3 py-2 text-sm text-red-700 hover:bg-red-50"><Trash2 className="h-4 w-4" />Remove</button>}
                        </div>
                    </fieldset>
                    <div className="min-h-[500px] overflow-hidden rounded-lg border border-gray-200">
                        <PageContentEditor webpageData={pageData} pageVersionData={pageVersion} editable={!disabled} localWidgets={widgets} onLocalWidgetUpdate={(nextWidgets) => updateSelected({ widgets: nextWidgets })} onOpenWidgetEditor={(widget) => setWidgetEditor({ open: true, widget })} inheritedWidgets={{}} slotInheritanceRules={{}} context={{ pageId: selected.id, mode: 'theme-special-page', contextType: 'page' }} />
                    </div>
                    <WidgetEditorPanel isOpen={widgetEditor.open} onClose={() => setWidgetEditor({ open: false, widget: null })} onSave={saveWidget} onRealTimeUpdate={updateWidget} widgetData={widgetEditor.widget} title={widgetEditor.widget ? `Edit ${widgetEditor.widget.name || widgetEditor.widget.type}` : 'Edit widget'} autoOpenSpecialEditor namespace={workspace.mediaNamespace} webpageData={pageData} pageVersionData={pageVersion} context={{ pageId: selected.id, versionId: selected.id, contextType: 'page', mode: 'theme-special-page' }} showPublishingFields={false} />
                </section>}
            </div>
        </div>
    </div>
}

export default SpecialPagesEditor
