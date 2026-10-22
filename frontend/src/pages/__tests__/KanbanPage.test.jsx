import { render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import KanbanPage from '../KanbanPage'
import { kanbanApi } from '../../api/kanban'

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
    kanbanApi: { get: vi.fn(), cards: vi.fn() },
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
        expect(await screen.findByRole('link', { name: 'Redaktionen' })).toHaveAttribute('aria-current', 'page')
        expect(screen.getByRole('link', { name: 'Granska nyhet' })).toHaveAttribute('href', '/kanban/cards/card-1')
        expect(screen.getByRole('button', { name: 'Flytta ECE-1 upp' })).toBeDisabled()
        expect(screen.getByRole('link', { name: 'Till Profile' })).toHaveAttribute('href', '/profile')
    })
})
