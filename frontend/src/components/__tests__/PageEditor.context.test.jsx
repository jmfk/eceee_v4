import { describe, expect, it, vi } from 'vitest'
import { act, fireEvent, screen, waitFor } from '@testing-library/react'
import { Route, Routes } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import PageEditor from '../PageEditor'
import { versionsApi } from '../../api'
import { useUnifiedData } from '../../contexts/unified-data'
import { OperationTypes } from '../../contexts/unified-data/types/operations'
import { createAppState, createPage, createVersion } from '../../test/unifiedDataTestUtils'
import { createTestQueryClient, renderWithStateProviders } from '../../test/testUtils'

vi.mock('../../contexts/ClipboardContext', () => ({ useClipboard: () => ({}) }))
vi.mock('../../hooks/usePageWebSocket', () => ({ usePageWebSocket: () => ({ activeEditors: [] }) }))
vi.mock('../../hooks/usePageInheritance', () => ({
    usePageInheritance: () => ({ widgets: { inherited: {}, rules: {} }, isLoading: false }),
}))
vi.mock('../PagePreview', () => ({
    default: ({ webpageData, pageVersionData }) => <div aria-label="Page preview snapshot">
        <span>{webpageData?.title}</span>
        <span>{pageVersionData?.widgets?.main?.[0]?.config?.content}</span>
    </div>,
}))
vi.mock('../wysiwyg/GlobalWysiwygToolbar', () => ({ default: () => null }))
vi.mock('../table-toolbar/GlobalTableToolbar', () => ({ default: () => null }))
vi.mock('../help/ContextualHelpLink', () => ({ default: () => null }))
vi.mock('../../utils/defaultLayout', () => ({ getDefaultLayout: vi.fn().mockResolvedValue('main_layout') }))
vi.mock('../../api', () => ({
    pagesApi: {},
    versionsApi: { getPageVersionsList: vi.fn().mockResolvedValue({ results: [] }) },
    layoutsApi: { getJson: vi.fn().mockResolvedValue({ slots: [] }) }, themesApi: {},
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
    it('reopens a cached page with the newer server revision of the same working version', async () => {
        const page = createPage()
        const cachedVersion = createVersion({ editRevision: 1 })
        const serverVersion = createVersion({
            editRevision: 2,
            updatedAt: '2026-01-02T00:00:00.000Z',
            pageData: { pageAttributes: { title: 'Latest saved title' } },
            widgets: { main: [{ id: 'widget-1', type: 'content.TextWidget', config: { content: 'Latest saved content' } }] },
        })
        const queryClient = createTestQueryClient()
        queryClient.setQueryData(['webpage', page.id], page)
        queryClient.setQueryData(['pageWorkflow', page.id], { editableVersion: { id: serverVersion.id } })
        queryClient.setQueryData(['pageVersion', page.id, serverVersion.id], serverVersion)
        versionsApi.getPageVersionsList.mockResolvedValueOnce({ results: [serverVersion] })
        let state
        function StateProbe() {
            state = useUnifiedData().getState
            return null
        }
        renderWithStateProviders(<>
            <StateProbe />
            <Routes><Route path="/pages/:pageId/edit/:tab" element={<PageEditor />} /></Routes>
        </>, {
            queryClient,
            route: '/pages/page-1/edit/preview',
            initialState: createAppState({
                versions: { [cachedVersion.id]: cachedVersion },
                metadata: { currentPageId: undefined, currentVersionId: undefined },
            }),
        })

        await waitFor(() => expect(screen.getByLabelText('Page preview snapshot')).toHaveTextContent('Latest saved content'))
        expect(screen.getByLabelText('Page preview snapshot')).toHaveTextContent('Latest saved title')
        await waitFor(() => expect(state().versions[serverVersion.id].editRevision).toBe(2))
        expect(state().metadata.isDirty).toBe(false)
    })

    it('preserves active unsaved edits and their save baseline when a newer server revision arrives', async () => {
        const page = createPage()
        const version = createVersion({ editRevision: 1 })
        const queryClient = createTestQueryClient()
        queryClient.setQueryData(['webpage', page.id], page)
        queryClient.setQueryData(['pageWorkflow', page.id], { editableVersion: { id: version.id } })
        queryClient.setQueryData(['pageVersion', page.id, version.id], version)
        versionsApi.getPageVersionsList.mockResolvedValueOnce({ results: [version] })
        let state
        function EditProbe() {
            const { getState, publishUpdate } = useUnifiedData()
            const { data: serverSnapshot } = useQuery({
                queryKey: ['pageVersion', page.id, version.id], queryFn: async () => version, enabled: false,
            })
            state = getState
            return <>
                <span>Server revision {serverSnapshot.editRevision}</span>
                <button onClick={() => publishUpdate('test-local-edit', OperationTypes.UPDATE_WIDGET_CONFIG, {
                    id: 'widget-1', slotName: 'main', pageId: page.id, versionId: version.id,
                    config: { content: 'Unsaved local content' },
                })}>Edit page content</button>
            </>
        }
        renderWithStateProviders(<>
            <EditProbe />
            <Routes><Route path="/pages/:pageId/edit/:tab" element={<PageEditor />} /></Routes>
        </>, { queryClient, route: '/pages/page-1/edit/preview', initialState: createAppState({ versions: { [version.id]: version } }) })

        await waitFor(() => expect(screen.getByLabelText('Page preview snapshot')).toHaveTextContent('Initial content'))
        fireEvent.click(screen.getByRole('button', { name: 'Edit page content' }))
        await waitFor(() => expect(state().metadata.isDirty).toBe(true))
        await act(async () => {
            queryClient.setQueryData(['pageVersion', page.id, version.id], {
                ...version, editRevision: 2,
                widgets: { main: [{ ...version.widgets.main[0], config: { content: 'New server content' } }] },
            })
        })

        await screen.findByText('Server revision 2')
        await waitFor(() => expect(screen.getByLabelText('Page preview snapshot')).toHaveTextContent('Unsaved local content'))
        expect(state().versions[version.id].editRevision).toBe(1)
        expect(state().metadata.isDirty).toBe(true)
    })

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
