export const ACTION_DEFINITIONS = [
    {
        type: 'goto',
        label: 'Go to page',
        hint: 'Start with the exact screen the viewer needs.',
        fields: ['path', 'cutFromVideo', 'holdMs', 'cursorX', 'cursorY']
    },
    {
        type: 'click',
        label: 'Click',
        hint: 'Use one stable target and say why the click matters.',
        fields: ['targetMode', 'selector', 'text', 'label', 'placeholder', 'role', 'name', 'exact', 'cutFromVideo', 'holdMs', 'mockOnly']
    },
    {
        type: 'fill',
        label: 'Fill field',
        hint: 'Use realistic demo text that makes the result obvious.',
        fields: ['targetMode', 'selector', 'text', 'label', 'placeholder', 'role', 'name', 'exact', 'value', 'holdMs', 'typingLabel', 'delayMs']
    },
    {
        type: 'select',
        label: 'Select option',
        hint: 'Name the option and why this choice is safe.',
        fields: ['targetMode', 'selector', 'text', 'label', 'placeholder', 'role', 'name', 'exact', 'value', 'holdMs']
    },
    {
        type: 'waitForText',
        label: 'Wait for text',
        hint: 'Confirm that the UI reached the expected state.',
        fields: ['text', 'exact', 'timeout', 'cutFromVideo', 'holdMs']
    },
    {
        type: 'caption',
        label: 'Caption only',
        hint: 'Use a short pause for orientation or a transition.',
        fields: ['ms']
    },
    {
        type: 'pause',
        label: 'Pause',
        hint: 'Add breathing room after a visible change.',
        fields: ['ms']
    },
    {
        type: 'reload',
        label: 'Reload',
        hint: 'Use when the walkthrough needs a fresh state.',
        fields: ['cutFromVideo', 'holdMs', 'cursorX', 'cursorY']
    }
]

export const ACTION_TYPES = ACTION_DEFINITIONS.map(definition => definition.type)

export const TARGET_MODES = [
    { key: 'selector', label: 'CSS selector' },
    { key: 'text', label: 'Text' },
    { key: 'label', label: 'Label' },
    { key: 'placeholder', label: 'Placeholder' },
    { key: 'role', label: 'Role + name' },
    { key: 'advanced', label: 'Advanced action' }
]

export const ACTIONABLE_ACTION_TYPES = new Set(['click', 'fill', 'select'])

export const VIDEO_LANGUAGE_OPTIONS = [
    { code: 'sv', label: 'Swedish' },
    { code: 'en', label: 'English' }
]

export const DEFAULT_VIDEO_LANGUAGES = ['sv']

const NUMBER_FIELDS = new Set(['holdMs', 'ms', 'timeout', 'cursorX', 'cursorY', 'delayMs'])
const BOOLEAN_FIELDS = new Set(['exact', 'mockOnly', 'cutFromVideo'])
const TARGET_FIELDS = new Set(['selector', 'text', 'label', 'placeholder', 'role', 'name'])
const ADVANCED_ACTION_FIELDS = new Set([
    'pageTreeAddChildForText',
    'rowText',
    'rowSelector',
    'rowActionSelector',
    'exactRowText',
    'selectors'
])

const textValue = (value) => {
    if (value === undefined || value === null) return ''
    if (typeof value === 'string') return value
    if (typeof value === 'number' || typeof value === 'boolean') return String(value)
    if (typeof value === 'object') {
        return textValue(value.caption ?? value.text ?? value.webText ?? value.label ?? '')
    }

    return ''
}

const trimString = value => textValue(value).trim()
const stableUuidFromSeed = (seed = '') => {
    const source = trimString(seed) || 'how-to-guide'
    let hash = 0x811c9dc5

    for (let index = 0; index < source.length; index += 1) {
        hash ^= source.charCodeAt(index)
        hash = Math.imul(hash, 0x01000193)
    }

    const hex = (hash >>> 0).toString(16).padStart(8, '0')
    return `${hex}-${hex.slice(0, 4)}-4${hex.slice(5, 8)}-8${hex.slice(1, 4)}-${hex}${hex.slice(0, 4)}`
}
const hasActionValue = value => Array.isArray(value)
    ? value.length > 0
    : value !== undefined && value !== null && value !== ''

const languageSuffix = (language = '') => {
    const normalized = language.toString().trim().toLowerCase()
    return normalized ? `${normalized.charAt(0).toUpperCase()}${normalized.slice(1)}` : ''
}

const safePathSegment = (value, fallback) => String(value || fallback)
    .trim()
    .replace(/[^a-z0-9_-]+/gi, '-')
    .replace(/^-+|-+$/g, '')
    || fallback

