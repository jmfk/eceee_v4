import React from 'react'
import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { NewsFlashRender } from '../NewsFlashRender'
import { RENDER_WIDGET_FIXTURES } from '../fixtures'

const fixture = RENDER_WIDGET_FIXTURES['easy_widgets.NewsFlashWidget']
const context = { preview: false }

describe('News Flash presentation', () => {
    it('renders the same three distinct stories once, with a lead and two supporting stories', () => {
        const { container } = render(<NewsFlashRender widget={fixture} context={context} />)
        expect(screen.getAllByRole('article')).toHaveLength(3)
        expect(screen.getAllByRole('heading').map(item => item.textContent)).toEqual([
            'News 1 — A clear lead story', 'News 2 — Another perspective', 'News 3 — What happens next',
        ])
        expect(container.querySelectorAll('.news-flash-lead')).toHaveLength(1)
        expect(screen.getByRole('link', { name: 'News 3 — What happens next' })).toHaveAttribute('href', '/news/third-story/')
        expect(container.querySelectorAll('img')).toHaveLength(3)
    })

    it('handles a missing image and a long title without inventing another story', () => {
        const title = 'A long news headline '.repeat(12)
        const widget = { ...fixture, data: { status: 'ready' as const, items: [{ id: 1, title, slug: 'one' }] } }
        const { container } = render(<NewsFlashRender widget={widget} context={context} />)
        expect(screen.getAllByRole('article')).toHaveLength(1)
        expect(screen.getByRole('heading').textContent).toBe(title)
        expect(container.querySelector('img')).toBeNull()
    })

    it.each(['loading', 'empty', 'error'] as const)('has a readable %s state', status => {
        render(<NewsFlashRender widget={{ ...fixture, data: { status, items: [] } }} context={context} />)
        expect(screen.queryByRole('article')).not.toBeInTheDocument()
        expect(screen.getByText(status === 'loading' ? 'Loading news…' : status === 'error' ? 'News could not be loaded.' : 'No published news available.')).toBeInTheDocument()
    })

    it('limits the display to three and safely constructs the configured detail URL', () => {
        const widget = { ...fixture, config: { news_page_path: '/updates/', show_excerpts: false }, data: { status: 'ready' as const, items: [1, 2, 3, 4].map(id => ({ id, title: `Story ${id}`, slug: 'a/b', data: { summary: 'Hidden summary' } })) } }
        render(<NewsFlashRender widget={widget} context={context} />)
        expect(screen.getAllByRole('article')).toHaveLength(3)
        expect(screen.getAllByRole('link')[0]).toHaveAttribute('href', '/updates/a%2Fb/')
        expect(screen.queryByText('Hidden summary')).not.toBeInTheDocument()
    })
})
