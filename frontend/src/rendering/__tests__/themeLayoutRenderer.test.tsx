import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import PageRenderer from '../PageRenderer'
import { PUBLIC_RENDER_CSS } from '../publicRenderCss'
import { layoutDefinitionCss, normalizeLayoutDefinition, validateLayoutDefinition } from '../themeLayoutRenderer'
import type { RenderPageModel, ThemeLayoutDefinition } from '../types'

const layout: ThemeLayoutDefinition = {
    id: '08c564cc-7583-4bc2-9bd3-178f2d57d572',
    key: 'test_layout',
    label: 'Test layout',
    status: 'active',
    slots: { main: { label: 'Main' } },
    root: {
        id: '14a715dd-567c-42dc-8340-7bfe59037d36',
        type: 'semantic',
        tag: 'main',
        class_names: ['test-layout'],
        styles: { base: { display: 'grid', gap: '12px' }, md: { gap: '24px' } },
        children: [{
            id: 'c966d81c-ef31-47b5-920a-9c25ec0ff8f4',
            type: 'slot',
            slot_key: 'main',
            class_names: ['layout-slot', 'slot-main'],
            children: [],
            styles: {},
        }],
    },
}

describe('theme layout rendering', () => {
    it('renders semantic nodes and slots from the database definition', () => {
        const namedLayout = structuredClone(layout)
        namedLayout.root.label = 'Article area'
        namedLayout.root.editable_parameters = ['width', 'padding']
        const model: RenderPageModel = {
            layout: namedLayout.key,
            layoutDefinition: namedLayout,
            slots: { main: [{ id: 'content-1', type: 'easy_widgets.ContentWidget', config: { content: '<p>Database content</p>' } }] },
            context: { preview: true },
            designer: { catalog: {}, texts: {}, assets: [] },
        }

        const { container } = render(<PageRenderer model={model} />)

        expect(screen.getByText('Database content')).toBeInTheDocument()
        expect(container.querySelector('main.test-layout')).toBeTruthy()
        expect(container.querySelector('[data-slot-name="main"]')).toBeTruthy()
        const targets = JSON.parse(container.querySelector('main.test-layout')?.getAttribute('data-designer-targets') || '[]')
        expect(targets[0]).toEqual(expect.objectContaining({
            label: 'Article area',
            editableParameters: ['width', 'padding'],
        }))
    })

    it('allows every structural node type to expose Theme Designer parameters and presentation colours', () => {
        const editableGrid = structuredClone(layout)
        editableGrid.root.type = 'row'
        delete editableGrid.root.tag
        editableGrid.root.editable_parameters = ['grid_template_columns', 'gap', 'padding']
        editableGrid.root.presentation_color = '#6366f1'

        expect(validateLayoutDefinition(editableGrid)).toBe(true)
    })

    it('compiles only allowlisted structured styles at configured breakpoints', () => {
        const sized = structuredClone(layout)
        sized.root.styles.base.height = 'auto'
        sized.root.styles.md.height = 'clamp(20rem, 60vh, 48rem)'
        const css = layoutDefinitionCss(sized, { xs: 0, sm: 600, md: 900, lg: 1100, xl: 1400 })

        expect(css).toContain('display:grid')
        expect(css).toContain('height:auto')
        expect(css).toContain('@media(min-width:900px)')
        expect(css).toContain('gap:24px')
        expect(css).toContain('height:clamp(20rem, 60vh, 48rem)')
    })

    it('treats legacy and editor-entered unitless dimensions as pixels', () => {
        const sized = structuredClone(layout)
        sized.root.styles.base.width = 960 as any
        sized.root.styles.base.height = '112'
        sized.root.styles.md.min_height = '240.5'

        const css = layoutDefinitionCss(sized)

        expect(css).toContain('width:960px')
        expect(css).toContain('height:112px')
        expect(css).toContain('min-height:240.5px')
    })

    it('compiles theme color tokens using the theme variable contract', () => {
        const themed = structuredClone(layout)
        themed.root.styles.base.background_color = 'token:brand'

        const css = layoutDefinitionCss(themed)

        expect(css).toContain('background-color:var(--brand)')
        expect(css).not.toContain('var(--color-brand)')
    })

    it('compiles theme fonts and safe uploaded background images', () => {
        const themed = structuredClone(layout)
        themed.root.styles.base.font_family = 'Inter, sans-serif'
        themed.root.styles.base.background_image = 'https://cdn.example.test/theme/hero.webp'
        themed.root.styles.base.background_size = 'cover'

        const css = layoutDefinitionCss(themed)

        expect(css).toContain('font-family:Inter, sans-serif')
        expect(css).toContain('background-image:url("https://cdn.example.test/theme/hero.webp")')
        expect(css).toContain('background-size:cover')

        themed.root.styles.base.background_image = 'javascript:alert(1)'
        expect(validateLayoutDefinition(themed)).toBe(false)
    })

    it('applies presentation colours only in the layout editor canvas', () => {
        const presented = structuredClone(layout)
        presented.root.presentation_color = '#14b8a6'
        const baseModel: RenderPageModel = {
            layout: presented.key,
            layoutDefinition: presented,
            slots: { main: [] },
            context: { preview: true },
        }

        const publicRender = render(<PageRenderer model={baseModel} />)
        expect(publicRender.container.querySelector('main')).not.toHaveAttribute('data-layout-presentation-color')
        publicRender.unmount()

        const canvasRender = render(<PageRenderer model={{ ...baseModel, designer: { catalog: {}, texts: {}, assets: [], layoutCanvas: true } }} />)
        const root = canvasRender.container.querySelector('main')
        expect(root).toHaveAttribute('data-layout-presentation-color', '#14b8a6')
        expect(root).toHaveStyle({ '--layout-presentation-color': '#14b8a6' })
    })

    it('fills the available slot height with layout preview placeholder surfaces', () => {
        const previewLayout = structuredClone(layout)
        previewLayout.root.children[0].styles = { base: { height: '240px' } }
        const { container } = render(<PageRenderer model={{
            layout: previewLayout.key,
            layoutDefinition: previewLayout,
            slots: { main: [{
                id: 'layout-preview-placeholder-main',
                type: 'designer.LayoutSlotPlaceholder',
                config: { label: 'Main content', shade: 0 },
            }] },
            context: { preview: true },
            designer: { catalog: {}, texts: {}, assets: [], layoutCanvas: true },
        }} />)

        expect(container.querySelector('[data-slot-name="main"] > .widget-item')).toHaveClass('layout-preview-placeholder-item')
        expect(container.querySelector('[data-layout-preview-placeholder="true"]')).toHaveStyle({ flex: '1 1 auto', height: '100%', minHeight: 0 })
        expect(PUBLIC_RENDER_CSS).not.toContain('.layout-slot:has(>.layout-preview-placeholder-item){height:100%}')
        expect(PUBLIC_RENDER_CSS).toContain('.site-renderer .layout-slot>.layout-preview-placeholder-item{display:flex;flex:1 1 auto;flex-direction:column;min-height:0}')
    })

    it('rejects a slot that is not declared', () => {
        const invalid = structuredClone(layout)
        invalid.root.children[0].slot_key = 'missing'

        expect(validateLayoutDefinition(invalid)).toBe(false)
    })

    it('rejects responsive hiding of a subtree that contains a slot', () => {
        const invalid = structuredClone(layout)
        invalid.root.styles = { md: { display: ' NONE ' } }

        expect(validateLayoutDefinition(invalid)).toBe(false)
    })

    it('uses the safe slot-order fallback when a database layout reference is missing', () => {
        render(<PageRenderer model={{
            layout: 'main_layout',
            layoutDefinition: null,
            layoutDefinitionRequired: true,
            slots: { sidebar: [{ id: 'fallback', type: 'easy_widgets.ContentWidget', config: { content: '<p>Preserved content</p>' } }] },
            context: { preview: true },
        }} />)

        expect(screen.getByText('Preserved content')).toBeInTheDocument()
        expect(screen.getByText(/content is shown in slot order/i)).toBeInTheDocument()
    })

    it('normalizes camelCase API payloads at the React boundary', () => {
        const camel = structuredClone(layout) as any
        camel.root.classNames = camel.root.class_names
        delete camel.root.class_names
        camel.root.children[0].slotKey = camel.root.children[0].slot_key
        delete camel.root.children[0].slot_key
        camel.root.styles.base.maxWidth = '70rem'
        camel.root.presentationColor = '#14b8a6'

        const normalized = normalizeLayoutDefinition(camel)

        expect(normalized?.root.class_names).toEqual(['test-layout'])
        expect(normalized?.root.children[0].slot_key).toBe('main')
        expect(normalized?.root.styles?.base.max_width).toBe('70rem')
        expect(normalized?.root.presentation_color).toBe('#14b8a6')
        expect(validateLayoutDefinition(normalized)).toBe(true)
    })
})
