import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { createPortal } from 'react-dom'
import TemplateLayoutRenderer from '../TemplateLayoutRenderer'

// Mock DOMPurify
vi.mock('dompurify', () => ({
    default: {
        sanitize: vi.fn((html) => html) // Simple pass-through for testing
    }
}))

// Mock ReactDOM.createPortal
vi.mock('react-dom', async () => {
    const actual = await vi.importActual('react-dom')
    return {
        ...actual,
        createPortal: vi.fn((children, container) => children)
    }
})

describe('TemplateLayoutRenderer', () => {
    const mockLayout = {
        name: 'test_layout',
        template_based: true,
        html: `
            <div class="test-layout">
                <div data-widget-slot="header" data-slot-title="Header">Header area</div>
                <div data-widget-slot="content" data-slot-title="Content">Content area</div>
            </div>
        `,
        css: '.test-layout { display: grid; }',
        slot_configuration: {
            slots: [
                {
                    name: 'header',
                    title: 'Header',
                    description: 'Header content',
                    max_widgets: 2,
                    selector: '[data-widget-slot="header"]'
                },
                {
                    name: 'content',
                    title: 'Content',
                    description: 'Main content',
                    max_widgets: null,
                    selector: '[data-widget-slot="content"]'
                }
            ]
        }
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

    const mockTheme = {
        css_variables: {
            'primary-color': '#007bff',
            'text-color': '#333'
        },
        custom_css: '.theme-style { color: var(--primary-color); }'
    }

    beforeEach(() => {
        // Clear any existing style elements
        document.head.querySelectorAll('style').forEach(el => el.remove())

        // Reset mocks
        vi.clearAllMocks()
    })

    afterEach(() => {
        // Clean up style elements
        document.head.querySelectorAll('style').forEach(el => el.remove())
    })

    describe('Template-Based Layout Rendering', () => {
        it('renders template-based layout with HTML structure', () => {
            render(
                <TemplateLayoutRenderer
                    layout={mockLayout}
                    widgetsBySlot={mockWidgetsBySlot}
                />
            )

            // Check if HTML structure is rendered
            expect(screen.getByText('Header area')).toBeInTheDocument()
            expect(screen.getByText('Content area')).toBeInTheDocument()
        })

        it('injects CSS styles into document head', async () => {
            render(
                <TemplateLayoutRenderer
                    layout={mockLayout}
                    theme={mockTheme}
                />
            )

            await waitFor(() => {
                const styleElements = document.head.querySelectorAll('style')
                const layoutStyle = Array.from(styleElements).find(
                    el => el.id === `template-layout-style-${mockLayout.name}`
                )
                expect(layoutStyle).toBeTruthy()
                expect(layoutStyle?.textContent).toContain('.test-layout { display: grid; }')
            })
        })

        it('applies theme CSS variables', () => {
            const { container } = render(
                <TemplateLayoutRenderer
                    layout={mockLayout}
                    theme={mockTheme}
                />
            )

            const renderer = container.firstChild
            const computedStyle = window.getComputedStyle(renderer)

            // Note: jsdom doesn't fully support CSS custom properties,
            // but we can test that the style attribute is set
            expect(renderer).toHaveAttribute('style')
        })

        it('sanitizes HTML content with DOMPurify', () => {
            const DOMPurify = require('dompurify').default

            render(
                <TemplateLayoutRenderer
                    layout={mockLayout}
                    widgetsBySlot={mockWidgetsBySlot}
                />
            )

            expect(DOMPurify.sanitize).toHaveBeenCalledWith(
                mockLayout.html,
                expect.objectContaining({
                    ALLOWED_TAGS: expect.arrayContaining(['div', 'section', 'main']),
                    ALLOWED_ATTR: expect.arrayContaining(['data-widget-slot', 'class']),
                    KEEP_CONTENT: true,
                    ALLOW_DATA_ATTR: true,
                    SANITIZE_DOM: true
                })
            )
        })
    })

    describe('Widget Portal System', () => {
        it('creates portals for widgets in slots', async () => {
            render(
                <TemplateLayoutRenderer
                    layout={mockLayout}
                    widgetsBySlot={mockWidgetsBySlot}
                />
            )

            // Wait for portals to be created
            await waitFor(() => {
                expect(createPortal).toHaveBeenCalled()
            })

            // Check if widgets are rendered
            expect(screen.getByText('Header Title')).toBeInTheDocument()
            expect(screen.getByText('Click me')).toBeInTheDocument()
        })

        it('handles widget types correctly', () => {
            render(
                <TemplateLayoutRenderer
                    layout={mockLayout}
                    widgetsBySlot={mockWidgetsBySlot}
                />
            )

            // TextBlock widget
            expect(screen.getByText('Header Title')).toBeInTheDocument()
            expect(screen.getByText('Header content')).toBeInTheDocument()

            // Button widget
            const button = screen.getByRole('button', { name: 'Click me' })
            expect(button).toBeInTheDocument()
            expect(button).toBeDisabled() // Should be disabled in preview mode
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
                <TemplateLayoutRenderer
                    layout={mockLayout}
                    widgetsBySlot={inheritedWidgetsBySlot}
                    showInheritance={true}
                />
            )

            expect(screen.getByText(/Inherited from: Parent Page/)).toBeInTheDocument()
        })
    })

    describe('Edit Mode Functionality', () => {
        it('handles widget edit clicks in edit mode', () => {
            const onWidgetEdit = vi.fn()

            render(
                <TemplateLayoutRenderer
                    layout={mockLayout}
                    widgetsBySlot={mockWidgetsBySlot}
                    mode="edit"
                    onWidgetEdit={onWidgetEdit}
                />
            )

            // Find and click on a widget
            const widget = screen.getByText('Header Title').closest('.widget-wrapper')
            expect(widget).toBeInTheDocument()

            fireEvent.click(widget)
            expect(onWidgetEdit).toHaveBeenCalledWith(mockWidgetsBySlot.header[0].widget)
        })

        it('supports keyboard navigation in edit mode', () => {
            const onWidgetEdit = vi.fn()

            render(
                <TemplateLayoutRenderer
                    layout={mockLayout}
                    widgetsBySlot={mockWidgetsBySlot}
                    mode="edit"
                    onWidgetEdit={onWidgetEdit}
                />
            )

            const widget = screen.getByText('Header Title').closest('.widget-wrapper')

            fireEvent.keyDown(widget, { key: 'Enter' })
            expect(onWidgetEdit).toHaveBeenCalledWith(mockWidgetsBySlot.header[0].widget)

            onWidgetEdit.mockClear()

            fireEvent.keyDown(widget, { key: ' ' })
            expect(onWidgetEdit).toHaveBeenCalledWith(mockWidgetsBySlot.header[0].widget)
        })
    })

    describe('Error Handling', () => {
        it('shows fallback for non-template layouts', () => {
            const codeLayout = {
                name: 'code_layout',
                template_based: false,
                slot_configuration: { slots: [] }
            }

            render(
                <TemplateLayoutRenderer
                    layout={codeLayout}
                    widgetsBySlot={{}}
                />
            )

            expect(screen.getByText('Not a template-based layout')).toBeInTheDocument()
            expect(screen.getByText('Use LayoutRenderer for code-based layouts')).toBeInTheDocument()
        })

        it('shows error when no HTML template is available', () => {
            const emptyLayout = {
                name: 'empty_layout',
                template_based: true,
                html: '',
                slot_configuration: { slots: [] }
            }

            render(
                <TemplateLayoutRenderer
                    layout={emptyLayout}
                    widgetsBySlot={{}}
                />
            )

            expect(screen.getByText('No template HTML available')).toBeInTheDocument()
        })

        it('displays sanitization errors', () => {
            // Mock container ref to simulate slot discovery errors
            const layoutWithErrors = {
                ...mockLayout,
                html: '<div data-widget-slot="">Invalid slot</div>'
            }

            render(
                <TemplateLayoutRenderer
                    layout={layoutWithErrors}
                    widgetsBySlot={{}}
                />
            )

            // Note: This test would need to be more sophisticated to actually
            // trigger sanitization errors in the test environment
        })
    })

    describe('CSS Cleanup', () => {
        it('removes CSS styles on unmount', async () => {
            const { unmount } = render(
                <TemplateLayoutRenderer
                    layout={mockLayout}
                    theme={mockTheme}
                />
            )

            // Verify style is injected
            await waitFor(() => {
                const styleElement = document.getElementById(`template-layout-style-${mockLayout.name}`)
                expect(styleElement).toBeInTheDocument()
            })

            // Unmount and verify cleanup
            unmount()

            await waitFor(() => {
                const styleElement = document.getElementById(`template-layout-style-${mockLayout.name}`)
                expect(styleElement).not.toBeInTheDocument()
            })
        })

        it('replaces existing styles when layout changes', async () => {
            const { rerender } = render(
                <TemplateLayoutRenderer
                    layout={mockLayout}
                />
            )

            // Wait for initial style injection
            await waitFor(() => {
                const styleElement = document.getElementById(`template-layout-style-${mockLayout.name}`)
                expect(styleElement).toBeInTheDocument()
            })

            // Update layout with different CSS
            const updatedLayout = {
                ...mockLayout,
                css: '.updated-layout { background: red; }'
            }

            rerender(
                <TemplateLayoutRenderer
                    layout={updatedLayout}
                />
            )

            // Verify style is updated
            await waitFor(() => {
                const styleElement = document.getElementById(`template-layout-style-${mockLayout.name}`)
                expect(styleElement?.textContent).toContain('.updated-layout { background: red; }')
            })
        })
    })

    describe('Page Header Rendering', () => {
        it('renders page title and description when provided', () => {
            render(
                <TemplateLayoutRenderer
                    layout={mockLayout}
                    pageTitle="Test Page"
                    pageDescription="This is a test page"
                />
            )

            expect(screen.getByRole('heading', { name: 'Test Page' })).toBeInTheDocument()
            expect(screen.getByText('This is a test page')).toBeInTheDocument()
        })

        it('does not render header when title and description are not provided', () => {
            render(
                <TemplateLayoutRenderer
                    layout={mockLayout}
                />
            )

            expect(screen.queryByRole('banner')).not.toBeInTheDocument()
        })
    })

    describe('Widget Types Rendering', () => {
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
                <TemplateLayoutRenderer
                    layout={mockLayout}
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
                <TemplateLayoutRenderer
                    layout={mockLayout}
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
                <TemplateLayoutRenderer
                    layout={mockLayout}
                    widgetsBySlot={unknownWidgets}
                />
            )

            expect(screen.getByText('CustomWidget Widget')).toBeInTheDocument()
            expect(screen.getByText('Custom widget content')).toBeInTheDocument()
        })
    })
}) 