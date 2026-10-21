import { act, fireEvent, screen, waitFor } from '@testing-library/react'
import { Routes, Route, useNavigate } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { renderWithStateProviders } from '../../test/testUtils'
import { createAppState } from '../../test/unifiedDataTestUtils'
import { useUnifiedData } from '../../contexts/unified-data'
import ObjectInstanceEditPage from '../ObjectInstanceEditPage'

vi.unmock('react-router-dom')

const mocks = vi.hoisted(() => ({ get: vi.fn(), getType: vi.fn(), save: vi.fn(), workflow: vi.fn(), publish: vi.fn(), state: null }))
vi.mock('../../api/objectStorage', () => ({
    objectInstancesApi: { get: mocks.get, saveWorkingCopy: mocks.save, getWorkflow: mocks.workflow, getVersions: vi.fn(async () => ({ data: [] })), getPathToRoot: vi.fn(async () => ({ data: [] })) },
    objectTypesApi: { get: mocks.getType }, objectVersionsApi: { publish: mocks.publish },
}))
vi.mock('../../api', () => ({ namespacesApi: { getDefault: vi.fn(async () => ({ slug: 'default' })) }, widgetsApi: { getTypes: vi.fn(async () => []) } }))
vi.mock('../../hooks/useWidgets', () => ({ getWidgetDisplayName: () => 'Widget' }))
vi.mock('../../hooks/useDocumentTitle', () => ({ useDocumentTitle: () => {} }))
vi.mock('../../components/ObjectContentEditor', () => ({ default: ({ widgets }) => <div data-testid="object-widgets">{JSON.stringify(widgets)}</div> }))
vi.mock('../../components/WidgetEditorPanel', () => ({ default: () => null }))
vi.mock('../../components/ParentObjectSelector', () => ({ default: () => null }))
vi.mock('../../components/common/Breadcrumbs', () => ({ default: () => null }))
vi.mock('../../components/help/ContextualHelpLink', () => ({ default: () => null }))
vi.mock('../../components/wysiwyg/GlobalWysiwygToolbar', () => ({ default: () => null }))
vi.mock('../../components/ObjectSchemaForm', () => ({ default: () => null }))
vi.mock('../../components/StatusBar', () => ({ default: ({ onSaveClick, onUndoChanges, onPublishClick, isDirty, isSaving }) => <div>
    <span data-testid="editor-dirty">{String(isDirty)}</span>
    <button onClick={onSaveClick} disabled={isSaving}>Footer save</button>
    <button onClick={onUndoChanges}>Footer undo</button>
    <button onClick={onPublishClick}>Footer publish</button>
</div> }))
const type = { id: 7, name: 'article', label: 'Article', schema: { properties: {} }, allowedChildTypes: [] }
const object = id => ({ id: Number(id), title: `Object ${id}`, objectType: type, versionId: Number(id) * 10 + 1, editRevision: 1, isWorkingCopy: true, data: {}, widgets: {}, metadata: {} })
const savedResponse = (title, revision = 2) => ({ data: { object: { ...object(1), title, editRevision: revision }, version: { id: 11, editRevision: revision } } })
function Probe() {
    const context = useUnifiedData()
    mocks.state = context.getState
    const navigate = useNavigate()
    return <>
        <button onClick={() => navigate('/objects/2/edit/content')}>Open second object</button>
        <button onClick={() => navigate('/page-test')}>Open page editor</button>
        <button onClick={() => { context.publishUpdate('page-editor', 'INIT_PAGE', { id: 'page-1', data: { id: 'page-1', title: 'Page' } }); context.setIsDirty(true) }}>Edit page</button>
        <button onClick={() => context.publishUpdate('test-widget-editor', 'UPDATE_OBJECT', { id: '1', updates: { widgets: { main: [{ id: 'draft-widget' }] } } })}>Edit widgets</button>
    </>
}
function mount(tab = 'content') {
    return renderWithStateProviders(<><Probe /><Routes><Route path="/objects/:instanceId/edit/:tab" element={<ObjectInstanceEditPage />} /><Route path="/page-test" element={<div>Page editor</div>} /></Routes></>, {
        route: `/objects/1/edit/${tab}`,
        initialState: createAppState({ pages: {}, versions: {}, objects: {}, metadata: { currentPageId: undefined, currentVersionId: undefined, currentObjectId: undefined } }),
    })
}
beforeEach(() => {
    vi.clearAllMocks()
    mocks.get.mockImplementation(async id => ({ data: object(id) }))
    mocks.getType.mockResolvedValue({ data: type })
    mocks.workflow.mockResolvedValue({ data: { state: 'liveWithUnpublishedChanges', editableVersion: { id: 11, editRevision: 1 }, liveVersion: { id: 10 } } })
    mocks.save.mockResolvedValue(savedResponse('Saved title'))
    mocks.publish.mockResolvedValue({ data: {} })
})
const titleInput = () => screen.getByPlaceholderText('Enter object title...')
const editTitle = title => fireEvent.change(titleInput(), { target: { value: title } })

