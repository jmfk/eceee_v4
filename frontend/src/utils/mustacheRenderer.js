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

/**
 * Prepare navigation context for Mustache rendering
 * Matches the backend logic in NavigationWidget.prepare_template_context()
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

    const result = {
        // Combined items array for Mustache template
        items: allItems,

        // Individual arrays (for templates that need them separately)
        menuItems,
        dynamicMenuItems,
        menu_items: menuItems,  // snake_case for backend compatibility
        dynamic_menu_items: dynamicMenuItems,

        // Page context (camelCase for Mustache templates)
        ownerPage: ownerPage,
        ownerChildren: ownerChildren,
        hasOwnerChildren: ownerChildren.length > 0,

        currentPage: currentPage,
        currentChildren: currentChildren,
        hasCurrentChildren: currentChildren.length > 0,

        parentPage: parentPage,
        parentChildren: parentChildren,
        hasParentChildren: parentChildren.length > 0,

        // Also provide snake_case versions for backend template compatibility
        owner_page: ownerPage,
        owner_children: ownerChildren,
        current_page: currentPage,
        current_children: currentChildren,
        parent_page: parentPage,
        parent_children: parentChildren,

        // Inheritance flag
        isInherited: !!context?.inheritedFrom,
        is_inherited: !!context?.inheritedFrom
    }

    return result
}

