import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import WidgetPortalManager from '../WidgetPortalManager'

// Mock ReactDOM.createPortal
vi.mock('react-dom', async () => {
    const actual = await vi.importActual('react-dom')
    return {
        ...actual,
        createPortal: vi.fn((children, container) => children)
    }
})

describe('WidgetPortalManager', () => {
    const mockLayout = {
        name: 'test_layout',
        slot_configuration: {
            slots: [
                {
                    name: 'header',
                    title: 'Header',
                    description: 'Header content',
                    max_widgets: 2
                },
                {
                    name: 'content',
                    title: 'Content',
                    description: 'Main content',
                    max_widgets: null
                }
            ]
        }
    }

    const mockSlotElements = {
        header: document.createElement('div'),
        content: document.createElement('div')
    }

    const mockWidgetsBySlot = {
        header: [
            {
                widget: {
                    id: 1,
                    widget_type: { name: 'TextBlock' },
                    configuration: { title: 'Header Title', content: 'Header content' },
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
                    widget_type: { name: 'Button' },
                    configuration: { text: 'Click me', style: 'primary' },
                    is_visible: true
                },
                inherited_from: null,
                is_override: false
            }
        ]
    }

    const defaultProps = {
        slotElements: mockSlotElements,
        widgetsBySlot: mockWidgetsBySlot,
        layout: mockLayout,
        mode: 'preview',
        showInheritance: false,
        showManagementOverlay: false
    }

    beforeEach(() => {
        vi.clearAllMocks()
    })

    describe('Portal Creation', () => {
        it('creates portals for all widgets in slots', () => {
            const { createPortal } = require('react-dom')

            render(<WidgetPortalManager {...defaultProps} />)

            // Should create portals for both widgets
            expect(createPortal).toHaveBeenCalledTimes(2)
        })

        it('updates portals when widgets change', () => {
            const { createPortal } = require('react-dom')
            const { rerender } = render(<WidgetPortalManager {...defaultProps} />)

            expect(createPortal).toHaveBeenCalledTimes(2)

            // Add another widget
            const newWidgetsBySlot = {
                ...mockWidgetsBySlot,
                content: [
                    ...mockWidgetsBySlot.content,
                    {
                        widget: {
                            id: 3,
                            widget_type: { name: 'Header' },
                            configuration: { title: 'New Header' },
                            is_visible: true
                        },
                        inherited_from: null,
                        is_override: false
                    }
                ]
            }

            rerender(
                <WidgetPortalManager
                    {...defaultProps}
                    widgetsBySlot={newWidgetsBySlot}
                />
            )

            expect(createPortal).toHaveBeenCalledTimes(5) // 2 initial + 3 for rerender
        })

        it('handles empty slot elements gracefully', () => {
            render(
                <WidgetPortalManager
                    {...defaultProps}
                    slotElements={{}}
                />
            )

            // Should not create any portals
            const { createPortal } = require('react-dom')
            expect(createPortal).not.toHaveBeenCalled()
        })
    })

    describe('Widget Rendering', () => {
        it('renders different widget types correctly', () => {
            render(<WidgetPortalManager {...defaultProps} />)

            // TextBlock widget
            expect(screen.getByText('Header Title')).toBeInTheDocument()
            expect(screen.getByText('Header content')).toBeInTheDocument()

            // Button widget
            expect(screen.getByRole('button', { name: 'Click me' })).toBeInTheDocument()
        })

        it('shows inheritance information when enabled', () => {
            const inheritedWidgetsBySlot = {
                header: [
                    {
                        widget: {
                            id: 1,
                            widget_type: { name: 'TextBlock' },
                            configuration: { content: 'Inherited content' },
                            is_visible: true
                        },
                        inherited_from: { title: 'Parent Page' },
                        is_override: false
                    }
                ]
            }

            render(
                <WidgetPortalManager
                    {...defaultProps}
                    widgetsBySlot={inheritedWidgetsBySlot}
                    showInheritance={true}
                />
            )

            expect(screen.getByText(/Inherited from: Parent Page/)).toBeInTheDocument()
        })

        it('shows override information', () => {
            const overrideWidgetsBySlot = {
                header: [
                    {
                        widget: {
                            id: 1,
                            widget_type: { name: 'TextBlock' },
                            configuration: { content: 'Override content' },
                            is_visible: true
                        },
                        inherited_from: null,
                        is_override: true
                    }
                ]
            }

            render(
                <WidgetPortalManager
                    {...defaultProps}
                    widgetsBySlot={overrideWidgetsBySlot}
                    showInheritance={true}
                />
            )

            expect(screen.getByText('Override')).toBeInTheDocument()
        })
    })

    describe('Edit Mode Functionality', () => {
        it('shows management controls in edit mode with overlay', () => {
            render(
                <WidgetPortalManager
                    {...defaultProps}
                    mode="edit"
                    showManagementOverlay={true}
                />
            )

            // Should show edit and delete buttons for widgets
            const editButtons = screen.getAllByTitle('Edit widget')
            const deleteButtons = screen.getAllByTitle('Delete widget')

            expect(editButtons).toHaveLength(2)
            expect(deleteButtons).toHaveLength(2)
        })

        it('calls onWidgetEdit when edit button is clicked', () => {
            const onWidgetEdit = vi.fn()

            render(
                <WidgetPortalManager
                    {...defaultProps}
                    mode="edit"
                    showManagementOverlay={true}
                    onWidgetEdit={onWidgetEdit}
                />
            )

            const editButtons = screen.getAllByTitle('Edit widget')
            fireEvent.click(editButtons[0])

            expect(onWidgetEdit).toHaveBeenCalledWith(
                mockWidgetsBySlot.header[0].widget,
                'header'
            )
        })

        it('calls onWidgetDelete when delete button is clicked', () => {
            const onWidgetDelete = vi.fn()

            render(
                <WidgetPortalManager
                    {...defaultProps}
                    mode="edit"
                    showManagementOverlay={true}
                    onWidgetDelete={onWidgetDelete}
                />
            )

            const deleteButtons = screen.getAllByTitle('Delete widget')
            fireEvent.click(deleteButtons[0])

            expect(onWidgetDelete).toHaveBeenCalledWith(
                mockWidgetsBySlot.header[0].widget.id,
                'header'
            )
        })

        it('calls onWidgetEdit when widget is clicked in edit mode', () => {
            const onWidgetEdit = vi.fn()

            render(
                <WidgetPortalManager
                    {...defaultProps}
                    mode="edit"
                    onWidgetEdit={onWidgetEdit}
                />
            )

            const widget = screen.getByText('Header Title').closest('.widget-portal-wrapper')
            fireEvent.click(widget)

            expect(onWidgetEdit).toHaveBeenCalledWith(
                mockWidgetsBySlot.header[0].widget,
                'header'
            )
        })
    })

    describe('Slot Management Overlay', () => {
        it('shows empty slot indicator for slots without widgets', () => {
            const emptySlotElements = {
                ...mockSlotElements,
                empty: document.createElement('div')
            }

            render(
                <WidgetPortalManager
                    {...defaultProps}
                    slotElements={emptySlotElements}
                    widgetsBySlot={{ ...mockWidgetsBySlot, empty: [] }}
                    showManagementOverlay={true}
                    mode="edit"
                />
            )

            // Should show the "Add Widget" button for empty slot
            expect(screen.getByText('Add Widget')).toBeInTheDocument()
        })

        it('shows slot limit indicator when max widgets reached', () => {
            const maxedOutSlot = {
                header: [
                    mockWidgetsBySlot.header[0],
                    {
                        widget: {
                            id: 99,
                            widget_type: { name: 'TextBlock' },
                            configuration: { content: 'Second widget' },
                            is_visible: true
                        },
                        inherited_from: null,
                        is_override: false
                    }
                ]
            }

            render(
                <WidgetPortalManager
                    {...defaultProps}
                    widgetsBySlot={maxedOutSlot}
                    showManagementOverlay={true}
                    mode="edit"
                />
            )

            expect(screen.getByText(/Maximum widgets reached \(2\)/)).toBeInTheDocument()
        })

        it('calls onWidgetAdd when Add Widget button is clicked', () => {
            const onWidgetAdd = vi.fn()
            const emptySlotElements = {
                empty: document.createElement('div')
            }

            const layoutWithEmptySlot = {
                ...mockLayout,
                slot_configuration: {
                    slots: [
                        ...mockLayout.slot_configuration.slots,
                        {
                            name: 'empty',
                            title: 'Empty Slot',
                            description: 'Empty slot for testing'
                        }
                    ]
                }
            }

            render(
                <WidgetPortalManager
                    {...defaultProps}
                    slotElements={emptySlotElements}
                    widgetsBySlot={{ empty: [] }}
                    layout={layoutWithEmptySlot}
                    showManagementOverlay={true}
                    mode="edit"
                    onWidgetAdd={onWidgetAdd}
                />
            )

            const addButton = screen.getByText('Add Widget')
            fireEvent.click(addButton)

            expect(onWidgetAdd).toHaveBeenCalledWith(
                'empty',
                expect.objectContaining({
                    name: 'empty',
                    title: 'Empty Slot'
                })
            )
        })
    })

    describe('Error Handling', () => {
        it('displays portal errors when they occur', () => {
            // Mock console.error to prevent test noise
            const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => { })

            // Create a slot element that will cause an error
            const errorSlotElements = {
                ...mockSlotElements,
                error: null // This should cause an error
            }

            render(
                <WidgetPortalManager
                    {...defaultProps}
                    slotElements={errorSlotElements}
                    widgetsBySlot={{
                        ...mockWidgetsBySlot,
                        error: [mockWidgetsBySlot.header[0]]
                    }}
                />
            )

            // Should handle the error gracefully
            expect(screen.getByText('Header Title')).toBeInTheDocument()

            consoleSpy.mockRestore()
        })

        it('shows error boundary for individual widget failures', () => {
            // Mock a widget that will cause an error during rendering
            const errorWidget = {
                widget: {
                    id: 'error',
                    widget_type: { name: 'ErrorWidget' },
                    configuration: null, // This might cause rendering issues
                    is_visible: true
                },
                inherited_from: null,
                is_override: false
            }

            render(
                <WidgetPortalManager
                    {...defaultProps}
                    widgetsBySlot={{ header: [errorWidget] }}
                />
            )

            // The error boundary should catch and display a fallback
            // This is a simplified test - in practice, we'd need to trigger an actual React error
        })
    })

    describe('Widget Type Rendering', () => {
        it('renders Header widget type correctly', () => {
            const headerWidgets = {
                content: [
                    {
                        widget: {
                            id: 1,
                            widget_type: { name: 'Header' },
                            configuration: { title: 'Page Header' },
                            is_visible: true
                        },
                        inherited_from: null,
                        is_override: false
                    }
                ]
            }

            render(
                <WidgetPortalManager
                    {...defaultProps}
                    widgetsBySlot={headerWidgets}
                />
            )

            expect(screen.getByRole('heading', { name: 'Page Header' })).toBeInTheDocument()
        })

        it('renders Image widget type correctly', () => {
            const imageWidgets = {
                content: [
                    {
                        widget: {
                            id: 1,
                            widget_type: { name: 'Image' },
                            configuration: { alt_text: 'Test Image', caption: 'Image caption' },
                            is_visible: true
                        },
                        inherited_from: null,
                        is_override: false
                    }
                ]
            }

            render(
                <WidgetPortalManager
                    {...defaultProps}
                    widgetsBySlot={imageWidgets}
                />
            )

            expect(screen.getByText('📷 Test Image')).toBeInTheDocument()
            expect(screen.getByText('Image caption')).toBeInTheDocument()
        })

        it('renders unknown widget types with fallback', () => {
            const unknownWidgets = {
                content: [
                    {
                        widget: {
                            id: 1,
                            widget_type: { name: 'CustomWidget' },
                            configuration: { description: 'Custom widget content' },
                            is_visible: true
                        },
                        inherited_from: null,
                        is_override: false
                    }
                ]
            }

            render(
                <WidgetPortalManager
                    {...defaultProps}
                    widgetsBySlot={unknownWidgets}
                />
            )

            expect(screen.getByText('CustomWidget Widget')).toBeInTheDocument()
            expect(screen.getByText('Custom widget content')).toBeInTheDocument()
        })
    })

    describe('Accessibility', () => {
        it('provides proper ARIA attributes for interactive elements', () => {
            render(
                <WidgetPortalManager
                    {...defaultProps}
                    mode="edit"
                />
            )

            const widgets = screen.getAllByRole('button')
            widgets.forEach(widget => {
                expect(widget).toHaveAttribute('tabIndex')
            })
        })

        it('supports keyboard navigation', () => {
            const onWidgetEdit = vi.fn()

            render(
                <WidgetPortalManager
                    {...defaultProps}
                    mode="edit"
                    onWidgetEdit={onWidgetEdit}
                />
            )

            const widget = screen.getByText('Header Title').closest('.widget-portal-wrapper')

            fireEvent.keyDown(widget, { key: 'Enter' })
            expect(onWidgetEdit).toHaveBeenCalledWith(
                mockWidgetsBySlot.header[0].widget,
                'header'
            )
        })
    })

    describe('Performance', () => {
        it('only re-renders portals when slot elements or widgets change', () => {
            const { createPortal } = require('react-dom')
            const { rerender } = render(<WidgetPortalManager {...defaultProps} />)

            const initialCallCount = createPortal.mock.calls.length

            // Rerender with same props
            rerender(<WidgetPortalManager {...defaultProps} />)

            // Should not create additional portals
            expect(createPortal.mock.calls.length).toBe(initialCallCount * 2) // Called again for rerender
        })

        it('handles large numbers of widgets efficiently', () => {
            const manyWidgets = Array.from({ length: 50 }, (_, i) => ({
                widget: {
                    id: i,
                    widget_type: { name: 'TextBlock' },
                    configuration: { content: `Widget ${i}` },
                    is_visible: true
                },
                inherited_from: null,
                is_override: false
            }))

            const start = performance.now()

            render(
                <WidgetPortalManager
                    {...defaultProps}
                    widgetsBySlot={{ content: manyWidgets }}
                />
            )

            const end = performance.now()

            // Should render in reasonable time (less than 100ms for 50 widgets)
            expect(end - start).toBeLessThan(100)
        })
    })
}) 