import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import SpecialPagesEditor from '../SpecialPagesEditor'

const mocks = vi.hoisted(() => ({ pageContentEditor: vi.fn(), renderFrame: vi.fn() }))

vi.mock('../../../contexts/unified-data/context/UnifiedDataContext', () => ({
    useUnifiedData: () => ({ publishUpdate: vi.fn().mockResolvedValue(undefined) }),
}))

vi.mock('../../../editors/page-editor/PageContentEditor', () => ({
    default: (props) => {
        mocks.pageContentEditor(props)
        const { localWidgets, onLocalWidgetUpdate } = props
        return <div>
        <span data-testid="widget-count">{Object.values(localWidgets).flat().length}</span>
        <button type="button" onClick={() => onLocalWidgetUpdate({ main: [{ id: 'new-widget', type: 'easy_widgets.ContentWidget', config: { content: 'Hello' } }] })}>Add test widget</button>
        </div>
    },
}))

vi.mock('../../../rendering/RenderFrame', () => ({
    default: (props) => {
        mocks.renderFrame(props)
        return <div data-testid="special-page-preview">{props.title}</div>
    },
}))

vi.mock('../../WidgetEditorPanel', () => ({ default: () => null }))

const workspace = {
    layouts: {
        schema_version: 1,
        default_layout_key: 'main_layout',
        items: [{ id: 'layout-1', key: 'main_layout', label: 'Main', status: 'active' }],
        special_pages: [{ id: 'error-404', key: 'error_404', label: '404 — Page not found', kind: 'error', status_code: 404, route: '', layout_key: 'main_layout', widgets: {} }],
    },
    themeConfig: {},
}

const workspaceWithLayouts = {
    ...workspace,
    layouts: {
        ...workspace.layouts,
        items: [
            { id: 'layout-1', key: 'main_layout', label: 'Main', status: 'active', slots: { main: {}, shared: {} } },
            { id: 'layout-2', key: 'compact_layout', label: 'Compact', status: 'active', slots: { shared: {}, compact: {} } },
        ],
        special_pages: [{
            ...workspace.layouts.special_pages[0],
            widgets: {
                main: [{ id: 'main-widget', type: 'easy_widgets.ContentWidget', config: {} }],
                shared: [{ id: 'shared-widget', type: 'easy_widgets.ContentWidget', config: {} }],
            },
        }],
    },
}

