import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { vi, describe, it, expect, beforeEach } from 'vitest'
import WidgetIconMenu from '../WidgetIconMenu'
import { api } from '../../api/client'

// Mock the API
vi.mock('../../api/client', () => ({
    api: {
        get: vi.fn()
    }
}))

// Mock Lucide React icons
vi.mock('lucide-react', () => ({
    Plus: ({ className, ...props }) => <svg data-testid="plus-icon" className={className} {...props} />,
    Type: ({ className, ...props }) => <svg data-testid="type-icon" className={className} {...props} />,
    Image: ({ className, ...props }) => <svg data-testid="image-icon" className={className} {...props} />,
    MousePointer: ({ className, ...props }) => <svg data-testid="mousepointer-icon" className={className} {...props} />,
    Space: ({ className, ...props }) => <svg data-testid="space-icon" className={className} {...props} />,
    Code: ({ className, ...props }) => <svg data-testid="code-icon" className={className} {...props} />,
    Grid3X3: ({ className, ...props }) => <svg data-testid="grid-icon" className={className} {...props} />,
    Newspaper: ({ className, ...props }) => <svg data-testid="newspaper-icon" className={className} {...props} />,
    Calendar: ({ className, ...props }) => <svg data-testid="calendar-icon" className={className} {...props} />,
    FileText: ({ className, ...props }) => <svg data-testid="filetext-icon" className={className} {...props} />,
    ImageIcon: ({ className, ...props }) => <svg data-testid="imageicon-icon" className={className} {...props} />,
    Loader2: ({ className, ...props }) => <svg data-testid="loader-icon" className={className} {...props} />,
    ChevronDown: ({ className, ...props }) => <svg data-testid="chevron-icon" className={className} {...props} />,
    Users: ({ className, ...props }) => <svg data-testid="users-icon" className={className} {...props} />
}))

const renderWithQueryClient = (component) => {
    const queryClient = new QueryClient({
        defaultOptions: {
            queries: {
                retry: false,
            },
        },
    })

    return render(
        <QueryClientProvider client={queryClient}>
            {component}
        </QueryClientProvider>
    )
}

const mockWidgetTypes = [
    { name: 'Text Block', description: 'Add formatted text content', isActive: true },
    { name: 'Image', description: 'Display images with captions', isActive: true },
    { name: 'Button', description: 'Interactive clickable buttons', isActive: true },
    { name: 'HTML Block', description: 'Custom HTML content', isActive: true }
]

