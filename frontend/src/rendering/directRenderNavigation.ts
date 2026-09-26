const NON_PAGE_PATH_PREFIXES = ['/api/', '/media/', '/static/', '/uploads/']

interface DirectRenderLinkContext {
    routePrefix: string
    currentPath?: string
    siteHostnames?: string[]
}
const normalizedHostname = (hostname: string) => String(hostname || '').toLowerCase().split(':')[0]

export const rewriteDirectRenderHref = (candidate: string, {
    routePrefix,
    currentPath = '/',
    siteHostnames = [],
}: DirectRenderLinkContext): string => {
    const href = String(candidate || '').trim()
    if (!href || href.startsWith('#')) return href
    if (/^(mailto|tel|data|blob|javascript):/i.test(href)) return href

    const normalizedPrefix = `/${routePrefix.split('/').filter(Boolean).join('/')}`
    if (href === normalizedPrefix || href.startsWith(`${normalizedPrefix}/`)) return href

    const basePath = `/${String(currentPath || '').replace(/^\/+|\/+$/g, '')}/`
    let resolved: URL
    try {
        resolved = new URL(href, `https://render-preview.invalid${basePath}`)
    } catch {
        return href
    }

    if (resolved.hostname !== 'render-preview.invalid') {
        const allowedHostnames = new Set(siteHostnames.map(normalizedHostname).filter(Boolean))
        if (!['http:', 'https:'].includes(resolved.protocol) || !allowedHostnames.has(normalizedHostname(resolved.hostname))) {
            return href
        }
    }

    if (NON_PAGE_PATH_PREFIXES.some((prefix) => resolved.pathname.startsWith(prefix))) return href

    return `${normalizedPrefix}${resolved.pathname}${resolved.search}${resolved.hash}`
}
