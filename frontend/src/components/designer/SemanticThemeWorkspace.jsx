import { useEffect, useMemo, useRef, useState } from 'react'
import { Bold, Box, ChevronDown, ChevronLeft, ChevronRight, Eye, EyeOff, FileText, Image as ImageIcon, Italic, Link2, List, ListOrdered, Loader2, Search, Settings2, Trash2 } from 'lucide-react'

import RenderFrame from '../../rendering/RenderFrame'
import { createDesignerRenderModel, designerPreviewImageReferences } from '../../rendering/adapters'
const typographyLabels = {
    fontFamily: 'Font family', fontSize: 'Size', fontWeight: 'Weight', fontStyle: 'Style',
    lineHeight: 'Line height', letterSpacing: 'Letter spacing',
}

const spacingLabels = {
    margin: 'Outer spacing', marginTop: 'Space above', marginRight: 'Space right', marginBottom: 'Space below', marginLeft: 'Space left',
    padding: 'Inner spacing', paddingTop: 'Inner top', paddingRight: 'Inner right', paddingBottom: 'Inner bottom', paddingLeft: 'Inner left',
}

const defaultBreakpoints = { xs: 0, sm: 640, md: 768, lg: 1024, xl: 1280 }
const defaultSidebarWidth = 360
const minSidebarWidth = 280
const maxSidebarWidth = 640
const defaultInspectorWidth = 380
const minInspectorWidth = 320
const maxInspectorWidth = 720
const minPreviewWidth = 480
const resizeHandleWidth = 8
const desktopPaneBreakpoint = 1280

const fitPaneWidths = (workspaceWidth, sidebarWidth, inspectorWidth, sidebarCollapsed, inspectorCollapsed) => {
    if (workspaceWidth < desktopPaneBreakpoint) return { sidebarWidth, inspectorWidth }
    const visibleHandles = Number(!sidebarCollapsed) + Number(!inspectorCollapsed)
    const available = workspaceWidth - minPreviewWidth - visibleHandles * resizeHandleWidth
    if (sidebarCollapsed && inspectorCollapsed) return { sidebarWidth, inspectorWidth }
    if (sidebarCollapsed) return {
        sidebarWidth,
        inspectorWidth: Math.min(inspectorWidth, Math.max(minInspectorWidth, available)),
    }
    if (inspectorCollapsed) return {
        sidebarWidth: Math.min(sidebarWidth, Math.max(minSidebarWidth, available)),
        inspectorWidth,
    }
    if (sidebarWidth + inspectorWidth <= available) return { sidebarWidth, inspectorWidth }

    const flexibleSpace = Math.max(0, available - minSidebarWidth - minInspectorWidth)
    const sidebarExtra = Math.max(0, sidebarWidth - minSidebarWidth)
    const inspectorExtra = Math.max(0, inspectorWidth - minInspectorWidth)
    const extraTotal = sidebarExtra + inspectorExtra
    const nextSidebar = minSidebarWidth + (extraTotal ? flexibleSpace * sidebarExtra / extraTotal : flexibleSpace / 2)
    return {
        sidebarWidth: Math.min(maxSidebarWidth, Math.round(nextSidebar)),
        inspectorWidth: Math.min(maxInspectorWidth, Math.round(available - nextSidebar)),
    }
}

const assetProperty = (asset) => asset.property || asset.assetKey?.split(':').at(-1)

const humanize = (value) => String(value || '')
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replace(/[-_]+/g, ' ')
    .replace(/^./, (character) => character.toUpperCase())

const matchesContentOption = (option, query) => [
    option.label,
    option.description,
    option.pageTitle,
    option.siteLabel,
    option.objectTitle,
    option.objectTypeLabel,
].some((value) => String(value || '').toLowerCase().includes(query.toLowerCase()))

const TruncatedNavigationText = ({ value, className = '' }) => {
    const text = String(value || '')
    return <span title={text} className={`block min-w-0 truncate ${className}`}>{text}</span>
}

const contentGroups = (options, sourceMode) => ['page', 'object'].map((kind) => {
    const kindOptions = options.filter((option) => option.kind === kind)
    const subgroupKey = sourceMode === 'content'
        ? kind === 'page' ? 'siteLabel' : 'objectTypeLabel'
        : null
    const subgroups = subgroupKey
        ? [...new Set(kindOptions.map((option) => option[subgroupKey] || (kind === 'page' ? 'Other site' : 'Other type')))].map((label) => ({
            label,
            options: kindOptions.filter((option) => (option[subgroupKey] || (kind === 'page' ? 'Other site' : 'Other type')) === label),
        }))
        : [{ label: '', options: kindOptions }]
    return { kind, label: kind === 'page' ? 'Pages' : 'Objects', subgroups }
}).filter((group) => group.subgroups.some((subgroup) => subgroup.options.length))

const spacingRowIndexForChange = (rows, targetIds, breakpoints, viewportWidth) => {
    const targetId = targetIds.find((candidate) => rows.some((row) => row.targetId === candidate))
    if (!targetId) return -1
    const candidates = rows
        .map((row, index) => ({ row, index }))
        .filter(({ row }) => row.targetId === targetId)
    if (candidates.length < 2) return candidates[0]?.index ?? -1

    const width = Number(viewportWidth)
    if (!Number.isFinite(width)) return candidates[0].index
    const configuredBreakpoints = { ...defaultBreakpoints, ...(breakpoints || {}) }
    const active = candidates
        .map((candidate) => ({ ...candidate, width: Number(configuredBreakpoints[candidate.row.breakpoint]) }))
        .filter((candidate) => Number.isFinite(candidate.width) && candidate.width <= width)
        .sort((left, right) => right.width - left.width)[0]
    return active?.index ?? candidates[0].index
}

const ContentSourceBrowser = ({ sourceMode, options, value, onChange, onDelete, disabled, loading }) => {
    const [query, setQuery] = useState('')
    const [kindFilter, setKindFilter] = useState('all')
    const sourceName = sourceMode === 'demo' ? 'theme demo content' : 'site content'
    const filteredOptions = options.filter((option) => (
        (kindFilter === 'all' || option.kind === kindFilter)
        && matchesContentOption(option, query)
    ))
    const groups = contentGroups(filteredOptions, sourceMode)

    return (
        <section aria-label={`Browse ${sourceName}`} className="min-w-0 space-y-3">
            <div className="flex items-center justify-between gap-2">
                <h4 className="text-xs font-medium text-gray-700">Page or object</h4>
                {loading && <Loader2 aria-label="Loading content" className="h-3.5 w-3.5 animate-spin text-gray-500" />}
            </div>
            <div className="grid grid-cols-[minmax(0,1fr)_auto] gap-2">
                <label className="relative min-w-0">
                    <span className="sr-only">Search {sourceName}</span>
                    <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                    <input
                        type="search"
                        aria-label={`Search ${sourceName}`}
                        value={query}
                        onChange={(event) => setQuery(event.target.value)}
                        disabled={disabled}
                        placeholder="Search…"
                        className="w-full rounded-md border border-gray-300 bg-white py-2 pl-8 pr-3 text-sm text-gray-700 placeholder:text-gray-400"
                    />
                </label>
                <label>
                    <span className="sr-only">Filter {sourceName}</span>
                    <select aria-label={`Filter ${sourceName}`} value={kindFilter} onChange={(event) => setKindFilter(event.target.value)} disabled={disabled} className="h-full rounded-md border border-gray-300 bg-white px-2 text-sm text-gray-700">
                        <option value="all">All</option>
                        <option value="page">Pages</option>
                        <option value="object">Objects</option>
                    </select>
                </label>
            </div>
            {groups.length ? <ul aria-label={`${sourceName} hierarchy`} className="w-full min-w-0 max-h-72 space-y-3 overflow-x-hidden overflow-y-auto rounded-md border border-gray-200 bg-gray-50 p-2">
                {groups.map((group) => <li key={group.kind} className="min-w-0">
                    <div className="flex items-center gap-2 px-2 py-1 text-xs font-semibold uppercase tracking-wide text-gray-500">
                        {group.kind === 'page' ? <FileText className="h-3.5 w-3.5" /> : <Box className="h-3.5 w-3.5" />}
                        {group.label}
                    </div>
                    <ul className="space-y-2">
                        {group.subgroups.map((subgroup) => <li key={subgroup.label || group.kind} className="min-w-0">
                            {subgroup.label && <p className="truncate border-l border-gray-300 py-1 pl-4 text-xs font-medium text-gray-600">{subgroup.label}</p>}
                            <ul className={`min-w-0 ${subgroup.label ? 'ml-3 border-l border-gray-300 pl-2' : ''}`}>
                                {subgroup.options.map((option) => <li key={option.value} className="flex min-w-0 items-center gap-1">
                                    <button
                                        type="button"
                                        aria-label={`Select ${option.label}`}
                                        aria-current={option.value === value ? 'true' : undefined}
                                        onClick={() => onChange(option.value)}
                                        disabled={disabled || loading}
                                        style={option.kind === 'page' && sourceMode === 'content' ? { paddingLeft: `${8 + (option.depth || 0) * 14}px` } : undefined}
                                        className={`flex min-w-0 flex-1 items-start gap-2 rounded px-2 py-1.5 text-left text-sm ${option.value === value ? 'bg-blue-100 font-medium text-blue-800' : 'text-gray-700 hover:bg-white'}`}
                                    >
                                        <span className="min-w-0 flex-1"><TruncatedNavigationText value={sourceMode === 'content' ? option.kind === 'page' ? option.pageTitle : option.objectTitle : option.label} /><TruncatedNavigationText value={option.description} className="text-[11px] font-normal opacity-70" /></span>
                                    </button>
                                    {onDelete && <button type="button" aria-label={`Delete ${option.label}`} onClick={() => onDelete(option)} disabled={disabled} className="shrink-0 rounded p-1.5 text-gray-400 hover:bg-red-50 hover:text-red-600"><Trash2 className="h-3.5 w-3.5" /></button>}
                                </li>)}
                            </ul>
                        </li>)}
                    </ul>
                </li>)}
            </ul> : <p className="rounded-md border border-dashed border-gray-300 p-3 text-sm text-gray-500">No pages or objects match the current search and filter.</p>}
        </section>
    )
}

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
        .filter((asset) => ['design-group', 'preview', 'site-icon', 'library'].includes(asset.kind))
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

