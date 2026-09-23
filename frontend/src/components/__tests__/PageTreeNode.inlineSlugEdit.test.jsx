import { render, screen } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import userEvent from '@testing-library/user-event'
import PageTreeNode from '../PageTreeNode'
import { NotificationProvider } from '../NotificationManager'

vi.mock('../../utils/apiValidation.js', () => ({
    getPageDisplayUrl: vi.fn((page) => page.slug || ''),
    isRootPage: vi.fn(() => false),
    sanitizePageData: vi.fn((page) => page),
}))

const mockPage = {
    id: 1,
    title: 'Test Page',
    slug: 'test-page',
    publicationStatus: 'published',
    childrenCount: 0,
    children: [],
    isExpanded: false,
    childrenLoaded: true,
}

const renderWithProviders = (component) => {
    const queryClient = new QueryClient({
        defaultOptions: {
            queries: { retry: false },
            mutations: { retry: false },
        },
    })

    return render(
        <QueryClientProvider client={queryClient}>
            <NotificationProvider>
                {component}
            </NotificationProvider>
        </QueryClientProvider>
    )
}

describe('PageTreeNode - slug editing boundary', () => {
    beforeEach(() => {
        vi.clearAllMocks()
    })

    it('shows the public slug as a link to page settings', () => {
        renderWithProviders(<PageTreeNode page={mockPage} level={1} onEdit={vi.fn()} />)

        const slugButton = screen.getByRole('button', {
            name: 'Edit slug for Test Page in page settings',
        })
        expect(slugButton).toHaveTextContent('test-page')
        expect(slugButton).toHaveAttribute('title', 'test-page — edit in page settings')
    })

    it('opens page settings instead of changing the public slug inline', async () => {
        const user = userEvent.setup()
        const onEdit = vi.fn()
        renderWithProviders(<PageTreeNode page={mockPage} level={1} onEdit={onEdit} />)

        await user.click(screen.getByRole('button', {
            name: 'Edit slug for Test Page in page settings',
        }))

        expect(onEdit).toHaveBeenCalledWith({ ...mockPage, editorTab: 'settings' })
        expect(screen.queryByRole('textbox')).not.toBeInTheDocument()
    })
})
