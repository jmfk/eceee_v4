import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import YouTubeEmbed from '../YouTubeEmbed'
import { extractYouTubeId } from '../../../utils/howToHelp'

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

describe('YouTubeEmbed', () => {
    it('renders a quiet placeholder when no video is configured', () => {
        render(<YouTubeEmbed title="Missing video" />)

        expect(screen.getByText('Video coming soon')).toBeInTheDocument()
    })

    it('renders a privacy-enhanced YouTube iframe for configured videos', () => {
        render(<YouTubeEmbed youtubeUrl="https://youtu.be/dQw4w9WgXcQ" title="Pages video" />)

        const iframe = screen.getByTitle('Pages video')
        expect(iframe).toHaveAttribute('loading', 'lazy')
        expect(iframe).toHaveAttribute('src', 'https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ')
    })
})
