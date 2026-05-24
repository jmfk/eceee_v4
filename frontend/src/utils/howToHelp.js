const YOUTUBE_ID_PATTERN = /^[a-zA-Z0-9_-]{11}$/

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
