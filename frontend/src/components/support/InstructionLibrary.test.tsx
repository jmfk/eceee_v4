import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import InstructionLibrary from './InstructionLibrary'
import { supportRequest } from '../../api/support'
import { setCmsCopyLanguage } from '../../utils/cmsCopy'

vi.unmock('react-router-dom')
vi.mock('./useSupportContext', () => ({ useSupportTenant: () => 'workspace-a', useSupportIdentity: () => 42 }))
vi.mock('../../api/support', () => ({ supportRequest: vi.fn(), supportError: () => 'Kunde inte hämta filmer.' }))
vi.mock('./PrivateVideoThumbnail', () => ({ default: ({ id }: { id: string }) => <span data-testid="thumbnail">{id}</span> }))

const film = { id: 'film-1', videoId: 'private-1', title: 'Kom igång med Designer', description: 'Hitta rätt tema.', publishedAt: '2026-11-19T12:00:00Z', language: 'sv' }
const renderLibrary = () => render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
        <MemoryRouter><InstructionLibrary link={(path) => `/inbox/${path}?tenant=workspace-a`} /></MemoryRouter>
    </QueryClientProvider>,
)
beforeEach(() => {
    vi.clearAllMocks()
    setCmsCopyLanguage('sv-se')
    vi.mocked(supportRequest).mockImplementation(async (_tenant, path) => ({ results: path.includes('search=missing') ? [] : [film], next: path.includes('page=1') ? 'next' : null, previous: path.includes('page=2') ? 'previous' : null }))
})

describe('instruction library', () => {
    it('links a film and its private thumbnail to the tenant instruction', async () => {
        renderLibrary()
        expect(await screen.findByRole('link', { name: film.title })).toHaveAttribute('href', '/inbox/instructions/film-1?tenant=workspace-a')
        expect(screen.getByTestId('thumbnail')).toHaveTextContent('private-1')
        expect(screen.getByText(film.description)).toBeInTheDocument()
    })
    it('searches all pages on the server, resets pagination, and clears the query', async () => {
        renderLibrary()
        fireEvent.click(await screen.findByRole('button', { name: 'Nästa' }))
        await waitFor(() => expect(supportRequest).toHaveBeenLastCalledWith('workspace-a', 'instructions/?page=2&archived=false&search='))
        fireEvent.change(screen.getByRole('searchbox', { name: 'Sök instruktionsfilmer' }), { target: { value: 'tema & färg' } })
        await waitFor(() => expect(supportRequest).toHaveBeenLastCalledWith('workspace-a', 'instructions/?page=1&archived=false&search=tema%20%26%20f%C3%A4rg'))
        const clearButton = screen.getByRole('button', { name: 'Rensa sökning' })
        act(() => clearButton.focus())
        fireEvent.click(clearButton)
        expect(screen.getByRole('searchbox')).toHaveFocus()
        await waitFor(() => expect(supportRequest).toHaveBeenLastCalledWith('workspace-a', 'instructions/?page=1&archived=false&search='))
    })
    it('combines search with the removable archive filter', async () => {
        renderLibrary()
        await screen.findByRole('link', { name: film.title })
        fireEvent.change(screen.getByRole('searchbox'), { target: { value: 'Designer' } })
        fireEvent.click(screen.getByRole('button', { name: 'Lägg till filter' }))
        fireEvent.click(screen.getByRole('checkbox', { name: 'Visa även arkiverade filmer' }))
        await waitFor(() => expect(supportRequest).toHaveBeenLastCalledWith('workspace-a', 'instructions/?page=1&archived=true&search=Designer'))
        const removeFilter = screen.getByRole('button', { name: 'Ta bort filtret arkiverade filmer' })
        act(() => removeFilter.focus())
        fireEvent.click(removeFilter)
        expect(screen.getByRole('searchbox')).toHaveFocus()
        await waitFor(() => expect(supportRequest).toHaveBeenLastCalledWith('workspace-a', 'instructions/?page=1&archived=false&search=Designer'))
    })
    it('distinguishes no search matches from an empty library', async () => {
        renderLibrary()
        await screen.findByRole('link', { name: film.title })
        fireEvent.change(screen.getByRole('searchbox'), { target: { value: 'missing' } })
        expect(await screen.findByText('Inga filmer matchar sökningen. Prova ett annat sökord.')).toBeInTheDocument()
        expect(screen.queryByText('Inga publicerade instruktioner ännu.')).not.toBeInTheDocument()
    })
})
