import { useState } from 'react'
import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import LayoutDesignerWorkspace from '../LayoutDesignerWorkspace'

const framePostMessage = vi.fn()

vi.mock('../../../rendering/RenderFrame', () => ({
    default: ({ model, onMessage, style, frameRef }) => {
        if (frameRef) frameRef.current = { contentWindow: { postMessage: framePostMessage } }
        return <button type="button" data-layout-canvas={String(model.designer.layoutCanvas)} data-empty-slots={String(Object.values(model.slots).every((items) => items.length === 0))} data-frame-width={style?.width} data-root-md-background={model.layoutDefinition.root.styles?.md?.background_color || ''} data-root-presentation-color={model.layoutDefinition.root.presentation_color || ''} onClick={() => onMessage?.({ data: { source: 'eceee-designer-preview', action: 'select', targetId: `layout-node:${model.layoutDefinition.root.children[0].id}` } })}>Canvas · {model.layoutDefinition.label}</button>
    },
}))

const document = {
    schema_version: 1,
    default_layout_key: 'main_layout',
    items: [{
        id: '8ac4db5a-492f-4977-bf00-d21b8d72f08e',
        key: 'main_layout',
        label: 'Main layout',
        description: '',
        status: 'active',
        slots: { main: { label: 'Main', max_widgets: null, collapse_behavior: 'never', default_widgets: [] } },
        root: {
            id: '2d1ee676-3624-4ec8-aaf4-8874bea037f4', type: 'container', children: [{
                id: '114eff0f-f86f-4a10-8df5-27925804fc73', type: 'slot', slot_key: 'main', children: [], styles: {}, class_names: ['layout-slot'],
            }], styles: { base: { width: '100%' } }, class_names: ['main-layout'],
        },
    }, {
        id: '978bc2e0-6326-4872-a079-e63e341c3b67',
        key: 'landing_page',
        label: 'Landing Page',
        description: '',
        status: 'active',
        slots: { landing_page: { label: 'Landing Page', max_widgets: null, collapse_behavior: 'never', default_widgets: [] } },
        root: {
            id: 'ce275523-49d3-4cb5-935b-433c75b7e12a', type: 'container', children: [{
                id: 'c050c19e-b8a8-40ee-a36c-721767cf32fd', type: 'slot', slot_key: 'landing_page', children: [], styles: {}, class_names: ['layout-slot'],
            }], styles: { base: { width: '100%' } }, class_names: ['landing-page'],
        },
    }, {
        id: 'e50362aa-1ee5-4ff6-9421-f738546248f4',
        key: 'error_layout',
        label: 'Error Page',
        description: '',
        status: 'active',
        slots: { message: { label: 'Error Message', max_widgets: null, collapse_behavior: 'never', default_widgets: [] } },
        root: {
            id: 'fd38fdea-e26a-4b23-a161-07302d4d2fc3', type: 'semantic', tag: 'main', children: [{
                id: 'dc79689c-c2e2-4c11-8ac4-ae67cc395e97', type: 'slot', slot_key: 'message', children: [], styles: {}, class_names: ['layout-slot'],
            }], styles: { base: { width: '100%' } }, class_names: ['error-page'],
        },
    }],
}

const Harness = ({ disabled = false, sourceDocument = document, viewport = 'md' }) => {
    const [workspace, setWorkspace] = useState({ layouts: structuredClone(sourceDocument), layoutUsage: {}, breakpoints: { xs: 0, sm: 640, md: 768, lg: 1024, xl: 1280 } })
    return <LayoutDesignerWorkspace workspace={workspace} viewport={viewport} updateWorkspace={(updater) => setWorkspace((current) => updater(structuredClone(current)))} disabled={disabled} />
}

