export const IMAGE_WIDGET_DEFAULT_WIDTH = 896

export const imageSourceUrl = source => {
    if (typeof source === 'string') return source
    if (!source || typeof source !== 'object') return ''

    return source.sourceUrl || source.source_url
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
        || ((image.fileCount !== undefined || image.file_count !== undefined
            || image.sampleImages !== undefined || image.sample_images !== undefined
            || image.slug !== undefined)
            && !imageSourceUrl(image))
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
        src: item.src || item.srcUrl || item.src_url || '',
        srcSet: item.srcSet || item.srcset || '',
        type: item.type || ((item.fileType || item.file_type) === 'video' ? 'video' : 'image'),
        altText: item.altText || item.alt_text || item.title || '',
        caption: item.caption || item.description || '',
        thumbnailUrl: item.thumbnailUrl || item.thumbnail_url || '',
    }
}

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
