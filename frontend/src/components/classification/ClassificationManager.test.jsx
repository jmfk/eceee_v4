import React from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { vi, describe, it, expect, beforeEach } from 'vitest'
import ClassificationManager from './ClassificationManager'
import { taxonomyApi } from '../../api/taxonomy'

vi.mock('../../api/taxonomy', () => ({ taxonomyApi: {
    types: vi.fn(), legacyTypes: vi.fn(), terms: vi.fn(), proposals: vi.fn(), history: vi.fn(), usage: vi.fn(), grants: vi.fn(), members: vi.fn(),
    namespaces: vi.fn(), objectTypes: vi.fn(), createType: vi.fn(), configure: vi.fn(), create: vi.fn(), propose: vi.fn(), change: vi.fn(), changeType: vi.fn(), undo: vi.fn(), decide: vi.fn(),
}, classificationError: error => error.message }))
vi.mock('../../utils/tenant', () => ({ getCurrentTenantId: () => 'tenant' }))

const definition = { id: 'type', name: 'Topics', permissions: ['use', 'propose', 'create', 'edit', 'restore', 'approve'] }
function renderManager(props = {}) {
    render(<QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}><ClassificationManager {...props} /></QueryClientProvider>)
}
async function chooseType() {
    fireEvent.click(await screen.findByRole('button', { name: 'Add filter' }))
    fireEvent.click(screen.getByRole('combobox', { name: 'Tag type' }))
    fireEvent.click(await screen.findByRole('option', { name: 'Topics' }))
    fireEvent.click(await screen.findByRole('button', { name: 'New tag' }))
}
beforeEach(() => {
    vi.clearAllMocks()
    taxonomyApi.types.mockResolvedValue({ results: [definition] })
    taxonomyApi.legacyTypes.mockResolvedValue(['general', 'topic'])
    taxonomyApi.terms.mockResolvedValue({ results: [] })
    taxonomyApi.usage.mockResolvedValue({ pages: { count: 0, results: [] } })
    taxonomyApi.create.mockResolvedValue({ operation: { id: 'operation' } })
    taxonomyApi.propose.mockResolvedValue({ id: 'proposal' })
    taxonomyApi.proposals.mockResolvedValue({ count: 0, results: [] })
    taxonomyApi.namespaces.mockResolvedValue({ results: [] })
    taxonomyApi.objectTypes.mockResolvedValue({ results: [] })
})

