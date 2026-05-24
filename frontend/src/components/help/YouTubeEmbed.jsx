import { PlayCircle } from 'lucide-react'
import { extractYouTubeId } from '../../utils/howToHelp'

const YouTubeEmbed = ({ youtubeId, youtubeUrl, title }) => {
    const videoId = extractYouTubeId(youtubeId || youtubeUrl)

    if (!videoId) {
        return (
            <div className="aspect-video w-full rounded border border-dashed border-gray-300 bg-gray-50 flex flex-col items-center justify-center text-center px-6">
                <PlayCircle className="h-9 w-9 text-gray-300 mb-3" />
                <div className="text-sm font-medium text-gray-600">Video coming soon</div>
                <div className="text-xs text-gray-400 mt-1">A YouTube walkthrough can be added here later.</div>
            </div>
        )
    }

    return (
        <div className="aspect-video w-full overflow-hidden rounded border border-gray-200 bg-black">
            <iframe
                className="h-full w-full"
                src={`https://www.youtube-nocookie.com/embed/${videoId}`}
                title={title || 'How-to video'}
                loading="lazy"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                referrerPolicy="strict-origin-when-cross-origin"
                allowFullScreen
            />
        </div>
    )
}

export default YouTubeEmbed
