import { api } from '../api/client'
import { endpoints } from '../api/endpoints'
import { objectInstancesApi } from '../api/objectStorage'
import type { RenderPageModel, RenderWidgetModel } from '../rendering/types'
import { getBatchImgproxyUrls } from '../utils/imgproxySecure'

const dataDrivenNewsTypes = new Set([
    'easy_widgets.NewsListWidget',
    'easy_widgets.NewsDetailWidget',
    'easy_widgets.TopNewsPlugWidget',
    'easy_widgets.SidebarTopNewsWidget',
])

const linkTypes = new Set(['internal', 'external', 'email', 'phone', 'anchor', 'media'])

const decodeHtmlAttribute = (candidate: string) => candidate
    .replace(/&quot;|&#34;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&amp;/g, '&')

const structuredLinkFromString = (candidate: string) => {
    try {
        const parsed = JSON.parse(decodeHtmlAttribute(candidate))
        return parsed && typeof parsed === 'object' && linkTypes.has(parsed.type) ? parsed : null
    } catch {
        return null
    }
}

const collectInternalPageIds = (candidate: any, ids: Set<string>) => {
    if (typeof candidate === 'string') {
        const exact = structuredLinkFromString(candidate)
        if (exact?.type === 'internal' && (exact.pageId || exact.page_id)) ids.add(String(exact.pageId || exact.page_id))
        candidate.replace(/href=(['"])(.*?)\1/gi, (_match, _quote, href) => {
            const link = structuredLinkFromString(href)
            if (link?.type === 'internal' && (link.pageId || link.page_id)) ids.add(String(link.pageId || link.page_id))
            return _match
        })
        return
    }
    if (!candidate || typeof candidate !== 'object') return
    if (candidate.type === 'internal' && (candidate.pageId || candidate.page_id)) ids.add(String(candidate.pageId || candidate.page_id))
    Object.values(candidate).forEach((value) => collectInternalPageIds(value, ids))
}

const resolvedHref = (link: Record<string, any>, pageLookup: Map<string, any>) => {
    if (link.type === 'internal') {
        const page = pageLookup.get(String(link.pageId || link.page_id))
        const path = page?.path || '#'
        return link.anchor && path !== '#' ? `${path}${path.includes('#') ? '' : `#${link.anchor}`}` : path
    }
    if (link.type === 'external' || link.type === 'media') return link.url || '#'
    if (link.type === 'email') return link.address ? `mailto:${link.address}` : '#'
    if (link.type === 'phone') return link.number ? `tel:${String(link.number).replace(/[^\d+]/g, '')}` : '#'
    if (link.type === 'anchor') return link.anchor ? `#${String(link.anchor).replace(/^#/, '')}` : '#'
    return '#'
}

const escapeHtmlAttribute = (candidate: string) => candidate.replace(/&/g, '&amp;').replace(/"/g, '&quot;')

const resolveConfigLinks = (candidate: any, pageLookup: Map<string, any>): any => {
    if (typeof candidate === 'string') {
        const exact = structuredLinkFromString(candidate)
        if (exact) return resolvedHref(exact, pageLookup)
        return candidate.replace(/href=(['"])(.*?)\1/gi, (match, quote, href) => {
            const link = structuredLinkFromString(href)
            return link ? `href=${quote}${escapeHtmlAttribute(resolvedHref(link, pageLookup))}${quote}` : match
        })
    }
    if (Array.isArray(candidate)) return candidate.map((item) => resolveConfigLinks(item, pageLookup))
    if (!candidate || typeof candidate !== 'object') return candidate
    const resolved = Object.fromEntries(Object.entries(candidate).map(([key, item]) => [key, resolveConfigLinks(item, pageLookup)]))
    if (linkTypes.has(candidate.type)) {
        const page = candidate.type === 'internal' ? pageLookup.get(String(candidate.pageId || candidate.page_id)) : null
        resolved.resolvedUrl = resolvedHref(candidate, pageLookup)
        if (page) {
            resolved.isPublished = page.isPublished ?? page.is_published
            resolved.pageTitle ||= page.title
            resolved.siteId = page.siteId ?? page.site_id
        }
    }
    return resolved
}

export const resolvePagePreviewModel = async (model: RenderPageModel): Promise<RenderPageModel> => {
    const next = structuredClone(model)
    const tenantRequestConfig = model.context.tenantId
        ? { headers: { 'X-Tenant-ID': model.context.tenantId } }
        : undefined
    const collectWidgets = (widgets: RenderWidgetModel[]): RenderWidgetModel[] => widgets.flatMap((widget) => {
        const nested = [
            ...(Array.isArray(widget.config.widgets) ? widget.config.widgets : []),
            ...Object.values(widget.config.slots || {}).flatMap((items) => Array.isArray(items) ? items : []),
        ] as RenderWidgetModel[]
        return [widget, ...collectWidgets(nested)]
    })
    const allWidgets = collectWidgets(Object.values(next.slots).flat())
    const internalPageIds = new Set<string>()
    allWidgets.forEach((widget) => collectInternalPageIds(widget.config, internalPageIds))
    const pageLookup = new Map<string, any>()
    await Promise.all([...internalPageIds].map(async (id) => {
        try {
            const response: any = await api.get(
                `${endpoints.pages.lookup}?id=${encodeURIComponent(id)}`,
                tenantRequestConfig,
            )
            pageLookup.set(id, response?.data || response)
        } catch {
            pageLookup.set(id, null)
        }
    }))
    allWidgets.forEach((widget) => { widget.config = resolveConfigLinks(widget.config, pageLookup) })

    const imageRequests: Array<Record<string, any>> = []
    const imageAssignments: Array<(url: string) => void> = []
    const queueImage = (source: any, options: Record<string, any>, assign: (url: string) => void) => {
        const sourceUrl = source?.imgproxyBaseUrl || source?.imgproxy_base_url
        if (!sourceUrl) return
        imageRequests.push({ sourceUrl, ...options })
        imageAssignments.push(assign)
    }
    allWidgets.forEach((widget) => {
        if (widget.type === 'easy_widgets.HeroWidget') {
            const source = widget.config.image
            queueImage(source, { width: 1920, height: 1080, resize_type: 'fill' }, (url) => { widget.config.backgroundImageUrl = url })
            queueImage(source, { width: 3840, height: 2160, resize_type: 'fill' }, (url) => { widget.config.backgroundImageUrl2x = url })
        }
        if (widget.type === 'easy_widgets.BannerWidget') {
            const background = widget.config.backgroundImage || widget.config.background_image
            queueImage(background, { width: 1920, height: 600, resize_type: 'fill' }, (url) => { widget.config.backgroundImageUrl = url })
            queueImage(background, { width: 3840, height: 1200, resize_type: 'fill' }, (url) => { widget.config.backgroundImageUrl2x = url })
            const image = widget.config.image1 || widget.config.image_1
            const rectangle = (widget.config.imageSize || widget.config.image_size) === 'rectangle'
            queueImage(image, { width: rectangle ? 280 : 140, height: 140, resize_type: 'fill' }, (url) => { widget.config.image1Url = url })
            queueImage(image, { width: rectangle ? 560 : 280, height: 280, resize_type: 'fill' }, (url) => { widget.config.image1Url2x = url })
        }
    })
    if (imageRequests.length) {
        const urls = await getBatchImgproxyUrls(imageRequests)
        urls.forEach((url, index) => imageAssignments[index]?.(url))
    }

    await Promise.all(allWidgets.map(async (widget) => {
        if (!dataDrivenNewsTypes.has(widget.type)) return
        const objectTypes = widget.config.objectTypes || widget.config.object_types || []
        if (widget.type === 'easy_widgets.NewsDetailWidget') {
            const variableName = widget.config.slugVariableName || widget.config.slug_variable_name || 'news_slug'
            const slug = next.context.pathVariables?.[variableName]
            if (!slug) {
                widget.data = { status: 'empty' }
                return
            }
            try {
                const searchResponse: any = await objectInstancesApi.search(slug, {}, tenantRequestConfig)
                const candidates = searchResponse?.results || searchResponse?.data?.results || searchResponse?.data || []
                const match = (Array.isArray(candidates) ? candidates : []).find((candidate: any) => candidate.slug === slug)
                if (!match) {
                    widget.data = { status: 'empty' }
                    return
                }
                const item: any = await objectInstancesApi.get(match.id, tenantRequestConfig)
                const resolved = item?.data || item
                const resolvedType = resolved?.objectType?.id || resolved?.object_type?.id
                if (Array.isArray(objectTypes) && objectTypes.length && resolvedType && !objectTypes.map(String).includes(String(resolvedType))) {
                    widget.data = { status: 'empty' }
                    return
                }
                widget.data = { status: 'ready', item: resolved }
            } catch (error: any) {
                widget.data = { status: 'error', error: error?.message || 'Failed to load preview data.' }
            }
            return
        }
        if (!Array.isArray(objectTypes) || objectTypes.length === 0) {
            widget.data = { status: 'empty', items: [] }
            return
        }
        try {
            const response: any = await objectInstancesApi.getNewsList(objectTypes, {
                limit: widget.config.limit || 10,
                sort_order: widget.config.sortOrder || widget.config.sort_order || '-publish_date',
            }, tenantRequestConfig)
            const items = response?.results || response?.data?.results || []
            widget.data = { status: items.length ? 'ready' : 'empty', items }
        } catch (error: any) {
            widget.data = { status: 'error', error: error?.message || 'Failed to load preview data.', items: [] }
        }
    }))
    return next
}
