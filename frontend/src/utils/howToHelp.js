const YOUTUBE_ID_PATTERN = /^[a-zA-Z0-9_-]{11}$/
const DEFAULT_HELP_VIDEO_LANGUAGE = 'sv'

export const extractYouTubeId = (value) => {
    if (!value || typeof value !== 'string') return ''

    const trimmed = value.trim()
    if (YOUTUBE_ID_PATTERN.test(trimmed)) return trimmed

    try {
        const url = new URL(trimmed)
        const hostname = url.hostname.replace(/^www\./, '')

        if (hostname === 'youtu.be') {
            const id = url.pathname.split('/').filter(Boolean)[0]
            return YOUTUBE_ID_PATTERN.test(id) ? id : ''
        }

        if (hostname === 'youtube.com' || hostname === 'youtube-nocookie.com') {
            const watchId = url.searchParams.get('v')
            if (YOUTUBE_ID_PATTERN.test(watchId)) return watchId

            const parts = url.pathname.split('/').filter(Boolean)
            const markerIndex = parts.findIndex(part => ['embed', 'shorts', 'live'].includes(part))
            const id = markerIndex >= 0 ? parts[markerIndex + 1] : ''
            return YOUTUBE_ID_PATTERN.test(id) ? id : ''
        }
    } catch {
        return ''
    }

    return ''
}

const normalizeVideoLanguage = (language = DEFAULT_HELP_VIDEO_LANGUAGE) => (
    language.toString().trim().toLowerCase() || DEFAULT_HELP_VIDEO_LANGUAGE
)

const sourceForLanguage = (source, language) => {
    const normalizedLanguage = normalizeVideoLanguage(language)

    return !source?.language || normalizeVideoLanguage(source.language) === normalizedLanguage
}

export const getHelpVideoBasePath = (language = DEFAULT_HELP_VIDEO_LANGUAGE) => (
    `/howto-videos/prod/${normalizeVideoLanguage(language)}`
)

export const getManualHelpVideoBasePath = (language = DEFAULT_HELP_VIDEO_LANGUAGE) => (
    `/howto-videos/manual/${normalizeVideoLanguage(language)}`
)

export const getDefaultHelpVideoPath = (sectionId, guideId, language = DEFAULT_HELP_VIDEO_LANGUAGE, extension = 'mp4') => {
    if (!sectionId || !guideId) return ''

    const cleanExtension = extension.replace(/^\./, '') || 'mp4'
    return `${getHelpVideoBasePath(language)}/${sectionId}-${guideId}.${cleanExtension}`
}

export const getManualHelpVideoPath = (sectionId, guideId, language = DEFAULT_HELP_VIDEO_LANGUAGE, extension = 'mp4') => {
    if (!sectionId || !guideId) return ''

    const cleanExtension = extension.replace(/^\./, '') || 'mp4'
    return `${getManualHelpVideoBasePath(language)}/${sectionId}-${guideId}.${cleanExtension}`
}

export const getHelpVideoConfig = (guide, sectionId, languageOverride = '') => {
    const language = languageOverride || guide?.videoLanguage || DEFAULT_HELP_VIDEO_LANGUAGE
    const explicitVideoUrl = guide?.videoUrl || guide?.mp4Url
    const explicitCaptionsUrl = guide?.captionsUrl || guide?.subtitlesUrl
    const localizedExplicitSources = Array.isArray(guide?.videoSources)
        ? guide.videoSources
            .filter(source => sourceForLanguage(source, language))
            .map(source => ({
                videoUrl: source.videoUrl || source.mp4Url || '',
                captionsUrl: source.captionsUrl || source.subtitlesUrl || '',
                language: source.language,
                source: 'explicit'
            }))
            .filter(source => source.videoUrl)
        : []
    const generatedVideoUrl = getDefaultHelpVideoPath(sectionId, guide?.id, language, 'mp4')
    const generatedCaptionsUrl = getDefaultHelpVideoPath(sectionId, guide?.id, language, 'vtt')
    const videoSources = localizedExplicitSources.length > 0
        ? localizedExplicitSources
        : explicitVideoUrl
        ? [{
            videoUrl: explicitVideoUrl,
            captionsUrl: explicitCaptionsUrl || generatedCaptionsUrl,
            language,
            source: 'explicit'
        }]
        : [
            {
                videoUrl: getManualHelpVideoPath(sectionId, guide?.id, language, 'mp4'),
                captionsUrl: getManualHelpVideoPath(sectionId, guide?.id, language, 'vtt'),
                language,
                source: 'manual'
            },
            {
                videoUrl: generatedVideoUrl,
                captionsUrl: generatedCaptionsUrl,
                language,
                source: 'generated'
            }
        ]
    const videoUrl = videoSources[0]?.videoUrl || ''
    const captionsUrl = videoSources[0]?.captionsUrl
        || guide?.captionsUrl
        || guide?.subtitlesUrl
        || ''

    return {
        videoUrl,
        captionsUrl,
        videoSources,
        language
    }
}

const SETTINGS_HELP_TOPICS = {
    dashboard: 'settings',
    layouts: 'settings-layouts',
    themes: 'settings-themes',
    widgets: 'widgets-edit',
    'value-lists': 'settings-data',
    'object-types': 'settings-data',
    versions: 'settings',
    publishing: 'settings-publishing',
    namespaces: 'settings-data',
    'data-connections': 'settings-data',
    'content-migration': 'settings-data'
}

export const getSettingsHelpTopic = (activeTab) => SETTINGS_HELP_TOPICS[activeTab] || 'settings'

export const getWidgetHelpTopic = (widgetType) => {
    if (!widgetType || typeof widgetType !== 'string') return 'widgets-edit'

    const cleanType = widgetType
        .split('.')
        .pop()
        .replace(/[^a-zA-Z0-9]+/g, '-')
        .replace(/([a-z0-9])([A-Z])/g, '$1-$2')
        .toLowerCase()
        .replace(/^-+|-+$/g, '')

    return cleanType ? `widget-${cleanType}` : 'widgets-edit'
}

export const getHelpIndexPath = () => '/help/how-to'

export const getHelpSectionPath = (sectionId) => `/help/how-to/section/${sectionId}`

export const getHelpGuidePath = (guideId) => `/help/how-to/${guideId}`
