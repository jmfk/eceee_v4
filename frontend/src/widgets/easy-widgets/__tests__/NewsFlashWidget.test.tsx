import React from 'react'
import { render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import NewsFlashWidget from '../NewsFlashWidget'
import { newsHomeEditorSchema } from '../newsHomeSchema'

describe('News Flash editor contract', () => {
    afterEach(() => vi.unstubAllGlobals())
    it('loads real published articles and images for the edited site', async () => {
        const fetcher = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ priorityId: null, items: [{
            id: '1161', title: 'Nuclear nostalgia and dangerous distractions', slug: 'nuclear-nostalgia',
            data: { summary: 'Real article summary', featuredImage: { url: 'https://media.example/photo.jpg' } },
        }] }) })
        vi.stubGlobal('fetch', fetcher)
        render(<NewsFlashWidget context={{ webpageData: { id: 249, hostnames: ['eceee.localhost'] } }} />)
        expect(await screen.findByText('Nuclear nostalgia and dangerous distractions')).toBeInTheDocument()
        expect(screen.getByText('Real article summary')).toBeInTheDocument()
        expect(document.querySelector('.news-flash-image img')).toHaveAttribute('src', 'https://media.example/photo.jpg')
        expect(fetcher).toHaveBeenCalledTimes(1)
        const url = new URL(fetcher.mock.calls[0][0])
        expect(url.hostname).toBe('eceee.localhost')
        expect(url.searchParams.get('siteId')).toBe('249')
        expect(url.searchParams.get('type')).toBe('article')
        expect(screen.getAllByRole('article')).toHaveLength(3)
    })

    it('shows the configured layout directly in the slot editor', () => {
        expect(NewsFlashWidget.widgetType).toBe('easy_widgets.NewsFlashWidget')
        render(<NewsFlashWidget config={{ fullWidthCount: 2, halfWidthCount: 0, thirdWidthCount: 3 }} />)
        expect(screen.getAllByRole('article')).toHaveLength(5)
        expect(screen.getAllByText('Published story')).toHaveLength(5)
    })
    it('uses the selected shape for editor placeholders, including saved snake-case config', () => {
        const { container } = render(<NewsFlashWidget config={{ image_shape: 'square' }} />)
        expect(container.querySelectorAll('.news-flash-image-square')).toHaveLength(3)
    })

    it('exposes all three nonnegative layout counts instead of a fixed limit', () => {
        const schema = newsHomeEditorSchema('easy_widgets.NewsFlashWidget', { properties: { limit: { const: 3 } } })
        expect(schema?.properties.limit).toBeUndefined()
        expect(schema?.properties.imageShape.options.map(option => option.value)).toEqual(['square', 'landscape'])
        expect(schema?.properties.fullWidthCount).toMatchObject({ minimum: 0, default: 1 })
        expect(schema?.properties.halfWidthCount).toMatchObject({ minimum: 0, default: 2 })
        expect(schema?.properties.thirdWidthCount).toMatchObject({ minimum: 0, default: 0 })
    })
})
