import { useMemo, useState } from 'react'
import { useMutation, useQuery } from '@tanstack/react-query'
import { ArrowRight, Code2, Database, Eye, Grid3X3, Loader2, Plus, X } from 'lucide-react'
import { useNavigate } from 'react-router-dom'

import { layoutWorkspacesApi } from '../api/layoutWorkspaces'
import { layoutsApi } from '../api/layouts'
import { themesApi } from '../api/themes'
import ContextualHelpLink from './help/ContextualHelpLink'

const uuid = () => crypto.randomUUID()

const slotNode = (slotKey) => ({
    id: uuid(),
    type: 'slot',
    slot_key: slotKey,
    children: [],
    styles: {},
    class_names: ['layout-slot', `slot-${slotKey.replaceAll('_', '-')}`],
})

const convertedLayout = (layout) => {
    const key = layout.name
    const slots = layout.slotConfiguration?.slots || []
    const slotDefinitions = Object.fromEntries(slots.map((slot, index) => {
        const allowedTypes = slot.allowedWidgetTypes || slot.allowed_widget_types || slot.allowedTypes || slot.allowed_types
        const disallowedTypes = slot.disallowedWidgetTypes || slot.disallowed_widget_types || slot.disallowedTypes || slot.disallowed_types
        return [slot.name, {
            label: slot.title || slot.name.replaceAll('_', ' '),
            description: slot.description || 'Converted from the code-layout registry.',
            order: slot.order ?? (index + 1) * 10,
            max_widgets: slot.maxWidgets ?? slot.max_widgets ?? null,
            required: Boolean(slot.required),
            allows_inheritance: Boolean(slot.allowsInheritance ?? slot.allows_inheritance),
            allow_merge: Boolean(slot.allowMerge ?? slot.allow_merge),
            collapse_behavior: slot.collapseBehavior ?? slot.collapse_behavior ?? 'never',
            default_widgets: slot.defaultWidgets ?? slot.default_widgets ?? [],
            ...(allowedTypes ? { allowed_widget_types: allowedTypes } : {}),
            ...(disallowedTypes ? { disallowed_widget_types: disallowedTypes } : {}),
            ...(slot.inheritableTypes || slot.inheritable_types ? { inheritable_types: slot.inheritableTypes || slot.inheritable_types } : {}),
            ...(slot.dimensions ? { dimensions: slot.dimensions } : {}),
        }]
    }))
    const safeSlots = Object.keys(slotDefinitions).length ? slotDefinitions : {
        main: { label: 'Main', description: 'Primary content', order: 10, max_widgets: null, required: true, collapse_behavior: 'never', default_widgets: [] },
    }
    return {
        id: uuid(), key,
        label: layout.name.replaceAll('_', ' ').replace(/\b\w/g, (letter) => letter.toUpperCase()),
        description: layout.description || 'Converted from the legacy code-layout registry.', status: 'active',
        root: {
            id: uuid(), type: 'semantic', tag: 'main',
            children: Object.keys(safeSlots).map(slotNode),
            styles: { base: { width: '100%', display: 'flex', flex_direction: 'column' } },
            class_names: ['converted-code-layout', `layout-${key.replaceAll('_', '-')}`],
        },
        slots: safeSlots,
    }
}

const updatedConvertedLayout = (existingLayout, codeLayout) => {
    const converted = convertedLayout(codeLayout)
    if (!existingLayout) return converted

    const existingSlots = existingLayout.slots || {}
    const convertedSlots = converted.slots || {}
    const newSlotKeys = Object.keys(convertedSlots).filter((slotKey) => !existingSlots[slotKey])
    const refreshedSlots = Object.fromEntries(Object.entries(convertedSlots).map(([slotKey, definition]) => {
        const refreshed = { ...(existingSlots[slotKey] || {}), ...definition }
        if ('allowed_widget_types' in definition) delete refreshed.disallowed_widget_types
        if ('disallowed_widget_types' in definition) delete refreshed.allowed_widget_types
        return [slotKey, refreshed]
    }))
    const newSlotNodes = newSlotKeys.map(slotNode)
    const updatedRoot = newSlotNodes.length === 0
        ? existingLayout.root
        : existingLayout.root?.type === 'slot'
            ? {
                id: uuid(),
                type: 'container',
                label: 'Layout container',
                children: [existingLayout.root, ...newSlotNodes],
                styles: { base: { width: '100%' } },
                class_names: ['converted-code-layout-slots'],
            }
            : {
                ...existingLayout.root,
                children: [...(existingLayout.root?.children || []), ...newSlotNodes],
            }

    return {
        ...existingLayout,
        slots: { ...existingSlots, ...refreshedSlots },
        root: updatedRoot,
    }
}