describe('classification management', () => {
    it('adds a removable filter pill without opening the editor, and dismisses the chooser with Escape', async () => {
        renderManager()
        const addFilter = await screen.findByRole('button', { name: 'Add filter' })
        fireEvent.click(addFilter)
        expect(screen.getByRole('dialog', { name: 'Add tag filter' })).toBeInTheDocument()
        fireEvent.keyDown(screen.getByLabelText('Tag type'), { key: 'Escape' })
        expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
        expect(addFilter).toHaveFocus()
        fireEvent.click(addFilter)
        fireEvent.click(screen.getByRole('combobox', { name: 'Tag type' }))
    fireEvent.click(await screen.findByRole('option', { name: 'Topics' }))
        expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
        expect(screen.queryByLabelText('Name')).not.toBeInTheDocument()
        await waitFor(() => expect(taxonomyApi.terms).toHaveBeenCalledWith(expect.objectContaining({ classification_type: 'type' })))
        fireEvent.click(screen.getByRole('button', { name: 'Remove type filter: Topics' }))
        await waitFor(() => expect(taxonomyApi.terms).toHaveBeenLastCalledWith(expect.objectContaining({ classification_type: '' })))
    })

    it('opens with all tags, alphabetical ordering and a search before choosing a type', async () => {
        taxonomyApi.terms.mockResolvedValue({ count: 1, results: [{ id: 'energy', name: 'Energy', classificationType: 'type', parent: null, status: 'approved' }] })
        renderManager()
        expect(await screen.findByRole('button', { name: 'Energy' })).toBeInTheDocument()
        expect(screen.queryByLabelText('Tag type')).not.toBeInTheDocument()
        expect(screen.getByRole('button', { name: 'Add filter' })).toHaveAttribute('aria-expanded', 'false')
        expect(taxonomyApi.terms).toHaveBeenCalledWith(expect.objectContaining({ classification_type: '', page_size: 50, ordering: 'name' }))
        fireEvent.change(screen.getByRole('searchbox', { name: 'Search tags' }), { target: { value: 'Energy' } })
        await waitFor(() => expect(taxonomyApi.terms).toHaveBeenCalledWith(expect.objectContaining({ search: 'Energy', page: 1 })))
        fireEvent.click(await screen.findByRole('button', { name: 'Energy' }))
        expect(await screen.findByRole('heading', { name: 'Energy' })).toBeInTheDocument()
        expect(screen.getByRole('button', { name: 'Remove type filter: Topics' })).toBeInTheDocument()
    })

    it('loads migrated tags and proposals within the media namespace', async () => {
        taxonomyApi.terms.mockResolvedValue({ results: [{ id: 'source', name: 'Reuters', parent: null, status: 'approved' }] })
        renderManager({ namespace: 'editorial' })
        await chooseType()
        expect(await screen.findByRole('button', { name: 'Reuters' })).toBeInTheDocument()
        expect(taxonomyApi.types).toHaveBeenCalledWith({ namespace: 'editorial', page: 1, page_size: 200 })
        expect(taxonomyApi.terms).toHaveBeenCalledWith(expect.objectContaining({ namespace: 'editorial', classification_type: 'type' }))
        fireEvent.click(screen.getByRole('button', { name: 'Proposals' }))
        await waitFor(() => expect(taxonomyApi.proposals).toHaveBeenCalledWith({ namespace: 'editorial', page: 1 }))
    })

    it('offers a first step when there are no tag types', async () => {
        taxonomyApi.types.mockResolvedValue({ count: 0, results: [] })
        renderManager()
        fireEvent.click(await screen.findByRole('button', { name: 'Add tag type' }))
        expect(screen.getByRole('heading', { name: 'New tag type' })).toBeInTheDocument()
        expect(screen.getByRole('button', { name: 'Types' })).toHaveAttribute('aria-pressed', 'true')
        expect(screen.queryByLabelText('Tag type')).not.toBeInTheDocument()
    })
    it('lists searchable types and opens a read-only detail before editing', async () => {
        const type = { ...definition, key: 'topics', namespace: 4, description: 'Editorial subjects', allowedUses: ['pages'], revision: 1, permissions: ['administer'] }
        taxonomyApi.types.mockResolvedValue({ results: [type, { id: 'other', name: 'Media', key: 'media', namespace: 4, allowedUses: [], permissions: [] }] })
        taxonomyApi.namespaces.mockResolvedValue({ results: [{ id: 4, name: 'Editorial' }] })
        taxonomyApi.configure.mockResolvedValue({ ...type, description: 'Updated subjects' })
        renderManager()
        fireEvent.click(screen.getByRole('button', { name: 'Types' }))
        expect(await screen.findByRole('heading', { name: 'Topics' })).toBeInTheDocument()
        expect(screen.getByText('Editorial subjects')).toBeInTheDocument()
        expect(screen.getByText('Editorial')).toBeInTheDocument()
        expect(screen.queryByLabelText('Name')).not.toBeInTheDocument()
        fireEvent.change(screen.getByRole('searchbox', { name: 'Search types' }), { target: { value: 'Media' } })
        expect(screen.queryByRole('button', { name: 'Topics' })).not.toBeInTheDocument()
        expect(screen.getByRole('button', { name: 'Media' })).toBeInTheDocument()
        fireEvent.change(screen.getByRole('searchbox', { name: 'Search types' }), { target: { value: '' } })
        fireEvent.click(screen.getByRole('button', { name: 'Edit' }))
        fireEvent.change(screen.getByLabelText('Description'), { target: { value: 'Unsaved' } })
        fireEvent.click(screen.getByRole('button', { name: 'Cancel' }))
        expect(screen.getByText('Editorial subjects')).toBeInTheDocument()
        expect(taxonomyApi.configure).not.toHaveBeenCalled()
        fireEvent.click(screen.getByRole('button', { name: 'Edit' }))
        fireEvent.change(screen.getByLabelText('Description'), { target: { value: 'Updated subjects' } })
        fireEvent.click(screen.getByRole('button', { name: 'Apply' }))
        await waitFor(() => expect(taxonomyApi.configure).toHaveBeenCalledWith(type, {
            name: 'Topics', description: 'Updated subjects', allowed_uses: ['pages'],
        }))
    })
    it('loads every page of types into the searchable list', async () => {
        taxonomyApi.types.mockResolvedValueOnce({ results: [definition], next: '/api/v1/taxonomy/types/?page=2' })
            .mockResolvedValueOnce({ results: [{ id: 'second', name: 'Sources', key: 'sources', permissions: [] }], next: null })
        renderManager()
        fireEvent.click(screen.getByRole('button', { name: 'Types' }))
        expect(await screen.findByRole('button', { name: 'Sources' })).toBeInTheDocument()
        expect(taxonomyApi.types).toHaveBeenCalledWith({ page: 2, page_size: 200 })
    })
    it('clones type settings into a new form but rejects the same name in its namespace', async () => {
        const type = { ...definition, key: 'topics', namespace: 4, description: 'Editorial subjects', allowedUses: ['pages'], revision: 1, permissions: ['administer'] }
        taxonomyApi.types.mockResolvedValue({ results: [type] })
        taxonomyApi.namespaces.mockResolvedValue({ results: [{ id: 4, name: 'Editorial' }] })
        taxonomyApi.createType.mockResolvedValue({ ...type, id: 'clone', key: 'new-topics', name: 'New topics' })
        renderManager()
        fireEvent.click(screen.getByRole('button', { name: 'Types' }))
        fireEvent.click(await screen.findByRole('button', { name: 'Clone' }))
        expect(screen.getByRole('heading', { name: 'Clone tag type' })).toBeInTheDocument()
        expect(screen.getByLabelText('Name')).toHaveValue('Topics')
        expect(screen.getByLabelText('Stable key')).toHaveValue('')
        expect(screen.getByLabelText('Description')).toHaveValue('Editorial subjects')
        fireEvent.change(screen.getByLabelText('Stable key'), { target: { value: 'new-topics' } })
        fireEvent.click(screen.getByRole('button', { name: 'Apply' }))
        expect(await screen.findByRole('alert')).toHaveTextContent('already exists')
        expect(taxonomyApi.createType).not.toHaveBeenCalled()
        fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'New topics' } })
        fireEvent.click(screen.getByRole('button', { name: 'Apply' }))
        await waitFor(() => expect(taxonomyApi.createType).toHaveBeenCalledWith({
            name: 'New topics', key: 'new-topics', namespace: 4, description: 'Editorial subjects', allowed_uses: ['pages'],
        }))
        fireEvent.click(screen.getByRole('button', { name: 'New type' }))
        expect(screen.getByRole('heading', { name: 'New tag type' })).toBeInTheDocument()
        expect(screen.getByLabelText('Name')).toHaveValue('')
        fireEvent.click(screen.getByRole('button', { name: 'Cancel' }))
        expect(screen.queryByLabelText('Name')).not.toBeInTheDocument()
    })
    it('shows existing tags when migration has not created types', async () => {
        taxonomyApi.types.mockResolvedValue({ count: 0, results: [] })
        taxonomyApi.terms.mockResolvedValue({ count: 1, results: [{ id: 'existing', name: 'Energy' }] })
        renderManager()
        expect(await screen.findByRole('heading', { name: 'Existing tags' })).toBeInTheDocument()
        expect(screen.getByText('Energy')).toBeInTheDocument()
        expect(screen.getByText(/Tag setup is incomplete/)).toBeInTheDocument()
        expect(screen.queryByRole('button', { name: 'Add tag type' })).not.toBeInTheDocument()
        expect(screen.queryByRole('button', { name: 'Apply' })).not.toBeInTheDocument()
    })
    it('searches and filters legacy tags together across pages, keeping controls on no matches', async () => {
        taxonomyApi.types.mockResolvedValue({ results: [] })
        taxonomyApi.terms.mockImplementation(async ({ search, tag_type: tagType }) => {
            if (search === 'missing') return { count: 0, results: [] }
            return { count: 51, next: '/next', results: [{ id: 'energy', name: 'Energy', tagType: tagType || 'general' }] }
        })
        renderManager({ namespace: 'editorial' })
        expect(await screen.findByText('Energy')).toBeInTheDocument()
        fireEvent.click(screen.getByRole('button', { name: 'Next tags' }))
        await waitFor(() => expect(taxonomyApi.terms).toHaveBeenLastCalledWith(expect.objectContaining({ page: 2 })))
        fireEvent.change(screen.getByRole('searchbox', { name: 'Search tags' }), { target: { value: 'energy' } })
        await waitFor(() => expect(taxonomyApi.terms).toHaveBeenLastCalledWith(expect.objectContaining({ search: 'energy', page: 1 })))
        fireEvent.click(screen.getByRole('button', { name: 'Add filter' }))
        fireEvent.click(screen.getByRole('combobox', { name: 'Tag type' }))
        fireEvent.click(await screen.findByRole('option', { name: 'topic' }))
        await waitFor(() => expect(taxonomyApi.terms).toHaveBeenLastCalledWith(expect.objectContaining({ namespace: 'editorial', search: 'energy', tag_type: 'topic', page: 1 })))
        expect(taxonomyApi.legacyTypes).toHaveBeenCalledWith({ namespace: 'editorial' })
        expect(screen.getByRole('button', { name: 'Add filter' })).toHaveFocus()
        fireEvent.change(screen.getByRole('searchbox', { name: 'Search tags' }), { target: { value: 'missing' } })
        expect(await screen.findByText('No matching tags.')).toBeInTheDocument()
        expect(screen.queryByRole('button', { name: 'Add tag type' })).not.toBeInTheDocument()
        fireEvent.click(screen.getByRole('button', { name: 'Remove type filter: topic' }))
        await waitFor(() => expect(taxonomyApi.terms).toHaveBeenLastCalledWith(expect.objectContaining({ search: 'missing', tag_type: '', page: 1 })))
        fireEvent.change(screen.getByRole('searchbox', { name: 'Search tags' }), { target: { value: '' } })
        expect(await screen.findByText('Energy')).toBeInTheDocument()
    })
    it('reports a failed existing-tag check instead of claiming no tags exist', async () => {
        taxonomyApi.types.mockResolvedValue({ count: 0, results: [] })
        taxonomyApi.terms.mockRejectedValue(new Error('Could not load existing tags. Retry.'))
        renderManager()
        expect(await screen.findByRole('alert')).toHaveTextContent('Could not load existing tags. Retry.')
        expect(screen.queryByRole('button', { name: 'Add tag type' })).not.toBeInTheDocument()
    })
    it('keeps an empty proposals view free of irrelevant controls', async () => {
        renderManager()
        fireEvent.click(screen.getByRole('button', { name: 'Proposals' }))
        expect(await screen.findByText('No tag proposals to review.')).toBeInTheDocument()
        expect(screen.getByRole('button', { name: 'Proposals' })).toHaveAttribute('aria-pressed', 'true')
        expect(screen.queryByLabelText('Tag type')).not.toBeInTheDocument()
        expect(screen.queryByLabelText('Decision reason')).not.toBeInTheDocument()
    })
    it('creates an approved term for an authorized user and offers undo', async () => {
        renderManager()
        await chooseType()
        fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'Energy' } })
        fireEvent.click(screen.getByRole('button', { name: 'Apply' }))
        await waitFor(() => expect(taxonomyApi.create).toHaveBeenCalledWith('type', { name: 'Energy', description: '', alternative_names: [] }))
        expect(await screen.findByRole('button', { name: 'Undo' })).toBeTruthy()
    })
    it('shows the tag type when creating and saves under the chosen type', async () => {
        const user = userEvent.setup()
        taxonomyApi.types.mockResolvedValue({ results: [definition, { id: 'sources', name: 'Sources', permissions: ['create'] }] })
        renderManager()
        await chooseType()
        await user.click(screen.getByRole('combobox', { name: 'Tag type' }))
        await user.click(await screen.findByRole('option', { name: 'Sources' }))
        fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'Reuters' } })
        fireEvent.click(screen.getByRole('button', { name: 'Apply' }))
        await waitFor(() => expect(taxonomyApi.create).toHaveBeenCalledWith('sources', {
            name: 'Reuters', description: '', alternative_names: [],
        }))
    })
    it('submits a proposal when the user has no creation right', async () => {
        taxonomyApi.types.mockResolvedValue({ results: [{ ...definition, permissions: ['use', 'propose'] }] })
        renderManager()
        await chooseType()
        fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'Energy' } })
        fireEvent.click(screen.getByRole('button', { name: 'Submit proposal' }))
        await waitFor(() => expect(taxonomyApi.propose).toHaveBeenCalledWith('type', 'create', expect.objectContaining({ name: 'Energy' }), null))
        expect(taxonomyApi.create).not.toHaveBeenCalled()
    })
    it('keeps a failed undo visible with its conflict message', async () => {
        taxonomyApi.undo.mockRejectedValue(new Error('Later changes prevent undo. Reload.'))
        renderManager()
        await chooseType()
        fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'Energy' } })
        fireEvent.click(screen.getByRole('button', { name: 'Apply' }))
        fireEvent.click(await screen.findByRole('button', { name: 'Undo' }))
        expect(await screen.findByRole('alert')).toHaveTextContent('Later changes prevent undo. Reload.')
    })
    it('opens an existing tag as read-only details and edits through an action menu', async () => {
        const user = userEvent.setup()
        const term = { id: 'energy', name: 'Energy', description: 'Power sources', alternativeNames: ['Fuel'], classificationType: 'type', parent: null, status: 'approved', revision: 3 }
        taxonomyApi.terms.mockResolvedValue({ count: 1, results: [term] })
        taxonomyApi.change.mockResolvedValue({ operation: { id: 'operation' } })
        renderManager()
        fireEvent.click(await screen.findByRole('button', { name: /Energy/ }))
        expect(await screen.findByRole('heading', { name: 'Energy' })).toBeInTheDocument()
        expect(screen.getByText('Power sources')).toBeInTheDocument()
        expect(screen.getByText('Fuel')).toBeInTheDocument()
        expect(screen.queryByLabelText('Name')).not.toBeInTheDocument()
        expect(screen.queryByRole('button', { name: 'Apply' })).not.toBeInTheDocument()

        await user.click(screen.getByRole('button', { name: 'Actions' }))
        await user.click(await screen.findByRole('menuitem', { name: 'Edit' }))
        expect(screen.getByRole('form', { name: 'Edit tag' })).toBeInTheDocument()
        fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'Clean energy' } })
        fireEvent.click(screen.getByRole('button', { name: 'Cancel' }))
        expect(screen.queryByLabelText('Name')).not.toBeInTheDocument()
        expect(taxonomyApi.change).not.toHaveBeenCalled()

        await user.click(screen.getByRole('button', { name: 'Actions' }))
        await user.click(await screen.findByRole('menuitem', { name: 'Edit' }))
        expect(screen.getByLabelText('Name')).toHaveValue('Energy')
        fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'Clean energy' } })
        fireEvent.click(screen.getByRole('button', { name: 'Apply' }))
        await waitFor(() => expect(taxonomyApi.change).toHaveBeenCalledWith(term, 'edit', {
            name: 'Clean energy', description: 'Power sources', alternative_names: ['Fuel'],
        }))
    })
    it('shows the type in the location and changes it from Edit when the destination is eligible', async () => {
        const user = userEvent.setup()
        const source = { ...definition, namespace: 4 }
        const destinationType = { id: 'destination', name: 'Subjects', namespace: 4, permissions: ['create'] }
        taxonomyApi.types.mockResolvedValue({ results: [source, destinationType, { id: 'foreign', name: 'Foreign', namespace: 5, permissions: ['create'] }] })
        const term = { id: 'energy', name: 'Energy', classificationType: 'type', namespace: 4, path: 'Topics / Energy', parent: null, status: 'approved', revision: 3 }
        taxonomyApi.terms.mockResolvedValue({ count: 1, results: [term] })
        taxonomyApi.changeType.mockResolvedValue({ id: 'operation' })
        renderManager()
        fireEvent.click(await screen.findByRole('button', { name: 'Energy' }))
        expect(screen.getByText('Topics / Energy')).toBeInTheDocument()
        await user.click(screen.getByRole('button', { name: 'Actions' }))
        await user.click(await screen.findByRole('menuitem', { name: 'Edit' }))
        await user.click(screen.getByRole('combobox', { name: 'Tag type' }))
        expect(screen.queryByRole('option', { name: 'Foreign' })).not.toBeInTheDocument()
        await user.click(await screen.findByRole('option', { name: 'Subjects' }))
        expect(screen.getByText(/Changing type makes this tag a root tag/)).toBeInTheDocument()
        fireEvent.click(screen.getByRole('button', { name: 'Apply' }))
        await waitFor(() => expect(taxonomyApi.changeType).toHaveBeenCalledWith(term, 'destination', {
            name: 'Energy', description: '', alternative_names: [],
        }))
        expect(taxonomyApi.change).not.toHaveBeenCalled()
        expect(screen.queryByRole('button', { name: 'Undo' })).not.toBeInTheDocument()
    })
    it('shows only reactivation for an archived tag and waits for Apply', async () => {
        const user = userEvent.setup()
        const term = { id: 'old', name: 'Old tag', classificationType: 'type', parent: null, status: 'archived', revision: 2 }
        taxonomyApi.terms.mockResolvedValue({ count: 1, results: [term] })
        taxonomyApi.change.mockResolvedValue({ operation: { id: 'operation' } })
        renderManager()
        fireEvent.click(await screen.findByRole('button', { name: /Old tag/ }))
        await user.click(screen.getByRole('button', { name: 'Actions' }))
        expect(screen.queryByRole('menuitem', { name: 'Edit' })).not.toBeInTheDocument()
        await user.click(await screen.findByRole('menuitem', { name: 'Reactivate' }))
        expect(screen.getByRole('form', { name: 'Reactivate tag' })).toBeInTheDocument()
        expect(taxonomyApi.change).not.toHaveBeenCalled()
        fireEvent.click(screen.getByRole('button', { name: 'Apply' }))
        await waitFor(() => expect(taxonomyApi.change).toHaveBeenCalledWith(term, 'reactivate', {}))
    })
})
