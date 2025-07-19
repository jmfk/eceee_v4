import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import axios from 'axios'
import LayoutEditor from '../LayoutEditor'

// Mock axios
vi.mock('axios', () => ({
    default: {
        get: vi.fn(),
        post: vi.fn(),
        put: vi.fn(),
        delete: vi.fn(),
    }
}))

// Mock react-hot-toast
vi.mock('react-hot-toast', () => ({
    default: {
        success: vi.fn(),
        error: vi.fn(),
    }
}))

// Type the mocked axios
const mockedAxios = vi.mocked(axios)

const mockLayoutsData = {
    results: [
        {
            name: 'two_column',
            description: 'A layout with two columns',
            type: 'code',
            slot_configuration: {
                slots: [
                    {
                        name: 'main',
                        display_name: 'Main Content',
                        description: 'Primary content area',
                        css_classes: 'col-span-2',
                        allows_multiple: true
                    },
                    {
                        name: 'sidebar',
                        display_name: 'Sidebar',
                        description: 'Secondary content area',
                        css_classes: 'col-span-1',
                        allows_multiple: false
                    }
                ]
            },
            template_name: 'layouts/two_column.html',
            created_at: '2024-01-01T00:00:00Z'
        }
    ],
    summary: {
        active_layouts: 1,
        total_layouts: 1
    }
}

const createTestQueryClient = () => {
    return new QueryClient({
        defaultOptions: {
            queries: {
                retry: false,
            },
        },
    })
}

const renderWithQueryClient = (component) => {
    const queryClient = createTestQueryClient()
    return render(
        <QueryClientProvider client={queryClient}>
            {component}
        </QueryClientProvider>
    )
}

