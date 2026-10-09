import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import PageRenderer from '../PageRenderer'
import { layoutCanvasDimensionsCss, layoutDefinitionCss, normalizeLayoutDefinition, validateLayoutDefinition } from '../themeLayoutRenderer'
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

    it('allows grid nodes to expose selected Theme Designer parameters', () => {
        const editableGrid = structuredClone(layout)
        editableGrid.root.type = 'grid'
        delete editableGrid.root.tag
        editableGrid.root.editable_parameters = ['grid_template_columns', 'gap', 'padding']

        expect(validateLayoutDefinition(editableGrid)).toBe(true)
    })

    it('compiles only allowlisted structured styles at configured breakpoints', () => {
        const css = layoutDefinitionCss(layout, { xs: 0, sm: 600, md: 900, lg: 1100, xl: 1400 })

        expect(css).toContain('display:grid')
        expect(css).toContain('@media(min-width:900px)')
        expect(css).toContain('gap:24px')
    })

    it('scales slot guide heights relative to the active theme viewport only in the layout canvas', () => {
        const dimensioned = structuredClone(layout)
        dimensioned.slots.main.dimensions = {
            mobile: { width: 640, height: 112 },
            tablet: { width: 1024, height: 112 },
            desktop: { width: 1280, height: 112 },
        }

        const css = layoutCanvasDimensionsCss(dimensioned, { xs: 0, sm: 600, md: 768, lg: 1000, xl: 1200 })

        expect(css).toContain('calc(100vw * 112 / 640)')
        expect(css).toContain('@media(min-width:768px)')
        expect(css).toContain('calc(100vw * 112 / 1024)')
        expect(css).toContain('@media(min-width:1200px)')
        expect(css).toContain('calc(100vw * 112 / 1280)')
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
