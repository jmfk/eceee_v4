import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({ list: vi.fn(), restore: vi.fn(), addNotification: vi.fn() }))
vi.mock('../../api/trash', () => ({ trashApi: { list: mocks.list, restore: mocks.restore } }))
vi.mock('../../contexts/GlobalNotificationContext', () => ({
    useGlobalNotifications: () => ({ addNotification: mocks.addNotification }),
}))
vi.mock('../../hooks/useDocumentTitle', () => ({ useDocumentTitle: vi.fn() }))

import TrashPage from '../TrashPage'

const rows = [
    { type: 'page', id: '1', title: 'Removed page', deletedAt: '2026-10-30T12:00:00Z' },
    { type: 'media', id: 'file-1', title: 'Removed photo', deletedAt: '2026-10-29T12:00:00Z' },
    { type: 'collection', id: 'collection-1', title: 'Removed collection', deletedAt: '2026-10-28T12:00:00Z' },
]

const renderPage = () => render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
        <TrashPage />
    </QueryClientProvider>
)

describe('TrashPage', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        mocks.list.mockImplementation(async ({ type = 'all', search = '' }) => {
            const filtered = rows.filter(row => (type === 'all' || row.type === type)
                && row.title.toLowerCase().includes(search.toLowerCase()))
            return { results: filtered, count: filtered.length, counts: { page: 1, media: 1, collection: 1 }, totalPages: 1 }
        })
        mocks.restore.mockResolvedValue({ restoredCount: 2, warnings: [] })
    })

    it('filters and searches deleted items', async () => {
        const user = userEvent.setup()
        renderPage()
        expect(await screen.findByText('Removed page')).toBeInTheDocument()
        await user.click(screen.getByRole('tab', { name: /Collections/ }))
        expect(await screen.findByText('Removed collection')).toBeInTheDocument()
        expect(screen.queryByText('Removed page')).not.toBeInTheDocument()
        await user.type(screen.getByRole('textbox', { name: 'Search Trash' }), 'missing')
        await waitFor(() => expect(mocks.list).toHaveBeenCalledWith(expect.objectContaining({ type: 'collection', search: 'missing' })))
        expect(await screen.findByText('No deleted items match this view.')).toBeInTheDocument()
    })

    it('restores a mixed selection as one operation', async () => {
        const user = userEvent.setup()
        renderPage()
        await screen.findByText('Removed page')
        await user.click(screen.getByRole('checkbox', { name: 'Select Removed page' }))
        await user.click(screen.getByRole('checkbox', { name: 'Select Removed photo' }))
        await user.click(screen.getByRole('button', { name: 'Restore selected' }))
        await waitFor(() => expect(mocks.restore).toHaveBeenCalledWith([
            { type: 'page', id: '1' }, { type: 'media', id: 'file-1' },
        ]))
    })

    it('moves between item type tabs with the keyboard', async () => {
        const user = userEvent.setup()
        renderPage()
        const all = await screen.findByRole('tab', { name: 'All' })
        all.focus()
        await user.keyboard('{ArrowRight}')
        expect(screen.getByRole('tab', { name: /Pages/ })).toHaveFocus()
        expect(screen.getByRole('tab', { name: /Pages/ })).toHaveAttribute('aria-selected', 'true')
    })
})