const normalizeVideoLanguages = (value) => {
    const languages = Array.isArray(value)
        ? value
        : typeof value === 'string'
        ? value.split(',')
        : []
    const validLanguages = VIDEO_LANGUAGE_OPTIONS.map(option => option.code)
    const normalized = [...new Set(languages
        .map(language => language.toString().trim().toLowerCase())
        .filter(language => validLanguages.includes(language)))]

    return normalized.length > 0 ? normalized : DEFAULT_VIDEO_LANGUAGES
}

const getGuideVideoLanguages = (guide = {}) => normalizeVideoLanguages([
    ...(Array.isArray(guide.videoLanguages) ? guide.videoLanguages : String(guide.videoLanguages || '').split(',')),
    ...(guide.videoLanguage ? [guide.videoLanguage] : []),
    ...(Array.isArray(guide.videoSources) ? guide.videoSources.map(source => source.language).filter(Boolean) : [])
])

const createVideoLinks = (guide = {}, languages = DEFAULT_VIDEO_LANGUAGES) => {
    const linksByLanguage = {}

    languages.forEach(language => {
        const suffix = languageSuffix(language)
        const source = Array.isArray(guide.videoSources)
            ? guide.videoSources.find(candidate => candidate.language === language)
            : null

        linksByLanguage[language] = {
            videoUrl: source?.videoUrl || source?.mp4Url || guide[`videoUrl${suffix}`] || guide[`mp4Url${suffix}`] || '',
            captionsUrl: source?.captionsUrl || source?.subtitlesUrl || guide[`captionsUrl${suffix}`] || guide[`subtitlesUrl${suffix}`] || ''
        }
    })

    if (guide.videoLanguage || guide.videoUrl || guide.mp4Url || guide.captionsUrl || guide.subtitlesUrl) {
        const language = guide.videoLanguage || languages[0] || DEFAULT_VIDEO_LANGUAGES[0]
        linksByLanguage[language] = {
            videoUrl: guide.videoUrl || guide.mp4Url || linksByLanguage[language]?.videoUrl || '',
            captionsUrl: guide.captionsUrl || guide.subtitlesUrl || linksByLanguage[language]?.captionsUrl || ''
        }
    }

    return linksByLanguage
}

export const getPublishedVideoLinks = (draft = {}) => {
    const languages = normalizeVideoLanguages(draft.videoLanguages || draft.videoLanguage)
    const safeName = `${safePathSegment(draft.sectionId, 'editor')}-${safePathSegment(draft.id, 'guide')}`

    return languages.reduce((links, language) => ({
        ...links,
        [language]: {
            videoUrl: `/howto-videos/prod/${language}/${safeName}.mp4`,
            captionsUrl: `/howto-videos/prod/${language}/${safeName}.vtt`
        }
    }), {})
}

export const getActionDefinition = (type) => (
    ACTION_DEFINITIONS.find(definition => definition.type === type) || ACTION_DEFINITIONS[0]
)

export const getActionLabel = (type) => getActionDefinition(type).label

export const inferTargetMode = (action = {}) => {
    if ([...ADVANCED_ACTION_FIELDS].some(field => hasActionValue(action[field]))) return 'advanced'
    if (action.selector) return 'selector'
    if (action.label) return 'label'
    if (action.placeholder) return 'placeholder'
    if (action.role) return 'role'
    if (action.text) return 'text'
    return 'selector'
}

export const createAction = (type = 'click') => {
    const action = { type }

    if (['click', 'fill', 'select'].includes(type)) {
        action.targetMode = 'selector'
        action.selector = ''
    }

    if (type === 'goto') action.path = '/pages'
    if (type === 'fill') action.value = ''
    if (type === 'select') action.value = ''
    if (type === 'waitForText') action.text = ''
    if (type === 'waitForText') action.cutFromVideo = true
    if (type === 'caption') action.ms = 1200
    if (type === 'pause') action.ms = 1000

    action.holdMs = ''

    return action
}

export const normalizeAction = (action = {}) => {
    const type = ACTION_TYPES.includes(action.type) ? action.type : 'click'
    const definition = getActionDefinition(type)
    const normalized = { type }
    const targetMode = action.targetMode || inferTargetMode(action)

    definition.fields.forEach(field => {
        if (field === 'targetMode') {
            normalized.targetMode = targetMode
            return
        }

        if (TARGET_FIELDS.has(field) && field !== targetMode && !(targetMode === 'role' && field === 'name')) {
            return
        }

        if (action[field] === undefined || action[field] === null || action[field] === '') {
            if (field === targetMode || (targetMode === 'role' && field === 'name')) {
                normalized[field] = ''
            }
            return
        }

        if (NUMBER_FIELDS.has(field)) {
            const numberValue = Number(action[field])
            if (Number.isFinite(numberValue)) normalized[field] = numberValue
            return
        }

        if (BOOLEAN_FIELDS.has(field)) {
            normalized[field] = Boolean(action[field])
            return
        }

        normalized[field] = action[field]
    })

    if (targetMode === 'advanced') {
        ADVANCED_ACTION_FIELDS.forEach(field => {
            const value = action[field]
            if (!hasActionValue(value)) return
            normalized[field] = field === 'exactRowText' ? Boolean(value) : value
        })
    }

    return normalized
}

