import React from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { vi, describe, it, expect, beforeEach } from 'vitest'
import ClassificationPicker from './ClassificationPicker'
import { taxonomyApi } from '../../api/taxonomy'

vi.mock('../../api/taxonomy', () => ({ taxonomyApi: { terms: vi.fn(), term: vi.fn(), defaultNamespace: vi.fn() }, classificationError: error => error.message }))
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
    it('searches and pages within the content scope', async () => {
        taxonomyApi.terms.mockResolvedValue({ results: [], next: 'page2' })
        renderPicker({ namespace: 'editorial' })
        fireEvent.change(screen.getByRole('searchbox'), { target: { value: 'Energy' } })
        await waitFor(() => expect(taxonomyApi.terms).toHaveBeenCalledWith(expect.objectContaining({ namespace: 'editorial', use: 'pages', search: 'Energy', page: 1 })))
        fireEvent.click(await screen.findByRole('button', { name: 'Next' }))
        await waitFor(() => expect(taxonomyApi.terms).toHaveBeenCalledWith(expect.objectContaining({ page: 2 })))
    })
})
