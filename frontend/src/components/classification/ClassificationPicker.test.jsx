import React from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react'
import { vi, describe, it, expect, beforeEach } from 'vitest'
import userEvent from '@testing-library/user-event'
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
    it('does not fetch or show results until a non-blank search is entered, including after clearing', async () => {
        renderPicker({ namespace: 'editorial' })
        const input = screen.getByRole('combobox', { name: 'Find a tag' })
        fireEvent.focus(input)
        fireEvent.change(input, { target: { value: '   ' } })
        expect(taxonomyApi.terms).not.toHaveBeenCalled()
        expect(screen.queryByRole('listbox')).not.toBeInTheDocument()
        expect(screen.queryByText('Loading tags…')).not.toBeInTheDocument()
        expect(screen.queryByText('No matching tags.')).not.toBeInTheDocument()

        fireEvent.change(input, { target: { value: 'Energy' } })
        expect(await screen.findByRole('option', { name: 'Climate / Energy' })).toBeInTheDocument()
        fireEvent.change(input, { target: { value: '' } })
        expect(screen.queryByRole('listbox')).not.toBeInTheDocument()
        expect(screen.queryByText('No matching tags.')).not.toBeInTheDocument()
        expect(taxonomyApi.terms).toHaveBeenCalledTimes(1)
    })
    it('renders a portalled select list and supports keyboard selection and Escape', async () => {
        const user = userEvent.setup()
        const changed = renderPicker({ namespace: 'editorial' })
        const input = screen.getByRole('combobox', { name: 'Find a tag' })
        await user.type(input, 'Energy')
        const list = await screen.findByRole('listbox', { name: 'Matching tags' })
        expect(list.closest('fieldset')).toBeNull()
        expect(within(list).getByRole('option', { name: 'Climate / Energy' })).toBeInTheDocument()
        await user.keyboard('{ArrowDown}{Enter}')
        expect(changed).toHaveBeenCalledWith(['approved'])
        expect(input).toHaveValue('')
        expect(input).toHaveFocus()
        expect(screen.queryByRole('listbox')).not.toBeInTheDocument()

        await user.type(input, 'Energy')
        expect(await screen.findByRole('listbox')).toBeInTheDocument()
        await user.keyboard('{Escape}')
        expect(screen.queryByRole('listbox')).not.toBeInTheDocument()
        expect(input).toHaveFocus()
    })
    it('preserves ordered IDs and excludes inactive media choices', async () => {
        const user = userEvent.setup()
        const changed = renderPicker({ value: ['archived'], use: 'media_files' })
        fireEvent.change(screen.getByRole('combobox', { name: 'Find a tag' }), { target: { value: 'Energy' } })
        await screen.findByRole('option', { name: 'Climate / Energy' })
        expect(screen.queryByRole('option', { name: /pending approval/ })).toBeNull()
        expect(screen.queryByRole('option', { name: 'Archived' })).toBeNull()
        await user.click(screen.getByRole('option', { name: 'Climate / Energy' }))
        expect(changed).toHaveBeenCalledWith(['archived', 'approved'])
        expect(await screen.findByText('Archived (archived)')).toBeTruthy()
        const remove = screen.getByRole('button', { name: 'Remove Archived' })
        expect(remove).toHaveTextContent('')
        fireEvent.click(remove)
        expect(changed).toHaveBeenCalledWith([])
    })
    it('shows the provided tag name while its ID lookup is unavailable', async () => {
        const id = 'f6b81810-1281-4615-8fa5-49132bf49158'
        taxonomyApi.term.mockRejectedValue(new Error('Term unavailable'))
        renderPicker({ value: [id], selectedTerms: [{ classificationId: id, name: 'Energy efficiency', status: 'approved' }] })
        const name = await screen.findByText('Energy efficiency')
        expect(name).toHaveAttribute('title', `ID: ${id}`)
        expect(screen.queryByText(id)).toBeNull()
        expect(screen.queryByRole('alert')).toBeNull()
    })
    it('distinguishes same-name selections by path when displaying and removing them', async () => {
        const tags = {
            general: { id: 'general', name: 'Energy', path: 'General / Energy', status: 'approved' },
            topic: { id: 'topic', name: 'Energy', path: 'Topics / Energy', status: 'approved' },
        }
        taxonomyApi.term.mockImplementation(async id => tags[id])
        const changed = renderPicker({ value: ['general', 'topic'] })
        const selected = within(screen.getByRole('list', { name: 'Selected tags' }))
        expect(await selected.findByText('General / Energy')).toBeInTheDocument()
        expect(await selected.findByText('Topics / Energy')).toBeInTheDocument()
        fireEvent.click(selected.getByRole('button', { name: 'Remove Topics / Energy' }))
        expect(changed).toHaveBeenCalledWith(['general'])
    })
    it('allows pending terms in drafts and clearly labels them', async () => {
        const user = userEvent.setup()
        const changed = renderPicker({ allowProposed: true })
        fireEvent.change(screen.getByRole('combobox', { name: 'Find a tag' }), { target: { value: 'Pending' } })
        await user.click(await screen.findByRole('option', { name: 'Pending (pending approval)' }))
        expect(changed).toHaveBeenCalledWith(['pending'])
    })
    it('dismisses results on outside click and shows an empty state only for a search', async () => {
        const user = userEvent.setup()
        taxonomyApi.terms.mockResolvedValue({ results: [] })
        renderPicker({ namespace: 'editorial' })
        await user.type(screen.getByRole('combobox', { name: 'Find a tag' }), 'missing')
        expect(await screen.findByText('No matching tags.')).toBeInTheDocument()
        await user.click(screen.getByRole('button', { name: 'Suggest a tag' }))
        expect(screen.queryByRole('listbox')).not.toBeInTheDocument()
    })
    it('keeps failures next to the selector', async () => {
        taxonomyApi.terms.mockRejectedValue(new Error('Could not load classifications. Retry.'))
        renderPicker()
        fireEvent.change(screen.getByRole('combobox', { name: 'Find a tag' }), { target: { value: 'Energy' } })
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
        fireEvent.change(screen.getByRole('combobox', { name: 'Find a tag' }), { target: { value: 'Energy' } })
        await waitFor(() => expect(taxonomyApi.terms).toHaveBeenCalledWith(expect.objectContaining({ namespace: 'editorial', use: 'pages', search: 'Energy', page: 1 })))
        const user = userEvent.setup()
        await user.click(await screen.findByRole('option', { name: 'Next page' }))
        await waitFor(() => expect(taxonomyApi.terms).toHaveBeenCalledWith(expect.objectContaining({ page: 2 })))
    })
    it('pages through results with the keyboard without selecting a tag', async () => {
        const user = userEvent.setup()
        taxonomyApi.terms.mockImplementation(async ({ page }) => ({ results: [], next: page === 1 ? 'page2' : null }))
        const changed = renderPicker({ namespace: 'editorial' })
        const input = screen.getByRole('combobox', { name: 'Find a tag' })
        await user.type(input, 'Energy')
        await screen.findByRole('option', { name: 'Next page' })
        await user.keyboard('{ArrowDown}{Enter}')
        await waitFor(() => expect(taxonomyApi.terms).toHaveBeenCalledWith(expect.objectContaining({ page: 2, search: 'Energy' })))
        expect(input).toHaveFocus()
        expect(input).toHaveValue('Energy')
        await user.keyboard('{ArrowDown}')
        await screen.findByRole('option', { name: 'Previous page' })
        await user.keyboard('{Enter}')
        await waitFor(() => expect(taxonomyApi.terms).toHaveBeenLastCalledWith(expect.objectContaining({ page: 1, search: 'Energy' })))
        expect(changed).not.toHaveBeenCalled()
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
        fireEvent.change(screen.getByRole('combobox', { name: 'Find a tag' }), { target: { value: 'climate' } })
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