describe('LayoutDesignerWorkspace', () => {
    it('keeps the tree, canvas, and inspector on the same layout document', () => {
        render(<Harness />)

        expect(screen.getByRole('button', { name: 'Canvas · Main layout' })).toBeInTheDocument()
        expect(screen.getByRole('button', { name: 'Canvas · Main layout' })).toHaveAttribute('data-layout-canvas', 'true')
        expect(screen.getByRole('button', { name: 'Canvas · Main layout' })).toHaveAttribute('data-empty-slots', 'true')
        fireEvent.click(screen.getByRole('button', { name: /Main layout main_layout/ }))
        fireEvent.change(screen.getByLabelText('Layout label'), { target: { value: 'Article layout' } })
        expect(screen.getByRole('button', { name: 'Canvas · Article layout' })).toBeInTheDocument()
        expect(screen.getByText('Article layout')).toBeInTheDocument()
    })

    it('switches the inspector between layouts and selected canvas elements', () => {
        render(<Harness />)

        expect(screen.getByRole('heading', { name: 'Container' })).toBeInTheDocument()
        expect(screen.queryByLabelText('Layout label')).not.toBeInTheDocument()

        fireEvent.click(screen.getByRole('button', { name: 'Canvas · Main layout' }))
        expect(screen.getByRole('heading', { name: 'Slot · main' })).toBeInTheDocument()

        fireEvent.click(screen.getByRole('button', { name: /Main layout main_layout/ }))
        expect(screen.getByRole('heading', { name: 'Layout inspector' })).toBeInTheDocument()
        expect(screen.getByLabelText('Layout label')).toHaveValue('Main layout')
    })

    it('selects the same layout node in the canvas when it is chosen in the structure tree', () => {
        framePostMessage.mockClear()
        render(<Harness />)

        fireEvent.click(screen.getByRole('button', { name: 'Slot · main' }))

        expect(screen.getByRole('heading', { name: 'Slot · main' })).toBeInTheDocument()
        expect(framePostMessage).toHaveBeenCalledWith({
            source: 'eceee-render-host',
            action: 'selectTarget',
            targetId: 'layout-node:114eff0f-f86f-4a10-8df5-27925804fc73',
        }, '*')
    })

    it('adds a slot with undo and reports invalid JSON in place', () => {
        render(<Harness />)

        fireEvent.change(screen.getByLabelText('Node to add'), { target: { value: 'slot' } })
        expect(screen.getAllByText('Slot 2')).toHaveLength(2)
        fireEvent.click(screen.getByRole('button', { name: 'Undo layout change' }))
        expect(screen.queryAllByText('Slot 2')).toHaveLength(0)

        fireEvent.click(screen.getByRole('tab', { name: 'JSON' }))
        fireEvent.change(screen.getByLabelText('Canonical layout document'), { target: { value: '{' } })
        fireEvent.click(screen.getByRole('button', { name: 'Apply JSON' }))
        expect(screen.getByRole('alert')).toHaveTextContent('JSON could not be parsed')
    })

    it('names supported elements and chooses which parameters the Theme Designer may edit', () => {
        render(<Harness />)

        fireEvent.change(screen.getByLabelText('Element name'), { target: { value: 'Site frame' } })
        const widthParameter = screen.getByRole('checkbox', { name: 'Expose width in Theme Designer' })
        fireEvent.click(widthParameter)

        expect(screen.getAllByText('Site frame')).toHaveLength(2)
        expect(widthParameter).toBeChecked()
        expect(widthParameter.closest('label')).toHaveAttribute('title', 'Expose width in the Theme Designer')
        expect(screen.queryByText('Designer-editable parameters')).not.toBeInTheDocument()
    })

    it('names semantic nodes from their HTML element and qualifies custom names with the tag', () => {
        const semanticDocument = structuredClone(document)
        semanticDocument.items[0].root.type = 'semantic'
        semanticDocument.items[0].root.tag = 'aside'

        render(<Harness sourceDocument={semanticDocument} />)

        expect(screen.getByRole('button', { name: 'Aside' })).toBeInTheDocument()
        expect(screen.getByRole('heading', { name: 'Aside' })).toBeInTheDocument()

        fireEvent.change(screen.getByLabelText('Element name'), { target: { value: 'Sidebar' } })
        expect(screen.getByRole('button', { name: 'Sidebar <aside>' })).toBeInTheDocument()
        expect(screen.getByRole('heading', { name: 'Sidebar <aside>' })).toBeInTheDocument()

        fireEvent.change(screen.getByLabelText('Semantic element'), { target: { value: 'div' } })
        expect(screen.getByRole('button', { name: 'Sidebar <div>' })).toBeInTheDocument()
        expect(screen.getByRole('heading', { name: 'Sidebar <div>' })).toBeInTheDocument()

        fireEvent.change(screen.getByLabelText('Element name'), { target: { value: '' } })
        expect(screen.getByRole('button', { name: 'Div' })).toBeInTheDocument()
        expect(screen.getByRole('heading', { name: 'Div' })).toBeInTheDocument()
    })

    it('shows inherited grid styles and creates and resets breakpoint overrides', () => {
        const gridDocument = structuredClone(document)
        const slot = gridDocument.items[0].root.children[0]
        gridDocument.items[0].root.children = [{
            id: 'dd8262a7-06c2-49e2-90c8-980ae681706f',
            type: 'grid',
            label: 'Content grid',
            children: [slot],
            class_names: ['main-layout-grid'],
            styles: {
                base: { display: 'grid', gap: '30px', padding: '30px 40px' },
                lg: { grid_template_columns: 'repeat(3, minmax(0, 1fr))' },
            },
        }]

        render(<Harness sourceDocument={gridDocument} viewport="xl" />)
        fireEvent.click(screen.getByRole('button', { name: 'Content grid' }))

        expect(screen.getByText('Grid layout')).toBeInTheDocument()
        expect(screen.getByText('Other styles')).toBeInTheDocument()
        expect(screen.getByLabelText('gap value')).toBeDisabled()
        expect(screen.getByLabelText('gap value')).toHaveValue('30px')
        expect(screen.getAllByText('Inherited from Base').length).toBeGreaterThan(0)
        expect(screen.getByLabelText('grid template columns value')).toHaveValue('repeat(3, minmax(0, 1fr))')
        expect(screen.getByText('Inherited from Large (Desktop)')).toBeInTheDocument()
        expect(screen.getByRole('button', { name: 'Override gap at Extra Large' }).closest('label')).toBeNull()

        fireEvent.click(screen.getByRole('button', { name: 'Override gap at Extra Large' }))
        expect(screen.getByLabelText('gap value')).toBeEnabled()
        expect(screen.getByRole('button', { name: 'Reset gap override' })).toBeInTheDocument()
        expect(screen.getByRole('checkbox', { name: 'Expose gap in Theme Designer' })).toBeInTheDocument()

        fireEvent.change(screen.getByLabelText('gap value'), { target: { value: '36px' } })
        expect(screen.getByLabelText('gap value')).toHaveValue('36px')
        fireEvent.click(screen.getByRole('button', { name: 'Reset gap override' }))
        expect(screen.getByLabelText('gap value')).toBeDisabled()
        expect(screen.getByLabelText('gap value')).toHaveValue('30px')
    })

    it('resizes the structure and inspector panels with accessible separators', () => {
        render(<Harness />)

        const structureSeparator = screen.getByRole('separator', { name: 'Resize layout structure panel' })
        const inspectorSeparator = screen.getByRole('separator', { name: 'Resize layout inspector' })
        expect(structureSeparator).toHaveAttribute('aria-valuenow', '300')
        expect(inspectorSeparator).toHaveAttribute('aria-valuenow', '340')

        fireEvent.keyDown(structureSeparator, { key: 'ArrowLeft' })
        fireEvent.keyDown(inspectorSeparator, { key: 'ArrowRight' })

        expect(Number(structureSeparator.getAttribute('aria-valuenow'))).toBeLessThan(300)
        expect(Number(inspectorSeparator.getAttribute('aria-valuenow'))).toBeLessThan(340)
    })

    it('collapses and restores the structure and inspector panels', () => {
        render(<Harness />)

        fireEvent.click(screen.getByRole('button', { name: 'Collapse layout structure panel' }))
        expect(screen.queryByRole('heading', { name: 'Layouts' })).not.toBeInTheDocument()
        expect(screen.getByRole('button', { name: 'Expand layout structure panel' })).toHaveAttribute('aria-expanded', 'false')

        fireEvent.click(screen.getByRole('button', { name: 'Collapse layout inspector' }))
        expect(screen.queryByRole('heading', { name: 'Container' })).not.toBeInTheDocument()
        expect(screen.getByRole('button', { name: 'Expand layout inspector' })).toHaveAttribute('aria-expanded', 'false')

        fireEvent.click(screen.getByRole('button', { name: 'Expand layout structure panel' }))
        fireEvent.click(screen.getByRole('button', { name: 'Expand layout inspector' }))
        expect(screen.getByRole('heading', { name: 'Layouts' })).toBeInTheDocument()
        expect(screen.getByRole('heading', { name: 'Container' })).toBeInTheDocument()
    })

    it('sets responsive node colours with a visual picker while preserving text values', () => {
        render(<Harness />)

        const canvas = screen.getByRole('button', { name: 'Canvas · Main layout' })
        expect(canvas).toHaveAttribute('data-root-md-background', '')
        fireEvent.change(screen.getByLabelText('Pick background color'), { target: { value: '#22c55e' } })

        expect(screen.getByLabelText('background color value')).toHaveValue('#22c55e')
        expect(screen.getByRole('button', { name: 'Canvas · Main layout' })).toHaveAttribute('data-root-md-background', '#22c55e')

        fireEvent.change(screen.getByLabelText('background color value'), { target: { value: 'token:surface' } })
        expect(screen.getByLabelText('background color value')).toHaveValue('token:surface')
    })

    it('sets and clears an editor-only presentation colour on the selected element', () => {
        render(<Harness />)

        expect(screen.getByText('Type default')).toBeInTheDocument()
        fireEvent.change(screen.getByLabelText('Presentation color'), { target: { value: '#14b8a6' } })

        expect(screen.getByText('#14b8a6')).toBeInTheDocument()
        expect(screen.getByRole('button', { name: 'Canvas · Main layout' })).toHaveAttribute('data-root-presentation-color', '#14b8a6')

        fireEvent.click(screen.getByRole('button', { name: 'Use default' }))
        expect(screen.getByText('Type default')).toBeInTheDocument()
        expect(screen.getByRole('button', { name: 'Canvas · Main layout' })).toHaveAttribute('data-root-presentation-color', '')
    })

    it('blocks every document mutation while the workspace is disabled', () => {
        render(<Harness disabled />)

        expect(screen.getByRole('button', { name: 'Slot · main' })).toBeDisabled()
        expect(screen.getByRole('button', { name: 'Move node down' })).toBeDisabled()
        expect(screen.getByLabelText('Element name')).toBeDisabled()

        fireEvent.change(screen.getByLabelText('Element name'), { target: { value: 'Must not persist' } })
        expect(screen.getByRole('button', { name: 'Canvas · Main layout' })).toBeInTheDocument()

        fireEvent.click(screen.getByRole('tab', { name: 'JSON' }))
        expect(screen.getByLabelText('Canonical layout document')).toBeDisabled()
    })

    it('uses theme breakpoints for the canvas and provides fit and manual zoom', () => {
        render(<Harness />)

        const breakpointGroup = screen.getByRole('group', { name: 'Theme breakpoint' })
        const tabletBreakpoint = screen.getByRole('button', { name: 'Medium (Tablet) breakpoint at 768px' })
        expect(breakpointGroup).toContainElement(tabletBreakpoint)
        expect(tabletBreakpoint).toHaveAttribute('aria-pressed', 'true')
        expect(screen.getByRole('button', { name: 'Canvas · Main layout' })).toHaveAttribute('data-frame-width', '768px')

        fireEvent.click(screen.getByRole('button', { name: 'Small (Mobile) breakpoint at 640px' }))
        expect(screen.getByRole('button', { name: 'Canvas · Main layout' })).toHaveAttribute('data-frame-width', '640px')
        expect(screen.getByText('Editing SM')).toBeInTheDocument()

        fireEvent.click(screen.getByRole('button', { name: 'Zoom out canvas' }))
        expect(screen.getByRole('button', { name: 'Fit canvas to available space' })).toHaveTextContent('90%')
        fireEvent.click(screen.getByRole('button', { name: 'Fit canvas to available space' }))
        expect(screen.getByRole('button', { name: 'Fit canvas to available space' })).toHaveAttribute('aria-pressed', 'true')
    })
})
