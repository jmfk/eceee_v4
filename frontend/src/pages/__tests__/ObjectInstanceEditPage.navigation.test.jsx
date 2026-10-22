import React from 'react'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import ObjectInstanceEditPage from '../ObjectInstanceEditPage'

const mocks = vi.hoisted(() => ({
    navigate: vi.fn(), get: vi.fn(), getType: vi.fn(), getPathToRoot: vi.fn(), saveWorkingCopy: vi.fn(),
    getState: vi.fn(), publishUpdate: vi.fn(), setIsDirty: vi.fn(), notify: vi.fn(),
    widgetEditorOpen: false,
}))
vi.mock('react-router-dom', async () => ({ ...await vi.importActual('react-router-dom'), useNavigate: () => mocks.navigate }))
vi.mock('../../api/objectStorage', () => ({
    objectInstancesApi: { get: mocks.get, getPathToRoot: mocks.getPathToRoot, saveWorkingCopy: mocks.saveWorkingCopy },
    objectTypesApi: { get: mocks.getType }, objectVersionsApi: {},
}))
vi.mock('../../contexts/unified-data/context/UnifiedDataContext', () => ({ useUnifiedData: () => ({
    useExternalChanges: () => {}, publishUpdate: mocks.publishUpdate, getState: mocks.getState, setIsDirty: mocks.setIsDirty,
}) }))
vi.mock('../../contexts/GlobalNotificationContext', () => ({ useGlobalNotifications: () => ({ addNotification: mocks.notify }) }))
vi.mock('../../hooks/useDocumentTitle', () => ({ useDocumentTitle: () => {} }))
vi.mock('../../components/objectEdit/ObjectContentView', async () => {
    const React = await vi.importActual('react')
    return { default: React.forwardRef((props, ref) => {
        React.useImperativeHandle(ref, () => ({ hasOpenWidgetEditor: () => mocks.widgetEditorOpen }))
        return <div>Content editor</div>
    }) }
})
vi.mock('../../components/objectEdit/ObjectNavigation', () => ({ default: ({ onSelect, disabled }) => (
    <button disabled={disabled} onClick={() => onSelect(2, 1)}>Open child</button>
) }))
vi.mock('../../components/StatusBar', () => ({ default: ({ onSaveClick, onHistoryClick, onScheduleClick }) => <>
    <button onClick={onSaveClick}>Save working copy</button>
    <button onClick={onHistoryClick}>History</button>
    <button onClick={onScheduleClick}>Schedule</button>
</> }))
vi.mock('../../components/common/Breadcrumbs', () => ({ default: () => null }))
vi.mock('../../components/help/ContextualHelpLink', () => ({ default: () => null }))
vi.mock('../../components/wysiwyg/GlobalWysiwygToolbar', () => ({ default: () => null }))
vi.mock('../../components/objectEdit/ObjectSettingsView', () => ({ default: () => null }))
vi.mock('../../components/objectEdit/ObjectPublishingView', () => ({ default: () => null }))
vi.mock('../../components/objectEdit/ObjectSubObjectsView', () => ({ default: () => null }))

const object = { id: 1, title: 'Root', versionId: 9, editRevision: 1, objectType: { id: 3 }, data: {}, widgets: {} }
let state
const renderEditor = (client = new QueryClient({ defaultOptions: { queries: { retry: false } } }), initialEntry = '/objects/1/edit/content') => render(
    <QueryClientProvider client={client}>
        <MemoryRouter initialEntries={[initialEntry]}>
            <Routes><Route path="/objects/:instanceId/edit/:tab" element={<ObjectInstanceEditPage />} /></Routes>
        </MemoryRouter>
    </QueryClientProvider>
)

beforeEach(() => {
    vi.clearAllMocks()
    mocks.widgetEditorOpen = false
    state = { objects: { '1': { ...object, currentVersionId: '9', parentId: null } }, metadata: { isDirty: true, currentObjectId: '1' } }
    mocks.setIsDirty.mockImplementation(value => { state.metadata.isDirty = value })
    mocks.get.mockResolvedValue({ data: object })
    mocks.getType.mockResolvedValue({ data: { id: 3, name: 'article', label: 'Article' } })
    mocks.getPathToRoot.mockResolvedValue({ data: [{ id: 1, title: 'Root' }] })
    mocks.getState.mockReturnValue(state)
    mocks.saveWorkingCopy.mockResolvedValue({ data: { object, version: { id: 9 } } })
})