const ValueFields = ({ idPrefix, values, defaults, fields, labels, onChange, onRemove }) => (
    <div className="grid grid-cols-2 gap-2">
        {fields.map((field) => (
            <div key={field} className="min-w-0">
                <div className="flex items-center justify-between gap-2">
                    <label htmlFor={`${idPrefix}-${field}`} className="text-xs font-medium text-gray-700">{labels[field] || field}</label>
                    <button type="button" aria-label={`Remove ${labels[field] || field}`} onClick={() => onRemove(field)} className="rounded p-1 text-gray-400 hover:bg-red-50 hover:text-red-600"><Trash2 className="h-3.5 w-3.5" /></button>
                </div>
                <input id={`${idPrefix}-${field}`} value={values[field] || defaults?.[field] || ''} onChange={(event) => onChange(field, event.target.value)} className="mt-0.5 w-full rounded border border-gray-300 px-2 py-1.5 text-xs" placeholder="Theme default" />
                {!values[field] && defaults?.[field] && <p className="mt-0.5 text-[10px] text-gray-500">Theme default</p>}
            </div>
        ))}
    </div>
)

const SemanticThemeWorkspace = ({
    workspace, preview, viewport, updateWorkspace, replaceAsset, createPlaceholder,
    placeholderDrafts, setPlaceholderDrafts,
    loadPageContent, loadObjectContent, importPreviewSource, deletePreviewContent,
    savePreviewText, replacePreviewImage, pendingPreviewTextsRef, onPendingPreviewTextsChange,
    previewTextResetVersion, disabled, mobilePane,
}) => {
    const initialViews = workspace.previewContent?.views || workspace.catalog.previewViews || []
    const initialExternalContent = [
        ...(workspace.contentPages || []).filter((source) => source.versionId),
        ...(workspace.contentObjects || []).filter((source) => source.versionId),
    ]
    const [previewContent, setPreviewContent] = useState({ views: initialViews })
    const [viewId, setViewId] = useState(
        initialViews.find((view) => view.isSourceHomepage)?.id
        || initialViews.find((view) => view.referenceHtml)?.id
        || initialViews[0]?.id
        || '',
    )
    const [selectedTarget, setSelectedTarget] = useState(null)
    const [addedThemeValues, setAddedThemeValues] = useState(() => new Set())
    const [themeDefaults, setThemeDefaults] = useState({})
    const [selectionExpanded, setSelectionExpanded] = useState(true)
    const [workspaceView, setWorkspaceView] = useState('preview')
    const [selectedImageAspectKey, setSelectedImageAspectKey] = useState('')
    const [contentMode, setContentMode] = useState(initialViews.length ? 'demo' : initialExternalContent.length ? 'content' : 'none')
    const [sourceContentId, setSourceContentId] = useState('')
    const [sourceContentModel, setSourceContentModel] = useState(null)
    const [loadingContent, setLoadingContent] = useState(false)
    const [guidesEnabled, setGuidesEnabled] = useState(true)
    const [sidebarCollapsed, setSidebarCollapsed] = useState(false)
    const [inspectorCollapsed, setInspectorCollapsed] = useState(false)
    const [sidebarWidth, setSidebarWidth] = useState(defaultSidebarWidth)
    const [inspectorWidth, setInspectorWidth] = useState(defaultInspectorWidth)
    const [isResizingSidebar, setIsResizingSidebar] = useState(false)
    const [isResizingInspector, setIsResizingInspector] = useState(false)
    const workspaceRef = useRef(null)
    const paneWidthsRef = useRef({ sidebarWidth, inspectorWidth })
    const sidebarResizeRef = useRef(null)
    const inspectorResizeRef = useRef(null)
    const iframeRef = useRef(null)
    const previewFrameRef = useRef(null)
    const uploadRefs = useRef({})
    const [previewFrameWidth, setPreviewFrameWidth] = useState(1280)

    const clampSidebarWidth = (width) => {
        const workspaceWidth = workspaceRef.current?.getBoundingClientRect().width || window.innerWidth
        const visibleHandles = 1 + Number(!inspectorCollapsed)
        const availableMaximum = workspaceWidth - (inspectorCollapsed ? 0 : inspectorWidth) - minPreviewWidth - resizeHandleWidth * visibleHandles
        return Math.min(Math.max(minSidebarWidth, availableMaximum), maxSidebarWidth, Math.max(minSidebarWidth, width))
    }

    const clampInspectorWidth = (width) => {
        const workspaceWidth = workspaceRef.current?.getBoundingClientRect().width || window.innerWidth
        const visibleHandles = 1 + Number(!sidebarCollapsed)
        const availableMaximum = workspaceWidth - (sidebarCollapsed ? 0 : sidebarWidth) - minPreviewWidth - resizeHandleWidth * visibleHandles
        return Math.min(Math.max(minInspectorWidth, availableMaximum), maxInspectorWidth, Math.max(minInspectorWidth, width))
    }

    const startSidebarResize = (event) => {
        if (event.button !== 0) return
        event.preventDefault()
        sidebarResizeRef.current = { pointerId: event.pointerId, startX: event.clientX, startWidth: sidebarWidth }
        event.currentTarget.setPointerCapture?.(event.pointerId)
        setIsResizingSidebar(true)
    }

    const moveSidebarResize = (event) => {
        const resize = sidebarResizeRef.current
        if (!resize || event.pointerId !== resize.pointerId) return
        setSidebarWidth(clampSidebarWidth(resize.startWidth + event.clientX - resize.startX))
    }

    const stopSidebarResize = (event) => {
        const resize = sidebarResizeRef.current
        if (!resize || event.pointerId !== resize.pointerId) return
        sidebarResizeRef.current = null
        event.currentTarget.releasePointerCapture?.(event.pointerId)
        setIsResizingSidebar(false)
    }

    const resizeSidebarWithKeyboard = (event) => {
        if (!['ArrowLeft', 'ArrowRight'].includes(event.key)) return
        event.preventDefault()
        setSidebarWidth((current) => clampSidebarWidth(current + (event.key === 'ArrowRight' ? 16 : -16)))
    }

    const startInspectorResize = (event) => {
        if (event.button !== 0) return
        event.preventDefault()
        inspectorResizeRef.current = { pointerId: event.pointerId, startX: event.clientX, startWidth: inspectorWidth }
        event.currentTarget.setPointerCapture?.(event.pointerId)
        setIsResizingInspector(true)
    }

    const moveInspectorResize = (event) => {
        const resize = inspectorResizeRef.current
        if (!resize || event.pointerId !== resize.pointerId) return
        setInspectorWidth(clampInspectorWidth(resize.startWidth - (event.clientX - resize.startX)))
    }

    const stopInspectorResize = (event) => {
        const resize = inspectorResizeRef.current
        if (!resize || event.pointerId !== resize.pointerId) return
        inspectorResizeRef.current = null
        event.currentTarget.releasePointerCapture?.(event.pointerId)
        setIsResizingInspector(false)
    }

    const resizeInspectorWithKeyboard = (event) => {
        if (!['ArrowLeft', 'ArrowRight'].includes(event.key)) return
        event.preventDefault()
        setInspectorWidth((current) => clampInspectorWidth(current + (event.key === 'ArrowLeft' ? 16 : -16)))
    }

    useEffect(() => {
        paneWidthsRef.current = { sidebarWidth, inspectorWidth }
    }, [inspectorWidth, sidebarWidth])

    useEffect(() => {
        if (!workspaceRef.current || typeof ResizeObserver === 'undefined') return undefined
        const observer = new ResizeObserver(([entry]) => {
            const fitted = fitPaneWidths(
                entry.contentRect.width,
                paneWidthsRef.current.sidebarWidth,
                paneWidthsRef.current.inspectorWidth,
                sidebarCollapsed,
                inspectorCollapsed,
            )
            paneWidthsRef.current = fitted
            setSidebarWidth(fitted.sidebarWidth)
            setInspectorWidth(fitted.inspectorWidth)
        })
        observer.observe(workspaceRef.current)
        return () => observer.disconnect()
    }, [inspectorCollapsed, sidebarCollapsed])

    useEffect(() => {
        if (!isResizingSidebar && !isResizingInspector) return undefined
        const previousCursor = document.body.style.cursor
        const previousUserSelect = document.body.style.userSelect
        document.body.style.cursor = 'col-resize'
        document.body.style.userSelect = 'none'
        return () => {
            document.body.style.cursor = previousCursor
            document.body.style.userSelect = previousUserSelect
        }
    }, [isResizingInspector, isResizingSidebar])

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
        setSelectedTarget(null)
    }, [previewTextResetVersion])

    const demoOptions = useMemo(() => previewContent.views.map((view) => ({
        value: String(view.id),
        label: view.label,
        kind: view.kind,
        view,
        pageTitle: view.kind === 'page' ? view.label : '',
        objectTitle: view.kind === 'object' ? view.label : '',
        description: view.kind === 'object' ? 'Theme object' : 'Theme page',
    })), [previewContent.views])
    const externalContentOptions = useMemo(() => [
        ...(workspace.contentPages || []).filter((source) => source.versionId).map((source) => ({
            ...source,
            value: `page:${source.id}`,
            kind: 'page',
            label: source.label,
            depth: Math.max(0, String(source.slugPath || '').split('/').filter(Boolean).length),
            description: `Page · /${source.slugPath || ''} · ${source.versionStatus === 'draft' ? 'Draft' : 'Published'}`,
        })),
        ...(workspace.contentObjects || []).filter((source) => source.versionId).map((source) => ({
            ...source,
            value: `object:${source.id}`,
            kind: 'object',
            label: source.label,
            description: `Object · ${source.objectTypeLabel}`,
        })),
    ], [workspace.contentObjects, workspace.contentPages])

    useEffect(() => {
        setContentMode((current) => {
            if (current === 'demo' && demoOptions.length) return current
            if (current === 'content' && externalContentOptions.length) return current
            return demoOptions.length ? 'demo' : externalContentOptions.length ? 'content' : 'none'
        })
    }, [demoOptions.length, externalContentOptions.length])

    useEffect(() => {
        setSourceContentId((current) => externalContentOptions.some((source) => source.value === current)
            ? current
            : externalContentOptions[0]?.value || '')
    }, [externalContentOptions])

    useEffect(() => {
        if (contentMode !== 'content') {
            setSourceContentModel(null)
            setLoadingContent(false)
            return undefined
        }
        const source = externalContentOptions.find((candidate) => candidate.value === sourceContentId)
        const loader = source?.kind === 'object' ? loadObjectContent : loadPageContent
        if (!source || !loader) {
            setSourceContentModel(null)
            return undefined
        }
        let current = true
        setLoadingContent(true)
        loader(source)
            .then((model) => { if (current) setSourceContentModel(model) })
            .catch(() => { if (current) setSourceContentModel(null) })
            .finally(() => { if (current) setLoadingContent(false) })
        return () => { current = false }
    }, [contentMode, externalContentOptions, loadObjectContent, loadPageContent, sourceContentId])

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
            if (event.data.action === 'targetStyles') {
                setThemeDefaults((current) => ({ ...current, [event.data.targetId]: event.data.computedStyles || {} }))
                return
            }
            if (event.data.action === 'spacingChange') {
                const targetIds = Array.isArray(event.data.targetIds) ? event.data.targetIds : []
                const index = spacingRowIndexForChange(
                    workspace.spacing,
                    targetIds,
                    workspace.breakpoints,
                    event.data.viewportWidth,
                )
                const property = event.data.property
                if (index >= 0 && workspace.constraints.editableSpacingProperties.includes(property)) {
                    updateWorkspace((next) => {
                        next.spacing[index].values[property] = event.data.value
                        return next
                    })
                }
                return
            }
            const normalizeTarget = (option) => ({
                id: option.id,
                kind: option.kind,
                label: option.label,
                text: option.text || '',
                editable: option.editable !== false,
                richText: option.richText === true,
                sourceUrl: option.sourceUrl || '',
                sourceOccurrence: option.sourceOccurrence ?? 0,
                sourcePath: Array.isArray(option.sourcePath) ? option.sourcePath : [],
                sourceMatchIndex: option.sourceMatchIndex ?? 0,
                computedStyles: option.computedStyles || {},
            })
            const alternatives = Array.isArray(event.data.alternatives)
                ? event.data.alternatives.filter((option) => option?.id && option?.label).map(normalizeTarget)
                : []
            const descendants = Array.isArray(event.data.descendants)
                ? event.data.descendants.filter((option) => option?.id && option?.label).map(normalizeTarget)
                : []
            const ancestors = Array.isArray(event.data.ancestors)
                ? event.data.ancestors.filter((option) => option?.id && option?.label).map(normalizeTarget)
                : []
            const target = {
                id: event.data.targetId,
                kind: event.data.kind,
                label: event.data.label,
                text: event.data.text || '',
                editable: event.data.editable !== false,
                richText: event.data.richText === true,
                sourceUrl: event.data.sourceUrl || '',
                sourceOccurrence: event.data.sourceOccurrence ?? 0,
                sourcePath: Array.isArray(event.data.sourcePath) ? event.data.sourcePath : [],
                sourceMatchIndex: event.data.sourceMatchIndex ?? 0,
                computedStyles: event.data.computedStyles || {},
                alternatives,
                ancestors,
                descendants,
            }
            setThemeDefaults((current) => ({
                ...current,
                [target.id]: target.computedStyles,
                ...Object.fromEntries(alternatives.map((alternative) => [alternative.id, alternative.computedStyles])),
                ...Object.fromEntries(ancestors.map((ancestor) => [ancestor.id, ancestor.computedStyles])),
            }))
            setAddedThemeValues(new Set())
            if (event.data.action === 'contextAction' || event.data.action === 'editText') {
                setSelectedTarget(target)
                setSelectionExpanded(true)
                setWorkspaceView('preview')
                if (event.data.command === 'replaceImage' && event.data.file instanceof File) {
                    if (target.kind === 'asset') {
                        const asset = workspace.assets.find((candidate) => `asset:${candidate.assetKey}` === target.id)
                        if (asset) void replaceAsset(asset, event.data.file)
                    } else if (target.kind === 'previewImage' && viewId && target.sourceUrl) {
                        void replacePreviewImage?.(viewId, target.sourceUrl, target.sourcePath, target.sourceMatchIndex, event.data.file)
                    }
                }
                return
            }
            if (target.kind === 'asset') {
                const asset = workspace.assets.find((candidate) => `asset:${candidate.assetKey}` === target.id)
                if (asset) {
                    setSelectedImageAspectKey(imageAspectKey(asset))
                    setSelectedTarget(target)
                    setSelectionExpanded(true)
                    setWorkspaceView('preview')
                    return
                }
            }
            if (event.data.action === 'contentChange' && target.kind === 'element') {
                if (contentMode === 'demo') {
                    pendingPreviewTextsRef.current[viewId] = {
                        ...(pendingPreviewTextsRef.current[viewId] || {}),
                        [target.id]: target.text,
                    }
                    onPendingPreviewTextsChange()
                    setSelectedTarget(target)
                    setSelectionExpanded(true)
                }
                return
            }
            setSelectedTarget(target)
            setSelectionExpanded(true)
            setWorkspaceView('preview')
        }
        window.addEventListener('message', receive)
        return () => window.removeEventListener('message', receive)
    }, [contentMode, onPendingPreviewTextsChange, pendingPreviewTextsRef, replaceAsset, replacePreviewImage, updateWorkspace, viewId, workspace.assets, workspace.breakpoints, workspace.constraints.editableSpacingProperties, workspace.spacing])

    const selectedView = previewContent.views.find((view) => view.id === viewId) || previewContent.views[0] || null
    const selectedViewImages = useMemo(() => designerPreviewImageReferences(selectedView), [selectedView])
    const selectedSourceContent = externalContentOptions.find((source) => source.value === sourceContentId) || null
    const imageAspects = useMemo(() => imageAspectsFor(workspace), [workspace])
    const assetsByTargetId = useMemo(() => new Map(
        workspace.assets.map((asset) => [`asset:${asset.assetKey}`, asset]),
    ), [workspace.assets])
    const selectedElementImages = useMemo(() => {
        if (!selectedTarget) return []
        const candidates = [selectedTarget, ...(selectedTarget.alternatives || []), ...(selectedTarget.descendants || [])]
        const urls = candidates.flatMap((target) => {
            const asset = assetsByTargetId.get(target.id)
            return [target.sourceUrl && {
                sourceUrl: target.sourceUrl,
                sourcePath: target.sourcePath || [],
                sourceMatchIndex: target.sourceMatchIndex ?? 0,
            }, asset?.url && { sourceUrl: asset.url }].filter(Boolean)
        })
        return selectedViewImages.filter((image) => urls.some((candidate) => candidate.sourceUrl === image.sourceUrl && (
            candidate.sourcePath === undefined
            || JSON.stringify(candidate.sourcePath) === JSON.stringify(image.sourcePath)
                && candidate.sourceMatchIndex === image.sourceMatchIndex
        )))
    }, [assetsByTargetId, selectedTarget, selectedViewImages])
    const selectedImageAspect = imageAspects.find((aspect) => aspect.key === selectedImageAspectKey) || imageAspects[0]
    const previewAsset = workspace.assets.find((asset) => asset.kind === 'preview')
    const siteIconAsset = workspace.assets.find((asset) => asset.kind === 'site-icon')

    useEffect(() => {
        if (selectedImageAspect && selectedImageAspect.key !== selectedImageAspectKey) {
            setSelectedImageAspectKey(selectedImageAspect.key)
        }
    }, [selectedImageAspect, selectedImageAspectKey])

    const previewModel = useMemo(() => {
        // Pending text lives in a ref so inline typing does not rebuild the frame and
        // disturb selection. Read it whenever another model dependency does rebuild.
        const previewWorkspace = {
            ...workspace,
            previewContent: {
                ...previewContent,
                views: previewContent.views.map((view) => ({
                    ...view,
                    texts: { ...(view.texts || {}), ...(pendingPreviewTextsRef.current[view.id] || {}) },
                })),
            },
        }
        return createDesignerRenderModel({
            workspace: previewWorkspace,
            viewId,
            themeCss: preview.css,
            fontUrl: preview.fontUrl,
            sourceModel: contentMode === 'content' ? sourceContentModel : null,
            contentEditable: contentMode === 'demo',
            guidesEnabled,
        })
    }, [contentMode, guidesEnabled, pendingPreviewTextsRef, previewContent, preview, sourceContentModel, viewId, workspace])

    const previewCanvasWidth = viewport === 'mobile' ? 390 : viewport === 'tablet' ? 768 : 1280
    const previewScale = Math.min(1, previewFrameWidth / previewCanvasWidth)
    const previewOffset = Math.max(0, (previewFrameWidth - previewCanvasWidth * previewScale) / 2)

    const selectedTargetIds = [...new Set([
        selectedTarget?.id,
        ...(selectedTarget?.alternatives || []).map((target) => target.id),
        ...(selectedTarget?.ancestors || []).map((target) => target.id),
    ].filter(Boolean))]
    const selectedGroupIndex = Number(selectedTargetIds.map((id) => id.match(/^group:(\d+)/)?.[1]).find((value) => value !== undefined))
    const selectedGroup = Number.isInteger(selectedGroupIndex)
        ? workspace.catalog.designGroups.find((group) => group.groupIndex === selectedGroupIndex)
        : null
    const targetTypography = workspace.typography.map((row, index) => ({ row, index })).filter(({ row }) => (
        selectedTarget?.kind === 'group' && selectedGroup
            ? row.groupIndex === selectedGroup.groupIndex
            : selectedTargetIds.includes(row.targetId)
    ))
    const targetSpacing = workspace.spacing.map((row, index) => ({ row, index })).filter(({ row }) => (
        selectedTarget?.kind === 'group' && selectedGroup
            ? row.groupIndex === selectedGroup.groupIndex
            : selectedTargetIds.includes(row.targetId)
    ))
    const propertyKey = (kind, index, field) => `${kind}:${index}:${field}`
    const activeFields = (kind, index, row, fields) => selectedTarget
        ? fields
        : fields.filter((field) => row.values[field] || addedThemeValues.has(propertyKey(kind, index, field)))
    const sectionLabel = (kind, row) => kind === 'typography'
        ? `Typography${row.element ? ` · ${selectedGroup?.elements?.find((element) => element.element === row.element)?.label || row.element}` : ''}`
        : `Spacing${row.part ? ` · ${selectedGroup?.parts?.find((part) => part.part === row.part)?.label || row.part}` : ''}${row.breakpoint ? ` · ${row.breakpoint}` : ''}`
    const addableThemeValues = selectedTarget ? [] : [
        ...targetTypography.flatMap(({ row, index }) => workspace.constraints.editableTypographyProperties
            .filter((field) => !row.values[field] && !addedThemeValues.has(propertyKey('typography', index, field)))
            .map((field) => ({ kind: 'typography', index, row, field, label: `${sectionLabel('typography', row)} · ${typographyLabels[field] || field}` }))),
        ...targetSpacing.flatMap(({ row, index }) => workspace.constraints.editableSpacingProperties
            .filter((field) => !row.values[field] && !addedThemeValues.has(propertyKey('spacing', index, field)))
            .map((field) => ({ kind: 'spacing', index, row, field, label: `${sectionLabel('spacing', row)} · ${spacingLabels[field] || field}` }))),
    ]

    useEffect(() => {
        if (!addedThemeValues.size) return undefined
        const targetIds = new Set([...addedThemeValues].map((key) => {
            const [kind, index] = key.split(':')
            return workspace[kind]?.[Number(index)]?.targetId
        }).filter(Boolean))
        const timer = window.setTimeout(() => targetIds.forEach((targetId) => iframeRef.current?.contentWindow?.postMessage({
            source: 'eceee-render-host', action: 'readTargetStyles', targetId,
        }, '*')), 0)
        return () => window.clearTimeout(timer)
    }, [addedThemeValues, preview.css, workspace])
    const relevantColors = (selectedGroup?.colorNames || []).map((name) => ({ name, index: workspace.colors.findIndex((color) => color.name === name) })).filter(({ index }) => index >= 0)
    const chooseTargetAlternative = (alternative) => {
        const asset = assetsByTargetId.get(alternative.id)
        if (asset) setSelectedImageAspectKey(imageAspectKey(asset))
        setSelectedTarget({ ...alternative, alternatives: [alternative], ancestors: [], descendants: [] })
        setSelectionExpanded(true)
        iframeRef.current?.contentWindow?.postMessage({
            source: 'eceee-render-host',
            action: 'selectTarget',
            targetId: alternative.id,
        }, '*')
    }

    const updateSelectedExampleText = (text) => {
        if (!selectedView || !selectedTarget) return
        pendingPreviewTextsRef.current[selectedView.id] = {
            ...(pendingPreviewTextsRef.current[selectedView.id] || {}),
            [selectedTarget.id]: text,
        }
        onPendingPreviewTextsChange()
        setSelectedTarget((current) => ({ ...current, text }))
        iframeRef.current?.contentWindow?.postMessage({
            source: 'eceee-render-host', action: 'updateText', targetId: selectedTarget.id, text,
        }, '*')
    }

    const formatSelectedRichText = (command, value = '') => {
        if (!selectedTarget?.richText) return
        iframeRef.current?.contentWindow?.postMessage({
            source: 'eceee-render-host', action: 'formatText', targetId: selectedTarget.id, command, value,
        }, '*')
    }

    const createSelectedRichTextLink = () => {
        const value = window.prompt('Link URL')?.trim()
        if (!value) return
        const url = /^(https?:\/\/|mailto:|tel:|\/|#)/i.test(value) ? value : `https://${value}`
        formatSelectedRichText('createLink', url)
    }

    const persistSelectedExampleText = async () => {
        const view = previewContent.views.find((candidate) => candidate.id === selectedView?.id)
        if (!view) return
        const result = await savePreviewText?.(view.id, {
            ...(view.texts || {}),
            ...(pendingPreviewTextsRef.current[view.id] || {}),
        })
        if (result) {
            delete pendingPreviewTextsRef.current[view.id]
            onPendingPreviewTextsChange()
        }
    }

    const importSelectedSource = async () => {
        const result = await importPreviewSource?.(selectedSourceContent)
        if (!result?.previewContent?.views) return
        setPreviewContent(result.previewContent)
        setContentMode('demo')
        setViewId(result.importedViewId || result.previewContent.views.at(-1)?.id || '')
        setSelectedTarget(null)
    }

    const deleteExample = async (option) => {
        const view = option.view || previewContent.views.find((candidate) => String(candidate.id) === String(option.value))
        const result = await deletePreviewContent?.(view)
        if (!result?.previewContent?.views) return
        delete pendingPreviewTextsRef.current[view.id]
        onPendingPreviewTextsChange()
        setPreviewContent(result.previewContent)
        setViewId((current) => result.previewContent.views.some((candidate) => candidate.id === current)
            ? current
            : result.previewContent.views[0]?.id || '')
        setSelectedTarget(null)
    }

    const uploadExampleImage = async (sourceUrl, sourcePath, sourceMatchIndex, file) => {
        if (!selectedView || !file) return
        const result = await replacePreviewImage?.(selectedView.id, sourceUrl, sourcePath, sourceMatchIndex, file)
        if (result?.previewContent?.views) setPreviewContent(result.previewContent)
    }

    const addThemeValue = (encoded) => {
        const value = addableThemeValues.find((candidate) => propertyKey(candidate.kind, candidate.index, candidate.field) === encoded)
        if (!value) return
        setAddedThemeValues((current) => new Set(current).add(encoded))
        iframeRef.current?.contentWindow?.postMessage({
            source: 'eceee-render-host', action: 'readTargetStyles', targetId: value.row.targetId,
        }, '*')
    }

    const removeThemeValue = (kind, index, row, field, label) => {
        if (!row.values[field]) {
            setAddedThemeValues((current) => {
                const next = new Set(current)
                next.delete(propertyKey(kind, index, field))
                return next
            })
            return
        }
        if (!window.confirm(`Remove ${label}? It will use the current theme default instead.`)) return
        updateWorkspace((next) => {
            next[kind][index].values[field] = ''
            return next
        })
        setAddedThemeValues((current) => new Set(current).add(propertyKey(kind, index, field)))
        iframeRef.current?.contentWindow?.postMessage({
            source: 'eceee-render-host', action: 'readTargetStyles', targetId: row.targetId,
        }, '*')
    }

    const themeImageEditor = selectedImageAspect && (
        <section className="space-y-4">
            <div><p className="text-xs font-semibold uppercase tracking-wide text-blue-700">Theme image</p><h2 className="mt-1 text-lg font-semibold text-gray-900">{selectedImageAspect.label}</h2>{selectedImageAspect.details && <p className="mt-1 text-sm text-gray-500">{selectedImageAspect.details}</p>}<p className="mt-2 text-sm text-gray-600">View every stored image and replace editable theme images here.</p></div>
            <div className="grid gap-4">
                {selectedImageAspect.assets.map((asset) => {
                    const usage = imageBreakpointUsage(asset, selectedImageAspect.assets, workspace.breakpoints)
                    return (
                    <article key={asset.assetKey} className="space-y-3 rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
                        <div className="flex items-start justify-between gap-2"><div className="min-w-0"><h4 className="truncate text-sm font-medium text-gray-900">{asset.displayName}</h4><p className="truncate text-xs text-gray-500">{asset.filename || 'No file yet'}</p></div>{usage && <span className="shrink-0 rounded bg-blue-50 px-2 py-1 text-xs font-semibold text-blue-700">{usage.badge}</span>}</div>
                        {asset.url ? <img src={asset.url} alt="" className="h-32 w-full rounded-md border border-gray-200 bg-gray-50 object-contain" /> : <div className="flex h-32 items-center justify-center rounded-md border border-dashed border-gray-300 bg-gray-50 text-sm text-gray-500">Placeholder image</div>}
                        {usage && <div className="rounded-md bg-gray-50 px-3 py-2"><p className="text-sm font-medium text-gray-800">{usage.summary}</p><p className="mt-0.5 text-xs text-gray-600">{usage.range}</p></div>}
                        <p className="text-xs text-gray-600">{asset.width || asset.requiredWidth || asset.recommendedWidth || '?'} × {asset.height || asset.requiredHeight || '?'} px{asset.kind === 'library' ? asset.size ? ` · ${Math.ceil(asset.size / 1024)} KB` : '' : ` · ${asset.dpr || 2}x`}</p>
                        {asset.kind === 'design-group' && !asset.url && <div className="grid gap-2"><input aria-label={`${asset.displayName} placeholder name`} value={placeholderDrafts[asset.assetKey]?.displayName ?? asset.displayName} onChange={(event) => setPlaceholderDrafts((current) => ({ ...current, [asset.assetKey]: { ...current[asset.assetKey], displayName: event.target.value } }))} className="rounded-md border border-gray-300 px-2 py-1.5 text-sm" /><div className="grid grid-cols-2 gap-2"><input aria-label={`${asset.displayName} placeholder width`} type="number" min="16" max="8000" value={placeholderDrafts[asset.assetKey]?.width ?? asset.requiredWidth ?? ''} onChange={(event) => setPlaceholderDrafts((current) => ({ ...current, [asset.assetKey]: { ...current[asset.assetKey], width: event.target.value } }))} placeholder="Width px" className="rounded-md border border-gray-300 px-2 py-1.5 text-sm" /><input aria-label={`${asset.displayName} placeholder height`} type="number" min="16" max="8000" value={placeholderDrafts[asset.assetKey]?.height ?? asset.requiredHeight ?? ''} onChange={(event) => setPlaceholderDrafts((current) => ({ ...current, [asset.assetKey]: { ...current[asset.assetKey], height: event.target.value } }))} placeholder="Height px" className="rounded-md border border-gray-300 px-2 py-1.5 text-sm" /></div><button type="button" onClick={() => createPlaceholder(asset)} className="rounded-md border border-gray-300 px-3 py-2 text-sm">Create placeholder</button></div>}
                        {asset.replaceable === false
                            ? <p className="text-xs text-gray-500">Stored in the theme image library. Select an element that uses it to replace that occurrence.</p>
                            : <><input ref={(node) => { uploadRefs.current[asset.assetKey] = node }} type="file" accept="image/png,image/jpeg,image/gif,image/webp,image/svg+xml" onChange={(event) => replaceAsset(asset, event.target.files?.[0])} className="sr-only" /><button type="button" aria-label={`${asset.url ? 'Replace' : 'Upload'} ${asset.displayName}`} onClick={() => uploadRefs.current[asset.assetKey]?.click()} className="w-full rounded-md bg-blue-600 px-3 py-2 text-sm font-medium text-white">{asset.url ? 'Replace theme image' : 'Upload theme image'}</button></>}
                    </article>
                    )
                })}
            </div>
        </section>
    )

    const themeDetailsEditor = (
        <section className="space-y-5">
            <div><h2 className="text-xs font-semibold uppercase tracking-wide text-blue-700">Theme details</h2><h3 className="mt-1 text-lg font-semibold text-gray-900">Name and identity</h3><p className="mt-2 text-sm text-gray-600">These changes stay in the Designer draft until you publish them.</p></div>
            <label className="block text-sm font-medium text-gray-800" htmlFor="theme-name">
                Name
                <input id="theme-name" value={workspace.name} maxLength={255} required onChange={(event) => updateWorkspace((next) => { next.name = event.target.value; return next })} className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm" />
                {!workspace.name.trim() && <span className="mt-1 block text-xs font-normal text-red-600">Enter a name before saving.</span>}
            </label>
            <label className="block text-sm font-medium text-gray-800" htmlFor="theme-description">
                Description
                <textarea id="theme-description" value={workspace.description || ''} maxLength={10000} rows={5} onChange={(event) => updateWorkspace((next) => { next.description = event.target.value; return next })} className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm" />
            </label>
            {[previewAsset, siteIconAsset].filter(Boolean).map((asset) => (
                <article key={asset.assetKey} className="space-y-3 border-t border-gray-200 pt-5">
                    <div><h3 className="text-sm font-medium text-gray-900">{asset.displayName}</h3><p className="mt-1 text-xs text-gray-500">{asset.kind === 'preview' ? 'Shown when people browse and select themes.' : 'Used as the browser tab and saved-site icon.'}</p></div>
                    {asset.url ? <img src={asset.url} alt="" className={`${asset.kind === 'site-icon' ? 'h-20 w-20' : 'h-36 w-full'} rounded-md border border-gray-200 bg-gray-50 object-contain`} /> : <div className={`${asset.kind === 'site-icon' ? 'h-20 w-20' : 'h-36 w-full'} flex items-center justify-center rounded-md border border-dashed border-gray-300 bg-gray-50 px-2 text-center text-xs text-gray-500`}>No image selected</div>}
                    <p className="truncate text-xs text-gray-500">{asset.filename || 'No file yet'}</p>
                    <input ref={(node) => { uploadRefs.current[`details:${asset.assetKey}`] = node }} type="file" accept="image/png,image/jpeg,image/gif,image/webp,image/svg+xml" onChange={(event) => replaceAsset(asset, event.target.files?.[0])} className="sr-only" />
                    <button type="button" aria-label={`Change ${asset.displayName}`} onClick={() => uploadRefs.current[`details:${asset.assetKey}`]?.click()} className="w-full rounded-md border border-blue-600 bg-white px-3 py-2 text-sm font-medium text-blue-700">{asset.url ? 'Replace image' : 'Choose image'}</button>
                </article>
            ))}
        </section>
    )

    const renderTargetAlternative = (alternative) => {
        const asset = assetsByTargetId.get(alternative.id)
        if (!asset) return <button key={alternative.id} type="button" aria-pressed={alternative.id === selectedTarget.id} onClick={() => chooseTargetAlternative(alternative)} className={`rounded-md border px-3 py-2 text-left text-sm ${alternative.id === selectedTarget.id ? 'border-blue-500 bg-blue-50 font-medium text-blue-800' : 'border-gray-200 bg-white text-gray-800 hover:bg-gray-50'}`}>{alternative.label}</button>

        const width = asset.width || asset.requiredWidth || asset.recommendedWidth
        const height = asset.height || asset.requiredHeight
        return (
            <article key={alternative.id} className={`rounded-md border p-2 ${alternative.id === selectedTarget.id ? 'border-blue-500 bg-blue-50' : 'border-gray-200 bg-white'}`}>
                <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-2">
                    <button type="button" aria-label={`Select ${asset.displayName}`} aria-pressed={alternative.id === selectedTarget.id} onClick={() => chooseTargetAlternative(alternative)} className="flex min-w-0 flex-1 items-center gap-2 rounded text-left focus:outline-none focus:ring-2 focus:ring-blue-500">
                        {asset.url
                            ? <img src={asset.url} alt="" className="h-10 w-14 shrink-0 rounded border border-gray-200 bg-gray-50 object-contain" />
                            : <span className="flex h-10 w-14 shrink-0 items-center justify-center rounded border border-dashed border-gray-300 bg-gray-50 text-gray-400"><ImageIcon className="h-4 w-4" /></span>}
                        <span className="min-w-0 flex-1">
                            <span className="block truncate text-sm font-medium text-gray-900">{asset.displayName}</span>
                            <span className="block truncate text-xs text-gray-500">{asset.filename || 'No file uploaded'}</span>
                            <span className="block text-[11px] text-gray-500">{width || '?'} × {height || '?'} px · {asset.dpr || 2}x</span>
                        </span>
                    </button>
                    <input ref={(node) => { uploadRefs.current[`inline:${asset.assetKey}`] = node }} type="file" accept="image/png,image/jpeg,image/gif,image/webp,image/svg+xml" onChange={(event) => replaceAsset(asset, event.target.files?.[0])} className="sr-only" />
                    <button type="button" aria-label={`${asset.url ? 'Replace' : 'Upload'} ${asset.displayName}`} onClick={() => uploadRefs.current[`inline:${asset.assetKey}`]?.click()} className="shrink-0 rounded-md border border-blue-600 bg-white px-2 py-1 text-xs font-medium text-blue-700 hover:bg-blue-50">{asset.url ? 'Replace' : 'Upload'}</button>
                </div>
            </article>
        )
    }

    const previewOptions = (
        <div className="min-w-0">
            <section className="space-y-3">
                <div>
                    <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-500">Preview content source</h3>
                    <p className="mt-1 text-xs text-gray-500">Use editable content saved with this theme, or inspect the theme against a real page or object from your sites.</p>
                </div>
                <div role="tablist" aria-label="Preview content source" className="grid grid-cols-2 rounded-md border border-gray-300 bg-gray-100 p-1">
                    <button type="button" role="tab" aria-selected={contentMode === 'demo'} aria-controls="preview-source-demo" disabled={disabled || !demoOptions.length} onClick={() => { setContentMode('demo'); setSelectedTarget(null) }} className={`rounded px-2 py-1.5 text-xs font-medium ${contentMode === 'demo' ? 'bg-white text-blue-700 shadow-sm' : 'text-gray-600 hover:text-gray-900'} disabled:cursor-not-allowed disabled:opacity-50`}>Theme demo</button>
                    <button type="button" role="tab" aria-selected={contentMode === 'content'} aria-controls="preview-source-content" disabled={disabled || !externalContentOptions.length} onClick={() => { setContentMode('content'); setSelectedTarget(null) }} className={`rounded px-2 py-1.5 text-xs font-medium ${contentMode === 'content' ? 'bg-white text-blue-700 shadow-sm' : 'text-gray-600 hover:text-gray-900'} disabled:cursor-not-allowed disabled:opacity-50`}>Your sites</button>
                </div>
                {contentMode === 'demo' && <div id="preview-source-demo" role="tabpanel"><ContentSourceBrowser sourceMode="demo" options={demoOptions} value={String(viewId)} onChange={(value) => { setViewId(value); setSelectedTarget(null) }} onDelete={deleteExample} disabled={disabled} /></div>}
                {contentMode === 'content' && <div id="preview-source-content" role="tabpanel"><ContentSourceBrowser sourceMode="content" options={externalContentOptions} value={sourceContentId} onChange={(value) => { setSourceContentId(value); setSelectedTarget(null) }} disabled={disabled} loading={loadingContent} /></div>}
                {contentMode === 'content' && <div className="space-y-2">
                    <p className="flex items-center gap-2 text-xs text-gray-500">{loadingContent && <Loader2 className="h-3.5 w-3.5 animate-spin" />}{loadingContent ? 'Loading the selected content…' : 'The selected content is read-only until it is imported as a theme example.'}</p>
                    <button type="button" onClick={importSelectedSource} disabled={disabled || loadingContent || !selectedSourceContent || !sourceContentModel} className="w-full rounded-md border border-blue-600 bg-white px-3 py-2 text-sm font-medium text-blue-700 hover:bg-blue-50 disabled:cursor-not-allowed disabled:opacity-50">Import as theme example</button>
                </div>}
                {contentMode === 'none' && <p className="rounded-md border border-dashed border-gray-300 p-3 text-sm text-gray-500">There is no page or object to preview.</p>}
            </section>
        </div>
    )

    const imageAspectNavigation = (
        <section className="space-y-5">
            <div><h2 className="text-xl font-semibold text-gray-900">Theme images</h2><p className="mt-1 text-sm text-gray-600">Choose an image family to inspect and replace every size.</p></div>
            <div className="grid gap-2">
                {imageAspects.map((aspect) => {
                    const previewAsset = aspect.assets.find((asset) => asset.url) || aspect.assets[0]
                    return <button type="button" key={aspect.key} aria-label={`Select image aspect ${aspect.label}${aspect.details ? ` ${aspect.details}` : ''}`} aria-pressed={aspect.key === selectedImageAspect?.key} onClick={() => setSelectedImageAspectKey(aspect.key)} className={`flex min-w-0 items-center gap-3 rounded-lg border p-2 text-left transition ${aspect.key === selectedImageAspect?.key ? 'border-blue-500 bg-blue-50 ring-1 ring-blue-200' : 'border-gray-200 bg-white hover:border-gray-300 hover:bg-gray-50'}`}>
                        {previewAsset?.url ? <img src={previewAsset.url} alt="" className="h-12 w-16 shrink-0 rounded border border-gray-200 bg-gray-50 object-contain" /> : <span className="flex h-12 w-16 shrink-0 items-center justify-center rounded border border-dashed border-gray-300 bg-gray-50 text-gray-400"><ImageIcon className="h-4 w-4" /></span>}
                        <span className="min-w-0 flex-1"><span className="block truncate text-sm font-semibold text-gray-900">{aspect.label}</span>{aspect.details && <span className="mt-0.5 block truncate text-xs text-gray-500">{aspect.details}</span>}<span className="mt-1 block text-xs text-gray-500">{aspect.assets.length} {aspect.assets.length === 1 ? 'version' : 'versions'}</span></span>
                    </button>
                })}
            </div>
        </section>
    )

    const childTargets = (selectedTarget?.descendants || []).filter((target) => !selectedTargetIds.includes(target.id))
    const richTextToolClass = 'inline-flex h-8 min-w-8 items-center justify-center rounded border border-gray-300 bg-white px-2 text-xs text-gray-700 hover:bg-gray-50'

    const selectedEditor = selectedTarget && (
        <section className="border-b border-gray-200 bg-white">
            <button
                type="button"
                aria-expanded={selectionExpanded}
                aria-controls="selected-element-editor"
                aria-label={`${selectionExpanded ? 'Collapse' : 'Expand'} ${selectedTarget.label} settings`}
                onClick={() => setSelectionExpanded((current) => !current)}
                className="flex w-full items-center gap-2 bg-blue-50 px-3 py-2 text-left hover:bg-blue-100"
            >
                <div className="min-w-0 flex-1">
                    <p className="text-xs font-semibold uppercase tracking-wide text-blue-700">Selected element</p>
                    <h2 className="truncate text-base font-semibold text-gray-900">{selectedTarget.label}</h2>
                </div>
                <ChevronDown className={`h-4 w-4 shrink-0 text-blue-700 transition-transform ${selectionExpanded ? 'rotate-180' : ''}`} />
            </button>
            {selectionExpanded && (
                <div id="selected-element-editor" className="space-y-3 border-t border-blue-200 p-2">
                    {contentMode === 'demo' && selectedTarget.kind === 'element' && selectedTarget.editable && <section className="space-y-2">
                        <div><h3 className="text-sm font-medium text-gray-900">Example text</h3><p className="mt-0.5 text-xs text-gray-500">Double-click the text in the preview to edit it directly.</p></div>
                        {selectedTarget.richText ? <div className="flex flex-wrap items-center gap-1" role="toolbar" aria-label="Rich text formatting">
                            <select aria-label="Paragraph style" defaultValue="" onChange={(event) => { if (event.target.value) formatSelectedRichText('formatBlock', event.target.value); event.target.value = '' }} className="h-8 rounded border border-gray-300 bg-white px-2 text-xs text-gray-700">
                                <option value="">Paragraph style</option><option value="p">Paragraph</option><option value="h2">Heading 2</option><option value="h3">Heading 3</option><option value="blockquote">Quote</option>
                            </select>
                            <button type="button" aria-label="Bold" title="Bold" onClick={() => formatSelectedRichText('bold')} className={richTextToolClass}><Bold className="h-3.5 w-3.5" /></button>
                            <button type="button" aria-label="Italic" title="Italic" onClick={() => formatSelectedRichText('italic')} className={richTextToolClass}><Italic className="h-3.5 w-3.5" /></button>
                            <button type="button" aria-label="Bulleted list" title="Bulleted list" onClick={() => formatSelectedRichText('insertUnorderedList')} className={richTextToolClass}><List className="h-3.5 w-3.5" /></button>
                            <button type="button" aria-label="Numbered list" title="Numbered list" onClick={() => formatSelectedRichText('insertOrderedList')} className={richTextToolClass}><ListOrdered className="h-3.5 w-3.5" /></button>
                            <button type="button" aria-label="Add link" title="Add link" onClick={createSelectedRichTextLink} className={richTextToolClass}><Link2 className="h-3.5 w-3.5" /></button>
                            <button type="button" aria-label="Remove link" onClick={() => formatSelectedRichText('unlink')} className={richTextToolClass}>Unlink</button>
                        </div> : <textarea aria-label="Example text" value={selectedTarget.text || ''} onChange={(event) => updateSelectedExampleText(event.target.value)} rows={3} className="w-full rounded border border-gray-300 px-2 py-1.5 text-sm text-gray-900" />}
                        <button type="button" onClick={persistSelectedExampleText} disabled={disabled} className="rounded bg-blue-600 px-2.5 py-1.5 text-xs font-medium text-white hover:bg-blue-700 disabled:opacity-50">Save example text</button>
                    </section>}
                    {(selectedTarget.alternatives?.length > 1 || selectedTarget.kind === 'asset') && <section className="space-y-1.5"><h3 className="text-sm font-medium text-gray-900">Choose what to edit</h3><p className="text-xs text-gray-500">These elements share the same area.</p>{(selectedTarget.alternatives || [selectedTarget]).some((alternative) => assetsByTargetId.has(alternative.id)) && <p className="text-xs text-gray-500">Images can be uploaded or replaced directly.</p>}<div className="grid gap-1">{(selectedTarget.alternatives?.length ? selectedTarget.alternatives : [selectedTarget]).map(renderTargetAlternative)}</div></section>}
                    {targetTypography.map(({ row, index }) => {
                        const fields = activeFields('typography', index, row, workspace.constraints.editableTypographyProperties)
                        return fields.length > 0 && <section key={`type-${index}`} className="space-y-2 border-t border-gray-200 pt-3"><h3 className="text-sm font-medium text-gray-900">{sectionLabel('typography', row)}</h3><ValueFields idPrefix={`typography-${index}`} values={row.values} defaults={themeDefaults[row.targetId]} fields={fields} labels={typographyLabels} onChange={(field, value) => updateWorkspace((next) => { next.typography[index].values[field] = value; return next })} onRemove={(field) => removeThemeValue('typography', index, row, field, typographyLabels[field] || field)} /></section>
                    })}
                    {targetSpacing.map(({ row, index }) => {
                        const fields = activeFields('spacing', index, row, workspace.constraints.editableSpacingProperties)
                        return fields.length > 0 && <section key={`space-${index}`} className="space-y-2 border-t border-gray-200 pt-3"><h3 className="text-sm font-medium text-gray-900">{sectionLabel('spacing', row)}</h3><p className="text-xs text-gray-500">Margin and padding can also be changed by clicking their labels in the preview.</p><ValueFields idPrefix={`spacing-${index}`} values={row.values} defaults={themeDefaults[row.targetId]} fields={fields} labels={spacingLabels} onChange={(field, value) => updateWorkspace((next) => { next.spacing[index].values[field] = value; return next })} onRemove={(field) => removeThemeValue('spacing', index, row, field, spacingLabels[field] || field)} /></section>
                    })}
                    {addableThemeValues.length > 0 && <section className="border-t border-gray-200 pt-4"><label htmlFor="add-theme-value" className="text-xs font-semibold uppercase tracking-wide text-gray-500">Add theme value</label><select id="add-theme-value" value="" onChange={(event) => addThemeValue(event.target.value)} className="mt-2 w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-700"><option value="">Choose a value…</option>{addableThemeValues.map((value) => <option key={propertyKey(value.kind, value.index, value.field)} value={propertyKey(value.kind, value.index, value.field)}>{value.label}</option>)}</select></section>}
                    {relevantColors.length > 0 && <section className="space-y-3 border-t border-gray-200 pt-4"><h3 className="font-medium text-gray-900">Colors used here</h3>{relevantColors.map(({ name, index }) => <label key={name} className="flex items-center gap-3"><input type="color" value={/^#[0-9a-f]{6}$/i.test(workspace.colors[index].value) ? workspace.colors[index].value : '#000000'} onChange={(event) => updateWorkspace((next) => { next.colors[index].value = event.target.value; return next })} className="h-10 w-12 rounded border border-gray-300" /><span className="min-w-0 flex-1 text-sm font-medium">{name}</span><input aria-label={`${name} value`} value={workspace.colors[index].value} onChange={(event) => updateWorkspace((next) => { next.colors[index].value = event.target.value; return next })} className="w-28 rounded-md border border-gray-300 px-2 py-1.5 font-mono text-xs" /></label>)}</section>}
                    {childTargets.length > 0 && <section className="border-t border-gray-200 pt-3"><h3 className="mb-2 text-sm font-medium text-gray-900">Elements inside</h3><div className="divide-y divide-gray-200 border-y border-gray-200">{childTargets.map((child) => <details key={child.id} className="group py-1"><summary className="flex cursor-pointer list-none items-center gap-2 py-1 text-sm text-gray-800"><ChevronRight className="h-3.5 w-3.5 transition-transform group-open:rotate-90" /><span className="min-w-0 flex-1 truncate">{child.label}</span></summary><div className="pb-2 pl-5"><button type="button" onClick={() => chooseTargetAlternative(child)} className="text-xs font-medium text-blue-700 hover:underline">Edit this element</button></div></details>)}</div></section>}
                    {!targetTypography.length && !targetSpacing.length && !relevantColors.length && selectedTarget.kind !== 'element' && selectedTarget.kind !== 'asset' && <p className="rounded-lg border border-dashed border-gray-300 p-4 text-sm text-gray-500">Choose a more specific text or image inside this area to edit its details.</p>}
                </div>
            )}
        </section>
    )

    const exampleImageEditor = contentMode === 'demo' && selectedView && selectedElementImages.length > 0 && (
        <section className="space-y-2 border-t border-gray-200 pt-3">
            <div><h2 className="text-sm font-semibold text-gray-900">Images in this element</h2><p className="mt-0.5 text-xs text-gray-500">Only images inside the selected element are shown.</p></div>
            <div className="divide-y divide-gray-200 border-y border-gray-200">{selectedElementImages.map(({ sourceUrl, sourcePath, sourceMatchIndex }, index) => {
                const url = sourceUrl
                const name = decodeURIComponent(url.split('/').at(-1)?.split('?')[0] || `Image ${index + 1}`)
                const inputKey = `example:${selectedView.id}:${index}`
                return <article key={`${url}:${JSON.stringify(sourcePath)}:${sourceMatchIndex}`} className="flex min-w-0 items-center gap-2 py-1.5">
                    <img src={url} alt="" className="h-12 w-16 shrink-0 rounded border border-gray-200 bg-gray-50 object-contain" />
                    <span className="min-w-0 flex-1 truncate text-xs text-gray-600">{name}</span>
                    <input ref={(node) => { uploadRefs.current[inputKey] = node }} type="file" accept="image/png,image/jpeg,image/gif,image/webp,image/svg+xml" onChange={(event) => uploadExampleImage(url, sourcePath, sourceMatchIndex, event.target.files?.[0])} className="sr-only" />
                    <button type="button" aria-label={`Replace example image ${name}`} onClick={() => uploadRefs.current[inputKey]?.click()} disabled={disabled} className="shrink-0 rounded-md border border-blue-600 bg-white px-2 py-1 text-xs font-medium text-blue-700 hover:bg-blue-50 disabled:opacity-50">Replace</button>
                </article>
            })}</div>
        </section>
    )

    const navigationButtonClass = (active) => `flex w-full min-w-0 items-center gap-2 rounded-md px-3 py-2 text-left text-sm font-medium ${active ? 'bg-blue-50 text-blue-700 ring-1 ring-blue-200' : 'text-gray-700 hover:bg-gray-50'}`

    return (
        <main
            ref={workspaceRef}
            className={`grid min-h-0 flex-1 grid-cols-1 ${mobilePane === 'preview' ? 'grid-rows-1' : 'grid-rows-[auto_minmax(0,1fr)]'} xl:grid-cols-[var(--designer-sidebar-width)_var(--designer-sidebar-handle-width)_minmax(0,1fr)_var(--designer-inspector-handle-width)_var(--designer-inspector-width)] xl:grid-rows-1`}
            style={{
                '--designer-sidebar-width': sidebarCollapsed ? '0px' : `${sidebarWidth}px`,
                '--designer-sidebar-handle-width': sidebarCollapsed ? '0px' : `${resizeHandleWidth}px`,
                '--designer-inspector-width': inspectorCollapsed ? '0px' : `${inspectorWidth}px`,
                '--designer-inspector-handle-width': inspectorCollapsed ? '0px' : `${resizeHandleWidth}px`,
            }}
        >
            <section aria-label="Preview navigation" className={`${mobilePane === 'preview' || sidebarCollapsed ? 'hidden' : 'flex'} min-h-0 min-w-0 flex-col border-r border-gray-200 bg-white xl:col-start-1 xl:row-start-1 xl:border-r-0`}>
                <div className="flex items-center justify-between border-b border-gray-200 px-3 py-2"><span className="text-xs font-semibold uppercase tracking-wide text-gray-500">Navigator</span><button type="button" aria-label="Collapse preview navigation" onClick={() => setSidebarCollapsed(true)} className="hidden rounded p-1 text-gray-500 hover:bg-gray-100 xl:block"><ChevronLeft className="h-4 w-4" /></button></div>
                <div className="min-h-0 min-w-0 flex-1 overflow-y-auto p-3">
                    <fieldset disabled={disabled} className="min-w-0">{previewOptions}</fieldset>
                    <nav className="mt-6 space-y-2 border-t border-gray-200 pt-4" aria-label="Designer views">
                        <div><h2 className="text-xs font-semibold uppercase tracking-wide text-gray-500">Preview pages</h2><p className="mt-1 text-xs text-gray-500">Choose what the center preview displays.</p></div>
                        <div className="grid gap-1">
                            {contentMode === 'content'
                                ? selectedSourceContent && <button type="button" aria-label={selectedSourceContent.kind === 'object' ? selectedSourceContent.objectTitle : selectedSourceContent.pageTitle} onClick={() => { setWorkspaceView('preview'); setSelectedTarget(null) }} className={navigationButtonClass(workspaceView === 'preview')}>
                                    {selectedSourceContent.kind === 'object' ? <Box className="h-4 w-4 shrink-0" /> : <FileText className="h-4 w-4 shrink-0" />}<TruncatedNavigationText value={selectedSourceContent.kind === 'object' ? selectedSourceContent.objectTitle : selectedSourceContent.pageTitle} />
                                </button>
                                : contentMode === 'demo' && previewContent.views.map((view) => <button type="button" key={view.id} aria-label={view.label} onClick={() => { setWorkspaceView('preview'); setViewId(view.id); setSelectedTarget(null) }} className={navigationButtonClass(workspaceView === 'preview' && view.id === viewId)}>{view.kind === 'object' ? <Box className="h-4 w-4 shrink-0" /> : <FileText className="h-4 w-4 shrink-0" />}<TruncatedNavigationText value={view.label} /></button>)}
                            <button type="button" onClick={() => { setWorkspaceView('details'); setSelectedTarget(null) }} className={navigationButtonClass(workspaceView === 'details')}><Settings2 className="h-4 w-4 shrink-0" />Theme details</button>
                            <button type="button" onClick={() => { setWorkspaceView('images'); setSelectedTarget(null) }} className={navigationButtonClass(workspaceView === 'images')}><ImageIcon className="h-4 w-4 shrink-0" />Theme images</button>
                        </div>
                    </nav>
                </div>
            </section>
            <div
                role="separator"
                aria-label="Resize preview navigation"
                aria-orientation="vertical"
                aria-valuemin={minSidebarWidth}
                aria-valuemax={maxSidebarWidth}
                aria-valuenow={sidebarWidth}
                aria-valuetext={`${sidebarWidth} pixels`}
                tabIndex={0}
                title="Drag to resize preview navigation"
                onPointerDown={startSidebarResize}
                onPointerMove={moveSidebarResize}
                onPointerUp={stopSidebarResize}
                onPointerCancel={stopSidebarResize}
                onKeyDown={resizeSidebarWithKeyboard}
                className={`group hidden touch-none cursor-col-resize items-center justify-center border-x border-gray-200 focus:outline-none focus:ring-2 focus:ring-inset focus:ring-blue-500 xl:col-start-2 xl:row-start-1 ${sidebarCollapsed ? '' : 'xl:flex'} ${isResizingSidebar ? 'bg-blue-50' : 'bg-gray-50 hover:bg-blue-50'}`}
            >
                <span className={`h-10 w-0.5 rounded-full ${isResizingSidebar ? 'bg-blue-500' : 'bg-gray-300 group-hover:bg-blue-500 group-focus:bg-blue-500'}`} />
            </div>
            <section className={`${mobilePane === 'edit' ? 'hidden' : 'flex'} min-h-0 min-w-0 flex-col bg-gray-100 p-2 xl:col-start-3 xl:row-start-1 xl:flex xl:p-3`}>
                <div className="mb-2 flex items-center justify-between gap-2">
                    <div className="flex items-center gap-1">
                        <button type="button" aria-label={sidebarCollapsed ? 'Expand preview navigation' : 'Collapse preview navigation'} aria-pressed={sidebarCollapsed} onClick={() => setSidebarCollapsed((current) => !current)} className="hidden rounded border border-gray-300 bg-white p-1.5 text-gray-600 hover:bg-gray-50 xl:inline-flex">{sidebarCollapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}</button>
                        <button type="button" aria-label={inspectorCollapsed ? 'Expand theme inspector' : 'Collapse theme inspector'} aria-pressed={inspectorCollapsed} onClick={() => setInspectorCollapsed((current) => !current)} className="hidden rounded border border-gray-300 bg-white p-1.5 text-gray-600 hover:bg-gray-50 xl:inline-flex">{inspectorCollapsed ? <ChevronLeft className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}</button>
                    </div>
                    <div className="flex items-center gap-2">
                    {contentMode !== 'none' && <button type="button" aria-pressed={guidesEnabled} onClick={() => setGuidesEnabled((current) => !current)} className="inline-flex items-center gap-2 rounded-md border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50">{guidesEnabled ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}{guidesEnabled ? 'Hide guides' : 'Show guides'}</button>}
                    <span className="text-xs capitalize text-gray-500">{viewport}</span>
                    </div>
                </div>
                <div ref={previewFrameRef} className="relative min-h-0 flex-1 overflow-hidden rounded-lg border border-gray-300 bg-white shadow-sm">
                    {contentMode === 'none' || (contentMode === 'demo' && !selectedView) ? <div className="flex h-full items-center justify-center p-6 text-sm text-gray-500">There is no page or object to preview.</div> : contentMode === 'content' && !sourceContentModel ? <div className="flex h-full items-center justify-center gap-2 p-6 text-sm text-gray-500">{loadingContent && <Loader2 className="h-4 w-4 animate-spin" />}{loadingContent ? 'Loading the selected content…' : 'The selected content could not be loaded.'}</div> : <RenderFrame
                        frameRef={iframeRef}
                        model={previewModel}
                        title="Live theme preview"
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
            <div
                role="separator"
                aria-label="Resize theme inspector"
                aria-orientation="vertical"
                aria-valuemin={minInspectorWidth}
                aria-valuemax={maxInspectorWidth}
                aria-valuenow={inspectorWidth}
                aria-valuetext={`${inspectorWidth} pixels`}
                tabIndex={0}
                title="Drag to resize the theme inspector"
                onPointerDown={startInspectorResize}
                onPointerMove={moveInspectorResize}
                onPointerUp={stopInspectorResize}
                onPointerCancel={stopInspectorResize}
                onKeyDown={resizeInspectorWithKeyboard}
                className={`group hidden touch-none cursor-col-resize items-center justify-center border-x border-gray-200 focus:outline-none focus:ring-2 focus:ring-inset focus:ring-blue-500 xl:col-start-4 xl:row-start-1 ${inspectorCollapsed ? '' : 'xl:flex'} ${isResizingInspector ? 'bg-blue-50' : 'bg-gray-50 hover:bg-blue-50'}`}
            >
                <span className={`h-10 w-0.5 rounded-full ${isResizingInspector ? 'bg-blue-500' : 'bg-gray-300 group-hover:bg-blue-500 group-focus:bg-blue-500'}`} />
            </div>
            <section aria-label="Theme inspector" className={`${mobilePane === 'preview' || inspectorCollapsed ? 'hidden' : 'flex'} min-h-0 min-w-0 flex-col border-l border-gray-200 bg-white xl:col-start-5 xl:row-start-1 xl:border-l-0`}>
                <div className="flex items-center justify-between border-b border-gray-200 px-3 py-2"><span className="text-xs font-semibold uppercase tracking-wide text-gray-500">Inspector</span><button type="button" aria-label="Collapse theme inspector" onClick={() => setInspectorCollapsed(true)} className="hidden rounded p-1 text-gray-500 hover:bg-gray-100 xl:block"><ChevronRight className="h-4 w-4" /></button></div>
                <fieldset disabled={disabled} className="min-h-0 flex-1 overflow-y-auto p-2">
                    {workspaceView === 'details'
                        ? themeDetailsEditor
                        : workspaceView === 'images'
                            ? <div className="space-y-6">{imageAspectNavigation}{themeImageEditor}</div>
                            : <div className="space-y-3">{selectedEditor || <div className="flex min-h-32 items-center justify-center border border-dashed border-gray-300 p-3 text-center text-sm text-gray-500">Select an element in the preview to edit its text, images, typography, spacing, and colors.</div>}{exampleImageEditor}</div>}
                </fieldset>
            </section>
        </main>
    )
}

export default SemanticThemeWorkspace