export const serializeAction = (action = {}) => {
    const normalized = normalizeAction(action)
    const serialized = {}

    Object.entries(normalized).forEach(([key, value]) => {
        if (key === 'targetMode') return
        if (value === '' || value === undefined || value === null) return
        if (BOOLEAN_FIELDS.has(key) && value === false) return
        serialized[key] = value
    })

    return serialized
}

const actionWithoutCaption = (action = {}) => {
    const { caption: _caption, ...rest } = action
    return rest
}

export const createScriptBlock = (type = 'click') => ({
    caption: '',
    action: type ? createAction(type) : null
})

export const normalizeScriptBlock = (block = {}, fallbackCaption = '') => {
    const actionSource = block.action === null
        ? null
        : block.action && typeof block.action === 'object'
        ? block.action
        : block
    const caption = trimString(block.caption ?? actionSource?.caption ?? fallbackCaption ?? '')

    return {
        caption,
        action: actionSource?.type ? normalizeAction(actionWithoutCaption(actionSource)) : null
    }
}

const legacyActionsToScript = (guide = {}) => {
    const actions = Array.isArray(guide.actions) ? guide.actions : []
    const steps = Array.isArray(guide.steps) ? guide.steps : []

    if (actions.length > 0) {
        return actions.map((action, index) => normalizeScriptBlock(
            { caption: action.caption || steps[index] || '', action },
            steps[index]
        ))
    }

    if (steps.length > 0) {
        return steps.map(step => ({
            caption: step,
            action: null
        }))
    }

    return [createScriptBlock('goto')]
}

export const guideToScriptDraft = (guide, section) => {
    const videoLanguages = getGuideVideoLanguages(guide)

    return {
        id: guide?.id || '',
        uuid: guide?.uuid || guide?.guideUuid || stableUuidFromSeed(guide?.id || guide?.title || ''),
        sourcePath: guide?.sourcePath || '',
        title: guide?.title || '',
        summary: guide?.summary || '',
        order: Number.isFinite(Number(guide?.order)) ? Number(guide.order) : 999,
        language: guide?.language || 'en',
        sourceLanguage: guide?.sourceLanguage || '',
        translationOf: guide?.translationOf || '',
        sectionId: section?.id || guide?.sectionId || '',
        sectionTitle: section?.title || guide?.sectionTitle || '',
        sectionSummary: section?.summary || guide?.sectionSummary || '',
        sectionOrder: Number.isFinite(Number(section?.order)) ? Number(section.order) : 999,
        videoUrl: guide?.videoUrl || '',
        mp4Url: guide?.mp4Url || '',
        captionsUrl: guide?.captionsUrl || '',
        subtitlesUrl: guide?.subtitlesUrl || '',
        videoLanguage: guide?.videoLanguage || videoLanguages[0] || '',
        videoLanguages,
        videoLinks: createVideoLinks(guide, videoLanguages),
        youtubeId: guide?.youtubeId || '',
        youtubeUrl: guide?.youtubeUrl || '',
        script: Array.isArray(guide?.script) && guide.script.length > 0
            ? guide.script.map(normalizeScriptBlock)
            : legacyActionsToScript(guide)
    }
}

export const normalizeScriptDraft = (draft = {}, guide, section) => {
    const fallback = guideToScriptDraft(guide, section)

    return {
        ...fallback,
        ...draft,
        script: Array.isArray(draft.script) && draft.script.length > 0
            ? draft.script.map(normalizeScriptBlock)
            : legacyActionsToScript(draft)
    }
}

const frontmatterLine = (key, value) => {
    const normalized = trimString(value)
    return normalized === '' || normalized === undefined || normalized === null ? '' : `${key}: ${normalized}`
}

