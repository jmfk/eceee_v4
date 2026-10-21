// Render a copy so switching modes never removes the user's stored images.
/** @param {Record<string, any>} config */
export const getBannerRenderConfig = (config = {}) => {
    const rendered = { ...config }
    const mode = config.bannerMode ?? config.banner_mode ?? 'text'
    const inactiveFields = mode === 'header'
        ? ['image1', 'image_1', 'image1Url', 'image_1_url', 'image1Url2x', 'image_1_url_2x', 'imageSize', 'image_size']
        : ['backgroundImage', 'background_image', 'backgroundImageUrl', 'background_image_url', 'backgroundImageUrl2x', 'background_image_url_2x']
    inactiveFields.forEach(field => { delete rendered[field] })
    return rendered
}

// Palette selections are stored as names; CSS variables keep them theme-aware
// in both the editor and the server-rendered publisher. The fallback also
// preserves ordinary CSS named colors such as "white" and "navy".
const bannerColor = color => /^[a-zA-Z_][\w-]*$/.test(color)
    && !['inherit', 'initial', 'unset', 'revert', 'transparent', 'currentColor'].includes(color)
    ? `var(--${color}, ${color})` : color

export const BANNER_TEXT_OUTLINES = {
    none: 'none',
    dark: '-1px -1px 0 #000, 0 -1px 0 #000, 1px -1px 0 #000, -1px 0 0 #000, 1px 0 0 #000, -1px 1px 0 #000, 0 1px 0 #000, 1px 1px 0 #000',
    light: '-1px -1px 0 #fff, 0 -1px 0 #fff, 1px -1px 0 #fff, -1px 0 0 #fff, 1px 0 0 #fff, -1px 1px 0 #fff, 0 1px 0 #fff, 1px 1px 0 #fff',
}

/** @param {Record<string, any>} config */
export const getBannerPresentationStyle = (config = {}) => {
    const textColor = bannerColor(config.textColor || config.text_color || '#000000')
    const backgroundColor = bannerColor(config.backgroundColor || config.background_color || '#ffffff')
    const outline = config.textOutline ?? config.text_outline ?? 'none'
    return {
        color: textColor,
        backgroundColor,
        '--banner-text-color': textColor,
        '--banner-text-shadow': Object.hasOwn(BANNER_TEXT_OUTLINES, outline) ? BANNER_TEXT_OUTLINES[outline] : 'none',
    }
}
