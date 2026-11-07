import React from 'react'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { NewsFlashRender } from '../NewsFlashRender'
import { RENDER_WIDGET_FIXTURES } from '../fixtures'

const fixture = RENDER_WIDGET_FIXTURES['easy_widgets.NewsFlashWidget']
const context = { preview: false }
const stories = (start: number, count: number) => Array.from({ length: count }, (_, i) => ({ id: start + i, title: `Story ${start + i}`, slug: `story-${start + i}` }))
afterEach(() => vi.unstubAllGlobals())

describe('News Flash presentation', () => {
    it('preserves the default three distinct stories and links', () => {
        const { container } = render(<NewsFlashRender widget={fixture} context={context} />)
        expect(screen.getAllByRole('article')).toHaveLength(3)
        expect(container.querySelectorAll('.news-flash-full')).toHaveLength(1)
        expect(container.querySelectorAll('.news-flash-half')).toHaveLength(2)
        expect(screen.getByRole('link', { name: 'News 3 — What happens next' })).toHaveAttribute('href', '/news/third-story/')
    })
    it.each(['loading', 'error'] as const)('retains every visible configured position in the %s state', status => {
        render(<NewsFlashRender widget={{ ...fixture, data: { status, items: [] } }} context={context} />)
        expect(screen.getAllByRole('article')).toHaveLength(3)
        expect(screen.getByRole('article', { name: 'News 3 placeholder' })).toBeInTheDocument()
        expect(screen.queryByRole('link')).not.toBeInTheDocument()
    })
    it('supports zero full-width stories and arbitrary mixed counts', () => {
        const { container } = render(<NewsFlashRender widget={{ ...fixture, config: { fullWidthCount: 0, halfWidthCount: 4, thirdWidthCount: 3 }, data: { status: 'ready', items: stories(1, 7) } }} context={context} />)
        expect(container.querySelectorAll('.news-flash-full')).toHaveLength(0)
        expect(container.querySelectorAll('.news-flash-half')).toHaveLength(4)
        expect(container.querySelectorAll('.news-flash-third')).toHaveLength(3)
    })
    it('renders no unused cards or loading controls for an empty completed feed', () => {
        render(<NewsFlashRender widget={{ ...fixture, config: { halfWidthCount: 100000 }, data: { status: 'empty', items: [] } }} context={{ ...context, siteId: 85 }} />)
        expect(screen.queryByRole('article')).not.toBeInTheDocument()
        expect(screen.queryByRole('button')).not.toBeInTheDocument()
    })
    it('bounds outage placeholders to the current batch and offers retry', () => {
        const fetchNews = vi.fn()
        vi.stubGlobal('fetch', fetchNews)
        render(<NewsFlashRender widget={{ ...fixture, config: { fullWidthCount: 0, halfWidthCount: 100000 }, data: { status: 'error', items: [] } }} context={{ ...context, siteId: 85 }} />)
        expect(screen.getAllByRole('article')).toHaveLength(12)
        expect(fetchNews).not.toHaveBeenCalled()
        expect(screen.getByRole('button', { name: 'Retry loading news' })).toBeInTheDocument()
        expect(screen.queryByText('Show more news placeholders')).not.toBeInTheDocument()
    })
    it.each([0, 2])('stops after a final batch of %i articles and removes pending placeholders', async count => {
        let finish: (response: unknown) => void
        const fetchNews = vi.fn(() => new Promise(resolve => { finish = resolve }))
        vi.stubGlobal('fetch', fetchNews)
        render(<NewsFlashRender widget={{ ...fixture, config: { fullWidthCount: 0, halfWidthCount: 100 }, data: { status: 'ready', items: stories(1, 12) } }} context={{ ...context, siteId: 85 }} />)
        fireEvent.click(screen.getByRole('button', { name: 'Load more news' }))
        expect(screen.getByRole('article', { name: 'News 24 placeholder' })).toBeInTheDocument()
        const { act } = await import('@testing-library/react')
        await act(async () => finish!({ ok: true, json: async () => ({ items: stories(13, count) }) }))
        await waitFor(() => expect(screen.getAllByRole('article')).toHaveLength(12 + count))
        expect(screen.queryByRole('button')).not.toBeInTheDocument()
        expect(screen.queryByLabelText(/placeholder/)).not.toBeInTheDocument()
        expect(fetchNews).toHaveBeenCalledTimes(1)
    })

    it.each(['square', 'landscape'])('uses the %s image shape below the full-width headline', imageShape => {
        const { container } = render(<NewsFlashRender widget={{ ...fixture, config: { ...fixture.config, imageShape } }} context={context} />)
        const card = container.querySelector('.news-flash-story')!
        expect(card).toHaveClass(`news-flash-image-${imageShape}`)
        expect(card.firstElementChild).toHaveClass('news-flash-title')
        expect(card.querySelector('.news-flash-body .news-flash-image img')).toBeInTheDocument()
        expect(card.querySelector('.news-flash-body .news-flash-excerpt')).toBeInTheDocument()
    })

    it.each([[800, 400, 'landscape'], [400, 400, 'square'], [300, 800, 'square']])('uses source dimensions %i × %i for the %s frame', (width, height, shape) => {
        const { container } = render(<NewsFlashRender widget={{ ...fixture, config: { imageShape: shape === 'square' ? 'landscape' : 'square' }, data: { status: 'ready', items: [{ id: 1, title: 'Story', data: { featuredImage: { url: '/photo.jpg', width, height } } }] } }} context={context} />)
        expect(container.querySelector('.news-flash-story')).toHaveClass(`news-flash-image-${shape}`)
    })
    it('uses loaded natural dimensions when an external image has no metadata', () => {
        const { container } = render(<NewsFlashRender widget={{ ...fixture, data: { status: 'ready', items: [{ id: 1, title: 'Story', data: { featuredImage: '/photo.jpg' } }] } }} context={context} />)
        const image = container.querySelector('img')!
        Object.defineProperties(image, { naturalWidth: { value: 300 }, naturalHeight: { value: 800 } })
        fireEvent.load(image)
        expect(container.querySelector('.news-flash-story')).toHaveClass('news-flash-image-square')
    })

    it('lets a real story without an image use the full text width', () => {
        const { container } = render(<NewsFlashRender widget={{ ...fixture, data: { status: 'ready', items: [{ id: 1, title: 'Published story', slug: 'story' }] } }} context={context} />)
        expect(screen.getByRole('link', { name: 'Published story' })).toHaveAttribute('href', '/news/story/')
        const card = container.querySelector('[data-object-id="1"]')
        expect(card).toHaveClass('no-image')
        expect(card).not.toHaveClass('has-image')
        expect(card?.querySelector('.news-flash-image')).toBeNull()
        expect(card?.querySelector('.news-flash-placeholder-image')).toBeNull()
    })

    it('supports all-zero counts', () => {
        render(<NewsFlashRender widget={{ ...fixture, config: { fullWidthCount: 0, halfWidthCount: 0, thirdWidthCount: 0 } }} context={context} />)
        expect(screen.queryByRole('article')).not.toBeInTheDocument()
    })
    it('retries the same failed batch while preserving the already loaded stories', async () => {
        const fetchNews = vi.fn().mockRejectedValueOnce(new Error('offline')).mockResolvedValueOnce({ ok: true, json: async () => ({ items: stories(13, 3) }) })
        vi.stubGlobal('fetch', fetchNews)
        render(<NewsFlashRender widget={{ ...fixture, config: { fullWidthCount: 1, halfWidthCount: 14 }, data: { status: 'ready', items: stories(1, 12) } }} context={{ ...context, siteId: 85 }} />)
        fireEvent.click(screen.getByRole('button', { name: 'Load more news' }))
        await screen.findByRole('button', { name: 'Retry loading news' })
        expect(screen.getByText('Story 1')).toBeInTheDocument()
        expect(screen.getAllByRole('article')).toHaveLength(15)
        fireEvent.click(screen.getByRole('button', { name: 'Retry loading news' }))
        await screen.findByText('Story 15')
        expect(fetchNews.mock.calls.map(([url]) => new URL(url).searchParams.get('offset'))).toEqual(['12', '12'])
        await waitFor(() => expect(screen.queryByRole('button')).not.toBeInTheDocument())
    })
    it('preserves the initial priority decision through every continuation request', async () => {
        const fetchNews = vi.fn().mockResolvedValueOnce({ ok: true, json: async () => ({ priorityId: '99', items: stories(12, 12) }) })
            .mockResolvedValueOnce({ ok: true, json: async () => ({ priorityId: '99', items: stories(24, 2) }) })
        vi.stubGlobal('fetch', fetchNews)
        render(<NewsFlashRender widget={{ ...fixture, config: { fullWidthCount: 1, halfWidthCount: 25 },
            data: { status: 'ready', priorityId: '99', items: [{ id: 99, title: 'Priority', slug: 'priority' }, ...stories(1, 11)] } }} context={{ ...context, siteId: 85 }} />)
        fireEvent.click(screen.getByRole('button', { name: 'Load more news' }))
        await screen.findByText('Story 23')
        fireEvent.click(screen.getByRole('button', { name: 'Load more news' }))
        await screen.findByText('Story 25')
        expect(fetchNews.mock.calls.map(([url]) => new URL(url).searchParams.get('priorityId'))).toEqual(['99', '99'])
        expect(screen.getAllByRole('article')).toHaveLength(26)
    })

    it('automatically loads the next bounded page when the sentinel enters the viewport', async () => {
        let observeCallback: IntersectionObserverCallback
        vi.stubGlobal('IntersectionObserver', class {
            constructor(callback: IntersectionObserverCallback) { observeCallback = callback }
            observe() {}
            disconnect() {}
        })
        const fetchNews = vi.fn(async () => ({ ok: true, json: async () => ({ items: stories(13, 2) }) }))
        vi.stubGlobal('fetch', fetchNews)
        render(<NewsFlashRender widget={{ ...fixture, config: { fullWidthCount: 0, halfWidthCount: 14 }, data: { status: 'ready', items: stories(1, 12) } }} context={{ ...context, siteId: 85 }} />)
        const { act } = await import('@testing-library/react')
        await act(async () => observeCallback!([{ isIntersecting: true } as IntersectionObserverEntry], {} as IntersectionObserver))
        await screen.findByText('Story 14')
        expect(new URL(fetchNews.mock.calls[0][0]).searchParams.get('limit')).toBe('2')
    })
})
