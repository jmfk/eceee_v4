import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import SpecialPagesEditor from '../SpecialPagesEditor'

vi.mock('../../../contexts/unified-data/context/UnifiedDataContext', () => ({
    useUnifiedData: () => ({ publishUpdate: vi.fn().mockResolvedValue(undefined) }),
}))

vi.mock('../../../editors/page-editor/PageContentEditor', () => ({
    default: ({ localWidgets, onLocalWidgetUpdate }) => <div>
        <span data-testid="widget-count">{Object.values(localWidgets).flat().length}</span>
        <button type="button" onClick={() => onLocalWidgetUpdate({ main: [{ id: 'new-widget', type: 'easy_widgets.ContentWidget', config: { content: 'Hello' } }] })}>Add test widget</button>
    </div>,
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

describe('SpecialPagesEditor', () => {
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
})
