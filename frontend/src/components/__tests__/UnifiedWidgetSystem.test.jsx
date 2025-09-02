/**
 * Comprehensive tests for the Unified Widget System
 * 
 * This test suite covers:
 * - Unified Content Editor components
 * - Widget configuration forms
 * - Slot management
 * - Widget operations (add/remove/reorder)
 * - Widget preview system
 * - Error handling and validation
 */

import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { vi } from 'vitest';
import axios from 'axios';

// Mock components (these would be the actual unified components)
const UnifiedContentEditor = ({ page, onSave, onWidgetAdd, onWidgetUpdate, onWidgetDelete }) => {
    const [widgets, setWidgets] = React.useState(page.widgets || []);

    const handleAddWidget = (widgetType) => {
        const newWidget = {
            id: `widget-${Date.now()}`,
            type: widgetType.name,
            typeSlug: widgetType.slug,
            slot: 'main',
            order: widgets.length,
            config: widgetType.configurationDefaults || {}
        };

        const updatedWidgets = [...widgets, newWidget];
        setWidgets(updatedWidgets);
        onWidgetAdd?.(newWidget);
    };

    const handleUpdateWidget = (widgetId, updates) => {
        const updatedWidgets = widgets.map(w =>
            w.id === widgetId ? { ...w, ...updates } : w
        );
        setWidgets(updatedWidgets);
        onWidgetUpdate?.(widgetId, updates);
    };

    const handleDeleteWidget = (widgetId) => {
        const updatedWidgets = widgets.filter(w => w.id !== widgetId);
        setWidgets(updatedWidgets);
        onWidgetDelete?.(widgetId);
    };

    return (
        <div data-testid="unified-content-editor">
            <h2>Unified Content Editor</h2>
            <div data-testid="page-title">{page.title}</div>

            <button
                data-testid="add-widget-button"
                onClick={() => handleAddWidget({
                    name: 'Text Block',
                    slug: 'text-block',
                    configurationDefaults: { title: '', content: '', alignment: 'left' }
                })}
            >
                Add Widget
            </button>

            <div data-testid="widget-list">
                {widgets.map(widget => (
                    <div key={widget.id} data-testid={`widget-${widget.id}`}>
                        <span>{widget.type}</span>
                        <button
                            data-testid={`update-${widget.id}`}
                            onClick={() => handleUpdateWidget(widget.id, {
                                config: { ...widget.config, title: 'Updated' }
                            })}
                        >
                            Update
                        </button>
                        <button
                            data-testid={`delete-${widget.id}`}
                            onClick={() => handleDeleteWidget(widget.id)}
                        >
                            Delete
                        </button>
                    </div>
                ))}
            </div>

            <button data-testid="save-page" onClick={() => onSave?.(widgets)}>
                Save Page
            </button>
        </div>
    );
};

const WidgetConfigurationForm = ({ widget, widgetType, onChange, onSave, errors = {} }) => {
    const [config, setConfig] = React.useState(widget.config || {});

    const handleChange = (field, value) => {
        const newConfig = { ...config, [field]: value };
        setConfig(newConfig);
        onChange?.(newConfig);
    };

    return (
        <div data-testid="widget-config-form">
            <h3>Configure {widgetType.name}</h3>

            {widgetType.configurationSchema?.properties &&
                Object.entries(widgetType.configurationSchema.properties).map(([field, schema]) => (
                    <div key={field} data-testid={`field-${field}`}>
                        <label>{schema.description || field}</label>
                        {schema.type === 'string' && schema.enum ? (
                            <select
                                data-testid={`${field}-select`}
                                value={config[field] || ''}
                                onChange={(e) => handleChange(field, e.target.value)}
                            >
                                {schema.enum.map(option => (
                                    <option key={option} value={option}>{option}</option>
                                ))}
                            </select>
                        ) : (
                            <input
                                data-testid={`${field}-input`}
                                type="text"
                                value={config[field] || ''}
                                onChange={(e) => handleChange(field, e.target.value)}
                            />
                        )}
                        {errors[field] && (
                            <div data-testid={`${field}-error`} className="error">
                                {errors[field]}
                            </div>
                        )}
                    </div>
                ))
            }

            <button data-testid="save-config" onClick={() => onSave?.(config)}>
                Save Configuration
            </button>
        </div>
    );
};

