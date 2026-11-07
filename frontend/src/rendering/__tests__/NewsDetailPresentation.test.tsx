import React from 'react'
import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { PageRenderer } from '../PageRenderer'
import { createPageRenderModel } from '../adapters'
import { newsDetailPresentation } from '../newsDetailPresentation'

describe('News detail presentation', () => {
    it.each([true, false])('shows the title and introduction once with structured body %s', structured => {
        const html = '<h1>Energy &amp; security</h1><p>Our shared introduction.</p><h2>Next steps</h2><p>Further reporting with <a href="https://example.org">a source</a>.</p>'
        const item = { id: 1, title: 'Energy & security', data: { summary: 'Energy & security Our shared introduction.', content: html },
            widgets: { main: [{ id: 'body', type: 'easy_widgets.ContentWidget', config: { content: html } }] } }
        const original = JSON.stringify(item)
        const model = createPageRenderModel({ widgets: { main: [{ id: 'detail', type: 'easy_widgets.NewsDetailWidget',
            config: { renderObjectWidgets: structured }, data: { status: 'ready', item } }] } })
        const { container } = render(<PageRenderer model={model} />)
        expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1)
        expect(screen.getAllByText('Our shared introduction.')).toHaveLength(1)
        expect(container.querySelector('.news-summary')).toBeNull()
        expect(screen.getByRole('heading', { name: 'Next steps' })).toBeInTheDocument()
        expect(screen.getByRole('link', { name: 'a source' })).toHaveAttribute('href', 'https://example.org')
        expect(JSON.stringify(item)).toBe(original)
    })

    it('preserves a distinct standfirst and later headings, even one matching the article title', () => {
        const html = '<p>The full article starts here.</p><h1>Energy</h1><p>A later section.</p>'
        const result = newsDetailPresentation('Energy', 'A separate editorial standfirst.', html, {}, false)
        expect(result.html).toBe(html)
        expect(result.summary).toBe('A separate editorial standfirst.')
    })

    it('does not treat a word prefix as a duplicate introduction', () => {
        expect(newsDetailPresentation('Title', 'Power', '<p>Powerful new ideas.</p>', {}, false).summary).toBe('Power')
    })

    it('preserves content widget configuration and leaves other widgets untouched', () => {
        const slots = { main: [{ id: 'body', type: 'easy_widgets.ContentWidget', config: { html: '<h1>Title</h1><p>Intro.</p>', variantClasses: 'approved' } },
            { id: 'second', type: 'easy_widgets.ContentWidget', config: { content: '<h1>Title</h1>' } }] }
        const original = JSON.stringify(slots)
        const result = newsDetailPresentation('Title', 'Intro.', '', slots, true)
        expect(result.slots.main[0].config).toEqual({ html: '<p>Intro.</p>', variantClasses: 'approved' })
        expect(result.slots.main[1]).toBe(slots.main[1])
        expect(JSON.stringify(slots)).toBe(original)
    })
})
