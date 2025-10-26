import Mustache from 'mustache'

/**
 * Render Mustache template with context
 */
export function renderMustache(template, context) {
    try {
        return Mustache.render(template, context)
    } catch (error) {
        console.error('Mustache render error:', error)
        return `<!-- Template render error: ${error.message} -->`
    }
}

/**
 * Prepare gallery context for rendering
 */
export function prepareGalleryContext(images, config, styleVars = {}) {
    // Add index to images
    const indexedImages = images.map((img, i) => ({ ...img, index: i }))

    return {
        images: indexedImages,
        imageCount: images.length,
        multipleImages: images.length > 1,
        showCaptions: config.showCaptions ?? true,
        enableLightbox: config.enableLightbox ?? true,
        columns: styleVars.columns ?? 3,
        ...styleVars
    }
}

/**
 * Prepare carousel context for rendering
 */
export function prepareCarouselContext(images, config, styleVars = {}) {
    const indexedImages = images.map((img, i) => ({ ...img, index: i }))

    return {
        images: indexedImages,
        imageCount: images.length,
        multipleImages: images.length > 1,
        showCaptions: config.showCaptions ?? true,
        autoPlay: config.autoPlay ?? false,
        autoPlayInterval: config.autoPlayInterval ?? 3,
        ...styleVars
    }
}

/**
 * Prepare component style context for rendering
 */
export function prepareComponentContext(content, styleVars = {}) {
    return {
        content,
        ...styleVars
    }
}

