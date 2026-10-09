import { createElement, useEffect, useMemo, useRef, useState } from 'react'
import { Archive, ArrowDown, ArrowLeftFromLine, ArrowRightFromLine, ArrowUp, Braces, Copy, KeyRound, Maximize2, Minus, PanelLeftClose, PanelLeftOpen, PanelRightClose, PanelRightOpen, Plus, Redo2, RotateCcw, Trash2, Undo2 } from 'lucide-react'

import RenderFrame from '../../rendering/RenderFrame'
import { validateLayoutDefinition } from '../../rendering/themeLayoutRenderer'
import { themeBreakpointDefinition } from '../theme/breakpointConfig'
import { inheritedLayoutStyle } from './layoutStyleInheritance'

const nodeTypes = ['container', 'section', 'grid', 'row', 'column', 'semantic', 'slot']
const styleFields = ['display', 'width', 'max_width', 'min_height', 'grid_template_columns', 'grid_column', 'flex_direction', 'flex_wrap', 'flex_grow', 'order', 'gap', 'padding', 'margin', 'align_items', 'justify_content', 'background_color', 'color', 'border', 'border_radius']
const gridStyleFields = ['grid_template_columns', 'gap', 'padding', 'margin', 'align_items', 'justify_content']
const externallyEditableNodeTypes = new Set(['container', 'grid', 'semantic', 'slot'])
const defaultPresentationColors = { container: '#3b82f6', grid: '#a855f7', semantic: '#f59e0b', slot: '#f43f5e' }
const defaultStructureWidth = 300
const minStructureWidth = 220
const maxStructureWidth = 520
const defaultInspectorWidth = 340
const minInspectorWidth = 280
const maxInspectorWidth = 600
const minCanvasWidth = 400
const resizeHandleWidth = 8
const collapsedPanelWidth = 44
const uuid = () => crypto.randomUUID()
const clone = (value) => structuredClone(value)
const splitList = (value) => String(value || '').split(/[\n,]/).map((item) => item.trim()).filter(Boolean)
const colorPickerValue = (value, fallback) => /^#[0-9a-f]{6}$/i.test(String(value || '').trim()) ? String(value).trim() : fallback
const breakpointCanvasWidth = (entries, key) => {
    const index = entries.findIndex(([breakpoint]) => breakpoint === key)
    const minimum = Number(entries[index]?.[1] || 0)
    if (minimum > 0) return minimum
    const nextMinimum = Number(entries[index + 1]?.[1] || 640)
    return Math.min(375, Math.max(320, nextMinimum - 1))
}

const mapNode = (node, nodeId, mapper) => {
    if (node.id === nodeId) return mapper(node)
    return { ...node, children: node.children.map((child) => mapNode(child, nodeId, mapper)) }
}

const findNode = (node, nodeId, parent = null) => {
    if (node.id === nodeId) return { node, parent }
    for (const child of node.children) {
        const found = findNode(child, nodeId, node)
        if (found) return found
    }
    return null
}

const findParentChain = (root, nodeId, chain = []) => {
    if (root.id === nodeId) return [...chain, root]
    for (const child of root.children) {
        const found = findParentChain(child, nodeId, [...chain, root])
        if (found) return found
    }
    return null
}

const replaceNode = (root, replacement) => mapNode(root, replacement.id, () => replacement)

const removeNode = (root, nodeId) => ({
    ...root,
    children: root.children.filter((child) => child.id !== nodeId).map((child) => removeNode(child, nodeId)),
})

const freshenNodeIds = (node) => ({ ...node, id: uuid(), children: node.children.map(freshenNodeIds) })

const documentError = (document) => {
    if (!document || document.schema_version !== 1 || !Array.isArray(document.items) || !document.items.length) return 'The document needs schema_version 1 and at least one layout.'
    const keys = document.items.map((item) => item.key)
    if (new Set(keys).size !== keys.length) return 'Layout keys must be unique.'
    if (!keys.includes('main_layout') || !keys.includes('landing_page') || !keys.includes('error_layout')) return 'Main, Landing Page, and Error Page are required layouts and cannot be removed.'
    if (!keys.includes(document.default_layout_key)) return 'The default layout key must reference a layout.'
    const invalid = document.items.find((item) => !validateLayoutDefinition(item))
    return invalid ? `Layout “${invalid.label || invalid.key || 'Untitled'}” has an invalid tree or slot definition.` : ''
}

const nodeDisplayName = (node) => {
    if (!node) return 'Inspector'
    const label = String(node.label || '').trim()
    if (node.type === 'slot') return label || `Slot · ${node.slot_key}`
    if (node.type === 'semantic') {
        const tag = String(node.tag || 'div').toLowerCase()
        return label ? `${label} <${tag}>` : `${tag.charAt(0).toUpperCase()}${tag.slice(1)}`
    }
    return label || `${node.type.charAt(0).toUpperCase()}${node.type.slice(1)}`
}

const TreeNode = ({ node, selectedId, onSelect, onDragStart, onDrop, disabled = false, depth = 0 }) => (
    <li>
        <button type="button" draggable={!disabled} disabled={disabled} onDragStart={(event) => { if (!disabled) onDragStart(event, node.id) }} onDragOver={(event) => { if (!disabled && node.type !== 'slot') event.preventDefault() }} onDrop={(event) => { if (!disabled) onDrop(event, node.id) }} onClick={() => onSelect(node.id)} aria-current={selectedId === node.id ? 'true' : undefined} className={`flex min-h-8 w-full items-center gap-2 rounded px-2 py-1 text-left text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 disabled:cursor-not-allowed disabled:opacity-50 ${selectedId === node.id ? 'bg-blue-50 font-medium text-blue-800' : 'text-gray-700 hover:bg-gray-100'}`} style={{ paddingLeft: `${8 + depth * 14}px` }}>
            <span className="truncate">{nodeDisplayName(node)}</span>
        </button>
        {node.children.length > 0 && <ul>{node.children.map((child) => <TreeNode key={child.id} node={child} selectedId={selectedId} onSelect={onSelect} onDragStart={onDragStart} onDrop={onDrop} disabled={disabled} depth={depth + 1} />)}</ul>}
    </li>
)

const iconButton = 'inline-flex min-h-8 min-w-8 items-center justify-center rounded text-gray-600 hover:bg-gray-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 disabled:opacity-35'

