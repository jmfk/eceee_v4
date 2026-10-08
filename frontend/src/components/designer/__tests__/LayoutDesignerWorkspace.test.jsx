import { useState } from 'react'
import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import LayoutDesignerWorkspace from '../LayoutDesignerWorkspace'

const framePostMessage = vi.fn()

vi.mock('../../../rendering/RenderFrame', () => ({
    default: ({ model, onMessage, style, frameRef }) => {
        if (frameRef) frameRef.current = { contentWindow: { postMessage: framePostMessage } }
        return <button type="button" data-layout-canvas={String(model.designer.layoutCanvas)} data-empty-slots={String(Object.values(model.slots).every((items) => items.length === 0))} data-frame-width={style?.width} onClick={() => onMessage?.({ data: { source: 'eceee-designer-preview', action: 'select', targetId: `layout-node:${model.layoutDefinition.root.children[0].id}` } })}>Canvas · {model.layoutDefinition.label}</button>
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

const Harness = () => {
    const [workspace, setWorkspace] = useState({ layouts: structuredClone(document), layoutUsage: {}, breakpoints: { xs: 0, sm: 640, md: 768, lg: 1024, xl: 1280 } })
    return <LayoutDesignerWorkspace workspace={workspace} viewport="md" updateWorkspace={(updater) => setWorkspace((current) => updater(structuredClone(current)))} disabled={false} />
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

        expect(screen.getByRole('heading', { name: 'container' })).toBeInTheDocument()
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

    it('uses theme breakpoints for the canvas and provides fit and manual zoom', () => {
        render(<Harness />)

        const breakpoint = screen.getByLabelText('Theme breakpoint')
        expect(breakpoint).toHaveValue('md')
        expect(screen.getByRole('button', { name: 'Canvas · Main layout' })).toHaveAttribute('data-frame-width', '768px')

        fireEvent.change(breakpoint, { target: { value: 'sm' } })
        expect(screen.getByRole('button', { name: 'Canvas · Main layout' })).toHaveAttribute('data-frame-width', '640px')
        expect(screen.getByText('Editing SM')).toBeInTheDocument()

        fireEvent.click(screen.getByRole('button', { name: 'Zoom out canvas' }))
        expect(screen.getByRole('button', { name: 'Fit canvas to available space' })).toHaveTextContent('90%')
        fireEvent.click(screen.getByRole('button', { name: 'Fit canvas to available space' }))
        expect(screen.getByRole('button', { name: 'Fit canvas to available space' })).toHaveAttribute('aria-pressed', 'true')
    })
})
