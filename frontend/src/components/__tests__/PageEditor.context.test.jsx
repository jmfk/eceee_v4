import { describe, expect, it, vi } from 'vitest'
import { fireEvent, screen, waitFor } from '@testing-library/react'
import { Route, Routes } from 'react-router-dom'
import PageEditor from '../PageEditor'
import { useUnifiedData } from '../../contexts/unified-data'
import { OperationTypes } from '../../contexts/unified-data/types/operations'
import { createAppState, createPage, createVersion } from '../../test/unifiedDataTestUtils'
import { createTestQueryClient, renderWithStateProviders } from '../../test/testUtils'

vi.mock('../../contexts/ClipboardContext', () => ({ useClipboard: () => ({}) }))
vi.mock('../../hooks/usePageWebSocket', () => ({ usePageWebSocket: () => ({ activeEditors: [] }) }))
vi.mock('../../hooks/usePageInheritance', () => ({
    usePageInheritance: () => ({ widgets: { inherited: {}, rules: {} }, isLoading: false }),
}))
vi.mock('../PagePreview', () => ({ default: () => null }))
vi.mock('../wysiwyg/GlobalWysiwygToolbar', () => ({ default: () => null }))
vi.mock('../table-toolbar/GlobalTableToolbar', () => ({ default: () => null }))
vi.mock('../help/ContextualHelpLink', () => ({ default: () => null }))
vi.mock('../../api', () => ({
    pagesApi: {},
    versionsApi: { getPageVersionsList: vi.fn().mockResolvedValue({ results: [] }) },
    layoutsApi: {}, themesApi: {},
    namespacesApi: { getDefault: vi.fn().mockResolvedValue({ slug: 'default' }) },
}))

function AddWidgetProbe() {
    const { publishUpdate } = useUnifiedData()
    return <button onClick={async () => {
        await publishUpdate('test-widget', OperationTypes.ADD_WIDGET, {
            id: 'new-widget', slot: 'main', order: 1, type: 'easy_widgets.ContentWidget', config: {},
        })
    }}>Add page widget</button>
}

describe('PageEditor cached context', () => {
    it('reactivates a cached page after visiting an object so implicit widget edits target the page', async () => {
        const page = createPage()
        const version = createVersion()
        const queryClient = createTestQueryClient()
        queryClient.setQueryData(['webpage', page.id], page)
        queryClient.setQueryData(['pageWorkflow', page.id], { editableVersion: { id: version.id } })
        queryClient.setQueryData(['pageVersion', page.id, version.id], version)
        let state
        function StateProbe() {
            state = useUnifiedData().getState
            return <AddWidgetProbe />
        }
        renderWithStateProviders(<>
            <StateProbe />
            <Routes><Route path="/pages/:pageId/edit/:tab" element={<PageEditor />} /></Routes>
        </>, {
            queryClient,
            route: '/pages/page-1/edit/preview',
            initialState: createAppState({
                objects: { 'object-1': { id: 'object-1', widgets: { main: [] }, data: {} } },
                metadata: { currentPageId: undefined, currentVersionId: undefined, currentObjectId: 'object-1' },
            }),
        })

        await waitFor(() => {
            expect(state().metadata.currentPageId).toBe('page-1')
            expect(state().metadata.currentVersionId).toBe('version-1')
            expect(state().metadata.currentObjectId).toBeUndefined()
        })
        fireEvent.click(screen.getByRole('button', { name: 'Add page widget' }))
        await waitFor(() => expect(state().versions['version-1'].widgets.main).toHaveLength(2))
        expect(state().versions['version-1'].widgets.main[1].id).toBe('new-widget')
        expect(state().objects['object-1'].widgets.main).toEqual([])
    })
})
