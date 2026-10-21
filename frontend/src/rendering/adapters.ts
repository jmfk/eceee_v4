import { getSlotWidgetsForMode } from '../utils/widgetMerging'
import { getRenderFixture } from './fixtures'
import type { DesignerPreviewImageReference, RenderPageModel, RenderWidgetModel, ThemeLayoutDefinition, ThemeLayoutNode } from './types'

const previewImagePattern = /(?:https?:\/\/[^\s"'()<>]+|s3:\/\/[^\s"'()<>]+|\/(?:theme_images|uploads|media|files|site-package)\/[^\s"'()<>]+)\.(?:avif|gif|jpe?g|png|svg|webp)(?:\?[^\s"'()<>]*)?/gi

const imageReferenceKey = /(?:background|file|image|media|poster|src|thumbnail|url)/i
const nonImageReferenceKey = /(?:caption|description|href|label|link|summary|text|title)/i

const spacingDirections: Record<string, string[]> = {
    margin: ['marginTop', 'marginRight', 'marginBottom', 'marginLeft'],
    padding: ['paddingTop', 'paddingRight', 'paddingBottom', 'paddingLeft'],
}

const configuredSpacingFields = (values: Record<string, any> = {}) => [...new Set(
    Object.entries(values)
        .filter(([, value]) => value !== '' && value !== null && value !== undefined)
        .flatMap(([field]) => [field, ...(spacingDirections[field] || [])]),
)]

const normalizedBreakpoint = (breakpoint: unknown) => ({
    default: 'xs', mobile: 'xs', desktop: 'sm', tablet: 'md',
}[String(breakpoint || 'xs')] || String(breakpoint || 'xs'))

const defaultBreakpoints: Record<string, number> = { xs: 0, sm: 640, md: 768, lg: 1024, xl: 1280 }

const breakpointWidth = (breakpoint: unknown, breakpoints: Record<string, number>) => {
    const normalized = normalizedBreakpoint(breakpoint)
    return /^\d+$/.test(normalized) ? Number(normalized) : Number(breakpoints?.[normalized] ?? defaultBreakpoints[normalized])
}

const resolvedSpacingRows = (rows: any[]) => {
    const rawBreakpoints = new Map<string, Record<string, any>>()
    rows.forEach((row) => {
        const breakpoint = String(row.breakpoint || 'xs')
        const sparseValues = Object.fromEntries(Object.entries(row.values || {}).filter(([, value]) => (
            value !== '' && value !== null && value !== undefined
        )))
        rawBreakpoints.set(breakpoint, { ...(rawBreakpoints.get(breakpoint) || {}), ...sparseValues })
    })
    const merge = (...breakpoints: string[]) => Object.assign({}, ...breakpoints.map((breakpoint) => rawBreakpoints.get(breakpoint) || {}))
    const resolved = [
        { breakpoint: 'xs', values: merge('default', 'mobile', 'xs') },
        { breakpoint: 'sm', values: merge('desktop', 'sm') },
        { breakpoint: 'md', values: rawBreakpoints.has('md') ? merge('md') : merge('tablet') },
        { breakpoint: 'lg', values: merge('lg') },
        { breakpoint: 'xl', values: merge('xl') },
    ]
    rawBreakpoints.forEach((values, breakpoint) => {
        if (/^\d+$/.test(breakpoint)) resolved.push({ breakpoint, values })
    })
    return resolved.filter((row) => Object.keys(row.values).length)
}

const activeSpacingProperties = (
    rows: any[],
    breakpoints: Record<string, number>,
    viewportWidth: number | undefined,
) => {
    const resolvedRows = resolvedSpacingRows(rows)
    if (!Number.isFinite(viewportWidth)) return [...new Set(resolvedRows.flatMap((row) => configuredSpacingFields(row.values)))]
    const applicable = resolvedRows.filter((row) => {
        const width = breakpointWidth(row.breakpoint, breakpoints)
        return Number.isFinite(width) && width <= Number(viewportWidth)
    })
    const properties = new Set(applicable.flatMap((row) => configuredSpacingFields(row.values)))
    return [...properties].filter((property) => applicable.some((row) => (
        configuredSpacingFields(row.values).includes(property)
        && breakpointWidth(row.breakpoint, breakpoints) === Math.max(...applicable
            .filter((candidate) => configuredSpacingFields(candidate.values).includes(property))
            .map((candidate) => breakpointWidth(candidate.breakpoint, breakpoints)))
    )))
}

const renderedWidgetTypes = (slots: Record<string, RenderWidgetModel[]>) => {
    const types = new Set<string>()
    const visit = (widget: RenderWidgetModel) => {
        if (widget.type) types.add(widget.type)
        Object.values(widget.config?.slots || {}).forEach((children: any) => {
            if (Array.isArray(children)) children.forEach(visit)
        })
    }
    Object.values(slots).forEach((widgets) => widgets.forEach(visit))
    return types
}

const isRenderedImageReference = (value: string, key: string, matchIndex: number) => {
    const before = value.slice(Math.max(0, matchIndex - 500), matchIndex)
    const openImageTag = before.toLowerCase().lastIndexOf('<img')
    const closedTag = before.lastIndexOf('>')
    if (openImageTag > closedTag) return true
    return imageReferenceKey.test(key) && !nonImageReferenceKey.test(key)
}

const collectDesignerPreviewImageReferences = (view: any) => {
    const references: DesignerPreviewImageReference[] = []
    const referencesByObject = new WeakMap<object, DesignerPreviewImageReference[]>()
    const occurrences = new Map<string, number>()
    const visit = (value: any, owner: object | null = null, path: Array<string | number> = [], key = '') => {
        if (typeof value === 'string') {
            const matchesByUrl = new Map<string, number>()
            for (const match of value.matchAll(previewImagePattern)) {
                const sourceUrl = match[0]
                const sourceMatchIndex = matchesByUrl.get(sourceUrl) || 0
                matchesByUrl.set(sourceUrl, sourceMatchIndex + 1)
                if (!isRenderedImageReference(value, key, match.index || 0)) continue
                const sourceOccurrence = occurrences.get(sourceUrl) || 0
                const reference = { sourceUrl, sourceOccurrence, sourcePath: path, sourceMatchIndex }
                references.push(reference)
                if (owner) referencesByObject.set(owner, [...(referencesByObject.get(owner) || []), reference])
                occurrences.set(sourceUrl, sourceOccurrence + 1)
            }
        } else if (Array.isArray(value)) value.forEach((child, index) => visit(child, owner, [...path, index], key))
        else if (value && typeof value === 'object') {
            const nextOwner = value.type || value.widget_type ? value : owner
            Object.entries(value).forEach(([key, child]) => {
                const childOwner = !nextOwner && key === 'data' && child && typeof child === 'object' ? child : nextOwner
                visit(child, childOwner, [...path, key], key)
            })
        }
    }
    visit(view?.content, null, ['content'])
    if (view?.images && typeof view.images === 'object') Object.entries(view.images).forEach(([imageKey, image]) => {
        visit(image, image && typeof image === 'object' ? image : null, ['images', imageKey])
    })
    return { references, referencesByObject }
}

export const designerPreviewImageReferences = (view: any) => collectDesignerPreviewImageReferences(view).references

export const normalizeWidget = (widget: any, fallbackId: string, referencesByObject?: WeakMap<object, DesignerPreviewImageReference[]>): RenderWidgetModel => {
    const config = widget?.config && typeof widget.config === 'object' ? structuredClone(widget.config) : {}
    const normalizeList = (items: unknown, prefix: string) => Array.isArray(items)
        ? items.map((item, index) => normalizeWidget(item, `${prefix}-${index}`, referencesByObject))
        : items
    if (config.slots && typeof config.slots === 'object') {
        config.slots = Object.fromEntries(Object.entries(config.slots).map(([name, items]) => [name, normalizeList(items, `${fallbackId}-${name}`)]))
    }
    if (widget?.type === 'easy_widgets.SectionWidget' && Array.isArray(config.widgets)) {
        config.widgets = normalizeList(config.widgets, `${fallbackId}-widgets`)
    }
    return {
        id: String(widget?.id ?? fallbackId),
        type: String(widget?.type || widget?.widget_type || ''),
        typeVersion: widget?.typeVersion ?? widget?.type_version,
        config,
        data: widget?.data || widget?.resolvedData,
        inheritedFrom: widget?.inheritedFrom || widget?.inherited_from || null,
        previewImageReferences: widget?.previewImageReferences || referencesByObject?.get(widget) || [],
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
    layout = 'main_layout', layoutDefinition = null, layoutDefinitionRequired = false, layoutBreakpoints = undefined, widgets = {}, inheritedWidgets = {}, slotInheritanceRules = {}, context = {}, themeCss = '', fontUrl = '',
}: any): RenderPageModel => {
    const slots: Record<string, RenderWidgetModel[]> = {}
    const names = [...new Set([...(layoutDefinition ? Object.keys(layoutDefinition.slots || {}) : layoutSlots[layout] || []), ...Object.keys(widgets || {}), ...Object.keys(inheritedWidgets || {})])]
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
    return { layout, layoutDefinition, layoutDefinitionRequired, layoutBreakpoints, slots, context: { ...context, preview: true }, themeCss, fontUrl }
}

const layoutSlotNodes = (root?: ThemeLayoutNode) => {
    const labels: Record<string, string> = {}
    const order: string[] = []
    const visit = (node: ThemeLayoutNode) => {
        if (node.type === 'slot' && node.slot_key) {
            labels[node.slot_key] = node.label || ''
            order.push(node.slot_key)
        }
        ;(node.children || []).forEach(visit)
    }
    if (root) visit(root)
    return { labels, order }
}

export const withLayoutPreviewPlaceholders = (
    model: RenderPageModel,
    layoutDefinition?: ThemeLayoutDefinition | null,
): RenderPageModel => {
    if (!layoutDefinition) return model
    const { labels: nodeLabels, order: renderedSlotOrder } = layoutSlotNodes(layoutDefinition.root)
    const slots = { ...model.slots }
    const declaredSlots = Object.entries(layoutDefinition.slots || {})
    const orderedSlots = [
        ...renderedSlotOrder.flatMap((slotKey) => {
            const policy = layoutDefinition.slots?.[slotKey]
            return policy ? [[slotKey, policy] as const] : []
        }),
        ...declaredSlots.filter(([slotKey]) => !renderedSlotOrder.includes(slotKey)),
    ]
    orderedSlots.forEach(([slotKey, policy], index) => {
        if (slots[slotKey]?.length) return
        slots[slotKey] = [{
            id: `layout-preview-placeholder-${layoutDefinition.id}-${slotKey}`,
            type: 'designer.LayoutSlotPlaceholder',
            config: {
                label: nodeLabels[slotKey] || policy.label || slotKey,
                shade: index % 4,
            },
        }]
    })
    return {
        ...model,
        slots,
        designer: model.designer || {
            catalog: {},
            texts: {},
            assets: [],
            guidesEnabled: false,
            layoutCanvas: false,
        },
    }
}

export const createDesignerRenderModel = ({
    workspace, viewId, themeCss = '', fontUrl = '', sourceModel = null, guidesEnabled = true, contentEditable = false,
    guideVisibility = undefined,
    viewportWidth = undefined,
}: any): RenderPageModel => {
    const views = workspace?.previewContent?.views || workspace?.catalog?.previewViews || []
    const view = views.find((candidate: any) => candidate.id === viewId) || views[0] || {}
    const imageReferenceCollection = collectDesignerPreviewImageReferences(view)
    const document = view.content && typeof view.content === 'object' ? view.content : null
    const documentWidgets = document?.widgets && typeof document.widgets === 'object' ? document.widgets : null
    const layout = sourceModel?.layout || document?.codeLayout || view.layout || 'main_layout'
    const layoutDefinition = workspace?.layouts?.items?.find((candidate: any) => candidate.key === layout) || null
    const slots: Record<string, RenderWidgetModel[]> = {}
    const catalogLayout = workspace?.catalog?.layouts?.find((candidate: any) => candidate.key === layout)
    const rawSlots = sourceModel?.slots || documentWidgets || {}
    const isObjectPreview = Boolean(sourceModel?.context?.objectId || view.kind === 'object')
    const previewSlots = isObjectPreview
        ? { main: objectWidgetsForPreview(rawSlots, sourceModel?.context?.objectType || view.objectType) }
        : rawSlots
    const availableSlots = [...new Set([
        ...(layoutDefinition ? Object.keys(layoutDefinition.slots || {}) : catalogLayout?.slots?.map((slot: any) => slot.name) || layoutSlots[layout] || ['main']),
        ...Object.keys(previewSlots),
    ])]
    availableSlots.forEach((slot: string) => {
        const widgets = previewSlots[slot] || []
        slots[slot] = widgets.map((widget: any, index: number) => normalizeWidget(widget, `${slot}-${index}`, imageReferenceCollection.referencesByObject))
    })
    const primary = availableSlots.find((slot: string) => ['main', 'content', 'body', 'landingPage', 'landing_page'].includes(slot)) || availableSlots[0]
    const objectData = sourceModel?.context?.objectData || document?.data || {}
    const objectType = sourceModel?.context?.objectType || view.objectType || {}

    if (isObjectPreview && Object.keys(objectData).length) {
        slots[primary] ||= []
        slots[primary].unshift({
            id: `${view.id || 'live-object'}-data`,
            type: 'designer.ObjectDataPreview',
            config: {},
            previewImageReferences: document?.data && typeof document.data === 'object'
                ? imageReferenceCollection.referencesByObject.get(document.data) || []
                : [],
        })
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
            config: {
                imageUrl: image?.url || image?.fileUrl,
                altText: image?.filename || '',
                mediaItems: [{
                    url: image?.url || image?.fileUrl,
                    altText: image?.filename || '',
                }],
            },
            previewImageReferences: image && typeof image === 'object'
                ? imageReferenceCollection.referencesByObject.get(image) || []
                : [],
        }, `${slot}-preview-image-${index}`))
    })

    if (layout === 'landing_page' && !slots.landingPage?.length && slots.landing_page?.length) {
        slots.landingPage = slots.landing_page
    }

    const structuralSlotSpacing = Object.fromEntries((workspace?.catalog?.layouts || []).flatMap((item: any) => (
        (item.slots || []).map((slot: any) => [
            `layout:${item.key}:slot:${slot.name}`,
            slot.editableSpacingProperties || [],
        ])
    )).concat((workspace?.catalog?.widgetSlots || []).flatMap((item: any) => (
        (item.slots || []).map((slot: any) => [
            `widget-slot:${item.widgetType}:${slot.name}`,
            slot.editableSpacingProperties || [],
        ])
    ))))
    const structuralWidgetPartSpacing = Object.fromEntries([
        ...(workspace?.catalog?.designGroups || []).flatMap((group: any) => (
            (group.parts || []).flatMap((part: any) => part.editableSpacingProperties?.length
                ? [[part.id, part.editableSpacingProperties]]
                : [])
        )),
        ...(workspace?.catalog?.widgetParts || []).flatMap((widget: any) => (
            (widget.parts || []).flatMap((part: any) => part.editableSpacingProperties?.length
                ? [[part.id, part.editableSpacingProperties]]
                : [])
        )),
    ])
    const genericWidgetSpacing = Object.fromEntries([...renderedWidgetTypes(slots)].map((widgetType) => [
        `widget-type:${widgetType}`,
        workspace?.constraints?.editableWidgetFrameSpacingProperties
            || (workspace?.constraints?.editableSpacingProperties || []).filter((field: string) => field.startsWith('margin')),
    ]))
    const editableSpacingTargets = (workspace?.spacing || []).reduce((targets: Record<string, string[]>, row: any) => {
        const fields = row.scope === 'layoutSlot'
            ? structuralSlotSpacing[row.targetId] || []
            : row.scope === 'widgetSlot'
                ? structuralSlotSpacing[row.targetId] || []
                : configuredSpacingFields(row.values)
        if (fields.length) targets[row.targetId] = [...new Set([...(targets[row.targetId] || []), ...fields])]
        return targets
    }, { ...genericWidgetSpacing, ...structuralSlotSpacing, ...structuralWidgetPartSpacing })

    const themeGroups = workspace?.themeConfig?.designGroups?.groups
        || workspace?.themeConfig?.design_groups?.groups
        || []
    const designGroupTargeting = Object.fromEntries((workspace?.catalog?.designGroups || []).map((group: any) => {
        const themeGroup = themeGroups[group.groupIndex] || {}
        return [group.id, {
                targetingMode: themeGroup.targetingMode || themeGroup.targeting_mode || 'widget-slot',
                targetCssClasses: themeGroup.targetCssClasses || themeGroup.target_css_classes || '',
                variants: themeGroup.variants?.length ? themeGroup.variants : [themeGroup.variant].filter(Boolean),
                cssModifier: themeGroup.cssModifier || themeGroup.css_modifier || '',
            }]
    }))
    const spacingTargetIds = new Set([
        ...(workspace?.spacing || []).map((row: any) => row.targetId).filter(Boolean),
        ...(workspace?.catalog?.designGroups || []).flatMap((group: any) => (
            (group.parts || []).map((part: any) => part.id)
        )),
    ])
    const activeSpacingPropertiesByTarget = Object.fromEntries([...spacingTargetIds].map((targetId: string) => [
        targetId,
        activeSpacingProperties(
            (workspace?.spacing || []).filter((row: any) => row.targetId === targetId),
            workspace?.breakpoints || {},
            viewportWidth,
        ),
    ]))

    return {
        layout,
        layoutDefinition,
        layoutDefinitionRequired: Boolean(workspace?.layouts),
        layoutBreakpoints: workspace?.breakpoints,
        slots,
        context: {
            ...(sourceModel?.context || {}),
            ...(isObjectPreview ? {
                objectId: sourceModel?.context?.objectId || view.id || 'theme-preview-object',
                objectData,
                objectType,
            } : {}),
            preview: true,
            themeWidgetTypes: workspace?.widgetTypes || workspace?.themeConfig?.widget_types || workspace?.themeConfig?.widgetTypes,
            componentStyles: Object.fromEntries((workspace?.catalog?.componentStyles || []).map((style: any) => [style.key, style])),
        },
        themeCss: themeCss || '',
        fontUrl,
        designer: {
            catalog: workspace?.catalog || {},
            designGroupTargeting,
            activeSpacingPropertiesByTarget,
            texts: sourceModel ? {} : view.texts || {},
            assets: workspace?.assets || [],
            editableTypographyTargets: (workspace?.typography || []).reduce((targets: Record<string, string[]>, row: any) => {
                const fields = workspace?.constraints?.editableTypographyProperties || Object.keys(row.values || {})
                targets[row.targetId] = [...new Set([...(targets[row.targetId] || []), ...fields])]
                return targets
            }, {}),
            editableSpacingTargets,
            previewImageReferences: sourceModel ? [] : imageReferenceCollection.references,
            contentEditable,
            guidesEnabled,
            guideVisibility,
        },
    }
}
