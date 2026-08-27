import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import {
    ArrowDown,
    ArrowUp,
    Bot,
    CheckCircle2,
    ChevronDown,
    ChevronRight,
    ClipboardPaste,
    Copy,
    Download,
    Eye,
    ExternalLink,
    FileText,
    Film,
    Maximize2,
    Minimize2,
    MousePointerClick,
    Plus,
    RotateCcw,
    Save,
    Scissors,
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

const normalizeGuideIdInput = (value = '') => value
    .toString()
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')

const getReadableSourcePath = (sourcePath = '') => sourcePath
    .replace(/^\.\.\//, 'frontend/src/')
    .replace(/^src\//, 'frontend/src/')

const DEFAULT_DEMO_SETTINGS = {
    baseUrl: 'http://localhost:10100',
    username: 'demo',
    password: 'demo',
    recordReferenceVideoWithAudio: false
}

const EXTRA_SECTION_OPTIONS = [{
    id: 'navigation',
    title: 'Navigation',
    summary: 'Create and maintain navigation menus and navigation-related widgets.',
    order: 2
}]

const getSectionOptions = () => {
    const sections = new Map()

    howToDocs.forEach(section => {
        sections.set(section.id, {
            id: section.id,
            title: section.title || section.id,
            summary: section.summary || '',
            order: Number.isFinite(Number(section.order)) ? Number(section.order) : 999
        })
    })
    EXTRA_SECTION_OPTIONS.forEach(section => {
        if (!sections.has(section.id)) sections.set(section.id, section)
    })

    return [...sections.values()].sort((a, b) => a.order - b.order || a.title.localeCompare(b.title))
}

const getSectionOption = (sectionOptions = [], sectionId = '') => sectionOptions.find(section => section.id === sectionId)
    || sectionOptions.find(section => section.id === 'navigation')
    || sectionOptions[0]

const DEFAULT_EDITOR_LANGUAGE = 'en'
const SUPPORTED_EDITOR_LANGUAGES = VIDEO_LANGUAGE_OPTIONS.map(option => option.code)

const editorSession = {
    openDrafts: null,
    draftsByKey: new Map(),
    activeDraftKey: '',
    previewByKey: {},
    expandedVideoByKey: {},
    closedLogByKey: {},
    renderLogs: [],
    selectedRenderLogId: '',
    demoSettings: DEFAULT_DEMO_SETTINGS,
    globalHoldMs: 0,
    videoOverrideByKey: {},
    scriptBlockClipboard: null,
    recordingRun: { id: '', log: '', error: '', blocks: [], rawVideoUrl: '', rawVideoPath: '', referenceVideoUrl: '', referenceVideoPath: '', status: '' }
}

const SCRIPT_BLOCK_CLIPBOARD_TYPE = 'eceee/howto-script-block'

const normalizeEditorLanguage = (language = DEFAULT_EDITOR_LANGUAGE) => {
    const normalized = language.toString().trim().toLowerCase()
    return SUPPORTED_EDITOR_LANGUAGES.includes(normalized) ? normalized : DEFAULT_EDITOR_LANGUAGE
}

const getScriptEditorPath = (guideId, language = DEFAULT_EDITOR_LANGUAGE) => (
    `/help/script-editor/${normalizeEditorLanguage(language)}/${encodeURIComponent(guideId || '')}`
)

const getDraftKey = (guideId, language = DEFAULT_EDITOR_LANGUAGE) => `${guideId || ''}::${normalizeEditorLanguage(language)}`

const getDraftSessionKey = (draft = {}) => draft.draftKey || getDraftKey(draft.id, draft.language || DEFAULT_EDITOR_LANGUAGE)

const isOverrideVideoUrl = (value = '') => String(value || '').split('?')[0].includes('/howto-videos/overrides/')

const cloneDraft = (draft) => {
    if (!draft) return draft
    if (typeof structuredClone === 'function') return structuredClone(draft)
    return JSON.parse(JSON.stringify(draft))
}

const withDraftSessionKey = (draft, guideId = draft?.id, language = draft?.language || DEFAULT_EDITOR_LANGUAGE) => ({
    ...draft,
    draftKey: getDraftKey(guideId || draft?.id, language)
})

const writeClipboardText = async (value) => {
    if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(value)
        return
    }

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

const readClipboardText = async () => {
    if (navigator.clipboard?.readText) {
        return navigator.clipboard.readText()
    }

    throw new Error('Clipboard read is not available')
}

const serializeScriptBlockForClipboard = (block) => JSON.stringify({
    type: SCRIPT_BLOCK_CLIPBOARD_TYPE,
    version: 1,
    block: normalizeScriptBlock(block)
}, null, 2)

const parseScriptBlockFromClipboard = (value = '') => {
    const text = String(value || '').trim()

    if (!text) throw new Error('Clipboard is empty')

    if (!text.startsWith('{') && !text.startsWith('[')) {
        return normalizeScriptBlock({ caption: text, action: null })
    }

    const parsed = JSON.parse(text)
    const candidate = parsed?.type === SCRIPT_BLOCK_CLIPBOARD_TYPE
        ? parsed.block
        : Array.isArray(parsed)
        ? parsed[0]
        : parsed.block || parsed
    const block = normalizeScriptBlock(candidate)

    if (!block.caption && !block.action) {
        throw new Error('Clipboard does not contain a caption or action block')
    }

    return block
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

const loadDraftForGuide = (option, language = option?.guide?.language || DEFAULT_EDITOR_LANGUAGE) => {
    const normalizedLanguage = normalizeEditorLanguage(language)
    const translatedGuide = normalizedLanguage !== DEFAULT_EDITOR_LANGUAGE
        ? option?.guide?.translations?.[normalizedLanguage]
        : null
    const guide = translatedGuide || option?.guide
    const section = translatedGuide?.section || option?.section

    return withDraftSessionKey(
        withWorkingLanguage(guideToScriptDraft(guide, section), normalizedLanguage),
        option?.guide?.id || guide?.id,
        normalizedLanguage
    )
}

const draftFromMarkdown = (source, sourcePath, language = 'en', fallbackId = '') => {
    const parsed = parseHowToMarkdown(source, fallbackId)
    const section = {
        id: parsed.sectionId,
        title: parsed.sectionTitle,
        summary: parsed.sectionSummary,
        order: parsed.sectionOrder
    }

    return withDraftSessionKey(withWorkingLanguage({
        ...guideToScriptDraft({
            ...parsed.guide,
            sourcePath,
            language: parsed.guide?.language || language
        }, section),
        language: parsed.guide?.language || language
    }, parsed.guide?.language || language), fallbackId || parsed.guide?.id, parsed.guide?.language || language)
}

const getDraftSteps = (draft = {}) => (draft.script || [])
    .map(block => normalizeScriptBlock(block).caption)
    .filter(Boolean)

const getDraftVideoSources = (draft = {}) => Object.entries(draft.videoLinks || {})
    .map(([language, links]) => ({
        language,
        videoUrl: links.videoUrl || '',
        captionsUrl: links.captionsUrl || ''
    }))
    .filter(source => source.videoUrl || source.captionsUrl)

const formatRenderLogTime = (value = '') => {
    if (!value) return 'Unknown time'

    const date = new Date(value)
    if (Number.isNaN(date.getTime())) return value

    return date.toLocaleString()
}

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

const getGuideOptionById = (guideOptions, guideId) => guideOptions.find(option => option.guide.id === guideId)

const ensureDraftForRoute = (drafts = [], guideOptions = [], guideId = '', language = DEFAULT_EDITOR_LANGUAGE) => {
    const option = getGuideOptionById(guideOptions, guideId)
    if (!option) return drafts

    const draftKey = getDraftKey(option.guide.id, language)
    if (drafts.some(draft => getDraftSessionKey(draft) === draftKey)) return drafts

    const storedDraft = editorSession.draftsByKey.get(draftKey)
    const nextDraft = storedDraft
        ? cloneDraft(storedDraft)
        : loadDraftForGuide(option, language)

    return [...drafts, nextDraft]
}

const getInitialOpenDrafts = (guideOptions = [], guideId = '', language = DEFAULT_EDITOR_LANGUAGE) => {
    const initialDrafts = Array.isArray(editorSession.openDrafts) && editorSession.openDrafts.length > 0
        ? editorSession.openDrafts.map(cloneDraft)
        : []
    const fallbackGuideId = guideId || guideOptions[0]?.guide?.id || ''

    return ensureDraftForRoute(initialDrafts, guideOptions, fallbackGuideId, language)
}

const FieldLabel = ({ children }) => (
    <label className="block text-xs font-semibold uppercase tracking-wide text-gray-500">{children}</label>
)

const TextInput = ({ label, value, onChange, placeholder = '', type = 'text', disabled = false, readOnly = false, onBlur, onKeyDown }) => (
    <div>
        <FieldLabel>{label}</FieldLabel>
        <input
            type={type}
            value={value ?? ''}
            placeholder={placeholder}
            disabled={disabled}
            readOnly={readOnly}
            onChange={event => onChange(event.target.value)}
            onBlur={onBlur}
            onKeyDown={onKeyDown}
            className="mt-1 w-full rounded border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100 disabled:cursor-not-allowed disabled:bg-gray-100 disabled:text-gray-500 read-only:bg-gray-50 read-only:text-gray-600"
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

const AccordionHeader = ({ icon, title, isOpen, onToggle }) => (
    <button
        type="button"
        onClick={onToggle}
        className="flex w-full items-center justify-between gap-2 rounded px-2 py-2 text-left text-sm font-semibold text-gray-900 hover:bg-gray-50"
        aria-expanded={isOpen}
    >
        <span className="flex min-w-0 items-center gap-2">
            {icon}
            <span className="truncate">{title}</span>
        </span>
        {isOpen ? <ChevronDown className="h-4 w-4 flex-shrink-0 text-gray-500" /> : <ChevronRight className="h-4 w-4 flex-shrink-0 text-gray-500" />}
    </button>
)

const CodexHelpWriterPanel = ({
    prompt,
    onPromptChange,
    sectionId,
    onSectionChange,
    isGenerating,
    finalMessage,
    onGenerate,
    isOpen,
    onToggle
}) => (
    <section className="rounded border border-gray-200 bg-white">
        <AccordionHeader
            icon={<Bot className="h-4 w-4 text-blue-600" />}
            title="Codex help writer"
            isOpen={isOpen}
            onToggle={onToggle}
        />
        {isOpen && (
        <div className="max-h-[38vh] space-y-2 overflow-y-auto border-t border-gray-100 p-2">
            <TextArea
                label="Prompt"
                value={prompt}
                onChange={onPromptChange}
                rows={3}
                placeholder="Describe the help document Codex should create."
                disabled={isGenerating}
            />
            <SelectInput label="Section" value={sectionId} onChange={onSectionChange} disabled={isGenerating}>
                <option value="">Let Codex choose</option>
                {getSectionOptions().map(section => (
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
        )}
    </section>
)

const CodexScriptBlockModal = ({
    isOpen,
    prompt,
    insertLabel,
    isGenerating,
    onPromptChange,
    onSubmit,
    onClose
}) => {
    const textareaRef = useRef(null)

    useEffect(() => {
        if (!isOpen) return
        requestAnimationFrame(() => textareaRef.current?.focus())
    }, [isOpen])

    useEffect(() => {
        if (!isOpen) return undefined

        const handleKeyDown = (event) => {
            if (event.key === 'Escape' && !isGenerating) onClose()
        }

        window.addEventListener('keydown', handleKeyDown)
        return () => window.removeEventListener('keydown', handleKeyDown)
    }, [isGenerating, isOpen, onClose])

    if (!isOpen) return null

    const canSubmit = Boolean(prompt.trim()) && !isGenerating

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-gray-950/40 px-4 py-6">
            <form
                role="dialog"
                aria-modal="true"
                aria-labelledby="codex-script-block-modal-title"
                onSubmit={event => {
                    event.preventDefault()
                    if (canSubmit) onSubmit()
                }}
                className="w-full max-w-xl rounded border border-gray-200 bg-white p-4 shadow-xl"
            >
                <div className="flex items-start justify-between gap-4">
                    <div>
                        <h2 id="codex-script-block-modal-title" className="text-base font-semibold text-gray-900">
                            Add script block with Codex
                        </h2>
                        <p className="mt-1 text-sm text-gray-600">
                            Describe the caption, action, or both for the new sequential block.
                        </p>
                    </div>
                    <button
                        type="button"
                        onClick={onClose}
                        disabled={isGenerating}
                        className="inline-flex h-9 w-9 items-center justify-center rounded text-gray-500 hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-40"
                        aria-label="Close Codex block modal"
                    >
                        <X className="h-4 w-4" />
                    </button>
                </div>

                <div className="mt-4">
                    <FieldLabel>What should the new block do?</FieldLabel>
                    <textarea
                        ref={textareaRef}
                        value={prompt}
                        onChange={event => onPromptChange(event.target.value)}
                        rows={6}
                        disabled={isGenerating}
                        placeholder="Example: Say that the editor opens the page settings, then click Save draft."
                        className="mt-1 w-full rounded border border-gray-200 px-3 py-2 text-sm text-gray-900 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100 disabled:cursor-not-allowed disabled:bg-gray-100 disabled:text-gray-500"
                    />
                    <div className="mt-2 flex flex-wrap items-center justify-between gap-2 text-xs text-gray-500">
                        <span>{insertLabel}</span>
                        <span>Codex can return speech only, action only, or both.</span>
                    </div>
                </div>

                <div className="mt-4 flex flex-wrap justify-end gap-2">
                    <button
                        type="button"
                        onClick={onClose}
                        disabled={isGenerating}
                        className="inline-flex items-center gap-2 rounded border border-gray-200 bg-white px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                        Cancel
                    </button>
                    <button
                        type="submit"
                        disabled={!canSubmit}
                        className="inline-flex items-center gap-2 rounded bg-gray-900 px-3 py-2 text-sm font-medium text-white hover:bg-gray-800 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                        <Bot className="h-4 w-4" />
                        {isGenerating ? 'Generating...' : 'Generate block'}
                    </button>
                </div>
            </form>
        </div>
    )
}

const MetadataChangeConfirmModal = ({ change, isApplying, onConfirm, onCancel }) => {
    if (!change) return null

    const isGuideIdChange = change.kind === 'guide-id'
    const title = isGuideIdChange ? 'Change Guide ID?' : 'Change section?'
    const description = isGuideIdChange
        ? 'Guide ID changes are saved as file operations. The current preview video link is cleared so the next render uses the new Guide ID.'
        : 'The markdown file path stays based on Guide ID. The manuscript browser will move this guide because its section frontmatter changes.'
    const fromValue = isGuideIdChange ? change.previousId : change.previousSectionTitle
    const toValue = isGuideIdChange ? change.nextId : change.nextSectionTitle

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-gray-950/40 px-4 py-6">
            <div
                role="alertdialog"
                aria-modal="true"
                aria-labelledby="metadata-change-title"
                aria-describedby="metadata-change-description"
                className="w-full max-w-md rounded border border-gray-200 bg-white p-4 shadow-xl"
            >
                <h2 id="metadata-change-title" className="text-base font-semibold text-gray-900">
                    {title}
                </h2>
                <p id="metadata-change-description" className="mt-2 text-sm leading-6 text-gray-600">
                    {description}
                </p>
                <div className="mt-3 rounded border border-gray-100 bg-gray-50 px-3 py-2 text-sm text-gray-700">
                    <div><span className="font-medium">From:</span> {fromValue || '(empty)'}</div>
                    <div><span className="font-medium">To:</span> {toValue || '(empty)'}</div>
                </div>
                <div className="mt-4 flex flex-wrap justify-end gap-2">
                    <button
                        type="button"
                        onClick={onCancel}
                        disabled={isApplying}
                        className="inline-flex items-center gap-2 rounded border border-gray-200 bg-white px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                        Cancel
                    </button>
                    <button
                        type="button"
                        onClick={onConfirm}
                        disabled={isApplying}
                        className="inline-flex items-center gap-2 rounded bg-gray-900 px-3 py-2 text-sm font-medium text-white hover:bg-gray-800 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                        {isApplying ? 'Applying...' : 'Confirm'}
                    </button>
                </div>
            </div>
        </div>
    )
}

const SaveAsModal = ({ isOpen, guideId, overwrite, error, isSaving, onGuideIdChange, onOverwriteChange, onSubmit, onClose }) => {
    if (!isOpen) return null

    const normalizedGuideId = normalizeGuideIdInput(guideId)

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-gray-950/40 px-4 py-6">
            <form
                role="dialog"
                aria-modal="true"
                aria-labelledby="save-as-title"
                onSubmit={event => {
                    event.preventDefault()
                    if (normalizedGuideId) onSubmit(normalizedGuideId)
                }}
                className="w-full max-w-md rounded border border-gray-200 bg-white p-4 shadow-xl"
            >
                <h2 id="save-as-title" className="text-base font-semibold text-gray-900">Save manuscript as</h2>
                <p className="mt-2 text-sm leading-6 text-gray-600">
                    The Guide ID is the filename identity on disk. The section comes from the markdown frontmatter.
                </p>
                <div className="mt-4">
                    <TextInput
                        label="Guide ID"
                        value={guideId}
                        onChange={onGuideIdChange}
                        placeholder="pages-create-demo"
                        disabled={isSaving}
                    />
                    {guideId && guideId !== normalizedGuideId && (
                        <p className="mt-1 text-xs text-gray-500">Will save as <code>{normalizedGuideId}</code>.</p>
                    )}
                </div>
                <label className="mt-4 flex items-start gap-2 text-sm text-gray-700">
                    <input
                        type="checkbox"
                        checked={overwrite}
                        disabled={isSaving}
                        onChange={event => onOverwriteChange(event.target.checked)}
                        className="mt-1 h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                    />
                    <span>Overwrite if this Guide ID already exists.</span>
                </label>
                {error && (
                    <div className="mt-3 rounded border border-red-100 bg-red-50 px-3 py-2 text-sm text-red-800">
                        {error}
                    </div>
                )}
                <div className="mt-4 flex flex-wrap justify-end gap-2">
                    <button
                        type="button"
                        onClick={onClose}
                        disabled={isSaving}
                        className="inline-flex items-center gap-2 rounded border border-gray-200 bg-white px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                        Cancel
                    </button>
                    <button
                        type="submit"
                        disabled={!normalizedGuideId || isSaving}
                        className="inline-flex items-center gap-2 rounded bg-green-700 px-3 py-2 text-sm font-medium text-white hover:bg-green-800 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                        <Save className="h-4 w-4" />
                        {isSaving ? 'Saving...' : 'Save As'}
                    </button>
                </div>
            </form>
        </div>
    )
}

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

const blobToBase64 = blob => new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onloadend = () => resolve(String(reader.result || '').split(',')[1] || '')
    reader.onerror = reject
    reader.readAsDataURL(blob)
})

const normalizeAudioClips = audio => {
    if (!audio || typeof audio !== 'object') return {}
    const clips = { ...(audio.clips || {}) }
    if (audio.url && audio.source && !clips[audio.source]) clips[audio.source] = audio
    return clips
}

const audioLabel = source => source === 'elevenlabs' ? 'ElevenLabs' : source === 'recorded' ? 'Recorded' : 'Audio'

const BlockAudioEditor = ({
    audio,
    caption,
    transcript,
    vttText,
    index,
    onChange,
    onTranscriptChange,
    onVttTextChange,
    onSaveRecording,
    onGenerateElevenLabs,
    onTranscribeAudio,
    disabled = false
}) => {
    const [isRecording, setIsRecording] = useState(false)
    const [isGenerating, setIsGenerating] = useState(false)
    const [isTranscribing, setIsTranscribing] = useState(false)
    const mediaRecorderRef = useRef(null)
    const streamRef = useRef(null)
    const chunksRef = useRef([])
    const startedAtRef = useRef(0)
    const clips = normalizeAudioClips(audio)
    const activeSource = audio?.source || (clips.recorded ? 'recorded' : clips.elevenlabs ? 'elevenlabs' : '')
    const activeClip = activeSource ? clips[activeSource] : null
    const recordedClip = clips.recorded
    const elevenLabsClip = clips.elevenlabs

    const setClip = (source, clip) => {
        const nextClips = {
            ...clips,
            [source]: {
                ...clip,
                source
            }
        }
        const nextActiveSource = source === 'recorded' || !nextClips.recorded ? source : activeSource || 'recorded'
        const nextActiveClip = nextClips[nextActiveSource] || nextClips.recorded || nextClips.elevenlabs
        onChange({
            ...nextActiveClip,
            source: nextActiveClip.source || nextActiveSource,
            clips: nextClips
        })
    }

    const useClip = source => {
        if (!clips[source]) return
        onChange({
            ...clips[source],
            source,
            clips
        })
    }

    const clearClip = source => {
        const nextClips = { ...clips }
        delete nextClips[source]
        const nextSource = source === activeSource
            ? nextClips.recorded ? 'recorded' : nextClips.elevenlabs ? 'elevenlabs' : ''
            : activeSource

        if (!nextSource || !nextClips[nextSource]) {
            onChange(null)
            return
        }

        onChange({
            ...nextClips[nextSource],
            source: nextSource,
            clips: nextClips
        })
    }

    const updateActiveClip = updates => {
        if (!activeSource || !activeClip) return
        setClip(activeSource, { ...activeClip, ...updates })
    }

    const startRecording = async () => {
        if (!navigator.mediaDevices?.getUserMedia || !window.MediaRecorder) {
            toast.error('Microphone recording is not available in this browser.')
            return
        }

        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
            const mimeType = [
                'audio/webm;codecs=opus',
                'audio/webm',
                'audio/mp4',
                'audio/ogg;codecs=opus'
            ].find(candidate => MediaRecorder.isTypeSupported(candidate)) || ''
            const recorder = mimeType ? new MediaRecorder(stream, { mimeType }) : new MediaRecorder(stream)
            streamRef.current = stream
            chunksRef.current = []
            startedAtRef.current = Date.now()
            mediaRecorderRef.current = recorder

            recorder.addEventListener('dataavailable', event => {
                if (event.data?.size) chunksRef.current.push(event.data)
            })
            recorder.addEventListener('stop', async () => {
                const durationMs = Math.max(0, Date.now() - startedAtRef.current)
                const blob = new Blob(chunksRef.current, { type: mimeType })
                stream.getTracks().forEach(track => track.stop())
                setIsRecording(false)

                try {
                    const clip = await onSaveRecording({ blob, mimeType, durationMs, index })
                    setClip('recorded', clip)
                    toast.success('Recorded audio saved for this block')
                } catch (error) {
                    toast.error(error.message)
                }
            }, { once: true })

            recorder.start()
            setIsRecording(true)
        } catch (error) {
            toast.error(error.message)
        }
    }

    const stopRecording = () => {
        const recorder = mediaRecorderRef.current
        if (recorder && recorder.state !== 'inactive') {
            recorder.stop()
        }
        streamRef.current?.getTracks().forEach(track => track.stop())
    }

    const generateElevenLabs = async () => {
        try {
            setIsGenerating(true)
            const clip = await onGenerateElevenLabs({ caption, index })
            setClip('elevenlabs', clip)
            toast.success('ElevenLabs audio generated')
        } catch (error) {
            toast.error(error.message)
        } finally {
            setIsGenerating(false)
        }
    }

    const transcribeActiveClip = async () => {
        if (!activeClip?.url) return

        try {
            setIsTranscribing(true)
            const text = await onTranscribeAudio({ audioUrl: activeClip.url, index })
            onTranscriptChange(text)
            if (!String(vttText || '').trim()) onVttTextChange(text)
            toast.success('Audio transcribed')
        } catch (error) {
            toast.error(error.message)
        } finally {
            setIsTranscribing(false)
        }
    }

    const durationSeconds = activeClip
        ? Math.max(0, Math.round((Number(activeClip.endMs || 0) - Number(activeClip.startMs || 0)) / 1000 * 10) / 10)
        : 0

    return (
        <div className="rounded border border-blue-100 bg-blue-50 p-3">
            <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                <div>
                    <div className="text-xs font-semibold uppercase text-blue-900">Block audio</div>
                    <div className="text-xs text-blue-700">
                        {activeClip ? `${audioLabel(activeSource)}${durationSeconds ? `, ${durationSeconds}s clip` : ''}` : 'No block audio. Render can still use ElevenLabs from the caption.'}
                    </div>
                </div>
                <div className="flex flex-wrap gap-1">
                    {recordedClip && (
                        <button type="button" onClick={() => useClip('recorded')} disabled={disabled || activeSource === 'recorded'} className="rounded border border-blue-200 bg-white px-2 py-1 text-xs font-medium text-blue-800 hover:bg-blue-100 disabled:cursor-not-allowed disabled:opacity-50">
                            Use recorded
                        </button>
                    )}
                    {elevenLabsClip && (
                        <button type="button" onClick={() => useClip('elevenlabs')} disabled={disabled || activeSource === 'elevenlabs'} className="rounded border border-blue-200 bg-white px-2 py-1 text-xs font-medium text-blue-800 hover:bg-blue-100 disabled:cursor-not-allowed disabled:opacity-50">
                            Use ElevenLabs
                        </button>
                    )}
                </div>
            </div>

            {activeClip?.url && <audio controls src={activeClip.url} className="w-full" />}

            <div className="mt-3 flex flex-wrap gap-2">
                {isRecording ? (
                    <button type="button" onClick={stopRecording} className="rounded bg-red-700 px-2 py-1 text-xs font-medium text-white hover:bg-red-800">
                        Stop block recording
                    </button>
                ) : (
                    <button type="button" onClick={startRecording} disabled={disabled || isGenerating} className="rounded border border-blue-200 bg-white px-2 py-1 text-xs font-medium text-blue-800 hover:bg-blue-100 disabled:cursor-not-allowed disabled:opacity-50">
                        Record new audio
                    </button>
                )}
                <button type="button" onClick={generateElevenLabs} disabled={disabled || isRecording || isGenerating || !caption.trim()} className="rounded border border-blue-200 bg-white px-2 py-1 text-xs font-medium text-blue-800 hover:bg-blue-100 disabled:cursor-not-allowed disabled:opacity-50">
                    {isGenerating ? 'Generating...' : elevenLabsClip ? 'Regenerate ElevenLabs' : 'Generate ElevenLabs'}
                </button>
                <button type="button" onClick={transcribeActiveClip} disabled={disabled || isRecording || isGenerating || isTranscribing || !activeClip?.url} className="rounded border border-blue-200 bg-white px-2 py-1 text-xs font-medium text-blue-800 hover:bg-blue-100 disabled:cursor-not-allowed disabled:opacity-50">
                    {isTranscribing ? 'Transcribing...' : 'Transcribe audio'}
                </button>
                {recordedClip && (
                    <button type="button" onClick={() => clearClip('recorded')} disabled={disabled || isRecording || isGenerating} className="rounded border border-blue-200 bg-white px-2 py-1 text-xs font-medium text-blue-800 hover:bg-blue-100 disabled:cursor-not-allowed disabled:opacity-50">
                        Remove recorded
                    </button>
                )}
                {elevenLabsClip && (
                    <button type="button" onClick={() => clearClip('elevenlabs')} disabled={disabled || isRecording || isGenerating} className="rounded border border-blue-200 bg-white px-2 py-1 text-xs font-medium text-blue-800 hover:bg-blue-100 disabled:cursor-not-allowed disabled:opacity-50">
                        Remove ElevenLabs
                    </button>
                )}
            </div>

            {activeClip?.url && (
                <div className="mt-3 grid gap-3 sm:grid-cols-2">
                    <TextInput
                        type="number"
                        label="Trim start ms"
                        value={activeClip.trimStartMs ?? 0}
                        onChange={value => updateActiveClip({ trimStartMs: Math.max(0, Number(value || 0)) })}
                        disabled={disabled || isRecording}
                    />
                    <TextInput
                        type="number"
                        label="Trim end ms"
                        value={activeClip.trimEndMs ?? 0}
                        onChange={value => updateActiveClip({ trimEndMs: Math.max(0, Number(value || 0)) })}
                        disabled={disabled || isRecording}
                    />
                </div>
            )}

            <div className="mt-3 grid gap-3">
                <TextArea
                    label="Audio transcript"
                    value={transcript || ''}
                    onChange={onTranscriptChange}
                    rows={2}
                    placeholder="Quick transcription of the active audio clip."
                    disabled={disabled || isRecording}
                />
                <TextArea
                    label="VTT text"
                    value={vttText || ''}
                    onChange={onVttTextChange}
                    rows={2}
                    placeholder="Optional subtitle text. If empty, the caption is used."
                    disabled={disabled || isRecording}
                />
                {transcript && (
                    <button
                        type="button"
                        onClick={() => onVttTextChange(transcript)}
                        disabled={disabled || isRecording}
                        className="justify-self-start rounded border border-blue-200 bg-white px-2 py-1 text-xs font-medium text-blue-800 hover:bg-blue-100 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                        Use transcript as VTT text
                    </button>
                )}
            </div>

            <div className="mt-2 text-xs text-blue-700">
                Recorded clips are selected automatically when available. ElevenLabs is used when selected or when no recorded clip exists.
            </div>
        </div>
    )
}

const ScriptBlockEditor = ({
    block,
    index,
    total,
    onChange,
    onMove,
    onRemove,
    onInsert,
    onCopy,
    onCut,
    onPaste,
    onSaveRecording,
    onGenerateElevenLabs,
    onTranscribeAudio,
    blockRef,
    disabled = false
}) => {
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
        <section ref={blockRef} className="rounded border border-gray-200 bg-white p-4">
            <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
                <div>
                    <div className="text-sm font-semibold text-gray-900">Block {index + 1}</div>
                    <div className="mt-1 text-sm text-gray-500">
                        Caption only, action only, or caption plus action.
                    </div>
                </div>
                <div className="flex items-center gap-1">
                    <div className="mr-2 flex flex-wrap items-center gap-1 border-r border-gray-200 pr-2">
                        <button
                            type="button"
                            onClick={() => onInsert('before')}
                            disabled={disabled}
                            className="inline-flex items-center gap-1 rounded border border-gray-200 bg-white px-2 py-1 text-xs font-medium text-gray-600 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-40"
                        >
                            <Plus className="h-3.5 w-3.5" />
                            Add before
                        </button>
                        <button
                            type="button"
                            onClick={() => onInsert('after')}
                            disabled={disabled}
                            className="inline-flex items-center gap-1 rounded border border-gray-200 bg-white px-2 py-1 text-xs font-medium text-gray-600 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-40"
                        >
                            <Plus className="h-3.5 w-3.5" />
                            Add after
                        </button>
                    </div>
                    <div className="mr-2 flex flex-wrap items-center gap-1 border-r border-gray-200 pr-2">
                        <button
                            type="button"
                            onClick={onCopy}
                            disabled={disabled}
                            className="inline-flex h-9 w-9 items-center justify-center rounded text-gray-500 hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-40"
                            aria-label={`Copy block ${index + 1}`}
                            title="Copy block"
                        >
                            <Copy className="h-4 w-4" />
                        </button>
                        <button
                            type="button"
                            onClick={onCut}
                            disabled={disabled}
                            className="inline-flex h-9 w-9 items-center justify-center rounded text-gray-500 hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-40"
                            aria-label={`Cut block ${index + 1}`}
                            title="Cut block"
                        >
                            <Scissors className="h-4 w-4" />
                        </button>
                        <button
                            type="button"
                            onClick={() => onPaste('before')}
                            disabled={disabled}
                            className="inline-flex items-center gap-1 rounded border border-gray-200 bg-white px-2 py-1 text-xs font-medium text-gray-600 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-40"
                        >
                            <ClipboardPaste className="h-3.5 w-3.5" />
                            Paste before
                        </button>
                        <button
                            type="button"
                            onClick={() => onPaste('after')}
                            disabled={disabled}
                            className="inline-flex items-center gap-1 rounded border border-gray-200 bg-white px-2 py-1 text-xs font-medium text-gray-600 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-40"
                        >
                            <ClipboardPaste className="h-3.5 w-3.5" />
                            Paste after
                        </button>
                    </div>
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
                <div className="space-y-3">
                    <TextArea
                        label="Caption"
                        value={normalized.caption}
                        onChange={caption => onChange({ ...normalized, caption })}
                        rows={4}
                        placeholder="What should the video say here?"
                        disabled={disabled}
                    />
                    <BlockAudioEditor
                        audio={normalized.audio}
                        caption={normalized.caption}
                        transcript={normalized.transcript}
                        vttText={normalized.vttText}
                        index={index}
                        onChange={audio => onChange({ ...normalized, audio })}
                        onTranscriptChange={transcript => onChange({ ...normalized, transcript })}
                        onVttTextChange={vttText => onChange({ ...normalized, vttText })}
                        onSaveRecording={onSaveRecording}
                        onGenerateElevenLabs={onGenerateElevenLabs}
                        onTranscribeAudio={onTranscribeAudio}
                        disabled={disabled}
                    />
                </div>
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

const RecordingImportDialog = ({ run, onClose, onImport }) => {
    if (!run?.isOpen) return null

    const blocks = run.blocks || []
    const audioBlockCount = blocks.filter(block => block.audio?.url).length
    const referenceVideoUrl = run.referenceVideoUrl || run.rawVideoUrl
    const referenceVideoLabel = run.referenceVideoUrl ? 'Reference video with audio' : 'Raw reference video'

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-gray-950/60 px-4 py-6">
            <section className="w-full max-w-2xl rounded border border-gray-200 bg-white shadow-xl">
                <div className="border-b border-gray-200 px-5 py-4">
                    <h2 className="text-base font-semibold text-gray-900">Import recorded actions</h2>
                    <p className="mt-1 text-sm text-gray-500">
                        {blocks.length} action block{blocks.length === 1 ? '' : 's'} captured from the Playwright recording.
                        {audioBlockCount > 0 ? ` ${audioBlockCount} block${audioBlockCount === 1 ? '' : 's'} include recorded audio.` : ''}
                    </p>
                </div>
                <div className="space-y-4 px-5 py-4">
                    {referenceVideoUrl && (
                        <div className="rounded border border-blue-100 bg-blue-50 px-3 py-2 text-sm text-blue-900">
                            {referenceVideoLabel}:{' '}
                            <a href={referenceVideoUrl} target="_blank" rel="noopener noreferrer" className="font-medium text-blue-700 hover:text-blue-800">
                                Open recording
                            </a>
                        </div>
                    )}
                    <div className="max-h-72 overflow-auto rounded border border-gray-200 bg-gray-50">
                        {blocks.length ? blocks.map((block, index) => (
                            <div key={`${block.action?.type || 'caption'}-${index}`} className="border-b border-gray-200 px-3 py-2 last:border-b-0">
                                <div className="text-xs font-semibold uppercase text-gray-500">Block {index + 1}</div>
                                {block.audio?.url && <div className="mt-1 text-xs font-medium text-blue-700">Recorded audio clip attached</div>}
                                <pre className="mt-1 whitespace-pre-wrap font-mono text-xs text-gray-700">{JSON.stringify(block.action || null, null, 2)}</pre>
                            </div>
                        )) : (
                            <div className="px-3 py-6 text-center text-sm text-gray-500">No importable actions were captured.</div>
                        )}
                    </div>
                </div>
                <div className="flex flex-wrap items-center justify-end gap-2 border-t border-gray-200 px-5 py-4">
                    <button type="button" onClick={onClose} className="rounded border border-gray-200 bg-white px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50">
                        Cancel
                    </button>
                    <button
                        type="button"
                        onClick={() => onImport('replace')}
                        disabled={!blocks.length}
                        className="rounded border border-amber-200 bg-white px-3 py-2 text-sm font-medium text-amber-800 hover:bg-amber-50 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                        Replace script
                    </button>
                    <button
                        type="button"
                        onClick={() => onImport('append')}
                        disabled={!blocks.length}
                        className="rounded bg-gray-900 px-3 py-2 text-sm font-medium text-white hover:bg-gray-800 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                        Append to script
                    </button>
                </div>
            </section>
        </div>
    )
}

const RenderLogHistory = ({ logs = [], activeGuideId = '', activeLanguage = 'en', selectedLogId = '', onOpenLog, onRefresh }) => {
    const activeLogs = logs.filter(log => log.guideId === activeGuideId && (!activeLanguage || log.languages.includes(activeLanguage)))
    const otherLogs = logs.filter(log => !activeLogs.some(activeLog => activeLog.id === log.id))
    const orderedLogs = [...activeLogs, ...otherLogs]

    return (
        <section className="rounded border border-gray-200 bg-white p-4">
            <div className="mb-3 flex items-center justify-between gap-3">
                <div>
                    <h2 className="text-base font-semibold text-gray-900">Video logs</h2>
                    <p className="mt-1 text-sm text-gray-500">Previous video render runs saved on disk.</p>
                </div>
                <button
                    type="button"
                    onClick={onRefresh}
                    className="inline-flex h-8 w-8 items-center justify-center rounded border border-gray-200 text-gray-600 hover:bg-gray-50"
                    aria-label="Refresh video logs"
                    title="Refresh video logs"
                >
                    <RotateCcw className="h-4 w-4" />
                </button>
            </div>

            {orderedLogs.length === 0 ? (
                <div className="rounded bg-gray-50 px-3 py-2 text-sm text-gray-600">No video logs yet.</div>
            ) : (
                <div className="max-h-72 space-y-2 overflow-auto pr-1">
                    {orderedLogs.map(log => {
                        const isSelected = log.id === selectedLogId
                        const isCurrentGuide = log.guideId === activeGuideId
                        const statusClass = log.status === 'error'
                            ? 'bg-red-50 text-red-700 ring-red-100'
                            : log.status === 'success'
                            ? 'bg-green-50 text-green-700 ring-green-100'
                            : 'bg-gray-50 text-gray-700 ring-gray-100'

                        return (
                            <button
                                key={log.id}
                                type="button"
                                onClick={() => onOpenLog(log)}
                                className={`w-full rounded border px-3 py-2 text-left text-sm transition ${isSelected ? 'border-blue-300 bg-blue-50' : 'border-gray-200 bg-white hover:bg-gray-50'}`}
                            >
                                <div className="flex items-center justify-between gap-2">
                                    <span className="font-medium text-gray-900">{formatRenderLogTime(log.createdAt)}</span>
                                    <span className={`rounded px-2 py-0.5 text-xs font-semibold uppercase ring-1 ${statusClass}`}>
                                        {log.status || 'unknown'}
                                    </span>
                                </div>
                                <div className="mt-1 flex flex-wrap gap-x-2 gap-y-1 text-xs text-gray-500">
                                    <span>{log.guideId || 'unknown guide'}</span>
                                    <span>{(log.languages || []).join(', ') || 'unknown language'}</span>
                                    {isCurrentGuide && <span className="font-semibold text-blue-700">current</span>}
                                </div>
                            </button>
                        )
                    })}
                </div>
            )}
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

const FinishedPagePreview = ({ draft, language, preview }) => {
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
    const previewVideo = preview?.language === language
        ? {
            videoUrl: preview.videoUrl || '',
            captionsUrl: preview.captionsUrl || preview.subtitlesUrl || ''
        }
        : (preview?.videos || []).find(video => video.language === language)
    const currentVideo = previewVideo?.videoUrl || previewVideo?.captionsUrl
        ? {
            videoUrl: previewVideo.videoUrl || '',
            captionsUrl: previewVideo.captionsUrl || previewVideo.subtitlesUrl || ''
        }
        : draft.videoLinks?.[language] || {}
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

const RecordingOptionsDialog = ({
    isOpen,
    baseUrl,
    startUrl,
    withVoice,
    recordReferenceVideoWithAudio,
    onVoiceChange,
    onReferenceVideoChange,
    onClose,
    onStart
}) => {
    if (!isOpen) return null

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-gray-950/60 px-4 py-6">
            <section className="w-full max-w-md rounded border border-gray-200 bg-white shadow-xl">
                <div className="border-b border-gray-200 px-5 py-4">
                    <h2 className="text-base font-semibold text-gray-900">Record actions</h2>
                    <p className="mt-1 text-sm text-gray-500">
                        The recorder will open a visible browser window.
                    </p>
                </div>
                <div className="space-y-4 px-5 py-4">
                    <div className="rounded border border-gray-200 bg-gray-50 px-3 py-2 text-xs text-gray-600">
                        <div><span className="font-semibold text-gray-800">Base URL:</span> {baseUrl}</div>
                        <div className="mt-1"><span className="font-semibold text-gray-800">Start URL:</span> {startUrl || baseUrl}</div>
                    </div>
                    <label className="flex items-center gap-2 text-sm text-gray-700">
                        <input
                            type="checkbox"
                            checked={withVoice}
                            onChange={event => onVoiceChange(event.target.checked)}
                            className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                        />
                        Generate voice track
                    </label>
                    <label className="flex items-start gap-2 text-sm text-gray-700">
                        <input
                            type="checkbox"
                            checked={recordReferenceVideoWithAudio}
                            onChange={event => onReferenceVideoChange(event.target.checked)}
                            className="mt-0.5 h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                        />
                        <span>
                            <span className="block font-medium text-gray-800">Record reference video with microphone audio</span>
                            <span className="block text-xs text-gray-500">
                                Creates a separate raw recording for review; it is not published as the tutorial video.
                            </span>
                        </span>
                    </label>
                </div>
                <div className="flex items-center justify-end gap-2 border-t border-gray-200 px-5 py-4">
                    <button type="button" onClick={onClose} className="rounded border border-gray-200 bg-white px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50">
                        Cancel
                    </button>
                    <button type="button" onClick={onStart} className="inline-flex items-center gap-2 rounded bg-blue-700 px-3 py-2 text-sm font-medium text-white hover:bg-blue-800">
                        <MousePointerClick className="h-4 w-4" />
                        Start recording
                    </button>
                </div>
            </section>
        </div>
    )
}

const QualityPanel = ({
    draft,
    issues,
    preview,
    displayPreview,
    isRendering,
    isPublishing,
    activeLanguage,
    onRender,
    onPublish,
    videoOverride,
    isUploadingOverride,
    onUploadOverride,
    onRemoveOverride,
    demoSettings,
    onDemoSettingsChange,
    globalHoldMs,
    onGlobalHoldMsChange,
    isVideoExpanded,
    onToggleVideoExpanded,
    renderLogs,
    selectedRenderLogId,
    onOpenRenderLog,
    onRefreshRenderLogs
}) => {
    const overrideInputRef = useRef(null)
    const script = (draft.script || []).map(normalizeScriptBlock)
    const captions = script.filter(block => block.caption).length
    const actions = script.filter(block => block.action).length
    const both = script.filter(block => block.caption && block.action).length
    const hasErrors = issues.some(issue => issue.level === 'error')
    const hasVideoOverride = Boolean(videoOverride?.exists)

    return (
        <aside className="space-y-4">
            <section className="rounded border border-gray-200 bg-white p-4">
                <h2 className="text-base font-semibold text-gray-900">Review</h2>
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
                            Looks ready
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
                <input
                    ref={overrideInputRef}
                    type="file"
                    accept="video/mp4,.mp4"
                    className="hidden"
                    onChange={event => {
                        const file = event.target.files?.[0]
                        event.target.value = ''
                        if (file) onUploadOverride(file)
                    }}
                />
                <div className="mt-3 grid gap-3">
                    <TextInput
                        label="Demo base URL"
                        value={demoSettings.baseUrl}
                        onChange={baseUrl => onDemoSettingsChange({ ...demoSettings, baseUrl })}
                        placeholder="http://localhost:10100"
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
                    <TextInput
                        label="Global extra holdMs"
                        type="number"
                        value={globalHoldMs}
                        onChange={onGlobalHoldMsChange}
                        placeholder="0"
                        disabled={isRendering}
                    />
                </div>
                <div className={`mt-3 rounded border px-3 py-3 ${hasVideoOverride ? 'border-amber-200 bg-amber-50' : 'border-gray-200 bg-gray-50'}`}>
                    <div className="flex flex-wrap items-center justify-between gap-2">
                        <div>
                            <div className={`text-sm font-semibold ${hasVideoOverride ? 'text-amber-900' : 'text-gray-900'}`}>
                                MP4 override
                            </div>
                            <div className={`mt-1 text-xs ${hasVideoOverride ? 'text-amber-800' : 'text-gray-500'}`}>
                                {hasVideoOverride
                                    ? 'This page is locked to the uploaded MP4. Remove it to enable generation.'
                                    : 'Upload an MP4 to override generated videos for this page.'}
                            </div>
                        </div>
                        {hasVideoOverride && (
                            <span className="rounded bg-white px-2 py-1 text-xs font-semibold uppercase text-amber-800 ring-1 ring-amber-200">
                                Locked
                            </span>
                        )}
                    </div>
                    {hasVideoOverride && (
                        <code className="mt-2 block break-all text-xs text-amber-900">
                            {videoOverride.cleanVideoUrl || videoOverride.videoUrl}
                        </code>
                    )}
                    <div className="mt-3 grid gap-2 sm:grid-cols-2">
                        <button
                            type="button"
                            onClick={() => overrideInputRef.current?.click()}
                            disabled={isRendering || isUploadingOverride}
                            className="inline-flex w-full items-center justify-center gap-2 rounded border border-gray-200 bg-white px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-60"
                        >
                            <UploadCloud className="h-4 w-4" />
                            {isUploadingOverride ? 'Uploading...' : hasVideoOverride ? 'Replace MP4' : 'Upload MP4'}
                        </button>
                        <button
                            type="button"
                            onClick={onRemoveOverride}
                            disabled={isRendering || isUploadingOverride || !hasVideoOverride}
                            className="inline-flex w-full items-center justify-center gap-2 rounded border border-red-200 bg-white px-3 py-2 text-sm font-medium text-red-700 hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-50"
                        >
                            <Trash2 className="h-4 w-4" />
                            Remove override
                        </button>
                    </div>
                </div>
                <button
                    type="button"
                    onClick={onRender}
                    disabled={isRendering || isUploadingOverride || hasVideoOverride}
                    className="mt-3 inline-flex w-full items-center justify-center gap-2 rounded bg-blue-600 px-3 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
                    title={hasVideoOverride ? 'Remove the MP4 override before generating a video.' : undefined}
                >
                    <Film className="h-4 w-4" />
                    {isRendering ? 'Creating video...' : `Create ${activeLanguage.toUpperCase()} preview video`}
                </button>
                <VideoPlayer preview={displayPreview} />
                {hasVideoOverride && displayPreview?.videoUrl ? (
                    <div className="mt-2 rounded bg-amber-50 px-3 py-2 text-xs text-amber-800">
                        Showing the uploaded {activeLanguage.toUpperCase()} override video.
                    </div>
                ) : !preview?.videoUrl && displayPreview?.videoUrl && (
                    <div className="mt-2 rounded bg-gray-50 px-3 py-2 text-xs text-gray-600">
                        Showing the saved {activeLanguage.toUpperCase()} video from this markdown file.
                    </div>
                )}
                {displayPreview?.videoUrl && (
                    <div className="mt-3 grid gap-2 sm:grid-cols-2">
                        <button
                            type="button"
                            onClick={onToggleVideoExpanded}
                            className="inline-flex w-full items-center justify-center gap-2 rounded border border-gray-200 bg-white px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
                        >
                            {isVideoExpanded ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
                            {isVideoExpanded ? 'Collapse preview' : 'Expand preview'}
                        </button>
                        <a
                            href={displayPreview.videoUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex w-full items-center justify-center gap-2 rounded border border-gray-200 bg-white px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
                        >
                            <ExternalLink className="h-4 w-4" />
                            Open video
                        </a>
                    </div>
                )}
                {preview?.error && (
                    <div className="mt-3 rounded bg-red-50 px-3 py-2 text-sm text-red-800">{preview.error}</div>
                )}
            </section>

            <RenderLogHistory
                logs={renderLogs}
                activeGuideId={draft.id}
                activeLanguage={activeLanguage}
                selectedLogId={selectedRenderLogId}
                onOpenLog={onOpenRenderLog}
                onRefresh={onRefreshRenderLogs}
            />

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

    const navigate = useNavigate()
    const { guideId: routeGuideIdParam = '', language: routeLanguageParam = '' } = useParams()
    const scriptBlockRefs = useRef(new Map())
    const pendingScrollBlockIndex = useRef(null)
    const guideOptions = useMemo(getGuideOptions, [])
    const sectionOptions = useMemo(getSectionOptions, [])
    const firstGuide = guideOptions[0]
    const routeGuideId = routeGuideIdParam ? decodeURIComponent(routeGuideIdParam) : ''
    const routeLanguage = normalizeEditorLanguage(routeLanguageParam || DEFAULT_EDITOR_LANGUAGE)
    const initialGuideId = routeGuideId || editorSession.activeDraftKey.split('::')[0] || firstGuide?.guide?.id || ''
    const [openDrafts, setOpenDrafts] = useState(() => getInitialOpenDrafts(guideOptions, initialGuideId, routeLanguage))
    const [activeDraftKey, setActiveDraftKey] = useState(() => (
        editorSession.activeDraftKey || getDraftKey(initialGuideId, routeLanguage)
    ))
    const [withVoice, setWithVoice] = useState(true)
    const [isRendering, setIsRendering] = useState(false)
    const [previewById, setPreviewById] = useState(editorSession.previewByKey)
    const [expandedVideoById, setExpandedVideoById] = useState(editorSession.expandedVideoByKey)
    const [closedLogById, setClosedLogById] = useState(editorSession.closedLogByKey)
    const [videoOverrideById, setVideoOverrideById] = useState(editorSession.videoOverrideByKey)
    const [renderLogs, setRenderLogs] = useState(editorSession.renderLogs)
    const [selectedRenderLogId, setSelectedRenderLogId] = useState(editorSession.selectedRenderLogId)
    const [demoSettings, setDemoSettings] = useState(editorSession.demoSettings)
    const [globalHoldMs, setGlobalHoldMs] = useState(editorSession.globalHoldMs)
    const [isUploadingOverride, setIsUploadingOverride] = useState(false)
    const [isPublishing, setIsPublishing] = useState(false)
    const [isGeneratingDoc, setIsGeneratingDoc] = useState(false)
    const [isGeneratingBlock, setIsGeneratingBlock] = useState(false)
    const [codexBlockPrompt, setCodexBlockPrompt] = useState('')
    const [pendingBlockInsert, setPendingBlockInsert] = useState(null)
    const [codexPrompt, setCodexPrompt] = useState('')
    const [codexSectionId, setCodexSectionId] = useState(firstGuide?.section?.id || '')
    const [codexRun, setCodexRun] = useState({ log: '', error: '', finalMessage: '' })
    const [isCodexLogClosed, setIsCodexLogClosed] = useState(false)
    const [isTranslating, setIsTranslating] = useState(false)
    const [translationRun, setTranslationRun] = useState({ log: '', error: '' })
    const [isTranslationLogClosed, setIsTranslationLogClosed] = useState(false)
    const [undoInfo, setUndoInfo] = useState(null)
    const [processLogSource, setProcessLogSource] = useState('video')
    const [loadGuideId, setLoadGuideId] = useState('')
    const [openLeftPanels, setOpenLeftPanels] = useState({ codex: false, browser: true })
    const [saveAsState, setSaveAsState] = useState({
        isOpen: false,
        guideId: '',
        overwrite: false,
        error: '',
        isSaving: false
    })
    const [pendingMetadataChange, setPendingMetadataChange] = useState(null)
    const [isApplyingMetadataChange, setIsApplyingMetadataChange] = useState(false)
    const [isRecordingActions, setIsRecordingActions] = useState(false)
    const [isRecordingOptionsOpen, setIsRecordingOptionsOpen] = useState(false)
    const [recordingRun, setRecordingRun] = useState(editorSession.recordingRun)
    const [recordingImport, setRecordingImport] = useState({ isOpen: false, blocks: [], rawVideoUrl: '', rawVideoPath: '', referenceVideoUrl: '', referenceVideoPath: '', id: '' })

    const activeDraft = openDrafts.find(draft => getDraftSessionKey(draft) === activeDraftKey) || openDrafts[0]
    const activePreviewKey = activeDraft ? getDraftSessionKey(activeDraft) : activeDraftKey
    const activeDraftLanguage = activeDraft?.language || 'en'
    const issues = useMemo(() => activeDraft ? validateScriptDraft(activeDraft) : [], [activeDraft])
    const markdown = useMemo(() => activeDraft ? createMarkdownFromDraft(activeDraft) : '', [activeDraft])
    const readableSourcePath = getReadableSourcePath(activeDraft?.sourcePath)
    const preview = activeDraft ? previewById[activePreviewKey] : null
    const videoOverride = activeDraft ? videoOverrideById[activePreviewKey] : null
    const selectedRenderLog = renderLogs.find(log => log.id === selectedRenderLogId)
    const languagePreview = preview?.language === activeDraftLanguage ? preview : null
    const storedVideoLink = activeDraft?.videoLinks?.[activeDraftLanguage] || {}
    const shouldUseStoredVideoLink = storedVideoLink.videoUrl
        && (!isOverrideVideoUrl(storedVideoLink.videoUrl) || videoOverride?.exists)
    const overridePreview = videoOverride?.exists ? {
        videoUrl: videoOverride.videoUrl,
        subtitlesUrl: '',
        captionsUrl: '',
        language: activeDraftLanguage,
        isOverride: true,
        videos: [{
            language: activeDraftLanguage,
            videoUrl: videoOverride.cleanVideoUrl || videoOverride.videoUrl,
            captionsUrl: '',
            isOverride: true
        }]
    } : null
    const storedPreview = shouldUseStoredVideoLink ? {
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
    const displayPreview = overridePreview
        || (languagePreview?.videoUrl
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
        : languagePreview)
    const isVideoExpanded = activeDraft ? Boolean(expandedVideoById[activePreviewKey]) : false
    const isVideoLogOpen = activeDraft ? isRendering || (Boolean(preview?.log || preview?.error) && !closedLogById[activePreviewKey]) : false
    const isCodexLogOpen = isGeneratingDoc || isGeneratingBlock || (Boolean(codexRun.log || codexRun.error) && !isCodexLogClosed)
    const isTranslationLogOpen = isTranslating || (Boolean(translationRun.log || translationRun.error) && !isTranslationLogClosed)
    const isRenderHistoryLogOpen = processLogSource === 'video-history' && Boolean(selectedRenderLog)
    const isRecordingLogOpen = processLogSource === 'recording' && Boolean(isRecordingActions || recordingRun.log || recordingRun.error)
    const isLogOpen = processLogSource === 'codex'
        ? isCodexLogOpen
        : processLogSource === 'translation'
        ? isTranslationLogOpen
        : processLogSource === 'recording'
        ? isRecordingLogOpen
        : processLogSource === 'video-history'
        ? isRenderHistoryLogOpen
        : isVideoLogOpen
    const processLog = processLogSource === 'codex'
        ? codexRun.log
        : processLogSource === 'translation'
        ? translationRun.log
        : processLogSource === 'recording'
        ? recordingRun.log || ''
        : processLogSource === 'video-history'
        ? selectedRenderLog?.log || ''
        : preview?.log || ''
    const processError = processLogSource === 'codex'
        ? codexRun.error
        : processLogSource === 'translation'
        ? translationRun.error
        : processLogSource === 'recording'
        ? recordingRun.error
        : processLogSource === 'video-history'
        ? selectedRenderLog?.error || ''
        : preview?.error || ''
    const isProcessRunning = processLogSource === 'codex'
        ? isGeneratingDoc || isGeneratingBlock
        : processLogSource === 'translation'
        ? isTranslating
        : processLogSource === 'recording'
        ? isRecordingActions
        : processLogSource === 'video-history'
        ? false
        : isRendering
    const processStatusText = processLogSource === 'codex'
        ? isGeneratingBlock ? 'Codex is writing a script block...' : 'Codex is writing a help document...'
        : processLogSource === 'translation'
        ? 'Translating markdown with Haiku...'
        : processLogSource === 'recording'
        ? 'Recording browser actions...'
        : processLogSource === 'video-history'
        ? 'Viewing saved video render log'
        : 'Rendering video...'
    const processDoneText = processLogSource === 'codex'
        ? 'Codex finished'
        : processLogSource === 'translation'
        ? 'Translation complete'
        : processLogSource === 'recording'
        ? 'Action recording complete'
        : processLogSource === 'video-history'
        ? `${selectedRenderLog?.status === 'error' ? 'Saved failed render' : 'Saved render'} ${selectedRenderLog ? formatRenderLogTime(selectedRenderLog.createdAt) : ''}`
        : 'Render complete'
    const codexBlockInsertLabel = pendingBlockInsert
        ? pendingBlockInsert.insertIndex <= 0
            ? 'The generated block will be inserted before the first block.'
            : pendingBlockInsert.insertIndex >= (activeDraft?.script || []).length
            ? 'The generated block will be inserted after the last block.'
            : `The generated block will be inserted between block ${pendingBlockInsert.insertIndex} and ${pendingBlockInsert.insertIndex + 1}.`
        : ''
    const pagePreviewLanguage = activeDraftLanguage
    const renderLanguages = [activeDraftLanguage]
    const translationTargetLanguage = activeDraftLanguage === DEFAULT_EDITOR_LANGUAGE ? 'sv' : DEFAULT_EDITOR_LANGUAGE
    const translationButtonLabel = activeDraftLanguage === DEFAULT_EDITOR_LANGUAGE
        ? 'Translate to Swedish'
        : 'Translate to English'
    const browserSections = useMemo(() => sectionOptions.map(section => {
        const docsSection = howToDocs.find(candidate => candidate.id === section.id)
        const guides = [...(docsSection?.guides || [])]

        openDrafts
            .filter(draft => draft.sourcePath && draft.sectionId === section.id)
            .forEach(draft => {
                if (guides.some(guide => guide.id === draft.id)) return
                guides.push({
                    id: draft.id,
                    title: draft.title || draft.id,
                    summary: draft.summary || '',
                    order: Number(draft.order || 999),
                    sourcePath: draft.sourcePath
                })
            })

        return {
            ...section,
            guides: guides.sort((a, b) => Number(a.order || 999) - Number(b.order || 999) || a.title.localeCompare(b.title))
        }
    }), [openDrafts, sectionOptions])

    const toggleLeftPanel = (panel) => {
        setOpenLeftPanels(current => ({
            ...current,
            [panel]: !current[panel]
        }))
    }

    const loadRenderLogs = async () => {
        const response = await fetch('/__howto-script-editor/render-logs')
        const data = await response.json()

        if (!response.ok) throw new Error(data.error || 'Could not load video render logs')

        setRenderLogs(Array.isArray(data.logs) ? data.logs : [])
    }

    const openRenderLog = (log) => {
        setSelectedRenderLogId(log.id)
        setProcessLogSource('video-history')
    }

    useEffect(() => {
        if (!firstGuide) return

        if (!routeGuideIdParam) {
            const [sessionGuideId, sessionLanguage] = editorSession.activeDraftKey.split('::')
            navigate(
                getScriptEditorPath(sessionGuideId || firstGuide.guide.id, sessionLanguage || routeLanguage),
                { replace: true }
            )
            return
        }

        const option = getGuideOptionById(guideOptions, routeGuideId)
        const draftForRoute = openDrafts.find(draft => (
            draft.id === routeGuideId
            && normalizeEditorLanguage(draft.language || DEFAULT_EDITOR_LANGUAGE) === routeLanguage
        ))

        if (!option && draftForRoute) {
            setActiveDraftKey(getDraftSessionKey(draftForRoute))
            return
        }

        if (!option) {
            navigate(getScriptEditorPath(firstGuide.guide.id, routeLanguage), { replace: true })
            return
        }

        const nextDraftKey = getDraftKey(option.guide.id, routeLanguage)
        setOpenDrafts(current => ensureDraftForRoute(current, guideOptions, option.guide.id, routeLanguage))
        setActiveDraftKey(nextDraftKey)
    }, [firstGuide, guideOptions, navigate, openDrafts, routeGuideId, routeGuideIdParam, routeLanguage])

    useEffect(() => {
        const drafts = openDrafts.map(cloneDraft)
        editorSession.openDrafts = drafts
        editorSession.activeDraftKey = activeDraftKey
        drafts.forEach(draft => {
            editorSession.draftsByKey.set(getDraftSessionKey(draft), cloneDraft(draft))
        })
    }, [activeDraftKey, openDrafts])

    useEffect(() => {
        editorSession.previewByKey = previewById
    }, [previewById])

    useEffect(() => {
        editorSession.expandedVideoByKey = expandedVideoById
    }, [expandedVideoById])

    useEffect(() => {
        editorSession.closedLogByKey = closedLogById
    }, [closedLogById])

    useEffect(() => {
        editorSession.videoOverrideByKey = videoOverrideById
    }, [videoOverrideById])

    useEffect(() => {
        editorSession.renderLogs = renderLogs
    }, [renderLogs])

    useEffect(() => {
        editorSession.selectedRenderLogId = selectedRenderLogId
    }, [selectedRenderLogId])

    useEffect(() => {
        loadRenderLogs().catch(() => {})
    }, [])

    useEffect(() => {
        editorSession.demoSettings = demoSettings
    }, [demoSettings])

    useEffect(() => {
        editorSession.globalHoldMs = globalHoldMs
    }, [globalHoldMs])

    useEffect(() => {
        editorSession.recordingRun = recordingRun
    }, [recordingRun])

    useEffect(() => {
        if (!isRecordingActions || !recordingRun.id) return

        let cancelled = false
        const pollRecording = async () => {
            try {
                const response = await fetch(`/__howto-script-editor/record/${recordingRun.id}/events?baseUrl=${encodeURIComponent(demoSettings.baseUrl)}`)
                const data = await response.json()

                if (cancelled || !response.ok) return

                setRecordingRun(current => ({
                    ...current,
                    ...data,
                    log: data.log || current.log || ''
                }))

                if (['closed', 'stopped', 'error'].includes(data.status)) {
                    setIsRecordingActions(false)
                    setRecordingImport({
                        isOpen: true,
                        id: data.id,
                        blocks: data.blocks || [],
                        rawVideoUrl: data.rawVideoUrl || '',
                        rawVideoPath: data.rawVideoPath || '',
                        referenceVideoUrl: data.referenceVideoUrl || '',
                        referenceVideoPath: data.referenceVideoPath || ''
                    })
                }
            } catch {
                // Polling should not interrupt the recording session.
            }
        }
        const interval = window.setInterval(pollRecording, 1000)
        pollRecording()

        return () => {
            cancelled = true
            window.clearInterval(interval)
        }
    }, [demoSettings.baseUrl, isRecordingActions, recordingRun.id])

    useEffect(() => {
        if (pendingScrollBlockIndex.current === null) return

        const index = pendingScrollBlockIndex.current
        pendingScrollBlockIndex.current = null
        requestAnimationFrame(() => {
            const blockElement = scriptBlockRefs.current.get(index)
            blockElement?.scrollIntoView({ behavior: 'smooth', block: 'center' })
            blockElement?.querySelector('textarea')?.focus({ preventScroll: true })
        })
    }, [activeDraft?.script])

    useEffect(() => {
        if (!activeDraft?.id || !activeDraft.sectionId) return

        let cancelled = false

        const loadVideoOverride = async () => {
            try {
                const response = await fetch('/__howto-script-editor/video-override-status', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        guideId: activeDraft.id,
                        sectionId: activeDraft.sectionId,
                        language: activeDraftLanguage
                    })
                })
                const data = await response.json()

                if (cancelled || !response.ok) return

                setVideoOverrideById(current => ({
                    ...current,
                    [activePreviewKey]: data
                }))
            } catch {
                // Override state is a convenience for the local editor; missing status should not break editing.
            }
        }

        loadVideoOverride()

        return () => {
            cancelled = true
        }
    }, [activeDraft?.id, activeDraft?.sectionId, activeDraftLanguage, activePreviewKey])

    useEffect(() => {
        if (!activeDraft?.id || !activeDraft.sectionId) return
        if (videoOverride?.exists) return
        const activeVideoUrl = activeDraft.videoLinks?.[activeDraftLanguage]?.videoUrl || ''
        if (activeVideoUrl && !isOverrideVideoUrl(activeVideoUrl)) return

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
                    [activePreviewKey]: current[activePreviewKey]?.videoUrl && current[activePreviewKey]?.language === activeDraftLanguage ? current[activePreviewKey] : {
                        ...(current[activePreviewKey] || {}),
                        videoUrl: generatedVideo.videoUrl,
                        subtitlesUrl: generatedVideo.captionsUrl,
                        captionsUrl: generatedVideo.captionsUrl,
                        language: activeDraftLanguage,
                        videos: [generatedVideo]
                    }
                }))
            } catch {
                // Missing generated videos should not interrupt editing.
            }
        }

        loadGeneratedVideo()

        return () => {
            cancelled = true
        }
    }, [activeDraft?.id, activeDraft?.sectionId, activeDraft?.videoLinks, activeDraftLanguage, activePreviewKey, videoOverride?.exists])

    const updateDemoSettings = (settings) => {
        setDemoSettings(settings)
    }

    const updateRecordReferenceVideoWithAudio = (recordReferenceVideoWithAudio) => {
        setDemoSettings(current => ({
            ...current,
            recordReferenceVideoWithAudio
        }))
    }

    const updateGlobalHoldMs = (value) => {
        const numericValue = Number(value)
        setGlobalHoldMs(Number.isFinite(numericValue) && numericValue > 0 ? numericValue : 0)
    }

    const updateActiveDraft = (updates) => {
        if (isRendering) return
        setOpenDrafts(current => current.map(draft => (
            getDraftSessionKey(draft) === activePreviewKey ? { ...draft, ...updates } : draft
        )))
    }

    const clearCurrentVideoState = () => {
        setPreviewById(current => {
            const next = { ...current }
            delete next[activePreviewKey]
            return next
        })
        setExpandedVideoById(current => ({ ...current, [activePreviewKey]: false }))
        setClosedLogById(current => ({ ...current, [activePreviewKey]: true }))
    }

    const videoOverrideUrl = (draft = activeDraft, language = activeDraftLanguage) => {
        const params = new URLSearchParams({
            guideId: draft?.id || '',
            sectionId: draft?.sectionId || '',
            language
        })

        return `/__howto-script-editor/video-override?${params.toString()}`
    }

    const applyVideoOverrideState = (data) => {
        setVideoOverrideById(current => ({
            ...current,
            [activePreviewKey]: data
        }))
    }

    const uploadVideoOverride = async (file) => {
        if (!activeDraft || isRendering || isUploadingOverride) return
        if (!file?.name?.toLowerCase().endsWith('.mp4') && file?.type !== 'video/mp4') {
            toast.error('Only MP4 files can be uploaded as overrides')
            return
        }

        setIsUploadingOverride(true)

        try {
            const response = await fetch(videoOverrideUrl(), {
                method: 'POST',
                headers: { 'Content-Type': file.type || 'video/mp4' },
                body: file
            })
            const data = await response.json()

            if (!response.ok) throw new Error(data.error || 'Could not upload MP4 override')

            applyVideoOverrideState(data)
            updateActiveDraft({
                videoLinks: {
                    ...(activeDraft.videoLinks || {}),
                    [activeDraftLanguage]: {
                        videoUrl: data.cleanVideoUrl || data.videoUrl,
                        captionsUrl: ''
                    }
                }
            })
            setPreviewById(current => ({
                ...current,
                [activePreviewKey]: {
                    ...(current[activePreviewKey] || {}),
                    videoUrl: data.videoUrl,
                    subtitlesUrl: '',
                    captionsUrl: '',
                    language: activeDraftLanguage,
                    videos: [{
                        language: activeDraftLanguage,
                        videoUrl: data.cleanVideoUrl || data.videoUrl,
                        captionsUrl: '',
                        isOverride: true
                    }]
                }
            }))
            setExpandedVideoById(current => ({ ...current, [activePreviewKey]: true }))
            toast.success('MP4 override uploaded')
        } catch (error) {
            toast.error(error.message)
        } finally {
            setIsUploadingOverride(false)
        }
    }

    const removeVideoOverride = async () => {
        if (!activeDraft || isRendering || isUploadingOverride || !videoOverride?.exists) return
        if (!window.confirm('Remove the MP4 override and enable generated videos for this page again?')) return

        setIsUploadingOverride(true)

        try {
            const response = await fetch(videoOverrideUrl(), { method: 'DELETE' })
            const data = await response.json()

            if (!response.ok) throw new Error(data.error || 'Could not remove MP4 override')

            const nextVideoLinks = { ...(activeDraft.videoLinks || {}) }
            if (isOverrideVideoUrl(nextVideoLinks[activeDraftLanguage]?.videoUrl)) {
                delete nextVideoLinks[activeDraftLanguage]
            }

            applyVideoOverrideState(data)
            updateActiveDraft({ videoLinks: nextVideoLinks })
            clearCurrentVideoState()
            toast.success('MP4 override removed')
        } catch (error) {
            toast.error(error.message)
        } finally {
            setIsUploadingOverride(false)
        }
    }

    const requestSectionChange = (sectionId) => {
        if (isRendering || !activeDraft) return

        const currentSectionId = activeDraft.sectionId || ''
        if (sectionId === currentSectionId) return

        const section = getSectionOption(sectionOptions, sectionId)
        if (!section) return

        const nextVideoLinks = { ...(activeDraft.videoLinks || {}) }
        delete nextVideoLinks[activeDraftLanguage]

        setPendingMetadataChange({
            kind: 'section',
            previousSectionTitle: activeDraft.sectionTitle || currentSectionId,
            nextSectionTitle: section.title || section.id,
            nextDraft: {
                ...activeDraft,
                sectionId: section.id,
                sectionTitle: section.title || section.id,
                sectionSummary: section.summary || '',
                sectionOrder: section.order ?? 999,
                videoLinks: nextVideoLinks
            }
        })
    }

    const cancelMetadataChange = () => {
        setPendingMetadataChange(null)
    }

    const applyMetadataChange = () => {
        if (!pendingMetadataChange || isRendering) return

        setIsApplyingMetadataChange(true)
        const nextDraft = withDraftSessionKey(
            pendingMetadataChange.nextDraft,
            pendingMetadataChange.nextDraft.id,
            pendingMetadataChange.nextDraft.language || activeDraftLanguage
        )
        const nextDraftKey = getDraftSessionKey(nextDraft)
        setOpenDrafts(current => current.map(draft => (
            getDraftSessionKey(draft) === activePreviewKey ? nextDraft : draft
        )))
        clearCurrentVideoState()
        navigate(getScriptEditorPath(nextDraft.id, nextDraft.language || activeDraftLanguage), { replace: true })
        editorSession.activeDraftKey = nextDraftKey
        setActiveDraftKey(nextDraftKey)
        setPendingMetadataChange(null)
        setIsApplyingMetadataChange(false)
    }

    const upsertDraft = (nextDraft, options = {}) => {
        const shouldActivate = options.activate !== false
        const preparedDraft = withDraftSessionKey(
            nextDraft,
            options.guideId || nextDraft.id,
            nextDraft.language || options.language || DEFAULT_EDITOR_LANGUAGE
        )
        const nextDraftKey = getDraftSessionKey(preparedDraft)

        setOpenDrafts(current => (
            current.some(draft => getDraftSessionKey(draft) === nextDraftKey)
                ? current.map(draft => getDraftSessionKey(draft) === nextDraftKey ? preparedDraft : draft)
                : [...current, preparedDraft]
        ))
        editorSession.draftsByKey.set(nextDraftKey, cloneDraft(preparedDraft))
        if (shouldActivate) setActiveDraftKey(nextDraftKey)

        return preparedDraft
    }

    const updateScript = (script) => updateActiveDraft({ script: script.map(normalizeScriptBlock) })

    const openCodexBlockModal = (insertIndex) => {
        if (isRendering || isGeneratingBlock || isGeneratingDoc) return

        setPendingBlockInsert({ insertIndex })
        setCodexBlockPrompt('')
    }

    const closeCodexBlockModal = () => {
        if (isGeneratingBlock) return

        setPendingBlockInsert(null)
        setCodexBlockPrompt('')
    }

    const requestCodexScriptBlock = async ({ insertIndex, userPrompt }) => {
        if (isRendering || isGeneratingBlock || isGeneratingDoc) return

        const blockKind = 'block'
        const trimmedPrompt = userPrompt?.trim()

        if (!trimmedPrompt) return

        const script = (activeDraft.script || []).map(normalizeScriptBlock)
        const nearbyBlocks = {
            before: script.slice(Math.max(0, insertIndex - 2), insertIndex),
            after: script.slice(insertIndex, insertIndex + 2),
            requestedInsertIndex: insertIndex
        }

        setProcessLogSource('codex')
        setIsCodexLogClosed(false)
        setIsGeneratingBlock(true)
        setCodexRun({ log: '', error: '', finalMessage: '' })

        try {
            const appendLog = (text) => {
                setCodexRun(current => ({
                    ...current,
                    log: `${current.log || ''}${text}`
                }))
            }
            const response = await fetch('/__howto-script-editor/generate-block', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    prompt: trimmedPrompt,
                    blockKind,
                    language: activeDraftLanguage,
                    draft: {
                        id: activeDraft.id,
                        title: activeDraft.title,
                        summary: activeDraft.summary,
                        sectionId: activeDraft.sectionId,
                        sectionTitle: activeDraft.sectionTitle,
                        language: activeDraftLanguage
                    },
                    nearbyBlocks
                })
            })

            if (!response.ok || !response.body) {
                const data = await response.json().catch(() => ({}))
                throw new Error(data.error || 'Could not generate script block')
            }

            const reader = response.body.getReader()
            const decoder = new TextDecoder()
            let buffer = ''
            let completed = false
            let inserted = false

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
                        const generatedBlock = normalizeScriptBlock(event.block || createScriptBlock(null))
                        const nextScript = [...script]
                        nextScript.splice(insertIndex, 0, generatedBlock)
                        pendingScrollBlockIndex.current = insertIndex
                        updateScript(nextScript)
                        inserted = true
                        setCodexRun(current => ({
                            ...current,
                            finalMessage: 'Inserted generated script block.'
                        }))
                        toast.success('Codex added a script block')
                    } else if (event.type === 'error') {
                        throw new Error(event.error || 'Could not generate script block')
                    }
                }

                completed = done
            }

            if (buffer.trim()) {
                const event = JSON.parse(buffer)
                if (event.type === 'error') throw new Error(event.error || 'Could not generate script block')
            }

            if (!inserted) throw new Error('Codex did not return a script block')
        } catch (error) {
            setCodexRun(current => ({ ...current, error: error.message }))
            toast.error(error.message)
        } finally {
            setIsGeneratingBlock(false)
        }
    }

    const submitCodexScriptBlock = () => {
        const trimmedPrompt = codexBlockPrompt.trim()
        if (!trimmedPrompt || !pendingBlockInsert) return

        const insertIndex = pendingBlockInsert.insertIndex
        setPendingBlockInsert(null)
        setCodexBlockPrompt('')
        requestCodexScriptBlock({ insertIndex, userPrompt: trimmedPrompt })
    }

    const saveRecordedBlockAudio = async ({ blob, mimeType, durationMs, index }) => {
        const base64 = await blobToBase64(blob)
        const response = await fetch('/__howto-script-editor/block-audio/recorded', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                base64,
                mimeType,
                durationMs,
                guideId: activeDraft?.id || 'guide',
                language: activeDraftLanguage,
                blockIndex: index
            })
        })
        const data = await response.json().catch(() => ({}))
        if (!response.ok) throw new Error(data.error || 'Could not save recorded audio')
        return data.audio
    }

    const generateBlockElevenLabsAudio = async ({ caption, index }) => {
        const response = await fetch('/__howto-script-editor/block-audio/elevenlabs', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                text: caption,
                guideId: activeDraft?.id || 'guide',
                language: activeDraftLanguage,
                blockIndex: index
            })
        })
        const data = await response.json().catch(() => ({}))
        if (!response.ok) throw new Error(data.error || 'Could not generate ElevenLabs audio')
        return data.audio
    }

    const transcribeBlockAudio = async ({ audioUrl }) => {
        const response = await fetch('/__howto-script-editor/block-audio/transcribe', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                audioUrl,
                language: activeDraftLanguage
            })
        })
        const data = await response.json().catch(() => ({}))
        if (!response.ok) throw new Error(data.error || 'Could not transcribe audio')
        return data.transcript?.text || ''
    }

    const openGuide = (option) => {
        if (isRendering) return
        const language = activeDraftLanguage || routeLanguage
        const nextDraftKey = getDraftKey(option.guide.id, language)

        if (!openDrafts.some(draft => getDraftSessionKey(draft) === nextDraftKey)) {
            const draft = editorSession.draftsByKey.get(nextDraftKey)
                ? cloneDraft(editorSession.draftsByKey.get(nextDraftKey))
                : loadDraftForGuide(option, language)
            upsertDraft(draft, { activate: false, guideId: option.guide.id, language })
        }

        navigate(getScriptEditorPath(option.guide.id, language))
    }

    const openGuideByGuideId = async (event) => {
        event.preventDefault()
        if (isRendering) return

        const guideId = normalizeGuideIdInput(loadGuideId)
        if (!guideId) return

        const language = activeDraftLanguage || routeLanguage
        const option = getGuideOptionById(guideOptions, guideId)
        if (option) {
            openGuide(option)
            return
        }

        try {
            const endpoint = language === DEFAULT_EDITOR_LANGUAGE
                ? '/__howto-script-editor/open-source'
                : '/__howto-script-editor/open-translation'
            const response = await fetch(endpoint, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    guideId,
                    sectionId: activeDraft?.sectionId || '',
                    language
                })
            })
            const data = await response.json()

            if (!response.ok) throw new Error(data.error || 'Could not load manuscript')
            if (data.exists === false) throw new Error(`No ${language.toUpperCase()} manuscript found for ${guideId}`)

            const draft = withWorkingLanguage(draftFromMarkdown(data.markdown, data.sourcePath, language, guideId), language)
            upsertDraft(draft, { guideId: draft.id, language })
            setLoadGuideId('')
            navigate(getScriptEditorPath(draft.id, language))
            toast.success(`Opened ${draft.id}`)
        } catch (error) {
            toast.error(error.message)
        }
    }

    const closeDraft = (draftKey) => {
        if (isRendering) return
        const next = openDrafts.filter(draft => getDraftSessionKey(draft) !== draftKey)
        setOpenDrafts(next)
        if (activePreviewKey === draftKey) {
            const nextDraft = next[0]
            if (nextDraft) {
                navigate(getScriptEditorPath(nextDraft.id, nextDraft.language || DEFAULT_EDITOR_LANGUAGE))
            } else if (firstGuide) {
                navigate(getScriptEditorPath(firstGuide.guide.id, routeLanguage), { replace: true })
            }
        }
    }

    const addBlock = () => {
        const script = activeDraft.script || []
        openCodexBlockModal(script.length)
    }

    const insertBlock = (index, position) => {
        const insertIndex = position === 'before' ? index : index + 1
        openCodexBlockModal(insertIndex)
    }

    const copyScriptBlock = async (index, { cut = false } = {}) => {
        if (isRendering || isGeneratingBlock || !activeDraft) return

        const script = activeDraft.script || []
        const block = normalizeScriptBlock(script[index])

        if (!block.caption && !block.action) {
            toast.error('Block is empty')
            return
        }

        try {
            editorSession.scriptBlockClipboard = cloneDraft(block)
            let sessionClipboardOnly = false

            try {
                await writeClipboardText(serializeScriptBlockForClipboard(block))
            } catch {
                sessionClipboardOnly = true
            }

            if (cut) {
                const nextScript = script.filter((_, candidateIndex) => candidateIndex !== index)
                updateScript(nextScript.length ? nextScript : [createScriptBlock(null)])
                toast.success(sessionClipboardOnly ? 'Block cut for this editor session' : 'Block cut')
                return
            }

            toast.success(sessionClipboardOnly ? 'Block copied for this editor session' : 'Block copied')
        } catch {
            toast.error(cut ? 'Could not cut block' : 'Could not copy block')
        }
    }

    const pasteScriptBlock = async (index, position) => {
        if (isRendering || isGeneratingBlock || !activeDraft) return

        const insertIndex = position === 'before' ? index : index + 1

        try {
            let block = null

            try {
                block = parseScriptBlockFromClipboard(await readClipboardText())
            } catch (clipboardError) {
                if (!editorSession.scriptBlockClipboard) throw clipboardError
                block = normalizeScriptBlock(editorSession.scriptBlockClipboard)
            }

            const script = [...(activeDraft.script || [])]
            script.splice(insertIndex, 0, block)
            pendingScrollBlockIndex.current = insertIndex
            updateScript(script)
            toast.success('Block pasted')
        } catch (error) {
            toast.error(error.message || 'Could not paste block')
        }
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

    const startActionRecording = async () => {
        if (isRendering || isRecordingActions || isGeneratingBlock || !activeDraft) return

        setIsRecordingOptionsOpen(false)
        setProcessLogSource('recording')
        setRecordingRun({
            id: '',
            log: `Starting action recorder against ${demoSettings.baseUrl}\nStart URL: ${activeDraft.startUrl || demoSettings.baseUrl}\nReference video with audio: ${demoSettings.recordReferenceVideoWithAudio ? 'on' : 'off'}\n`,
            error: '',
            blocks: [],
            rawVideoUrl: '',
            rawVideoPath: '',
            referenceVideoUrl: '',
            referenceVideoPath: '',
            status: 'starting'
        })
        setIsRecordingActions(true)

        try {
            const response = await fetch('/__howto-script-editor/record/start', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    ...demoSettings,
                    startUrl: activeDraft.startUrl || ''
                })
            })
            const data = await response.json()

            if (!response.ok) throw new Error(data.error || 'Could not start action recorder')

            setRecordingRun(current => ({
                ...current,
                ...data,
                log: data.log || current.log
            }))
            toast.success('Action recorder started')
        } catch (error) {
            setIsRecordingActions(false)
            setRecordingRun(current => ({ ...current, error: error.message, status: 'error' }))
            toast.error(error.message)
        }
    }

    const stopActionRecording = async () => {
        if (!recordingRun.id) return

        setProcessLogSource('recording')
        setRecordingRun(current => ({
            ...current,
            log: `${current.log || ''}\nStopping action recorder...\n`,
            status: 'stopping'
        }))

        try {
            const response = await fetch('/__howto-script-editor/record/stop', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    id: recordingRun.id,
                    baseUrl: demoSettings.baseUrl,
                    recordReferenceVideoWithAudio: Boolean(demoSettings.recordReferenceVideoWithAudio)
                })
            })
            const data = await response.json()

            if (!response.ok) throw new Error(data.error || 'Could not stop action recorder')

            setIsRecordingActions(false)
            setRecordingRun(current => ({
                ...current,
                ...data,
                log: data.log || current.log || '',
                status: data.status || 'stopped'
            }))
            setRecordingImport({
                isOpen: true,
                id: data.id,
                blocks: data.blocks || [],
                rawVideoUrl: data.rawVideoUrl || '',
                rawVideoPath: data.rawVideoPath || '',
                referenceVideoUrl: data.referenceVideoUrl || '',
                referenceVideoPath: data.referenceVideoPath || ''
            })
            toast.success(`Captured ${(data.blocks || []).length} action block${(data.blocks || []).length === 1 ? '' : 's'}`)
        } catch (error) {
            setIsRecordingActions(false)
            setRecordingRun(current => ({ ...current, error: error.message, status: 'error' }))
            toast.error(error.message)
        }
    }

    const closeRecordingImport = () => {
        setRecordingImport({ isOpen: false, blocks: [], rawVideoUrl: '', rawVideoPath: '', referenceVideoUrl: '', referenceVideoPath: '', id: '' })
    }

    const importRecordedActions = (mode) => {
        const recordedBlocks = (recordingImport.blocks || []).map(normalizeScriptBlock)
        if (!recordedBlocks.length) return

        const currentScript = (activeDraft.script || []).map(normalizeScriptBlock)
        const hasOnlyEmptyBlock = currentScript.length === 1 && !currentScript[0].caption && !currentScript[0].action
        const nextScript = mode === 'replace'
            ? recordedBlocks
            : [
                ...(hasOnlyEmptyBlock ? [] : currentScript),
                ...recordedBlocks
            ]

        pendingScrollBlockIndex.current = mode === 'replace'
            ? 0
            : Math.max(0, nextScript.length - recordedBlocks.length)
        updateScript(nextScript)
        closeRecordingImport()
        toast.success(mode === 'replace' ? 'Replaced script with recording' : 'Appended recorded actions')
    }

    const revertToSavedVersion = async () => {
        if (isRendering) return

        try {
            if (activeDraft?.sourcePath) {
                await reloadActiveDraftFromDisk()
                toast.success('Reverted to saved version')
                return
            }

            const option = guideOptions.find(candidate => candidate.guide.id === activeDraft.id)
            if (!option) return
            const next = loadDraftForGuide(option, activeDraftLanguage)
            upsertDraft(next, { guideId: activeDraft.id, language: activeDraftLanguage })
            toast.success('Reverted to saved version')
        } catch (error) {
            toast.error(error.message)
        }
    }

    const copyMarkdown = async () => {
        try {
            await writeClipboardText(markdown)
            toast.success('Markdown copied')
        } catch {
            toast.error('Could not copy markdown')
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
                uuid: draft.uuid,
                sectionId: draft.sectionId,
                sourcePath: draft.sourcePath,
                language: draft.language || activeDraftLanguage,
                markdown: markdownText,
                requireExisting: options.requireExisting !== false,
                useCanonicalPath: options.useCanonicalPath !== false,
                allowOverwrite: Boolean(options.allowOverwrite),
                allowMissingSource: Boolean(options.allowMissingSource),
                appendToUndoId: options.appendToUndoId || '',
                undoLabel: options.undoLabel || ''
            })
        })
        const data = await response.json()

        if (!response.ok) throw new Error(data.error || 'Could not save markdown')

        return data
    }

    const openSaveAsModal = (guideId = activeDraft?.id || '') => {
        setSaveAsState({
            isOpen: true,
            guideId,
            overwrite: false,
            error: '',
            isSaving: false
        })
    }

    const closeSaveAsModal = () => {
        if (saveAsState.isSaving) return
        setSaveAsState(current => ({ ...current, isOpen: false, error: '' }))
    }

    const saveMarkdownAs = async (guideId) => {
        const nextGuideId = normalizeGuideIdInput(guideId)
        if (!nextGuideId || isRendering) return

        setSaveAsState(current => ({ ...current, isSaving: true, error: '' }))

        try {
            const nextVideoLinks = { ...(activeDraft.videoLinks || {}) }
            delete nextVideoLinks[activeDraftLanguage]
            const nextDraft = withDraftSessionKey({
                ...activeDraft,
                id: nextGuideId,
                uuid: '',
                sourcePath: '',
                videoLinks: nextVideoLinks,
                videoLanguage: activeDraftLanguage,
                videoLanguages: [activeDraftLanguage]
            }, nextGuideId, activeDraftLanguage)
            const nextMarkdown = createMarkdownFromDraft(nextDraft)
            const data = await saveDraftMarkdownToDisk(nextDraft, nextMarkdown, {
                requireExisting: false,
                allowOverwrite: saveAsState.overwrite,
                undoLabel: `Save as ${nextGuideId}`
            })
            const savedDraft = withDraftSessionKey({
                ...nextDraft,
                sourcePath: data.sourcePath || nextDraft.sourcePath
            }, nextGuideId, activeDraftLanguage)
            const savedDraftKey = getDraftSessionKey(savedDraft)

            setOpenDrafts(current => current.map(draft => (
                getDraftSessionKey(draft) === activePreviewKey ? savedDraft : draft
            )))
            setActiveDraftKey(savedDraftKey)
            editorSession.activeDraftKey = savedDraftKey
            clearCurrentVideoState()
            if (data.undo) setUndoInfo(data.undo)
            setSaveAsState(current => ({ ...current, isOpen: false, isSaving: false, error: '' }))
            navigate(getScriptEditorPath(nextGuideId, activeDraftLanguage), { replace: true })
            toast.success(`Saved ${getReadableSourcePath(data.sourcePath || savedDraft.sourcePath)}`)
        } catch (error) {
            setSaveAsState(current => ({ ...current, isSaving: false, error: error.message }))
            toast.error(error.message)
        }
    }

    const saveMarkdownToDisk = async () => {
        if (isRendering) return
        if (!activeDraft?.id || !activeDraft?.sourcePath) {
            openSaveAsModal(activeDraft?.id || '')
            return
        }

        if (!window.confirm(`Save changes to ${getReadableSourcePath(activeDraft.sourcePath)}? This overwrites the saved markdown file.`)) {
            return
        }

        try {
            const data = await saveDraftMarkdownToDisk(activeDraft, markdown, {
                requireExisting: true,
                allowOverwrite: true,
                allowMissingSource: true,
                undoLabel: `Save ${activeDraft.id}`
            })

            const nextSourcePath = data.sourcePath || activeDraft.sourcePath
            updateActiveDraft({ sourcePath: nextSourcePath })
            if (data.undo) setUndoInfo(data.undo)
            toast.success(`Saved ${getReadableSourcePath(nextSourcePath)}`)
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
            delete next[activePreviewKey]
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
        return option ? loadDraftForGuide(option, DEFAULT_EDITOR_LANGUAGE) : draft
    }

    const replaceActiveDraft = (nextDraft) => {
        return upsertDraft(nextDraft, {
            guideId: activeDraft.id,
            language: nextDraft.language || activeDraftLanguage
        })
    }

    const loadTranslatedDraft = async (language = 'sv') => {
        const response = await fetch('/__howto-script-editor/open-translation', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                guideId: activeDraft.id,
                uuid: activeDraft.uuid,
                sectionId: activeDraft.sectionId,
                sourcePath: activeDraft.sourcePath,
                language
            })
        })
        const data = await response.json()

        if (!response.ok) throw new Error(data.error || 'Could not open translated markdown')
        if (!data.exists) return null

        return draftFromMarkdown(data.markdown, data.sourcePath, language, activeDraft.id)
    }

    const switchDraftLanguage = async (language) => {
        const nextLanguage = normalizeEditorLanguage(language)
        if (!activeDraft || isRendering || isTranslating || nextLanguage === activeDraftLanguage) return

        try {
            const targetKey = getDraftKey(activeDraft.id, nextLanguage)
            const existingDraft = openDrafts.find(draft => getDraftSessionKey(draft) === targetKey)
                || editorSession.draftsByKey.get(targetKey)

            if (existingDraft) {
                upsertDraft(cloneDraft(existingDraft), { guideId: activeDraft.id, language: nextLanguage })
                navigate(getScriptEditorPath(activeDraft.id, nextLanguage))
                return
            }

            if (nextLanguage === DEFAULT_EDITOR_LANGUAGE) {
                const originalDraft = await loadTranslatedDraft(DEFAULT_EDITOR_LANGUAGE) || getOriginalDraft(activeDraft)
                replaceActiveDraft(withWorkingLanguage(originalDraft, DEFAULT_EDITOR_LANGUAGE))
                navigate(getScriptEditorPath(activeDraft.id, DEFAULT_EDITOR_LANGUAGE))
                toast.success('Switched to English origin')
                return
            }

            const translatedDraft = await loadTranslatedDraft(nextLanguage)

            if (!translatedDraft) {
                await generateTranslation(nextLanguage, { force: false, activate: true })
                return
            }

            replaceActiveDraft(withWorkingLanguage(translatedDraft, nextLanguage))
            navigate(getScriptEditorPath(activeDraft.id, nextLanguage))
            toast.success(`Opened ${nextLanguage.toUpperCase()} markdown`)
        } catch (error) {
            toast.error(error.message)
        }
    }

    const generateTranslation = async (language = 'sv', options = {}) => {
        if (!activeDraft || isRendering || isTranslating) return

        const targetLanguage = normalizeEditorLanguage(language)
        const sourceLanguage = activeDraftLanguage
        if (targetLanguage === sourceLanguage) return

        const sourceMarkdown = markdown
        const sourceDraft = activeDraft

        setProcessLogSource('translation')
        setIsTranslationLogClosed(false)
        setTranslationRun({ log: '', error: '' })

        try {
            const statusResponse = await fetch('/__howto-script-editor/translation-status', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    guideId: sourceDraft.id,
                    uuid: sourceDraft.uuid,
                    sectionId: sourceDraft.sectionId,
                    sourcePath: sourceDraft.sourcePath,
                    language: targetLanguage
                })
            })
            const status = await statusResponse.json()

            if (!statusResponse.ok) throw new Error(status.error || 'Could not check translation status')
            if (status.exists && !options.force && !window.confirm(`A ${targetLanguage.toUpperCase()} markdown file already exists at ${status.sourcePath}. Replace it with a new Haiku translation?`)) {
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
                    guideId: sourceDraft.id,
                    uuid: sourceDraft.uuid,
                    sectionId: sourceDraft.sectionId,
                    sourcePath: sourceDraft.sourcePath,
                    language: targetLanguage,
                    sourceLanguage,
                    markdown: sourceMarkdown,
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
                        const translatedDraft = draftFromMarkdown(event.markdown, event.sourcePath, targetLanguage, sourceDraft.id)
                        replaceActiveDraft(withWorkingLanguage(translatedDraft, targetLanguage))
                        if (options.activate !== false) navigate(getScriptEditorPath(sourceDraft.id, targetLanguage))
                        if (event.undo) setUndoInfo(event.undo)
                        toast.success(`Saved ${targetLanguage.toUpperCase()} markdown`)
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
        if (videoOverride?.exists) reviewedLanguages.add(activeDraftLanguage)
        const missingLanguages = languages.filter(language => !reviewedLanguages.has(language))

        if (missingLanguages.length > 0) {
            toast.error(`Create and review preview video first: ${missingLanguages.join(', ')}`)
            return
        }

        setIsPublishing(true)

        try {
            const videoLinks = getPublishedVideoLinks({
                ...activeDraft,
                videoLanguage: activeDraftLanguage,
                videoLanguages: languages
            })
            if (videoOverride?.exists) {
                videoLinks[activeDraftLanguage] = {
                    videoUrl: videoOverride.cleanVideoUrl || videoOverride.videoUrl,
                    captionsUrl: ''
                }
            }
            const publishDraft = {
                ...activeDraft,
                videoLanguage: activeDraftLanguage,
                videoLanguages: languages,
                videoLinks
            }
            const publishVideos = videoOverride?.exists
                ? [{
                    language: activeDraftLanguage,
                    videoUrl: videoOverride.cleanVideoUrl || videoOverride.videoUrl,
                    captionsUrl: '',
                    isOverride: true
                }]
                : displayPreview?.videos || []
            const publishMarkdown = createMarkdownFromDraft(publishDraft)
            const response = await fetch('/__howto-script-editor/publish', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    guideId: activeDraft.id,
                    uuid: activeDraft.uuid,
                    sectionId: activeDraft.sectionId,
                    sourcePath: activeDraft.sourcePath,
                    language: activeDraftLanguage,
                    languages,
                    videos: publishVideos,
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
        if (videoOverride?.exists) {
            toast.error('Remove the MP4 override before creating a generated video.')
            return
        }

        const renderDraft = activeDraft
        const renderDraftKey = getDraftSessionKey(renderDraft)
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
        setClosedLogById(current => ({ ...current, [renderDraftKey]: false }))
        setExpandedVideoById(current => ({ ...current, [renderDraftKey]: false }))
        setPreviewById(current => ({
            ...current,
            [renderDraftKey]: {
                ...(current[renderDraftKey] || {}),
                language: renderDraft.language || activeDraftLanguage,
                videoUrl: '',
                subtitlesUrl: '',
                error: '',
                log: ''
            }
        }))

        try {
            const collectRenderedPreviewVideos = (videos = []) => {
                if (!Array.isArray(videos) || videos.length === 0) return []

                return mergeVideosByLanguage(displayPreview?.videos || [], videos)
            }
            const appendLog = (text) => {
                setPreviewById(current => ({
                    ...current,
                    [renderDraftKey]: {
                        ...(current[renderDraftKey] || {}),
                        log: `${current[renderDraftKey]?.log || ''}${text}`
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
                    globalHoldMs,
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
                    ? collectRenderedPreviewVideos(data.videos)
                    : displayPreview?.videos || []
                if (data.undo) setUndoInfo(data.undo)
                setPreviewById(current => ({
                    ...current,
                    [renderDraftKey]: {
                        ...data,
                        videos: nextVideos
                    }
                }))
                setExpandedVideoById(current => ({ ...current, [renderDraftKey]: true }))
                loadRenderLogs().catch(() => {})
                toast.success('Preview video created')
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
                            ? collectRenderedPreviewVideos(event.videos)
                            : displayPreview?.videos || []
                        if (event.undo) setUndoInfo(event.undo)
                        setPreviewById(current => ({
                            ...current,
                            [renderDraftKey]: {
                                ...(current[renderDraftKey] || {}),
                                videoUrl: event.videoUrl,
                                subtitlesUrl: event.subtitlesUrl,
                                videos: nextVideos,
                                language: event.language,
                                log: current[renderDraftKey]?.log || event.log || ''
                            }
                        }))
                        setExpandedVideoById(current => ({ ...current, [renderDraftKey]: true }))
                        loadRenderLogs().catch(() => {})
                        toast.success('Preview video created')
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
                [renderDraftKey]: {
                    ...(current[renderDraftKey] || {}),
                    language: renderDraft.language || activeDraftLanguage,
                    error: error.message
                }
            }))
            loadRenderLogs().catch(() => {})
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
                    <h1 className="text-xl font-semibold text-gray-900">No guides found</h1>
                    <p className="mt-2 text-sm text-gray-600">Add markdown files under `frontend/src/docs/how-to` first.</p>
                </div>
            </div>
        )
    }

    return (
        <div className={`min-h-screen bg-gray-50 text-gray-900 ${isLogOpen ? 'pb-[38vh]' : ''}`}>
            <CodexScriptBlockModal
                isOpen={Boolean(pendingBlockInsert)}
                prompt={codexBlockPrompt}
                insertLabel={codexBlockInsertLabel}
                isGenerating={isGeneratingBlock}
                onPromptChange={setCodexBlockPrompt}
                onSubmit={submitCodexScriptBlock}
                onClose={closeCodexBlockModal}
            />

            <div className="sticky top-0 z-40 bg-white shadow-sm">
                <header className="border-b border-gray-200 bg-white">
                    <div className="mx-auto flex max-w-[1600px] flex-wrap items-center justify-between gap-4 px-4 py-4 sm:px-6 lg:px-8">
                        <div>
                            <Link to={getHelpIndexPath()} className="text-sm font-medium text-blue-600 hover:text-blue-700">
                                Help guides
                            </Link>
                            <h1 className="mt-1 text-2xl font-semibold text-gray-900">Video Script Editor</h1>
                        </div>
                        <div className="flex flex-wrap items-center gap-2">
                            <Link
                                to={getHelpGuidePath(activeDraft.id)}
                                className="inline-flex items-center gap-2 rounded border border-gray-200 bg-white px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
                            >
                                <FileText className="h-4 w-4" />
                                View guide
                            </Link>
                            <button type="button" onClick={revertToSavedVersion} disabled={isRendering} className="inline-flex items-center gap-2 rounded border border-gray-200 bg-white px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50">
                                <RotateCcw className="h-4 w-4" />
                                Revert to saved
                            </button>
                            <button type="button" onClick={undoLastOverwrite} disabled={!undoInfo || isRendering || isTranslating || isPublishing} title={undoInfo ? `Undo ${undoInfo.label}` : 'Nothing to undo'} className="inline-flex items-center gap-2 rounded border border-amber-200 bg-amber-50 px-3 py-2 text-sm font-medium text-amber-800 hover:bg-amber-100 disabled:cursor-not-allowed disabled:opacity-50">
                                <RotateCcw className="h-4 w-4" />
                                Undo last save
                            </button>
                            <button type="button" onClick={saveMarkdownToDisk} disabled={isRendering} className="inline-flex items-center gap-2 rounded bg-green-700 px-3 py-2 text-sm font-medium text-white hover:bg-green-800 disabled:cursor-not-allowed disabled:opacity-50">
                                <Save className="h-4 w-4" />
                                Save
                            </button>
                            <button type="button" onClick={() => openSaveAsModal(activeDraft.id)} disabled={isRendering} className="inline-flex items-center gap-2 rounded border border-green-200 bg-white px-3 py-2 text-sm font-medium text-green-800 hover:bg-green-50 disabled:cursor-not-allowed disabled:opacity-50">
                                <Save className="h-4 w-4" />
                                Save As
                            </button>
                            <button type="button" onClick={copyMarkdown} disabled={isRendering} className="inline-flex items-center gap-2 rounded bg-blue-600 px-3 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50">
                                <Copy className="h-4 w-4" />
                                Copy markdown
                            </button>
                            <button type="button" onClick={downloadMarkdown} disabled={isRendering} className="inline-flex items-center gap-2 rounded bg-gray-900 px-3 py-2 text-sm font-medium text-white hover:bg-gray-800 disabled:cursor-not-allowed disabled:opacity-50">
                                <Download className="h-4 w-4" />
                                Download
                            </button>
                        </div>
                    </div>
                </header>
                <div className="border-b border-gray-200 bg-gray-50">
                    <div className="mx-auto flex max-w-[1600px] flex-wrap items-center gap-3 px-4 py-2 sm:px-6 lg:px-8">
                        <div className="flex flex-wrap items-center gap-2 rounded border border-gray-200 bg-white px-2 py-1.5 text-sm">
                            <span className="font-semibold text-gray-900">Working language</span>
                            <select
                                value={activeDraftLanguage}
                                onChange={event => switchDraftLanguage(event.target.value)}
                                disabled={isRendering || isTranslating}
                                className="rounded border border-gray-200 bg-white px-2 py-1 text-sm text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100 disabled:cursor-not-allowed disabled:bg-gray-100 disabled:text-gray-500"
                            >
                                {VIDEO_LANGUAGE_OPTIONS.map(option => (
                                    <option key={option.code} value={option.code}>{option.label}</option>
                                ))}
                            </select>
                            <button
                                type="button"
                                onClick={() => generateTranslation(translationTargetLanguage)}
                                disabled={isRendering || isTranslating}
                                className="inline-flex items-center gap-1 rounded border border-gray-200 bg-white px-2 py-1 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-60"
                            >
                                <Bot className="h-3.5 w-3.5" />
                                {isTranslating ? 'Translating...' : translationButtonLabel}
                            </button>
                            <span className="text-xs text-gray-500">
                                Editor, preview, video, voice: <span className="font-semibold uppercase text-gray-700">{activeDraftLanguage}</span>
                            </span>
                        </div>
                        <div className="flex min-w-0 flex-1 flex-wrap gap-2">
                            {openDrafts.map(draft => {
                                const draftKey = getDraftSessionKey(draft)
                                const isActiveDraft = activePreviewKey === draftKey

                                return (
                                    <div
                                        key={draftKey}
                                        className={`inline-flex items-stretch overflow-hidden rounded border text-sm font-medium ${isActiveDraft ? 'border-blue-200 bg-blue-50 text-blue-700' : 'border-gray-200 bg-white text-gray-700'}`}
                                    >
                                        <button
                                            type="button"
                                            disabled={isRendering}
                                            onClick={() => navigate(getScriptEditorPath(draft.id, draft.language || DEFAULT_EDITOR_LANGUAGE))}
                                            className={`px-3 py-2 text-left disabled:cursor-not-allowed disabled:opacity-60 ${isActiveDraft ? 'bg-blue-50' : 'bg-white hover:bg-gray-50'}`}
                                        >
                                            {draft.title || draft.id}
                                            <span className="ml-2 text-xs font-semibold uppercase opacity-70">{draft.language || DEFAULT_EDITOR_LANGUAGE}</span>
                                        </button>
                                        {openDrafts.length > 1 && (
                                            <button
                                                type="button"
                                                disabled={isRendering}
                                                onClick={(event) => {
                                                    event.stopPropagation()
                                                    closeDraft(draftKey)
                                                }}
                                                className="border-l border-inherit px-2 text-gray-400 hover:bg-white hover:text-red-600 disabled:cursor-not-allowed disabled:opacity-40"
                                                aria-label={`Close ${draft.title || draft.id}`}
                                            >
                                                x
                                            </button>
                                        )}
                                    </div>
                                )
                            })}
                        </div>
                    </div>
                </div>
            </div>

            <main className="mx-auto grid max-w-[1600px] gap-6 px-4 py-6 sm:px-6 lg:grid-cols-[280px_minmax(0,1fr)_340px] lg:px-8">
                <aside className="space-y-3 lg:sticky lg:top-40 lg:max-h-[calc(100vh-10rem)] lg:self-start lg:overflow-hidden">
                    <CodexHelpWriterPanel
                        prompt={codexPrompt}
                        onPromptChange={setCodexPrompt}
                        sectionId={codexSectionId}
                        onSectionChange={setCodexSectionId}
                        isGenerating={isGeneratingDoc || isGeneratingBlock || isRendering}
                        finalMessage={codexRun.finalMessage}
                        onGenerate={generateHelpDocument}
                        isOpen={openLeftPanels.codex}
                        onToggle={() => toggleLeftPanel('codex')}
                    />

                    <section className="rounded border border-gray-200 bg-white">
                        <AccordionHeader
                            icon={<FileText className="h-4 w-4 text-blue-600" />}
                            title="Manuscript browser"
                            isOpen={openLeftPanels.browser}
                            onToggle={() => toggleLeftPanel('browser')}
                        />
                        {openLeftPanels.browser && (
                            <div className="border-t border-gray-100 p-2">
                            <form onSubmit={openGuideByGuideId} className="flex gap-2">
                                <input
                                    value={loadGuideId}
                                    onChange={event => setLoadGuideId(event.target.value)}
                                    placeholder="Load Guide ID"
                                    disabled={isRendering}
                                    className="min-w-0 flex-1 rounded border border-gray-200 px-2 py-1.5 text-sm text-gray-900 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100 disabled:cursor-not-allowed disabled:bg-gray-100"
                                />
                                <button
                                    type="submit"
                                    disabled={isRendering || !normalizeGuideIdInput(loadGuideId)}
                                    className="rounded bg-gray-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-gray-800 disabled:cursor-not-allowed disabled:opacity-50"
                                >
                                    Open
                                </button>
                            </form>
                            <div className="mt-2 max-h-[calc(100vh-20rem)] space-y-2 overflow-y-auto pr-1">
                                {browserSections.map(section => (
                                    <div key={section.id}>
                                        <div className="px-1 text-[11px] font-semibold uppercase tracking-wide text-gray-500">{section.title}</div>
                                        <div className="mt-1 space-y-0.5">
                                            {section.guides.length === 0 && (
                                                <div className="px-2 py-1 text-xs text-gray-400">No manuscripts yet</div>
                                            )}
                                            {section.guides.map(guide => (
                                                <button
                                                    key={guide.id}
                                                    type="button"
                                                    disabled={isRendering}
                                                    onClick={() => openGuide({ section, guide })}
                                                    className={`block w-full rounded px-2 py-1.5 text-left text-sm hover:bg-blue-50 hover:text-blue-700 disabled:cursor-not-allowed disabled:opacity-50 ${activeDraft.id === guide.id && activeDraftLanguage === routeLanguage ? 'bg-blue-50 text-blue-700' : 'text-gray-700'}`}
                                                >
                                                    <span className="block truncate font-medium">{guide.title}</span>
                                                    <code className="mt-0.5 block truncate text-[11px] text-gray-500">{guide.id}</code>
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                ))}
                            </div>
                            </div>
                        )}
                    </section>
                </aside>

                <div className="space-y-6">
                    <ExpandedVideoPanel
                        preview={displayPreview}
                        expanded={isVideoExpanded}
                        onToggleExpanded={() => setExpandedVideoById(current => ({ ...current, [activePreviewKey]: false }))}
                    />

                    <FinishedPagePreview
                        draft={activeDraft}
                        language={pagePreviewLanguage}
                        preview={displayPreview}
                    />

                    <section className="rounded border border-gray-200 bg-white p-4">
                        <div className="grid gap-4 md:grid-cols-2">
                            <TextInput label="Title" value={activeDraft.title} onChange={title => updateActiveDraft({ title })} disabled={isRendering} />
                            <TextInput
                                label="Guide ID"
                                value={activeDraft.id || ''}
                                onChange={() => {}}
                                readOnly
                                disabled={isRendering || isApplyingMetadataChange}
                            />
                            <div className="-mt-3 text-xs text-gray-500 md:col-start-2">
                                Use Save As to create a manuscript with a different Guide ID.
                            </div>
                            <TextInput
                                label="Recording start URL"
                                value={activeDraft.startUrl || ''}
                                onChange={startUrl => updateActiveDraft({ startUrl })}
                                placeholder="/pages"
                                disabled={isRendering}
                            />
                            <TextInput label="Order" type="number" value={activeDraft.order} onChange={order => updateActiveDraft({ order })} disabled={isRendering} />
                            <TextArea label="Summary" value={activeDraft.summary} onChange={summary => updateActiveDraft({ summary })} rows={2} disabled={isRendering} />
                            <SelectInput label="Section" value={activeDraft.sectionId} onChange={requestSectionChange} disabled={isRendering || isApplyingMetadataChange}>
                                {sectionOptions.map(section => (
                                    <option key={section.id} value={section.id}>{section.title}</option>
                                ))}
                            </SelectInput>
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
                            <h2 className="text-base font-semibold text-gray-900">Sequential video script</h2>
                            <div className="flex flex-wrap gap-2">
                                {isRecordingActions ? (
                                    <button type="button" onClick={stopActionRecording} className="inline-flex items-center gap-2 rounded bg-red-700 px-3 py-2 text-sm font-medium text-white hover:bg-red-800">
                                        <X className="h-4 w-4" />
                                        Stop recording
                                    </button>
                                ) : (
                                    <button type="button" onClick={() => setIsRecordingOptionsOpen(true)} disabled={isRendering || isGeneratingBlock || isGeneratingDoc} className="inline-flex items-center gap-2 rounded border border-blue-200 bg-white px-3 py-2 text-sm font-medium text-blue-800 hover:bg-blue-50 disabled:cursor-not-allowed disabled:opacity-50">
                                        <MousePointerClick className="h-4 w-4" />
                                        Record actions
                                    </button>
                                )}
                                <button type="button" onClick={addBlock} disabled={isRendering || isGeneratingBlock || isRecordingActions} className="inline-flex items-center gap-2 rounded bg-gray-900 px-3 py-2 text-sm font-medium text-white hover:bg-gray-800 disabled:cursor-not-allowed disabled:opacity-50">
                                    <Plus className="h-4 w-4" />
                                    Add block with Codex
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
                                onInsert={position => insertBlock(index, position)}
                                onCopy={() => copyScriptBlock(index)}
                                onCut={() => copyScriptBlock(index, { cut: true })}
                                onPaste={position => pasteScriptBlock(index, position)}
                                onSaveRecording={saveRecordedBlockAudio}
                                onGenerateElevenLabs={generateBlockElevenLabsAudio}
                                onTranscribeAudio={transcribeBlockAudio}
                                blockRef={element => {
                                    if (element) {
                                        scriptBlockRefs.current.set(index, element)
                                    } else {
                                        scriptBlockRefs.current.delete(index)
                                    }
                                }}
                                onRemove={() => {
                                    const script = activeDraft.script.filter((_, candidateIndex) => candidateIndex !== index)
                                    updateScript(script.length ? script : [createScriptBlock(null)])
                                }}
                                disabled={isRendering || isGeneratingBlock}
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
                    isPublishing={isPublishing}
                    activeLanguage={activeDraftLanguage}
                    onRender={renderPreview}
                    onPublish={publishReviewedGuide}
                    videoOverride={videoOverride}
                    isUploadingOverride={isUploadingOverride}
                    onUploadOverride={uploadVideoOverride}
                    onRemoveOverride={removeVideoOverride}
                    demoSettings={demoSettings}
                    onDemoSettingsChange={updateDemoSettings}
                    globalHoldMs={globalHoldMs}
                    onGlobalHoldMsChange={updateGlobalHoldMs}
                    isVideoExpanded={isVideoExpanded}
                    onToggleVideoExpanded={() => setExpandedVideoById(current => ({ ...current, [activePreviewKey]: !current[activePreviewKey] }))}
                    renderLogs={renderLogs}
                    selectedRenderLogId={selectedRenderLogId}
                    onOpenRenderLog={openRenderLog}
                    onRefreshRenderLogs={() => loadRenderLogs().catch(error => toast.error(error.message))}
                />
            </main>

            <MetadataChangeConfirmModal
                change={pendingMetadataChange}
                isApplying={isApplyingMetadataChange}
                onConfirm={applyMetadataChange}
                onCancel={cancelMetadataChange}
            />

            <SaveAsModal
                isOpen={saveAsState.isOpen}
                guideId={saveAsState.guideId}
                overwrite={saveAsState.overwrite}
                error={saveAsState.error}
                isSaving={saveAsState.isSaving}
                onGuideIdChange={guideId => setSaveAsState(current => ({ ...current, guideId, error: '' }))}
                onOverwriteChange={overwrite => setSaveAsState(current => ({ ...current, overwrite }))}
                onSubmit={saveMarkdownAs}
                onClose={closeSaveAsModal}
            />

            <RecordingOptionsDialog
                isOpen={isRecordingOptionsOpen}
                baseUrl={demoSettings.baseUrl || DEFAULT_DEMO_SETTINGS.baseUrl}
                startUrl={activeDraft.startUrl || demoSettings.baseUrl || DEFAULT_DEMO_SETTINGS.baseUrl}
                withVoice={withVoice}
                recordReferenceVideoWithAudio={Boolean(demoSettings.recordReferenceVideoWithAudio)}
                onVoiceChange={setWithVoice}
                onReferenceVideoChange={updateRecordReferenceVideoWithAudio}
                onClose={() => setIsRecordingOptionsOpen(false)}
                onStart={startActionRecording}
            />

            <RecordingImportDialog
                run={recordingImport}
                onClose={closeRecordingImport}
                onImport={importRecordedActions}
            />

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
                    if (processLogSource === 'video-history') {
                        setSelectedRenderLogId('')
                        setProcessLogSource('video')
                        return
                    }
                    if (processLogSource === 'recording') {
                        setProcessLogSource('video')
                        return
                    }
                    setClosedLogById(current => ({ ...current, [activePreviewKey]: true }))
                }}
            />
        </div>
    )
}

export default HowToScriptEditorPage
