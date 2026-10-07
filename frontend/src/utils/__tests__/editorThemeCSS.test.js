import { describe, expect, it } from 'vitest'
import { readFileSync, readdirSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { PUBLIC_RENDER_CSS } from '../../rendering/publicRenderCss'
import { buildEditorThemeCSS, compileEditorCSS } from '../editorThemeCSS'

const testDir = dirname(fileURLToPath(import.meta.url))
const frontendRoot = resolve(testDir, '../../..')
const widgetSourcesDir = resolve(frontendRoot, '../backend/easy_widgets/widgets')
const editorWidgetBaseCSS = readFileSync(resolve(frontendRoot, 'src/styles/editorWidgetBase.css'), 'utf8')
const normalizeCSS = css => css.replace(/\s+/g, ' ').trim()

const options = {
    rootSelector: '.eceee-theme-scope[data-eceee-theme-scope="version-83"]',
    namespace: 'eceee-version-83-',
}

describe('compileEditorCSS', () => {
    it('rewrites document roots without corrupting classes, ids, or attributes', () => {
        const result = compileEditorCSS(
            '.body, #html, [data-part="body"] { color: red; } body .copy { color: blue; }',
            options,
        )

        expect(result).toContain('.body, #html, [data-part="body"]')
        expect(result).toContain(':scope .copy')
        expect(result).not.toContain('.:scope')
        expect(result).not.toContain('#:scope')
        expect(result).not.toContain('data-part=":scope"')
    })

    it('keeps nested rules within one native scope', () => {
        const result = compileEditorCSS(
            '@media (min-width: 40rem) { body .card { display: grid; } } @supports (display: subgrid) { .card { grid-template-columns: subgrid; } }',
            options,
        )

        expect(result.match(/@scope/g)).toHaveLength(1)
        expect(result).toContain('@media (min-width: 40rem)')
        expect(result).toContain(':scope .card')
        expect(result).toContain('@supports (display: subgrid)')
    })

    it('preserves CSS nesting inside style rules', () => {
        const style = declarations => Object.assign(Object.keys(declarations), {
            getPropertyValue: property => declarations[property],
            getPropertyPriority: () => '',
        })
        const nestedRule = {
            type: 1,
            cssText: '&:hover { color: blue; }',
            selectorText: '&:hover',
            style: style({ color: 'blue' }),
        }
        const rootRule = {
            type: 1,
            cssText: '.card { color: red; &:hover { color: blue; } }',
            selectorText: '.card',
            style: style({ color: 'red' }),
            cssRules: [nestedRule],
        }
        const OriginalCSSStyleSheet = globalThis.CSSStyleSheet
        globalThis.CSSStyleSheet = class {
            replaceSync() {
                this.cssRules = [rootRule]
            }
        }

        let result
        try {
            result = compileEditorCSS('.card {}', options)
        } finally {
            globalThis.CSSStyleSheet = OriginalCSSStyleSheet
        }

        expect(result).toContain('.card { color: red; &:hover { color: blue; }')
    })

    it('namespaces keyframes and their animation references', () => {
        const result = compileEditorCSS(
            '@keyframes spin { to { transform: rotate(1turn); } } .loader { animation: spin 1s linear; animation-name: spin; }',
            options,
        )

        expect(result).toContain('@keyframes eceee-version-83-spin')
        expect(result).toContain('animation: eceee-version-83-spin 1s linear')
        expect(result).toContain('animation-name: eceee-version-83-spin')
        expect(result).not.toMatch(/@keyframes spin\b/)
    })

    it('drops external imports because they cannot inherit the scope boundary', () => {
        const result = compileEditorCSS(
            '@import url("https://fonts.googleapis.com/css2?family=Inter"); @import url("https://example.com/site.css"); h1 { color: red; }',
            options,
        )

        expect(result).not.toContain('fonts.googleapis.com')
        expect(result).not.toContain('example.com')
    })
})

describe('buildEditorThemeCSS', () => {
    it('keeps the frontend widget baseline aligned with backend widget definitions', () => {
        const normalizedBaseline = normalizeCSS(editorWidgetBaseCSS)
        let widgetCSSCount = 0
        let variableCount = 0

        for (const filename of readdirSync(widgetSourcesDir).filter(name => name.endsWith('.py'))) {
            const source = readFileSync(resolve(widgetSourcesDir, filename), 'utf8')
            const widgetCSSMatch = source.match(/^\s{4}widget_css\s*=\s*(?:"""([\s\S]*?)"""|'''([\s\S]*?)''')/m)
            const widgetCSS = normalizeCSS(widgetCSSMatch?.[1] || widgetCSSMatch?.[2] || '')

            if (widgetCSS) {
                widgetCSSCount += 1
                expect(normalizedBaseline, `${filename} widget_css`).toContain(widgetCSS)
            }

            const variablesMatch = source.match(/^\s{4}css_variables\s*=\s*\{([\s\S]*?)^\s{4}\}/m)
            for (const match of variablesMatch?.[1]?.matchAll(/["']([^"']+)["']\s*:\s*["']([^"']*)["']/g) || []) {
                variableCount += 1
                expect(editorWidgetBaseCSS, `${filename} css_variables`).toContain(`--${match[1]}: ${match[2]};`)
            }
        }

        expect(widgetCSSCount).toBeGreaterThan(0)
        expect(variableCount).toBeGreaterThan(0)
    })

    it('builds theme and page CSS from the loaded frontend model', () => {
        const result = buildEditorThemeCSS({
            scopeId: 'version-83',
            theme: {
                fonts: { googleFonts: [{ family: 'Inter', variants: ['400', '700'] }] },
                colors: { primary: '#123456' },
                designGroups: {
                    groups: [{
                        elements: { h1: { color: 'primary' } },
                    }],
                },
                componentStyles: {
                    card: { css: '.card { display: grid; }' },
                },
                customCss: 'body .custom { margin: 0; }',
            },
            pageCssVariables: { contentWidth: '72rem' },
            pageCustomCss: '.page-only { max-width: var(--contentWidth); }',
        })

        expect(result).toContain('--primary: #123456')
        expect(result).toContain('fonts.googleapis.com')
        expect(result).toContain('--contentWidth: 72rem')
        expect(result).toContain('.card')
        expect(result).toContain(':scope .custom')
        expect(result).toContain('.page-only')
        expect(result).toContain('.two-columns-widget')
        expect(result).toContain('.content-widget { box-sizing: border-box; width: 100%; min-height: 32px;')
        expect(result).toContain('.banner-body.mode-header .banner-text')
        expect(result).toContain('.section-collapsed .expand-banner')
        expect(result).toContain('.nav-container { display: flex; flex-direction: column;')
        expect(result).toContain('.bio-widget--column .bio-widget__container')
        expect(result).toContain('.forms-widget input[type="text"]')
        expect(result).toContain('.content-card-body.image-size-rectangle .content-card-image')
        expect(result).toContain('.table-widget.table-no-borders th')
        expect(result).toContain('.two-columns-widget.two-col-ratio-5-1')
        expect(result).toContain('--form-padding: 2rem')
        expect(PUBLIC_RENDER_CSS).not.toContain('.content-widget{box-sizing:border-box')
    })

    it('omits page-level CSS when injection is disabled', () => {
        const result = buildEditorThemeCSS({
            scopeId: 'version-83',
            theme: { customCss: '.theme-rule { color: blue; }' },
            pageCustomCss: '.page-rule { color: red; }',
            enableCssInjection: false,
        })

        expect(result).toContain('.theme-rule')
        expect(result).not.toContain('.page-rule')
    })

    it('keeps modern and legacy design-group targeting in the complete stylesheet', () => {
        const result = buildEditorThemeCSS({
            scopeId: 'version-83',
            theme: {
                designGroups: {
                    groups: [
                        {
                            widgetTypes: ['easy_widgets.ContentWidget'],
                            slots: ['main'],
                            elements: { h1: { color: 'red' } },
                        },
                        {
                            widget_type: 'easy_widgets.BannerWidget',
                            slot: 'sidebar',
                            elements: { h2: { color: 'blue' } },
                        },
                        {
                            widgetType: 'easy_widgets.LegacyWidget',
                            elements: { p: { color: 'green' } },
                        },
                    ],
                },
            },
        })

        expect(result).toContain('.slot-main > .widget-type-easy-widgets-contentwidget h1')
        expect(result).toContain('.slot-sidebar > .widget-type-easy-widgets-bannerwidget h2')
        expect(result).toContain('.widget-type-easy-widgets-legacywidget p')
    })
})
