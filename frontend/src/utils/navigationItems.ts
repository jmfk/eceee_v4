export interface NavigationItem {
    [key: string]: any
    label: string
    url: string
    resolvedUrl?: string
    isActive: boolean
    targetBlank: boolean
    type: string
    pageId: string | number | null
    pageTitle: string
    pageShortTitle: string
    anchor: string
    order: number
}

export const normalizeNavigationItem = (item: Record<string, any> = {}, index = 0): NavigationItem => {
    const linkData = item.linkData || item.link_data || null
    const source = linkData || item

    return {
        ...item,
        ...source,
        label: source.label || item.label || '',
        url: source.url || item.url || '',
        resolvedUrl: source.resolvedUrl || source.resolved_url || item.resolvedUrl || item.resolved_url,
        isActive: source.isActive !== false && source.is_active !== false && item.isActive !== false && item.is_active !== false,
        targetBlank: source.targetBlank || source.target_blank || item.targetBlank || item.target_blank || false,
        type: source.type || item.type || (source.url ? 'external' : 'external'),
        pageId: source.pageId || source.page_id || item.pageId || item.page_id || null,
        pageTitle: source.pageTitle || source.page_title || item.pageTitle || item.page_title || '',
        pageShortTitle: source.pageShortTitle || source.page_short_title || item.pageShortTitle || item.page_short_title || '',
        anchor: source.anchor || item.anchor || '',
        isPublished: source.isPublished ?? source.is_published ?? item.isPublished ?? item.is_published,
        currentVersionId: source.currentVersionId || source.current_version_id || item.currentVersionId || item.current_version_id || null,
        _navListKey: item._navListKey,
        _navIndex: item._navIndex,
        order: item.order !== undefined ? item.order : index,
    }
}

export const processNavigationItems = (items: unknown): NavigationItem[] => Array.isArray(items)
    ? items.map((item, index) => normalizeNavigationItem(item, index))
    : []
