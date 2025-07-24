import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import '@testing-library/jest-dom'
import { vi } from 'vitest'
import LayoutRenderer from '../LayoutRenderer'

// Mock data for testing
const mockLayout = {
    name: 'two_column',
    description: 'Two column layout with sidebar',
    slot_configuration: {
        slots: [
            {
                name: 'header',
                display_name: 'Header',
                title: 'Page Header',
                description: 'Main header content',
                css_classes: 'header-slot',
                max_widgets: 2
            },
            {
                name: 'content',
                display_name: 'Main Content',
                title: 'Content Area',
                description: 'Primary content area',
                css_classes: 'content-slot'
            },
            {
                name: 'sidebar',
                display_name: 'Sidebar',
                title: 'Side Content',
                description: 'Secondary content area',
                css_classes: 'sidebar-slot',
                max_widgets: 5
            }
        ]
    },
    css_classes: '.layout-two-column { display: grid; }'
}

const mockTheme = {
    name: 'Blue Theme',
    css_variables: {
        primary: '#3b82f6',
        background: '#ffffff',
        text: '#1f2937',
        'text-muted': '#6b7280'
    },
    custom_css: '.custom-style { color: blue; }'
}

const mockWidgetsBySlot = {
    header: [
        {
            widget: {
                id: 1,
                widget_type: { name: 'TextBlock' },
                configuration: {
                    title: 'Welcome Header',
                    content: 'Welcome to our site',
                    style: 'bold'
                },
                is_visible: true
            },
            inherited_from: null,
            is_override: false
        }
    ],
    content: [
        {
            widget: {
                id: 2,
                widget_type: { name: 'Image' },
                configuration: {
                    alt_text: 'Main content image',
                    caption: 'Featured image'
                },
                is_visible: true
            },
            inherited_from: { id: 5, title: 'Parent Page' },
            is_override: false
        }
    ],
    sidebar: [
        {
            widget: {
                id: 3,
                widget_type: { name: 'Button' },
                configuration: {
                    text: 'Click Me',
                    style: 'primary'
                },
                is_visible: false
            },
            inherited_from: null,
            is_override: true
        }
    ]
}