describe('Object editor working-copy integration', () => {
    it('preserves unsaved content and the reviewed token when returning to Content', async () => {
        mount()
        await screen.findByDisplayValue('Object 1')
        editTitle('Unsaved title')
        fireEvent.click(screen.getByRole('link', { name: 'Publish', exact: true }))
        await screen.findByRole('heading', { name: 'Publishing' })
        fireEvent.click(screen.getByRole('link', { name: 'Content', exact: true }))
        expect(await screen.findByDisplayValue('Unsaved title')).toBeInTheDocument()
        expect(mocks.state().objects['1'].currentVersionId).toBe('11')
        expect(screen.getByTestId('editor-dirty')).toHaveTextContent('true')
        fireEvent.click(screen.getByRole('button', { name: 'Footer save' }))
        await waitFor(() => expect(mocks.save).toHaveBeenCalledWith('1', expect.objectContaining({ title: 'Unsaved title' }), { id: '11', editRevision: 1 }, expect.objectContaining({ id: 1 })))
    })

    it('preserves unsaved widgets when returning to a Content tab with slots', async () => {
        mocks.getType.mockResolvedValue({ data: { ...type, slotConfiguration: { slots: [{ name: 'main' }] } } })
        mount()
        await screen.findByDisplayValue('Object 1')
        fireEvent.click(screen.getByRole('button', { name: 'Edit widgets' }))
        await waitFor(() => expect(screen.getByTestId('object-widgets')).toHaveTextContent('draft-widget'))
        fireEvent.click(screen.getByRole('link', { name: 'Publish', exact: true }))
        await screen.findByRole('heading', { name: 'Publishing' })
        fireEvent.click(screen.getByRole('link', { name: 'Content', exact: true }))
        expect(await screen.findByTestId('object-widgets')).toHaveTextContent('draft-widget')
        expect(mocks.state().objects['1'].currentVersionId).toBe('11')
        expect(screen.getByTestId('editor-dirty')).toHaveTextContent('true')
    })

    it('keeps a featured edit and its token when opening Content from Publish', async () => {
        mount('publishing')
        fireEvent.click(await screen.findByRole('checkbox', { name: 'Featured in lists after publishing' }))
        fireEvent.click(screen.getByRole('link', { name: 'Content', exact: true }))
        await screen.findByDisplayValue('Object 1')
        expect(mocks.state().objects['1'].isFeatured).toBe(true)
        expect(mocks.state().objects['1'].currentVersionId).toBe('11')
        expect(screen.getByTestId('editor-dirty')).toHaveTextContent('true')
    })

    it('does not clear another Object’s edits when a previous save completes', async () => {
        let finish
        mocks.save.mockImplementation(() => new Promise(resolve => { finish = resolve }))
        mount()
        await screen.findByDisplayValue('Object 1')
        editTitle('Saved first object')
        fireEvent.click(screen.getByRole('button', { name: 'Footer save' }))
        await waitFor(() => expect(mocks.save).toHaveBeenCalledOnce())
        fireEvent.click(screen.getByRole('button', { name: 'Open second object' }))
        await screen.findByDisplayValue('Object 2')
        editTitle('Unsaved second object')
        await act(async () => { finish(savedResponse('Saved first object')) })
        expect(titleInput()).toHaveValue('Unsaved second object')
        expect(mocks.state().metadata.isDirty).toBe(true)
        expect(screen.getByTestId('editor-dirty')).toHaveTextContent('true')
    })

    it('does not clear Page edits after the Object editor unmounts', async () => {
        let finish
        mocks.save.mockImplementation(() => new Promise(resolve => { finish = resolve }))
        mount()
        await screen.findByDisplayValue('Object 1')
        editTitle('Saved first object')
        fireEvent.click(screen.getByRole('button', { name: 'Footer save' }))
        await waitFor(() => expect(mocks.save).toHaveBeenCalledOnce())
        fireEvent.click(screen.getByRole('button', { name: 'Open page editor' }))
        await screen.findByText('Page editor')
        fireEvent.click(screen.getByRole('button', { name: 'Edit page' }))
        expect(mocks.state().metadata.isDirty).toBe(true)
        await act(async () => { finish(savedResponse('Saved first object')) })
        expect(mocks.state().metadata.isDirty).toBe(true)
    })

    it('undoes to the successfully saved snapshot after an edit made during Save', async () => {
        let finish
        mocks.save.mockImplementation(() => new Promise(resolve => { finish = resolve }))
        mount()
        await screen.findByDisplayValue('Object 1')
        editTitle('First saved edit')
        fireEvent.click(screen.getByRole('button', { name: 'Footer save' }))
        await waitFor(() => expect(mocks.save).toHaveBeenCalledOnce())
        editTitle('Later unsaved edit')
        await act(async () => { finish(savedResponse('First saved edit')) })
        expect(titleInput()).toHaveValue('Later unsaved edit')
        fireEvent.click(screen.getByRole('button', { name: 'Footer undo' }))
        await waitFor(() => expect(titleInput()).toHaveValue('First saved edit'))
        expect(mocks.state().objects['1'].editRevision).toBe(2)
    })

    it('refreshes the visible workflow when publishing through the footer', async () => {
        mount('publishing')
        expect(await screen.findByText('Live · unpublished changes')).toBeInTheDocument()
        mocks.workflow.mockResolvedValue({ data: { state: 'live', editableVersion: null, liveVersion: { id: 11 } } })
        fireEvent.click(screen.getByRole('button', { name: 'Footer publish' }))
        await waitFor(() => expect(mocks.publish).toHaveBeenCalledOnce())
        await waitFor(() => expect(screen.queryByText('Live · unpublished changes')).not.toBeInTheDocument())
    })
})
