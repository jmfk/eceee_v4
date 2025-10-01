import { render, screen, fireEvent } from '@testing-library/react'
import { vi, describe, it, expect, beforeEach } from 'vitest'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import WidgetSlot from '../WidgetSlot'
import { UnifiedDataProvider } from '../../../contexts/unified-data'

// Mock Lucide React icons using importOriginal to avoid missing icon errors
vi.mock('lucide-react', async (importOriginal) => {
    const actual = await importOriginal()

    // Create a generic icon component for any missing icons
    const GenericIcon = ({ className, ...props }) => <svg data-testid="generic-icon" className={className} {...props} />

    return {
        ...actual,
        // Override specific icons we want to test
        Layout: ({ className, ...props }) => <svg data-testid="layout-icon" className={className} {...props} />,
        Plus: ({ className, ...props }) => <svg data-testid="plus-icon" className={className} {...props} />,
        MoreHorizontal: ({ className, ...props }) => <svg data-testid="more-horizontal-icon" className={className} {...props} />,
        Eye: ({ className, ...props }) => <svg data-testid="eye-icon" className={className} {...props} />,
        // Provide fallbacks for any other icons that might be missing
        FileText: GenericIcon,
        Type: GenericIcon,
        Image: GenericIcon,
        Settings: GenericIcon,
        Trash2: GenericIcon,
        ChevronUp: GenericIcon,
        ChevronDown: GenericIcon,
        Table: GenericIcon,
        Grid3X3: GenericIcon,
        MousePointer: GenericIcon,
        Space: GenericIcon,
        Code: GenericIcon,
        Newspaper: GenericIcon,
        Calendar: GenericIcon,
        Users: GenericIcon,
        ImageIcon: GenericIcon,
        Loader2: GenericIcon,
        ChevronLeft: GenericIcon,
        ChevronRight: GenericIcon,
        X: GenericIcon,
        EyeOff: GenericIcon,
        Hash: GenericIcon
    }
})

// Mock PageWidgetFactory
vi.mock('../../editors/page-editor/PageWidgetFactory', () => ({
    default: ({ widget, index }) => (
        <div data-testid={`widget-${index}`}>
            Mock Widget: {widget.type}
        </div>
    )
}))

// Mock PageSlotIconMenu
vi.mock('../../editors/page-editor/PageSlotIconMenu', () => ({
    default: ({ onAddWidget, onShowWidgetModal, slotName }) => (
        <div data-testid="slot-icon-menu">
            <button
                data-testid="header-add-widget-btn"
                onClick={() => {
                    if (onShowWidgetModal) {
                        onShowWidgetModal(slotName)
                    } else if (onAddWidget) {
                        onAddWidget('add', slotName)
                    }
                }}
            >
                Header Add Widget
            </button>
        </div>
    )
}))

const mockWidgets = [
    { id: '1', type: 'default_widgets.ContentWidget', config: {} },
    { id: '2', type: 'default_widgets.ImageWidget', config: {} }
]

// Helper function to render with all required providers
const renderWithProvider = (component) => {
    const queryClient = new QueryClient({
        defaultOptions: {
            queries: {
                retry: false,
            },
        },
    })

    return render(
        <QueryClientProvider client={queryClient}>
            <UnifiedDataProvider>
                {component}
            </UnifiedDataProvider>
        </QueryClientProvider>
    )
}