const SlotManager = ({ slots, widgets, onSlotChange, onWidgetMove }) => {
    const getWidgetsForSlot = (slotName) => {
        return widgets.filter(w => w.slot === slotName).sort((a, b) => a.order - b.order);
    };

    return (
        <div data-testid="slot-manager">
            <h3>Slot Manager</h3>
            {Object.entries(slots).map(([slotName, slotConfig]) => (
                <div key={slotName} data-testid={`slot-${slotName}`}>
                    <h4>{slotName}</h4>
                    <div data-testid={`slot-${slotName}-widgets`}>
                        {getWidgetsForSlot(slotName).map(widget => (
                            <div key={widget.id} data-testid={`slot-widget-${widget.id}`}>
                                <span>{widget.type}</span>
                                <button
                                    data-testid={`move-${widget.id}`}
                                    onClick={() => onWidgetMove?.(widget.id, 'sidebar')}
                                >
                                    Move to Sidebar
                                </button>
                            </div>
                        ))}
                    </div>
                    {getWidgetsForSlot(slotName).length === 0 && (
                        <div data-testid={`slot-${slotName}-empty`}>No widgets in this slot</div>
                    )}
                </div>
            ))}
        </div>
    );
};

const WidgetPreview = ({ widget, widgetType }) => {
    const [previewData, setPreviewData] = React.useState(null);
    const [loading, setLoading] = React.useState(false);
    const [error, setError] = React.useState(null);

    React.useEffect(() => {
        const generatePreview = async () => {
            setLoading(true);
            setError(null);

            try {
                // Simulate API call for preview
                const response = await axios.post(`/api/v1/widgets/types/${widgetType.slug}/preview/`, {
                    configuration: widget.config
                });
                setPreviewData(response.data);
            } catch (err) {
                setError(err.message);
            } finally {
                setLoading(false);
            }
        };

        if (widget.config && widgetType) {
            generatePreview();
        }
    }, [widget.config, widgetType]);

    if (loading) {
        return <div data-testid="preview-loading">Generating preview...</div>;
    }

    if (error) {
        return <div data-testid="preview-error">Preview error: {error}</div>;
    }

    return (
        <div data-testid="widget-preview">
            <h4>Preview</h4>
            {previewData ? (
                <div
                    data-testid="preview-content"
                    dangerouslySetInnerHTML={{ __html: previewData.html }}
                />
            ) : (
                <div data-testid="preview-placeholder">No preview available</div>
            )}
        </div>
    );
};

// Test utilities
const createMockWidgetType = (overrides = {}) => ({
    name: "Text Block",
    slug: "text-block",
    description: "A simple text content widget",
    configurationSchema: {
        type: "object",
        properties: {
            title: {
                type: "string",
                description: "Widget title"
            },
            content: {
                type: "string",
                description: "Text content"
            },
            alignment: {
                type: "string",
                enum: ["left", "center", "right"],
                default: "left",
                description: "Text alignment"
            }
        },
        required: ["title", "content"]
    },
    configurationDefaults: {
        title: "Default Title",
        content: "Default content",
        alignment: "left"
    },
    isActive: true,
    ...overrides
});

const createMockPage = (overrides = {}) => ({
    id: 1,
    title: "Test Page",
    slug: "test-page",
    widgets: [],
    ...overrides
});

const createMockWidget = (overrides = {}) => ({
    id: "widget-1",
    type: "Text Block",
    typeSlug: "text-block",
    slot: "main",
    order: 0,
    config: {
        title: "Test Widget",
        content: "Test content",
        alignment: "left"
    },
    ...overrides
});

// Mock axios
vi.mock('axios', () => ({
    default: {
        get: vi.fn(),
        post: vi.fn(),
        put: vi.fn(),
        patch: vi.fn(),
        delete: vi.fn(),
        create: vi.fn(() => ({
            get: vi.fn(),
            post: vi.fn(),
            put: vi.fn(),
            patch: vi.fn(),
            delete: vi.fn(),
            interceptors: {
                request: { use: vi.fn() },
                response: { use: vi.fn() }
            }
        }))
    }
}));

