import React from 'react'
import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import cases from '../../../../backend/webpages/tests/fixtures/pilot_baseline/cases.json'
import { createPageRenderModel } from '../adapters'
import RenderDocument from '../RenderDocument'

describe('portable pilot render baseline', () => {
    it('preserves all fixture types, headings, child identities and ordering', () => {
        const { container } = render(<RenderDocument model={createPageRenderModel({ widgets: cases.widgets })} />)
        expect(screen.getAllByRole('heading').map(node => node.textContent)).toEqual(cases.expectedHeadings)
        expect([...container.querySelectorAll('[data-widget-id]')].map(node => node.getAttribute('data-widget-id')))
            .toEqual(['pilot-headline', 'pilot-banner', 'pilot-columns', 'pilot-left', 'pilot-right', 'pilot-form'])
        expect(container.querySelector('.two-columns-widget')).toHaveClass('two-col-ratio-4-2')
        expect(container.querySelector('.render-error-state')).toBeNull()
    })

    it('keeps forms usable and prevents preview submission', () => {
        const { container } = render(<RenderDocument model={createPageRenderModel({ widgets: cases.widgets })} />)
        expect(screen.getByRole('textbox', { name: 'Your name Required' })).toBeRequired()
        fireEvent.change(screen.getByRole('combobox', { name: 'Topic' }), { target: { value: 'Press' } })
        expect(screen.getByRole('combobox', { name: 'Topic' })).toHaveValue('Press')
        expect(fireEvent.submit(container.querySelector('form')!)).toBe(false)
    })

    it('does not mutate stored fixture data when preview state changes', () => {
        const before = JSON.stringify(cases.widgets)
        const { rerender } = render(<RenderDocument model={createPageRenderModel({ widgets: cases.widgets })} />)
        rerender(<RenderDocument model={createPageRenderModel({ widgets: { main: [{
            id: 'unsaved', type: 'easy_widgets.HeadlineWidget', config: { content: 'Unsaved pilot' },
        }] } })} />)
        expect(screen.getByRole('heading')).toHaveTextContent('Unsaved pilot')
        expect(JSON.stringify(cases.widgets)).toBe(before)
        rerender(<RenderDocument model={createPageRenderModel({ widgets: cases.widgets })} />)
        expect(screen.getAllByRole('heading').map(node => node.textContent)).toEqual(cases.expectedHeadings)
    })

    it('omits invisible widgets including their nested children', () => {
        const widgets = { main: cases.widgets.main.map(widget => ({
            ...widget, config: { ...widget.config, isVisible: false },
        })) }
        const { container } = render(<RenderDocument model={createPageRenderModel({ widgets })} />)
        expect(container.querySelectorAll('[data-widget-id]')).toHaveLength(0)
    })

    it('sanitizes rich banner content without losing safe content', () => {
        const widgets = { main: [{ id: 'unsafe', type: 'easy_widgets.BannerWidget', config: {
            bannerMode: 'text', textContent: '<h3>Safe banner</h3><script>bad()</script><a href="javascript:bad()">Safe label</a>',
        } }] }
        const { container } = render(<RenderDocument model={createPageRenderModel({ widgets })} />)
        expect(screen.getByRole('heading', { name: 'Safe banner' })).toBeVisible()
        expect(screen.getByText('Safe label')).toBeVisible()
        expect(container.querySelector('script,[href^="javascript:"]')).toBeNull()
    })
})