describe('LayoutEditor', () => {
    beforeEach(() => {
        vi.clearAllMocks()

        // Mock successful API responses - LayoutEditor expects code layouts response
        mockedAxios.get.mockResolvedValue({ data: mockLayoutsData })
        mockedAxios.post.mockResolvedValue({ data: {} })
        mockedAxios.put.mockResolvedValue({ data: {} })
        mockedAxios.delete.mockResolvedValue({ data: {} })
    })

    it('renders the layout editor interface', async () => {
        renderWithQueryClient(<LayoutEditor />)

        expect(screen.getByText('Layout Editor')).toBeInTheDocument()
        expect(screen.getByText('Create and manage page layout templates with defined slots')).toBeInTheDocument()
        expect(screen.getByText('New Layout')).toBeInTheDocument()

        // Wait for layouts to load
        await waitFor(() => {
            expect(screen.getByText('Available Layouts')).toBeInTheDocument()
        })
    })

    it('displays list of layouts', async () => {
        renderWithQueryClient(<LayoutEditor />)

        await waitFor(() => {
            expect(screen.getByText('two_column')).toBeInTheDocument()
            expect(screen.getByText('2 slots')).toBeInTheDocument()
        })
    })

    it('shows active status indicators', async () => {
        renderWithQueryClient(<LayoutEditor />)

        await waitFor(() => {
            const activeElements = screen.getAllByText('Active')
            expect(activeElements).toHaveLength(2) // Both layouts are active
        })
    })

    it('opens layout creation form when New Layout is clicked', async () => {
        const user = userEvent.setup()
        renderWithQueryClient(<LayoutEditor />)

        const newLayoutButton = screen.getByText('New Layout')
        await user.click(newLayoutButton)

        expect(screen.getByText('Create New Layout')).toBeInTheDocument()
        expect(screen.getByLabelText('Layout Name')).toBeInTheDocument()
        expect(screen.getByLabelText('Description')).toBeInTheDocument()
        expect(screen.getByText('Layout Slots')).toBeInTheDocument()
    })

    it('allows selecting a layout for editing', async () => {
        const user = userEvent.setup()
        renderWithQueryClient(<LayoutEditor />)

        await waitFor(() => {
            expect(screen.getByText('Two Column Layout')).toBeInTheDocument()
        })

        const layoutItem = screen.getByText('Two Column Layout').closest('div')
        await user.click(layoutItem)

        expect(screen.getByText('Edit')).toBeInTheDocument()
        expect(screen.getByText('Delete')).toBeInTheDocument()
    })

    it('can add new slots to a layout', async () => {
        const user = userEvent.setup()
        renderWithQueryClient(<LayoutEditor />)

        // Open creation form
        const newLayoutButton = screen.getByText('New Layout')
        await user.click(newLayoutButton)

        // Add a slot
        const addSlotButton = screen.getByText('Add Slot')
        await user.click(addSlotButton)

        expect(screen.getByText('Slot 1')).toBeInTheDocument()
        expect(screen.getByLabelText('Slot Name (Technical)')).toBeInTheDocument()
        expect(screen.getByLabelText('Display Name')).toBeInTheDocument()
    })

    it('validates required fields when creating layout', async () => {
        const user = userEvent.setup()
        renderWithQueryClient(<LayoutEditor />)

        // Open creation form
        const newLayoutButton = screen.getByText('New Layout')
        await user.click(newLayoutButton)

        // Try to submit without required fields
        const createButton = screen.getByText('Create Layout')
        await user.click(createButton)

        // Form should not submit (name is required)
        const nameInput = screen.getByLabelText('Layout Name')
        expect(nameInput).toBeInvalid()
    })

    it('can remove slots from a layout', async () => {
        const user = userEvent.setup()
        renderWithQueryClient(<LayoutEditor />)

        // Open creation form and add a slot
        const newLayoutButton = screen.getByText('New Layout')
        await user.click(newLayoutButton)

        const addSlotButton = screen.getByText('Add Slot')
        await user.click(addSlotButton)

        expect(screen.getByText('Slot 1')).toBeInTheDocument()

        // Remove the slot
        const removeButton = screen.getByRole('button', { name: /remove/i })
        await user.click(removeButton)

        expect(screen.queryByText('Slot 1')).not.toBeInTheDocument()
    })

    it('submits layout creation form', async () => {
        const user = userEvent.setup()

        renderWithQueryClient(<LayoutEditor />)

        // Open creation form
        const newLayoutButton = screen.getByText('New Layout')
        await user.click(newLayoutButton)

        // Fill form
        const nameInput = screen.getByLabelText('Layout Name')
        await user.type(nameInput, 'Test Layout')

        const descriptionInput = screen.getByLabelText('Description')
        await user.type(descriptionInput, 'A test layout')

        // Add a slot
        const addSlotButton = screen.getByText('Add Slot')
        await user.click(addSlotButton)

        // Submit form
        const createButton = screen.getByText('Create Layout')
        await user.click(createButton)

        await waitFor(() => {
            expect(mockedAxios.post).toHaveBeenCalledWith(
                '/api/v1/webpages/layouts/',
                expect.objectContaining({
                    name: 'Test Layout',
                    description: 'A test layout',
                    slot_configuration: expect.objectContaining({
                        slots: expect.arrayContaining([
                            expect.objectContaining({
                                name: 'slot_1'
                            })
                        ])
                    })
                })
            )
        })
    })

    it('handles layout deletion', async () => {
        const user = userEvent.setup()

        // Mock window.confirm
        window.confirm = vi.fn(() => true)

        renderWithQueryClient(<LayoutEditor />)

        // Select a layout
        await waitFor(() => {
            expect(screen.getByText('Two Column Layout')).toBeInTheDocument()
        })

        const layoutItem = screen.getByText('Two Column Layout').closest('div')
        await user.click(layoutItem)

        // Click delete
        const deleteButton = screen.getByText('Delete')
        await user.click(deleteButton)

        expect(window.confirm).toHaveBeenCalledWith(
            'Are you sure you want to delete this layout? This action cannot be undone.'
        )

        await waitFor(() => {
            expect(mockedAxios.delete).toHaveBeenCalledWith('/api/v1/webpages/layouts/1/')
        })
    })

    it('shows layout preview when requested', async () => {
        const user = userEvent.setup()
        renderWithQueryClient(<LayoutEditor />)

        // Select a layout
        await waitFor(() => {
            expect(screen.getByText('Two Column Layout')).toBeInTheDocument()
        })

        const layoutItem = screen.getByText('Two Column Layout').closest('div')
        await user.click(layoutItem)

        // Show preview
        const previewButton = screen.getByText('Show Preview')
        await user.click(previewButton)

        expect(screen.getByText('Layout Preview')).toBeInTheDocument()
        expect(screen.getByText('Layout: Two Column Layout')).toBeInTheDocument()
    })

    it('displays slot configuration correctly', async () => {
        renderWithQueryClient(<LayoutEditor />)

        // Select a layout
        await waitFor(() => {
            expect(screen.getByText('Two Column Layout')).toBeInTheDocument()
        })

        const layoutItem = screen.getByText('Two Column Layout').closest('div')
        await userEvent.setup().click(layoutItem)

        // Check slot details
        expect(screen.getByText('Main Content')).toBeInTheDocument()
        expect(screen.getByText('Sidebar')).toBeInTheDocument()
        expect(screen.getByText('Multiple widgets allowed')).toBeInTheDocument()
        expect(screen.getByText('Single widget only')).toBeInTheDocument()
    })

    it('handles API errors gracefully', async () => {
        const toast = require('react-hot-toast').default

        // Mock API error
        mockedAxios.get.mockRejectedValue(new Error('API Error'))

        renderWithQueryClient(<LayoutEditor />)

        // Component should still render without crashing
        expect(screen.getByText('Layout Editor')).toBeInTheDocument()
    })

    it('shows loading state while fetching layouts', async () => {
        // Mock delayed response with paginated format
        mockedAxios.get.mockImplementation(() =>
            new Promise(resolve => setTimeout(() => resolve({
                data: {
                    count: mockLayouts.length,
                    next: null,
                    previous: null,
                    results: mockLayouts
                }
            }), 100))
        )

        renderWithQueryClient(<LayoutEditor />)

        // Should show loading animation
        expect(screen.getByText('Select a Layout to Edit')).toBeInTheDocument()

        await waitFor(() => {
            expect(screen.getByText('Two Column Layout')).toBeInTheDocument()
        }, { timeout: 200 })
    })
}) 