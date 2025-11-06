import Mustache from 'mustache'

/**
 * Render Mustache template with context
 */
export function renderMustache(template, context) {
    try {
        const result = Mustache.render(template, context)
        return result
    } catch (error) {
        console.error('[renderMustache] Error:', error)
        return `<!-- Template render error: ${error.message} -->`
    }
}

/**
 * Prepare gallery context for rendering
 */
export function prepareGalleryContext(images, config, styleVars = {}, lightboxConfig = {}) {
    // Add index to images
    const indexedImages = images.map((img, i) => ({ ...img, index: i }))

    return {
        images: indexedImages,
        imageCount: images.length,
        multipleImages: images.length > 1,
        showCaptions: config.showCaptions ?? true,
        enableLightbox: config.enableLightbox ?? true,
        lightboxButtonClass: lightboxConfig.buttonClass || '',
        lightboxCloseIcon: lightboxConfig.closeIcon || '',
        lightboxPrevIcon: lightboxConfig.prevIcon || '',
        lightboxNextIcon: lightboxConfig.nextIcon || '',
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

/**
 * Prepare navigation context for Mustache rendering
 * Matches the backend logic in NavigationWidget.prepare_template_context()
 * All variables use camelCase for consistency
 */
export function prepareNavigationContext(config, context = {}, ownerPageData = null) {
    const currentPage = context?.pageData || context?.currentPage || {}
    const ownerPage = ownerPageData || currentPage

    // Extract children data if available
    const ownerChildren = ownerPageData?.children || []
    const currentChildren = context?.children || []
    const parentPage = context?.parentPage || {}
    const parentChildren = context?.parentChildren || []

    // Prepare menu items
    const menuItems = config.menuItems || []
    const dynamicMenuItems = config.dynamicMenuItems || []

    // Combine all menu items for template (dynamic first, then static)
    const allItems = [...dynamicMenuItems, ...menuItems]

    // Calculate inheritance depth
    const depth = context?.inheritanceDepth || context?.inheritance_depth || 0

    const result = {
        // Combined items array for Mustache template
        items: allItems,

        // Individual arrays (for templates that need them separately)
        menuItems,
        dynamicMenuItems,
        staticItems: menuItems,

        // Counts and flags
        itemCount: allItems.length,
        hasItems: allItems.length > 0,

        // Page context (all camelCase)
        ownerPage: ownerPage,
        ownerChildren: ownerChildren,
        hasOwnerChildren: ownerChildren.length > 0,

        currentPage: currentPage,
        currentChildren: currentChildren,
        hasCurrentChildren: currentChildren.length > 0,

        parentPage: parentPage,
        parentChildren: parentChildren,
        hasParentChildren: parentChildren.length > 0,

        // Inheritance info with depth helpers for Mustache
        isInherited: !!context?.inheritedFrom,
        inheritanceDepth: depth,
        isRoot: depth === 0,
        isLevel1: depth === 1,
        isLevel2: depth === 2,
        isLevel3: depth === 3,
        isLevel1AndBelow: depth >= 1,
        isLevel2AndBelow: depth >= 2,
        isLevel3AndBelow: depth >= 3,
        isDeepLevel: depth >= 4
    }

    return result
}

