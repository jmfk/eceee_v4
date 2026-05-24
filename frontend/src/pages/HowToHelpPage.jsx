import { Link, Navigate, Route, Routes, useParams } from 'react-router-dom'
import { BookOpen, ChevronLeft, ChevronRight, ListChecks, Menu } from 'lucide-react'
import { useState } from 'react'
import HelpVideoPlayer from '../components/help/HelpVideoPlayer'
import { howToDocs } from '../data/howToDocs'
import { getHelpGuidePath, getHelpIndexPath, getHelpSectionPath, getHelpVideoConfig } from '../utils/howToHelp'
import { useDocumentTitle } from '../hooks/useDocumentTitle'

const getAllGuides = () => howToDocs.flatMap(doc => doc.guides.map(guide => ({ ...guide, section: doc })))

const findGuide = (guideId) => getAllGuides().find(guide => guide.id === guideId)

const HelpShell = ({ title = 'How-To Help', subtitle, children }) => {
    const [isMenuExpanded, setIsMenuExpanded] = useState(false)
    useDocumentTitle(title)

    return (
        <div className={`min-h-screen bg-gray-50 text-gray-900 ${isMenuExpanded ? 'lg:pl-80' : 'lg:pl-20'}`}>
            <div className="border-b border-gray-200 bg-white">
                <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-4 sm:px-6 lg:px-8">
                    <Link to={getHelpIndexPath()} className="flex items-center gap-3">
                        <span className="flex h-10 w-10 items-center justify-center rounded bg-blue-50 text-blue-600">
                            <BookOpen className="h-5 w-5" />
                        </span>
                        <span>
                            <span className="block text-lg font-semibold">EASY v4 Help</span>
                            <span className="block text-xs text-gray-500">Admin how-to documentation</span>
                        </span>
                    </Link>
                    <a
                        href="/pages"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-sm font-medium text-gray-500 hover:text-blue-600"
                    >
                        Open admin
                    </a>
                </div>
            </div>

            <aside className={`border-b border-gray-200 bg-white lg:fixed lg:bottom-0 lg:left-0 lg:top-0 lg:z-30 lg:border-b-0 lg:border-r ${isMenuExpanded ? 'lg:w-80' : 'lg:w-20'}`}>
                <div className="flex items-center justify-between gap-2 px-4 py-3 lg:h-16 lg:px-3">
                    <div className={`flex items-center gap-2 ${isMenuExpanded ? '' : 'lg:hidden'}`}>
                        <ListChecks className="h-4 w-4 flex-shrink-0 text-blue-600" />
                        <span className={`text-sm font-semibold text-gray-900 ${isMenuExpanded ? '' : 'lg:sr-only'}`}>
                            Help menu
                        </span>
                    </div>
                    <button
                        type="button"
                        onClick={() => setIsMenuExpanded(prev => !prev)}
                        aria-label={isMenuExpanded ? 'Collapse help menu' : 'Expand help menu'}
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
                        {howToDocs.map(doc => (
                            <div key={doc.id}>
                                <Link
                                    to={getHelpSectionPath(doc.id)}
                                    title={doc.title}
                                    className="block rounded px-2 py-1 text-sm font-semibold text-gray-700 hover:bg-blue-50 hover:text-blue-700"
                                >
                                    {doc.title}
                                </Link>
                                <div className="mt-1 space-y-0.5">
                                    {doc.guides.map(guide => (
                                        <Link
                                            key={guide.id}
                                            to={getHelpGuidePath(guide.id)}
                                            className="block rounded px-2 py-1 text-sm text-gray-500 hover:bg-gray-50 hover:text-blue-700"
                                        >
                                            {guide.title}
                                        </Link>
                                    ))}
                                </div>
                            </div>
                        ))}
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

const GuideCard = ({ guide }) => (
    <Link
        to={getHelpGuidePath(guide.id)}
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

const HelpIndexPage = () => (
    <HelpShell
        title="How-To Help"
        subtitle="Short admin walkthroughs with written steps, focused markdown files, and MP4 help videos."
    >
        <div className="space-y-6">
            {howToDocs.map(doc => (
                <section key={doc.id} className="rounded border border-gray-200 bg-white p-5">
                    <div className="mb-4">
                        <Link to={getHelpSectionPath(doc.id)} className="text-xl font-semibold text-gray-900 hover:text-blue-700">
                            {doc.title}
                        </Link>
                        <p className="mt-1 text-sm text-gray-600">{doc.summary}</p>
                    </div>
                    <div className="grid gap-3 md:grid-cols-2">
                        {doc.guides.map(guide => <GuideCard key={guide.id} guide={guide} />)}
                    </div>
                </section>
            ))}
        </div>
    </HelpShell>
)

const HelpSectionPage = () => {
    const { sectionId } = useParams()
    const doc = howToDocs.find(item => item.id === sectionId)

    if (!doc) return <Navigate to={getHelpIndexPath()} replace />

    return (
        <HelpShell title={`${doc.title} Help`} subtitle={doc.summary}>
            <div className="grid gap-3 md:grid-cols-2">
                {doc.guides.map(guide => <GuideCard key={guide.id} guide={guide} />)}
            </div>
        </HelpShell>
    )
}

const HelpGuidePage = () => {
    const { guideId } = useParams()
    const guide = findGuide(guideId)

    if (!guide) return <Navigate to={getHelpIndexPath()} replace />

    const videoConfig = getHelpVideoConfig(guide, guide.section.id)

    return (
        <HelpShell title={guide.title} subtitle={guide.summary}>
            <article className="rounded border border-gray-200 bg-white p-5 sm:p-6">
                <div className="mb-4 flex flex-wrap items-center gap-2 text-sm text-gray-500">
                    <Link to={getHelpSectionPath(guide.section.id)} className="font-medium text-blue-600 hover:text-blue-700">
                        {guide.section.title}
                    </Link>
                    <ChevronRight className="h-4 w-4" />
                    <span>{guide.title}</span>
                </div>

                <HelpVideoPlayer
                    videoUrl={videoConfig.videoUrl}
                    captionsUrl={videoConfig.captionsUrl}
                    language={videoConfig.language}
                    youtubeId={guide.youtubeId}
                    youtubeUrl={guide.youtubeUrl}
                    title={`${guide.title} video`}
                />

                <ol className="mt-6 space-y-3 text-sm text-gray-700">
                    {guide.steps.map((step, index) => (
                        <li key={step} className="flex gap-3">
                            <span className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-blue-50 text-xs font-semibold text-blue-600 ring-1 ring-blue-100">
                                {index + 1}
                            </span>
                            <span>{step}</span>
                        </li>
                    ))}
                </ol>

                {guide.narration && (
                    <div className="mt-6 rounded border border-gray-200 bg-gray-50 p-4">
                        <div className="text-sm font-semibold text-gray-900">Video script note</div>
                        <p className="mt-1 text-sm text-gray-600">{guide.narration}</p>
                    </div>
                )}
            </article>
        </HelpShell>
    )
}

const HowToHelpPage = () => (
    <Routes>
        <Route index element={<HelpIndexPage />} />
        <Route path="how-to" element={<HelpIndexPage />} />
        <Route path="how-to/section/:sectionId" element={<HelpSectionPage />} />
        <Route path="how-to/:guideId" element={<HelpGuidePage />} />
        <Route path="*" element={<Navigate to={getHelpIndexPath()} replace />} />
    </Routes>
)

export default HowToHelpPage