describe('LayoutRenderer', () => {
    // Basic rendering tests
    describe('Basic Rendering', () => {
        it('renders without layout (empty state)', () => {
            render(<LayoutRenderer />)

            expect(screen.getByText('No layout selected')).toBeInTheDocument()
            expect(screen.getByText('Choose a layout to see the structure')).toBeInTheDocument()
        })

        it('renders layout with no slots', () => {
            const emptyLayout = {
                name: 'empty_layout',
                slot_configuration: { slots: [] }
            }

            render(<LayoutRenderer layout={emptyLayout} />)

            expect(screen.getByText('Layout has no slots defined')).toBeInTheDocument()
            expect(screen.getByText('Configure the layout to add slots')).toBeInTheDocument()
        })

        it('renders all layout slots correctly', () => {
            render(<LayoutRenderer layout={mockLayout} />)

            // Check that all slots are rendered
            expect(screen.getByText('Header')).toBeInTheDocument()
            expect(screen.getByText('Main Content')).toBeInTheDocument()
            expect(screen.getByText('Sidebar')).toBeInTheDocument()
        })

        it('shows slot descriptions when showSlotHeaders is true', () => {
            render(<LayoutRenderer layout={mockLayout} showSlotHeaders={true} />)

            expect(screen.getByText('Main header content')).toBeInTheDocument()
            expect(screen.getByText('Primary content area')).toBeInTheDocument()
            expect(screen.getByText('Secondary content area')).toBeInTheDocument()
        })

        it('hides slot headers when showSlotHeaders is false', () => {
            render(<LayoutRenderer layout={mockLayout} showSlotHeaders={false} />)

            expect(screen.queryByText('Main header content')).not.toBeInTheDocument()
        })
    })

    // Theme application tests
    describe('Theme Application', () => {
        it('applies theme CSS variables correctly', () => {
            const { container } = render(
                <LayoutRenderer layout={mockLayout} theme={mockTheme} />
            )

            const layoutRenderer = container.querySelector('.layout-renderer')
            const computedStyle = window.getComputedStyle(layoutRenderer)

            // Note: jsdom doesn't fully support CSS custom properties,
            // so we check the style attribute directly
            expect(layoutRenderer).toHaveStyle('--primary: #3b82f6')
            expect(layoutRenderer).toHaveStyle('--background: #ffffff')
            expect(layoutRenderer).toHaveStyle('--text: #1f2937')
        })

        it('injects custom CSS from theme', () => {
            render(<LayoutRenderer layout={mockLayout} theme={mockTheme} />)

            // Check that custom CSS is injected
            const styles = document.querySelectorAll('style')
            const customStyle = Array.from(styles).find(style =>
                style.innerHTML.includes('.custom-style { color: blue; }')
            )
            expect(customStyle).toBeTruthy()
        })

        it('injects layout CSS classes', () => {
            render(<LayoutRenderer layout={mockLayout} theme={mockTheme} />)

            const styles = document.querySelectorAll('style')
            const layoutStyle = Array.from(styles).find(style =>
                style.innerHTML.includes('.layout-two-column { display: grid; }')
            )
            expect(layoutStyle).toBeTruthy()
        })
    })

    // Widget rendering tests
    describe('Widget Rendering', () => {
        it('renders widgets in correct slots', () => {
            render(
                <LayoutRenderer
                    layout={mockLayout}
                    widgetsBySlot={mockWidgetsBySlot}
                />
            )

            // Check widgets are rendered in their slots
            expect(screen.getByText('Welcome to our site')).toBeInTheDocument()
            expect(screen.getByText('📷 Main content image')).toBeInTheDocument()
            expect(screen.getByText('Click Me')).toBeInTheDocument()
        })

        it('renders TextBlock widgets correctly', () => {
            render(
                <LayoutRenderer
                    layout={mockLayout}
                    widgetsBySlot={mockWidgetsBySlot}
                />
            )

            expect(screen.getByText('Welcome Header')).toBeInTheDocument()
            expect(screen.getByText('Welcome to our site')).toBeInTheDocument()
        })

        it('renders Image widgets correctly', () => {
            render(
                <LayoutRenderer
                    layout={mockLayout}
                    widgetsBySlot={mockWidgetsBySlot}
                />
            )

            expect(screen.getByText('📷 Main content image')).toBeInTheDocument()
            expect(screen.getByText('Featured image')).toBeInTheDocument()
        })

        it('renders Button widgets correctly', () => {
            render(
                <LayoutRenderer
                    layout={mockLayout}
                    widgetsBySlot={mockWidgetsBySlot}
                />
            )

            const button = screen.getByText('Click Me')
            expect(button).toBeInTheDocument()
            expect(button.closest('button')).toHaveClass('bg-blue-600')
        })

        it('shows empty slot message when slot has no widgets', () => {
            const emptyWidgetsBySlot = { header: [], content: [], sidebar: [] }

            render(
                <LayoutRenderer
                    layout={mockLayout}
                    widgetsBySlot={emptyWidgetsBySlot}
                    showEmptySlots={true}
                />
            )

            const emptyMessages = screen.getAllByText('No widgets in this slot')
            expect(emptyMessages).toHaveLength(3)
        })

        it('hides empty slots when showEmptySlots is false', () => {
            const emptyWidgetsBySlot = { header: [], content: [], sidebar: [] }

            render(
                <LayoutRenderer
                    layout={mockLayout}
                    widgetsBySlot={emptyWidgetsBySlot}
                    showEmptySlots={false}
                />
            )

            expect(screen.queryByText('No widgets in this slot')).not.toBeInTheDocument()
        })
    })

    // Inheritance display tests
    describe('Inheritance Display', () => {
        it('shows inheritance information when enabled', () => {
            render(
                <LayoutRenderer
                    layout={mockLayout}
                    widgetsBySlot={mockWidgetsBySlot}
                    showInheritance={true}
                />
            )

            expect(screen.getByText('Inherited from: Parent Page')).toBeInTheDocument()
            expect(screen.getByText('Override')).toBeInTheDocument()
        })

        it('hides inheritance information when disabled', () => {
            render(
                <LayoutRenderer
                    layout={mockLayout}
                    widgetsBySlot={mockWidgetsBySlot}
                    showInheritance={false}
                />
            )

            expect(screen.queryByText('Inherited from: Parent Page')).not.toBeInTheDocument()
            expect(screen.queryByText('Override')).not.toBeInTheDocument()
        })

        it('shows hidden widget indicator', () => {
            render(
                <LayoutRenderer
                    layout={mockLayout}
                    widgetsBySlot={mockWidgetsBySlot}
                    showInheritance={true}
                />
            )

            expect(screen.getByText('Hidden')).toBeInTheDocument()
        })

        it('applies inheritance styling to widgets', () => {
            const { container } = render(
                <LayoutRenderer
                    layout={mockLayout}
                    widgetsBySlot={mockWidgetsBySlot}
                />
            )

            // Check inherited widget has orange styling
            const inheritedWidget = container.querySelector('.border-orange-200')
            expect(inheritedWidget).toBeInTheDocument()
        })
    })

    // Page header tests
    describe('Page Header', () => {
        it('renders page title and description', () => {
            render(
                <LayoutRenderer
                    layout={mockLayout}
                    pageTitle="Test Page"
                    pageDescription="This is a test page"
                />
            )

            expect(screen.getByText('Test Page')).toBeInTheDocument()
            expect(screen.getByText('This is a test page')).toBeInTheDocument()
        })

        it('renders only title when no description provided', () => {
            render(
                <LayoutRenderer
                    layout={mockLayout}
                    pageTitle="Test Page"
                />
            )

            expect(screen.getByText('Test Page')).toBeInTheDocument()
        })

        it('renders no header when no title or description provided', () => {
            const { container } = render(<LayoutRenderer layout={mockLayout} />)

            expect(container.querySelector('header')).not.toBeInTheDocument()
        })
    })

    // Mode-specific behavior tests
    describe('Mode-Specific Behavior', () => {
        it('shows edit-specific UI in edit mode', () => {
            render(
                <LayoutRenderer
                    layout={mockLayout}
                    widgetsBySlot={{ header: [], content: [], sidebar: [] }}
                    mode="edit"
                    showEmptySlots={true}
                    onWidgetAdd={() => { }}
                />
            )

            const addButtons = screen.getAllByText('Add Widget')
            expect(addButtons.length).toBeGreaterThan(0)
        })

        it('handles widget edit clicks in edit mode', () => {
            const mockOnWidgetEdit = vi.fn()

            render(
                <LayoutRenderer
                    layout={mockLayout}
                    widgetsBySlot={mockWidgetsBySlot}
                    mode="edit"
                    onWidgetEdit={mockOnWidgetEdit}
                />
            )

            const widget = screen.getByText('Welcome to our site').closest('.widget-preview')
            fireEvent.click(widget)

            expect(mockOnWidgetEdit).toHaveBeenCalledWith(
                expect.objectContaining({ id: 1 })
            )
        })

        it('handles keyboard navigation in edit mode', () => {
            const mockOnWidgetEdit = vi.fn()

            render(
                <LayoutRenderer
                    layout={mockLayout}
                    widgetsBySlot={mockWidgetsBySlot}
                    mode="edit"
                    onWidgetEdit={mockOnWidgetEdit}
                />
            )

            const widget = screen.getByText('Welcome to our site').closest('.widget-preview')
            fireEvent.keyDown(widget, { key: 'Enter' })

            expect(mockOnWidgetEdit).toHaveBeenCalledWith(
                expect.objectContaining({ id: 1 })
            )
        })

        it('shows different content in preview mode', () => {
            render(
                <LayoutRenderer
                    layout={mockLayout}
                    widgetsBySlot={{ header: [], content: [], sidebar: [] }}
                    mode="preview"
                    showEmptySlots={true}
                />
            )

            expect(screen.getAllByText('Widgets would appear here')).toHaveLength(3)
            expect(screen.queryByText('Add Widget')).not.toBeInTheDocument()
        })
    })

    // CSS classes and styling tests
    describe('CSS Classes and Styling', () => {
        it('applies layout-specific CSS classes', () => {
            const { container } = render(<LayoutRenderer layout={mockLayout} />)

            expect(container.querySelector('.layout-two_column')).toBeInTheDocument()
        })

        it('applies slot-specific CSS classes', () => {
            const { container } = render(<LayoutRenderer layout={mockLayout} />)

            expect(container.querySelector('.header-slot')).toBeInTheDocument()
            expect(container.querySelector('.content-slot')).toBeInTheDocument()
            expect(container.querySelector('.sidebar-slot')).toBeInTheDocument()
        })

        it('applies custom className prop', () => {
            const { container } = render(
                <LayoutRenderer layout={mockLayout} className="custom-class" />
            )

            expect(container.querySelector('.custom-class')).toBeInTheDocument()
        })

        it('sets correct data attributes', () => {
            const { container } = render(<LayoutRenderer layout={mockLayout} />)

            expect(container.querySelector('[data-slot="header"]')).toBeInTheDocument()
            expect(container.querySelector('[data-slot="content"]')).toBeInTheDocument()
            expect(container.querySelector('[data-slot="sidebar"]')).toBeInTheDocument()
        })
    })

    // Accessibility tests
    describe('Accessibility', () => {
        it('provides proper ARIA roles for interactive elements', () => {
            render(
                <LayoutRenderer
                    layout={mockLayout}
                    widgetsBySlot={mockWidgetsBySlot}
                    mode="edit"
                    onWidgetEdit={() => { }}
                />
            )

            const widgets = screen.getAllByRole('button')
            expect(widgets.length).toBeGreaterThan(0)
        })

        it('supports keyboard navigation', () => {
            render(
                <LayoutRenderer
                    layout={mockLayout}
                    widgetsBySlot={mockWidgetsBySlot}
                    mode="edit"
                    onWidgetEdit={() => { }}
                />
            )

            const widgets = document.querySelectorAll('[tabIndex="0"]')
            expect(widgets.length).toBeGreaterThan(0)
        })
    })

    // Children rendering test
    describe('Children Rendering', () => {
        it('renders children content correctly', () => {
            render(
                <LayoutRenderer layout={mockLayout}>
                    <div data-testid="child-content">Custom child content</div>
                </LayoutRenderer>
            )

            expect(screen.getByTestId('child-content')).toBeInTheDocument()
            expect(screen.getByText('Custom child content')).toBeInTheDocument()
        })
    })
}) 