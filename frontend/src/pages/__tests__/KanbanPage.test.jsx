import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import KanbanPage, { Attachments } from '../KanbanPage'
import { kanbanApi, kanbanError } from '../../api/kanban'
import { setCmsCopyLanguage } from '../../utils/cmsCopy'

vi.unmock('react-router-dom')
vi.mock('../../components/Navbar', () => ({ default: () => <nav aria-label="CMS">CMS</nav> }))
vi.mock('../../components/StatusBar', () => ({ default: () => <footer aria-label="Status">Kanban</footer> }))
vi.mock('../../components/wysiwyg/GlobalWysiwygToolbar', () => ({ default: () => null }))
vi.mock('../../contexts/AuthContext', () => ({ useAuth: () => ({ user: { id: 42 } }) }))
vi.mock('../../hooks/useDocumentTitle', () => ({ useDocumentTitle: vi.fn() }))
vi.mock('../../utils/tenant', () => ({
    getCurrentTenantId: () => 'workspace-a',
    subscribeToCurrentTenantId: () => () => {},
}))
vi.mock('../../api/kanban', async (importOriginal) => ({
    ...(await importOriginal()),
    kanbanApi: { get: vi.fn(), cards: vi.fn(), post: vi.fn(), patch: vi.fn(), upload: vi.fn() },
}))

const workspace = {
    boards: [{ id: 'board-1', title: 'Redaktionen', archived: false }],
    columns: [{ id: 'column-1', board: 'board-1', title: 'Att göra', archived: false }],
    notifications: [], members: [], labels: [],
}
const card = { id: 'card-1', column: 'column-1', shortId: 'ECE-1', title: 'Granska nyhet', assignees: [], checklist: [] }
const renderKanban = (route = '/kanban') => render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
        <MemoryRouter initialEntries={[route]}>
            <Routes>
                <Route path="/kanban" element={<KanbanPage />} />
                <Route path="/kanban/boards/:boardId" element={<KanbanPage />} />
            </Routes>
        </MemoryRouter>
    </QueryClientProvider>,
)

beforeEach(() => {
    setCmsCopyLanguage('sv-se')
    vi.clearAllMocks()
    kanbanApi.get.mockImplementation(async (path) => path === 'workspace/' ? workspace : {})
    kanbanApi.cards.mockResolvedValue({ results: [card] })
})

describe('Kanban application navigation', () => {
    it('keeps app navigation available while the workspace loads', () => {
        kanbanApi.get.mockReturnValue(new Promise(() => {}))
        renderKanban()
        expect(screen.getByRole('navigation', { name: 'CMS' })).toBeInTheDocument()
        expect(screen.getByRole('status')).toHaveTextContent('Läser arbetsytan')
        expect(screen.getByRole('contentinfo', { name: 'Status' })).toBeInTheDocument()
    })

    it('keeps app navigation and retry available when loading fails', async () => {
        kanbanApi.get.mockRejectedValue(new Error('Offline'))
        renderKanban()
        expect(await screen.findByRole('alert')).toBeInTheDocument()
        expect(screen.getByRole('button', { name: 'Försök igen' })).toBeInTheDocument()
        expect(screen.getByRole('navigation', { name: 'CMS' })).toBeInTheDocument()
    })

    it('identifies the selected board and preserves card links and keyboard move actions', async () => {
        renderKanban('/kanban/boards/board-1')
        expect(await screen.findByRole('heading', { name: 'Redaktionen' })).toBeInTheDocument()
        expect(screen.queryByRole('button', { name: 'Skapa tavla' })).not.toBeInTheDocument()
        fireEvent.click(screen.getByLabelText('Kortåtgärder för ECE-1'))
        expect(screen.getByRole('link', { name: 'Granska nyhet' })).toHaveAttribute('href', '/kanban/cards/card-1')
        expect(screen.getByRole('button', { name: 'Flytta ECE-1 upp' })).toBeDisabled()
        expect(screen.getByRole('link', { name: 'Profile' })).toHaveAttribute('href', '/profile')
    })
    it('keeps board creation in the overview and opens the created board', async () => {
        kanbanApi.post.mockResolvedValue(workspace.boards[0])
        renderKanban()
        expect(await screen.findByRole('link', { name: 'Redaktionen' })).toHaveAttribute('href', '/kanban/boards/board-1')
        expect(screen.queryByRole('textbox', { name: 'Tavelnamn' })).not.toBeInTheDocument()
        fireEvent.click(screen.getByRole('button', { name: 'Skapa tavla' }))
        fireEvent.change(screen.getByRole('textbox', { name: 'Tavelnamn' }), { target: { value: 'Ny tavla' } })
        fireEvent.click(screen.getByRole('textbox', { name: 'Tavelnamn' }).closest('form').querySelector('button'))
        expect(await screen.findByRole('heading', { name: 'Redaktionen' })).toBeInTheDocument()
        expect(kanbanApi.post).toHaveBeenCalledWith('boards/', { title: 'Ny tavla' })
        expect(screen.queryByRole('textbox', { name: 'Tavelnamn' })).not.toBeInTheDocument()
    })

    it('opens filters and the list composer only when requested', async () => {
        renderKanban('/kanban/boards/board-1')
        await screen.findByRole('heading', { name: 'Redaktionen' })
        expect(screen.queryByRole('textbox', { name: 'Sök kort' })).not.toBeInTheDocument()
        fireEvent.click(screen.getByRole('button', { name: 'Filter' }))
        expect(screen.getByRole('textbox', { name: 'Sök kort' })).toBeVisible()
        fireEvent.click(screen.getByRole('button', { name: 'Lägg till lista' }))
        expect(screen.getByRole('textbox', { name: 'Listnamn' })).toHaveFocus()
    })

})

