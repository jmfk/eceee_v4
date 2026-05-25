import { Link, Navigate, Route, Routes, useParams, useSearchParams } from 'react-router-dom'
import { BookOpen, ChevronLeft, ChevronRight, ListChecks, Menu } from 'lucide-react'
import { useState } from 'react'
import HelpVideoPlayer from '../components/help/HelpVideoPlayer'
import { howToDocs } from '../data/howToDocs'
import { getHelpGuidePath, getHelpIndexPath, getHelpSectionPath, getHelpVideoConfig } from '../utils/howToHelp'
import {
    HELP_LANGUAGES,
    getHelpText,
    localizeGuide,
    localizeSection,
    normalizeHelpLanguage
} from '../utils/howToI18n'
import { useDocumentTitle } from '../hooks/useDocumentTitle'
import HowToScriptEditorPage from './HowToScriptEditorPage'

const getAllGuides = () => howToDocs.flatMap(doc => doc.guides.map(guide => ({ ...guide, section: doc })))

const findGuide = (guideId) => getAllGuides().find(guide => guide.id === guideId)

const withLanguage = (path, language) => `${path}?lang=${normalizeHelpLanguage(language)}`

const LanguageSwitcher = ({ language }) => {
    const text = getHelpText(language)

    return (
        <div className="flex items-center gap-3">
            <label className="sr-only" htmlFor="help-language">{text.languageLabel}</label>
            <select
                id="help-language"
                value={normalizeHelpLanguage(language)}
                onChange={(event) => {
                    window.location.assign(withLanguage(window.location.pathname, event.target.value))
                }}
                className="rounded border border-gray-200 bg-white px-2 py-1 text-sm text-gray-600 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100"
            >
                {HELP_LANGUAGES.map(candidate => (
                    <option key={candidate.code} value={candidate.code}>{candidate.label}</option>
                ))}
            </select>
            <a
                href="/pages"
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm font-medium text-gray-500 hover:text-blue-600"
            >
                {text.openAdmin}
            </a>
            <Link
                to={withLanguage('/help/script-editor', language)}
                className="text-sm font-medium text-gray-500 hover:text-blue-600"
            >
                {text.scriptEditor}
            </Link>
        </div>
    )
}

