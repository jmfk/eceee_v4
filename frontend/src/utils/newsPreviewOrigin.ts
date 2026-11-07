export const newsPreviewOrigin = (hostnames: string[]) => {
    const candidates = hostnames.filter(value => /^[a-z0-9][a-z0-9.-]*$/i.test(value) && !value.includes('..'))
    const localAdmin = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
        || window.location.hostname.endsWith('.localhost')
    const hostname = (localAdmin ? candidates.find(value => value === 'localhost' || value.endsWith('.localhost')) : undefined)
        || candidates[0]
    if (!hostname) throw new Error('No public site hostname is configured for this preview.')
    const local = hostname === 'localhost' || hostname.endsWith('.localhost')
    const adminPort = Number(window.location.port)
    const fallbackPort = Number.isInteger(adminPort) && adminPort > 0
        ? Math.floor(adminPort / 100) * 100 + 15 : 10115
    const port = local ? `:${import.meta.env.VITE_PUBLISHER_PORT || fallbackPort}` : ''
    return `${local ? 'http:' : 'https:'}//${hostname}${port}`
}

