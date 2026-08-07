import { Info } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { howToDocs } from '../../data/howToDocs'
import { getHelpGuidePath, getHelpIndexPath, getHelpSectionPath } from '../../utils/howToHelp'

const GENERAL_WIDGET_GUIDE_IDS = ['widgets-edit', 'widgets-toolbar', 'widgets-slots']

const getGlobalHelpLinks = () => [
    { id: 'help-home', title: 'Help home', href: getHelpIndexPath() },
    ...howToDocs.map(doc => ({
        id: `section-${doc.id}`,
        title: doc.title,
        href: getHelpSectionPath(doc.id)
    }))
]

const getGeneralWidgetGuides = () => {
    const widgetsDoc = howToDocs.find(doc => doc.id === 'widgets')
    if (!widgetsDoc) return []

    return GENERAL_WIDGET_GUIDE_IDS
        .map(id => widgetsDoc.guides.find(guide => guide.id === id))
        .filter(Boolean)
}

const getContextDocs = (topicId) => {
    const directDoc = howToDocs.find(doc => doc.id === topicId)
    if (directDoc) {
        return {
            title: `${directDoc.title} help`,
            contextGuides: directDoc.guides,
            relatedTitle: '',
            relatedGuides: [],
            fullHelpPath: getHelpSectionPath(directDoc.id)
        }
    }

    const parentDoc = howToDocs.find(doc => doc.guides.some(guide => guide.id === topicId))
    const directGuide = parentDoc?.guides.find(guide => guide.id === topicId)

    if (parentDoc && directGuide) {
        const isWidgetTypeGuide = parentDoc.id === 'widgets' && directGuide.id.startsWith('widget-')

        return {
            title: `${directGuide.title} help`,
            contextGuides: [directGuide],
            relatedTitle: isWidgetTypeGuide ? 'General widget help' : '',
            relatedGuides: isWidgetTypeGuide ? getGeneralWidgetGuides() : [],
            fullHelpPath: getHelpGuidePath(directGuide.id)
        }
    }

    if (topicId) {
        const fallbackGuide = howToDocs
            .flatMap(doc => doc.guides)
            .find(guide => guide.id === 'widgets-edit')

        if (fallbackGuide) {
            return {
                title: 'How-to help',
                contextGuides: [fallbackGuide],
                relatedTitle: '',
                relatedGuides: [],
                fullHelpPath: getHelpGuidePath(fallbackGuide.id)
            }
        }
    }

    return {
        title: 'How-to help',
        contextGuides: [],
        relatedTitle: '',
        relatedGuides: [],
        fullHelpPath: getHelpIndexPath()
    }
}

const GuideMenuItem = ({ guide, onSelect }) => {
    const hasVideo = Boolean(guide.videoUrl || guide.mp4Url || guide.youtubeId || guide.youtubeUrl)
    const hasVideoScript = Array.isArray(guide.actions) && guide.actions.length > 0

    return (
        <a
            href={getHelpGuidePath(guide.id)}
            target="_blank"
            rel="noopener noreferrer"
            role="menuitem"
            onClick={onSelect}
            className="block rounded px-2 py-2 text-sm hover:bg-blue-50"
        >
            <span className="block font-medium text-gray-900">{guide.title}</span>
            <span className="mt-0.5 block text-xs text-gray-500">
                {hasVideo ? 'Video available' : hasVideoScript ? 'Instructions and MP4 player' : 'Instructions'}
            </span>
        </a>
    )
}

const MenuSection = ({ title, children }) => (
    <div className="space-y-1">
        <div className="px-2 py-1.5 text-xs font-semibold uppercase tracking-wide text-gray-400">
            {title}
        </div>
        {children}
    </div>
)

const ContextualHelpLink = ({
    topicId,
    label = 'Open help',
    className = '',
    size = 'md'
}) => {
    const [isOpen, setIsOpen] = useState(false)
    const containerRef = useRef(null)
    const contextDocs = useMemo(() => getContextDocs(topicId), [topicId])
    const buttonClassName = size === 'sm'
        ? 'h-6 w-6'
        : 'h-8 w-8'
    const iconClassName = size === 'sm'
        ? 'h-3.5 w-3.5'
        : 'h-4 w-4'

    useEffect(() => {
        if (!isOpen) return

        const handlePointerDown = (event) => {
            if (!containerRef.current?.contains(event.target)) {
                setIsOpen(false)
            }
        }

        document.addEventListener('mousedown', handlePointerDown)
        return () => document.removeEventListener('mousedown', handlePointerDown)
    }, [isOpen])

    return (
        <div ref={containerRef} className={`relative inline-flex ${className}`}>
            <button
                type="button"
                onClick={() => setIsOpen(prev => !prev)}
                aria-label={label}
                aria-haspopup="menu"
                aria-expanded={isOpen}
                title={label}
                className={`inline-flex ${buttonClassName} flex-shrink-0 items-center justify-center rounded-full text-gray-400 transition-colors hover:bg-gray-100 hover:text-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2`}
            >
                <Info className={iconClassName} aria-hidden="true" />
            </button>

            {isOpen && (
                <div
                    role="menu"
                    className="absolute right-0 top-9 z-50 max-h-[min(34rem,calc(100vh-6rem))] w-80 overflow-y-auto rounded border border-gray-200 bg-white p-2 text-left shadow-lg"
                >
                    {contextDocs.contextGuides.length > 0 && (
                        <MenuSection title={contextDocs.title}>
                            {contextDocs.contextGuides.map(guide => (
                                <GuideMenuItem
                                    key={guide.id}
                                    guide={guide}
                                    onSelect={() => setIsOpen(false)}
                                />
                            ))}
                        </MenuSection>
                    )}

                    {contextDocs.relatedGuides.length > 0 && (
                        <div className="mt-1 border-t border-gray-100 pt-1">
                            <MenuSection title={contextDocs.relatedTitle}>
                                {contextDocs.relatedGuides.map(guide => (
                                    <GuideMenuItem
                                        key={guide.id}
                                        guide={guide}
                                        onSelect={() => setIsOpen(false)}
                                    />
                                ))}
                            </MenuSection>
                        </div>
                    )}

                    <div className="mt-1 border-t border-gray-100 pt-1">
                        <MenuSection title="Global help">
                            {getGlobalHelpLinks().map(item => (
                                <a
                                    key={item.id}
                                    href={item.href}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    role="menuitem"
                                    onClick={() => setIsOpen(false)}
                                    className="block rounded px-2 py-1.5 text-sm font-medium text-gray-600 hover:bg-gray-50 hover:text-blue-700"
                                >
                                    {item.title}
                                </a>
                            ))}
                        </MenuSection>
                        <a
                            href={contextDocs.fullHelpPath || getHelpIndexPath()}
                            target="_blank"
                            rel="noopener noreferrer"
                            role="menuitem"
                            onClick={() => setIsOpen(false)}
                            className="block rounded px-2 py-2 text-xs font-medium text-blue-600 hover:bg-blue-50"
                        >
                            Open context help page
                        </a>
                    </div>
                </div>
            )}
        </div>
    )
}

export default ContextualHelpLink