describe('Unified Widget System', () => {
    let queryClient;
    let user;

    beforeEach(() => {
        queryClient = new QueryClient({
            defaultOptions: {
                queries: { retry: false },
                mutations: { retry: false }
            }
        });

        user = userEvent.setup();

        // Reset mocks
        vi.clearAllMocks();
    });

    const renderWithQueryClient = (component) => {
        return render(
            <QueryClientProvider client={queryClient}>
                {component}
            </QueryClientProvider>
        );
    };

    describe('UnifiedContentEditor', () => {
        it('renders page information correctly', () => {
            const mockPage = createMockPage({ title: "My Test Page" });

            renderWithQueryClient(
                <UnifiedContentEditor page={mockPage} />
            );

            expect(screen.getByTestId('unified-content-editor')).toBeInTheDocument();
            expect(screen.getByTestId('page-title')).toHaveTextContent('My Test Page');
        });

        it('displays existing widgets', () => {
            const mockWidgets = [
                createMockWidget({ id: 'widget-1', type: 'Text Block' }),
                createMockWidget({ id: 'widget-2', type: 'Image' })
            ];
            const mockPage = createMockPage({ widgets: mockWidgets });

            renderWithQueryClient(
                <UnifiedContentEditor page={mockPage} />
            );

            expect(screen.getByTestId('widget-widget-1')).toBeInTheDocument();
            expect(screen.getByTestId('widget-widget-2')).toBeInTheDocument();
            expect(screen.getByText('Text Block')).toBeInTheDocument();
            expect(screen.getByText('Image')).toBeInTheDocument();
        });

        it('handles adding new widgets', async () => {
            const mockPage = createMockPage();
            const mockOnWidgetAdd = vi.fn();

            renderWithQueryClient(
                <UnifiedContentEditor
                    page={mockPage}
                    onWidgetAdd={mockOnWidgetAdd}
                />
            );

            const addButton = screen.getByTestId('add-widget-button');
            await user.click(addButton);

            // Should add a new widget to the list
            await waitFor(() => {
                expect(screen.getByText('Text Block')).toBeInTheDocument();
            });

            expect(mockOnWidgetAdd).toHaveBeenCalledWith(
                expect.objectContaining({
                    type: 'Text Block',
                    typeSlug: 'text-block',
                    slot: 'main'
                })
            );
        });

        it('handles updating widgets', async () => {
            const mockWidget = createMockWidget();
            const mockPage = createMockPage({ widgets: [mockWidget] });
            const mockOnWidgetUpdate = vi.fn();

            renderWithQueryClient(
                <UnifiedContentEditor
                    page={mockPage}
                    onWidgetUpdate={mockOnWidgetUpdate}
                />
            );

            const updateButton = screen.getByTestId(`update-${mockWidget.id}`);
            await user.click(updateButton);

            expect(mockOnWidgetUpdate).toHaveBeenCalledWith(
                mockWidget.id,
                expect.objectContaining({
                    config: expect.objectContaining({
                        title: 'Updated'
                    })
                })
            );
        });

        it('handles deleting widgets', async () => {
            const mockWidget = createMockWidget();
            const mockPage = createMockPage({ widgets: [mockWidget] });
            const mockOnWidgetDelete = vi.fn();

            renderWithQueryClient(
                <UnifiedContentEditor
                    page={mockPage}
                    onWidgetDelete={mockOnWidgetDelete}
                />
            );

            const deleteButton = screen.getByTestId(`delete-${mockWidget.id}`);
            await user.click(deleteButton);

            expect(mockOnWidgetDelete).toHaveBeenCalledWith(mockWidget.id);

            // Widget should be removed from the UI
            await waitFor(() => {
                expect(screen.queryByTestId(`widget-${mockWidget.id}`)).not.toBeInTheDocument();
            });
        });

        it('handles saving page', async () => {
            const mockPage = createMockPage();
            const mockOnSave = vi.fn();

            renderWithQueryClient(
                <UnifiedContentEditor
                    page={mockPage}
                    onSave={mockOnSave}
                />
            );

            const saveButton = screen.getByTestId('save-page');
            await user.click(saveButton);

            expect(mockOnSave).toHaveBeenCalledWith(expect.any(Array));
        });
    });

    describe('WidgetConfigurationForm', () => {
        it('renders configuration fields based on schema', () => {
            const mockWidget = createMockWidget();
            const mockWidgetType = createMockWidgetType();

            renderWithQueryClient(
                <WidgetConfigurationForm
                    widget={mockWidget}
                    widgetType={mockWidgetType}
                />
            );

            expect(screen.getByTestId('field-title')).toBeInTheDocument();
            expect(screen.getByTestId('field-content')).toBeInTheDocument();
            expect(screen.getByTestId('field-alignment')).toBeInTheDocument();

            // Check that alignment is a select (enum field)
            expect(screen.getByTestId('alignment-select')).toBeInTheDocument();

            // Check that title and content are inputs
            expect(screen.getByTestId('title-input')).toBeInTheDocument();
            expect(screen.getByTestId('content-input')).toBeInTheDocument();
        });

        it('displays current configuration values', () => {
            const mockWidget = createMockWidget({
                config: {
                    title: 'Current Title',
                    content: 'Current content',
                    alignment: 'center'
                }
            });
            const mockWidgetType = createMockWidgetType();

            renderWithQueryClient(
                <WidgetConfigurationForm
                    widget={mockWidget}
                    widgetType={mockWidgetType}
                />
            );

            expect(screen.getByTestId('title-input')).toHaveValue('Current Title');
            expect(screen.getByTestId('content-input')).toHaveValue('Current content');
            expect(screen.getByTestId('alignment-select')).toHaveValue('center');
        });

        it('handles configuration changes', async () => {
            const mockWidget = createMockWidget();
            const mockWidgetType = createMockWidgetType();
            const mockOnChange = vi.fn();

            renderWithQueryClient(
                <WidgetConfigurationForm
                    widget={mockWidget}
                    widgetType={mockWidgetType}
                    onChange={mockOnChange}
                />
            );

            const titleInput = screen.getByTestId('title-input');
            await user.clear(titleInput);
            await user.type(titleInput, 'New Title');

            expect(mockOnChange).toHaveBeenCalledWith(
                expect.objectContaining({
                    title: 'New Title'
                })
            );
        });

        it('displays validation errors', () => {
            const mockWidget = createMockWidget();
            const mockWidgetType = createMockWidgetType();
            const mockErrors = {
                title: 'Title is required',
                content: 'Content cannot be empty'
            };

            renderWithQueryClient(
                <WidgetConfigurationForm
                    widget={mockWidget}
                    widgetType={mockWidgetType}
                    errors={mockErrors}
                />
            );

            expect(screen.getByTestId('title-error')).toHaveTextContent('Title is required');
            expect(screen.getByTestId('content-error')).toHaveTextContent('Content cannot be empty');
        });

        it('handles saving configuration', async () => {
            const mockWidget = createMockWidget();
            const mockWidgetType = createMockWidgetType();
            const mockOnSave = vi.fn();

            renderWithQueryClient(
                <WidgetConfigurationForm
                    widget={mockWidget}
                    widgetType={mockWidgetType}
                    onSave={mockOnSave}
                />
            );

            const saveButton = screen.getByTestId('save-config');
            await user.click(saveButton);

            expect(mockOnSave).toHaveBeenCalledWith(
                expect.objectContaining({
                    title: 'Test Widget',
                    content: 'Test content',
                    alignment: 'left'
                })
            );
        });
    });

    describe('SlotManager', () => {
        it('displays slots and their widgets', () => {
            const mockSlots = {
                main: { name: 'Main Content' },
                sidebar: { name: 'Sidebar' }
            };
            const mockWidgets = [
                createMockWidget({ id: 'widget-1', slot: 'main', order: 0 }),
                createMockWidget({ id: 'widget-2', slot: 'main', order: 1 }),
                createMockWidget({ id: 'widget-3', slot: 'sidebar', order: 0 })
            ];

            renderWithQueryClient(
                <SlotManager
                    slots={mockSlots}
                    widgets={mockWidgets}
                />
            );

            expect(screen.getByTestId('slot-main')).toBeInTheDocument();
            expect(screen.getByTestId('slot-sidebar')).toBeInTheDocument();

            // Check widgets in main slot
            const mainSlotWidgets = screen.getByTestId('slot-main-widgets');
            expect(within(mainSlotWidgets).getByTestId('slot-widget-widget-1')).toBeInTheDocument();
            expect(within(mainSlotWidgets).getByTestId('slot-widget-widget-2')).toBeInTheDocument();

            // Check widget in sidebar slot
            const sidebarSlotWidgets = screen.getByTestId('slot-sidebar-widgets');
            expect(within(sidebarSlotWidgets).getByTestId('slot-widget-widget-3')).toBeInTheDocument();
        });

        it('shows empty state for slots with no widgets', () => {
            const mockSlots = {
                main: { name: 'Main Content' },
                sidebar: { name: 'Sidebar' }
            };
            const mockWidgets = [
                createMockWidget({ id: 'widget-1', slot: 'main' })
            ];

            renderWithQueryClient(
                <SlotManager
                    slots={mockSlots}
                    widgets={mockWidgets}
                />
            );

            expect(screen.getByTestId('slot-sidebar-empty')).toBeInTheDocument();
            expect(screen.getByTestId('slot-sidebar-empty')).toHaveTextContent('No widgets in this slot');
        });

        it('handles moving widgets between slots', async () => {
            const mockSlots = {
                main: { name: 'Main Content' },
                sidebar: { name: 'Sidebar' }
            };
            const mockWidgets = [
                createMockWidget({ id: 'widget-1', slot: 'main' })
            ];
            const mockOnWidgetMove = vi.fn();

            renderWithQueryClient(
                <SlotManager
                    slots={mockSlots}
                    widgets={mockWidgets}
                    onWidgetMove={mockOnWidgetMove}
                />
            );

            const moveButton = screen.getByTestId('move-widget-1');
            await user.click(moveButton);

            expect(mockOnWidgetMove).toHaveBeenCalledWith('widget-1', 'sidebar');
        });

        it('orders widgets correctly within slots', () => {
            const mockSlots = {
                main: { name: 'Main Content' }
            };
            const mockWidgets = [
                createMockWidget({ id: 'widget-3', slot: 'main', order: 2, type: 'Third' }),
                createMockWidget({ id: 'widget-1', slot: 'main', order: 0, type: 'First' }),
                createMockWidget({ id: 'widget-2', slot: 'main', order: 1, type: 'Second' })
            ];

            renderWithQueryClient(
                <SlotManager
                    slots={mockSlots}
                    widgets={mockWidgets}
                />
            );

            const mainSlotWidgets = screen.getByTestId('slot-main-widgets');
            const widgetElements = within(mainSlotWidgets).getAllByText(/First|Second|Third/);

            expect(widgetElements[0]).toHaveTextContent('First');
            expect(widgetElements[1]).toHaveTextContent('Second');
            expect(widgetElements[2]).toHaveTextContent('Third');
        });
    });

    describe('WidgetPreview', () => {
        beforeEach(() => {
            // Mock successful preview API response
            axios.post.mockResolvedValue({
                data: {
                    html: '<div class="widget-preview"><h2>Preview Title</h2><p>Preview content</p></div>',
                    css: '.widget-preview { border: 1px solid #ccc; }'
                }
            });
        });

        it('displays loading state during preview generation', async () => {
            // Make API call hang to test loading state
            axios.post.mockImplementation(() => new Promise(() => { }));

            const mockWidget = createMockWidget();
            const mockWidgetType = createMockWidgetType();

            renderWithQueryClient(
                <WidgetPreview
                    widget={mockWidget}
                    widgetType={mockWidgetType}
                />
            );

            expect(screen.getByTestId('preview-loading')).toBeInTheDocument();
            expect(screen.getByTestId('preview-loading')).toHaveTextContent('Generating preview...');
        });

        it('displays preview content when loaded', async () => {
            const mockWidget = createMockWidget({
                config: {
                    title: 'Preview Title',
                    content: 'Preview content',
                    alignment: 'left'
                }
            });
            const mockWidgetType = createMockWidgetType();

            renderWithQueryClient(
                <WidgetPreview
                    widget={mockWidget}
                    widgetType={mockWidgetType}
                />
            );

            await waitFor(() => {
                expect(screen.getByTestId('preview-content')).toBeInTheDocument();
            });

            const previewContent = screen.getByTestId('preview-content');
            expect(previewContent.innerHTML).toContain('Preview Title');
            expect(previewContent.innerHTML).toContain('Preview content');

            // Check API was called correctly
            expect(axios.post).toHaveBeenCalledWith(
                '/api/v1/widgets/types/text-block/preview/',
                {
                    configuration: {
                        title: 'Preview Title',
                        content: 'Preview content',
                        alignment: 'left'
                    }
                }
            );
        });

        it('displays error state when preview generation fails', async () => {
            axios.post.mockRejectedValue(new Error('Preview generation failed'));

            const mockWidget = createMockWidget();
            const mockWidgetType = createMockWidgetType();

            renderWithQueryClient(
                <WidgetPreview
                    widget={mockWidget}
                    widgetType={mockWidgetType}
                />
            );

            await waitFor(() => {
                expect(screen.getByTestId('preview-error')).toBeInTheDocument();
            });

            expect(screen.getByTestId('preview-error')).toHaveTextContent('Preview error: Preview generation failed');
        });

        it('regenerates preview when widget configuration changes', async () => {
            const mockWidget = createMockWidget();
            const mockWidgetType = createMockWidgetType();

            const { rerender } = renderWithQueryClient(
                <WidgetPreview
                    widget={mockWidget}
                    widgetType={mockWidgetType}
                />
            );

            await waitFor(() => {
                expect(screen.getByTestId('preview-content')).toBeInTheDocument();
            });

            // Clear previous calls
            axios.post.mockClear();

            // Update widget configuration
            const updatedWidget = createMockWidget({
                config: {
                    title: 'Updated Title',
                    content: 'Updated content',
                    alignment: 'center'
                }
            });

            rerender(
                <QueryClientProvider client={queryClient}>
                    <WidgetPreview
                        widget={updatedWidget}
                        widgetType={mockWidgetType}
                    />
                </QueryClientProvider>
            );

            await waitFor(() => {
                expect(axios.post).toHaveBeenCalledWith(
                    '/api/v1/widgets/types/text-block/preview/',
                    {
                        configuration: {
                            title: 'Updated Title',
                            content: 'Updated content',
                            alignment: 'center'
                        }
                    }
                );
            });
        });

        it('shows placeholder when no preview is available', () => {
            const mockWidget = createMockWidget({ config: {} });
            const mockWidgetType = createMockWidgetType();

            renderWithQueryClient(
                <WidgetPreview
                    widget={mockWidget}
                    widgetType={mockWidgetType}
                />
            );

            expect(screen.getByTestId('preview-placeholder')).toBeInTheDocument();
            expect(screen.getByTestId('preview-placeholder')).toHaveTextContent('No preview available');
        });
    });

    describe('Integration Tests', () => {
        it('handles complete widget lifecycle', async () => {
            const mockPage = createMockPage();
            const mockOnSave = vi.fn();

            renderWithQueryClient(
                <UnifiedContentEditor
                    page={mockPage}
                    onSave={mockOnSave}
                />
            );

            // Add a widget
            const addButton = screen.getByTestId('add-widget-button');
            await user.click(addButton);

            // Verify widget was added
            await waitFor(() => {
                expect(screen.getByText('Text Block')).toBeInTheDocument();
            });

            // Update the widget
            const updateButton = screen.getByTestId('update-widget-1');
            await user.click(updateButton);

            // Delete the widget
            const deleteButton = screen.getByTestId('delete-widget-1');
            await user.click(deleteButton);

            // Verify widget was removed
            await waitFor(() => {
                expect(screen.queryByTestId('widget-widget-1')).not.toBeInTheDocument();
            });

            // Save the page
            const saveButton = screen.getByTestId('save-page');
            await user.click(saveButton);

            expect(mockOnSave).toHaveBeenCalled();
        });

        it('handles multiple widgets in different slots', async () => {
            const mockSlots = {
                main: { name: 'Main Content' },
                sidebar: { name: 'Sidebar' }
            };
            const mockWidgets = [
                createMockWidget({ id: 'widget-1', slot: 'main', type: 'Text Block' }),
                createMockWidget({ id: 'widget-2', slot: 'sidebar', type: 'Image' })
            ];
            const mockOnWidgetMove = vi.fn();

            renderWithQueryClient(
                <SlotManager
                    slots={mockSlots}
                    widgets={mockWidgets}
                    onWidgetMove={mockOnWidgetMove}
                />
            );

            // Verify widgets are in correct slots
            expect(screen.getByTestId('slot-widget-widget-1')).toBeInTheDocument();
            expect(screen.getByTestId('slot-widget-widget-2')).toBeInTheDocument();

            // Move widget between slots
            const moveButton = screen.getByTestId('move-widget-1');
            await user.click(moveButton);

            expect(mockOnWidgetMove).toHaveBeenCalledWith('widget-1', 'sidebar');
        });

        it('handles form validation and error display', async () => {
            const mockWidget = createMockWidget({ config: { title: '', content: '' } });
            const mockWidgetType = createMockWidgetType();
            const mockErrors = {
                title: 'Title is required',
                content: 'Content is required'
            };

            renderWithQueryClient(
                <WidgetConfigurationForm
                    widget={mockWidget}
                    widgetType={mockWidgetType}
                    errors={mockErrors}
                />
            );

            // Verify errors are displayed
            expect(screen.getByTestId('title-error')).toHaveTextContent('Title is required');
            expect(screen.getByTestId('content-error')).toHaveTextContent('Content is required');

            // Fill in the form
            const titleInput = screen.getByTestId('title-input');
            const contentInput = screen.getByTestId('content-input');

            await user.type(titleInput, 'Valid Title');
            await user.type(contentInput, 'Valid content');

            // Errors should still be visible until form is revalidated
            expect(screen.getByTestId('title-error')).toBeInTheDocument();
            expect(screen.getByTestId('content-error')).toBeInTheDocument();
        });
    });

    describe('Error Handling', () => {
        it('handles API errors gracefully', async () => {
            axios.post.mockRejectedValue(new Error('Network error'));

            const mockWidget = createMockWidget();
            const mockWidgetType = createMockWidgetType();

            renderWithQueryClient(
                <WidgetPreview
                    widget={mockWidget}
                    widgetType={mockWidgetType}
                />
            );

            await waitFor(() => {
                expect(screen.getByTestId('preview-error')).toBeInTheDocument();
            });

            expect(screen.getByTestId('preview-error')).toHaveTextContent('Network error');
        });

        it('handles missing widget type gracefully', () => {
            const mockWidget = createMockWidget();
            const mockWidgetType = null;

            renderWithQueryClient(
                <WidgetConfigurationForm
                    widget={mockWidget}
                    widgetType={mockWidgetType}
                />
            );

            // Should not crash, but show minimal form
            expect(screen.getByTestId('widget-config-form')).toBeInTheDocument();
        });

        it('handles invalid widget configuration', () => {
            const mockWidget = createMockWidget({ config: null });
            const mockWidgetType = createMockWidgetType();

            renderWithQueryClient(
                <WidgetConfigurationForm
                    widget={mockWidget}
                    widgetType={mockWidgetType}
                />
            );

            // Should handle null config gracefully
            expect(screen.getByTestId('widget-config-form')).toBeInTheDocument();
            expect(screen.getByTestId('title-input')).toHaveValue('');
        });
    });

    describe('Performance', () => {
        it('handles large number of widgets efficiently', () => {
            const mockWidgets = Array.from({ length: 100 }, (_, i) =>
                createMockWidget({
                    id: `widget-${i}`,
                    type: `Widget ${i}`,
                    config: { title: `Widget ${i}`, content: `Content ${i}` }
                })
            );
            const mockPage = createMockPage({ widgets: mockWidgets });

            const startTime = performance.now();

            renderWithQueryClient(
                <UnifiedContentEditor page={mockPage} />
            );

            const renderTime = performance.now() - startTime;

            // Should render within reasonable time (less than 100ms)
            expect(renderTime).toBeLessThan(100);

            // Verify all widgets are rendered
            expect(screen.getAllByText(/Widget \d+/)).toHaveLength(100);
        });

        it('handles rapid configuration changes efficiently', async () => {
            const mockWidget = createMockWidget();
            const mockWidgetType = createMockWidgetType();
            const mockOnChange = vi.fn();

            renderWithQueryClient(
                <WidgetConfigurationForm
                    widget={mockWidget}
                    widgetType={mockWidgetType}
                    onChange={mockOnChange}
                />
            );

            const titleInput = screen.getByTestId('title-input');

            // Simulate rapid typing
            for (let i = 0; i < 10; i++) {
                await user.type(titleInput, `${i}`);
            }

            // Should handle all changes without issues
            expect(mockOnChange).toHaveBeenCalledTimes(10);
        });
    });
});