export const createMarkdownFromDraft = (draft) => {
    const videoLanguages = normalizeVideoLanguages(draft.videoLanguages || draft.videoLanguage)
    const videoLinkLines = videoLanguages.flatMap(language => {
        const suffix = languageSuffix(language)
        const links = draft.videoLinks?.[language] || {}

        return [
            frontmatterLine(`mp4Url${suffix}`, links.videoUrl),
            frontmatterLine(`captionsUrl${suffix}`, links.captionsUrl)
        ]
    })
    const frontmatter = [
        '---',
        frontmatterLine('id', draft.id),
        frontmatterLine('uuid', draft.uuid || stableUuidFromSeed(draft.id || draft.title || '')),
        frontmatterLine('title', draft.title),
        frontmatterLine('summary', draft.summary),
        frontmatterLine('order', draft.order),
        frontmatterLine('language', draft.language || 'en'),
        frontmatterLine('sourceLanguage', draft.sourceLanguage),
        frontmatterLine('translationOf', draft.translationOf),
        frontmatterLine('sectionId', draft.sectionId),
        frontmatterLine('sectionTitle', draft.sectionTitle),
        frontmatterLine('sectionSummary', draft.sectionSummary),
        frontmatterLine('sectionOrder', draft.sectionOrder),
        frontmatterLine('videoUrl', draft.videoUrl),
        frontmatterLine('mp4Url', draft.mp4Url),
        frontmatterLine('captionsUrl', draft.captionsUrl),
        frontmatterLine('subtitlesUrl', draft.subtitlesUrl),
        frontmatterLine('videoLanguage', videoLanguages[0]),
        frontmatterLine('videoLanguages', videoLanguages.join(',')),
        ...videoLinkLines,
        frontmatterLine('youtubeId', draft.youtubeId),
        frontmatterLine('youtubeUrl', draft.youtubeUrl),
        '---'
    ].filter(Boolean)

    const script = (draft.script || []).map(normalizeScriptBlock)
    const steps = script
        .map(block => trimString(block.caption))
        .filter(Boolean)
        .map((step, index) => `${index + 1}. ${step}`)
    const scriptJson = JSON.stringify(script
        .map(block => ({
            caption: trimString(block.caption),
            action: block.action ? serializeAction(block.action) : null
        }))
        .filter(block => block.caption || block.action), null, 2)

    return [
        frontmatter.join('\n'),
        '',
        `# ${trimString(draft.title) || trimString(draft.id) || 'Untitled guide'}`,
        '',
        trimString(draft.summary),
        '',
        steps.join('\n'),
        steps.length ? '' : null,
        '```video-script',
        scriptJson,
        '```'
    ]
        .filter(part => part !== null && part !== undefined)
        .join('\n')
        .replace(/\n{4,}/g, '\n\n\n')
        .trimEnd()
        .concat('\n')
}

export const validateScriptDraft = (draft) => {
    const issues = []
    const script = Array.isArray(draft.script) ? draft.script.map(normalizeScriptBlock) : []
    const actionableCount = script.filter(block => ACTIONABLE_ACTION_TYPES.has(block.action?.type)).length

    if (!trimString(draft.title)) issues.push({ level: 'error', message: 'Title is missing.' })
    if (!trimString(draft.summary)) issues.push({ level: 'warning', message: 'Summary is missing.' })
    if (script.length === 0) issues.push({ level: 'error', message: 'Add at least one script block.' })
    if (actionableCount === 0) issues.push({ level: 'warning', message: 'Add a click, fill, or select action for recordable walkthroughs.' })

    script.forEach((block, index) => {
        const number = index + 1
        if (!trimString(block.caption) && !block.action) {
            issues.push({ level: 'error', message: `Block ${number}: add a caption, an action, or both.` })
        }

        if (!block.action) return

        const normalized = normalizeAction(block.action)

        if (normalized.type === 'goto' && !trimString(normalized.path)) {
            issues.push({ level: 'error', message: `Block ${number}: path is missing.` })
        }

        if (['click', 'fill', 'select'].includes(normalized.type)) {
            const targetMode = normalized.targetMode || inferTargetMode(normalized)
            const hasTarget = targetMode === 'advanced'
                ? [...ADVANCED_ACTION_FIELDS].some(field => hasActionValue(normalized[field]))
                : targetMode === 'role'
                ? trimString(normalized.role) && trimString(normalized.name)
                : trimString(normalized[targetMode])

            if (!hasTarget) issues.push({ level: 'error', message: `Block ${number}: target is missing.` })
        }

        if (normalized.type === 'fill' && !trimString(normalized.value)) {
            issues.push({ level: 'warning', message: `Block ${number}: fill value is empty.` })
        }

        if (normalized.type === 'select' && !trimString(normalized.value)) {
            issues.push({ level: 'warning', message: `Block ${number}: selected value is empty.` })
        }

        if (normalized.type === 'waitForText' && !trimString(normalized.text)) {
            issues.push({ level: 'error', message: `Block ${number}: wait text is missing.` })
        }
    })

    return issues
}