const HelpShell = ({ title, subtitle, children, language }) => {
    const [isMenuExpanded, setIsMenuExpanded] = useState(false)
    const text = getHelpText(language)
    useDocumentTitle(title)

    return (
        <div className={`min-h-screen bg-gray-50 text-gray-900 ${isMenuExpanded ? 'lg:pl-80' : 'lg:pl-20'}`}>
            <div className="border-b border-gray-200 bg-white">
                <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-4 sm:px-6 lg:px-8">
                    <Link to={withLanguage(getHelpIndexPath(), language)} className="flex items-center gap-3">
                        <span className="flex h-10 w-10 items-center justify-center rounded bg-blue-50 text-blue-600">
                            <BookOpen className="h-5 w-5" />
                        </span>
                        <span>
                            <span className="block text-lg font-semibold">{text.appName}</span>
                            <span className="block text-xs text-gray-500">{text.subtitle}</span>
                        </span>
                    </Link>
                    <LanguageSwitcher language={language} />
                </div>
            </div>

            <aside className={`border-b border-gray-200 bg-white lg:fixed lg:bottom-0 lg:left-0 lg:top-0 lg:z-30 lg:border-b-0 lg:border-r ${isMenuExpanded ? 'lg:w-80' : 'lg:w-20'}`}>
                <div className="flex items-center justify-between gap-2 px-4 py-3 lg:h-16 lg:px-3">
                    <div className={`flex items-center gap-2 ${isMenuExpanded ? '' : 'lg:hidden'}`}>
                        <ListChecks className="h-4 w-4 flex-shrink-0 text-blue-600" />
                        <span className={`text-sm font-semibold text-gray-900 ${isMenuExpanded ? '' : 'lg:sr-only'}`}>
                            {text.helpMenu}
                        </span>
                    </div>
                    <button
                        type="button"
                        onClick={() => setIsMenuExpanded(prev => !prev)}
                        aria-label={isMenuExpanded ? text.collapseMenu : text.expandMenu}
                        aria-expanded={isMenuExpanded}
                        className="inline-flex h-8 w-8 items-center justify-center rounded text-gray-500 hover:bg-gray-100 hover:text-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
                    >
                        {isMenuExpanded ? <ChevronLeft className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
                    </button>
                </div>

                <nav
                    aria-label="Help sections"
                    className={`border-t border-gray-100 px-3 py-3 ${isMenuExpanded ? 'max-h-[60vh] overflow-y-auto lg:max-h-[calc(100vh-4rem)]' : 'hidden'}`}
                >
                    <div className="space-y-2">
                        {howToDocs.map(doc => {
                            const localizedDoc = localizeSection(doc, language)

                            return (
                                <div key={doc.id}>
                                    <Link
                                        to={withLanguage(getHelpSectionPath(doc.id), language)}
                                        title={localizedDoc.title}
                                        className="block rounded px-2 py-1 text-sm font-semibold text-gray-700 hover:bg-blue-50 hover:text-blue-700"
                                    >
                                        {localizedDoc.title}
                                    </Link>
                                    <div className="mt-1 space-y-0.5">
                                        {doc.guides.map(guide => {
                                            const localizedGuide = localizeGuide(guide, language)

                                            return (
                                                <Link
                                                    key={guide.id}
                                                    to={withLanguage(getHelpGuidePath(guide.id), language)}
                                                    className="block rounded px-2 py-1 text-sm text-gray-500 hover:bg-gray-50 hover:text-blue-700"
                                                >
                                                    {localizedGuide.title}
                                                </Link>
                                            )
                                        })}
                                    </div>
                                </div>
                            )
                        })}
                    </div>
                </nav>
            </aside>

            <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
                <main>
                    <div className="mb-6">
                        <h1 className="text-3xl font-bold text-gray-900">{title}</h1>
                        {subtitle && <p className="mt-2 max-w-3xl text-gray-600">{subtitle}</p>}
                    </div>
                    {children}
                </main>
            </div>
        </div>
    )
}

const GuideCard = ({ guide, language }) => (
    <Link
        to={withLanguage(getHelpGuidePath(guide.id), language)}
        className="block rounded border border-gray-200 bg-white p-4 transition-colors hover:border-blue-200 hover:bg-blue-50"
    >
        <span className="flex items-start justify-between gap-3">
            <span>
                <span className="block font-semibold text-gray-900">{guide.title}</span>
                <span className="mt-1 block text-sm text-gray-600">{guide.summary}</span>
            </span>
            <ChevronRight className="mt-1 h-4 w-4 flex-shrink-0 text-gray-400" />
        </span>
    </Link>
)

const HelpIndexPage = ({ language }) => {
    const text = getHelpText(language)

    return (
        <HelpShell title={text.indexTitle} subtitle={text.indexSubtitle} language={language}>
            <div className="space-y-6">
                {howToDocs.map(doc => {
                    const localizedDoc = localizeSection(doc, language)

                    return (
                        <section key={doc.id} className="rounded border border-gray-200 bg-white p-5">
                            <div className="mb-4">
                                <Link to={withLanguage(getHelpSectionPath(doc.id), language)} className="text-xl font-semibold text-gray-900 hover:text-blue-700">
                                    {localizedDoc.title}
                                </Link>
                                <p className="mt-1 text-sm text-gray-600">{localizedDoc.summary}</p>
                            </div>
                            <div className="grid gap-3 md:grid-cols-2">
                                {doc.guides.map(guide => (
                                    <GuideCard key={guide.id} guide={localizeGuide(guide, language)} language={language} />
                                ))}
                            </div>
                        </section>
                    )
                })}
            </div>
        </HelpShell>
    )
}

const HelpSectionPage = ({ language }) => {
    const { sectionId } = useParams()
    const doc = howToDocs.find(item => item.id === sectionId)

    if (!doc) return <Navigate to={withLanguage(getHelpIndexPath(), language)} replace />

    const localizedDoc = localizeSection(doc, language)

    return (
        <HelpShell title={localizedDoc.title} subtitle={localizedDoc.summary} language={language}>
            <div className="grid gap-3 md:grid-cols-2">
                {doc.guides.map(guide => (
                    <GuideCard key={guide.id} guide={localizeGuide(guide, language)} language={language} />
                ))}
            </div>
        </HelpShell>
    )
}

const HelpGuidePage = ({ language }) => {
    const { guideId } = useParams()
    const guide = findGuide(guideId)

    if (!guide) return <Navigate to={withLanguage(getHelpIndexPath(), language)} replace />

    const localizedSection = localizeSection(guide.section, language)
    const localizedGuide = localizeGuide(guide, language)
    const videoConfig = getHelpVideoConfig(guide, guide.section.id, language)
    const text = getHelpText(language)

    return (
        <HelpShell title={localizedGuide.title} subtitle={localizedGuide.summary} language={language}>
            <article className="rounded border border-gray-200 bg-white p-5 sm:p-6">
                <div className="mb-4 flex flex-wrap items-center gap-2 text-sm text-gray-500">
                    <Link to={withLanguage(getHelpSectionPath(guide.section.id), language)} className="font-medium text-blue-600 hover:text-blue-700">
                        {localizedSection.title}
                    </Link>
                    <ChevronRight className="h-4 w-4" />
                    <span>{localizedGuide.title}</span>
                </div>

                <HelpVideoPlayer
                    videoUrl={videoConfig.videoUrl}
                    captionsUrl={videoConfig.captionsUrl}
                    videoSources={videoConfig.videoSources}
                    language={videoConfig.language}
                    youtubeId={guide.youtubeId}
                    youtubeUrl={guide.youtubeUrl}
                    title={`${localizedGuide.title} video`}
                />

                <ol className="mt-6 space-y-3 text-sm text-gray-700">
                    {localizedGuide.steps.map((step, index) => (
                        <li key={step} className="flex gap-3">
                            <span className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-blue-50 text-xs font-semibold text-blue-600 ring-1 ring-blue-100">
                                {index + 1}
                            </span>
                            <span>{step}</span>
                        </li>
                    ))}
                </ol>

                {localizedGuide.narration && (
                    <div className="mt-6 rounded border border-gray-200 bg-gray-50 p-4">
                        <div className="text-sm font-semibold text-gray-900">{text.videoScriptNote}</div>
                        <p className="mt-1 text-sm text-gray-600">{localizedGuide.narration}</p>
                    </div>
                )}
            </article>
        </HelpShell>
    )
}

const HowToHelpPage = () => {
    const [searchParams] = useSearchParams()
    const language = normalizeHelpLanguage(searchParams.get('lang'))

    return (
        <Routes>
            <Route index element={<HelpIndexPage language={language} />} />
            <Route path="script-editor" element={<HowToScriptEditorPage />} />
            <Route path="script-editor/:language/:guideId" element={<HowToScriptEditorPage />} />
            <Route path="how-to" element={<HelpIndexPage language={language} />} />
            <Route path="how-to/section/:sectionId" element={<HelpSectionPage language={language} />} />
            <Route path="how-to/:guideId" element={<HelpGuidePage language={language} />} />
            <Route path="*" element={<Navigate to={withLanguage(getHelpIndexPath(), language)} replace />} />
        </Routes>
    )
}

export default HowToHelpPage
