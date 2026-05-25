import { useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import {
    ArrowDown,
    ArrowUp,
    Bot,
    CheckCircle2,
    Copy,
    Download,
    Eye,
    FileText,
    Film,
    Maximize2,
    Minimize2,
    Plus,
    RotateCcw,
    Save,
    Trash2,
    UploadCloud,
    X
} from 'lucide-react'
import toast from 'react-hot-toast'
import HelpVideoPlayer from '../components/help/HelpVideoPlayer'
import { howToDocs } from '../data/howToDocs'
import {
    ACTION_DEFINITIONS,
    TARGET_MODES,
    VIDEO_LANGUAGE_OPTIONS,
    createAction,
    createMarkdownFromDraft,
    createScriptBlock,
    getActionDefinition,
    getPublishedVideoLinks,
    guideToScriptDraft,
    inferTargetMode,
    normalizeAction,
    normalizeScriptBlock,
    validateScriptDraft
} from '../utils/howToScriptEditor'
import { parseHowToMarkdown } from '../utils/howToMarkdown'
import { getHelpGuidePath, getHelpIndexPath } from '../utils/howToHelp'
import { getHelpText, localizeGuide, localizeSection } from '../utils/howToI18n'
import { useDocumentTitle } from '../hooks/useDocumentTitle'

const getGuideOptions = () => howToDocs.flatMap(section => (
    section.guides.map(guide => ({ section, guide }))
))

const getReadableSourcePath = (sourcePath = '') => sourcePath
    .replace(/^\.\.\//, 'frontend/src/')
    .replace(/^src\//, 'frontend/src/')

const DEFAULT_DEMO_SETTINGS = {
    baseUrl: 'http://localhost:3000',
    username: 'demo',
    password: 'demo'
}

const writeClipboardText = async (value) => {
    const textarea = document.createElement('textarea')
    textarea.value = value
    textarea.setAttribute('readonly', '')
    textarea.style.position = 'fixed'
    textarea.style.left = '-9999px'
    document.body.appendChild(textarea)
    textarea.select()

    const didCopy = document.execCommand('copy')
    document.body.removeChild(textarea)

    if (!didCopy) throw new Error('Clipboard copy failed')
}

const withWorkingLanguage = (draft = {}, language = 'en') => ({
    ...draft,
    language,
    videoLanguage: language,
    videoLanguages: [language],
    videoLinks: {
        ...(draft.videoLinks || {}),
        [language]: draft.videoLinks?.[language] || { videoUrl: '', captionsUrl: '' }
    }
})

const loadDraftForGuide = (option) => withWorkingLanguage(
    guideToScriptDraft(option?.guide, option?.section),
    option?.guide?.language || 'en'
)

const draftFromMarkdown = (source, sourcePath, language = 'en', fallbackId = '') => {
    const parsed = parseHowToMarkdown(source, fallbackId)
    const section = {
        id: parsed.sectionId,
        title: parsed.sectionTitle,
        summary: parsed.sectionSummary,
        order: parsed.sectionOrder
    }

    return withWorkingLanguage({
        ...guideToScriptDraft({
            ...parsed.guide,
            sourcePath,
            language: parsed.guide?.language || language
        }, section),
        language: parsed.guide?.language || language
    }, parsed.guide?.language || language)
}

const getDraftSteps = (draft = {}) => (draft.script || [])
    .map(block => block.caption?.trim())
    .filter(Boolean)

const getDraftVideoSources = (draft = {}) => Object.entries(draft.videoLinks || {})
    .map(([language, links]) => ({
        language,
        videoUrl: links.videoUrl || '',
        captionsUrl: links.captionsUrl || ''
    }))
    .filter(source => source.videoUrl || source.captionsUrl)

const removeCacheBuster = (value = '') => value.split('?')[0] || ''

const mergeVideosByLanguage = (currentVideos = [], nextVideos = []) => {
    const videosByLanguage = new Map()

    currentVideos.forEach(video => {
        if (video?.language) videosByLanguage.set(video.language, video)
    })
    nextVideos.forEach(video => {
        if (video?.language) videosByLanguage.set(video.language, video)
    })

    return [...videosByLanguage.values()]
}

const FieldLabel = ({ children }) => (
    <label className="block text-xs font-semibold uppercase tracking-wide text-gray-500">{children}</label>
)

const TextInput = ({ label, value, onChange, placeholder = '', type = 'text', disabled = false }) => (
    <div>
        <FieldLabel>{label}</FieldLabel>
        <input
            type={type}
            value={value ?? ''}
            placeholder={placeholder}
            disabled={disabled}
            onChange={event => onChange(event.target.value)}
            className="mt-1 w-full rounded border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100 disabled:cursor-not-allowed disabled:bg-gray-100 disabled:text-gray-500"
        />
    </div>
)

const TextArea = ({ label, value, onChange, rows = 3, placeholder = '', disabled = false }) => (
    <div>
        <FieldLabel>{label}</FieldLabel>
        <textarea
            value={value ?? ''}
            placeholder={placeholder}
            disabled={disabled}
            onChange={event => onChange(event.target.value)}
            rows={rows}
            className="mt-1 w-full resize-y rounded border border-gray-200 bg-white px-3 py-2 text-sm leading-6 text-gray-900 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100 disabled:cursor-not-allowed disabled:bg-gray-100 disabled:text-gray-500"
        />
    </div>
)

const SelectInput = ({ label, value, onChange, children, disabled = false }) => (
    <div>
        <FieldLabel>{label}</FieldLabel>
        <select
            value={value ?? ''}
            disabled={disabled}
            onChange={event => onChange(event.target.value)}
            className="mt-1 w-full rounded border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100 disabled:cursor-not-allowed disabled:bg-gray-100 disabled:text-gray-500"
        >
            {children}
        </select>
    </div>
)

const CheckboxInput = ({ label, checked, onChange, disabled = false }) => (
    <label className={`mt-6 inline-flex items-center gap-2 text-sm ${disabled ? 'cursor-not-allowed text-gray-400' : 'text-gray-700'}`}>
        <input
            type="checkbox"
            checked={Boolean(checked)}
            disabled={disabled}
            onChange={event => onChange(event.target.checked)}
            className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
        />
        {label}
    </label>
)

const CodexHelpWriterPanel = ({
    prompt,
    onPromptChange,
    sectionId,
    onSectionChange,
    isGenerating,
    finalMessage,
    onGenerate
}) => (
    <section className="rounded border border-gray-200 bg-white p-3">
        <h2 className="flex items-center gap-2 px-1 text-sm font-semibold text-gray-900">
            <Bot className="h-4 w-4 text-blue-600" />
            Codex help writer
        </h2>
        <div className="mt-3 space-y-3">
            <TextArea
                label="Prompt"
                value={prompt}
                onChange={onPromptChange}
                rows={5}
                placeholder="Describe the help document Codex should create."
                disabled={isGenerating}
            />
            <SelectInput label="Section" value={sectionId} onChange={onSectionChange} disabled={isGenerating}>
                <option value="">Let Codex choose</option>
                {howToDocs.map(section => (
                    <option key={section.id} value={section.id}>{section.title}</option>
                ))}
            </SelectInput>
            <button
                type="button"
                onClick={onGenerate}
                disabled={isGenerating || !prompt.trim()}
                className="inline-flex w-full items-center justify-center gap-2 rounded bg-blue-600 px-3 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
            >
                <Bot className="h-4 w-4" />
                {isGenerating ? 'Codex is writing...' : 'Generate help document'}
            </button>
            {finalMessage && (
                <div className="rounded border border-blue-100 bg-blue-50 px-3 py-2 text-xs leading-5 text-blue-900">
                    {finalMessage}
                </div>
            )}
        </div>
    </section>
)

const ActionField = ({ field, action, onChange, disabled = false }) => {
    if (field === 'targetMode') {
        return (
            <SelectInput label="Target" value={action.targetMode || inferTargetMode(action)} onChange={value => onChange('targetMode', value)} disabled={disabled}>
                {TARGET_MODES.map(mode => <option key={mode.key} value={mode.key}>{mode.label}</option>)}
            </SelectInput>
        )
    }

    if (field === 'exact' || field === 'mockOnly' || field === 'cutFromVideo') {
        return (
            <CheckboxInput
                label={field === 'exact' ? 'Exact match' : field === 'cutFromVideo' ? 'Cut from video' : 'Mock only'}
                checked={action[field]}
                onChange={value => onChange(field, value)}
                disabled={disabled}
            />
        )
    }

    if (field === 'value') {
        return <TextArea label="Value" value={action[field] || ''} onChange={value => onChange(field, value)} rows={2} disabled={disabled} />
    }

    if (['holdMs', 'ms', 'timeout', 'cursorX', 'cursorY', 'delayMs'].includes(field)) {
        return <TextInput type="number" label={field} value={action[field] ?? ''} onChange={value => onChange(field, value)} disabled={disabled} />
    }

    return (
        <TextInput
            label={field}
            value={action[field] || ''}
            onChange={value => onChange(field, value)}
            placeholder={field === 'path' ? '/pages' : ''}
            disabled={disabled}
        />
    )
}

const ScriptBlockEditor = ({ block, index, total, onChange, onMove, onRemove, disabled = false }) => {
    const normalized = normalizeScriptBlock(block)
    const action = normalized.action
    const definition = action ? getActionDefinition(action.type) : null
    const fields = action ? definition.fields.filter(field => {
        const targetMode = action.targetMode || inferTargetMode(action)
        if (['selector', 'text', 'label', 'placeholder'].includes(field)) return field === targetMode
        if (field === 'role' || field === 'name') return targetMode === 'role'
        return true
    }) : []

    const updateAction = (updates) => {
        onChange({
            ...normalized,
            action: normalizeAction({ ...action, ...updates })
        })
    }

    return (
        <section className="rounded border border-gray-200 bg-white p-4">
            <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
                <div>
                    <div className="text-sm font-semibold text-gray-900">Block {index + 1}</div>
                    <div className="mt-1 text-sm text-gray-500">
                        Caption only, action only, or caption plus action.
                    </div>
                </div>
                <div className="flex items-center gap-1">
                    <button
                        type="button"
                        onClick={() => onMove(-1)}
                        disabled={disabled || index === 0}
                        className="inline-flex h-9 w-9 items-center justify-center rounded text-gray-500 hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-40"
                        aria-label={`Move block ${index + 1} up`}
                    >
                        <ArrowUp className="h-4 w-4" />
                    </button>
                    <button
                        type="button"
                        onClick={() => onMove(1)}
                        disabled={disabled || index === total - 1}
                        className="inline-flex h-9 w-9 items-center justify-center rounded text-gray-500 hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-40"
                        aria-label={`Move block ${index + 1} down`}
                    >
                        <ArrowDown className="h-4 w-4" />
                    </button>
                    <button
                        type="button"
                        onClick={onRemove}
                        disabled={disabled}
                        className="inline-flex h-9 w-9 items-center justify-center rounded text-gray-500 hover:bg-red-50 hover:text-red-700 disabled:cursor-not-allowed disabled:opacity-40"
                        aria-label={`Remove block ${index + 1}`}
                    >
                        <Trash2 className="h-4 w-4" />
                    </button>
                </div>
            </div>

            <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_360px]">
                <TextArea
                    label="Caption"
                    value={normalized.caption}
                    onChange={caption => onChange({ ...normalized, caption })}
                    rows={4}
                    placeholder="What should the video say here?"
                    disabled={disabled}
                />
                <div className="rounded border border-gray-100 bg-gray-50 p-3">
                    <div className="mb-3 flex items-center justify-between gap-3">
                        <FieldLabel>Action</FieldLabel>
                        <label className="inline-flex items-center gap-2 text-sm text-gray-700">
                            <input
                                type="checkbox"
                                checked={Boolean(action)}
                                disabled={disabled}
                                onChange={event => onChange({
                                    ...normalized,
                                    action: event.target.checked ? createAction('click') : null
                                })}
                                className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                            />
                            Use action
                        </label>
                    </div>

                    {action ? (
                        <div className="grid gap-3">
                            <SelectInput label="Type" value={action.type} onChange={type => onChange({ ...normalized, action: createAction(type) })} disabled={disabled}>
                                {ACTION_DEFINITIONS.map(candidate => (
                                    <option key={candidate.type} value={candidate.type}>{candidate.label}</option>
                                ))}
                            </SelectInput>
                            <div className="text-xs text-gray-500">{definition.hint}</div>
                            {(action.targetMode || inferTargetMode(action)) === 'advanced' && (
                                <div className="rounded border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
                                    This action uses advanced generator fields and will be preserved when saving.
                                </div>
                            )}
                            {fields.map(field => (
                                <ActionField
                                    key={field}
                                    field={field}
                                    action={action}
                                    onChange={(nextField, value) => updateAction({ [nextField]: value })}
                                    disabled={disabled}
                                />
                            ))}
                        </div>
                    ) : (
                        <p className="text-sm text-gray-500">No UI action in this block.</p>
                    )}
                </div>
            </div>
        </section>
    )
}

const VideoPlayer = ({ preview, size = 'compact' }) => {
    if (!preview?.videoUrl) return null

    return (
        <video
            className={`${size === 'large' ? 'aspect-video max-h-[72vh]' : 'mt-4 aspect-video'} w-full rounded border border-gray-200 bg-black object-contain`}
            controls
            src={preview.videoUrl}
        >
            {preview.subtitlesUrl && <track kind="captions" src={preview.subtitlesUrl} default />}
        </video>
    )
}

const ExpandedVideoPanel = ({ preview, expanded, onToggleExpanded }) => {
    if (!preview?.videoUrl || !expanded) return null

    return (
        <section className="rounded border border-gray-200 bg-white p-4">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
                <h2 className="text-base font-semibold text-gray-900">Preview video</h2>
                <button
                    type="button"
                    onClick={onToggleExpanded}
                    className="inline-flex items-center gap-2 rounded border border-gray-200 bg-white px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
                >
                    <Minimize2 className="h-4 w-4" />
                    Collapse
                </button>
            </div>
            <VideoPlayer preview={preview} size="large" />
        </section>
    )
}

const ProgressLogDock = ({ log, error, isRunning, statusText = 'Running process...', doneText = 'Process complete', isOpen, onClose }) => {
    const logRef = useRef(null)

    useEffect(() => {
        if (!logRef.current) return
        logRef.current.scrollTop = logRef.current.scrollHeight
    }, [log])

    if (!isOpen || (!log && !isRunning && !error)) return null

    return (
        <section className="fixed inset-x-0 bottom-0 z-40 border-t border-gray-700 bg-gray-950 text-gray-100 shadow-2xl">
            <div className="flex items-center justify-between gap-3 border-b border-gray-800 px-4 py-2">
                <div>
                    <h2 className="text-sm font-semibold text-white">Process log</h2>
                    <div className="text-xs text-gray-400">{isRunning ? statusText : error ? 'Process failed' : doneText}</div>
                </div>
                {!isRunning && (
                    <button
                        type="button"
                        onClick={onClose}
                        className="inline-flex h-8 w-8 items-center justify-center rounded text-gray-300 hover:bg-gray-800 hover:text-white"
                        aria-label="Close process log"
                    >
                        <X className="h-4 w-4" />
                    </button>
                )}
            </div>
            <pre
                ref={logRef}
                className="h-[34vh] w-full overflow-auto whitespace-pre-wrap px-4 py-3 font-mono text-xs leading-5 text-gray-100"
            >
                {log || (isRunning ? 'Waiting for process output...' : '')}
                {error ? `\n\nERROR: ${error}` : ''}
            </pre>
        </section>
    )
}

const VideoLinksEditor = ({ languages = [], links = {}, onChange, disabled = false }) => (
    <div className="space-y-3">
        {languages.map(language => (
            <div key={language} className="rounded border border-gray-100 bg-gray-50 p-3">
                <div className="mb-2 text-sm font-semibold uppercase text-gray-600">{language}</div>
                <div className="grid gap-3 md:grid-cols-2">
                    <TextInput
                        label="MP4 URL"
                        value={links[language]?.videoUrl || ''}
                        onChange={videoUrl => onChange(language, { ...(links[language] || {}), videoUrl })}
                        placeholder={`/howto-videos/prod/${language}/section-guide.mp4`}
                        disabled={disabled}
                    />
                    <TextInput
                        label="Captions URL"
                        value={links[language]?.captionsUrl || ''}
                        onChange={captionsUrl => onChange(language, { ...(links[language] || {}), captionsUrl })}
                        placeholder={`/howto-videos/prod/${language}/section-guide.vtt`}
                        disabled={disabled}
                    />
                </div>
            </div>
        ))}
    </div>
)

const FinishedPagePreview = ({ draft, language }) => {
    const section = {
        id: draft.sectionId,
        title: draft.sectionTitle,
        summary: draft.sectionSummary
    }
    const guide = {
        ...draft,
        steps: getDraftSteps(draft),
        narration: draft.summary,
        videoSources: getDraftVideoSources(draft),
        section
    }
    const draftLanguage = draft.language || 'en'
    const shouldLocalize = language !== draftLanguage
    const localizedSection = shouldLocalize ? localizeSection(section, language) : section
    const localizedGuide = shouldLocalize ? localizeGuide(guide, language) : guide
    const currentVideo = draft.videoLinks?.[language] || {}
    const text = getHelpText(language)

    return (
        <section className="rounded border border-gray-200 bg-white p-4">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                <div>
                    <h2 className="flex items-center gap-2 text-base font-semibold text-gray-900">
                        <Eye className="h-4 w-4 text-blue-600" />
                        Finished page preview
                    </h2>
                    <p className="mt-1 text-sm text-gray-500">Review the help page for the current working language before publishing.</p>
                </div>
                <span className="rounded border border-blue-100 bg-blue-50 px-3 py-2 text-sm font-semibold uppercase text-blue-800">
                    {language}
                </span>
            </div>

            <article className="rounded border border-gray-200 bg-gray-50 p-5 sm:p-6">
                <div className="mb-4 flex flex-wrap items-center gap-2 text-sm text-gray-500">
                    <span className="font-medium text-blue-600">{localizedSection.title || draft.sectionId}</span>
                    <span>/</span>
                    <span>{localizedGuide.title}</span>
                </div>

                <h1 className="text-2xl font-bold text-gray-900">{localizedGuide.title}</h1>
                {localizedGuide.summary && <p className="mt-2 max-w-3xl text-gray-600">{localizedGuide.summary}</p>}

                <div className="mt-5">
                    <HelpVideoPlayer
                        videoUrl={currentVideo.videoUrl}
                        captionsUrl={currentVideo.captionsUrl}
                        videoSources={currentVideo.videoUrl ? [{ videoUrl: currentVideo.videoUrl, captionsUrl: currentVideo.captionsUrl }] : []}
                        language={language}
                        youtubeId={draft.youtubeId}
                        youtubeUrl={draft.youtubeUrl}
                        title={`${localizedGuide.title} video`}
                    />
                </div>

                <ol className="mt-6 space-y-3 text-sm text-gray-700">
                    {(localizedGuide.steps || []).map((step, index) => (
                        <li key={`${step}-${index}`} className="flex gap-3">
                            <span className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-blue-50 text-xs font-semibold text-blue-600 ring-1 ring-blue-100">
                                {index + 1}
                            </span>
                            <span>{step}</span>
                        </li>
                    ))}
                </ol>

                {localizedGuide.narration && (
                    <div className="mt-6 rounded border border-gray-200 bg-white p-4">
                        <div className="text-sm font-semibold text-gray-900">{text.videoScriptNote}</div>
                        <p className="mt-1 text-sm text-gray-600">{localizedGuide.narration}</p>
                    </div>
                )}
            </article>
        </section>
    )
}

const QualityPanel = ({
    draft,
    issues,
    preview,
    displayPreview,
    isRendering,
    isTranslating,
    isPublishing,
    activeLanguage,
    onLanguageSwitch,
    onGenerateTranslation,
    withVoice,
    onVoiceChange,
    onRender,
    onPublish,
    demoSettings,
    onDemoSettingsChange,
    isVideoExpanded,
    onToggleVideoExpanded
}) => {
    const script = draft.script || []
    const captions = script.filter(block => block.caption?.trim()).length
    const actions = script.filter(block => block.action).length
    const both = script.filter(block => block.caption?.trim() && block.action).length
    const hasErrors = issues.some(issue => issue.level === 'error')

    return (
        <aside className="space-y-4">
            <section className="rounded border border-gray-200 bg-white p-4">
                <h2 className="text-base font-semibold text-gray-900">Working language</h2>
                <p className="mt-2 text-sm text-gray-600">
                    This controls the editor, sequential script, preview page, video, and voice.
                </p>
                <SelectInput
                    label="Language"
                    value={activeLanguage}
                    onChange={onLanguageSwitch}
                    disabled={isRendering || isTranslating}
                >
                    {VIDEO_LANGUAGE_OPTIONS.map(option => (
                        <option key={option.code} value={option.code}>{option.label}</option>
                    ))}
                </SelectInput>
                {activeLanguage === 'sv' && (
                    <button
                        type="button"
                        onClick={() => onGenerateTranslation('sv')}
                        disabled={isRendering || isTranslating}
                        className="mt-3 inline-flex w-full items-center justify-center gap-2 rounded border border-gray-200 bg-white px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                        <Bot className="h-4 w-4" />
                        {isTranslating ? 'Translating...' : 'Re-translate Swedish'}
                    </button>
                )}
                <div className="mt-3 rounded bg-gray-50 px-3 py-2 text-xs text-gray-600">
                    Preview and voice language: <span className="font-semibold uppercase">{activeLanguage}</span>
                </div>
            </section>

            <section className="rounded border border-gray-200 bg-white p-4">
                <h2 className="text-base font-semibold text-gray-900">Kontroll</h2>
                <dl className="mt-4 grid grid-cols-3 gap-2 text-center">
                    <div className="rounded bg-gray-50 p-3">
                        <dt className="text-xs text-gray-500">Block</dt>
                        <dd className="text-lg font-semibold text-gray-900">{script.length}</dd>
                    </div>
                    <div className="rounded bg-gray-50 p-3">
                        <dt className="text-xs text-gray-500">Caption</dt>
                        <dd className="text-lg font-semibold text-gray-900">{captions}</dd>
                    </div>
                    <div className="rounded bg-gray-50 p-3">
                        <dt className="text-xs text-gray-500">Action</dt>
                        <dd className="text-lg font-semibold text-gray-900">{actions}</dd>
                    </div>
                </dl>
                <div className="mt-3 rounded bg-gray-50 px-3 py-2 text-sm text-gray-600">
                    {both} block{both === 1 ? '' : 's'} contain both caption and action.
                </div>
                <div className="mt-4 space-y-2">
                    {issues.length === 0 ? (
                        <div className="flex items-center gap-2 rounded bg-green-50 px-3 py-2 text-sm text-green-800">
                            <CheckCircle2 className="h-4 w-4" />
                            Ser redo ut
                        </div>
                    ) : issues.map((issue, index) => (
                        <div
                            key={`${issue.message}-${index}`}
                            className={`rounded px-3 py-2 text-sm ${issue.level === 'error' ? 'bg-red-50 text-red-800' : 'bg-amber-50 text-amber-800'}`}
                        >
                            {issue.message}
                        </div>
                    ))}
                </div>
            </section>

            <section className="rounded border border-gray-200 bg-white p-4">
                <h2 className="text-base font-semibold text-gray-900">Film</h2>
                <div className="mt-3 grid gap-3">
                    <TextInput
                        label="Demo base URL"
                        value={demoSettings.baseUrl}
                        onChange={baseUrl => onDemoSettingsChange({ ...demoSettings, baseUrl })}
                        placeholder="http://localhost:3000"
                        disabled={isRendering}
                    />
                    <div className="grid grid-cols-2 gap-3">
                        <TextInput
                            label="Username"
                            value={demoSettings.username}
                            onChange={username => onDemoSettingsChange({ ...demoSettings, username })}
                            placeholder="demo"
                            disabled={isRendering}
                        />
                        <TextInput
                            label="Password"
                            type="password"
                            value={demoSettings.password}
                            onChange={password => onDemoSettingsChange({ ...demoSettings, password })}
                            placeholder="demo"
                            disabled={isRendering}
                        />
                    </div>
                </div>
                <label className={`mt-3 inline-flex items-center gap-2 text-sm ${isRendering ? 'cursor-not-allowed text-gray-400' : 'text-gray-700'}`}>
                    <input
                        type="checkbox"
                        checked={withVoice}
                        disabled={isRendering}
                        onChange={event => onVoiceChange(event.target.checked)}
                        className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                    />
                    Generate voice track
                </label>
                <button
                    type="button"
                    onClick={onRender}
                    disabled={isRendering}
                    className="mt-3 inline-flex w-full items-center justify-center gap-2 rounded bg-blue-600 px-3 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
                >
                    <Film className="h-4 w-4" />
                    {isRendering ? 'Creating video...' : `Create ${activeLanguage.toUpperCase()} preview video`}
                </button>
                <VideoPlayer preview={displayPreview} />
                {!preview?.videoUrl && displayPreview?.videoUrl && (
                    <div className="mt-2 rounded bg-gray-50 px-3 py-2 text-xs text-gray-600">
                        Showing the saved {activeLanguage.toUpperCase()} video from this markdown file.
                    </div>
                )}
                {displayPreview?.videoUrl && (
                    <button
                        type="button"
                        onClick={onToggleVideoExpanded}
                        className="mt-3 inline-flex w-full items-center justify-center gap-2 rounded border border-gray-200 bg-white px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
                    >
                        {isVideoExpanded ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
                        {isVideoExpanded ? 'Collapse large preview' : 'Expand large preview'}
                    </button>
                )}
                {preview?.error && (
                    <div className="mt-3 rounded bg-red-50 px-3 py-2 text-sm text-red-800">{preview.error}</div>
                )}
            </section>

            <section className="rounded border border-gray-200 bg-white p-4">
                <h2 className="text-base font-semibold text-gray-900">Publish</h2>
                <p className="mt-2 text-sm text-gray-600">
                    Writes the reviewed markdown and copies the preview videos to the public help video folder.
                </p>
                <button
                    type="button"
                    onClick={onPublish}
                    disabled={isRendering || isPublishing || hasErrors}
                    className="mt-3 inline-flex w-full items-center justify-center gap-2 rounded bg-green-700 px-3 py-2 text-sm font-medium text-white hover:bg-green-800 disabled:cursor-not-allowed disabled:opacity-60"
                >
                    <UploadCloud className="h-4 w-4" />
                    {isPublishing ? 'Publishing...' : 'Publish reviewed page'}
                </button>
            </section>
        </aside>
    )
}

const HowToScriptEditorPage = () => {
    useDocumentTitle('Video Script Editor')

    const guideOptions = useMemo(getGuideOptions, [])
    const firstGuide = guideOptions[0]
    const [openDrafts, setOpenDrafts] = useState(() => firstGuide ? [loadDraftForGuide(firstGuide)] : [])
    const [activeDraftId, setActiveDraftId] = useState(firstGuide?.guide?.id || '')
    const [withVoice, setWithVoice] = useState(true)
    const [isRendering, setIsRendering] = useState(false)
    const [previewById, setPreviewById] = useState({})
    const [expandedVideoById, setExpandedVideoById] = useState({})
    const [closedLogById, setClosedLogById] = useState({})
    const [demoSettings, setDemoSettings] = useState(DEFAULT_DEMO_SETTINGS)
    const [isPublishing, setIsPublishing] = useState(false)
    const [isGeneratingDoc, setIsGeneratingDoc] = useState(false)
    const [codexPrompt, setCodexPrompt] = useState('')
    const [codexSectionId, setCodexSectionId] = useState(firstGuide?.section?.id || '')
    const [codexRun, setCodexRun] = useState({ log: '', error: '', finalMessage: '' })
    const [isCodexLogClosed, setIsCodexLogClosed] = useState(false)
    const [isTranslating, setIsTranslating] = useState(false)
    const [translationRun, setTranslationRun] = useState({ log: '', error: '' })
    const [isTranslationLogClosed, setIsTranslationLogClosed] = useState(false)
    const [undoInfo, setUndoInfo] = useState(null)
    const [processLogSource, setProcessLogSource] = useState('video')

    const activeDraft = openDrafts.find(draft => draft.id === activeDraftId) || openDrafts[0]
    const activeDraftLanguage = activeDraft?.language || 'en'
    const issues = useMemo(() => activeDraft ? validateScriptDraft(activeDraft) : [], [activeDraft])
    const markdown = useMemo(() => activeDraft ? createMarkdownFromDraft(activeDraft) : '', [activeDraft])
    const readableSourcePath = getReadableSourcePath(activeDraft?.sourcePath)
    const preview = activeDraft ? previewById[activeDraft.id] : null
    const languagePreview = preview?.language === activeDraftLanguage ? preview : null
    const storedVideoLink = activeDraft?.videoLinks?.[activeDraftLanguage] || {}
    const storedPreview = storedVideoLink.videoUrl ? {
        videoUrl: storedVideoLink.videoUrl,
        subtitlesUrl: storedVideoLink.captionsUrl || '',
        captionsUrl: storedVideoLink.captionsUrl || '',
        language: activeDraftLanguage,
        videos: [{
            language: activeDraftLanguage,
            videoUrl: storedVideoLink.videoUrl,
            captionsUrl: storedVideoLink.captionsUrl || ''
        }]
    } : null
    const displayPreview = languagePreview?.videoUrl
        ? languagePreview
        : storedPreview
        ? {
            ...storedPreview,
            ...(languagePreview || {}),
            videoUrl: languagePreview?.videoUrl || storedPreview.videoUrl,
            subtitlesUrl: languagePreview?.subtitlesUrl || storedPreview.subtitlesUrl,
            captionsUrl: languagePreview?.captionsUrl || storedPreview.captionsUrl,
            videos: languagePreview?.videos?.length ? languagePreview.videos : storedPreview.videos
        }
        : languagePreview
    const isVideoExpanded = activeDraft ? Boolean(expandedVideoById[activeDraft.id]) : false
    const isVideoLogOpen = activeDraft ? isRendering || (Boolean(preview?.log || preview?.error) && !closedLogById[activeDraft.id]) : false
    const isCodexLogOpen = isGeneratingDoc || (Boolean(codexRun.log || codexRun.error) && !isCodexLogClosed)
    const isTranslationLogOpen = isTranslating || (Boolean(translationRun.log || translationRun.error) && !isTranslationLogClosed)
    const isLogOpen = processLogSource === 'codex'
        ? isCodexLogOpen
        : processLogSource === 'translation'
        ? isTranslationLogOpen
        : isVideoLogOpen
    const processLog = processLogSource === 'codex'
        ? codexRun.log
        : processLogSource === 'translation'
        ? translationRun.log
        : preview?.log || ''
    const processError = processLogSource === 'codex'
        ? codexRun.error
        : processLogSource === 'translation'
        ? translationRun.error
        : preview?.error || ''
    const isProcessRunning = processLogSource === 'codex'
        ? isGeneratingDoc
        : processLogSource === 'translation'
        ? isTranslating
        : isRendering
    const processStatusText = processLogSource === 'codex'
        ? 'Codex is writing a help document...'
        : processLogSource === 'translation'
        ? 'Translating markdown with Haiku...'
        : 'Rendering video...'
    const processDoneText = processLogSource === 'codex'
        ? 'Codex finished'
        : processLogSource === 'translation'
        ? 'Translation complete'
        : 'Render complete'
    const pagePreviewLanguage = activeDraftLanguage
    const renderLanguages = [activeDraftLanguage]

    useEffect(() => {
        if (!activeDraftId && openDrafts[0]) setActiveDraftId(openDrafts[0].id)
    }, [activeDraftId, openDrafts])

    useEffect(() => {
        if (!activeDraft?.id || !activeDraft.sectionId) return
        if (activeDraft.videoLinks?.[activeDraftLanguage]?.videoUrl) return

        let cancelled = false

        const loadGeneratedVideo = async () => {
            try {
                const response = await fetch('/__howto-script-editor/generated-video', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        guideId: activeDraft.id,
                        sectionId: activeDraft.sectionId,
                        language: activeDraftLanguage
                    })
                })
                const data = await response.json()

                if (cancelled || !response.ok || !data.exists) return

                const generatedVideo = {
                    language: activeDraftLanguage,
                    videoUrl: data.videoUrl,
                    captionsUrl: data.captionsUrl || ''
                }

                setPreviewById(current => ({
                    ...current,
                    [activeDraft.id]: current[activeDraft.id]?.videoUrl && current[activeDraft.id]?.language === activeDraftLanguage ? current[activeDraft.id] : {
                        ...(current[activeDraft.id] || {}),
                        videoUrl: generatedVideo.videoUrl,
                        subtitlesUrl: generatedVideo.captionsUrl,
                        captionsUrl: generatedVideo.captionsUrl,
                        language: activeDraftLanguage,
                        videos: [generatedVideo]
                    }
                }))
                setOpenDrafts(current => current.map(draft => (
                    draft.id === activeDraft.id
                        ? {
                            ...draft,
                            videoLinks: {
                                ...(draft.videoLinks || {}),
                                [activeDraftLanguage]: {
                                    videoUrl: generatedVideo.videoUrl,
                                    captionsUrl: generatedVideo.captionsUrl
                                }
                            }
                        }
                        : draft
                )))
            } catch {
                // Missing generated videos should not interrupt editing.
            }
        }

        loadGeneratedVideo()

        return () => {
            cancelled = true
        }
    }, [activeDraft?.id, activeDraft?.sectionId, activeDraft?.videoLinks, activeDraftLanguage])

    const updateDemoSettings = (settings) => {
        setDemoSettings(settings)
    }

    const updateActiveDraft = (updates) => {
        if (isRendering) return
        setOpenDrafts(current => current.map(draft => (
            draft.id === activeDraft.id ? { ...draft, ...updates } : draft
        )))
    }

    const updateDraftById = (draftId, updates) => {
        setOpenDrafts(current => current.map(draft => (
            draft.id === draftId ? { ...draft, ...updates } : draft
        )))
    }

    const updateScript = (script) => updateActiveDraft({ script: script.map(normalizeScriptBlock) })

    const openGuide = (option) => {
        if (isRendering) return
        const existing = openDrafts.find(draft => draft.id === option.guide.id)
        if (existing) {
            setActiveDraftId(existing.id)
            return
        }

        const draft = loadDraftForGuide(option)
        setOpenDrafts(current => [...current, draft])
        setActiveDraftId(draft.id)
    }

    const closeDraft = (draftId) => {
        if (isRendering) return
        setOpenDrafts(current => {
            const next = current.filter(draft => draft.id !== draftId)
            if (activeDraftId === draftId) setActiveDraftId(next[0]?.id || '')
            return next
        })
    }

    const addBlock = (type) => {
        if (isRendering) return
        updateScript([...(activeDraft.script || []), createScriptBlock(type)])
    }

    const moveBlock = (index, offset) => {
        if (isRendering) return
        const targetIndex = index + offset
        const script = [...(activeDraft.script || [])]
        if (targetIndex < 0 || targetIndex >= script.length) return
        const [item] = script.splice(index, 1)
        script.splice(targetIndex, 0, item)
        updateScript(script)
    }

    const resetDraft = () => {
        if (isRendering) return
        const option = guideOptions.find(candidate => candidate.guide.id === activeDraft.id)
        if (!option) return
        const next = guideToScriptDraft(option.guide, option.section)
        setOpenDrafts(current => current.map(draft => draft.id === activeDraft.id ? next : draft))
        toast.success('Utkast återställt')
    }

    const copyMarkdown = async () => {
        try {
            await writeClipboardText(markdown)
            toast.success('Markdown kopierad')
        } catch {
            toast.error('Kunde inte kopiera markdown')
        }
    }

    const downloadMarkdown = () => {
        const blob = new Blob([markdown], { type: 'text/markdown;charset=utf-8' })
        const url = URL.createObjectURL(blob)
        const link = document.createElement('a')
        link.href = url
        link.download = `${activeDraft.id || 'how-to-guide'}.md`
        link.click()
        URL.revokeObjectURL(url)
    }

    const saveDraftMarkdownToDisk = async (draft, markdownText, options = {}) => {
        const response = await fetch('/__howto-script-editor/save', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                guideId: draft.id,
                sectionId: draft.sectionId,
                sourcePath: draft.sourcePath,
                markdown: markdownText,
                requireExisting: options.requireExisting !== false,
                appendToUndoId: options.appendToUndoId || '',
                undoLabel: options.undoLabel || ''
            })
        })
        const data = await response.json()

        if (!response.ok) throw new Error(data.error || 'Could not save markdown')

        return data
    }

    const saveMarkdownToDisk = async () => {
        if (isRendering) return
        try {
            const data = await saveDraftMarkdownToDisk(activeDraft, markdown, { requireExisting: true })


            const nextSourcePath = data.sourcePath || activeDraft.sourcePath
            updateActiveDraft({ sourcePath: nextSourcePath })
            if (data.undo) setUndoInfo(data.undo)
            toast.success(`Overwrote ${getReadableSourcePath(nextSourcePath)}`)
        } catch (error) {
            toast.error(error.message)
        }
    }

    const reloadActiveDraftFromDisk = async () => {
        if (!activeDraft?.sourcePath) return

        const response = await fetch('/__howto-script-editor/open-source', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                guideId: activeDraft.id,
                sectionId: activeDraft.sectionId,
                sourcePath: activeDraft.sourcePath
            })
        })
        const data = await response.json()

        if (!response.ok) throw new Error(data.error || 'Could not reload markdown after undo')

        const nextDraft = draftFromMarkdown(data.markdown, data.sourcePath, activeDraftLanguage, activeDraft.id)
        replaceActiveDraft(withWorkingLanguage(nextDraft, nextDraft.language || activeDraftLanguage))
        setPreviewById(current => {
            const next = { ...current }
            delete next[activeDraft.id]
            return next
        })
    }

    const undoLastOverwrite = async () => {
        if (isRendering || isTranslating || isPublishing) return

        try {
            const response = await fetch('/__howto-script-editor/undo-overwrite', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({})
            })
            const data = await response.json()

            if (!response.ok) throw new Error(data.error || 'Could not undo overwrite')

            setUndoInfo(null)
            await reloadActiveDraftFromDisk().catch(() => {})
            toast.success(`Undid ${data.restored?.label || 'last overwrite'}`)
        } catch (error) {
            toast.error(error.message)
        }
    }

    const getOriginalDraft = (draft = activeDraft) => {
        const option = guideOptions.find(candidate => candidate.guide.id === draft?.id)
        return option ? loadDraftForGuide(option) : draft
    }

    const replaceActiveDraft = (nextDraft) => {
        setOpenDrafts(current => current.map(draft => (
            draft.id === activeDraft.id ? nextDraft : draft
        )))
    }

    const loadTranslatedDraft = async (language = 'sv') => {
        const response = await fetch('/__howto-script-editor/open-translation', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                guideId: activeDraft.id,
                sectionId: activeDraft.sectionId,
                language
            })
        })
        const data = await response.json()

        if (!response.ok) throw new Error(data.error || 'Could not open translated markdown')
        if (!data.exists) return null

        return draftFromMarkdown(data.markdown, data.sourcePath, language, activeDraft.id)
    }

    const switchDraftLanguage = async (language) => {
        if (!activeDraft || isRendering || isTranslating || language === activeDraftLanguage) return

        try {
            if (language === 'en') {
                const originalDraft = getOriginalDraft(activeDraft)
                replaceActiveDraft(withWorkingLanguage(originalDraft, 'en'))
                toast.success('Switched to English origin')
                return
            }

            const translatedDraft = await loadTranslatedDraft(language)

            if (!translatedDraft) {
                await generateTranslation(language, { force: false })
                return
            }

            replaceActiveDraft(withWorkingLanguage(translatedDraft, language))
            toast.success(`Opened ${language.toUpperCase()} markdown`)
        } catch (error) {
            toast.error(error.message)
        }
    }

    const generateTranslation = async (language = 'sv', options = {}) => {
        if (!activeDraft || isRendering || isTranslating) return

        const originalDraft = getOriginalDraft(activeDraft)
        const originalMarkdown = activeDraftLanguage === 'en'
            ? markdown
            : createMarkdownFromDraft({ ...originalDraft, language: 'en' })

        setProcessLogSource('translation')
        setIsTranslationLogClosed(false)
        setTranslationRun({ log: '', error: '' })

        try {
            const statusResponse = await fetch('/__howto-script-editor/translation-status', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    guideId: originalDraft.id,
                    sectionId: originalDraft.sectionId,
                    language
                })
            })
            const status = await statusResponse.json()

            if (!statusResponse.ok) throw new Error(status.error || 'Could not check translation status')
            if (status.exists && !options.force && !window.confirm(`A ${language.toUpperCase()} translation already exists at ${status.sourcePath}. Replace it with a new Haiku translation?`)) {
                return
            }

            setIsTranslating(true)

            const appendLog = (text) => {
                setTranslationRun(current => ({
                    ...current,
                    log: `${current.log || ''}${text}`
                }))
            }
            const response = await fetch('/__howto-script-editor/translate', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    guideId: originalDraft.id,
                    sectionId: originalDraft.sectionId,
                    language,
                    markdown: originalMarkdown,
                    overwrite: Boolean(status.exists || options.force)
                })
            })

            if (!response.ok || !response.body) {
                const data = await response.json().catch(() => ({}))
                throw new Error(data.error || 'Could not translate markdown')
            }

            const reader = response.body.getReader()
            const decoder = new TextDecoder()
            let buffer = ''
            let completed = false

            while (!completed) {
                const { value, done } = await reader.read()
                buffer += decoder.decode(value || new Uint8Array(), { stream: !done })
                const lines = buffer.split('\n')
                buffer = lines.pop() || ''

                for (const line of lines) {
                    if (!line.trim()) continue
                    const event = JSON.parse(line)

                    if (event.type === 'log') {
                        appendLog(event.text || '')
                    } else if (event.type === 'done') {
                        const translatedDraft = draftFromMarkdown(event.markdown, event.sourcePath, language, originalDraft.id)
                        replaceActiveDraft(withWorkingLanguage(translatedDraft, language))
                        if (event.undo) setUndoInfo(event.undo)
                        toast.success(`Saved ${language.toUpperCase()} translation`)
                    } else if (event.type === 'error') {
                        throw new Error(event.error || 'Could not translate markdown')
                    }
                }

                completed = done
            }

            if (buffer.trim()) {
                const event = JSON.parse(buffer)
                if (event.type === 'error') throw new Error(event.error || 'Could not translate markdown')
            }
        } catch (error) {
            setTranslationRun(current => ({ ...current, error: error.message }))
            toast.error(error.message)
        } finally {
            setIsTranslating(false)
        }
    }

    const publishReviewedGuide = async () => {
        if (isRendering || isPublishing) return

        const languages = [activeDraftLanguage]
        const reviewedLanguages = new Set((displayPreview?.videos || []).map(video => video.language))
        const missingLanguages = languages.filter(language => !reviewedLanguages.has(language))

        if (missingLanguages.length > 0) {
            toast.error(`Create and review preview video first: ${missingLanguages.join(', ')}`)
            return
        }

        setIsPublishing(true)

        try {
            const videoLinks = getPublishedVideoLinks(activeDraft)
            const publishDraft = {
                ...activeDraft,
                videoLanguage: activeDraftLanguage,
                videoLanguages: languages,
                videoLinks
            }
            const publishMarkdown = createMarkdownFromDraft(publishDraft)
            const response = await fetch('/__howto-script-editor/publish', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    guideId: activeDraft.id,
                    sectionId: activeDraft.sectionId,
                    sourcePath: activeDraft.sourcePath,
                    languages,
                    videos: displayPreview?.videos || [],
                    markdown: publishMarkdown
                })
            })
            const data = await response.json()

            if (!response.ok) throw new Error(data.error || 'Could not publish reviewed page')

            updateActiveDraft({
                videoLinks: data.videoLinks || videoLinks,
                sourcePath: data.sourcePath || activeDraft.sourcePath
            })
            if (data.undo) setUndoInfo(data.undo)

            if (data.warnings?.length) {
                toast.error(data.warnings.join(' '))
            } else {
                toast.success(`Published to ${getReadableSourcePath(data.sourcePath || activeDraft.sourcePath)}`)
            }
        } catch (error) {
            toast.error(error.message)
        } finally {
            setIsPublishing(false)
        }
    }

    const renderPreview = async () => {
        const renderDraft = activeDraft
        const renderDraftId = renderDraft.id
        const renderMarkdowns = {}

        try {
            for (const language of renderLanguages) {
                if ((renderDraft.language || 'en') === language) {
                    renderMarkdowns[language] = markdown
                    continue
                }

                if (language === 'en') {
                    renderMarkdowns.en = createMarkdownFromDraft({ ...getOriginalDraft(renderDraft), language: 'en' })
                    continue
                }

                const translatedDraft = await loadTranslatedDraft(language)

                if (!translatedDraft) {
                    toast.error(`Generate and review the ${language.toUpperCase()} translation before rendering that video.`)
                    return
                }

                renderMarkdowns[language] = createMarkdownFromDraft(translatedDraft)
            }
        } catch (error) {
            toast.error(error.message)
            return
        }

        setProcessLogSource('video')
        setIsRendering(true)
        setClosedLogById(current => ({ ...current, [renderDraftId]: false }))
        setExpandedVideoById(current => ({ ...current, [renderDraftId]: false }))
        setPreviewById(current => ({
            ...current,
            [renderDraftId]: {
                ...(current[renderDraftId] || {}),
                language: renderDraft.language || activeDraftLanguage,
                videoUrl: '',
                subtitlesUrl: '',
                error: '',
                log: ''
            }
        }))

        try {
            const saveRenderedVideosToDraft = async (videos = [], renderUndoId = '') => {
                if (!Array.isArray(videos) || videos.length === 0) return []

                const nextVideos = mergeVideosByLanguage(displayPreview?.videos || [], videos)
                const videoLinks = nextVideos.reduce((links, video) => ({
                    ...links,
                    [video.language]: {
                        videoUrl: removeCacheBuster(video.videoUrl),
                        captionsUrl: removeCacheBuster(video.captionsUrl)
                    }
                }), renderDraft.videoLinks || {})
                const nextDraft = withWorkingLanguage({
                    ...renderDraft,
                    videoLinks
                }, renderDraft.language || activeDraftLanguage)
                const nextMarkdown = createMarkdownFromDraft(nextDraft)

                updateDraftById(renderDraftId, {
                    videoLinks,
                    videoLanguage: renderDraft.language || activeDraftLanguage,
                    videoLanguages: [renderDraft.language || activeDraftLanguage]
                })
                const saveData = await saveDraftMarkdownToDisk(nextDraft, nextMarkdown, {
                    requireExisting: true,
                    appendToUndoId: renderUndoId,
                    undoLabel: `Render ${renderDraft.language || activeDraftLanguage} preview video and save markdown`
                })
                if (saveData.undo) setUndoInfo(saveData.undo)

                return nextVideos
            }
            const appendLog = (text) => {
                setPreviewById(current => ({
                    ...current,
                    [renderDraftId]: {
                        ...(current[renderDraftId] || {}),
                        log: `${current[renderDraftId]?.log || ''}${text}`
                    }
                }))
            }
            const response = await fetch('/__howto-script-editor/render', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    guideId: renderDraft.id,
                    sectionId: renderDraft.sectionId,
                    markdown,
                    markdowns: renderMarkdowns,
                    voice: withVoice,
                    languages: renderLanguages,
                    baseUrl: demoSettings.baseUrl || DEFAULT_DEMO_SETTINGS.baseUrl,
                    username: demoSettings.username || DEFAULT_DEMO_SETTINGS.username,
                    password: demoSettings.password ?? DEFAULT_DEMO_SETTINGS.password
                })
            })

            if (!response.ok || !response.body) {
                const data = await response.json().catch(() => ({}))
                throw new Error(data.error || 'Could not create preview video')
            }

            const contentType = response.headers.get('content-type') || ''

            if (!contentType.includes('application/x-ndjson')) {
                const data = await response.json()
                const nextVideos = Array.isArray(data.videos)
                    ? await saveRenderedVideosToDraft(data.videos, data.undo?.id)
                    : displayPreview?.videos || []
                if (data.undo) setUndoInfo(data.undo)
                setPreviewById(current => ({
                    ...current,
                    [renderDraftId]: {
                        ...data,
                        videos: nextVideos
                    }
                }))
                setExpandedVideoById(current => ({ ...current, [renderDraftId]: true }))
                toast.success('Preview video created and saved')
                return
            }

            const reader = response.body.getReader()
            const decoder = new TextDecoder()
            let buffer = ''
            let completed = false

            while (!completed) {
                const { value, done } = await reader.read()
                buffer += decoder.decode(value || new Uint8Array(), { stream: !done })
                const lines = buffer.split('\n')
                buffer = lines.pop() || ''

                for (const line of lines) {
                    if (!line.trim()) continue
                    const event = JSON.parse(line)

                    if (event.type === 'log') {
                        appendLog(event.text || '')
                    } else if (event.type === 'done') {
                        const nextVideos = Array.isArray(event.videos)
                            ? await saveRenderedVideosToDraft(event.videos, event.undo?.id)
                            : displayPreview?.videos || []
                        if (event.undo) setUndoInfo(event.undo)
                        setPreviewById(current => ({
                            ...current,
                            [renderDraftId]: {
                                ...(current[renderDraftId] || {}),
                                videoUrl: event.videoUrl,
                                subtitlesUrl: event.subtitlesUrl,
                                videos: nextVideos,
                                language: event.language,
                                log: current[renderDraftId]?.log || event.log || ''
                            }
                        }))
                        setExpandedVideoById(current => ({ ...current, [renderDraftId]: true }))
                        toast.success('Preview video created and saved')
                    } else if (event.type === 'error') {
                        throw new Error(event.error || 'Could not create preview video')
                    }
                }

                completed = done
            }

            if (buffer.trim()) {
                const event = JSON.parse(buffer)
                if (event.type === 'error') throw new Error(event.error || 'Could not create preview video')
            }
        } catch (error) {
            setPreviewById(current => ({
                ...current,
                [renderDraftId]: {
                    ...(current[renderDraftId] || {}),
                    language: renderDraft.language || activeDraftLanguage,
                    error: error.message
                }
            }))
            toast.error(error.message)
        } finally {
            setIsRendering(false)
        }
    }

    const generateHelpDocument = async () => {
        if (isGeneratingDoc || isRendering || !codexPrompt.trim()) return

        setProcessLogSource('codex')
        setIsCodexLogClosed(false)
        setIsGeneratingDoc(true)
        setCodexRun({ log: '', error: '', finalMessage: '' })

        try {
            const appendLog = (text) => {
                setCodexRun(current => ({
                    ...current,
                    log: `${current.log || ''}${text}`
                }))
            }
            const response = await fetch('/__howto-script-editor/generate-doc', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    prompt: codexPrompt,
                    sectionId: codexSectionId || activeDraft?.sectionId || '',
                    languages: [activeDraftLanguage]
                })
            })

            if (!response.ok || !response.body) {
                const data = await response.json().catch(() => ({}))
                throw new Error(data.error || 'Could not start Codex help-document agent')
            }

            const contentType = response.headers.get('content-type') || ''

            if (!contentType.includes('application/x-ndjson')) {
                const data = await response.json()
                setCodexRun({
                    log: data.log || '',
                    error: '',
                    finalMessage: data.finalMessage || ''
                })
                toast.success('Codex generated the help document')
                return
            }

            const reader = response.body.getReader()
            const decoder = new TextDecoder()
            let buffer = ''
            let completed = false

            while (!completed) {
                const { value, done } = await reader.read()
                buffer += decoder.decode(value || new Uint8Array(), { stream: !done })
                const lines = buffer.split('\n')
                buffer = lines.pop() || ''

                for (const line of lines) {
                    if (!line.trim()) continue
                    const event = JSON.parse(line)

                    if (event.type === 'log') {
                        appendLog(event.text || '')
                    } else if (event.type === 'done') {
                        setCodexRun(current => ({
                            ...current,
                            finalMessage: event.finalMessage || '',
                            log: `${current.log || ''}${event.finalMessage ? `\n\n${event.finalMessage}` : ''}`
                        }))
                        toast.success('Codex generated the help document')
                    } else if (event.type === 'error') {
                        throw new Error(event.error || 'Codex failed to generate the help document')
                    }
                }

                completed = done
            }

            if (buffer.trim()) {
                const event = JSON.parse(buffer)
                if (event.type === 'error') throw new Error(event.error || 'Codex failed to generate the help document')
            }
        } catch (error) {
            setCodexRun(current => ({
                ...current,
                error: error.message
            }))
            toast.error(error.message)
        } finally {
            setIsGeneratingDoc(false)
        }
    }

    if (!activeDraft) {
        return (
            <div className="min-h-screen bg-gray-50 px-6 py-8">
                <div className="mx-auto max-w-4xl rounded border border-gray-200 bg-white p-6">
                    <h1 className="text-xl font-semibold text-gray-900">Inga guider hittades</h1>
                    <p className="mt-2 text-sm text-gray-600">Lägg till markdownfiler under `frontend/src/docs/how-to` först.</p>
                </div>
            </div>
        )
    }

    return (
        <div className={`min-h-screen bg-gray-50 text-gray-900 ${isLogOpen ? 'pb-[38vh]' : ''}`}>
            <header className="border-b border-gray-200 bg-white">
                <div className="mx-auto flex max-w-[1600px] flex-wrap items-center justify-between gap-4 px-4 py-4 sm:px-6 lg:px-8">
                    <div>
                        <Link to={getHelpIndexPath()} className="text-sm font-medium text-blue-600 hover:text-blue-700">
                            Hjälpguider
                        </Link>
                        <h1 className="mt-1 text-2xl font-semibold text-gray-900">Video Script Editor</h1>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                        <Link
                            to={getHelpGuidePath(activeDraft.id)}
                            className="inline-flex items-center gap-2 rounded border border-gray-200 bg-white px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
                        >
                            <FileText className="h-4 w-4" />
                            Visa guide
                        </Link>
                        <button type="button" onClick={resetDraft} disabled={isRendering} className="inline-flex items-center gap-2 rounded border border-gray-200 bg-white px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50">
                            <RotateCcw className="h-4 w-4" />
                            Återställ
                        </button>
                        <button type="button" onClick={undoLastOverwrite} disabled={!undoInfo || isRendering || isTranslating || isPublishing} title={undoInfo ? `Undo ${undoInfo.label}` : 'Nothing to undo'} className="inline-flex items-center gap-2 rounded border border-amber-200 bg-amber-50 px-3 py-2 text-sm font-medium text-amber-800 hover:bg-amber-100 disabled:cursor-not-allowed disabled:opacity-50">
                            <RotateCcw className="h-4 w-4" />
                            Undo overwrite
                        </button>
                        <button type="button" onClick={saveMarkdownToDisk} disabled={isRendering} className="inline-flex items-center gap-2 rounded bg-green-700 px-3 py-2 text-sm font-medium text-white hover:bg-green-800 disabled:cursor-not-allowed disabled:opacity-50">
                            <Save className="h-4 w-4" />
                            Overwrite file
                        </button>
                        <button type="button" onClick={copyMarkdown} disabled={isRendering} className="inline-flex items-center gap-2 rounded bg-blue-600 px-3 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50">
                            <Copy className="h-4 w-4" />
                            Kopiera markdown
                        </button>
                        <button type="button" onClick={downloadMarkdown} disabled={isRendering} className="inline-flex items-center gap-2 rounded bg-gray-900 px-3 py-2 text-sm font-medium text-white hover:bg-gray-800 disabled:cursor-not-allowed disabled:opacity-50">
                            <Download className="h-4 w-4" />
                            Ladda ner
                        </button>
                    </div>
                </div>
            </header>

            <main className="mx-auto grid max-w-[1600px] gap-6 px-4 py-6 sm:px-6 lg:grid-cols-[280px_minmax(0,1fr)_340px] lg:px-8">
                <aside className="space-y-4">
                    <CodexHelpWriterPanel
                        prompt={codexPrompt}
                        onPromptChange={setCodexPrompt}
                        sectionId={codexSectionId}
                        onSectionChange={setCodexSectionId}
                        isGenerating={isGeneratingDoc || isRendering}
                        finalMessage={codexRun.finalMessage}
                        onGenerate={generateHelpDocument}
                    />

                    <section className="rounded border border-gray-200 bg-white p-3">
                        <h2 className="px-1 text-sm font-semibold text-gray-900">Manus browser</h2>
                        <div className="mt-3 max-h-[calc(100vh-180px)] space-y-3 overflow-y-auto pr-1">
                            {howToDocs.map(section => (
                                <div key={section.id}>
                                    <div className="px-1 text-xs font-semibold uppercase tracking-wide text-gray-500">{section.title}</div>
                                    <div className="mt-1 space-y-1">
                                        {section.guides.map(guide => (
                                            <button
                                                key={guide.id}
                                                type="button"
                                                disabled={isRendering}
                                                onClick={() => openGuide({ section, guide })}
                                                className={`block w-full rounded px-2 py-2 text-left text-sm hover:bg-blue-50 hover:text-blue-700 disabled:cursor-not-allowed disabled:opacity-50 ${activeDraft.id === guide.id ? 'bg-blue-50 text-blue-700' : 'text-gray-700'}`}
                                            >
                                                {guide.title}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </section>
                </aside>

                <div className="space-y-6">
                    <div className="flex flex-wrap gap-2">
                        {openDrafts.map(draft => (
                            <div
                                key={draft.id}
                                className={`inline-flex items-stretch overflow-hidden rounded border text-sm font-medium ${activeDraft.id === draft.id ? 'border-blue-200 bg-blue-50 text-blue-700' : 'border-gray-200 bg-white text-gray-700'}`}
                            >
                                <button
                                    type="button"
                                    disabled={isRendering}
                                    onClick={() => setActiveDraftId(draft.id)}
                                    className={`px-3 py-2 text-left disabled:cursor-not-allowed disabled:opacity-60 ${activeDraft.id === draft.id ? 'bg-blue-50' : 'bg-white hover:bg-gray-50'}`}
                                >
                                    {draft.title || draft.id}
                                </button>
                                {openDrafts.length > 1 && (
                                    <button
                                        type="button"
                                        disabled={isRendering}
                                        onClick={(event) => {
                                            event.stopPropagation()
                                            closeDraft(draft.id)
                                        }}
                                        className="border-l border-inherit px-2 text-gray-400 hover:bg-white hover:text-red-600 disabled:cursor-not-allowed disabled:opacity-40"
                                        aria-label={`Close ${draft.title || draft.id}`}
                                    >
                                        x
                                    </button>
                                )}
                            </div>
                        ))}
                    </div>

                    <ExpandedVideoPanel
                        preview={displayPreview}
                        expanded={isVideoExpanded}
                        onToggleExpanded={() => setExpandedVideoById(current => ({ ...current, [activeDraft.id]: false }))}
                    />

                    <FinishedPagePreview
                        draft={activeDraft}
                        language={pagePreviewLanguage}
                    />

                    <section className="rounded border border-gray-200 bg-white p-4">
                        <div className="grid gap-4 md:grid-cols-2">
                            <TextInput label="Title" value={activeDraft.title} onChange={title => updateActiveDraft({ title })} disabled={isRendering} />
                            <TextInput label="Guide ID" value={activeDraft.id} onChange={id => updateActiveDraft({ id })} disabled={isRendering} />
                            <TextInput label="Order" type="number" value={activeDraft.order} onChange={order => updateActiveDraft({ order })} disabled={isRendering} />
                            <TextArea label="Summary" value={activeDraft.summary} onChange={summary => updateActiveDraft({ summary })} rows={2} disabled={isRendering} />
                            <TextInput label="Section" value={activeDraft.sectionTitle} onChange={sectionTitle => updateActiveDraft({ sectionTitle })} disabled={isRendering} />
                        </div>
                        <div className="mt-4">
                            <VideoLinksEditor
                                languages={[activeDraftLanguage]}
                                links={activeDraft.videoLinks || {}}
                                disabled={isRendering}
                                onChange={(language, links) => updateActiveDraft({
                                    videoLinks: {
                                        ...(activeDraft.videoLinks || {}),
                                        [language]: links
                                    }
                                })}
                            />
                        </div>
                        {readableSourcePath && (
                            <div className="mt-4 rounded border border-blue-100 bg-blue-50 px-3 py-2 text-sm text-blue-900">
                                <span className="font-semibold">Source file:</span>{' '}
                                <code className="break-all font-mono text-xs">{readableSourcePath}</code>
                            </div>
                        )}
                    </section>

                    <section className="space-y-4">
                        <div className="flex flex-wrap items-center justify-between gap-3">
                            <h2 className="text-base font-semibold text-gray-900">Sekventiellt filmmanus</h2>
                            <div className="flex flex-wrap gap-2">
                                <button type="button" onClick={() => addBlock(null)} disabled={isRendering} className="inline-flex items-center gap-2 rounded border border-gray-200 bg-white px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50">
                                    <Plus className="h-4 w-4" />
                                    Caption block
                                </button>
                                <button type="button" onClick={() => addBlock('click')} disabled={isRendering} className="inline-flex items-center gap-2 rounded bg-gray-900 px-3 py-2 text-sm font-medium text-white hover:bg-gray-800 disabled:cursor-not-allowed disabled:opacity-50">
                                    <Plus className="h-4 w-4" />
                                    Action block
                                </button>
                            </div>
                        </div>

                        {(activeDraft.script || []).map((block, index) => (
                            <ScriptBlockEditor
                                key={index}
                                block={block}
                                index={index}
                                total={activeDraft.script.length}
                                onChange={nextBlock => {
                                    const script = [...activeDraft.script]
                                    script[index] = nextBlock
                                    updateScript(script)
                                }}
                                onMove={offset => moveBlock(index, offset)}
                                onRemove={() => {
                                    const script = activeDraft.script.filter((_, candidateIndex) => candidateIndex !== index)
                                    updateScript(script.length ? script : [createScriptBlock(null)])
                                }}
                                disabled={isRendering}
                            />
                        ))}
                    </section>

                    <section className="rounded border border-gray-200 bg-white p-4">
                        <div className="mb-3 flex items-center justify-between gap-3">
                            <h2 className="text-base font-semibold text-gray-900">Markdown</h2>
                            <span className="text-sm text-gray-500">{markdown.split('\n').length} lines</span>
                        </div>
                        <textarea
                            readOnly
                            value={markdown}
                            rows={18}
                            className="w-full resize-y rounded border border-gray-200 bg-gray-950 px-3 py-3 font-mono text-xs leading-5 text-gray-100 shadow-sm focus:outline-none"
                        />
                    </section>
                </div>

                <QualityPanel
                    draft={activeDraft}
                    issues={issues}
                    preview={languagePreview}
                    displayPreview={displayPreview}
                    isRendering={isRendering}
                    isTranslating={isTranslating}
                    isPublishing={isPublishing}
                    activeLanguage={activeDraftLanguage}
                    onLanguageSwitch={switchDraftLanguage}
                    onGenerateTranslation={generateTranslation}
                    withVoice={withVoice}
                    onVoiceChange={setWithVoice}
                    onRender={renderPreview}
                    onPublish={publishReviewedGuide}
                    demoSettings={demoSettings}
                    onDemoSettingsChange={updateDemoSettings}
                    isVideoExpanded={isVideoExpanded}
                    onToggleVideoExpanded={() => setExpandedVideoById(current => ({ ...current, [activeDraft.id]: !current[activeDraft.id] }))}
                />
            </main>

            <ProgressLogDock
                log={processLog}
                error={processError}
                isRunning={isProcessRunning}
                statusText={processStatusText}
                doneText={processDoneText}
                isOpen={isLogOpen}
                onClose={() => {
                    if (processLogSource === 'codex') {
                        setIsCodexLogClosed(true)
                        return
                    }
                    if (processLogSource === 'translation') {
                        setIsTranslationLogClosed(true)
                        return
                    }
                    setClosedLogById(current => ({ ...current, [activeDraft.id]: true }))
                }}
            />
        </div>
    )
}

export default HowToScriptEditorPage
