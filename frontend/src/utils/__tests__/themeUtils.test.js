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

    it('renders footer palette colors directly at every breakpoint', () => {
        const css = generateDesignGroupsCSS({
            groups: [{
                widgetTypes: ['easy_widgets.FooterWidget'],
                layoutProperties: {
                    'footer-widget': {
                        xs: {
                            backgroundColor: 'brand',
                            color: 'onBrand',
                        },
                        md: {
                            backgroundColor: 'brandDark',
                        },
                    },
                },
            }],
        }, {
            brand: '#0891b2',
            brandDark: '#155e75',
            onBrand: '#f9fafb',
        })

        expect(css).toContain('background-color: var(--brand);')
        expect(css).toContain('color: var(--onBrand);')
        expect(css).toContain('background-color: var(--brandDark);')
        expect(css).not.toContain('--footer-bg-color-')
        expect(css).not.toContain('--footer-text-color-')
    })

    it('renders numeric custom breakpoints defined by Theme Designer', () => {
        const css = generateDesignGroupsCSS({
            groups: [{
                widgetTypes: ['easy_widgets.FooterWidget'],
                layoutProperties: {
                    'footer-widget': {
                        900: { padding: '3rem' },
                    },
                },
            }],
        })

        expect(css).toContain('@media (min-width: 900px)')
        expect(css).toContain('padding: 3rem;')
    })

    it('renders responsive structural spacing for layout, widget, and nested widget-slot targets', () => {
        const css = generateDesignGroupsCSS({
            groups: [],
            structuralSpacing: [
                { scope: 'layoutSlot', layout: 'main_layout', slot: 'main', breakpoint: 'xs', values: { paddingLeft: '1rem' } },
                { scope: 'widget', widgetType: 'easy_widgets.ContentWidget', breakpoint: 'md', values: { marginBottom: '2rem' } },
                { scope: 'widgetSlot', widgetType: 'easy_widgets.TwoColumnsWidget', slot: 'left', breakpoint: '900', values: { padding: '24px' } },
                { scope: 'widgetPart', widgetType: 'easy_widgets.HeroWidget', part: 'hero-content', breakpoint: 'xl', values: { paddingTop: '32px' } },
            ],
        })

        expect(css).toContain('[data-render-layout="main_layout"] .layout-slot[data-slot-name="main"]')
        expect(css).toContain('padding-left: 1rem;')
        expect(css).toContain('@media (min-width: 768px)')
        expect(css).toContain('[data-widget-id][data-widget-type="easy_widgets.ContentWidget"]')
        expect(css).toContain('@media (min-width: 900px)')
        expect(css).toContain('[data-widget-slot="left"][data-owner-widget-type="easy_widgets.TwoColumnsWidget"]')
        expect(css).toContain('[data-widget-id][data-widget-type="easy_widgets.HeroWidget"] .hero-content')
        expect(css).toContain('padding-top: 32px;')
    })

    it('emits structural spacing in mobile-first order regardless of edit order', () => {
        const css = generateDesignGroupsCSS({
            groups: [],
            structuralSpacing: [
                { scope: 'layoutSlot', layout: 'main_layout', slot: 'main', breakpoint: 'xl', values: { paddingLeft: '4rem' } },
                { scope: 'layoutSlot', layout: 'main_layout', slot: 'main', breakpoint: 'xs', values: { paddingLeft: '1rem' } },
            ],
        })

        expect(css.indexOf('padding-left: 1rem;')).toBeLessThan(css.indexOf('padding-left: 4rem;'))
    })
})