describe('WidgetSlot', () => {
    let mockOnWidgetAction
    let mockOnShowWidgetModal
    let mockOnClearSlot

    beforeEach(() => {
        mockOnWidgetAction = vi.fn()
        mockOnShowWidgetModal = vi.fn()
        mockOnClearSlot = vi.fn()
    })

    it('renders slot with widgets when widgets are provided', () => {
        renderWithProvider(
            <WidgetSlot
                name="main_content"
                label="Main Content"
                description="Main content area"
                widgets={mockWidgets}
                onWidgetAction={mockOnWidgetAction}
                onShowWidgetModal={mockOnShowWidgetModal}
                onClearSlot={mockOnClearSlot}
                editable={true}
            />
        )

        expect(screen.getAllByText('Main Content')).toHaveLength(1) // Only in header, not in empty slot
        expect(screen.getByTestId('widget-0')).toBeInTheDocument()
        expect(screen.getByTestId('widget-1')).toBeInTheDocument()
    })

    it('renders empty slot with "Add Your First Widget" button when no widgets', () => {
        renderWithProvider(
            <WidgetSlot
                name="main_content"
                label="Main Content"
                description="Main content area"
                widgets={[]}
                onWidgetAction={mockOnWidgetAction}
                onShowWidgetModal={mockOnShowWidgetModal}
                onClearSlot={mockOnClearSlot}
                editable={true}
            />
        )

        expect(screen.getAllByText('Main Content')).toHaveLength(2) // In header and empty slot
        expect(screen.getByText('Main content area')).toBeInTheDocument()
        expect(screen.getByText('Add Your First Widget')).toBeInTheDocument()
    })

    it('calls onShowWidgetModal when "Add Your First Widget" button is clicked', () => {
        renderWithProvider(
            <WidgetSlot
                name="main_content"
                label="Main Content"
                description="Main content area"
                widgets={[]}
                onWidgetAction={mockOnWidgetAction}
                onShowWidgetModal={mockOnShowWidgetModal}
                onClearSlot={mockOnClearSlot}
                editable={true}
            />
        )

        const addFirstWidgetBtn = screen.getByText('Add Your First Widget')
        fireEvent.click(addFirstWidgetBtn)

        expect(mockOnShowWidgetModal).toHaveBeenCalledWith('main_content')
    })

    it('calls onShowWidgetModal when header add widget button is clicked', () => {
        renderWithProvider(
            <WidgetSlot
                name="main_content"
                label="Main Content"
                description="Main content area"
                widgets={mockWidgets}
                onWidgetAction={mockOnWidgetAction}
                onShowWidgetModal={mockOnShowWidgetModal}
                onClearSlot={mockOnClearSlot}
                editable={true}
            />
        )

        const headerAddWidgetBtn = screen.getByTestId('header-add-widget-btn')
        fireEvent.click(headerAddWidgetBtn)

        expect(mockOnShowWidgetModal).toHaveBeenCalledWith('main_content')
    })

    it('falls back to onWidgetAction when onShowWidgetModal is not provided for "Add Your First Widget"', () => {
        renderWithProvider(
            <WidgetSlot
                name="main_content"
                label="Main Content"
                description="Main content area"
                widgets={[]}
                onWidgetAction={mockOnWidgetAction}
                onClearSlot={mockOnClearSlot}
                editable={true}
            // onShowWidgetModal not provided
            />
        )

        const addFirstWidgetBtn = screen.getByText('Add Your First Widget')
        fireEvent.click(addFirstWidgetBtn)

        expect(mockOnWidgetAction).toHaveBeenCalledWith('add', 'main_content', null, 'default_widgets.ContentWidget')
    })

    it('does not render "Add Your First Widget" button when not editable', () => {
        renderWithProvider(
            <WidgetSlot
                name="main_content"
                label="Main Content"
                description="Main content area"
                widgets={[]}
                onWidgetAction={mockOnWidgetAction}
                onShowWidgetModal={mockOnShowWidgetModal}
                onClearSlot={mockOnClearSlot}
                editable={false}
            />
        )

        expect(screen.queryByText('Add Your First Widget')).not.toBeInTheDocument()
    })

    it('shows required indicator when slot is required', () => {
        renderWithProvider(
            <WidgetSlot
                name="main_content"
                label="Main Content"
                description="Main content area"
                widgets={[]}
                onWidgetAction={mockOnWidgetAction}
                onShowWidgetModal={mockOnShowWidgetModal}
                onClearSlot={mockOnClearSlot}
                editable={true}
                required={true}
            />
        )

        expect(screen.getByText('This slot is required')).toBeInTheDocument()
    })

    it('does not render slot header when not editable', () => {
        renderWithProvider(
            <WidgetSlot
                name="main_content"
                label="Main Content"
                description="Main content area"
                widgets={mockWidgets}
                onWidgetAction={mockOnWidgetAction}
                onShowWidgetModal={mockOnShowWidgetModal}
                onClearSlot={mockOnClearSlot}
                editable={false}
            />
        )

        // Should not render the slot icon menu when not editable
        expect(screen.queryByTestId('slot-icon-menu')).not.toBeInTheDocument()
    })

    it('passes correct props to PageSlotIconMenu', () => {
        renderWithProvider(
            <WidgetSlot
                name="main_content"
                label="Main Content"
                description="Main content area"
                widgets={mockWidgets}
                onWidgetAction={mockOnWidgetAction}
                onShowWidgetModal={mockOnShowWidgetModal}
                onClearSlot={mockOnClearSlot}
                editable={true}
                maxWidgets={5}
            />
        )

        // The mock PageSlotIconMenu should be rendered
        expect(screen.getByTestId('slot-icon-menu')).toBeInTheDocument()
        expect(screen.getByTestId('header-add-widget-btn')).toBeInTheDocument()
    })
})
