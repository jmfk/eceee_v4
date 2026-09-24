import { useEffect, useMemo, useRef, useState } from 'react'
import { ArrowLeft, Image as ImageIcon, Layers3, LayoutTemplate, Plus, Type } from 'lucide-react'

import { buildSemanticPreviewDocument } from './semanticPreview'

const typographyLabels = {
    fontFamily: 'Font family', fontSize: 'Size', fontWeight: 'Weight', fontStyle: 'Style',
    lineHeight: 'Line height', letterSpacing: 'Letter spacing',
}

const spacingLabels = {
    margin: 'Outer spacing', marginTop: 'Space above', marginRight: 'Space right', marginBottom: 'Space below', marginLeft: 'Space left',
    padding: 'Inner spacing', paddingTop: 'Inner top', paddingRight: 'Inner right', paddingBottom: 'Inner bottom', paddingLeft: 'Inner left',
}

const targetKindLabels = {
    asset: 'Image',
    componentStyle: 'Component style',
    element: 'Element',
    group: 'Design group',
    layout: 'Layout',
    layoutSlot: 'Layout area',
    part: 'Layout element',
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

const CatalogCard = ({ title, description, meta, icon, onClick }) => (
    <button type="button" onClick={onClick} className="overflow-hidden rounded-lg border border-gray-200 bg-white text-left transition hover:border-blue-400 hover:shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
        <div className="flex h-28 items-center justify-center border-b border-gray-200 bg-gray-50 p-4 text-gray-500">{icon}</div>
        <div className="p-3"><h4 className="font-medium text-gray-900">{title}</h4>{description && <p className="mt-1 line-clamp-2 text-xs text-gray-500">{description}</p>}<p className="mt-2 text-xs font-medium text-gray-600">{meta}</p></div>
    </button>
)

const SemanticThemeWorkspace = ({
    workspace, preview, viewport, updateWorkspace, replaceAsset, createPlaceholder,
    placeholderDrafts, setPlaceholderDrafts, disabled, mobilePane,
}) => {
    const [section, setSection] = useState('explore')
    const [mode, setMode] = useState('isolated')
    const [groupId, setGroupId] = useState(workspace.catalog.designGroups[0]?.id || '')
    const [layoutKey, setLayoutKey] = useState(workspace.catalog.layouts[0]?.key || '')
    const [componentStyleKey, setComponentStyleKey] = useState('')
    const [selectedTarget, setSelectedTarget] = useState(null)
    const iframeRef = useRef(null)
    const uploadRefs = useRef({})

    useEffect(() => {
        if (!groupId && workspace.catalog.designGroups[0]) setGroupId(workspace.catalog.designGroups[0].id)
        if (!layoutKey && workspace.catalog.layouts[0]) setLayoutKey(workspace.catalog.layouts[0].key)
    }, [groupId, layoutKey, workspace.catalog])

    useEffect(() => {
        const receive = (event) => {
            if (event.source !== iframeRef.current?.contentWindow || event.data?.source !== 'eceee-designer-preview') return
            setSelectedTarget({ id: event.data.targetId, kind: event.data.kind, label: event.data.label })
            setSection('explore')
        }
        window.addEventListener('message', receive)
        return () => window.removeEventListener('message', receive)
    }, [])

    const previewDocument = useMemo(() => buildSemanticPreviewDocument({
        workspace, css: preview.css, fontUrl: preview.fontUrl, mode, groupId, layoutKey, componentStyleKey, viewport,
    }), [workspace, preview, mode, groupId, layoutKey, componentStyleKey, viewport])

    const selectedGroup = workspace.catalog.designGroups.find((group) => group.id === groupId) || workspace.catalog.designGroups[0]
    const selectedLayout = workspace.catalog.layouts.find((layout) => layout.key === layoutKey) || workspace.catalog.layouts[0]
    const targetTypography = workspace.typography.map((row, index) => ({ row, index })).filter(({ row }) => row.targetId === selectedTarget?.id)
    const targetSpacing = workspace.spacing.map((row, index) => ({ row, index })).filter(({ row }) => row.targetId === selectedTarget?.id)
    const selectedAsset = selectedTarget?.id?.startsWith('asset:') ? workspace.assets.find((asset) => `asset:${asset.assetKey}` === selectedTarget.id) : null
    const groupIndexFromTarget = Number(selectedTarget?.id?.match(/^group:(\d+)/)?.[1])
    const targetGroup = Number.isInteger(groupIndexFromTarget) ? workspace.catalog.designGroups.find((group) => group.groupIndex === groupIndexFromTarget) : selectedGroup
    const relevantColors = (targetGroup?.colorNames || []).map((name) => ({ name, index: workspace.colors.findIndex((color) => color.name === name) })).filter(({ index }) => index >= 0)

    const openGroup = (group) => {
        setGroupId(group.id); setComponentStyleKey(''); setMode('isolated'); setSelectedTarget({ id: group.id, kind: 'group', label: group.label })
    }
    const openLayout = (layout) => {
        setLayoutKey(layout.key); setComponentStyleKey(''); setMode('layout'); setSelectedTarget({ id: `layout:${layout.key}`, kind: 'layout', label: layout.label })
    }
    const openStyle = (style) => {
        setComponentStyleKey(style.key); setMode('isolated'); setSelectedTarget({ id: `component-style:${style.key}`, kind: 'componentStyle', label: style.label })
    }

    const assetEditor = selectedAsset && (
        <section className="space-y-3 border-t border-gray-200 pt-4">
            <div><h3 className="font-medium text-gray-900">Image</h3><p className="text-xs text-gray-500">The current file is shown in its element, including placeholders.</p></div>
            {selectedAsset.url ? <img src={selectedAsset.url} alt="" className="h-36 w-full rounded-md border border-gray-200 bg-gray-50 object-contain" /> : <div className="flex h-36 items-center justify-center rounded-md border border-dashed border-gray-300 bg-gray-50 text-sm text-gray-500">Placeholder image</div>}
            <div className="text-xs text-gray-600"><p>{selectedAsset.filename || 'No file yet'}</p><p>{selectedAsset.requiredWidth || selectedAsset.recommendedWidth || '?'} × {selectedAsset.requiredHeight || '?'} px · {selectedAsset.dpr || 2}x</p></div>
            {selectedAsset.kind === 'design-group' && !selectedAsset.url && <div className="grid gap-2"><input aria-label={`${selectedAsset.displayName} placeholder name`} value={placeholderDrafts[selectedAsset.assetKey]?.displayName ?? selectedAsset.displayName} onChange={(event) => setPlaceholderDrafts((current) => ({ ...current, [selectedAsset.assetKey]: { ...current[selectedAsset.assetKey], displayName: event.target.value } }))} className="rounded-md border border-gray-300 px-2 py-1.5 text-sm" /><div className="grid grid-cols-2 gap-2"><input aria-label={`${selectedAsset.displayName} placeholder width`} type="number" min="16" max="8000" value={placeholderDrafts[selectedAsset.assetKey]?.width ?? selectedAsset.requiredWidth ?? ''} onChange={(event) => setPlaceholderDrafts((current) => ({ ...current, [selectedAsset.assetKey]: { ...current[selectedAsset.assetKey], width: event.target.value } }))} placeholder="Width px" className="rounded-md border border-gray-300 px-2 py-1.5 text-sm" /><input aria-label={`${selectedAsset.displayName} placeholder height`} type="number" min="16" max="8000" value={placeholderDrafts[selectedAsset.assetKey]?.height ?? selectedAsset.requiredHeight ?? ''} onChange={(event) => setPlaceholderDrafts((current) => ({ ...current, [selectedAsset.assetKey]: { ...current[selectedAsset.assetKey], height: event.target.value } }))} placeholder="Height px" className="rounded-md border border-gray-300 px-2 py-1.5 text-sm" /></div><button type="button" onClick={() => createPlaceholder(selectedAsset)} className="rounded-md border border-gray-300 px-3 py-2 text-sm">Create placeholder</button></div>}
            <input ref={(node) => { uploadRefs.current[selectedAsset.assetKey] = node }} type="file" accept="image/png,image/jpeg,image/gif,image/webp,image/svg+xml" onChange={(event) => replaceAsset(selectedAsset, event.target.files?.[0])} className="sr-only" />
            <button type="button" onClick={() => uploadRefs.current[selectedAsset.assetKey]?.click()} className="w-full rounded-md bg-blue-600 px-3 py-2 text-sm font-medium text-white">Replace image</button>
        </section>
    )

    const inspector = selectedTarget ? (
        <div className="space-y-5">
            <button type="button" onClick={() => setSelectedTarget(null)} className="inline-flex items-center gap-1 text-sm text-gray-600 hover:text-gray-900"><ArrowLeft className="h-4 w-4" />All previews</button>
            <div><p className="text-xs font-semibold uppercase tracking-wide text-gray-500">{targetKindLabels[selectedTarget.kind] || 'Element'}</p><h2 className="text-xl font-semibold text-gray-900">{selectedTarget.label}</h2><p className="mt-1 text-sm text-gray-600">Only values relevant to this selection are shown.</p></div>
            <section className="space-y-3 rounded-lg border border-gray-200 p-4">
                <h3 className="font-medium text-gray-900">Preview context</h3>
                <label className="block text-xs font-medium text-gray-700">Design group<select aria-label="Design group" value={groupId} onChange={(event) => { setGroupId(event.target.value); setMode('isolated') }} className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm">{workspace.catalog.designGroups.map((group) => <option key={group.id} value={group.id}>{group.label}</option>)}</select></label>
                <label className="block text-xs font-medium text-gray-700">Component style<select aria-label="Component style" value={componentStyleKey} onChange={(event) => setComponentStyleKey(event.target.value)} className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm"><option value="">Default rendering</option>{workspace.catalog.componentStyles.map((style) => <option key={style.key} value={style.key}>{style.label}</option>)}</select></label>
                {mode === 'layout' && <button type="button" onClick={() => setMode('isolated')} className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm">Show selected group isolated</button>}
            </section>
            {targetTypography.map(({ row, index }) => <section key={`type-${index}`} className="space-y-3 border-t border-gray-200 pt-4"><h3 className="font-medium text-gray-900">Typography</h3><ValueFields values={row.values} fields={workspace.constraints.editableTypographyProperties} labels={typographyLabels} onChange={(field, value) => updateWorkspace((next) => { next.typography[index].values[field] = value; return next })} /></section>)}
            {targetSpacing.map(({ row, index }) => <section key={`space-${index}`} className="space-y-3 border-t border-gray-200 pt-4"><div><h3 className="font-medium text-gray-900">Spacing{row.breakpoint ? ` · ${row.breakpoint}` : ''}</h3></div><ValueFields values={row.values} fields={workspace.constraints.editableSpacingProperties} labels={spacingLabels} onChange={(field, value) => updateWorkspace((next) => { next.spacing[index].values[field] = value; return next })} /></section>)}
            {relevantColors.length > 0 && <section className="space-y-3 border-t border-gray-200 pt-4"><h3 className="font-medium text-gray-900">Colors used here</h3>{relevantColors.map(({ name, index }) => <label key={name} className="flex items-center gap-3"><input type="color" value={/^#[0-9a-f]{6}$/i.test(workspace.colors[index].value) ? workspace.colors[index].value : '#000000'} onChange={(event) => updateWorkspace((next) => { next.colors[index].value = event.target.value; return next })} className="h-10 w-12 rounded border border-gray-300" /><span className="min-w-0 flex-1 text-sm font-medium">{name}</span><input aria-label={`${name} value`} value={workspace.colors[index].value} onChange={(event) => updateWorkspace((next) => { next.colors[index].value = event.target.value; return next })} className="w-28 rounded-md border border-gray-300 px-2 py-1.5 font-mono text-xs" /></label>)}</section>}
            {assetEditor}
            {!targetTypography.length && !targetSpacing.length && !relevantColors.length && !selectedAsset && <p className="rounded-lg border border-dashed border-gray-300 p-4 text-sm text-gray-500">Choose a child element in the preview to edit its detailed values.</p>}
        </div>
    ) : (
        <div className="space-y-7">
            <div><h2 className="text-lg font-semibold text-gray-900">Visual theme browser</h2><p className="text-sm text-gray-600">Open a layout, design group, or component style. Then click any visible element.</p></div>
            <section><div className="mb-3 flex items-center gap-2"><LayoutTemplate className="h-4 w-4" /><h3 className="font-semibold">Layouts</h3></div><div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2">{workspace.catalog.layouts.map((layout) => <CatalogCard key={layout.key} title={layout.label} description={layout.description} meta={`${layout.slots.length} areas`} icon={<div className="grid h-20 w-full grid-cols-[2fr_1fr] gap-2"><span className="rounded border border-gray-400 bg-white" /><span className="rounded border border-gray-400 bg-gray-200" /></div>} onClick={() => openLayout(layout)} />)}</div></section>
            <section><div className="mb-3 flex items-center gap-2"><Layers3 className="h-4 w-4" /><h3 className="font-semibold">Design groups</h3></div><p className="mb-3 text-xs text-gray-500">Each group opens in isolation with localized demo content.</p><div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2">{workspace.catalog.designGroups.map((group) => <CatalogCard key={group.id} title={group.label} description={group.description} meta={`${group.elements.length + group.parts.length} clickable elements${group.assetKeys.length ? ` · ${group.assetKeys.length} image` : ''}`} icon={<div className="w-full space-y-2"><span className="block h-3 w-2/3 rounded bg-gray-500" /><span className="block h-2 w-full rounded bg-gray-300" /><span className="block h-2 w-5/6 rounded bg-gray-300" /></div>} onClick={() => openGroup(group)} />)}</div></section>
            <section><div className="mb-3 flex items-center gap-2"><ImageIcon className="h-4 w-4" /><h3 className="font-semibold">Component styles</h3></div><p className="mb-3 text-xs text-gray-500">Styles are shown around the selected design group in isolation.</p>{workspace.catalog.componentStyles.length ? <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2">{workspace.catalog.componentStyles.map((style) => <CatalogCard key={style.key} title={style.label} description={style.description} meta="Isolated preview" icon={<div className="w-3/4 rounded-lg border border-gray-400 bg-white p-4 shadow-sm"><span className="block h-3 w-2/3 bg-gray-500" /><span className="mt-3 block h-2 w-full bg-gray-300" /></div>} onClick={() => openStyle(style)} />)}</div> : <p className="rounded-lg border border-dashed border-gray-300 p-4 text-sm text-gray-500">No component styles are configured in this theme.</p>}</section>
        </div>
    )

    return (
        <main className="grid min-h-0 flex-1 lg:grid-cols-[380px_minmax(0,1fr)]">
            <section className={`${mobilePane === 'preview' ? 'hidden' : 'flex'} min-h-0 min-w-0 flex-col border-r border-gray-200 bg-white lg:flex`}>
                <fieldset disabled={disabled} className="flex min-h-0 flex-1 flex-col">
                    <nav className="flex border-b border-gray-200 px-3" aria-label="Designer sections">{[
                        ['explore', 'Elements', <Layers3 className="h-4 w-4" />], ['colors', 'Colors', <ImageIcon className="h-4 w-4" />], ['fonts', 'Fonts', <Type className="h-4 w-4" />],
                    ].map(([id, label, icon]) => <button type="button" key={id} onClick={() => setSection(id)} className={`inline-flex items-center gap-2 border-b-2 px-3 py-3 text-sm ${section === id ? 'border-blue-600 font-medium text-blue-700' : 'border-transparent text-gray-600'}`}>{icon}{label}</button>)}</nav>
                    <div className="min-h-0 flex-1 overflow-y-auto p-4">{section === 'explore' && inspector}{section === 'colors' && <div className="space-y-3"><div><h2 className="text-lg font-semibold">Theme colors</h2><p className="text-sm text-gray-600">Colors also appear contextually when an element uses them.</p></div>{workspace.colors.map((color, index) => <label key={color.name} className="flex items-center gap-3 rounded-lg border border-gray-200 p-3"><input type="color" value={/^#[0-9a-f]{6}$/i.test(color.value) ? color.value : '#000000'} onChange={(event) => updateWorkspace((next) => { next.colors[index].value = event.target.value; return next })} className="h-10 w-12" /><span className="flex-1 text-sm font-medium">{color.name}</span><input aria-label={`${color.name} value`} value={color.value} onChange={(event) => updateWorkspace((next) => { next.colors[index].value = event.target.value; return next })} className="w-28 rounded-md border border-gray-300 px-2 py-1.5 font-mono text-xs" /></label>)}</div>}{section === 'fonts' && <div className="space-y-4"><div><h2 className="text-lg font-semibold">Font families</h2><p className="text-sm text-gray-600">Element-specific font values appear after clicking text in the preview.</p></div><button type="button" onClick={() => updateWorkspace((next) => { next.fonts.push({ family: '', variants: ['400'], display: 'swap', usage: [] }); return next })} className="inline-flex items-center gap-1 rounded-md border border-gray-300 px-3 py-2 text-sm"><Plus className="h-4 w-4" />Add font</button>{workspace.fonts.map((font, index) => <div key={`${font.family}-${index}`} className="space-y-2 rounded-lg border border-gray-200 p-3"><input aria-label="Font family" value={font.family} onChange={(event) => updateWorkspace((next) => { next.fonts[index].family = event.target.value; return next })} className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm" /><input aria-label="Font variants" value={(font.variants || []).join(', ')} onChange={(event) => updateWorkspace((next) => { next.fonts[index].variants = event.target.value.split(',').map((item) => item.trim()).filter(Boolean); return next })} className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm" /></div>)}</div>}</div>
                </fieldset>
            </section>
            <section className={`${mobilePane === 'edit' ? 'hidden' : 'flex'} min-h-0 flex-col bg-gray-100 p-3 lg:flex lg:p-5`}><div className="mb-3 flex flex-wrap items-center gap-2"><div><h2 className="text-sm font-semibold text-gray-800">{mode === 'layout' ? selectedLayout?.label || 'Layout preview' : `${selectedGroup?.label || 'Design group'} · isolated`}</h2><p className="text-xs text-gray-500">Click any visible element to edit it.</p></div><span className="ml-auto text-xs capitalize text-gray-500">{viewport}</span></div><iframe ref={iframeRef} title="Live theme preview" sandbox="allow-scripts" srcDoc={previewDocument} className="min-h-0 flex-1 rounded-lg border border-gray-300 bg-white shadow-sm" /></section>
        </main>
    )
}

export default SemanticThemeWorkspace
