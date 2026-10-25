import React from 'react'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import ClassificationTypeForm from './ClassificationTypeForm'
import { taxonomyApi } from '../../api/taxonomy'
vi.mock('../../api/taxonomy', () => ({ taxonomyApi: { namespaces: vi.fn(), objectTypes: vi.fn() } }))
beforeEach(() => {
    taxonomyApi.namespaces.mockResolvedValue({ results: [{ id: 1, slug: 'main', name: 'Main' }, { id: 2, slug: 'other', name: 'Other' }] })
    taxonomyApi.objectTypes.mockResolvedValue({ results: [] })
})
function renderForm(namespaceScope, onSave) {
    render(<QueryClientProvider client={new QueryClient()}><div className="classification-manager">
        <ClassificationTypeForm tenant="tenant" namespaceScope={namespaceScope} onSave={onSave} />
    </div></QueryClientProvider>)
}
describe('scoped tag type creation', () => {
    it('locks the media namespace and submits its resolved numeric ID', async () => {
        const onSave = vi.fn()
        renderForm('main', onSave)
        expect(await screen.findByRole('combobox', { name: 'Namespace' })).toBeDisabled()
        await waitFor(() => expect(screen.getByRole('combobox', { name: 'Namespace' })).toHaveTextContent('Main'))
        fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'Topics' } })
        fireEvent.change(screen.getByLabelText('Stable key'), { target: { value: 'topics' } })
        fireEvent.click(screen.getByRole('button', { name: 'Apply' }))
        expect(onSave).toHaveBeenCalledWith(expect.objectContaining({ namespace: 1 }))
        expect(onSave.mock.calls[0][0]).not.toHaveProperty('sort_order')
        expect(screen.queryByText('Sort order')).not.toBeInTheDocument()
    })
    it('keeps the global Tags namespace selector editable', async () => {
        renderForm(undefined, vi.fn())
        const field = await screen.findByRole('combobox', { name: 'Namespace' })
        expect(field).not.toBeDisabled()
        fireEvent.click(field)
        expect(await screen.findByRole('option', { name: 'Other' })).toBeInTheDocument()
    })
})
