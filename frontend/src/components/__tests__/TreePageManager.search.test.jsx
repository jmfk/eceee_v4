import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { vi } from 'vitest'
import TreePageManager from '../TreePageManager'
import { searchAllPages, getPageChildren, getRootPages } from '../../api/pages'
import { createTestWrapper } from '../../test/testUtils'

// Mock axios
vi.mock('axios', () => ({
    default: {
        create: vi.fn(() => ({
            get: vi.fn(),
            post: vi.fn(),
            patch: vi.fn(),
            delete: vi.fn()
        }))
    }
}))

// Mock the API modules
vi.mock('../../api/pages', () => ({
    getRootPages: vi.fn(() => Promise.resolve({ results: [] })),
    getPageChildren: vi.fn(),
    movePage: vi.fn(),
    deletePage: vi.fn(),
    searchAllPages: vi.fn(),
    pageTreeUtils: {
        hasChildren: vi.fn(),
        formatPageForTree: vi.fn((page) => ({
            ...page,
            isExpanded: false,
            isLoading: false,
            children: [],
            childrenLoaded: false
        }))
    }
}))

// Mock the API client
vi.mock('../../api/client.js', () => ({
    api: {
        get: vi.fn(),
        post: vi.fn(),
        patch: vi.fn(),
        delete: vi.fn()
    }
}))

// Mock react-hot-toast
vi.mock('react-hot-toast', () => ({
    default: {
        success: vi.fn(),
        error: vi.fn()
    }
}))

describe('TreePageManager Search Functionality', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        // Setup default mocks for empty state
        getRootPages.mockResolvedValue({ results: [] })
        getPageChildren.mockResolvedValue({ results: [] })
    })

    const renderTreePageManager = () => {
        return render(
            <TreePageManager onEditPage={vi.fn()} />,
            { wrapper: createTestWrapper() }
        )
    }

    test('should show search input and trigger search', async () => {
        searchAllPages.mockResolvedValue({
            results: [],
            query: 'about',
            total_count: 0
        })

        renderTreePageManager()

        // Find search input
        const searchInput = screen.getByPlaceholderText('Search pages...')
        expect(searchInput).toBeInTheDocument()

        // Type in search term
        fireEvent.change(searchInput, { target: { value: 'about' } })

        // Wait for search to be triggered (debounced)
        await waitFor(() => {
            expect(searchAllPages).toHaveBeenCalledWith('about', {})
        }, { timeout: 1000 })

        // Verify that the search input has the correct value
        expect(searchInput.value).toBe('about')
    })

    test('should debounce search input', async () => {
        searchAllPages.mockResolvedValue({
            results: [],
            query: 'about',
            total_count: 0
        })

        renderTreePageManager()

        const searchInput = screen.getByPlaceholderText('Search pages...')

        // Type rapidly
        fireEvent.change(searchInput, { target: { value: 'a' } })
        fireEvent.change(searchInput, { target: { value: 'ab' } })
        fireEvent.change(searchInput, { target: { value: 'abo' } })
        fireEvent.change(searchInput, { target: { value: 'abou' } })
        fireEvent.change(searchInput, { target: { value: 'about' } })

        // Wait for debounced search
        await waitFor(() => {
            expect(searchAllPages).toHaveBeenCalledTimes(1)
            expect(searchAllPages).toHaveBeenCalledWith('about', {})
        }, { timeout: 1000 })
    })

    test('should show loading state during search', async () => {
        // Mock a delayed response
        searchAllPages.mockImplementation(() =>
            new Promise(resolve =>
                setTimeout(() => resolve({
                    results: [],
                    query: 'about',
                    total_count: 0
                }), 100)
            )
        )

        renderTreePageManager()

        const searchInput = screen.getByPlaceholderText('Search pages...')
        fireEvent.change(searchInput, { target: { value: 'about' } })

        // Check for loading state
        await waitFor(() => {
            expect(screen.getByText('Searching pages...')).toBeInTheDocument()
        })
    })

    test('should handle search errors gracefully', async () => {
        searchAllPages.mockRejectedValue(new Error('Search failed'))

        renderTreePageManager()

        const searchInput = screen.getByPlaceholderText('Search pages...')
        fireEvent.change(searchInput, { target: { value: 'about' } })

        // Wait for error to appear
        await waitFor(() => {
            expect(screen.getAllByText('Search failed')).toHaveLength(2) // Title and message
        })

        // Check for clear search button in error state
        const clearButton = screen.getByText('Clear Search')
        expect(clearButton).toBeInTheDocument()
    })

    test('should not search for terms less than 2 characters', async () => {
        renderTreePageManager()

        const searchInput = screen.getByPlaceholderText('Search pages...')
        fireEvent.change(searchInput, { target: { value: 'a' } })

        // Wait to ensure no search is triggered
        await waitFor(() => {
            expect(searchAllPages).not.toHaveBeenCalled()
        }, { timeout: 1000 })
    })

    test('should show no results message when search returns empty', async () => {
        searchAllPages.mockResolvedValue({
            results: [],
            query: 'nonexistent',
            total_count: 0
        })

        renderTreePageManager()

        const searchInput = screen.getByPlaceholderText('Search pages...')
        fireEvent.change(searchInput, { target: { value: 'nonexistent' } })

        // Wait for search to be triggered
        await waitFor(() => {
            expect(searchAllPages).toHaveBeenCalledWith('nonexistent', {})
        }, { timeout: 1000 })

        // Check for no results message
        await waitFor(() => {
            expect(screen.getByText('No pages found matching your search')).toBeInTheDocument()
        })
    })

    test('should show clear search button when no results found', async () => {
        searchAllPages.mockResolvedValue({
            results: [],
            query: 'nonexistent',
            total_count: 0
        })

        renderTreePageManager()

        const searchInput = screen.getByPlaceholderText('Search pages...')
        fireEvent.change(searchInput, { target: { value: 'nonexistent' } })

        // Wait for search to be triggered
        await waitFor(() => {
            expect(searchAllPages).toHaveBeenCalledWith('nonexistent', {})
        }, { timeout: 1000 })

        // Wait for no results message
        await waitFor(() => {
            expect(screen.getByText('No pages found matching your search')).toBeInTheDocument()
        })

        // Check that clear search button is present
        const clearButton = screen.getByText('Clear Search')
        expect(clearButton).toBeInTheDocument()

        // Click clear button
        fireEvent.click(clearButton)

        // Check that search input is cleared
        await waitFor(() => {
            expect(searchInput.value).toBe('')
        })
    })
}) 