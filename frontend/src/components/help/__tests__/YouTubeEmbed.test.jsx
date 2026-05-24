import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import HelpVideoPlayer from '../HelpVideoPlayer'
import { extractYouTubeId, getDefaultHelpVideoPath, getHelpVideoConfig } from '../../../utils/howToHelp'

describe('extractYouTubeId', () => {
    it.each([
        ['dQw4w9WgXcQ', 'dQw4w9WgXcQ'],
        ['https://youtu.be/dQw4w9WgXcQ', 'dQw4w9WgXcQ'],
        ['https://www.youtube.com/watch?v=dQw4w9WgXcQ', 'dQw4w9WgXcQ'],
        ['https://www.youtube.com/embed/dQw4w9WgXcQ', 'dQw4w9WgXcQ'],
        ['https://www.youtube.com/shorts/dQw4w9WgXcQ', 'dQw4w9WgXcQ'],
        ['https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ', 'dQw4w9WgXcQ']
    ])('extracts an id from %s', (input, expected) => {
        expect(extractYouTubeId(input)).toBe(expected)
    })

    it('returns an empty string for unsupported values', () => {
        expect(extractYouTubeId('https://example.com/video')).toBe('')
        expect(extractYouTubeId('not-a-youtube-id')).toBe('')
        expect(extractYouTubeId('')).toBe('')
    })
})

describe('HelpVideoPlayer', () => {
    it('renders a quiet placeholder when no video is configured', () => {
        render(<HelpVideoPlayer title="Missing video" />)

        expect(screen.getByText('MP4 video coming soon')).toBeInTheDocument()
    })

    it('renders an HTML5 video player for configured MP4 files', () => {
        const { container } = render(
            <HelpVideoPlayer
                videoUrl="/howto-videos/prod/sv/pages-pages-create.mp4"
                captionsUrl="/howto-videos/prod/sv/pages-pages-create.vtt"
                title="Pages video"
            />
        )

        const video = container.querySelector('video')
        const source = container.querySelector('source')
        const track = container.querySelector('track')

        expect(video).toHaveAttribute('controls')
        expect(video).toHaveAttribute('preload', 'metadata')
        expect(source).toHaveAttribute('src', '/howto-videos/prod/sv/pages-pages-create.mp4')
        expect(source).toHaveAttribute('type', 'video/mp4')
        expect(track).toHaveAttribute('src', '/howto-videos/prod/sv/pages-pages-create.vtt')
        expect(track).toHaveAttribute('srclang', 'sv')
        expect(screen.getByRole('link', { name: 'Open MP4 file' })).toHaveAttribute(
            'href',
            '/howto-videos/prod/sv/pages-pages-create.mp4'
        )
    })

    it('renders a privacy-enhanced YouTube iframe for configured videos', () => {
        render(<HelpVideoPlayer youtubeUrl="https://youtu.be/dQw4w9WgXcQ" title="Pages video" />)

        const iframe = screen.getByTitle('Pages video')
        expect(iframe).toHaveAttribute('loading', 'lazy')
        expect(iframe).toHaveAttribute('src', 'https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ')
    })
})

describe('help video paths', () => {
    it('builds default public MP4 and captions URLs for a guide', () => {
        expect(getDefaultHelpVideoPath('pages', 'pages-create')).toBe('/howto-videos/prod/sv/pages-pages-create.mp4')
        expect(getHelpVideoConfig({ id: 'pages-create' }, 'pages')).toMatchObject({
            videoUrl: '/howto-videos/prod/sv/pages-pages-create.mp4',
            captionsUrl: '/howto-videos/prod/sv/pages-pages-create.vtt',
            language: 'sv'
        })
    })
})
