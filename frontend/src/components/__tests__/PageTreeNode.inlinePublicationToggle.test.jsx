import { render, screen } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { describe, expect, it, vi } from 'vitest'
import userEvent from '@testing-library/user-event'
import PageTreeNode from '../PageTreeNode'
import { NotificationProvider } from '../NotificationManager'

vi.mock('../../utils/apiValidation.js', () => ({
    getPageDisplayUrl: vi.fn(() => '/test-page'),
    isRootPage: vi.fn(() => false),
    sanitizePageData: vi.fn((page) => page),
}))

const basePage = {
    id: 1,
    title: 'Test Page',
    slug: 'test-page',
    childrenCount: 0,
    children: [],
    isExpanded: false,
    childrenLoaded: true,
}

const renderPage = (workflowState, extra = {}) => {
    const queryClient = new QueryClient({
        defaultOptions: {
            queries: { retry: false },
            mutations: { retry: false },
        },
    })

    return render(
        <QueryClientProvider client={queryClient}>
            <NotificationProvider>
                <PageTreeNode page={{ ...basePage, workflowState, ...extra }} level={0} />
            </NotificationProvider>
        </QueryClientProvider>
    )
}

describe('PageTreeNode publication status', () => {
    it.each([
        ['notPublished', 'Not published'],
        ['live', 'Live'],
        ['liveWithUnpublishedChanges', 'Live · unpublished changes'],
        ['scheduled', 'Scheduled'],
        ['liveWithScheduledChanges', 'Live · scheduled changes'],
        ['publicationEnded', 'Publication ended'],
    ])('shows the aggregate %s state', (workflowState, label) => {
        renderPage(workflowState)

        expect(screen.getByText(label)).toBeInTheDocument()
    })

    it('accepts snake-case workflow states from the API', () => {
        renderPage('live_with_unpublished_changes')

        expect(screen.getByText('Live · unpublished changes')).toBeInTheDocument()
    })

    it('shows a scheduled date when one is available', () => {
        renderPage('scheduled', { scheduledEffectiveDate: '2030-05-12T08:00:00Z' })

        expect(screen.getByText(/Scheduled ·/)).toBeInTheDocument()
    })

    it('keeps the status indicator informational', async () => {
        const user = userEvent.setup()
        renderPage('live')

        const indicator = screen.getByLabelText(/Live\. Open the page editor to change publication/i)
        expect(indicator).toHaveClass('cursor-help')
        expect(indicator).not.toHaveClass('cursor-pointer')

        await user.click(indicator)
        expect(screen.getByText('Live')).toBeInTheDocument()
    })

    it('does not expose technical version numbers in the page row', () => {
        renderPage('liveWithUnpublishedChanges', { versionNumber: 27 })

        expect(screen.queryByText(/v27/i)).not.toBeInTheDocument()
    })
})