const LayoutEditor = ({ className = '', themeId = null }) => {
    const navigate = useNavigate()
    const [previewLayout, setPreviewLayout] = useState(null)
    const [showConvert, setShowConvert] = useState(false)
    const [error, setError] = useState('')
    const themeQuery = useQuery({
        queryKey: ['layout-overview', themeId || 'default-theme'],
        queryFn: async () => themeId ? await themesApi.get(themeId) : await themesApi.getDefault(),
    })
    const codeQuery = useQuery({ queryKey: ['layout-overview', 'code-layouts'], queryFn: () => layoutsApi.codeLayouts.list(true, 'code') })
    const theme = themeQuery.data
    const layouts = useMemo(() => theme?.layouts?.items || [], [theme])
    const codeLayouts = codeQuery.data?.results || []
    const convertedKeys = useMemo(() => new Set(layouts.map((layout) => layout.key)), [layouts])

    const openDesigner = (layoutKey = '') => {
        if (!theme?.id) return
        const params = new URLSearchParams({ workspace: 'layouts' })
        if (layoutKey) params.set('layout', layoutKey)
        navigate(`/settings/themes/${theme.id}/layouts/editor?${params}`)
    }

    const convertMutation = useMutation({
        mutationFn: async (codeLayout) => {
            const workspace = await layoutWorkspacesApi.workspace(theme.id)
            const existingLayout = workspace.layouts.items.find((layout) => layout.key === codeLayout.name)
            const layout = updatedConvertedLayout(existingLayout, codeLayout)
            const items = existingLayout
                ? workspace.layouts.items.map((item) => item.key === codeLayout.name ? layout : item)
                : [...workspace.layouts.items, layout]
            await layoutWorkspacesApi.save(theme.id, workspace.draftVersion, { ...workspace.layouts, items })
            return layout.key
        },
        onSuccess: (layoutKey) => openDesigner(layoutKey),
        onError: (conversionError) => setError(conversionError.message || 'The code layout could not be converted.'),
    })

    if (themeQuery.isLoading || codeQuery.isLoading) return <div className={`flex h-64 items-center justify-center ${className}`}><Loader2 className="h-8 w-8 animate-spin text-blue-600" /><span className="ml-2 text-gray-600">Loading layouts…</span></div>

    return <div className={`layout-overview bg-white ${className}`}>
        <header className="border-b border-gray-200 p-6">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                <div><div className="flex items-center text-xl font-semibold text-gray-900" role="heading" aria-level="2"><Grid3X3 className="mr-2 h-6 w-6 text-blue-600" />Layouts<ContextualHelpLink topicId="settings-layouts" label="Open Layout help" className="ml-2" /></div><p className="mt-1 text-sm text-gray-600">Theme-owned React layouts available to pages using <span className="font-medium">{theme?.name || 'the default theme'}</span>.</p></div>
                <div className="flex flex-wrap gap-2">
                    <button type="button" onClick={() => setShowConvert(true)} className="inline-flex min-h-10 items-center gap-2 rounded-md border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"><Code2 className="h-4 w-4" />Convert Code Layout</button>
                    <button type="button" onClick={() => navigate(`/settings/themes/${theme.id}/layouts/editor?action=create`)} disabled={!theme?.id} className="inline-flex min-h-10 items-center gap-2 rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-40"><Plus className="h-4 w-4" />Create Layout</button>
                </div>
            </div>
        </header>
        {error && <div role="alert" className="border-b border-red-200 bg-red-50 px-6 py-3 text-sm text-red-800">{error}</div>}
        {themeQuery.isError && <div role="alert" className="m-6 rounded-md border border-red-200 bg-red-50 p-4 text-sm text-red-800">The default theme and its layouts could not be loaded.</div>}
        <section className="p-6" aria-label="Theme layouts">
            {layouts.length === 0 ? <div className="py-8 text-center"><Grid3X3 className="mx-auto h-12 w-12 text-gray-400" /><h3 className="mt-2 text-sm font-medium text-gray-900">No theme layouts found</h3><p className="mt-1 text-sm text-gray-500">Create a layout to start defining page structure.</p></div> : <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">{layouts.map((layout) => <LayoutCard key={layout.id || layout.key} layout={layout} isDefault={layout.key === theme.layouts.default_layout_key} onEdit={() => openDesigner(layout.key)} onPreview={() => setPreviewLayout(layout)} />)}</div>}
        </section>
        {showConvert && <ConvertDialog layouts={codeLayouts} convertedKeys={convertedKeys} convertingKey={convertMutation.isPending ? convertMutation.variables?.name : ''} onConvert={(layout) => convertMutation.mutate(layout)} onClose={() => setShowConvert(false)} />}
        {previewLayout && <LayoutPreviewModal layout={previewLayout} onClose={() => setPreviewLayout(null)} />}
    </div>
}

const LayoutCard = ({ layout, isDefault, onEdit, onPreview }) => <article data-testid={`layout-card-${layout.key}`} className="rounded-lg border border-gray-200 p-4 transition-shadow hover:shadow-md">
    <div className="flex items-start justify-between gap-3"><div className="min-w-0"><h3 className="truncate text-sm font-semibold text-gray-900">{layout.label || layout.key}</h3><p className="mt-1 flex items-center gap-1.5 text-xs text-blue-700"><Database className="h-3.5 w-3.5" />Theme Layout</p></div><button type="button" onClick={onPreview} className="rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-700" aria-label={`Preview ${layout.label || layout.key}`}><Eye className="h-4 w-4" /></button></div>
    <p className="mt-3 min-h-10 text-sm text-gray-600">{layout.description || 'No description.'}</p>
    <dl className="mt-3 space-y-2 text-xs"><div className="flex justify-between text-gray-500"><dt>Key</dt><dd className="font-mono text-gray-700">{layout.key}</dd></div><div className="flex justify-between text-gray-500"><dt>Slots</dt><dd className="font-medium text-gray-700">{Object.keys(layout.slots || {}).length}</dd></div><div className="flex justify-between text-gray-500"><dt>Status</dt><dd className="flex items-center gap-2">{isDefault && <span className="rounded-full bg-blue-50 px-2 py-1 font-medium text-blue-700">Default</span>}<span className={`rounded-full px-2 py-1 font-medium ${layout.status === 'archived' ? 'bg-gray-100 text-gray-700' : 'bg-green-100 text-green-800'}`}>{layout.status === 'archived' ? 'Archived' : 'Active'}</span></dd></div></dl>
    <button type="button" onClick={onEdit} className="mt-4 inline-flex min-h-9 w-full items-center justify-center gap-2 rounded-md border border-gray-300 px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50">Edit layout<ArrowRight className="h-4 w-4" /></button>
</article>

const ConvertDialog = ({ layouts, convertedKeys, convertingKey, onConvert, onClose }) => <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" role="dialog" aria-modal="true" aria-labelledby="convert-layout-title"><div className="w-full max-w-xl rounded-lg bg-white shadow-xl"><div className="flex items-start justify-between border-b border-gray-200 p-5"><div><h2 id="convert-layout-title" className="text-lg font-semibold text-gray-900">Convert Code Layout</h2><p className="mt-1 text-sm text-gray-600">Create a Theme Layout, or update its code-owned slot metadata without replacing Designer structure and styles.</p></div><button type="button" onClick={onClose} aria-label="Close convert dialog" className="rounded p-2 text-gray-400 hover:bg-gray-100 hover:text-gray-700"><X className="h-5 w-5" /></button></div><div className="max-h-[60vh] space-y-2 overflow-y-auto p-5">{layouts.map((layout) => { const converted = convertedKeys.has(layout.name); const converting = Boolean(convertingKey); const isCurrent = convertingKey === layout.name; return <div key={layout.name} className="flex items-center justify-between gap-4 rounded-md border border-gray-200 p-3"><div><p className="font-medium text-gray-900">{layout.name}</p><p className="mt-0.5 text-xs text-gray-500">{layout.slotConfiguration?.slots?.length || 0} slots{converted ? ' · Theme Layout exists' : ''}</p></div><button type="button" aria-label={`${converted ? 'Update' : 'Convert'} ${layout.name}`} disabled={converting} onClick={() => onConvert(layout)} className="min-w-24 rounded-md border border-gray-300 px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:bg-gray-50 disabled:text-gray-400">{isCurrent ? (converted ? 'Updating…' : 'Converting…') : (converted ? 'Update' : 'Convert')}</button></div> })}{layouts.length === 0 && <p className="py-6 text-center text-sm text-gray-500">No registered code layouts were found.</p>}</div></div></div>

const LayoutPreviewModal = ({ layout, onClose }) => <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" role="dialog" aria-modal="true" aria-labelledby="layout-preview-title"><div className="w-full max-w-2xl overflow-hidden rounded-lg bg-white shadow-xl"><div className="flex items-start justify-between border-b border-gray-200 p-5"><div><h2 id="layout-preview-title" className="text-lg font-semibold text-gray-900">{layout.label || layout.key}</h2><p className="mt-1 text-sm text-gray-600">Theme Layout · {layout.key}</p></div><button type="button" onClick={onClose} aria-label="Close layout preview" className="rounded p-2 text-gray-400 hover:bg-gray-100 hover:text-gray-700"><X className="h-5 w-5" /></button></div><div className="max-h-[65vh] overflow-y-auto p-5"><p className="text-sm text-gray-600">{layout.description || 'No description.'}</p><h3 className="mt-5 text-sm font-semibold text-gray-900">Slots ({Object.keys(layout.slots || {}).length})</h3><div className="mt-2 space-y-2">{Object.entries(layout.slots || {}).map(([key, slot]) => <div key={key} className="rounded-md bg-gray-50 p-3"><div className="flex justify-between gap-3"><span className="text-sm font-medium text-gray-900">{slot.label || key}</span><span className="font-mono text-xs text-gray-500">{key}</span></div>{slot.description && <p className="mt-1 text-xs text-gray-600">{slot.description}</p>}</div>)}</div></div></div></div>

export default LayoutEditor