describe('SpecialPagesEditor', () => {
    it('previews the current unsaved layouts, palette, and fonts with theme styling enabled', () => {
        const current = structuredClone(workspace)
        current.themeConfig = { colors: { brand: '#000000' }, fonts: { googleFonts: [] }, layouts: { items: [] } }
        current.colors = [{ name: 'brand', value: '#123456' }]
        current.fonts = [{ family: 'Inter', variants: ['400'], display: 'swap' }]
        const updateWorkspace = vi.fn()

        render(<SpecialPagesEditor workspace={current} updateWorkspace={updateWorkspace} disabled={false} />)

        const props = mocks.pageContentEditor.mock.calls.at(-1)[0]
        expect(props.applyPageTheme).toBeUndefined()
        expect(props.pageVersionData.effectiveTheme).toMatchObject({
            colors: { brand: '#123456' },
            fonts: { googleFonts: [{ family: 'Inter', variants: ['400'], display: 'swap' }] },
            layouts: current.layouts,
        })
    })

    it('opens a responsive render preview using the current unsaved special-page widgets', () => {
        const current = structuredClone(workspaceWithLayouts)
        render(<SpecialPagesEditor workspace={current} updateWorkspace={vi.fn()} disabled={false} />)

        fireEvent.click(screen.getByRole('button', { name: 'Preview' }))

        expect(screen.getByTestId('special-page-preview')).toHaveTextContent('404 — Page not found preview')
        expect(mocks.renderFrame.mock.calls.at(-1)[0].model).toMatchObject({
            layout: 'main_layout',
            layoutDefinitionRequired: true,
            slots: {
                main: [expect.objectContaining({ id: 'main-widget' })],
                shared: [expect.objectContaining({ id: 'shared-widget' })],
            },
            context: { preview: true, mode: 'preview', specialPageKey: 'error_404', statusCode: 404 },
        })
        expect(screen.getByRole('button', { name: 'Preview at desktop width' })).toHaveAttribute('aria-pressed', 'true')
    })

    it('stores visually edited widget content inside layouts.special_pages', () => {
        let current = structuredClone(workspace)
        const updateWorkspace = vi.fn((updater) => { current = updater(current) })
        render(<SpecialPagesEditor workspace={current} updateWorkspace={updateWorkspace} disabled={false} />)

        fireEvent.click(screen.getByRole('button', { name: 'Add test widget' }))

        expect(current.layouts.special_pages[0].widgets.main[0]).toMatchObject({
            type: 'easy_widgets.ContentWidget',
            config: { content: 'Hello' },
        })
    })

    it('creates removable route pages while keeping error pages fixed', () => {
        let current = structuredClone(workspace)
        const updateWorkspace = vi.fn((updater) => { current = updater(current) })
        const { rerender } = render(<SpecialPagesEditor workspace={current} updateWorkspace={updateWorkspace} disabled={false} />)

        expect(screen.queryByRole('button', { name: /remove/i })).not.toBeInTheDocument()
        fireEvent.click(screen.getByRole('button', { name: /new special page/i }))
        rerender(<SpecialPagesEditor workspace={current} updateWorkspace={updateWorkspace} disabled={false} />)

        expect(current.layouts.special_pages.at(-1)).toMatchObject({ kind: 'route', route: 'special-page', widgets: {} })
        expect(screen.getByRole('button', { name: /remove/i })).toBeInTheDocument()
    })

    it('preserves widgets in compatible slots when changing layouts', () => {
        let current = structuredClone(workspaceWithLayouts)
        const updateWorkspace = vi.fn((updater) => { current = updater(current) })
        vi.spyOn(window, 'confirm').mockReturnValue(true)
        render(<SpecialPagesEditor workspace={current} updateWorkspace={updateWorkspace} disabled={false} />)

        fireEvent.change(screen.getByLabelText('Layout'), { target: { value: 'compact_layout' } })

        expect(current.layouts.special_pages[0]).toMatchObject({
            layout_key: 'compact_layout',
            widgets: { shared: [{ id: 'shared-widget' }] },
        })
        expect(current.layouts.special_pages[0].widgets).not.toHaveProperty('main')
        expect(window.confirm).toHaveBeenCalledOnce()
        vi.restoreAllMocks()
    })

    it('keeps the current layout and widgets when destructive layout change is cancelled', () => {
        let current = structuredClone(workspaceWithLayouts)
        const updateWorkspace = vi.fn((updater) => { current = updater(current) })
        vi.spyOn(window, 'confirm').mockReturnValue(false)
        render(<SpecialPagesEditor workspace={current} updateWorkspace={updateWorkspace} disabled={false} />)

        fireEvent.change(screen.getByLabelText('Layout'), { target: { value: 'compact_layout' } })

        expect(current.layouts.special_pages[0]).toMatchObject({
            layout_key: 'main_layout',
            widgets: {
                main: [{ id: 'main-widget' }],
                shared: [{ id: 'shared-widget' }],
            },
        })
        vi.restoreAllMocks()
    })

    it('treats widgets rejected by the target slot policy as destructive changes', () => {
        let current = structuredClone(workspaceWithLayouts)
        current.layouts.items[1].slots.shared.allowed_widget_types = ['easy_widgets.HeadlineWidget']
        const updateWorkspace = vi.fn((updater) => { current = updater(current) })
        vi.spyOn(window, 'confirm').mockReturnValue(true)
        render(<SpecialPagesEditor workspace={current} updateWorkspace={updateWorkspace} disabled={false} />)

        fireEvent.change(screen.getByLabelText('Layout'), { target: { value: 'compact_layout' } })

        expect(window.confirm).toHaveBeenCalledWith(expect.stringContaining('remove 2 widgets'))
        expect(current.layouts.special_pages[0]).toMatchObject({ layout_key: 'compact_layout', widgets: {} })
        vi.restoreAllMocks()
    })

    it('preserves widgets accepted by a target slot wildcard policy', () => {
        let current = structuredClone(workspaceWithLayouts)
        current.layouts.items[1].slots.shared.allowed_widget_types = ['easy_widgets.*']
        const updateWorkspace = vi.fn((updater) => { current = updater(current) })
        vi.spyOn(window, 'confirm').mockReturnValue(true)
        render(<SpecialPagesEditor workspace={current} updateWorkspace={updateWorkspace} disabled={false} />)

        fireEvent.change(screen.getByLabelText('Layout'), { target: { value: 'compact_layout' } })

        expect(current.layouts.special_pages[0].widgets).toEqual({
            shared: [expect.objectContaining({ id: 'shared-widget' })],
        })
        vi.restoreAllMocks()
    })
})