const LayoutDesignerWorkspace = ({ workspace, viewport, updateWorkspace, disabled, initialLayoutKey = '', initialAction = '', onInitialActionHandled }) => {
    const layouts = workspace.layouts
    const breakpointEntries = useMemo(() => Object.entries(workspace.breakpoints || {})
        .filter(([, value]) => Number.isFinite(Number(value)))
        .sort((left, right) => Number(left[1]) - Number(right[1])), [workspace.breakpoints])
    const initialBreakpoint = breakpointEntries.some(([key]) => key === viewport) ? viewport : breakpointEntries.at(-1)?.[0] || 'xs'
    const [selectedLayoutId, setSelectedLayoutId] = useState(layouts.items[0]?.id || '')
    const [selectedNodeId, setSelectedNodeId] = useState(layouts.items[0]?.root?.id || '')
    const [mode, setMode] = useState('visual')
    const [activeBreakpoint, setActiveBreakpoint] = useState(initialBreakpoint)
    const [inspectingLayout, setInspectingLayout] = useState(false)
    const [jsonText, setJsonText] = useState(() => JSON.stringify(layouts, null, 2))
    const [jsonError, setJsonError] = useState('')
    const [undoStack, setUndoStack] = useState([])
    const [redoStack, setRedoStack] = useState([])
    const [structureWidth, setStructureWidth] = useState(defaultStructureWidth)
    const [inspectorWidth, setInspectorWidth] = useState(defaultInspectorWidth)
    const [structureCollapsed, setStructureCollapsed] = useState(false)
    const [inspectorCollapsed, setInspectorCollapsed] = useState(false)
    const [isResizingStructure, setIsResizingStructure] = useState(false)
    const [isResizingInspector, setIsResizingInspector] = useState(false)
    const [zoomMode, setZoomMode] = useState('fit')
    const [manualZoom, setManualZoom] = useState(1)
    const [canvasViewportSize, setCanvasViewportSize] = useState({ width: 0, height: 0 })
    const initialActionHandled = useRef(false)
    const workspaceRef = useRef(null)
    const canvasViewportRef = useRef(null)
    const canvasFrameRef = useRef(null)
    const structureResizeRef = useRef(null)
    const inspectorResizeRef = useRef(null)

    const selectedLayout = layouts.items.find((item) => item.id === selectedLayoutId) || layouts.items[0]
    const selected = selectedLayout ? findNode(selectedLayout.root, selectedNodeId) : null
    const usage = workspace.layoutUsage?.[selectedLayout?.key] || { pageCount: 0, pageIds: [], versionCount: 0, schemaCount: 0, slots: {} }
    const activeStyleBreakpoint = activeBreakpoint === 'xs' ? 'base' : activeBreakpoint
    const styleFieldGroups = selected?.node.type === 'grid'
        ? [
            { label: 'Grid layout', fields: gridStyleFields },
            { label: 'Other styles', fields: styleFields.filter((field) => !gridStyleFields.includes(field)) },
        ]
        : [{ label: 'Responsive styles', fields: styleFields }]
    const canvasWidth = breakpointCanvasWidth(breakpointEntries, activeBreakpoint)
    const fitZoom = canvasViewportSize.width ? Math.min(1, Math.max(0.25, (canvasViewportSize.width - 24) / canvasWidth)) : 1
    const canvasZoom = zoomMode === 'fit' ? fitZoom : manualZoom
    const canvasHeight = Math.max(480, (canvasViewportSize.height || 480) / canvasZoom)

    useEffect(() => {
        if (mode !== 'visual' || !canvasViewportRef.current || typeof ResizeObserver === 'undefined') return undefined
        const updateSize = () => {
            const rectangle = canvasViewportRef.current?.getBoundingClientRect()
            if (rectangle) setCanvasViewportSize({ width: rectangle.width, height: rectangle.height })
        }
        updateSize()
        const observer = new ResizeObserver(updateSize)
        observer.observe(canvasViewportRef.current)
        return () => observer.disconnect()
    }, [mode])

    const changeZoom = (difference) => {
        setManualZoom(Math.min(2, Math.max(0.25, Math.round((canvasZoom + difference) * 10) / 10)))
        setZoomMode('manual')
    }

    const selectStructureNode = (nodeId) => {
        setSelectedNodeId(nodeId)
        setInspectingLayout(false)
        canvasFrameRef.current?.contentWindow?.postMessage({
            source: 'eceee-render-host',
            action: 'selectTarget',
            targetId: `layout-node:${nodeId}`,
        }, '*')
    }

    const inspectLayout = (layout) => {
        setSelectedLayoutId(layout.id)
        setSelectedNodeId(layout.root.id)
        setInspectingLayout(true)
        setJsonError('')
        canvasFrameRef.current?.contentWindow?.postMessage({ source: 'eceee-render-host', action: 'clearTarget' }, '*')
    }

    const clampStructureWidth = (width) => {
        const workspaceWidth = workspaceRef.current?.getBoundingClientRect().width || window.innerWidth
        const currentInspectorWidth = inspectorCollapsed ? collapsedPanelWidth : inspectorWidth
        const availableMaximum = workspaceWidth - currentInspectorWidth - minCanvasWidth - resizeHandleWidth * 2
        return Math.min(Math.max(minStructureWidth, availableMaximum), maxStructureWidth, Math.max(minStructureWidth, width))
    }

    const clampInspectorWidth = (width) => {
        const workspaceWidth = workspaceRef.current?.getBoundingClientRect().width || window.innerWidth
        const currentStructureWidth = structureCollapsed ? collapsedPanelWidth : structureWidth
        const availableMaximum = workspaceWidth - currentStructureWidth - minCanvasWidth - resizeHandleWidth * 2
        return Math.min(Math.max(minInspectorWidth, availableMaximum), maxInspectorWidth, Math.max(minInspectorWidth, width))
    }

    const startStructureResize = (event) => {
        if (event.button !== 0) return
        event.preventDefault()
        structureResizeRef.current = { pointerId: event.pointerId, startX: event.clientX, startWidth: structureWidth }
        event.currentTarget.setPointerCapture?.(event.pointerId)
        setIsResizingStructure(true)
    }

    const moveStructureResize = (event) => {
        const resize = structureResizeRef.current
        if (!resize || event.pointerId !== resize.pointerId) return
        setStructureWidth(clampStructureWidth(resize.startWidth + event.clientX - resize.startX))
    }

    const stopStructureResize = (event) => {
        const resize = structureResizeRef.current
        if (!resize || event.pointerId !== resize.pointerId) return
        structureResizeRef.current = null
        event.currentTarget.releasePointerCapture?.(event.pointerId)
        setIsResizingStructure(false)
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

    useEffect(() => {
        if (!isResizingStructure && !isResizingInspector) return undefined
        const previousCursor = document.body.style.cursor
        const previousUserSelect = document.body.style.userSelect
        document.body.style.cursor = 'col-resize'
        document.body.style.userSelect = 'none'
        return () => {
            document.body.style.cursor = previousCursor
            document.body.style.userSelect = previousUserSelect
        }
    }, [isResizingInspector, isResizingStructure])

    useEffect(() => {
        if (!selectedLayout && layouts.items[0]) setSelectedLayoutId(layouts.items[0].id)
    }, [layouts.items, selectedLayout])

    useEffect(() => {
        const requested = layouts.items.find((layout) => layout.key === initialLayoutKey)
        if (requested) {
            setSelectedLayoutId(requested.id)
            setSelectedNodeId(requested.root.id)
        }
    }, [initialLayoutKey])

    const commit = (next, selection = {}) => {
        if (disabled) return false
        const error = documentError(next)
        if (error) {
            setJsonError(error)
            return false
        }
        setUndoStack((history) => [...history.slice(-49), clone(layouts)])
        setRedoStack([])
        updateWorkspace((draft) => { draft.layouts = next; return draft })
        if (selection.layoutId) setSelectedLayoutId(selection.layoutId)
        if (selection.nodeId) setSelectedNodeId(selection.nodeId)
        setJsonText(JSON.stringify(next, null, 2))
        setJsonError('')
        return true
    }

    const restoreHistory = (source, setSource, setTarget) => {
        if (disabled) return
        const previous = source.at(-1)
        if (!previous) return
        setSource(source.slice(0, -1))
        setTarget((history) => [...history, clone(layouts)])
        updateWorkspace((draft) => { draft.layouts = clone(previous); return draft })
        setSelectedLayoutId(previous.items[0]?.id || '')
        setSelectedNodeId(previous.items[0]?.root?.id || '')
        setJsonText(JSON.stringify(previous, null, 2))
        setJsonError('')
    }

    useEffect(() => {
        const onKeyDown = (event) => {
            if (disabled) return
            if (!(event.metaKey || event.ctrlKey) || event.key.toLowerCase() !== 'z') return
            event.preventDefault()
            if (event.shiftKey) restoreHistory(redoStack, setRedoStack, setUndoStack)
            else restoreHistory(undoStack, setUndoStack, setRedoStack)
        }
        window.addEventListener('keydown', onKeyDown)
        return () => window.removeEventListener('keydown', onKeyDown)
    }, [disabled, layouts, redoStack, undoStack])

    const updateLayout = (updater, selection) => {
        const next = clone(layouts)
        const index = next.items.findIndex((item) => item.id === selectedLayout.id)
        next.items[index] = updater(next.items[index])
        commit(next, selection)
    }

    const updateNode = (updater) => updateLayout((layout) => ({ ...layout, root: mapNode(layout.root, selectedNodeId, updater) }))

    const setStyleOverride = (field, value) => updateNode((node) => {
        const styles = clone(node.styles || {})
        styles[activeStyleBreakpoint] = { ...(styles[activeStyleBreakpoint] || {}), [field]: value }
        return { ...node, styles }
    })

    const resetStyleOverride = (field) => updateNode((node) => {
        const styles = clone(node.styles || {})
        if (styles[activeStyleBreakpoint]) {
            delete styles[activeStyleBreakpoint][field]
            if (!Object.keys(styles[activeStyleBreakpoint]).length) delete styles[activeStyleBreakpoint]
        }
        return { ...node, styles }
    })

    const addLayout = () => {
        const count = layouts.items.length + 1
        const key = `layout_${count}`
        const slotKey = 'main'
        const root = { id: uuid(), type: 'container', label: 'Page container', children: [{ id: uuid(), type: 'slot', label: 'Main content', slot_key: slotKey, children: [], styles: {}, class_names: ['layout-slot', 'slot-main'] }], styles: { base: { width: '100%' } }, class_names: [`${key}-container`] }
        const layout = { id: uuid(), key, label: `Layout ${count}`, description: '', status: 'active', root, slots: { [slotKey]: { label: 'Main', description: 'Primary content', order: 10, max_widgets: null, required: true, collapse_behavior: 'never', default_widgets: [] } } }
        commit({ ...clone(layouts), items: [...clone(layouts.items), layout] }, { layoutId: layout.id, nodeId: root.id })
    }

    useEffect(() => {
        if (initialAction !== 'create' || initialActionHandled.current || disabled) return
        initialActionHandled.current = true
        addLayout()
        onInitialActionHandled?.()
    }, [initialAction, disabled])

    const duplicateLayout = () => {
        const copy = clone(selectedLayout)
        copy.id = uuid()
        copy.key = `${selectedLayout.key}_copy_${layouts.items.length + 1}`.slice(0, 64)
        copy.label = `${selectedLayout.label} copy`
        copy.root = freshenNodeIds(copy.root)
        commit({ ...clone(layouts), items: [...clone(layouts.items), copy] }, { layoutId: copy.id, nodeId: copy.root.id })
    }

    const archiveLayout = () => {
        if (['main_layout', 'landing_page', 'error_layout'].includes(selectedLayout.key)) return setJsonError('Main, Landing Page, and Error Page must always remain active.')
        updateLayout((layout) => ({ ...layout, status: layout.status === 'archived' ? 'active' : 'archived' }))
    }

    const deleteLayout = () => {
        const references = Number(usage.versionCount || 0) + Number(usage.schemaCount || 0)
        if (['main_layout', 'landing_page', 'error_layout'].includes(selectedLayout.key)) return setJsonError('Main, Landing Page, and Error Page are required and cannot be deleted.')
        if (selectedLayout.key === layouts.default_layout_key) return setJsonError('The default layout cannot be deleted.')
        if (references) return setJsonError(`This layout has ${references} version or schema references and cannot be deleted.`)
        const items = layouts.items.filter((item) => item.id !== selectedLayout.id)
        commit({ ...clone(layouts), items }, { layoutId: items[0]?.id, nodeId: items[0]?.root?.id })
    }

    const addNode = (type, placement = 'inside') => {
        if (!selected) return
        if (placement === 'inside' && selected.node.type === 'slot') return setJsonError('Slots cannot contain child nodes.')
        if (placement !== 'inside' && !selected.parent) return setJsonError('Nodes cannot be inserted beside the root node.')
        let key
        const node = { id: uuid(), type, label: type === 'slot' ? 'New slot' : `${type.charAt(0).toUpperCase()}${type.slice(1)}`, children: [], styles: {}, class_names: [] }
        if (type === 'semantic') node.tag = 'section'
        if (type === 'slot') {
            let index = Object.keys(selectedLayout.slots).length + 1
            key = `slot_${index}`
            while (selectedLayout.slots[key]) key = `slot_${++index}`
            node.slot_key = key
            node.label = `Slot ${Object.keys(selectedLayout.slots).length + 1}`
            node.class_names = ['layout-slot', `slot-${key}`]
        }
        updateLayout((layout) => {
            if (key) layout.slots[key] = { label: `Slot ${Object.keys(layout.slots).length + 1}`, description: '', order: Object.keys(layout.slots).length * 10 + 10, max_widgets: null, collapse_behavior: 'never', default_widgets: [] }
            const parentId = placement === 'inside' ? selectedNodeId : selected.parent.id
            layout.root = mapNode(layout.root, parentId, (current) => {
                const children = [...current.children]
                if (placement === 'inside') children.push(node)
                else children.splice(children.findIndex((child) => child.id === selectedNodeId) + (placement === 'after' ? 1 : 0), 0, node)
                return { ...current, children }
            })
            return layout
        }, { nodeId: node.id })
    }

    const move = (direction) => {
        const chain = findParentChain(selectedLayout.root, selectedNodeId)
        if (!chain || chain.length < 2) return
        const parent = chain.at(-2)
        const index = parent.children.findIndex((child) => child.id === selectedNodeId)
        const target = index + direction
        if (target < 0 || target >= parent.children.length) return
        updateLayout((layout) => {
            layout.root = mapNode(layout.root, parent.id, (node) => {
                const children = [...node.children]
                ;[children[index], children[target]] = [children[target], children[index]]
                return { ...node, children }
            })
            return layout
        })
    }

    const indent = () => {
        const chain = findParentChain(selectedLayout.root, selectedNodeId)
        if (!chain || chain.length < 2) return
        const parent = chain.at(-2)
        const index = parent.children.findIndex((child) => child.id === selectedNodeId)
        const previous = parent.children[index - 1]
        if (!previous || previous.type === 'slot') return
        const moving = selected.node
        updateLayout((layout) => {
            layout.root = removeNode(layout.root, moving.id)
            layout.root = mapNode(layout.root, previous.id, (node) => ({ ...node, children: [...node.children, moving] }))
            return layout
        })
    }

    const outdent = () => {
        const chain = findParentChain(selectedLayout.root, selectedNodeId)
        if (!chain || chain.length < 3) return
        const parent = chain.at(-2)
        const grandparent = chain.at(-3)
        const moving = selected.node
        updateLayout((layout) => {
            layout.root = removeNode(layout.root, moving.id)
            layout.root = mapNode(layout.root, grandparent.id, (node) => {
                const children = [...node.children]
                children.splice(children.findIndex((child) => child.id === parent.id) + 1, 0, moving)
                return { ...node, children }
            })
            return layout
        })
    }

    const deleteNode = () => {
        if (!selected?.parent) return setJsonError('The root node cannot be deleted.')
        const slotKey = selected.node.slot_key
        if (slotKey && usage.slots?.[slotKey]) return setJsonError(`Slot “${slotKey}” contains content in ${usage.slots[slotKey]} versions and cannot be removed.`)
        updateLayout((layout) => {
            layout.root = removeNode(layout.root, selectedNodeId)
            if (slotKey) delete layout.slots[slotKey]
            return layout
        }, { nodeId: selected.parent.id })
    }

    const reparentNode = (movingId, targetId) => {
        if (movingId === selectedLayout.root.id || movingId === targetId) return
        const moving = findNode(selectedLayout.root, movingId)?.node
        const target = findNode(selectedLayout.root, targetId)?.node
        if (!moving || !target || target.type === 'slot' || findNode(moving, targetId)) return
        updateLayout((layout) => {
            layout.root = removeNode(layout.root, movingId)
            layout.root = mapNode(layout.root, targetId, (node) => ({ ...node, children: [...node.children, moving] }))
            return layout
        }, { nodeId: movingId })
    }

    const duplicateNode = () => {
        if (!selected?.parent) return setJsonError('The root node cannot be duplicated.')
        updateLayout((layout) => {
            const createdSlots = {}
            const keys = new Set(Object.keys(layout.slots))
            const copySubtree = (node) => {
                const copy = { ...clone(node), id: uuid(), children: node.children.map(copySubtree) }
                if (copy.type === 'slot') {
                    let index = 2
                    let key = `${node.slot_key}_copy`
                    while (keys.has(key)) key = `${node.slot_key}_copy_${index++}`
                    keys.add(key)
                    createdSlots[key] = { ...clone(layout.slots[node.slot_key]), label: `${layout.slots[node.slot_key]?.label || node.slot_key} copy` }
                    copy.slot_key = key
                    copy.class_names = ['layout-slot', `slot-${key}`]
                }
                return copy
            }
            const copy = copySubtree(selected.node)
            Object.assign(layout.slots, createdSlots)
            layout.root = mapNode(layout.root, selected.parent.id, (parent) => {
                const children = [...parent.children]
                children.splice(children.findIndex((child) => child.id === selected.node.id) + 1, 0, copy)
                return { ...parent, children }
            })
            return layout
        })
    }

    useEffect(() => {
        const onStructureKeyDown = (event) => {
            if (disabled) return
            const tag = event.target?.tagName?.toLowerCase()
            if (['input', 'textarea', 'select'].includes(tag)) return
            if (event.altKey && event.key === 'ArrowUp') { event.preventDefault(); move(-1) }
            else if (event.altKey && event.key === 'ArrowDown') { event.preventDefault(); move(1) }
            else if (event.altKey && event.key === 'ArrowRight') { event.preventDefault(); indent() }
            else if (event.altKey && event.key === 'ArrowLeft') { event.preventDefault(); outdent() }
            else if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'd') { event.preventDefault(); duplicateNode() }
            else if (event.key === 'Delete') { event.preventDefault(); deleteNode() }
        }
        window.addEventListener('keydown', onStructureKeyDown)
        return () => window.removeEventListener('keydown', onStructureKeyDown)
    }, [disabled, layouts, selectedLayoutId, selectedNodeId])

    const applyJson = () => {
        try {
            const parsed = JSON.parse(jsonText)
            const error = documentError(parsed)
            if (error) return setJsonError(error)
            commit(parsed, { layoutId: parsed.items[0].id, nodeId: parsed.items[0].root.id })
        } catch (error) {
            setJsonError(`JSON could not be parsed: ${error.message}`)
        }
    }

    const canvasModel = useMemo(() => {
        if (!selectedLayout) return null
        const slots = Object.fromEntries(Object.keys(selectedLayout.slots).map((key) => [key, []]))
        return { layout: selectedLayout.key, layoutDefinition: selectedLayout, layoutDefinitionRequired: true, layoutBreakpoints: workspace.breakpoints, slots, context: { preview: true }, designer: { catalog: {}, texts: {}, assets: [], guidesEnabled: false, layoutCanvas: true } }
    }, [selectedLayout])

    const updateSlot = (updater) => updateLayout((layout) => {
        const key = selected.node.slot_key
        layout.slots[key] = updater(layout.slots[key] || {})
        return layout
    })

    const frameMessage = (event) => {
        if (event.data?.source !== 'eceee-designer-preview' || event.data?.action !== 'select') return
        if (event.data?.targetId?.startsWith('layout-node:')) {
            setSelectedNodeId(event.data.targetId.slice('layout-node:'.length))
            setInspectingLayout(false)
        }
    }

    if (!selectedLayout) return <main className="flex flex-1 items-center justify-center p-8"><div className="text-center"><p className="text-sm text-gray-600">No layouts are defined.</p><button type="button" onClick={addLayout} className="mt-3 rounded bg-blue-600 px-4 py-2 text-sm font-medium text-white">Create layout</button></div></main>

    return <main className="flex min-h-0 flex-1 flex-col overflow-hidden bg-gray-50">
        <div className="flex items-center justify-between border-b border-gray-200 bg-white px-4 py-2">
            <div className="flex items-center gap-1" role="tablist" aria-label="Layout editor mode">
                <button type="button" role="tab" aria-selected={mode === 'visual'} onClick={() => setMode('visual')} className={`rounded px-3 py-1.5 text-sm ${mode === 'visual' ? 'bg-gray-900 text-white' : 'text-gray-600 hover:bg-gray-100'}`}>Visual</button>
                <button type="button" role="tab" aria-selected={mode === 'json'} onClick={() => { setJsonText(JSON.stringify(layouts, null, 2)); setMode('json') }} className={`inline-flex items-center gap-1.5 rounded px-3 py-1.5 text-sm ${mode === 'json' ? 'bg-gray-900 text-white' : 'text-gray-600 hover:bg-gray-100'}`}><Braces className="h-4 w-4" />JSON</button>
            </div>
            <div className="flex items-center gap-1">
                <button type="button" aria-label="Undo layout change" title="Undo · Ctrl/⌘ Z" onClick={() => restoreHistory(undoStack, setUndoStack, setRedoStack)} disabled={!undoStack.length || disabled} className={iconButton}><Undo2 className="h-4 w-4" /></button>
                <button type="button" aria-label="Redo layout change" title="Redo · Ctrl/⌘ Shift Z" onClick={() => restoreHistory(redoStack, setRedoStack, setUndoStack)} disabled={!redoStack.length || disabled} className={iconButton}><Redo2 className="h-4 w-4" /></button>
            </div>
        </div>
        {jsonError && <div role="alert" className="border-b border-red-200 bg-red-50 px-4 py-2 text-sm text-red-800">{jsonError}</div>}
        {mode === 'json' ? <section className="flex min-h-0 flex-1 flex-col p-4">
            <label htmlFor="theme-layout-json" className="mb-2 text-sm font-medium text-gray-800">Canonical layout document</label>
            <textarea id="theme-layout-json" spellCheck="false" value={jsonText} disabled={disabled} onChange={(event) => { setJsonText(event.target.value); setJsonError('') }} className="min-h-0 flex-1 resize-none rounded border border-gray-300 bg-white p-4 font-mono text-xs leading-5 text-gray-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 disabled:bg-gray-100" />
            <div className="mt-3 flex justify-end"><button type="button" onClick={applyJson} disabled={disabled} className="rounded bg-blue-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-40">Apply JSON</button></div>
        </section> : <div
            ref={workspaceRef}
            className="grid min-h-0 flex-1 grid-cols-1 xl:grid-cols-[var(--layout-structure-width)_var(--layout-structure-handle-width)_minmax(400px,1fr)_var(--layout-inspector-handle-width)_var(--layout-inspector-width)]"
            style={{
                '--layout-structure-width': `${structureCollapsed ? collapsedPanelWidth : structureWidth}px`,
                '--layout-inspector-width': `${inspectorCollapsed ? collapsedPanelWidth : inspectorWidth}px`,
                '--layout-structure-handle-width': `${structureCollapsed ? 0 : resizeHandleWidth}px`,
                '--layout-inspector-handle-width': `${inspectorCollapsed ? 0 : resizeHandleWidth}px`,
            }}
        >
            <aside className={`min-h-0 overflow-y-auto border-r border-gray-200 bg-white xl:col-start-1 xl:border-r-0 ${structureCollapsed ? 'overflow-hidden p-1.5' : 'p-3'}`}>
                <div className={`flex items-center ${structureCollapsed ? 'justify-center' : 'justify-between'}`}>
                    {!structureCollapsed && <h2 className="text-sm font-semibold text-gray-900">Layouts</h2>}
                    <div className="flex items-center gap-1">
                        {!structureCollapsed && <button type="button" onClick={addLayout} disabled={disabled} className={iconButton} aria-label="Create layout"><Plus className="h-4 w-4" /></button>}
                        <button type="button" onClick={() => setStructureCollapsed((current) => !current)} className={iconButton} aria-label={structureCollapsed ? 'Expand layout structure panel' : 'Collapse layout structure panel'} aria-expanded={!structureCollapsed} title={structureCollapsed ? 'Expand layout structure panel' : 'Collapse layout structure panel'}>{structureCollapsed ? <PanelLeftOpen className="h-4 w-4" /> : <PanelLeftClose className="h-4 w-4" />}</button>
                    </div>
                </div>
                {!structureCollapsed && <>
                <ul className="mt-2 space-y-1">{layouts.items.map((layout) => <li key={layout.id}><button type="button" onClick={() => inspectLayout(layout)} aria-current={layout.id === selectedLayout.id ? 'true' : undefined} className={`w-full rounded px-2 py-2 text-left text-sm ${layout.id === selectedLayout.id ? 'bg-blue-50 text-blue-800' : 'text-gray-700 hover:bg-gray-100'}`}><span className="block truncate font-medium">{layout.label}</span><span className="block text-[11px] opacity-65">{layout.key}{layout.key === layouts.default_layout_key ? ' · default' : ''}{layout.status === 'archived' ? ' · archived' : ''}</span></button></li>)}</ul>
                <div className="mt-4 flex gap-1 border-t border-gray-200 pt-3">
                    <button type="button" onClick={duplicateLayout} disabled={disabled} className={iconButton} aria-label="Duplicate layout"><Copy className="h-4 w-4" /></button>
                    <button type="button" onClick={archiveLayout} disabled={disabled || ['main_layout', 'landing_page', 'error_layout'].includes(selectedLayout.key)} className={iconButton} aria-label={selectedLayout.status === 'archived' ? 'Restore layout' : 'Archive layout'}><Archive className="h-4 w-4" /></button>
                    <button type="button" onClick={deleteLayout} disabled={disabled || ['main_layout', 'landing_page', 'error_layout'].includes(selectedLayout.key)} className={iconButton} aria-label="Delete unused layout"><Trash2 className="h-4 w-4" /></button>
                </div>
                <div className="mt-5 flex items-center justify-between"><h3 className="text-xs font-semibold uppercase tracking-wide text-gray-500">Structure</h3><select aria-label="Node to add" defaultValue="" onChange={(event) => { if (event.target.value) addNode(event.target.value); event.target.value = '' }} disabled={disabled} className="rounded border border-gray-300 bg-white px-2 py-1 text-xs"><option value="" disabled>Add…</option>{nodeTypes.map((type) => <option key={type} value={type}>{type}</option>)}</select></div>
                <ul className="mt-2"><TreeNode node={selectedLayout.root} selectedId={selectedNodeId} onSelect={selectStructureNode} onDragStart={(event, nodeId) => event.dataTransfer.setData('text/layout-node', nodeId)} onDrop={(event, targetId) => { event.preventDefault(); reparentNode(event.dataTransfer.getData('text/layout-node'), targetId) }} disabled={disabled} /></ul>
                <div className="mt-3 flex flex-wrap gap-1 border-t border-gray-200 pt-3">
                    <button type="button" onClick={() => move(-1)} disabled={disabled} className={iconButton} aria-label="Move node up"><ArrowUp className="h-4 w-4" /></button>
                    <button type="button" onClick={() => move(1)} disabled={disabled} className={iconButton} aria-label="Move node down"><ArrowDown className="h-4 w-4" /></button>
                    <button type="button" onClick={indent} disabled={disabled} className={iconButton} aria-label="Indent node"><ArrowRightFromLine className="h-4 w-4" /></button>
                    <button type="button" onClick={outdent} disabled={disabled} className={iconButton} aria-label="Outdent node"><ArrowLeftFromLine className="h-4 w-4" /></button>
                    <button type="button" onClick={duplicateNode} disabled={disabled} className={iconButton} aria-label="Duplicate node"><Copy className="h-4 w-4" /></button>
                    <button type="button" onClick={deleteNode} disabled={disabled} className={iconButton} aria-label="Delete unused node"><Trash2 className="h-4 w-4" /></button>
                </div>
                </>}
            </aside>
            <div
                role="separator"
                aria-label="Resize layout structure panel"
                aria-orientation="vertical"
                aria-valuemin={minStructureWidth}
                aria-valuemax={maxStructureWidth}
                aria-valuenow={structureWidth}
                aria-valuetext={`${structureWidth} pixels`}
                tabIndex={0}
                title="Drag to resize the layout structure panel"
                onPointerDown={startStructureResize}
                onPointerMove={moveStructureResize}
                onPointerUp={stopStructureResize}
                onPointerCancel={stopStructureResize}
                onKeyDown={(event) => {
                    if (!['ArrowLeft', 'ArrowRight'].includes(event.key)) return
                    event.preventDefault()
                    setStructureWidth((current) => clampStructureWidth(current + (event.key === 'ArrowRight' ? 16 : -16)))
                }}
                className={`group hidden touch-none cursor-col-resize items-center justify-center border-x border-gray-200 focus:outline-none focus:ring-2 focus:ring-inset focus:ring-blue-500 xl:col-start-2 ${structureCollapsed ? 'xl:hidden' : 'xl:flex'} ${isResizingStructure ? 'bg-blue-50' : 'bg-gray-50 hover:bg-blue-50'}`}
            >
                <span className={`h-10 w-0.5 rounded-full ${isResizingStructure ? 'bg-blue-500' : 'bg-gray-300 group-hover:bg-blue-500 group-focus:bg-blue-500'}`} />
            </div>
            <section className="flex min-h-0 min-w-0 flex-col bg-gray-200 p-3 xl:col-start-3" aria-label="Layout canvas">
                <div className="mb-2 flex flex-wrap items-center justify-between gap-2 rounded border border-gray-300 bg-white p-1 shadow-sm">
                    <div className="flex items-center gap-1" aria-label="Canvas insertion controls">
                        <button type="button" onClick={() => addNode('section', 'before')} disabled={disabled || !selected?.parent} className="rounded px-2 py-1 text-xs text-gray-700 hover:bg-gray-100 disabled:opacity-35">Add before</button>
                        <button type="button" onClick={() => addNode('section', 'inside')} disabled={disabled || selected?.node.type === 'slot'} className="rounded px-2 py-1 text-xs text-gray-700 hover:bg-gray-100 disabled:opacity-35">Add inside</button>
                        <button type="button" onClick={() => addNode('section', 'after')} disabled={disabled || !selected?.parent} className="rounded px-2 py-1 text-xs text-gray-700 hover:bg-gray-100 disabled:opacity-35">Add after</button>
                    </div>
                    <div className="flex items-center gap-2">
                        <div role="group" aria-label="Theme breakpoint" className="flex items-center rounded-md border border-gray-300 p-0.5">
                            {breakpointEntries.map(([key, minimum]) => {
                                const definition = themeBreakpointDefinition(key)
                                const label = key === 'xs' ? 'Base' : definition?.label || key.toUpperCase()
                                return <button type="button" key={key} onClick={() => { setActiveBreakpoint(key); setZoomMode('fit') }} aria-label={`${label} breakpoint at ${minimum}px`} aria-pressed={activeBreakpoint === key} title={`${label} · ${minimum}px`} className={`inline-flex h-7 min-w-7 items-center justify-center rounded p-1 text-xs font-semibold ${activeBreakpoint === key ? 'bg-gray-200 text-gray-900' : 'text-gray-500 hover:bg-gray-100'}`}>{key === 'xs' ? 'B' : definition?.icon ? createElement(definition.icon, { className: 'h-4 w-4' }) : key.toUpperCase()}</button>
                            })}
                        </div>
                        <span className="text-[11px] tabular-nums text-gray-500">{canvasWidth}px canvas</span>
                        <div className="flex items-center rounded border border-gray-300" aria-label="Canvas zoom controls">
                            <button type="button" onClick={() => changeZoom(-0.1)} disabled={canvasZoom <= 0.25} aria-label="Zoom out canvas" title="Zoom out" className="inline-flex h-7 w-7 items-center justify-center rounded-l text-gray-600 hover:bg-gray-100 disabled:opacity-35"><Minus className="h-3.5 w-3.5" /></button>
                            <button type="button" onClick={() => setZoomMode('fit')} aria-label="Fit canvas to available space" aria-pressed={zoomMode === 'fit'} title="Fit canvas" className={`inline-flex h-7 min-w-14 items-center justify-center gap-1 border-x border-gray-300 px-1.5 text-[11px] tabular-nums ${zoomMode === 'fit' ? 'bg-blue-50 text-blue-700' : 'text-gray-600 hover:bg-gray-100'}`}><Maximize2 className="h-3 w-3" />{Math.round(canvasZoom * 100)}%</button>
                            <button type="button" onClick={() => changeZoom(0.1)} disabled={canvasZoom >= 2} aria-label="Zoom in canvas" title="Zoom in" className="inline-flex h-7 w-7 items-center justify-center rounded-r text-gray-600 hover:bg-gray-100 disabled:opacity-35"><Plus className="h-3.5 w-3.5" /></button>
                        </div>
                    </div>
                </div>
                <div ref={canvasViewportRef} className="min-h-0 min-w-0 flex-1 overflow-auto" aria-label="Zoomable layout canvas viewport">
                    <div className="relative mx-auto bg-white shadow-sm" style={{ width: `${canvasWidth * canvasZoom}px`, height: `${canvasHeight * canvasZoom}px` }}>
                        <div className="absolute left-0 top-0 origin-top-left" style={{ width: `${canvasWidth}px`, height: `${canvasHeight}px`, transform: `scale(${canvasZoom})` }}>
                            {canvasModel && <RenderFrame frameRef={canvasFrameRef} model={canvasModel} title={`${selectedLayout.label} layout canvas`} onMessage={frameMessage} className="h-full w-full border-0" style={{ width: `${canvasWidth}px`, height: `${canvasHeight}px` }} />}
                        </div>
                    </div>
                </div>
            </section>
            <div
                role="separator"
                aria-label="Resize layout inspector"
                aria-orientation="vertical"
                aria-valuemin={minInspectorWidth}
                aria-valuemax={maxInspectorWidth}
                aria-valuenow={inspectorWidth}
                aria-valuetext={`${inspectorWidth} pixels`}
                tabIndex={0}
                title="Drag to resize the layout inspector"
                onPointerDown={startInspectorResize}
                onPointerMove={moveInspectorResize}
                onPointerUp={stopInspectorResize}
                onPointerCancel={stopInspectorResize}
                onKeyDown={(event) => {
                    if (!['ArrowLeft', 'ArrowRight'].includes(event.key)) return
                    event.preventDefault()
                    setInspectorWidth((current) => clampInspectorWidth(current + (event.key === 'ArrowLeft' ? 16 : -16)))
                }}
                className={`group hidden touch-none cursor-col-resize items-center justify-center border-x border-gray-200 focus:outline-none focus:ring-2 focus:ring-inset focus:ring-blue-500 xl:col-start-4 ${inspectorCollapsed ? 'xl:hidden' : 'xl:flex'} ${isResizingInspector ? 'bg-blue-50' : 'bg-gray-50 hover:bg-blue-50'}`}
            >
                <span className={`h-10 w-0.5 rounded-full ${isResizingInspector ? 'bg-blue-500' : 'bg-gray-300 group-hover:bg-blue-500 group-focus:bg-blue-500'}`} />
            </div>
            <aside className={`min-h-0 overflow-y-auto border-l border-gray-200 bg-white xl:col-start-5 xl:border-l-0 ${inspectorCollapsed ? 'overflow-hidden p-1.5' : 'p-4'}`}>
                <div className={`flex items-center ${inspectorCollapsed ? 'justify-center' : 'justify-between gap-2'}`}>
                    {!inspectorCollapsed && <h2 className="truncate text-sm font-semibold text-gray-900">{inspectingLayout ? 'Layout inspector' : nodeDisplayName(selected?.node)}</h2>}
                    <button type="button" onClick={() => setInspectorCollapsed((current) => !current)} className={iconButton} aria-label={inspectorCollapsed ? 'Expand layout inspector' : 'Collapse layout inspector'} aria-expanded={!inspectorCollapsed} title={inspectorCollapsed ? 'Expand layout inspector' : 'Collapse layout inspector'}>{inspectorCollapsed ? <PanelRightOpen className="h-4 w-4" /> : <PanelRightClose className="h-4 w-4" />}</button>
                </div>
                {!inspectorCollapsed && <fieldset disabled={disabled} className="contents">
                {inspectingLayout && <div className="mt-4 space-y-4">
                    <label className="block text-xs font-medium text-gray-700">Layout label<input value={selectedLayout.label} onChange={(event) => updateLayout((layout) => ({ ...layout, label: event.target.value }))} className="mt-1 w-full rounded border border-gray-300 px-2 py-1.5 text-sm" /></label>
                    <label className="block text-xs font-medium text-gray-700">Description<textarea value={selectedLayout.description || ''} onChange={(event) => updateLayout((layout) => ({ ...layout, description: event.target.value }))} rows="2" className="mt-1 w-full rounded border border-gray-300 px-2 py-1.5 text-sm" /></label>
                    <button type="button" onClick={() => commit({ ...clone(layouts), default_layout_key: selectedLayout.key })} disabled={selectedLayout.key === layouts.default_layout_key} className="w-full rounded border border-gray-300 px-3 py-2 text-sm disabled:opacity-40">Set as default</button>
                    <p className="text-xs text-gray-500">{usage.pageCount || 0} pages · {usage.versionCount || 0} versions · {usage.schemaCount || 0} schemas</p>
                    {Boolean(usage.pageIds?.length) && <div className="flex flex-wrap gap-1">{usage.pageIds.slice(0, 5).map((pageId) => <a key={pageId} href={`/pages/${pageId}/edit/content`} className="rounded bg-gray-100 px-2 py-1 text-xs text-blue-700 hover:bg-blue-50">Page {pageId}</a>)}{usage.pageIds.length > 5 && <span className="px-1 py-1 text-xs text-gray-500">+{usage.pageIds.length - 5} more</span>}</div>}
                </div>}
                {!inspectingLayout && selected && <div className="mt-4">
                    <div className="flex items-center justify-between"><span className="rounded bg-gray-100 px-2 py-1 text-[11px] font-medium uppercase tracking-wide text-gray-500">{selected.node.type}</span><span className="text-[11px] font-medium uppercase tracking-wide text-gray-500">Editing {activeBreakpoint.toUpperCase()}</span></div>
                    {externallyEditableNodeTypes.has(selected.node.type) && <div className="mt-3 space-y-3">
                        <label className="block text-xs font-medium text-gray-700">Element name<input value={selected.node.label || ''} maxLength="100" onChange={(event) => updateNode((node) => ({ ...node, label: event.target.value }))} placeholder="Descriptive name in the Designer" className="mt-1 w-full rounded border border-gray-300 px-2 py-1.5 text-sm" /></label>
                        <div>
                            <span className="block text-xs font-medium text-gray-700">Presentation color</span>
                            <div className="mt-1 flex items-center gap-2">
                                <input type="color" aria-label="Presentation color" value={selected.node.presentation_color || defaultPresentationColors[selected.node.type]} onChange={(event) => updateNode((node) => ({ ...node, presentation_color: event.target.value }))} className="h-9 w-11 shrink-0 cursor-pointer rounded border border-gray-300 bg-white p-1" />
                                <code className="min-w-0 flex-1 truncate rounded bg-gray-50 px-2 py-2 text-xs text-gray-600">{selected.node.presentation_color || 'Type default'}</code>
                                <button type="button" onClick={() => updateNode((node) => { const next = { ...node }; delete next.presentation_color; return next })} disabled={!selected.node.presentation_color} className="rounded border border-gray-300 px-2 py-1.5 text-xs text-gray-700 hover:bg-gray-50 disabled:opacity-40">Use default</button>
                            </div>
                            <p className="mt-1 text-[11px] leading-4 text-gray-500">Only changes this block’s tint in the Layout Editor canvas.</p>
                        </div>
                    </div>}
                    {selected.node.type === 'semantic' && <label className="mt-3 block text-xs font-medium text-gray-700">Semantic element<select value={selected.node.tag || 'div'} onChange={(event) => updateNode((node) => ({ ...node, tag: event.target.value }))} className="mt-1 w-full rounded border border-gray-300 px-2 py-1.5 text-sm">{['div', 'header', 'nav', 'main', 'aside', 'section', 'footer'].map((tag) => <option key={tag}>{tag}</option>)}</select></label>}
                    {selected.node.type === 'slot' && <div className="mt-3 space-y-3">
                        <p className="rounded bg-gray-50 px-2 py-1.5 font-mono text-[11px] text-gray-600">Key: {selected.node.slot_key}</p>
                        <label className="block text-xs font-medium text-gray-700">Slot label<input value={selectedLayout.slots[selected.node.slot_key]?.label || ''} onChange={(event) => updateSlot((slot) => ({ ...slot, label: event.target.value }))} className="mt-1 w-full rounded border border-gray-300 px-2 py-1.5 text-sm" /></label>
                        <label className="block text-xs font-medium text-gray-700">Description<textarea value={selectedLayout.slots[selected.node.slot_key]?.description || ''} onChange={(event) => updateSlot((slot) => ({ ...slot, description: event.target.value }))} rows="2" className="mt-1 w-full rounded border border-gray-300 px-2 py-1.5 text-sm" /></label>
                        <label className="block text-xs font-medium text-gray-700">Maximum widgets<input type="number" min="1" value={selectedLayout.slots[selected.node.slot_key]?.max_widgets ?? ''} placeholder="Unlimited" onChange={(event) => updateSlot((slot) => ({ ...slot, max_widgets: event.target.value ? Number(event.target.value) : null }))} className="mt-1 w-full rounded border border-gray-300 px-2 py-1.5 text-sm" /></label>
                        <label className="block text-xs font-medium text-gray-700">Collapse behavior<select value={selectedLayout.slots[selected.node.slot_key]?.collapse_behavior || 'never'} onChange={(event) => updateSlot((slot) => ({ ...slot, collapse_behavior: event.target.value }))} className="mt-1 w-full rounded border border-gray-300 bg-white px-2 py-1.5 text-sm"><option value="never">Never</option><option value="any">When any inherited content exists</option><option value="all">When all inherited content exists</option></select></label>
                        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                            <label className="flex min-h-8 items-center gap-2 text-sm text-gray-700"><input type="checkbox" checked={Boolean(selectedLayout.slots[selected.node.slot_key]?.required)} onChange={(event) => updateSlot((slot) => ({ ...slot, required: event.target.checked }))} />Required</label>
                            <label className="flex min-h-8 items-center gap-2 text-sm text-gray-700"><input type="checkbox" checked={Boolean(selectedLayout.slots[selected.node.slot_key]?.allows_inheritance)} onChange={(event) => updateSlot((slot) => ({ ...slot, allows_inheritance: event.target.checked }))} />Allow inheritance</label>
                            <label className="flex min-h-8 items-center gap-2 text-sm text-gray-700"><input type="checkbox" checked={Boolean(selectedLayout.slots[selected.node.slot_key]?.allow_merge)} onChange={(event) => updateSlot((slot) => ({ ...slot, allow_merge: event.target.checked }))} />Merge inherited content</label>
                        </div>
                        <label className="block text-xs font-medium text-gray-700">Allowed widget types<textarea value={(selectedLayout.slots[selected.node.slot_key]?.allowed_widget_types || []).join('\n')} disabled={Boolean(selectedLayout.slots[selected.node.slot_key]?.disallowed_widget_types?.length)} onChange={(event) => updateSlot((slot) => { const next = { ...slot, allowed_widget_types: splitList(event.target.value) }; if (!next.allowed_widget_types.length) delete next.allowed_widget_types; return next })} placeholder="One component type per line" rows="3" className="mt-1 w-full rounded border border-gray-300 px-2 py-1.5 font-mono text-xs disabled:bg-gray-100" /></label>
                        <label className="block text-xs font-medium text-gray-700">Disallowed widget types<textarea value={(selectedLayout.slots[selected.node.slot_key]?.disallowed_widget_types || []).join('\n')} disabled={Boolean(selectedLayout.slots[selected.node.slot_key]?.allowed_widget_types?.length)} onChange={(event) => updateSlot((slot) => { const next = { ...slot, disallowed_widget_types: splitList(event.target.value) }; if (!next.disallowed_widget_types.length) delete next.disallowed_widget_types; return next })} placeholder="One component type per line" rows="3" className="mt-1 w-full rounded border border-gray-300 px-2 py-1.5 font-mono text-xs disabled:bg-gray-100" /></label>
                        <label className="block text-xs font-medium text-gray-700">Inheritable widget types<textarea value={(selectedLayout.slots[selected.node.slot_key]?.inheritable_types || []).join('\n')} onChange={(event) => updateSlot((slot) => ({ ...slot, inheritable_types: splitList(event.target.value) }))} placeholder="One component type per line" rows="3" className="mt-1 w-full rounded border border-gray-300 px-2 py-1.5 font-mono text-xs" /></label>
                        <fieldset className="space-y-2 rounded border border-gray-200 p-2"><legend className="px-1 text-xs font-medium text-gray-700">Responsive dimensions</legend>{['mobile', 'tablet', 'desktop'].map((size) => <div key={size} className="grid grid-cols-[1fr_72px_72px] items-center gap-2 text-xs"><span className="capitalize text-gray-600">{size}</span>{['width', 'height'].map((dimension) => <input key={dimension} aria-label={`${size} ${dimension}`} type="number" min="1" placeholder={dimension} value={selectedLayout.slots[selected.node.slot_key]?.dimensions?.[size]?.[dimension] ?? ''} onChange={(event) => updateSlot((slot) => { const dimensions = clone(slot.dimensions || {}); dimensions[size] = { ...(dimensions[size] || {}) }; if (event.target.value) dimensions[size][dimension] = Number(event.target.value); else delete dimensions[size][dimension]; return { ...slot, dimensions } })} className="min-w-0 rounded border border-gray-300 px-2 py-1.5 text-xs" />)}</div>)}</fieldset>
                        <details className="rounded border border-gray-200 bg-gray-50 p-2"><summary className="cursor-pointer text-xs font-medium text-gray-700">Default widgets (read-only)</summary><pre className="mt-2 overflow-x-auto whitespace-pre-wrap text-[11px] text-gray-600">{JSON.stringify(selectedLayout.slots[selected.node.slot_key]?.default_widgets || [], null, 2)}</pre></details>
                        <p className="text-xs text-gray-500">{usage.slots?.[selected.node.slot_key] || 0} versions contain widgets in this slot.</p>
                    </div>}
                    <div className="mt-4 space-y-4">
                        {styleFieldGroups.map((group, groupIndex) => <section key={group.label} className="space-y-2">
                            <div>
                                <h4 className="text-xs font-semibold uppercase tracking-wide text-gray-500">{group.label}</h4>
                                {groupIndex === 0 && externallyEditableNodeTypes.has(selected.node.type) && <p className="mt-1 text-[11px] leading-4 text-gray-500">Use the checkbox to expose a property in the Theme Designer.</p>}
                            </div>
                            {group.fields.map((field) => {
                            const fieldLabel = field.replaceAll('_', ' ')
                            const currentStyles = selected.node.styles?.[activeStyleBreakpoint] || {}
                            const hasOverride = Object.hasOwn(currentStyles, field)
                            const inherited = hasOverride ? null : inheritedLayoutStyle(selected.node, field, activeBreakpoint, workspace.breakpoints)
                            const displayedValue = hasOverride ? currentStyles[field] : inherited?.value || ''
                            const inheritedLabel = inherited?.breakpoint === 'base' ? 'Base' : themeBreakpointDefinition(inherited?.breakpoint)?.label || inherited?.breakpoint?.toUpperCase()
                            const canReset = activeStyleBreakpoint !== 'base' && hasOverride
                            const hasTrailingControl = Boolean(inherited || canReset || externallyEditableNodeTypes.has(selected.node.type))
                            return <div key={field} className="grid grid-cols-[1fr_1.2fr] items-start gap-2 text-xs text-gray-600">
                                <label htmlFor={`layout-style-${selected.node.id}-${activeStyleBreakpoint}-${field}`} className="pt-1.5 capitalize">{fieldLabel}</label>
                                <div className="min-w-0">
                                    <div className="flex min-w-0">
                                    {['background_color', 'color'].includes(field) && <input type="color" aria-label={`Pick ${fieldLabel}`} value={colorPickerValue(displayedValue, field === 'color' ? '#111827' : '#ffffff')} disabled={Boolean(inherited)} onChange={(event) => setStyleOverride(field, event.target.value)} className="h-[30px] w-9 shrink-0 cursor-pointer rounded-l border border-r-0 border-gray-300 bg-white p-1 disabled:cursor-not-allowed disabled:bg-gray-100" />}
                                    <input id={`layout-style-${selected.node.id}-${activeStyleBreakpoint}-${field}`} aria-label={`${fieldLabel} value`} value={displayedValue} disabled={Boolean(inherited)} onChange={(event) => event.target.value ? setStyleOverride(field, event.target.value) : resetStyleOverride(field)} className={`min-w-0 flex-1 border border-gray-300 px-2 py-1.5 text-xs disabled:cursor-not-allowed disabled:bg-gray-50 disabled:text-gray-500 ${['background_color', 'color'].includes(field) ? hasTrailingControl ? '' : 'rounded-r' : hasTrailingControl ? 'rounded-l' : 'rounded'}`} />
                                    {inherited && <button type="button" onClick={() => setStyleOverride(field, inherited.value)} aria-label={`Override ${fieldLabel} at ${activeBreakpoint === 'xs' ? 'Base' : themeBreakpointDefinition(activeBreakpoint)?.label || activeBreakpoint.toUpperCase()}`} title={`Create ${activeBreakpoint.toUpperCase()} override`} className="inline-flex h-[30px] w-8 shrink-0 items-center justify-center border-y border-r border-gray-300 bg-white text-gray-600 hover:bg-gray-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"><KeyRound className="h-3.5 w-3.5" /></button>}
                                    {canReset && <button type="button" onClick={() => resetStyleOverride(field)} aria-label={`Reset ${fieldLabel} override`} title="Reset override" className="inline-flex h-[30px] w-8 shrink-0 items-center justify-center border-y border-r border-gray-300 bg-white text-gray-600 hover:bg-gray-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"><RotateCcw className="h-3.5 w-3.5" /></button>}
                                    {externallyEditableNodeTypes.has(selected.node.type) && <label title={`Expose ${fieldLabel} in the Theme Designer`} className="inline-flex w-9 shrink-0 cursor-pointer items-center justify-center rounded-r border border-l-0 border-gray-300 bg-gray-50 hover:bg-gray-100">
                                        <input type="checkbox" aria-label={`Expose ${fieldLabel} in Theme Designer`} checked={(selected.node.editable_parameters || []).includes(field)} onChange={(event) => updateNode((node) => { const parameters = new Set(node.editable_parameters || []); if (event.target.checked) parameters.add(field); else parameters.delete(field); return { ...node, editable_parameters: [...parameters] } })} />
                                    </label>}
                                    </div>
                                    {inherited && <p className="mt-1 text-[10px] text-gray-500">Inherited from {inheritedLabel}</p>}
                                </div>
                            </div>
                            })}
                        </section>)}
                    </div>
                </div>}
                </fieldset>}
            </aside>
        </div>}
    </main>
}

export default LayoutDesignerWorkspace
