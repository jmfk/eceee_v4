type RuntimeLocation = Pick<Location, 'protocol' | 'hostname' | 'port'>

const pagePath = (candidate: any, fallback = '#') => {
    const path = String(candidate?.path || candidate?.pagePath || candidate?.page_path || fallback || '#')
    if (path === '#') return path
    const query = candidate?.query ? `?${String(candidate.query).replace(/^\?/, '')}` : ''
    const anchor = candidate?.anchor ? `#${String(candidate.anchor).replace(/^#/, '')}` : ''
    return `${path}${path.includes('?') || !query ? '' : query}${path.includes('#') || !anchor ? '' : anchor}`
}

export const portableInternalHref = (
    candidate: any,
    fallback = '#',
    runtimeLocation: RuntimeLocation | undefined = typeof window === 'undefined' ? undefined : window.location,
): string => {
    const path = pagePath(candidate, fallback)
    if (path === '#') return path
    const siteHostname = String(candidate?.siteHostname || candidate?.site_hostname || '').trim().toLowerCase()
    if (!siteHostname || !runtimeLocation || siteHostname === runtimeLocation.hostname.toLowerCase()) return path
    if (!/^[a-z0-9.-]+$/i.test(siteHostname)) return path
    const port = runtimeLocation.port ? `:${runtimeLocation.port}` : ''
    return `${runtimeLocation.protocol}//${siteHostname}${port}${path.startsWith('/') ? path : `/${path}`}`
}
