import { getSlotWidgetsForMode } from '../utils/widgetMerging'
import { getRenderFixture } from './fixtures'
import type { RenderPageModel, RenderWidgetModel } from './types'

const normalizeWidget = (widget: any, fallbackId: string): RenderWidgetModel => {
    const config = widget?.config && typeof widget.config === 'object' ? structuredClone(widget.config) : {}
    const normalizeList = (items: unknown, prefix: string) => Array.isArray(items)
        ? items.map((item, index) => normalizeWidget(item, `${prefix}-${index}`))
        : items
    if (config.slots && typeof config.slots === 'object') {
        config.slots = Object.fromEntries(Object.entries(config.slots).map(([name, items]) => [name, normalizeList(items, `${fallbackId}-${name}`)]))
    }
    return {
        id: String(widget?.id ?? fallbackId),
        type: String(widget?.type || widget?.widget_type || ''),
        config,
        data: widget?.data || widget?.resolvedData,
        inheritedFrom: widget?.inheritedFrom || widget?.inherited_from || null,
    }
}

const layoutSlots: Record<string, string[]> = {
    main_layout: ['header', 'navbar', 'hero', 'main', 'sidebar', 'footer'],
    landing_page: ['header', 'navbar', 'hero', 'landingPage', 'footer'],
}

export const createPageRenderModel = ({
    layout = 'main_layout', widgets = {}, inheritedWidgets = {}, slotInheritanceRules = {}, context = {}, themeCss = '', fontUrl = '',
}: any): RenderPageModel => {
    const slots: Record<string, RenderWidgetModel[]> = {}
    const names = [...new Set([...(layoutSlots[layout] || []), ...Object.keys(widgets || {}), ...Object.keys(inheritedWidgets || {})])]
    names.forEach((name) => {
        let merged
        try {
            merged = getSlotWidgetsForMode('preview', widgets?.[name] || [], inheritedWidgets?.[name] || [], slotInheritanceRules?.[name] || {})
        } catch {
            merged = widgets?.[name] || []
        }
        slots[name] = (Array.isArray(merged) ? merged : []).map((item, index) => normalizeWidget(item, `${name}-${index}`))
    })
    if (layout === 'landing_page' && !slots.landingPage?.length && slots.landing_page?.length) {
        slots.landingPage = slots.landing_page
    }
    return { layout, slots, context: { ...context, preview: true }, themeCss, fontUrl }
}

export const createDesignerRenderModel = ({
    workspace, viewId, themeCss = '', fontUrl = '', sourceModel = null, guidesEnabled = true,
}: any): RenderPageModel => {
    const views = workspace?.previewContent?.views || workspace?.catalog?.previewViews || []
    const view = views.find((candidate: any) => candidate.id === viewId) || views[0] || {}
    const document = view.content && typeof view.content === 'object' ? view.content : null
    const documentWidgets = document?.widgets && typeof document.widgets === 'object' ? document.widgets : null
    const layout = sourceModel?.layout || document?.codeLayout || view.layout || 'main_layout'
    const slots: Record<string, RenderWidgetModel[]> = {}
    const catalogLayout = workspace?.catalog?.layouts?.find((candidate: any) => candidate.key === layout)
    const availableSlots = [...new Set([
        ...(catalogLayout?.slots?.map((slot: any) => slot.name) || layoutSlots[layout] || ['main']),
        ...Object.keys(sourceModel?.slots || documentWidgets || {}),
    ])]
    availableSlots.forEach((slot: string) => {
        const widgets = sourceModel?.slots?.[slot] || documentWidgets?.[slot] || []
        slots[slot] = widgets.map((widget: any, index: number) => normalizeWidget(widget, `${slot}-${index}`))
    })
    const primary = availableSlots.find((slot: string) => ['main', 'content', 'body', 'landingPage', 'landing_page'].includes(slot)) || availableSlots[0]

    const demoText = (element: string) => {
        if (/^h[1-6]$/.test(element)) return 'A heading with realistic length'
        if (element === 'a' || element === 'a:hover') return 'Read more'
        if (element === 'li') return 'Representative list item'
        return 'Longer representative content shows typography, line length, rhythm and spacing.'
    }
    const demoMarkup = (group: any) => (group.elements || []).map((element: any) => {
        const tag = element.element === 'a:hover' ? 'a' : element.element
        const safeTag = /^(h[1-6]|p|a|blockquote|strong|em|code|pre|ul|ol|li)$/.test(tag) ? tag : 'p'
        if (safeTag === 'ul' || safeTag === 'ol') return `<${safeTag}><li>First example item</li><li>Second example item</li></${safeTag}>`
        return `<${safeTag}${safeTag === 'a' ? ' href="#"' : ''}>${demoText(safeTag)}</${safeTag}>`
    }).join('')

    if (!sourceModel && !documentWidgets) (workspace?.catalog?.designGroups || []).forEach((group: any, groupIndex: number) => {
        const type = group.widgetTypes?.[0]
        const fixture = type ? getRenderFixture(type, `designer-${groupIndex}`) : null
        if (!fixture) return
        const markup = demoMarkup(group)
        if (markup && type === 'easy_widgets.ContentWidget') fixture.config.content = markup
        if (markup && type === 'easy_widgets.ContentCardWidget') fixture.config.content = markup
        if (markup && type === 'easy_widgets.SectionWidget') fixture.config.title = demoText('h2')
        const slot = (group.slots || []).find((candidate: string) => availableSlots.includes(candidate)) || primary
        slots[slot] ||= []
        slots[slot].push(fixture)
    })

    if (layout === 'landing_page' && !slots.landingPage?.length && slots.landing_page?.length) {
        slots.landingPage = slots.landing_page
    }

    return {
        layout,
        slots,
        context: {
            ...(sourceModel?.context || {}),
            preview: true,
            componentStyles: Object.fromEntries((workspace?.catalog?.componentStyles || []).map((style: any) => [style.key, style])),
        },
        themeCss: `${catalogLayout?.layoutCss || ''}\n${themeCss || ''}`,
        fontUrl,
        designer: {
            catalog: workspace?.catalog || {},
            texts: sourceModel ? {} : view.texts || {},
            assets: workspace?.assets || [],
            contentEditable: !sourceModel && !documentWidgets,
            guidesEnabled,
        },
    }
}
