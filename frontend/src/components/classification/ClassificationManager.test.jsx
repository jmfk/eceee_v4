import React from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { vi, describe, it, expect, beforeEach } from 'vitest'
import ClassificationManager from './ClassificationManager'
import { taxonomyApi } from '../../api/taxonomy'

vi.mock('../../api/taxonomy', () => ({ taxonomyApi: {
    types: vi.fn(), terms: vi.fn(), proposals: vi.fn(), history: vi.fn(), usage: vi.fn(), grants: vi.fn(), members: vi.fn(),
    create: vi.fn(), propose: vi.fn(), change: vi.fn(), undo: vi.fn(), decide: vi.fn(),
}, classificationError: error => error.message }))
vi.mock('../../utils/tenant', () => ({ getCurrentTenantId: () => 'tenant' }))

const definition = { id: 'type', name: 'Topics', permissions: ['use', 'propose', 'create', 'edit', 'restore', 'approve'] }
function renderManager() {
    render(<QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}><ClassificationManager /></QueryClientProvider>)
}
async function chooseType() {
    await screen.findByRole('option', { name: 'Topics' })
    fireEvent.change(screen.getByLabelText('Classification type'), { target: { value: 'type' } })
}
beforeEach(() => {
    vi.clearAllMocks()
    taxonomyApi.types.mockResolvedValue({ results: [definition] })
    taxonomyApi.terms.mockResolvedValue({ results: [] })
    taxonomyApi.usage.mockResolvedValue({ pages: { count: 0, results: [] } })
    taxonomyApi.create.mockResolvedValue({ operation: { id: 'operation' } })
    taxonomyApi.propose.mockResolvedValue({ id: 'proposal' })
    taxonomyApi.proposals.mockResolvedValue({ results: [] })
})

describe('classification management', () => {
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
