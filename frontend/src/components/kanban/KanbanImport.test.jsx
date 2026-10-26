import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, expect, it, vi } from 'vitest'
import KanbanImport from './KanbanImport'
import { kanbanApi } from '../../api/kanban'
import { setCmsCopyLanguage } from '../../utils/cmsCopy'

beforeEach(() => setCmsCopyLanguage('sv-se'))

const session = vi.hoisted(() => ({ user: { id: 1 } }))
vi.mock('../../contexts/AuthContext', () => ({ useAuth: () => session }))
vi.mock('../../utils/tenant', () => ({
    getCurrentTenantId: () => 'tenant',
    subscribeToCurrentTenantId: () => () => {},
}))

vi.mock('../../api/kanban', () => ({
    kanbanApi: { get: vi.fn(), post: vi.fn() },
    kanbanError: () => 'Import failed',
}))

vi.mock('../../api/taxonomy', () => ({
    taxonomyApi: {
        terms: vi.fn().mockResolvedValue({ results: [{ id: 'term-id', name: 'Approved', path: 'Approved', status: 'approved' }] }),
        term: vi.fn().mockResolvedValue({ id: 'term-id', name: 'Approved', path: 'Approved', status: 'approved' }),
    },
    classificationError: () => 'Classification failed',
}))

it('shows provenance and only imports approved attachments with current revision', async () => {
    kanbanApi.get.mockImplementation((path) =>
        Promise.resolve(
            path === 'attachments/'
                ? [
                      {
                          id: 'a',
                          card: 'card',
                          shortId: 'TASK-1',
                          cardTitle: 'Review',
                          filename: 'hero.png',
                          approvedAt: 'now',
                          imports: [{ id: 'i', destination: 'media', destinationLabel: 'Hero' }],
                      },
                      {
                          id: 'b',
                          card: 'card',
                          shortId: 'TASK-1',
                          cardTitle: 'Review',
                          filename: 'draft.png',
                          approvedAt: null,
                          imports: [],
                      },
                  ]
                : { revision: 7 },
        ),
    )
    kanbanApi.post.mockResolvedValue({})
    const client = new QueryClient({
        defaultOptions: { queries: { retry: false } },
    })
    render(
        <QueryClientProvider client={client}>
            <MemoryRouter>
                <KanbanImport destination="media" namespace={1} />
            </MemoryRouter>
        </QueryClientProvider>,
    )
    fireEvent.click(screen.getByRole('button', { name: 'Importera från Kanban' }))
    await screen.findByText('hero.png · Godkänd')
    expect(screen.getByText('Importerad till media: Hero')).toBeInTheDocument()
    expect(screen.getAllByRole('button', { name: 'Importera kopia' })[0]).toBeDisabled()
    fireEvent.click(await screen.findByRole('button', { name: 'Approved', exact: true }))
    const buttons = screen.getAllByRole('button', { name: 'Importera kopia' })
    expect(buttons[1]).toBeDisabled()
    fireEvent.click(buttons[0])
    await waitFor(() =>
        expect(kanbanApi.post).toHaveBeenCalledWith('attachments/a/import/', {
            destination: 'media',
            revision: 7,
            namespace: 1,
            classificationIds: ['term-id'],
        }),
    )
})

it('does not reuse a previous account’s cached tenant attachments after sign-in changes', async () => {
    session.user = { id: 1 }
    const client = new QueryClient({
        defaultOptions: { queries: { retry: false, staleTime: 300000 } },
    })
    kanbanApi.get.mockReset()
    kanbanApi.get.mockResolvedValueOnce([
        {
            id: 'private',
            card: 'card',
            shortId: 'TASK-1',
            cardTitle: 'Internal',
            filename: 'private.png',
            approvedAt: 'now',
            imports: [],
        },
    ])
    const view = () => (
        <QueryClientProvider client={client}>
            <MemoryRouter>
                <KanbanImport destination="media" namespace={1} />
            </MemoryRouter>
        </QueryClientProvider>
    )
    const first = render(view())
    fireEvent.click(screen.getByRole('button', { name: 'Importera från Kanban' }))
    await screen.findByText('private.png · Godkänd')
    first.unmount()
    session.user = { id: 2 }
    kanbanApi.get.mockRejectedValue(new Error('Tenant membership denied'))
    render(view())
    fireEvent.click(screen.getByRole('button', { name: 'Importera från Kanban' }))
    await waitFor(() => expect(kanbanApi.get).toHaveBeenCalledTimes(2))
    expect(screen.queryByText('private.png · Godkänd')).not.toBeInTheDocument()
    session.user = { id: 1 }
})
