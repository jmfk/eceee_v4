import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { vi, describe, it, expect, beforeEach } from 'vitest'
import userEvent from '@testing-library/user-event'
import PageTreeNode from '../PageTreeNode'
import { api } from '../../api/client'

// Mock the API
vi.mock('../../api/client', () => ({
    api: {
        post: vi.fn(),
        patch: vi.fn() // Added for consistency with other tests
    }
}))

// Mock toast
vi.mock('react-hot-toast', () => ({
    default: {
        success: vi.fn(),
        error: vi.fn()
    }
}))

// Mock utils
vi.mock('../../utils/apiValidation.js', () => ({
    getPageDisplayUrl: vi.fn(() => '/test-page'),
    isRootPage: vi.fn(() => false),
    sanitizePageData: vi.fn((page) => page)
}))

const mockUnpublishedPage = {
    id: 1,
    title: 'Test Page',
    slug: 'test-page',
    publication_status: 'unpublished',
    children_count: 0,
    children: [],
    isExpanded: false,
    childrenLoaded: true
}

const mockPublishedPage = {
    id: 2,
    title: 'Published Page',
    slug: 'published-page',
    publication_status: 'published',
    children_count: 0,
    children: [],
    isExpanded: false,
    childrenLoaded: true
}

const mockScheduledPage = {
    id: 3,
    title: 'Scheduled Page',
    slug: 'scheduled-page',
    publication_status: 'scheduled',
    children_count: 0,
    children: [],
    isExpanded: false,
    childrenLoaded: true
}

const mockExpiredPage = {
    id: 4,
    title: 'Expired Page',
    slug: 'expired-page',
    publication_status: 'expired',
    children_count: 0,
    children: [],
    isExpanded: false,
    childrenLoaded: true
}

const renderWithProviders = (component) => {
    const queryClient = new QueryClient({
        defaultOptions: {
            queries: { retry: false },
            mutations: { retry: false }
        }
    })

    return render(
        <QueryClientProvider client={queryClient}>
            {component}
        </QueryClientProvider>
    )
}

