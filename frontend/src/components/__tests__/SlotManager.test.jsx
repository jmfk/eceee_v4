import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import userEvent from '@testing-library/user-event'
import axios from 'axios'
import SlotManager from '../SlotManager'

// Mock axios
vi.mock('axios')
const mockedAxios = axios

// Mock the child components
vi.mock('../WidgetLibrary', () => ({
    default: ({ onSelectWidget }) => (
        <div data-testid="widget-library">
            <button onClick={() => onSelectWidget({ id: 1, name: 'Text Block' })}>
                Select Text Block
            </button>
        </div>
    ),
}))

vi.mock('../WidgetConfigurator', () => ({
    default: ({ widgetType, onSave, onCancel }) => (
        <div data-testid="widget-configurator">
            <h3>Configure {widgetType?.name}</h3>
            <button onClick={() => onSave({ content: 'Test content' })}>Save Config</button>
            <button onClick={onCancel}>Cancel Config</button>
        </div>
    ),
}))

const mockLayout = {
    id: 1,
    name: 'Test Layout',
    description: 'A test layout',
    slot_configuration: {
        slots: [
            {
                name: 'header',
                display_name: 'Header',
                description: 'Header slot for banners and navigation',
            },
            {
                name: 'content',
                display_name: 'Main Content',
                description: 'Primary content area',
            },
            {
                name: 'sidebar',
                display_name: 'Sidebar',
                description: 'Side content area',
            },
        ],
    },
}

const mockPageWidgets = [
    {
        widget: {
            id: 1,
            widget_type: { id: 1, name: 'Text Block', description: 'Text widget' },
            slot_name: 'header',
            sort_order: 0,
            configuration: { content: 'Header content' },
        },
        inherited_from: null,
    },
    {
        widget: {
            id: 2,
            widget_type: { id: 2, name: 'Image', description: 'Image widget' },
            slot_name: 'content',
            sort_order: 0,
            configuration: { url: 'test.jpg' },
        },
        inherited_from: 5, // Inherited from page 5
    },
]

const mockWidgetTypes = [
    { id: 1, name: 'Text Block', description: 'Text widget', is_active: true },
    { id: 2, name: 'Image', description: 'Image widget', is_active: true },
    { id: 3, name: 'Button', description: 'Button widget', is_active: true },
]

const renderWithQueryClient = (component, queryClient = new QueryClient({
    defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false },
    },
})) => {
    return render(
        <QueryClientProvider client={queryClient}>
            {component}
        </QueryClientProvider>
    )
}

