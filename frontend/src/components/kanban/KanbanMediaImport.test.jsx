import React from 'react'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { beforeEach, expect, it, vi } from 'vitest'
import KanbanMediaImport from './KanbanMediaImport'
import { taxonomyApi } from '../../api/taxonomy'
import { kanbanApi } from '../../api/kanban'
vi.mock('../../contexts/AuthContext', () => ({ useAuth: () => ({ user: { id: 1, permissions: ['media.write'] } }) }))
vi.mock('../../utils/tenant', () => ({ getCurrentTenantId: () => 'tenant' }))
vi.mock('../../api/taxonomy', () => ({ taxonomyApi: { namespaces: vi.fn() }, classificationError: error => error.message }))
vi.mock('../../api/kanban', () => ({ kanbanApi: { post: vi.fn() }, kanbanError: error => error.message }))
vi.mock('../classification/ClassificationPicker', () => ({ default: ({ onChange, value, namespace }) => <div>
    <span>Tags for {namespace}: {value.join(',')}</span><button onClick={() => onChange(['approved-tag'])}>Select approved tag</button>
</div> }))
const file = { id: 'attachment', filename: 'photo.jpg', approvedAt: 'now' }
function renderImport(attachment = file) {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    const invalidate = vi.spyOn(client, 'invalidateQueries')
    render(<QueryClientProvider client={client}><KanbanMediaImport file={attachment} revision={7} /></QueryClientProvider>)
    return invalidate
}
beforeEach(() => {
    vi.clearAllMocks()
    taxonomyApi.namespaces.mockResolvedValue({ results: [{ id: 1, name: 'Main', kind: 'content' }, { id: 2, name: 'Other', kind: 'content' }] })
    kanbanApi.post.mockResolvedValue({})
})
it('imports the source attachment with its revision, destination namespace and approved tags', async () => {
    const invalidate = renderImport()
    fireEvent.click(screen.getByRole('button', { name: 'Importera till media' }))
    expect(screen.getByRole('button', { name: 'Importera kopia' })).toBeDisabled()
    fireEvent.click(screen.getByRole('combobox', { name: 'Namespace' }))
    fireEvent.click(await screen.findByRole('option', { name: 'Main' }))
    fireEvent.click(screen.getByRole('button', { name: 'Select approved tag' }))
    fireEvent.click(screen.getByRole('button', { name: 'Importera kopia' }))
    await waitFor(() => expect(kanbanApi.post).toHaveBeenCalledWith('attachments/attachment/import/', { destination: 'media', revision: 7, namespace: 1, classificationIds: ['approved-tag'] }))
    await waitFor(() => expect(invalidate).toHaveBeenCalledWith({ queryKey: ['kanban', 'tenant'] }))
})
it('resets tag selection when changing destination namespace', async () => {
    renderImport()
    fireEvent.click(screen.getByRole('button', { name: 'Importera till media' }))
    fireEvent.click(screen.getByRole('combobox', { name: 'Namespace' }))
    fireEvent.click(await screen.findByRole('option', { name: 'Main' }))
    fireEvent.click(screen.getByRole('button', { name: 'Select approved tag' }))
    fireEvent.click(screen.getByRole('combobox', { name: 'Namespace' }))
    fireEvent.click(await screen.findByRole('option', { name: 'Other' }))
    expect(screen.getByRole('button', { name: 'Importera kopia' })).toBeDisabled()
    expect(screen.getByText('Tags for 2:')).toBeInTheDocument()
})
it('does not expose import for an unapproved attachment', () => {
    renderImport({ ...file, approvedAt: null })
    expect(screen.queryByRole('button', { name: 'Importera till media' })).not.toBeInTheDocument()
})