describe('Object sidebar navigation', () => {
    it('keeps an open widget editor mounted without saving or switching objects', async () => {
        mocks.widgetEditorOpen = true
        renderEditor()
        fireEvent.click(await screen.findByRole('button', { name: 'Open child' }))
        expect(await screen.findByRole('alert')).toHaveTextContent('Save or close the widget editor')
        expect(mocks.saveWorkingCopy).not.toHaveBeenCalled()
        expect(mocks.navigate).not.toHaveBeenCalled()
        expect(screen.getByText('Content editor')).toBeInTheDocument()
    })

    it('saves current unified state before switching, even before the dirty subscription renders', async () => {
        renderEditor()
        fireEvent.click(await screen.findByRole('button', { name: 'Open child' }))
        await waitFor(() => expect(mocks.navigate).toHaveBeenCalledWith('/objects/2/edit/content?root=1'))
        expect(mocks.saveWorkingCopy).toHaveBeenCalledWith('1', state.objects['1'], { id: '9', editRevision: 1 }, object)
    })

    it('keeps edits made while post-save queries refresh before switching objects', async () => {
        const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
        let finishRefresh
        const refresh = new Promise(resolve => { finishRefresh = resolve })
        vi.spyOn(client, 'invalidateQueries').mockReturnValue(refresh)
        renderEditor(client)
        fireEvent.click(await screen.findByRole('button', { name: 'Open child' }))
        await waitFor(() => expect(mocks.setIsDirty).toHaveBeenCalledWith(false))
        state.objects['1'] = { ...state.objects['1'], title: 'Typed during refresh' }
        state.metadata.isDirty = true
        finishRefresh()
        expect(await screen.findByRole('alert')).toHaveTextContent('More changes were made while saving')
        expect(mocks.navigate).not.toHaveBeenCalled()
        expect(state.objects['1'].title).toBe('Typed during refresh')
    })

    it('keeps a widget editor opened while post-save queries refresh', async () => {
        const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
        let finishRefresh
        const refresh = new Promise(resolve => { finishRefresh = resolve })
        vi.spyOn(client, 'invalidateQueries').mockReturnValue(refresh)
        renderEditor(client)
        fireEvent.click(await screen.findByRole('button', { name: 'Open child' }))
        await waitFor(() => expect(mocks.setIsDirty).toHaveBeenCalledWith(false))
        mocks.widgetEditorOpen = true
        finishRefresh()
        expect(await screen.findByRole('alert')).toHaveTextContent('Save or close the widget editor')
        expect(mocks.navigate).not.toHaveBeenCalled()
    })

    it('does not override a tab selected while post-save queries refresh', async () => {
        const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
        let finishRefresh
        const refresh = new Promise(resolve => { finishRefresh = resolve })
        vi.spyOn(client, 'invalidateQueries').mockReturnValue(refresh)
        renderEditor(client)
        fireEvent.click(await screen.findByRole('button', { name: 'Open child' }))
        await waitFor(() => expect(mocks.setIsDirty).toHaveBeenCalledWith(false))
        fireEvent.click(screen.getByRole('link', { name: 'Settings' }))
        await waitFor(() => expect(screen.queryByText('Content editor')).not.toBeInTheDocument())
        finishRefresh()
        await waitFor(() => expect(mocks.notify).toHaveBeenCalledWith('Working copy saved', 'success'))
        expect(mocks.navigate).not.toHaveBeenCalled()
    })

    it('does not override navigation away while post-save queries refresh', async () => {
        const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
        let finishRefresh
        const refresh = new Promise(resolve => { finishRefresh = resolve })
        vi.spyOn(client, 'invalidateQueries').mockReturnValue(refresh)
        const { unmount } = renderEditor(client)
        fireEvent.click(await screen.findByRole('button', { name: 'Open child' }))
        await waitFor(() => expect(mocks.setIsDirty).toHaveBeenCalledWith(false))
        unmount()
        finishRefresh()
        await waitFor(() => expect(mocks.notify).toHaveBeenCalledWith('Working copy saved', 'success'))
        expect(mocks.navigate).not.toHaveBeenCalled()
    })

    it('refreshes the object path and clears the old root context after a parent move', async () => {
        const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
        const invalidate = vi.spyOn(client, 'invalidateQueries')
        mocks.saveWorkingCopy.mockResolvedValue({ data: { object: { ...object, parent: 4 }, version: { id: 9 } } })
        state.objects['1'].parentId = 4
        renderEditor(client, '/objects/1/edit/settings?root=1')
        fireEvent.click(await screen.findByRole('button', { name: 'Save working copy' }))
        await waitFor(() => expect(invalidate).toHaveBeenCalledWith({ queryKey: ['objectInstance', '1', 'pathToRoot'] }))
        expect(mocks.navigate).toHaveBeenCalledWith({ pathname: '/objects/1/edit/settings', search: '' }, { replace: true })
    })

    it.each([
        ['History', '/objects/1/edit/publishing?root=8&panel=history'],
        ['Schedule', '/objects/1/edit/publishing?root=8'],
    ])('preserves the root context when opening %s', async (action, path) => {
        renderEditor(undefined, '/objects/1/edit/content?root=8')
        fireEvent.click(await screen.findByRole('button', { name: action }))
        expect(mocks.navigate).toHaveBeenCalledWith(path)
    })

    it('keeps the current object open when saving fails', async () => {
        mocks.saveWorkingCopy.mockRejectedValue(new Error('Save rejected'))
        renderEditor()
        fireEvent.click(await screen.findByRole('button', { name: 'Open child' }))
        await waitFor(() => expect(mocks.notify).toHaveBeenCalledWith('Save rejected', 'error'))
        expect(mocks.navigate).not.toHaveBeenCalled()
        expect(screen.getByText('Content editor')).toBeInTheDocument()
    })
})
