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

const objectWidgetsForPreview = (widgets: Record<string, any[]> = {}, objectType: any = {}) => {
    const configuredSlots = objectType?.slotConfiguration?.slots || objectType?.slot_configuration?.slots || []
    const names = [
        ...configuredSlots.map((slot: any) => typeof slot === 'string' ? slot : slot?.name).filter(Boolean),
        ...Object.keys(widgets),
    ]
    return [...new Set(names)].flatMap((name: string) => Array.isArray(widgets[name]) ? widgets[name] : [])
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
    workspace, viewId, themeCss = '', fontUrl = '', sourceModel = null, guidesEnabled = true, contentEditable = false,
}: any): RenderPageModel => {
    const views = workspace?.previewContent?.views || workspace?.catalog?.previewViews || []
    const view = views.find((candidate: any) => candidate.id === viewId) || views[0] || {}
    const document = view.content && typeof view.content === 'object' ? view.content : null
    const documentWidgets = document?.widgets && typeof document.widgets === 'object' ? document.widgets : null
    const layout = sourceModel?.layout || document?.codeLayout || view.layout || 'main_layout'
    const slots: Record<string, RenderWidgetModel[]> = {}
    const catalogLayout = workspace?.catalog?.layouts?.find((candidate: any) => candidate.key === layout)
    const rawSlots = sourceModel?.slots || documentWidgets || {}
    const isObjectPreview = Boolean(sourceModel?.context?.objectId || view.kind === 'object')
    const previewSlots = isObjectPreview
        ? { main: objectWidgetsForPreview(rawSlots, sourceModel?.context?.objectType || view.objectType) }
        : rawSlots
    const availableSlots = [...new Set([
        ...(catalogLayout?.slots?.map((slot: any) => slot.name) || layoutSlots[layout] || ['main']),
        ...Object.keys(previewSlots),
    ])]
    availableSlots.forEach((slot: string) => {
        const widgets = previewSlots[slot] || []
        slots[slot] = widgets.map((widget: any, index: number) => normalizeWidget(widget, `${slot}-${index}`))
    })
    const primary = availableSlots.find((slot: string) => ['main', 'content', 'body', 'landingPage', 'landing_page'].includes(slot)) || availableSlots[0]
    const objectData = sourceModel?.context?.objectData || document?.data || {}
    const objectType = sourceModel?.context?.objectType || view.objectType || {}

    if (isObjectPreview && Object.keys(objectData).length) {
        slots[primary] ||= []
        slots[primary].unshift({ id: `${view.id || 'live-object'}-data`, type: 'designer.ObjectDataPreview', config: {} })
    }

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

    if (!sourceModel) Object.entries(view.images || {}).forEach(([key, image]: [string, any], index) => {
        const prefix = `preview:${view.id}:image:`
        const requestedSlot = key.startsWith(prefix) ? key.slice(prefix.length) : primary
        const slot = availableSlots.includes(requestedSlot) ? requestedSlot : primary
        slots[slot] ||= []
        slots[slot].push(normalizeWidget({
            id: `${view.id || 'preview'}-image-${index}`,
            type: 'easy_widgets.ImageWidget',
            config: { imageUrl: image?.url || image?.fileUrl, altText: image?.filename || '' },
        }, `${slot}-preview-image-${index}`))
    })

    if (layout === 'landing_page' && !slots.landingPage?.length && slots.landing_page?.length) {
        slots.landingPage = slots.landing_page
    }

    return {
        layout,
        slots,
        context: {
            ...(sourceModel?.context || {}),
            ...(isObjectPreview ? {
                objectId: sourceModel?.context?.objectId || view.id || 'theme-preview-object',
                objectData,
                objectType,
            } : {}),
            preview: true,
            componentStyles: Object.fromEntries((workspace?.catalog?.componentStyles || []).map((style: any) => [style.key, style])),
        },
        themeCss: `${catalogLayout?.layoutCss || ''}\n${themeCss || ''}`,
        fontUrl,
        designer: {
            catalog: workspace?.catalog || {},
            texts: sourceModel ? {} : view.texts || {},
            assets: workspace?.assets || [],
            editableSpacingTargets: (workspace?.spacing || []).reduce((targets: Record<string, string[]>, row: any) => {
                const fields = workspace?.constraints?.editableSpacingProperties || Object.keys(row.values || {})
                targets[row.targetId] = [...new Set([...(targets[row.targetId] || []), ...fields])]
                return targets
            }, {}),
            contentEditable,
            guidesEnabled,
        },
    }
}
