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
vi.mock('../../components/StatusBar', () => ({ default: () => null }))
vi.mock('../../components/common/Breadcrumbs', () => ({ default: () => null }))
vi.mock('../../components/help/ContextualHelpLink', () => ({ default: () => null }))
vi.mock('../../components/wysiwyg/GlobalWysiwygToolbar', () => ({ default: () => null }))
vi.mock('../../components/objectEdit/ObjectSettingsView', () => ({ default: () => null }))
vi.mock('../../components/objectEdit/ObjectPublishingView', () => ({ default: () => null }))
vi.mock('../../components/objectEdit/ObjectSubObjectsView', () => ({ default: () => null }))

const object = { id: 1, title: 'Root', versionId: 9, editRevision: 1, objectType: { id: 3 }, data: {}, widgets: {} }
const state = { objects: { '1': { ...object, currentVersionId: '9', parentId: null } }, metadata: { isDirty: true } }
const renderEditor = () => render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
        <MemoryRouter initialEntries={['/objects/1/edit/content']}>
            <Routes><Route path="/objects/:instanceId/edit/:tab" element={<ObjectInstanceEditPage />} /></Routes>
        </MemoryRouter>
    </QueryClientProvider>
)

beforeEach(() => {
    vi.clearAllMocks()
    mocks.widgetEditorOpen = false
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

    it('keeps the current object open when saving fails', async () => {
        mocks.saveWorkingCopy.mockRejectedValue(new Error('Save rejected'))
        renderEditor()
        fireEvent.click(await screen.findByRole('button', { name: 'Open child' }))
        await waitFor(() => expect(mocks.notify).toHaveBeenCalledWith('Save rejected', 'error'))
        expect(mocks.navigate).not.toHaveBeenCalled()
        expect(screen.getByText('Content editor')).toBeInTheDocument()
    })
})
