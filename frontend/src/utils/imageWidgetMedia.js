export const IMAGE_WIDGET_DEFAULT_WIDTH = 896

export const imageSourceUrl = source => {
    if (typeof source === 'string') return source
    if (!source || typeof source !== 'object') return ''

    if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(source.id || '')
        && (source.type || source.fileType || source.file_type || 'image') !== 'video') {
        return `/api/v1/media/file/${source.id}/`
    }
    return source.stableUrl || source.stable_url
        || source.src || source.srcUrl || source.src_url
        || source.sourceUrl || source.source_url
        || source.imgproxyBaseUrl || source.imgproxy_base_url
        || source.fileUrl || source.file_url
        || source.url
        || ''
}

export const isImageCollectionReference = image => Boolean(
    image
    && typeof image === 'object'
    && image.id
    && (
        image.type === 'collection'
        || ((!image.type || image.type === 'collection') && !image.fileType && !image.file_type
            && (image.fileCount !== undefined || image.file_count !== undefined
            || image.sampleImages !== undefined || image.sample_images !== undefined
            || image.slug !== undefined)
            && !(
                image.stableUrl || image.stable_url || image.src || image.srcUrl || image.src_url
                || image.sourceUrl || image.source_url || image.imgproxyBaseUrl || image.imgproxy_base_url
                || image.fileUrl || image.file_url || image.url
            ))
    )
)

export const normalizeImageMediaItem = item => {
    if (!item) return null
    if (typeof item === 'string') return { url: item, type: 'image', altText: '' }

    const url = imageSourceUrl(item)
    if (!url) return null

    return {
        ...item,
        url,
        processingSourceUrl: item.processingSourceUrl || item.imgproxyBaseUrl || item.imgproxy_base_url
            || item.fileUrl || item.file_url || item.url || '',
        src: item.src || item.srcUrl || item.src_url || '',
        srcSet: item.srcSet || item.srcset || '',
        type: item.type || ((item.fileType || item.file_type) === 'video' ? 'video' : 'image'),
        altText: item.altText || item.alt_text || item.title || '',
        caption: item.caption || item.description || '',
        thumbnailUrl: item.thumbnailUrl || item.thumbnail_url || '',
    }
}

/**
 * @param {Record<string, any>} config
 * @param {any[] | null} resolvedItems
 */
export const imageWidgetMediaItems = (config = {}, resolvedItems = null) => {
    const configuredItems = Array.isArray(resolvedItems)
        ? resolvedItems
        : Array.isArray(config.mediaItems)
            ? config.mediaItems
            : Array.isArray(config.media_items)
                ? config.media_items
                : []

    const normalizedItems = configuredItems.map(normalizeImageMediaItem).filter(Boolean)
    if (normalizedItems.length) return normalizedItems

    if (config.image && !isImageCollectionReference(config.image)) {
        const image = normalizeImageMediaItem(config.image)
        if (image) return [image]
    }

    const legacyUrl = config.imageUrl || config.image_url
    return legacyUrl ? [{
        url: legacyUrl,
        type: 'image',
        altText: config.altText || config.alt_text || 'Image',
        caption: config.caption || '',
    }] : []
}
