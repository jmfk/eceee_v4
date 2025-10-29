import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { vi, describe, it, expect, beforeEach } from 'vitest'
import userEvent from '@testing-library/user-event'
import PageTreeNode from '../PageTreeNode'
import { api } from '../../api/client'
import { NotificationProvider } from '../NotificationManager'

// Mock the API
vi.mock('../../api/client', () => ({
    api: {
        patch: vi.fn()
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
    getPageDisplayUrl: vi.fn((page) => page.slug || ''),
    isRootPage: vi.fn(() => false), // Non-root page to show slug editing
    sanitizePageData: vi.fn((page) => page)
}))

const mockPage = {
    id: 1,
    title: 'Test Page',
    slug: 'test-page',
    publicationStatus: 'published',
    childrenCount: 0,
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
            <NotificationProvider>
                {component}
            </NotificationProvider>
        </QueryClientProvider>
    )
}

describe('PageTreeNode - Inline Slug Editing', () => {
    let user

    beforeEach(() => {
        user = userEvent.setup()
        vi.clearAllMocks()
    })

    it('should display slug as clickable text for non-root pages', () => {
        renderWithProviders(
            <PageTreeNode page={mockPage} level={1} />
        )

        const slugElement = screen.getByText('test-page')
        expect(slugElement).toBeInTheDocument()
        expect(slugElement).toHaveClass('cursor-pointer')
        expect(slugElement.tagName).toBe('SPAN')
    })

    it('should enter edit mode when slug is clicked', async () => {
        renderWithProviders(
            <PageTreeNode page={mockPage} level={1} />
        )

        const slugElement = screen.getByText('test-page')
        await user.click(slugElement)

        // Should show input field with current slug
        const inputElement = screen.getByDisplayValue('test-page')
        expect(inputElement).toBeInTheDocument()
        expect(inputElement.tagName).toBe('INPUT')

        // Should show the "/" prefix
        expect(screen.getByText('/')).toBeInTheDocument()

        // Should show save and cancel buttons
        expect(screen.getByTitle('Save slug (Enter)')).toBeInTheDocument()
        expect(screen.getByTitle('Cancel (Escape)')).toBeInTheDocument()

        // Original slug span should be hidden
        expect(screen.queryByText('test-page')).not.toBeInTheDocument()
    })

    it('should cancel editing when cancel button is clicked', async () => {
        renderWithProviders(
            <PageTreeNode page={mockPage} level={1} />
        )

        // Enter edit mode
        const slugElement = screen.getByText('test-page')
        await user.click(slugElement)

        // Change the input value
        const inputElement = screen.getByDisplayValue('test-page')
        await user.clear(inputElement)
        await user.type(inputElement, 'modified-slug')

        // Click cancel
        const cancelButton = screen.getByTitle('Cancel (Escape)')
        await user.click(cancelButton)

        // Should return to original slug
        expect(screen.getByText('test-page')).toBeInTheDocument()
        expect(screen.queryByDisplayValue('modified-slug')).not.toBeInTheDocument()
    })

    it('should cancel editing when Escape key is pressed', async () => {
        renderWithProviders(
            <PageTreeNode page={mockPage} level={1} />
        )

        // Enter edit mode
        const slugElement = screen.getByText('test-page')
        await user.click(slugElement)

        // Change the input value
        const inputElement = screen.getByDisplayValue('test-page')
        await user.clear(inputElement)
        await user.type(inputElement, 'modified-slug')

        // Press Escape
        await user.keyboard('{Escape}')

        // Should return to original slug
        expect(screen.getByText('test-page')).toBeInTheDocument()
        expect(screen.queryByDisplayValue('modified-slug')).not.toBeInTheDocument()
    })

    it('should save slug when save button is clicked', async () => {
        const mockResponse = { data: { ...mockPage, slug: 'new-slug' } }
        api.patch.mockResolvedValue(mockResponse)

        renderWithProviders(
            <PageTreeNode page={mockPage} level={1} />
        )

        // Enter edit mode
        const slugElement = screen.getByText('test-page')
        await user.click(slugElement)

        // Change the input value
        const inputElement = screen.getByDisplayValue('test-page')
        await user.clear(inputElement)
        await user.type(inputElement, 'new-slug')

        // Click save
        const saveButton = screen.getByTitle('Save slug (Enter)')
        await user.click(saveButton)

        // Should call API
        expect(api.patch).toHaveBeenCalledWith('/api/v1/webpages/pages/1/', { slug: 'new-slug' })
    })

    it('should save slug when Enter key is pressed', async () => {
        const mockResponse = { data: { ...mockPage, slug: 'new-slug' } }
        api.patch.mockResolvedValue(mockResponse)

        renderWithProviders(
            <PageTreeNode page={mockPage} level={1} />
        )

        // Enter edit mode
        const slugElement = screen.getByText('test-page')
        await user.click(slugElement)

        // Change the input value and press Enter
        const inputElement = screen.getByDisplayValue('test-page')
        await user.clear(inputElement)
        await user.type(inputElement, 'new-slug{Enter}')

        // Should call API
        expect(api.patch).toHaveBeenCalledWith('/api/v1/webpages/pages/1/', { slug: 'new-slug' })
    })

    it('should not save if slug is empty', async () => {
        renderWithProviders(
            <PageTreeNode page={mockPage} level={1} />
        )

        // Enter edit mode
        const slugElement = screen.getByText('test-page')
        await user.click(slugElement)

        // Clear the input
        const inputElement = screen.getByDisplayValue('test-page')
        await user.clear(inputElement)

        // Click save
        const saveButton = screen.getByTitle('Save slug (Enter)')
        await user.click(saveButton)

        // Should not call API
        expect(api.patch).not.toHaveBeenCalled()

        // Should still be in edit mode
        expect(screen.getByDisplayValue('')).toBeInTheDocument()
    })

    it('should auto-sanitize slug and prompt for confirmation', async () => {
        renderWithProviders(
            <PageTreeNode page={mockPage} level={1} />
        )

        // Enter edit mode
        const slugElement = screen.getByText('test-page')
        await user.click(slugElement)

        // Enter invalid slug with special characters
        const inputElement = screen.getByDisplayValue('test-page')
        await user.clear(inputElement)
        await user.type(inputElement, 'Test Page With Spaces & Special!')

        // Click save
        const saveButton = screen.getByTitle('Save slug (Enter)')
        await user.click(saveButton)

        // Should not call API yet, but should update input with sanitized version
        expect(api.patch).not.toHaveBeenCalled()

        // Should show sanitized slug in input
        await waitFor(() => {
            expect(screen.getByDisplayValue('test-page-with-spaces-special')).toBeInTheDocument()
        })
    })

    it('should not save if slug is unchanged', async () => {
        renderWithProviders(
            <PageTreeNode page={mockPage} level={1} />
        )

        // Enter edit mode
        const slugElement = screen.getByText('test-page')
        await user.click(slugElement)

        // Click save without changing anything
        const saveButton = screen.getByTitle('Save slug (Enter)')
        await user.click(saveButton)

        // Should not call API
        expect(api.patch).not.toHaveBeenCalled()

        // Should exit edit mode
        expect(screen.getByText('test-page')).toBeInTheDocument()
        expect(screen.queryByDisplayValue('test-page')).not.toBeInTheDocument()
    })

    it('should handle API errors gracefully', async () => {
        const mockError = new Error('API Error')
        mockError.response = { data: { detail: 'Slug already exists' } }
        api.patch.mockRejectedValue(mockError)

        renderWithProviders(
            <PageTreeNode page={mockPage} level={1} />
        )

        // Enter edit mode
        const slugElement = screen.getByText('test-page')
        await user.click(slugElement)

        // Change the input value
        const inputElement = screen.getByDisplayValue('test-page')
        await user.clear(inputElement)
        await user.type(inputElement, 'existing-slug')

        // Click save
        const saveButton = screen.getByTitle('Save slug (Enter)')
        await user.click(saveButton)

        // Should call API
        expect(api.patch).toHaveBeenCalledWith('/api/v1/webpages/pages/1/', { slug: 'existing-slug' })

        // Should stay in edit mode on error and revert to original slug
        await waitFor(() => {
            expect(screen.getByDisplayValue('test-page')).toBeInTheDocument()
        })
    })

    it('should disable input and buttons while saving', async () => {
        // Mock a slow API response
        api.patch.mockImplementation(() => new Promise(resolve => setTimeout(resolve, 100)))

        renderWithProviders(
            <PageTreeNode page={mockPage} level={1} />
        )

        // Enter edit mode
        const slugElement = screen.getByText('test-page')
        await user.click(slugElement)

        // Change the input value
        const inputElement = screen.getByDisplayValue('test-page')
        await user.clear(inputElement)
        await user.type(inputElement, 'new-slug')

        // Click save
        const saveButton = screen.getByTitle('Save slug (Enter)')
        await user.click(saveButton)

        // Should disable input and buttons while saving
        expect(inputElement).toBeDisabled()
        expect(saveButton).toBeDisabled()
        expect(screen.getByTitle('Cancel (Escape)')).toBeDisabled()
    })

    it('should properly sanitize various slug formats', async () => {
        const testCases = [
            { input: 'Test Page', expected: 'test-page' },
            { input: 'Multiple   Spaces', expected: 'multiple-spaces' },
            { input: 'Special!@#$%^&*()Characters', expected: 'specialcharacters' },
            { input: 'numbers-123-test', expected: 'numbers-123-test' },
            { input: 'UPPERCASE-text', expected: 'uppercase-text' },
            { input: '---multiple---dashes---', expected: 'multiple-dashes' },
        ]

        for (const testCase of testCases) {
            // Create a fresh render for each test case
            const { unmount } = renderWithProviders(
                <PageTreeNode page={mockPage} level={1} />
            )

            // Enter edit mode
            const slugElement = screen.getByText('/test-page')
            await user.click(slugElement)

            // Enter test input
            const inputElement = screen.getByDisplayValue('test-page')
            await user.clear(inputElement)
            await user.type(inputElement, testCase.input)

            // Click save
            const saveButton = screen.getByTitle('Save slug (Enter)')
            await user.click(saveButton)

            // Should sanitize to expected format
            await waitFor(() => {
                expect(screen.getByDisplayValue(testCase.expected)).toBeInTheDocument()
            })

            // Cleanup for next iteration
            unmount()
            vi.clearAllMocks()
        }
    })
}) 