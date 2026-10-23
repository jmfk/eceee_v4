import React from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { vi, describe, it, expect, beforeEach } from 'vitest'
import ClassificationManager from './ClassificationManager'
import { taxonomyApi } from '../../api/taxonomy'

vi.mock('../../api/taxonomy', () => ({ taxonomyApi: {
    types: vi.fn(), terms: vi.fn(), proposals: vi.fn(), history: vi.fn(), usage: vi.fn(), grants: vi.fn(), members: vi.fn(),
    namespaces: vi.fn(), objectTypes: vi.fn(), create: vi.fn(), propose: vi.fn(), change: vi.fn(), undo: vi.fn(), decide: vi.fn(),
}, classificationError: error => error.message }))
vi.mock('../../utils/tenant', () => ({ getCurrentTenantId: () => 'tenant' }))

const definition = { id: 'type', name: 'Topics', permissions: ['use', 'propose', 'create', 'edit', 'restore', 'approve'] }
function renderManager() {
    render(<QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}><ClassificationManager /></QueryClientProvider>)
}
async function chooseType() {
    await screen.findByRole('option', { name: 'Topics' })
    fireEvent.change(screen.getByLabelText('Tag type'), { target: { value: 'type' } })
}
beforeEach(() => {
    vi.clearAllMocks()
    taxonomyApi.types.mockResolvedValue({ results: [definition] })
    taxonomyApi.terms.mockResolvedValue({ results: [] })
    taxonomyApi.usage.mockResolvedValue({ pages: { count: 0, results: [] } })
    taxonomyApi.create.mockResolvedValue({ operation: { id: 'operation' } })
    taxonomyApi.propose.mockResolvedValue({ id: 'proposal' })
    taxonomyApi.proposals.mockResolvedValue({ count: 0, results: [] })
    taxonomyApi.namespaces.mockResolvedValue({ results: [] })
    taxonomyApi.objectTypes.mockResolvedValue({ results: [] })
})

describe('classification management', () => {
    it('offers a first step when there are no tag types', async () => {
        taxonomyApi.types.mockResolvedValue({ count: 0, results: [] })
        renderManager()
        fireEvent.click(await screen.findByRole('button', { name: 'Add tag type' }))
        expect(screen.getByRole('heading', { name: 'New tag type' })).toBeInTheDocument()
        expect(screen.getByRole('button', { name: 'Types' })).toHaveAttribute('aria-pressed', 'true')
        expect(screen.queryByLabelText('Tag type')).not.toBeInTheDocument()
    })
    it('shows existing tags when migration has not created types', async () => {
        taxonomyApi.types.mockResolvedValue({ count: 0, results: [] })
        taxonomyApi.terms.mockResolvedValue({ count: 1, results: [{ id: 'existing', name: 'Energy' }] })
        renderManager()
        expect(await screen.findByRole('heading', { name: 'Existing tags' })).toBeInTheDocument()
        expect(screen.getByText('Energy')).toBeInTheDocument()
        expect(screen.getByText(/Tag setup is incomplete/)).toBeInTheDocument()
        expect(screen.queryByRole('button', { name: 'Add tag type' })).not.toBeInTheDocument()
        expect(screen.queryByRole('button', { name: 'Apply change' })).not.toBeInTheDocument()
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
        fireEvent.click(screen.getByRole('button', { name: 'Apply change' }))
        await waitFor(() => expect(taxonomyApi.create).toHaveBeenCalledWith('type', { name: 'Energy', description: '', alternative_names: [] }))
        expect(await screen.findByRole('button', { name: 'Undo' })).toBeTruthy()
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
        fireEvent.click(screen.getByRole('button', { name: 'Apply change' }))
        fireEvent.click(await screen.findByRole('button', { name: 'Undo' }))
        expect(await screen.findByRole('alert')).toHaveTextContent('Later changes prevent undo. Reload.')
    })
})
