import { PlayCircle } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { extractYouTubeId } from '../../utils/howToHelp'

const getVideoMimeType = (url = '') => {
    const cleanUrl = url.split('?')[0].toLowerCase()

    if (cleanUrl.endsWith('.webm')) return 'video/webm'
    if (cleanUrl.endsWith('.ogg') || cleanUrl.endsWith('.ogv')) return 'video/ogg'
    return 'video/mp4'
}

const VideoPlaceholder = ({ message = 'MP4 video coming soon', detail = 'Generate or publish the help video file to show it here.' }) => (
    <div className="aspect-video w-full rounded border border-dashed border-gray-300 bg-gray-50 flex flex-col items-center justify-center text-center px-6">
        <PlayCircle className="h-9 w-9 text-gray-300 mb-3" />
        <div className="text-sm font-medium text-gray-600">{message}</div>
        <div className="text-xs text-gray-400 mt-1">{detail}</div>
    </div>
)

const normalizeVideoSources = ({ videoSources, sourceUrl, captionsUrl }) => {
    if (Array.isArray(videoSources) && videoSources.length > 0) {
        return videoSources
            .map(source => ({
                videoUrl: source.videoUrl || source.mp4Url || '',
                captionsUrl: source.captionsUrl || source.subtitlesUrl || ''
            }))
            .filter(source => source.videoUrl)
    }

    return sourceUrl ? [{ videoUrl: sourceUrl, captionsUrl }] : []
}

const HelpVideoPlayer = ({
    videoUrl,
    mp4Url,
    captionsUrl,
    videoSources,
    language = 'sv',
    youtubeId,
    youtubeUrl,
    title
}) => {
    const sourceUrl = mp4Url || videoUrl
    const sources = useMemo(
        () => normalizeVideoSources({ videoSources, sourceUrl, captionsUrl }),
        [videoSources, sourceUrl, captionsUrl]
    )
    const sourceKey = sources.map(source => `${source.videoUrl}:${source.captionsUrl}`).join('|')
    const [sourceIndex, setSourceIndex] = useState(0)
    const [hasVideoError, setHasVideoError] = useState(false)
    const currentSource = sources[sourceIndex]

    useEffect(() => {
        setSourceIndex(0)
        setHasVideoError(false)
    }, [sourceKey])

    const handleVideoError = () => {
        if (sourceIndex < sources.length - 1) {
            setSourceIndex(index => index + 1)
            setHasVideoError(false)
            return
        }

        setHasVideoError(true)
    }

    if (currentSource?.videoUrl && !hasVideoError) {
        return (
            <div className="overflow-hidden rounded border border-gray-200 bg-black">
                <video
                    key={currentSource.videoUrl}
                    className="aspect-video h-full w-full bg-black"
                    controls
                    preload="metadata"
                    title={title || 'How-to video'}
                    onError={handleVideoError}
                >
                    <source src={currentSource.videoUrl} type={getVideoMimeType(currentSource.videoUrl)} />
                    {currentSource.captionsUrl && (
                        <track
                            kind="captions"
                            src={currentSource.captionsUrl}
                            srcLang={language}
                            label={language.startsWith('en') ? 'English' : 'Svenska'}
                        />
                    )}
                </video>
                <div className="bg-white px-3 py-2 text-xs">
                    <a
                        href={currentSource.videoUrl}
                        className="font-medium text-blue-600 hover:text-blue-700"
                        target="_blank"
                        rel="noopener noreferrer"
                    >
                        Open MP4 file
                    </a>
                </div>
            </div>
        )
    }

    const legacyYouTubeId = extractYouTubeId(youtubeId || youtubeUrl)
    if (legacyYouTubeId) {
        return (
            <div className="aspect-video w-full overflow-hidden rounded border border-gray-200 bg-black">
                <iframe
                    className="h-full w-full"
                    src={`https://www.youtube-nocookie.com/embed/${legacyYouTubeId}`}
                    title={title || 'How-to video'}
                    loading="lazy"
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                    referrerPolicy="strict-origin-when-cross-origin"
                    allowFullScreen
                />
            </div>
        )
    }

    return <VideoPlaceholder />
}

export default HelpVideoPlayer
