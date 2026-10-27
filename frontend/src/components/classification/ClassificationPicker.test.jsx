import React from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { vi, describe, it, expect, beforeEach } from 'vitest'
import ClassificationPicker from './ClassificationPicker'
import { taxonomyApi } from '../../api/taxonomy'

vi.mock('../../api/taxonomy', () => ({ taxonomyApi: { terms: vi.fn(), term: vi.fn(), defaultNamespace: vi.fn(), types: vi.fn(), propose: vi.fn() }, classificationError: error => error.message }))
vi.mock('../../utils/tenant', () => ({ getCurrentTenantId: () => 'tenant' }))

function renderPicker(props = {}) {
    const onChange = vi.fn()
    render(<QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
        <ClassificationPicker value={[]} onChange={onChange} use="pages" {...props} />
    </QueryClientProvider>)
    return onChange
}

beforeEach(() => {
    vi.clearAllMocks()
    taxonomyApi.defaultNamespace.mockResolvedValue({ results: [{ id: 1 }] })
    taxonomyApi.terms.mockResolvedValue({ results: [
        { id: 'approved', name: 'Energy', path: 'Climate / Energy', status: 'approved' },
        { id: 'pending', name: 'Pending', path: 'Pending', status: 'proposed' },
        { id: 'archived', name: 'Archived', path: 'Archived', status: 'archived' },
    ] })
    taxonomyApi.term.mockResolvedValue({ id: 'archived', name: 'Archived', path: 'Archived', status: 'archived' })
    taxonomyApi.types.mockResolvedValue({ results: [] })
})

describe('classification picker', () => {
    it('preserves ordered IDs and excludes inactive media choices', async () => {
        const changed = renderPicker({ value: ['archived'], use: 'media_files' })
        fireEvent.click(await screen.findByRole('button', { name: 'Climate / Energy' }))
        expect(changed).toHaveBeenCalledWith(['archived', 'approved'])
        expect(screen.queryByRole('button', { name: /pending approval/ })).toBeNull()
        expect(screen.queryByRole('button', { name: 'Archived' })).toBeNull()
        expect(await screen.findByText('Archived (archived)')).toBeTruthy()
    })
    it('allows pending terms in drafts and clearly labels them', async () => {
        const changed = renderPicker({ allowProposed: true })
        fireEvent.click(await screen.findByRole('button', { name: 'Pending (pending approval)' }))
        expect(changed).toHaveBeenCalledWith(['pending'])
    })
    it('keeps failures next to the selector', async () => {
        taxonomyApi.terms.mockRejectedValue(new Error('Could not load classifications. Retry.'))
        renderPicker()
        expect(await screen.findByRole('alert')).toHaveTextContent('Could not load classifications. Retry.')
    })
    it('requests name-ordered types for proposals even when stored order differs', async () => {
        taxonomyApi.types.mockResolvedValue({ results: [
            { id: 'alpha', name: 'Alpha', sortOrder: 20, allowedUses: ['pages'], permissions: ['propose'] },
            { id: 'zulu', name: 'Zulu', sortOrder: 1, allowedUses: ['pages'], permissions: ['propose'] },
        ] })
        renderPicker({ namespace: 'editorial' })
        fireEvent.click(screen.getByRole('button', { name: 'Suggest a tag' }))
        expect(await screen.findByRole('option', { name: 'Alpha' })).toBeInTheDocument()
        expect(taxonomyApi.types).toHaveBeenCalledWith({ namespace: 'editorial', page_size: 200, ordering: 'name' })
        expect(screen.getByRole('combobox', { name: 'Tag type' })).toHaveValue('alpha')
    })
    it('submits a media proposal without treating it as approved tagging', async () => {
        taxonomyApi.types.mockResolvedValue({ results: [{ id: 'type', name: 'Subjects', allowedUses: ['media_files'], permissions: ['use', 'propose'] }] })
        taxonomyApi.propose.mockResolvedValue({ term: { id: 'proposed' } })
        const changed = renderPicker({ use: 'media_files' })
        fireEvent.click(screen.getByRole('button', { name: 'Suggest a tag' }))
        fireEvent.change(await screen.findByLabelText('Suggested tag name'), { target: { value: 'A new subject' } })
        await waitFor(() => expect(screen.getByRole('button', { name: 'Submit proposal' })).not.toBeDisabled())
        fireEvent.click(screen.getByRole('button', { name: 'Submit proposal' }))
        await waitFor(() => expect(taxonomyApi.propose).toHaveBeenCalledWith('type', 'create', { name: 'A new subject' }))
        expect(changed).not.toHaveBeenCalled()
        expect(await screen.findByText(/does not satisfy mandatory media tagging/)).toBeTruthy()
    })
    it('searches and pages within the content scope', async () => {
        taxonomyApi.terms.mockResolvedValue({ results: [], next: 'page2' })
        renderPicker({ namespace: 'editorial' })
        fireEvent.change(screen.getByRole('searchbox'), { target: { value: 'Energy' } })
        await waitFor(() => expect(taxonomyApi.terms).toHaveBeenCalledWith(expect.objectContaining({ namespace: 'editorial', use: 'pages', search: 'Energy', page: 1 })))
        fireEvent.click(await screen.findByRole('button', { name: 'Next' }))
        await waitFor(() => expect(taxonomyApi.terms).toHaveBeenCalledWith(expect.objectContaining({ page: 2 })))
    })
    it('filters topic and keyword searches by their classification type', async () => {
        taxonomyApi.types.mockResolvedValue({ results: [
            { id: 'topic', name: 'Ämne', allowedUses: ['pages'] },
            { id: 'keyword', name: 'Nyckelord', allowedUses: ['pages'] },
        ] })
        renderPicker({ namespace: 'editorial' })
        fireEvent.click(await screen.findByRole('button', { name: 'Add filter' }))
        fireEvent.click(screen.getByRole('button', { name: 'Ämne' }))
        expect(screen.getByRole('button', { name: 'Remove type filter: Ämne' })).toBeInTheDocument()
        fireEvent.change(screen.getByRole('searchbox'), { target: { value: 'climate' } })
        await waitFor(() => expect(taxonomyApi.terms).toHaveBeenCalledWith(expect.objectContaining({
            namespace: 'editorial', classification_type: 'topic', search: 'climate', page: 1,
        })))
        fireEvent.click(screen.getByRole('button', { name: 'Add filter' }))
        fireEvent.click(screen.getByRole('button', { name: 'Nyckelord' }))
        await waitFor(() => expect(taxonomyApi.terms).toHaveBeenCalledWith(expect.objectContaining({
            namespace: 'editorial', classification_type: 'keyword', search: 'climate', page: 1,
        })))
        fireEvent.click(screen.getByRole('button', { name: 'Remove type filter: Nyckelord' }))
        await waitFor(() => expect(taxonomyApi.terms).toHaveBeenCalledWith(expect.objectContaining({
            namespace: 'editorial', classification_type: undefined, search: 'climate', page: 1,
        })))
    })
})
