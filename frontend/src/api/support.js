import client from './client'

export const supportRequest = async (tenant, path, method = 'get', data) => {
    const response = await client.request({
        url: `/api/v1/support/${path}`,
        method,
        data,
        headers: {
            ...(tenant ? { 'X-Tenant-ID': tenant } : {}),
            ...(data instanceof FormData ? { 'Content-Type': undefined } : {}),
        },
    })
    return response.data
}

export const supportError = (error) => {
    const data = error.response?.data
    if (typeof data === 'string')
        return 'Begäran kunde inte slutföras. Försök igen.'
    if (data)
        return (
            Object.values(data)
                .flat()
                .filter((v) => typeof v === 'string')
                .join(' ') || 'Begäran kunde inte slutföras.'
        )
    return 'Kunde inte ansluta. Texten finns kvar; försök igen.'
}

export const safeReportLocation = (href) => {
    if (!href) return ''
    try {
        const url = new URL(href, window.location.origin)
        if (!['http:', 'https:'].includes(url.protocol)) return ''
        return `${url.origin}${url.pathname}`
    } catch {
        return ''
    }
}

export const validateBugVideo = (file, maxBytes) =>
    new Promise((resolve, reject) => {
        if (file.size > maxBytes) {
            reject(
                new Error(
                    `Välj en video på högst ${Math.floor(maxBytes / 1048576)} MB.`,
                ),
            )
            return
        }
        const video = document.createElement('video')
        const url = URL.createObjectURL(file)
        let finished = false
        const finish = (error) => {
            if (finished) return
            finished = true
            video.onloadedmetadata = null
            video.onerror = null
            clearTimeout(timer)
            video.removeAttribute('src')
            video.load()
            URL.revokeObjectURL(url)
            if (error) reject(new Error(error))
            else resolve()
        }
        const timer = setTimeout(
            () => finish('Videons längd kunde inte läsas. Välj en annan fil.'),
            15000,
        )
        video.preload = 'metadata'
        video.onloadedmetadata = () =>
            finish(
                !Number.isFinite(video.duration) ||
                    video.duration <= 0 ||
                    video.duration > 5
                    ? 'Bugginspelningen får vara högst 5 sekunder.'
                    : null,
            )
        video.onerror = () =>
            finish('Videon kunde inte läsas. Använd MP4 med H.264 eller WebM.')
        video.src = url
    })