describe('SlotManager', () => {
    const mockOnWidgetChange = vi.fn()

    beforeEach(() => {
        vi.clearAllMocks()
        mockedAxios.get.mockImplementation((url) => {
            if (url.includes('by_page')) {
                return Promise.resolve({ data: { widgets: mockPageWidgets } })
            }
            if (url.includes('widget-types')) {
                return Promise.resolve({ data: mockWidgetTypes })
            }
            return Promise.resolve({ data: [] })
        })
        mockedAxios.post.mockResolvedValue({ data: {} })
        mockedAxios.patch.mockResolvedValue({ data: {} })
        mockedAxios.delete.mockResolvedValue({ data: {} })
    })

    it('renders layout information', async () => {
        renderWithQueryClient(
            <SlotManager pageId={1} layout={mockLayout} onWidgetChange={mockOnWidgetChange} />
        )

        expect(screen.getByText('Widget Management')).toBeInTheDocument()
        expect(screen.getByText(/Layout: Test Layout/)).toBeInTheDocument()
    })

    it('renders all layout slots', async () => {
        renderWithQueryClient(
            <SlotManager pageId={1} layout={mockLayout} onWidgetChange={mockOnWidgetChange} />
        )

        await waitFor(() => {
            expect(screen.getByText('Header')).toBeInTheDocument()
        })

        expect(screen.getByText('Main Content')).toBeInTheDocument()
        expect(screen.getByText('Sidebar')).toBeInTheDocument()
    })

    it('shows slot descriptions', async () => {
        renderWithQueryClient(
            <SlotManager pageId={1} layout={mockLayout} onWidgetChange={mockOnWidgetChange} />
        )

        await waitFor(() => {
            expect(screen.getByText('Header slot for banners and navigation')).toBeInTheDocument()
        })

        expect(screen.getByText('Primary content area')).toBeInTheDocument()
        expect(screen.getByText('Side content area')).toBeInTheDocument()
    })

    it('displays widgets in correct slots', async () => {
        renderWithQueryClient(
            <SlotManager pageId={1} layout={mockLayout} onWidgetChange={mockOnWidgetChange} />
        )

        await waitFor(() => {
            // Header slot should have Text Block widget
            expect(screen.getByText('Text Block')).toBeInTheDocument()

            // Content slot should have Image widget
            expect(screen.getByText('Image')).toBeInTheDocument()
        })
    })

    it('shows inherited widget indicators', async () => {
        renderWithQueryClient(
            <SlotManager pageId={1} layout={mockLayout} onWidgetChange={mockOnWidgetChange} />
        )

        await waitFor(() => {
            // Image widget is inherited
            expect(screen.getByText('Inherited')).toBeInTheDocument()
        })
    })

    it('opens widget library when Add Widget is clicked', async () => {
        const user = userEvent.setup()
        renderWithQueryClient(
            <SlotManager pageId={1} layout={mockLayout} onWidgetChange={mockOnWidgetChange} />
        )

        await waitFor(() => {
            expect(screen.getByText('Header')).toBeInTheDocument()
        })

        const addWidgetButtons = screen.getAllByText('Add Widget')
        await user.click(addWidgetButtons[0])

        expect(screen.getByTestId('widget-library')).toBeInTheDocument()
    })

    it('opens widget configurator when widget is selected from library', async () => {
        const user = userEvent.setup()
        renderWithQueryClient(
            <SlotManager pageId={1} layout={mockLayout} onWidgetChange={mockOnWidgetChange} />
        )

        await waitFor(() => {
            expect(screen.getByText('Header')).toBeInTheDocument()
        })

        // Click Add Widget
        const addWidgetButtons = screen.getAllByText('Add Widget')
        await user.click(addWidgetButtons[0])

        // Select widget from library
        const selectButton = screen.getByText('Select Text Block')
        await user.click(selectButton)

        expect(screen.getByTestId('widget-configurator')).toBeInTheDocument()
        expect(screen.getByText('Configure Text Block')).toBeInTheDocument()
    })

    it('creates widget when configuration is saved', async () => {
        const user = userEvent.setup()
        renderWithQueryClient(
            <SlotManager pageId={1} layout={mockLayout} onWidgetChange={mockOnWidgetChange} />
        )

        await waitFor(() => {
            expect(screen.getByText('Header')).toBeInTheDocument()
        })

        // Open widget library and select widget
        const addWidgetButtons = screen.getAllByText('Add Widget')
        await user.click(addWidgetButtons[0])
        await user.click(screen.getByText('Select Text Block'))

        // Save configuration
        await user.click(screen.getByText('Save Config'))

        expect(mockedAxios.post).toHaveBeenCalledWith('/api/webpages/api/widgets/', {
            page: 1,
            widget_type_id: 1,
            slot_name: 'header',
            configuration: { content: 'Test content' },
            sort_order: expect.any(Number),
        })
    })

    it('opens edit modal when edit button is clicked', async () => {
        const user = userEvent.setup()
        renderWithQueryClient(
            <SlotManager pageId={1} layout={mockLayout} onWidgetChange={mockOnWidgetChange} />
        )

        await waitFor(() => {
            expect(screen.getByText('Text Block')).toBeInTheDocument()
        })

        // Click edit button for Text Block widget
        const editButtons = screen.getAllByTitle('Edit widget')
        await user.click(editButtons[0])

        expect(screen.getByTestId('widget-configurator')).toBeInTheDocument()
    })

    it('updates widget when edit is saved', async () => {
        const user = userEvent.setup()
        renderWithQueryClient(
            <SlotManager pageId={1} layout={mockLayout} onWidgetChange={mockOnWidgetChange} />
        )

        await waitFor(() => {
            expect(screen.getByText('Text Block')).toBeInTheDocument()
        })

        // Click edit and save
        const editButtons = screen.getAllByTitle('Edit widget')
        await user.click(editButtons[0])
        await user.click(screen.getByText('Save Config'))

        expect(mockedAxios.patch).toHaveBeenCalledWith('/api/webpages/api/widgets/1/', {
            configuration: { content: 'Test content' },
        })
    })

    it('deletes widget when delete button is clicked', async () => {
        const user = userEvent.setup()

        // Mock window.confirm
        const confirmSpy = vi.spyOn(window, 'confirm').mockImplementation(() => true)

        renderWithQueryClient(
            <SlotManager pageId={1} layout={mockLayout} onWidgetChange={mockOnWidgetChange} />
        )

        await waitFor(() => {
            expect(screen.getByText('Text Block')).toBeInTheDocument()
        })

        // Click delete button for Text Block widget (not inherited)
        const deleteButtons = screen.getAllByTitle('Delete widget')
        await user.click(deleteButtons[0])

        expect(confirmSpy).toHaveBeenCalledWith(
            'Are you sure you want to delete this widget?'
        )
        expect(mockedAxios.delete).toHaveBeenCalledWith('/api/webpages/api/widgets/1/')

        confirmSpy.mockRestore()
    })

    it('does not show delete button for inherited widgets', async () => {
        renderWithQueryClient(
            <SlotManager pageId={1} layout={mockLayout} onWidgetChange={mockOnWidgetChange} />
        )

        await waitFor(() => {
            expect(screen.getByText('Image')).toBeInTheDocument()
        })

        // Image widget is inherited, should not have delete button
        const imageWidget = screen.getByText('Image').closest('[class*="border"]')
        const deleteButton = imageWidget?.querySelector('[title="Delete widget"]')
        expect(deleteButton).toBeNull()
    })

    it('reorders widgets when move buttons are clicked', async () => {
        const user = userEvent.setup()
        renderWithQueryClient(
            <SlotManager pageId={1} layout={mockLayout} onWidgetChange={mockOnWidgetChange} />
        )

        await waitFor(() => {
            expect(screen.getByText('Text Block')).toBeInTheDocument()
        })

        // Click move up button
        const moveUpButtons = screen.getAllByTitle('Move up')
        if (moveUpButtons.length > 0) {
            await user.click(moveUpButtons[0])

            expect(mockedAxios.post).toHaveBeenCalledWith('/api/webpages/api/widgets/1/reorder/', {
                sort_order: expect.any(Number),
            })
        }
    })

    it('does not show move buttons for inherited widgets', async () => {
        renderWithQueryClient(
            <SlotManager pageId={1} layout={mockLayout} onWidgetChange={mockOnWidgetChange} />
        )

        await waitFor(() => {
            expect(screen.getByText('Image')).toBeInTheDocument()
        })

        // Image widget is inherited, should not have move buttons
        const imageWidget = screen.getByText('Image').closest('[class*="border"]')
        const moveUpButton = imageWidget?.querySelector('[title="Move up"]')
        const moveDownButton = imageWidget?.querySelector('[title="Move down"]')
        expect(moveUpButton).toBeNull()
        expect(moveDownButton).toBeNull()
    })

    it('shows empty state for slots with no widgets', async () => {
        renderWithQueryClient(
            <SlotManager pageId={1} layout={mockLayout} onWidgetChange={mockOnWidgetChange} />
        )

        await waitFor(() => {
            expect(screen.getByText('Sidebar')).toBeInTheDocument()
        })

        // Sidebar slot should show empty state
        const sidebarSection = screen.getByText('Sidebar').closest('[class*="bg-white"]')
        expect(sidebarSection).toHaveTextContent('No widgets in this slot')
    })

    it('handles no layout gracefully', () => {
        renderWithQueryClient(
            <SlotManager pageId={1} layout={null} onWidgetChange={mockOnWidgetChange} />
        )

        expect(screen.getByText('No layout selected. Please select a layout to manage widgets.')).toBeInTheDocument()
    })

    it('handles layout with no slots', () => {
        const emptyLayout = {
            id: 2,
            name: 'Empty Layout',
            slot_configuration: { slots: [] },
        }

        renderWithQueryClient(
            <SlotManager pageId={1} layout={emptyLayout} onWidgetChange={mockOnWidgetChange} />
        )

        expect(screen.getByText('This layout has no slots defined.')).toBeInTheDocument()
    })

    it('shows loading state while fetching widgets', () => {
        // Mock a delayed response
        mockedAxios.get.mockImplementation(() =>
            new Promise(resolve => setTimeout(() => resolve({ data: { widgets: [] } }), 100))
        )

        renderWithQueryClient(
            <SlotManager pageId={1} layout={mockLayout} onWidgetChange={mockOnWidgetChange} />
        )

        // Should show loading skeleton
        expect(screen.getByRole('generic')).toBeInTheDocument()
    })

    it('closes modals when cancel is clicked', async () => {
        const user = userEvent.setup()
        renderWithQueryClient(
            <SlotManager pageId={1} layout={mockLayout} onWidgetChange={mockOnWidgetChange} />
        )

        await waitFor(() => {
            expect(screen.getByText('Header')).toBeInTheDocument()
        })

        // Open widget library
        const addWidgetButtons = screen.getAllByText('Add Widget')
        await user.click(addWidgetButtons[0])

        // Cancel library
        const cancelButton = screen.getByText('Cancel')
        await user.click(cancelButton)

        expect(screen.queryByTestId('widget-library')).not.toBeInTheDocument()
    })

    it('calls onWidgetChange when widgets are modified', async () => {
        const user = userEvent.setup()
        renderWithQueryClient(
            <SlotManager pageId={1} layout={mockLayout} onWidgetChange={mockOnWidgetChange} />
        )

        await waitFor(() => {
            expect(screen.getByText('Header')).toBeInTheDocument()
        })

        // Add a widget
        const addWidgetButtons = screen.getAllByText('Add Widget')
        await user.click(addWidgetButtons[0])
        await user.click(screen.getByText('Select Text Block'))
        await user.click(screen.getByText('Save Config'))

        await waitFor(() => {
            expect(mockOnWidgetChange).toHaveBeenCalled()
        })
    })

    it('makes correct API calls for fetching data', async () => {
        renderWithQueryClient(
            <SlotManager pageId={1} layout={mockLayout} onWidgetChange={mockOnWidgetChange} />
        )

        await waitFor(() => {
            expect(mockedAxios.get).toHaveBeenCalledWith('/api/webpages/api/widgets/by_page/?page_id=1')
            expect(mockedAxios.get).toHaveBeenCalledWith('/api/webpages/api/widget-types/')
        })
    })
}) 