describe('Kanban card attachments', () => {
    const attachmentCard = { id: 'card-1', revision: 1, comments: [], attachments: [] }
    const attachmentWorkspace = { fileTypes: { 'text/plain': ['.txt'] } }

    it('opens the file picker when the drop zone is clicked', () => {
        render(<Attachments
            card={{ ...attachmentCard, attachments: [{ id: 'file-1', filename: 'note.txt', size: 4, contentType: 'text/plain' }] }}
            workspace={attachmentWorkspace}
            run={vi.fn()}
        />)
        const input = screen.getByLabelText('Ladda upp bilagor').querySelector('input[type="file"]')
        const click = vi.spyOn(input, 'click')
        fireEvent.click(screen.getByRole('button', { name: 'Ladda upp bilagor' }))
        expect(click).toHaveBeenCalledOnce()
        fireEvent.keyDown(screen.getByRole('button', { name: 'Ladda upp bilagor' }), { key: 'Enter' })
        expect(click).toHaveBeenCalledTimes(2)
        expect(screen.queryByRole('button', { name: 'Godkänn bilaga' })).not.toBeInTheDocument()
        expect(screen.queryByRole('button', { name: 'Importera till media' })).not.toBeInTheDocument()
    })

    it('uploads dropped files in order using each new card revision', async () => {
        const run = vi.fn(async (action) => action())
        const first = new File(['first'], 'first.txt', { type: 'text/plain' })
        const second = new File(['second'], 'second.txt', { type: 'text/plain' })
        kanbanApi.upload.mockResolvedValue({})
        kanbanApi.get.mockResolvedValue({ revision: 2 })
        render(<Attachments card={attachmentCard} workspace={attachmentWorkspace} run={run} />)
        fireEvent.drop(screen.getByRole('button', { name: 'Ladda upp bilagor' }), {
            dataTransfer: {
                files: [first, second],
                items: [first, second].map((file) => ({ kind: 'file', type: file.type, getAsFile: () => file })),
                types: ['Files'],
            },
        })
        await waitFor(() => expect(kanbanApi.upload).toHaveBeenCalledTimes(2))
        expect(kanbanApi.upload).toHaveBeenNthCalledWith(1, 'card-1', first, 1, '')
        expect(kanbanApi.upload).toHaveBeenNthCalledWith(2, 'card-1', second, 2, '')
        await waitFor(() => expect(run).toHaveBeenCalledOnce())
    })

    it('does not print a server HTML error page inside the card', () => {
        expect(kanbanError({ response: { status: 500, data: '<!DOCTYPE html><html>error</html>' } }))
            .toBe('Servern kunde inte slutföra åtgärden. Försök igen senare.')
    })
})
