import { describe, expect, it } from 'vitest'
import {
    compileRenderStyles,
    normalizeThemeCssConfig,
    resolveEffectivePageCss,
} from '../themeCssCompiler'

const themeFixture = {
    fonts: { google_fonts: [{ family: 'Source Sans 3', variants: ['400', '700'], display: 'optional' }] },
    colors: { brand: '#123456' },
    breakpoints: { md: 800 },
    design_groups: {
        groups: [{
            widget_types: ['easy_widgets.ContentWidget'],
            slots: ['main'],
            elements: { h1: { color: 'brand', font_family: 'Source Sans 3, sans-serif' } },
            layout_properties: {
                'content-widget': {
                    xs: { minHeight: '20rem' },
                    900: { minHeight: '30rem' },
                },
            },
        }],
        structural_spacing: [{
            scope: 'layoutSlot', layout: 'main_layout', slot: 'main', breakpoint: 'xs',
            values: { paddingLeft: '2rem' },
        }],
    },
    component_styles: {
        card: { css: { xs: '.card { display: grid; }', md: '.card { gap: 2rem; }' } },
    },
    image_styles: {
        hero: { css: { xs: '.widget-image { object-fit: cover; }' } },
    },
    gallery_styles: {
        legacyGallery: { css: '.legacy-gallery { gap: 1rem; }' },
    },
    custom_css: '.theme-custom { color: var(--brand); }',
}

describe('canonical render CSS compiler', () => {
    it('normalizes legacy and snake_case theme fields once', () => {
        const normalized = normalizeThemeCssConfig(themeFixture)
        expect(normalized.designGroups.groups[0].widgetTypes).toEqual(['easy_widgets.ContentWidget'])
        expect(normalized.designGroups.structuralSpacing).toHaveLength(1)
        expect(Object.keys(normalized.imageStyles)).toEqual(expect.arrayContaining(['hero', 'legacyGallery']))
        expect(normalized.breakpoints.md).toBe(800)
    })

    it('lets unified image styles override legacy collections at the same key', () => {
        const normalized = normalizeThemeCssConfig({
            gallery_styles: { hero: { css: '.legacy-hero {}' } },
            carouselStyles: { hero: { css: '.carousel-hero {}' } },
            image_styles: { hero: { css: '.unified-hero {}' } },
        })
        expect(normalized.imageStyles.hero.css).toBe('.unified-hero {}')
    })

    it('compiles xs, numeric breakpoints, structural spacing and unified image styles', () => {
        const { css, fontUrl } = compileRenderStyles({
            theme: themeFixture,
            page: { page_css_variables: { pageFallback: 'red' }, page_custom_css: '.page-fallback {}' },
            version: { page_css_variables: { versionOnly: 'blue' }, page_custom_css: '.version-only {}' },
        })
        expect(css).toContain('.card { display: grid; }')
        expect(css).toContain('font-family: "Source Sans 3", sans-serif')
        expect(css).toContain('@media (min-width: 800px)')
        expect(css).toContain('@media (min-width: 900px)')
        expect(css).toContain('[data-render-layout="main_layout"] .layout-slot[data-slot-name="main"]')
        expect(css).toContain('padding-left: 2rem')
        expect(css).toContain('.widget-image { object-fit: cover; }')
        expect(css).toContain('.legacy-gallery { gap: 1rem; }')
        expect(css).toContain('--versionOnly: blue')
        expect(css).not.toContain('--pageFallback: red')
        expect(fontUrl).toContain('family=Source+Sans+3:wght@400;700&display=optional')
    })

    it('keeps the canonical cascade order stable', () => {
        const { css } = compileRenderStyles({
            theme: {
                fonts: { googleFonts: [{ family: 'Source Sans 3', variants: ['400', '700'] }] },
                colors: { orderColor: '#123456' },
                designGroups: { groups: [{
                    targetingMode: 'css-classes',
                    targetCssClasses: '.design-order',
                    elements: { h6: { color: 'orderColor' } },
                }] },
                componentStyles: { card: { css: '.component-order {}' } },
                imageStyles: { hero: { css: '.image-order {}' } },
                customCss: '.theme-order {}',
            },
            page: { pageCustomCss: '.page-order {}' },
        })
        const markers = [
            'html,body,#root{margin:0',
            '.site-renderer{min-height:100vh}',
            '/* Widget:',
            '--orderColor: #123456',
            '.design-order h6 {',
            '.component-order {}',
            '.image-order {}',
            '.theme-order {}',
            '.page-order {}',
        ]
        const positions = markers.map(marker => css.indexOf(marker))
        expect(positions.every(position => position >= 0)).toBe(true)
        expect(positions).toEqual([...positions].sort((left, right) => left - right))
        expect(css).not.toContain('/*! tailwindcss')
        expect(css).not.toContain('--tw-')
        expect(css).toContain('border-width:0;border-style:solid;border-color:#e5e7eb')
        expect(css).toContain('body,.site-renderer {\n  font-family: "Source Sans 3", ui-sans-serif, system-ui, -apple-system, sans-serif;\n}')
        expect(css.match(/\.media-insert img\{/g)).toHaveLength(1)
    })

    it.each([
        [{}, {}, true],
        [{ enableCssInjection: false }, {}, false],
        [{}, { enable_css_injection: false }, false],
        [{ enable_css_injection: true }, { enableCssInjection: true }, true],
    ])('resolves page/version enablement for page %j and version %j', (page, version, expected) => {
        expect(resolveEffectivePageCss(page, version).enabled).toBe(expected)
    })

    it('falls back to page values only when version values are empty', () => {
        expect(resolveEffectivePageCss(
            { pageCssVariables: { inherited: 'yes' }, pageCustomCss: '.page {}' },
            { page_css_variables: {}, page_custom_css: '   ' },
        )).toMatchObject({ variables: { inherited: 'yes' }, customCss: '.page {}' })
    })
})