describe('WidgetIconMenu', () => {
    beforeEach(() => {
        api.get.mockClear()
    })

    it('renders icon button correctly', async () => {
        api.get.mockResolvedValueOnce({ data: mockWidgetTypes })
        const mockOnSelectWidget = vi.fn()

        renderWithQueryClient(
            <WidgetIconMenu onSelectWidget={mockOnSelectWidget} />
        )

        // Wait for the API response to complete
        await waitFor(() => {
            expect(screen.getByTestId('plus-icon')).toBeInTheDocument()
        })
        expect(screen.getByTitle('Add widget')).toBeInTheDocument()
    })

    it('opens dropdown menu when icon is clicked', async () => {
        api.get.mockResolvedValueOnce({ data: mockWidgetTypes })
        const mockOnSelectWidget = vi.fn()

        renderWithQueryClient(
            <WidgetIconMenu onSelectWidget={mockOnSelectWidget} />
        )

        const button = screen.getByTitle('Add widget')
        fireEvent.click(button)

        await waitFor(() => {
            expect(screen.getByText('Add Widget')).toBeInTheDocument()
        })
    })

    it('displays available widget types in dropdown', async () => {
        api.get.mockResolvedValueOnce({ data: mockWidgetTypes })
        const mockOnSelectWidget = vi.fn()

        renderWithQueryClient(
            <WidgetIconMenu onSelectWidget={mockOnSelectWidget} />
        )

        const button = screen.getByTitle('Add widget')
        fireEvent.click(button)

        await waitFor(() => {
            expect(screen.getByText('Text Block')).toBeInTheDocument()
            expect(screen.getByText('Image')).toBeInTheDocument()
            expect(screen.getByText('Button')).toBeInTheDocument()
            expect(screen.getByText('HTML Block')).toBeInTheDocument()
        })
    })

    it('calls onSelectWidget when a widget is clicked', async () => {
        api.get.mockResolvedValueOnce({ data: mockWidgetTypes })
        const mockOnSelectWidget = vi.fn()

        renderWithQueryClient(
            <WidgetIconMenu onSelectWidget={mockOnSelectWidget} />
        )

        const button = screen.getByTitle('Add widget')
        fireEvent.click(button)

        await waitFor(() => {
            const textBlockButton = screen.getByText('Text Block')
            fireEvent.click(textBlockButton)
        })

        expect(mockOnSelectWidget).toHaveBeenCalledWith(mockWidgetTypes[0])
    })

    it('closes dropdown after selecting a widget', async () => {
        api.get.mockResolvedValueOnce({ data: mockWidgetTypes })
        const mockOnSelectWidget = vi.fn()

        renderWithQueryClient(
            <WidgetIconMenu onSelectWidget={mockOnSelectWidget} />
        )

        const button = screen.getByTitle('Add widget')
        fireEvent.click(button)

        await waitFor(() => {
            const textBlockButton = screen.getByText('Text Block')
            fireEvent.click(textBlockButton)
        })

        await waitFor(() => {
            expect(screen.queryByText('Add Widget')).not.toBeInTheDocument()
        })
    })

    it('filters widgets based on slot allowed types', async () => {
        api.get.mockResolvedValueOnce({ data: mockWidgetTypes })
        const mockOnSelectWidget = vi.fn()
        const restrictedSlot = {
            name: 'restricted_slot',
            allowedWidgetTypes: ['Text Block', 'Image']
        }

        renderWithQueryClient(
            <WidgetIconMenu
                onSelectWidget={mockOnSelectWidget}
                slot={restrictedSlot}
            />
        )

        const button = screen.getByTitle('Add widget')
        fireEvent.click(button)

        await waitFor(() => {
            expect(screen.getByText('Text Block')).toBeInTheDocument()
            expect(screen.getByText('Image')).toBeInTheDocument()
            expect(screen.queryByText('Button')).not.toBeInTheDocument()
            expect(screen.queryByText('HTML Block')).not.toBeInTheDocument()
        })
    })

    it('shows disabled state when maxWidgetsReached is true', async () => {
        api.get.mockResolvedValueOnce({ data: mockWidgetTypes })
        const mockOnSelectWidget = vi.fn()

        renderWithQueryClient(
            <WidgetIconMenu
                onSelectWidget={mockOnSelectWidget}
                maxWidgetsReached={true}
            />
        )

        const button = screen.getByTitle('Maximum widgets reached')
        expect(button).toBeDisabled()
    })

    it('shows loading state while fetching widget types', async () => {
        api.get.mockImplementation(() => new Promise(() => { })) // Never resolves
        const mockOnSelectWidget = vi.fn()

        renderWithQueryClient(
            <WidgetIconMenu onSelectWidget={mockOnSelectWidget} />
        )

        expect(screen.getByTestId('loader-icon')).toBeInTheDocument()
    })

    it('displays slot name in dropdown header when slot is provided', async () => {
        api.get.mockResolvedValueOnce({ data: mockWidgetTypes })
        const mockOnSelectWidget = vi.fn()
        const slot = {
            name: 'main_content',
            display_name: 'Main Content Area'
        }

        renderWithQueryClient(
            <WidgetIconMenu
                onSelectWidget={mockOnSelectWidget}
                slot={slot}
            />
        )

        const button = screen.getByTitle('Add widget')
        fireEvent.click(button)

        await waitFor(() => {
            expect(screen.getByText('to Main Content Area')).toBeInTheDocument()
        })
    })

    it('shows no widgets available message when filtered list is empty', async () => {
        api.get.mockResolvedValueOnce({ data: mockWidgetTypes })
        const mockOnSelectWidget = vi.fn()
        const restrictedSlot = {
            name: 'very_restricted_slot',
            allowedWidgetTypes: ['NonExistentWidget']
        }

        renderWithQueryClient(
            <WidgetIconMenu
                onSelectWidget={mockOnSelectWidget}
                slot={restrictedSlot}
            />
        )

        const button = screen.getByTitle('Add widget')
        fireEvent.click(button)

        await waitFor(() => {
            expect(screen.getByText('No widgets available')).toBeInTheDocument()
            expect(screen.getByText('This slot only accepts: NonExistentWidget')).toBeInTheDocument()
        })
    })

    it('closes dropdown when clicking outside', async () => {
        api.get.mockResolvedValueOnce({ data: mockWidgetTypes })
        const mockOnSelectWidget = vi.fn()

        renderWithQueryClient(
            <div>
                <WidgetIconMenu onSelectWidget={mockOnSelectWidget} />
                <div data-testid="outside-element">Outside</div>
            </div>
        )

        const button = screen.getByTitle('Add widget')
        fireEvent.click(button)

        await waitFor(() => {
            expect(screen.getByText('Add Widget')).toBeInTheDocument()
        })

        fireEvent.mouseDown(screen.getByTestId('outside-element'))

        await waitFor(() => {
            expect(screen.queryByText('Add Widget')).not.toBeInTheDocument()
        })
    })

    it('closes dropdown when Escape key is pressed', async () => {
        api.get.mockResolvedValueOnce({ data: mockWidgetTypes })
        const mockOnSelectWidget = vi.fn()

        renderWithQueryClient(
            <WidgetIconMenu onSelectWidget={mockOnSelectWidget} />
        )

        const button = screen.getByTitle('Add widget')
        fireEvent.click(button)

        await waitFor(() => {
            expect(screen.getByText('Add Widget')).toBeInTheDocument()
        })

        fireEvent.keyDown(document, { key: 'Escape', code: 'Escape' })

        await waitFor(() => {
            expect(screen.queryByText('Add Widget')).not.toBeInTheDocument()
        })
    })

    it('shows widget count in footer', async () => {
        api.get.mockResolvedValueOnce({ data: mockWidgetTypes })
        const mockOnSelectWidget = vi.fn()

        renderWithQueryClient(
            <WidgetIconMenu onSelectWidget={mockOnSelectWidget} />
        )

        const button = screen.getByTitle('Add widget')
        fireEvent.click(button)

        await waitFor(() => {
            expect(screen.getByText('4 widgets available')).toBeInTheDocument()
        })
    })

    it('displays appropriate icons for different widget types', async () => {
        api.get.mockResolvedValueOnce({ data: mockWidgetTypes })
        const mockOnSelectWidget = vi.fn()

        renderWithQueryClient(
            <WidgetIconMenu onSelectWidget={mockOnSelectWidget} />
        )

        const button = screen.getByTitle('Add widget')
        fireEvent.click(button)

        await waitFor(() => {
            expect(screen.getByTestId('type-icon')).toBeInTheDocument() // Text Block
            expect(screen.getByTestId('image-icon')).toBeInTheDocument() // Image
            expect(screen.getByTestId('mousepointer-icon')).toBeInTheDocument() // Button
            expect(screen.getByTestId('code-icon')).toBeInTheDocument() // HTML Block
        })
    })

    it('handles API errors gracefully', async () => {
        api.get.mockRejectedValueOnce(new Error('Failed to fetch widgets'))
        const mockOnSelectWidget = vi.fn()

        renderWithQueryClient(
            <WidgetIconMenu onSelectWidget={mockOnSelectWidget} />
        )

        const button = screen.getByTitle('Add widget')
        fireEvent.click(button)

        await waitFor(() => {
            expect(screen.getByText('Error loading widgets')).toBeInTheDocument()
            expect(screen.getByText('Failed to fetch widgets')).toBeInTheDocument()
        })
    })
}) 