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
