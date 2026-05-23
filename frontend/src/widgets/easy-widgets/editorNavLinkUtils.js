const isAbsoluteWebUrl = (url = '') => /^https?:\/\//i.test(url)

export const isExternalNavItem = (item = {}) => {
    return item.type === 'external' && Boolean(item.url)
}

export const isInternalNavItem = (item = {}) => {
    return item.type === 'internal' && Boolean(item.pageId || item.page_id)
}

export const appendAnchor = (url = '', anchor = '') => {
    if (!url || !anchor) return url
    return `${url}${url.includes('#') ? '' : `#${anchor}`}`
}

export const getPageId = (item = {}) => item.pageId || item.page_id || null
export const getAnchor = (item = {}) => item.anchor || ''

export const canShowEditorNavMenu = (item = {}) => {
    return isInternalNavItem(item) || isExternalNavItem(item)
}

export const isEditorNavMenuContext = (mode = 'preview', context = {}) => {
    return (
        mode === 'editor' ||
        mode === 'edit' ||
        context?.isEditorContext === true ||
        context?.editorContext === true ||
        context?.slotPreviewMode === true
    )
}

export const normalizeNavItem = (item = {}, index = 0) => {
    const linkData = item.linkData || item.link_data || null
    const source = linkData || item
    const order = item.order !== undefined ? item.order : index

    return {
        ...item,
        ...source,
        label: source.label || item.label || '',
        url: source.url || item.url || '',
        isActive: source.isActive !== false && source.is_active !== false && item.isActive !== false && item.is_active !== false,
        targetBlank: source.targetBlank || source.target_blank || item.targetBlank || item.target_blank || false,
        type: source.type || item.type || (source.url ? 'external' : 'external'),
        pageId: source.pageId || source.page_id || item.pageId || item.page_id || null,
        pageTitle: source.pageTitle || source.page_title || item.pageTitle || item.page_title || '',
        pageShortTitle: source.pageShortTitle || source.page_short_title || item.pageShortTitle || item.page_short_title || '',
        anchor: source.anchor || item.anchor || '',
        isPublished: source.isPublished ?? source.is_published ?? item.isPublished ?? item.is_published,
        currentVersionId: source.currentVersionId || source.current_version_id || item.currentVersionId || item.current_version_id || null,
        order,
    }
}

export const processNavItems = (items = []) => {
    if (!Array.isArray(items)) return []
    return items.map((item, index) => normalizeNavItem(item, index))
}

export const itemFromStyledAnchor = (anchor, items = []) => {
    const href = anchor?.getAttribute('href') || ''
    const label = anchor?.textContent?.trim() || ''
    const normalizedHref = typeof window !== 'undefined'
        ? href.replace(window.location.origin, '')
        : href

    const matchedItem = items.find((item) => {
        const normalizedItem = normalizeNavItem(item)
        const itemUrl = normalizedItem.url || ''
        return (
            (itemUrl && (itemUrl === href || itemUrl === normalizedHref)) ||
            (label && normalizedItem.label === label)
        )
    })

    if (matchedItem) {
        return normalizeNavItem(matchedItem)
    }

    if (href && (isAbsoluteWebUrl(href) || href.startsWith('/'))) {
        return normalizeNavItem({
            type: 'external',
            label,
            url: href,
        })
    }

    return null
}
