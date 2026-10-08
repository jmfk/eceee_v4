import { describe, expect, it } from 'vitest'
import { generateDesignGroupsCSS } from '../themeUtils'

describe('generateDesignGroupsCSS', () => {
    it('targets layout parts on either the widget root or a descendant', () => {
        const css = generateDesignGroupsCSS({
            groups: [{
                widgetTypes: ['easy_widgets.FormsWidget'],
                layoutProperties: {
                    'forms-widget': {
                        xs: { padding: '2rem' },
                    },
                },
            }],
        })

        expect(css).toContain('.widget-type-easy-widgets-formswidget.forms-widget')
        expect(css).toContain('.widget-type-easy-widgets-formswidget .forms-widget')
    })

    it('keeps untargeted groups when filtering for a widget and slot', () => {
        const css = generateDesignGroupsCSS({
            groups: [
                {
                    widgetType: null,
                    slot: null,
                    elements: { h1: { color: 'red' } },
                },
                {
                    widgetType: 'easy_widgets.ContentWidget',
                    slot: 'main',
                    elements: { p: { color: 'blue' } },
                },
                {
                    widgetType: 'easy_widgets.BannerWidget',
                    slot: 'sidebar',
                    elements: { h2: { color: 'green' } },
                },
            ],
        }, {}, '', 'easy_widgets.ContentWidget', 'main')

        expect(css).toContain('h1 {')
        expect(css).toContain('.slot-main > .widget-type-easy-widgets-contentwidget p')
        expect(css).not.toContain('easy-widgets-bannerwidget')
    })

    it('resolves palette colors in layout properties', () => {
        const css = generateDesignGroupsCSS({
            groups: [{
                widgetTypes: ['easy_widgets.NavigationWidget'],
                layoutProperties: {
                    'nav-container': {
                        xs: {
                            backgroundColor: 'orange5',
                            color: 'black',
                        },
                    },
                },
            }],
        }, {
            orange5: '#ab7a1a',
            black: '#000000',
        })

        expect(css).toContain('background-color: var(--orange5);')
        expect(css).toContain('color: var(--black);')
    })
})