describe('PageTreeNode - Inline Publication Toggle', () => {
    let user

    beforeEach(() => {
        user = userEvent.setup()
        vi.clearAllMocks()
    })

    it('should display unpublished status as clickable icon', () => {
        renderWithProviders(
            <PageTreeNode page={mockUnpublishedPage} level={0} />
        )

        // Should show unpublished icon (AlertCircle/CircleAlert)
        const statusIcon = document.querySelector('svg.lucide-circle-alert')
        expect(statusIcon).toBeInTheDocument()

        // Should be clickable
        const clickableContainer = statusIcon.parentElement
        expect(clickableContainer).toHaveClass('cursor-pointer')
    })

    it('should display published status as clickable icon', () => {
        renderWithProviders(
            <PageTreeNode page={mockPublishedPage} level={0} />
        )

        // Should show published icon (Globe)
        const statusIcon = document.querySelector('svg.lucide-globe')
        expect(statusIcon).toBeInTheDocument()

        // Should be clickable
        const clickableContainer = statusIcon.parentElement
        expect(clickableContainer).toHaveClass('cursor-pointer')
    })

    it('should display scheduled status as non-clickable', () => {
        renderWithProviders(
            <PageTreeNode page={mockScheduledPage} level={0} />
        )

        // Should show scheduled icon (Clock) - look for the Clock icon specifically
        const clockIcon = document.querySelector('svg.lucide-clock')
        expect(clockIcon).toBeInTheDocument()
    })

    it('should display expired status as non-clickable', () => {
        renderWithProviders(
            <PageTreeNode page={mockExpiredPage} level={0} />
        )

        // Should show expired icon (AlertCircle/CircleAlert) - expired pages use same icon as unpublished
        const expiredIcon = document.querySelector('svg.lucide-circle-alert')
        expect(expiredIcon).toBeInTheDocument()

        // Should not be clickable 
        const container = expiredIcon.parentElement
        expect(container).toHaveClass('cursor-help')
        expect(container).not.toHaveClass('cursor-pointer')
    })

    it('should publish an unpublished page when clicked', async () => {
        const mockResponse = { data: { ...mockUnpublishedPage, publication_status: 'published' } }
        api.post.mockResolvedValue(mockResponse)

        renderWithProviders(
            <PageTreeNode page={mockUnpublishedPage} level={0} />
        )

        // Find and click the publication status icon
        const statusIcon = document.querySelector('svg.lucide-circle-alert')
        const clickableContainer = statusIcon.parentElement
        expect(clickableContainer).toHaveClass('cursor-pointer')

        await user.click(clickableContainer)

        // Should call publish API
        expect(api.post).toHaveBeenCalledWith('/api/v1/webpages/pages/1/publish/')
    })

    it('should unpublish a published page when clicked', async () => {
        const mockResponse = { data: { ...mockPublishedPage, publication_status: 'unpublished' } }
        api.post.mockResolvedValue(mockResponse)

        renderWithProviders(
            <PageTreeNode page={mockPublishedPage} level={0} />
        )

        // Find and click the publication status icon
        const statusIcon = document.querySelector('svg.lucide-globe')
        const clickableContainer = statusIcon.parentElement
        expect(clickableContainer).toHaveClass('cursor-pointer')

        await user.click(clickableContainer)

        // Should call unpublish API
        expect(api.post).toHaveBeenCalledWith('/api/v1/webpages/pages/2/unpublish/')
    })

    it('should show loading state while publishing', async () => {
        // Mock a slow API response
        api.post.mockImplementation(() => new Promise(resolve => setTimeout(resolve, 100)))

        renderWithProviders(
            <PageTreeNode page={mockUnpublishedPage} level={0} />
        )

        // Find and click the publication status icon
        const statusIcon = document.querySelector('svg.lucide-circle-alert')
        const clickableContainer = statusIcon.parentElement
        await user.click(clickableContainer)

        // Should show loading spinner
        const loadingSpinner = document.querySelector('.animate-spin')
        expect(loadingSpinner).toBeInTheDocument()
    })

    it('should show loading state while unpublishing', async () => {
        // Mock a slow API response
        api.post.mockImplementation(() => new Promise(resolve => setTimeout(resolve, 100)))

        renderWithProviders(
            <PageTreeNode page={mockPublishedPage} level={0} />
        )

        // Find and click the publication status icon
        const statusIcon = document.querySelector('svg.lucide-globe')
        const clickableContainer = statusIcon.parentElement
        await user.click(clickableContainer)

        // Should show loading spinner
        const loadingSpinner = document.querySelector('.animate-spin')
        expect(loadingSpinner).toBeInTheDocument()
    })

    it('should handle publish API errors gracefully', async () => {
        const mockError = new Error('API Error')
        mockError.response = { data: { detail: 'Failed to publish' } }
        api.post.mockRejectedValue(mockError)

        renderWithProviders(
            <PageTreeNode page={mockUnpublishedPage} level={0} />
        )

        // Find and click the publication status icon
        const statusIcon = document.querySelector('svg.lucide-circle-alert')
        const clickableContainer = statusIcon.parentElement
        await user.click(clickableContainer)

        // Should call publish API
        expect(api.post).toHaveBeenCalledWith('/api/v1/webpages/pages/1/publish/')

        // Wait for error handling
        await waitFor(() => {
            // Should not show loading spinner after error
            const loadingSpinner = document.querySelector('.animate-spin')
            expect(loadingSpinner).not.toBeInTheDocument()
        })
    })

    it('should handle unpublish API errors gracefully', async () => {
        const mockError = new Error('API Error')
        mockError.response = { data: { detail: 'Failed to unpublish' } }
        api.post.mockRejectedValue(mockError)

        renderWithProviders(
            <PageTreeNode page={mockPublishedPage} level={0} />
        )

        // Find and click the publication status icon
        const statusIcon = document.querySelector('svg.lucide-globe')
        const clickableContainer = statusIcon.parentElement
        await user.click(clickableContainer)

        // Should call unpublish API
        expect(api.post).toHaveBeenCalledWith('/api/v1/webpages/pages/2/unpublish/')

        // Wait for error handling
        await waitFor(() => {
            // Should not show loading spinner after error
            const loadingSpinner = document.querySelector('.animate-spin')
            expect(loadingSpinner).not.toBeInTheDocument()
        })
    })

    it('should prevent double-clicks while request is in progress', async () => {
        // Mock a slow API response
        let resolvePromise
        const slowPromise = new Promise(resolve => {
            resolvePromise = resolve
        })
        api.post.mockReturnValue(slowPromise)

        renderWithProviders(
            <PageTreeNode page={mockUnpublishedPage} level={0} />
        )

        // Find and click the publication status icon twice quickly
        const statusIcon = document.querySelector('svg.lucide-circle-alert')
        const clickableContainer = statusIcon.parentElement
        await user.click(clickableContainer)
        await user.click(clickableContainer) // Second click should be ignored

        // Should only call API once
        expect(api.post).toHaveBeenCalledTimes(1)

        // Resolve the promise
        resolvePromise({ data: { ...mockUnpublishedPage, publication_status: 'published' } })
    })

    it('should not be clickable for scheduled pages', async () => {
        renderWithProviders(
            <PageTreeNode page={mockScheduledPage} level={0} />
        )

        // Find the scheduled icon - it should not be clickable
        const statusIcon = document.querySelector('svg.lucide-clock')
        expect(statusIcon).toBeInTheDocument()

        // Try clicking it
        await user.click(statusIcon.parentElement)

        // Should not call any API
        expect(api.post).not.toHaveBeenCalled()
    })

    it('should not be clickable for expired pages', async () => {
        renderWithProviders(
            <PageTreeNode page={mockExpiredPage} level={0} />
        )

        // Find the expired icon - it should not be clickable
        const statusIcon = document.querySelector('svg.lucide-circle-alert')
        const container = statusIcon.parentElement
        expect(container).toHaveClass('cursor-help')

        // Try clicking it
        await user.click(container)

        // Should not call any API
        expect(api.post).not.toHaveBeenCalled()
    })

    it('should have correct hover effects for clickable status icons', () => {
        renderWithProviders(
            <PageTreeNode page={mockUnpublishedPage} level={0} />
        )

        // Find the clickable status icon
        const statusIcon = document.querySelector('svg.lucide-circle-alert')
        const clickableContainer = statusIcon.parentElement

        // Should have hover classes
        expect(clickableContainer).toHaveClass('cursor-pointer')
        expect(clickableContainer).toHaveClass('hover:scale-110')
    })

    it('should have correct cursor for non-clickable status icons', () => {
        renderWithProviders(
            <PageTreeNode page={mockScheduledPage} level={0} />
        )

        // Find the non-clickable status icon
        const statusContainer = document.querySelector('svg.lucide-clock').parentElement
        expect(statusContainer).toHaveClass('cursor-help')
        expect(statusContainer).not.toHaveClass('cursor-pointer')
    })
}) 