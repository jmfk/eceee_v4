import React from 'react'

import type { LayoutRenderProps, ThemeLayoutDefinition, ThemeLayoutNode } from './types'

const allowedTypes = new Set(['container', 'section', 'grid', 'row', 'column', 'semantic', 'slot'])
const semanticTags = new Set(['div', 'header', 'nav', 'main', 'aside', 'section', 'footer'])
const propertyMap: Record<string, string> = {
    display: 'display', width: 'width', max_width: 'max-width', min_height: 'min-height',
    grid_template_columns: 'grid-template-columns', grid_column: 'grid-column',
    flex_direction: 'flex-direction', flex_wrap: 'flex-wrap', flex_grow: 'flex-grow', order: 'order',
    gap: 'gap', padding: 'padding', margin: 'margin', align_items: 'align-items',
    justify_content: 'justify-content', background_color: 'background-color', color: 'color',
    border: 'border', border_radius: 'border-radius',
}
const allowedBreakpoints = new Set(['base', 'xs', 'sm', 'md', 'lg', 'xl'])
const keyPattern = /^[a-z][a-z0-9_]{0,63}$/
const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
const defaultBreakpoints: Record<string, number> = { xs: 0, sm: 640, md: 768, lg: 1024, xl: 1280 }
const safeValue = (value: string | number) => {
    const text = String(value).trim()
    if (!text || text.length > 160 || /[;{}<>]|url\s*\(|expression\s*\(|@import/i.test(text)) return null
    if (text.startsWith('token:')) return `var(--color-${text.slice(6).replace(/[^a-zA-Z0-9_-]/g, '')})`
    return text
}

const camelToSnake = (value: string) => value.replace(/([a-z0-9])([A-Z])/g, '$1_$2').toLowerCase()

export const normalizeLayoutDefinition = (layout: any): ThemeLayoutDefinition | null => {
    if (!layout || typeof layout !== 'object') return null
    const normalizeNode = (node: any): ThemeLayoutNode => ({
        id: String(node?.id || ''),
        type: node?.type,
        label: String(node?.label || ''),
        children: Array.isArray(node?.children) ? node.children.map(normalizeNode) : [],
        styles: Object.fromEntries(Object.entries(node?.styles || {}).map(([breakpoint, values]) => [
            breakpoint,
            Object.fromEntries(Object.entries((values && typeof values === 'object') ? values : {}).map(([key, value]) => [camelToSnake(key), value])),
        ])),
        class_names: node?.class_names || node?.classNames || [],
        tag: node?.tag,
        slot_key: node?.slot_key || node?.slotKey,
        editable_parameters: node?.editable_parameters || node?.editableParameters || [],
    })
    const slots = Object.fromEntries(Object.entries(layout.slots || {}).map(([key, value]: [string, any]) => [key, {
        ...value,
        max_widgets: value?.max_widgets ?? value?.maxWidgets,
        allowed_widget_types: value?.allowed_widget_types || value?.allowedWidgetTypes,
        disallowed_widget_types: value?.disallowed_widget_types || value?.disallowedWidgetTypes,
        allows_inheritance: value?.allows_inheritance ?? value?.allowsInheritance,
        allow_merge: value?.allow_merge ?? value?.allowMerge,
        inheritable_types: value?.inheritable_types || value?.inheritableTypes,
        collapse_behavior: value?.collapse_behavior || value?.collapseBehavior,
        default_widgets: value?.default_widgets || value?.defaultWidgets,
    }]))
    return {
        id: String(layout.id || ''), key: String(layout.key || ''), label: String(layout.label || layout.key || ''),
        description: String(layout.description || ''), status: layout.status || 'active', root: normalizeNode(layout.root), slots,
    }
}

export const validateLayoutDefinition = (layout: unknown): layout is ThemeLayoutDefinition => {
    if (!layout || typeof layout !== 'object') return false
    const value = layout as ThemeLayoutDefinition
    if (!uuidPattern.test(value.id) || !keyPattern.test(value.key) || !value.root || !value.slots || !Array.isArray(value.root.children)) return false
    if (value.status && !['active', 'archived'].includes(value.status)) return false
    if (Object.entries(value.slots).some(([key, slot]) => {
        if (!keyPattern.test(key) || !slot || typeof slot !== 'object') return true
        const policy = slot as Record<string, unknown>
        const maximum = policy.max_widgets
        const listFields = ['allowed_widget_types', 'disallowed_widget_types', 'inheritable_types']
        return (maximum !== null && maximum !== undefined && (!Number.isInteger(maximum) || Number(maximum) < 1))
            || (policy.collapse_behavior !== undefined && !['never', 'any', 'all'].includes(String(policy.collapse_behavior)))
            || listFields.some((field) => policy[field] !== undefined && (!Array.isArray(policy[field]) || (policy[field] as unknown[]).some((item) => typeof item !== 'string')))
            || (policy.allowed_widget_types !== undefined && policy.disallowed_widget_types !== undefined)
    })) return false
    const ids = new Set<string>()
    const slots: string[] = []
    let count = 0
    const visit = (node: ThemeLayoutNode, depth: number): boolean => {
        if (!node || depth > 12 || ++count > 250 || !uuidPattern.test(node.id) || ids.has(node.id) || !allowedTypes.has(node.type)) return false
        ids.add(node.id)
        if (!Array.isArray(node.children)) return false
        if (node.type === 'semantic' && !semanticTags.has(node.tag || 'div')) return false
        if (node.label !== undefined && (typeof node.label !== 'string' || node.label.length > 100)) return false
        if (node.editable_parameters !== undefined && (
            !Array.isArray(node.editable_parameters)
            || node.editable_parameters.some((property) => !propertyMap[property])
            || (node.editable_parameters.length > 0 && !['container', 'semantic', 'slot'].includes(node.type))
        )) return false
        if (Object.entries(node.styles || {}).some(([breakpoint, values]) => (
            !allowedBreakpoints.has(breakpoint)
            || !values || typeof values !== 'object'
            || Object.entries(values).some(([property, styleValue]) => !propertyMap[property] || safeValue(styleValue) === null)
        ))) return false
        if (node.type === 'slot') {
            if (node.children.length || !node.slot_key || !value.slots[node.slot_key]) return false
            slots.push(node.slot_key)
        }
        const containsSlot = (candidate: ThemeLayoutNode): boolean => candidate.type === 'slot' || candidate.children.some(containsSlot)
        if (containsSlot(node) && Object.values(node.styles || {}).some((styles) => styles?.display === 'none')) return false
        return node.children.every((child) => visit(child, depth + 1))
    }
    return visit(value.root, 1) && slots.length === new Set(slots).size
        && slots.length === Object.keys(value.slots).length
        && slots.every((slot) => Object.hasOwn(value.slots, slot))
}

export const layoutDefinitionCss = (layout: ThemeLayoutDefinition, breakpoints: Record<string, number> = defaultBreakpoints) => {
    const rules: Record<string, string[]> = {}
    const visit = (node: ThemeLayoutNode) => {
        Object.entries(node.styles || {}).forEach(([breakpoint, values]) => {
            const declarations = Object.entries(values || {}).flatMap(([property, value]) => {
                const cssProperty = propertyMap[property]
                const cssValue = cssProperty && safeValue(value)
                return cssValue ? [`${cssProperty}:${cssValue}`] : []
            })
            if (declarations.length) (rules[breakpoint] ||= []).push(`[data-layout-node-id="${node.id}"]{${declarations.join(';')}}`)
        })
        node.children.forEach(visit)
    }
    visit(layout.root)
    const base = [...(rules.base || []), ...(rules.xs || [])].join('')
    const responsive = ['sm', 'md', 'lg', 'xl'].map((breakpoint) => {
        const body = (rules[breakpoint] || []).join('')
        return body ? `@media(min-width:${Number(breakpoints[breakpoint] ?? defaultBreakpoints[breakpoint])}px){${body}}` : ''
    }).join('')
    return `${base}${responsive}`
}

export const layoutCanvasDimensionsCss = (layout: ThemeLayoutDefinition, breakpoints: Record<string, number> = defaultBreakpoints) => {
    const rules: Record<'mobile' | 'tablet' | 'desktop', string[]> = { mobile: [], tablet: [], desktop: [] }
    const visit = (node: ThemeLayoutNode) => {
        if (node.type === 'slot' && node.slot_key) {
            const dimensions = layout.slots[node.slot_key]?.dimensions || {}
            ;(['mobile', 'tablet', 'desktop'] as const).forEach((size) => {
                const width = Number(dimensions[size]?.width)
                const height = Number(dimensions[size]?.height)
                if (!Number.isFinite(width) || width <= 0 || !Number.isFinite(height) || height <= 0) return
                const relativeHeight = `calc(100vw * ${height} / ${width})`
                rules[size].push(`.layout-designer-preview [data-layout-node-id="${node.id}"]{height:${relativeHeight}!important;min-height:${relativeHeight}!important}`)
            })
        }
        node.children.forEach(visit)
    }
    visit(layout.root)
    const tablet = rules.tablet.join('')
    const desktop = rules.desktop.join('')
    return [
        rules.mobile.join(''),
        tablet ? `@media(min-width:${Number(breakpoints.md ?? defaultBreakpoints.md)}px){${tablet}}` : '',
        desktop ? `@media(min-width:${Number(breakpoints.xl ?? defaultBreakpoints.xl)}px){${desktop}}` : '',
    ].join('')
}

const LayoutNode = ({ node, slots, renderSlot, designer }: { node: ThemeLayoutNode, slots: ThemeLayoutDefinition['slots'], renderSlot: LayoutRenderProps['renderSlot'], designer: boolean }) => {
    const className = (node.class_names || []).join(' ') || undefined
    const label = node.label || (node.type === 'slot' ? String(slots[node.slot_key || '']?.label || node.slot_key || 'Slot') : node.type)
    const target = JSON.stringify([{ id: `layout-node:${node.id}`, layoutNodeId: node.id, kind: node.type === 'slot' ? 'slot' : 'element', label, editableParameters: node.editable_parameters || [] }])
    if (node.type === 'slot') return <div className={className || `layout-slot slot-${node.slot_key}`} data-layout-node-id={node.id} data-layout-node-type={node.type} data-layout-node-label={label} data-slot-name={node.slot_key} data-designer-target={designer ? 'true' : undefined} data-designer-targets={designer ? target : undefined}>
        {renderSlot(node.slot_key || '')}
    </div>
    const tag = node.type === 'semantic' ? (node.tag || 'div') : 'div'
    return React.createElement(tag, { className, 'data-layout-node-id': node.id, 'data-layout-node-type': node.type, 'data-layout-node-label': label, 'data-designer-target': designer ? 'true' : undefined, 'data-designer-targets': designer ? target : undefined },
        node.children.map((child) => <LayoutNode key={child.id} node={child} slots={slots} renderSlot={renderSlot} designer={designer} />))
}

export const ThemeLayoutRender = ({ model, renderSlot }: LayoutRenderProps) => {
    const layout = model.layoutDefinition
    if (!layout || !validateLayoutDefinition(layout)) return null
    return <>
        <style data-theme-layout-css={layout.key}>{layoutDefinitionCss(layout, model.layoutBreakpoints)}</style>
        {model.designer?.layoutCanvas && <style data-theme-layout-canvas-dimensions={layout.key}>{layoutCanvasDimensionsCss(layout, model.layoutBreakpoints)}</style>}
        <LayoutNode node={layout.root} slots={layout.slots} renderSlot={renderSlot} designer={Boolean(model.designer)} />
    </>
}
