import { AppState, StateUpdate, StateSelector } from '../types/state';
import { Operation, ValidationResult, OperationTypes } from '../types/operations';
import { StateUpdateCallback, SubscriptionOptions } from '../types/subscriptions';
import { SubscriptionManager } from './SubscriptionManager';
import { defaultEqualityFn } from '../utils/equality';
import { OperationError, ValidationError, StateError, ErrorCodes, isRetryableError } from '../utils/errors';

interface PrioritizedOperation extends Operation {
    priority?: 'high' | 'normal' | 'low';
    timeoutId?: NodeJS.Timeout;
}

interface DebouncedOperation {
    operation: Operation;
    timeoutId: NodeJS.Timeout;
    resolve: (value: void | PromiseLike<void>) => void;
    reject: (reason?: any) => void;
}

/**
 * Core DataManager class responsible for state management, operations, and subscriptions
 */
export class DataManager {
    private state: AppState;
    private subscriptionManager: SubscriptionManager;
    private operationQueue: PrioritizedOperation[] = [];
    private isProcessing: boolean = false;
    private selectorCache = new Map<string, any>();
    private debouncedOperations = new Map<string, DebouncedOperation>();
    private batchedNotifications = new Set<string>();
    private batchTimeout: NodeJS.Timeout | null = null;

    constructor(initialState?: Partial<AppState>) {
        this.validateInitialState(initialState);

        // Initialize with default state structure
        this.state = {
            pages: {},
            widgets: {},
            layouts: {},
            versions: {},
            ...initialState
        };

        // Initialize subscription manager
        this.subscriptionManager = new SubscriptionManager();
    }

    /**
     * Validate initial state
     */
    private validateInitialState(state?: Partial<AppState>): void {
        if (!state) return;

        try {
            // Validate widget-page relationships
            if (state.widgets && state.pages) {
                Object.values(state.widgets).forEach(widget => {
                    if (widget.pageId && !state.pages?.[widget.pageId]) {
                        throw new StateError(
                            ErrorCodes.INVALID_INITIAL_STATE,
                            `Widget ${widget.id} references non-existent page ${widget.pageId}`,
                            { widgetId: widget.id, pageId: widget.pageId }
                        );
                    }
                });
            }

            // Validate layout-slot relationships
            if (state.layouts) {
                Object.values(state.layouts).forEach(layout => {
                    const slotIds = new Set(layout.slots.map(s => s.id));
                    if (slotIds.size !== layout.slots.length) {
                        throw new StateError(
                            ErrorCodes.INVALID_INITIAL_STATE,
                            `Layout ${layout.id} contains duplicate slot IDs`,
                            { layoutId: layout.id }
                        );
                    }
                });
            }
        } catch (error) {
            if (error instanceof StateError) {
                throw error;
            }
            throw new StateError(
                ErrorCodes.INVALID_INITIAL_STATE,
                'Invalid initial state',
                { error }
            );
        }
    }

    /**
     * Get current state
     */
    getState(): AppState {
        return this.state;
    }

    /**
     * Update state with new values
     */
    private setState(update: StateUpdate): void {
        const prevState = this.state;
        
        // Handle function updates
        const newState = typeof update === 'function' 
            ? { ...prevState, ...update(prevState) }
            : { ...prevState, ...update };

        this.state = newState;
        
        // Update metadata
        this.state.metadata.lastUpdated = new Date().toISOString();
        
        // Clear selector cache
        this.selectorCache.clear();
        
        // Schedule notification
        this.scheduleStateNotification();
    }

    /**
     * Schedule batched state notifications
     */
    private scheduleStateNotification(): void {
        if (this.batchTimeout) {
            clearTimeout(this.batchTimeout);
        }

        this.batchTimeout = setTimeout(() => {
            this.processBatchedNotifications();
        }, 0);
    }

    /**
     * Process batched notifications
     */
    private processBatchedNotifications(): void {
        this.batchTimeout = null;
        this.subscriptionManager.notifyStateUpdate(this.state);
    }

    /**
     * Get memoized selector result
     */
    private getMemoizedSelector<T>(selector: StateSelector<T>): T {
        const key = selector.toString();
        
        if (!this.selectorCache.has(key)) {
            this.selectorCache.set(key, selector(this.state));
        }
        
        return this.selectorCache.get(key);
    }

    /**
     * Validate an operation before processing
     */
    private validateOperation(operation: Operation): ValidationResult {
        try {
            // Basic validation
            if (!operation.type || !Object.values(OperationTypes).includes(operation.type as any)) {
                throw new ValidationError(operation, 
                    `Invalid operation type: ${operation.type}`,
                    { type: operation.type }
                );
            }

            // Payload validation based on operation type
            switch (operation.type) {
                case OperationTypes.UPDATE_WIDGET_CONFIG:
                    if (!operation.payload?.id || !operation.payload?.config) {
                        throw new ValidationError(operation,
                            'Widget ID and config are required',
                            { payload: operation.payload }
                        );
                    }
                    break;
                
                case OperationTypes.MOVE_WIDGET:
                    if (!operation.payload?.id || !operation.payload?.slot) {
                        throw new ValidationError(operation,
                            'Widget ID and slot are required',
                            { payload: operation.payload }
                        );
                    }
                    break;
            }

            return { isValid: true };
        } catch (error) {
            if (error instanceof ValidationError) {
                return {
                    isValid: false,
                    errors: [{
                        field: error.code,
                        message: error.message,
                        code: error.code
                    }]
                };
            }
            
            return {
                isValid: false,
                errors: [{
                    field: 'unknown',
                    message: error instanceof Error ? error.message : 'Unknown error',
                    code: ErrorCodes.INVALID_OPERATION
                }]
            };
        }
    }

    /**
     * Process a single operation with rollback support
     */
    protected async processOperation(operation: Operation): Promise<void> {
        const previousState = { ...this.state };
        
        try {
            const validation = this.validateOperation(operation);
            if (!validation.isValid) {
                throw new ValidationError(
                    operation,
                    `Invalid operation: ${validation.errors?.[0]?.message}`,
                    validation.errors
                );
            }

            // Add validation result to operation metadata
            operation.metadata = {
                ...operation.metadata,
                timestamp: Date.now(),
                validation
            };

            // Process based on operation type
            switch (operation.type) {
                case OperationTypes.UPDATE_WIDGET_CONFIG:
                    this.setState(state => {
                        const existingWidget = state.widgets[operation.payload.id];
                        
                        // Update unsaved changes - isDirty will be computed automatically
                        const updatedUnsavedChanges = {
                            ...state.metadata.widgetStates.unsavedChanges,
                            [operation.payload.id]: true
                        };
                        
                        const newIsDirty = Object.values(updatedUnsavedChanges).some(Boolean);
                        
                        const baseMetadata = {
                            ...state.metadata,
                            isDirty: newIsDirty, // Compute isDirty from unsavedChanges
                            widgetStates: {
                                ...state.metadata.widgetStates,
                                unsavedChanges: updatedUnsavedChanges
                            }
                        };

                        // If widget doesn't exist in our state, just update metadata
                        if (!existingWidget) {
                            return {
                                ...state,
                                metadata: baseMetadata
                            };
                        }

                        // Widget exists, update it and metadata
                        return {
                            widgets: {
                                ...state.widgets,
                                [operation.payload.id]: {
                                    ...existingWidget,
                                    config: {
                                        ...existingWidget.config,
                                        ...operation.payload.config
                                    },
                                    updated_at: new Date().toISOString()
                                }
                            },
                            metadata: baseMetadata
                        };
                    });
                    break;

                case OperationTypes.MOVE_WIDGET:
                    this.setState(state => {
                        const widget = state.widgets[operation.payload.id];
                        
                        // Update unsaved changes - isDirty will be computed automatically
                        const updatedUnsavedChanges = {
                            ...state.metadata.widgetStates.unsavedChanges,
                            [operation.payload.id]: true
                        };
                        
                        const newIsDirty = Object.values(updatedUnsavedChanges).some(Boolean);
                        
                        const baseMetadata = {
                            ...state.metadata,
                            isDirty: newIsDirty, // Compute isDirty from unsavedChanges
                            widgetStates: {
                                ...state.metadata.widgetStates,
                                unsavedChanges: updatedUnsavedChanges
                            }
                        };

                        if (!widget) {
                            return {
                                ...state,
                                metadata: baseMetadata
                            };
                        }

                        return {
                            widgets: {
                                ...state.widgets,
                                [operation.payload.id]: {
                                    ...widget,
                                    slot: operation.payload.slot,
                                    order: operation.payload.order,
                                    updated_at: new Date().toISOString()
                                }
                            },
                            metadata: baseMetadata
                        };
                    });
                    break;

                case OperationTypes.ADD_WIDGET:
                    this.setState(state => {
                        const newWidget = {
                            id: operation.payload.widgetId,
                            type: operation.payload.widgetType,
                            slot: operation.payload.slotId,
                            config: operation.payload.config || {},
                            order: 0,
                            pageId: operation.payload.pageId,
                            created_at: new Date().toISOString(),
                            updated_at: new Date().toISOString()
                        };

                        const updatedUnsavedChanges = {
                            ...state.metadata.widgetStates.unsavedChanges,
                            [newWidget.id]: true
                        };

                        return {
                            widgets: {
                                ...state.widgets,
                                [newWidget.id]: newWidget
                            },
                            metadata: {
                                ...state.metadata,
                                isDirty: Object.values(updatedUnsavedChanges).some(Boolean),
                                widgetStates: {
                                    ...state.metadata.widgetStates,
                                    unsavedChanges: updatedUnsavedChanges
                                }
                            }
                        };
                    });
                    break;

                case OperationTypes.REMOVE_WIDGET:
                    this.setState(state => {
                        const { [operation.payload.id]: removedWidget, ...remainingWidgets } = state.widgets;
                        
                        const updatedUnsavedChanges = { ...state.metadata.widgetStates.unsavedChanges };
                        delete updatedUnsavedChanges[operation.payload.id];

                        return {
                            widgets: remainingWidgets,
                            metadata: {
                                ...state.metadata,
                                isDirty: Object.values(updatedUnsavedChanges).some(Boolean),
                                widgetStates: {
                                    ...state.metadata.widgetStates,
                                    unsavedChanges: updatedUnsavedChanges
                                }
                            }
                        };
                    });
                    break;

                case OperationTypes.BATCH:
                    if (Array.isArray(operation.payload)) {
                        for (const op of operation.payload) {
                            await this.processOperation(op);
                        }
                    }
                    break;

                case OperationTypes.SET_DIRTY:
                    this.setState(state => {
                        // Create a dummy unsaved change to force isDirty state
                        const updatedUnsavedChanges = operation.payload.isDirty
                            ? { ...state.metadata.widgetStates.unsavedChanges, '_global': true }
                            : {};

                        return {
                            metadata: {
                                ...state.metadata,
                                isDirty: operation.payload.isDirty,
                                widgetStates: {
                                    ...state.metadata.widgetStates,
                                    unsavedChanges: updatedUnsavedChanges
                                }
                            }
                        };
                    });
                    break;

                case OperationTypes.RESET_STATE:
                    this.setState(state => {
                        const clearedUnsavedChanges = {};
                        const newIsDirty = Object.values(clearedUnsavedChanges).some(Boolean); // Should be false
                        
                        return {
                            metadata: {
                                ...state.metadata,
                                isDirty: newIsDirty,
                                widgetStates: {
                                    ...state.metadata.widgetStates,
                                    unsavedChanges: clearedUnsavedChanges
                                }
                            }
                        };
                    });
                    break;

                case OperationTypes.CLEAR_ERRORS:
                    this.setState(state => ({
                        metadata: {
                            ...state.metadata,
                            errors: {}
                        }
                    }));
                    break;

                case OperationTypes.MARK_WIDGET_SAVED:
                    this.setState(state => {
                        const updatedUnsavedChanges = { ...state.metadata.widgetStates.unsavedChanges };
                        delete updatedUnsavedChanges[operation.payload.widgetId];
                        
                        const newIsDirty = Object.values(updatedUnsavedChanges).some(Boolean);
                        
                        return {
                            metadata: {
                                ...state.metadata,
                                isDirty: newIsDirty, // Recompute isDirty
                                widgetStates: {
                                    ...state.metadata.widgetStates,
                                    unsavedChanges: updatedUnsavedChanges
                                }
                            }
                        };
                    });
                    break;

                case OperationTypes.LOAD_PAGE_DATA:
                    this.setState(state => {
                        console.log('📥 Loading page data into UnifiedDataContext:', operation.payload);
                        
                        return {
                            pages: {
                                ...state.pages,
                                [operation.payload.pageId]: operation.payload.pageData
                            },
                            widgets: {
                                ...state.widgets,
                                ...operation.payload.widgets
                            },
                            layouts: operation.payload.layouts ? {
                                ...state.layouts,
                                ...operation.payload.layouts
                            } : state.layouts,
                            versions: operation.payload.versions ? {
                                ...state.versions,
                                ...operation.payload.versions
                            } : state.versions,
                            metadata: {
                                ...state.metadata,
                                isLoading: false,
                                lastUpdated: new Date().toISOString()
                            }
                        };
                    });
                    break;

                case OperationTypes.LOAD_WIDGET_DATA:
                    this.setState(state => ({
                        widgets: {
                            ...state.widgets,
                            ...operation.payload.widgets
                        },
                        metadata: {
                            ...state.metadata,
                            lastUpdated: new Date().toISOString()
                        }
                    }));
                    break;

                case OperationTypes.LOAD_LAYOUT_DATA:
                    this.setState(state => ({
                        layouts: {
                            ...state.layouts,
                            [operation.payload.layoutId]: operation.payload.layoutData
                        },
                        metadata: {
                            ...state.metadata,
                            lastUpdated: new Date().toISOString()
                        }
                    }));
                    break;

                case OperationTypes.SYNC_FROM_API:
                    this.setState(state => ({
                        ...state,
                        ...operation.payload.stateUpdates,
                        metadata: {
                            ...state.metadata,
                            ...operation.payload.stateUpdates?.metadata,
                            lastUpdated: new Date().toISOString()
                        }
                    }));
                    break;

                // Page operations
                case OperationTypes.UPDATE_PAGE:
                    this.setState(state => {
                        const page = state.pages[operation.payload.pageId];
                        if (!page) return state;

                        return {
                            pages: {
                                ...state.pages,
                                [operation.payload.pageId]: {
                                    ...page,
                                    ...operation.payload.updates,
                                    updated_at: new Date().toISOString()
                                }
                            },
                            metadata: {
                                ...state.metadata,
                                isDirty: true
                            }
                        };
                    });
                    break;

                case OperationTypes.UPDATE_PAGE_METADATA:
                    this.setState(state => {
                        const page = state.pages[operation.payload.pageId || operation.payload.id];
                        if (!page) return state;

                        return {
                            pages: {
                                ...state.pages,
                                [page.id]: {
                                    ...page,
                                    metadata: {
                                        ...page.metadata,
                                        ...operation.payload.metadata
                                    },
                                    updated_at: new Date().toISOString()
                                }
                            },
                            metadata: {
                                ...state.metadata,
                                isDirty: true
                            }
                        };
                    });
                    break;

                case OperationTypes.CREATE_PAGE:
                    this.setState(state => {
                        const newPage = {
                            id: operation.payload.pageId,
                            title: operation.payload.title || 'New Page',
                            slug: operation.payload.slug || 'new-page',
                            metadata: operation.payload.metadata || {},
                            layout: operation.payload.layout || 'single_column',
                            version: operation.payload.versionId || '',
                            status: 'draft',
                            created_at: new Date().toISOString(),
                            updated_at: new Date().toISOString()
                        };

                        return {
                            pages: {
                                ...state.pages,
                                [newPage.id]: newPage
                            },
                            metadata: {
                                ...state.metadata,
                                isDirty: true
                            }
                        };
                    });
                    break;

                case OperationTypes.DELETE_PAGE:
                    this.setState(state => {
                        const { [operation.payload.pageId]: deletedPage, ...remainingPages } = state.pages;
                        
                        // Also remove associated widgets and versions
                        const remainingWidgets = Object.fromEntries(
                            Object.entries(state.widgets).filter(([_, widget]) => 
                                widget.pageId !== operation.payload.pageId
                            )
                        );
                        
                        const remainingVersions = Object.fromEntries(
                            Object.entries(state.versions).filter(([_, version]) => 
                                version.page_id !== operation.payload.pageId
                            )
                        );

                        return {
                            pages: remainingPages,
                            widgets: remainingWidgets,
                            versions: remainingVersions,
                            metadata: {
                                ...state.metadata,
                                isDirty: true
                            }
                        };
                    });
                    break;

                case OperationTypes.PUBLISH_PAGE:
                    this.setState(state => {
                        const page = state.pages[operation.payload.pageId];
                        if (!page) return state;

                        return {
                            pages: {
                                ...state.pages,
                                [operation.payload.pageId]: {
                                    ...page,
                                    status: 'published',
                                    updated_at: new Date().toISOString()
                                }
                            },
                            metadata: {
                                ...state.metadata,
                                isDirty: true
                            }
                        };
                    });
                    break;

                case OperationTypes.UNPUBLISH_PAGE:
                    this.setState(state => {
                        const page = state.pages[operation.payload.pageId];
                        if (!page) return state;

                        return {
                            pages: {
                                ...state.pages,
                                [operation.payload.pageId]: {
                                    ...page,
                                    status: 'draft',
                                    updated_at: new Date().toISOString()
                                }
                            },
                            metadata: {
                                ...state.metadata,
                                isDirty: true
                            }
                        };
                    });
                    break;

                case OperationTypes.SCHEDULE_PAGE:
                    this.setState(state => {
                        const page = state.pages[operation.payload.pageId];
                        if (!page) return state;

                        return {
                            pages: {
                                ...state.pages,
                                [operation.payload.pageId]: {
                                    ...page,
                                    status: 'scheduled',
                                    metadata: {
                                        ...page.metadata,
                                        scheduledPublishAt: operation.payload.publishAt
                                    },
                                    updated_at: new Date().toISOString()
                                }
                            },
                            metadata: {
                                ...state.metadata,
                                isDirty: true
                            }
                        };
                    });
                    break;

                case OperationTypes.DUPLICATE_PAGE:
                    this.setState(state => {
                        const originalPage = state.pages[operation.payload.pageId];
                        if (!originalPage) return state;

                        const newPageId = operation.payload.newPageId || 
                                        `page-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
                        
                        const duplicatedPage = {
                            ...originalPage,
                            id: newPageId,
                            title: `${originalPage.title} (Copy)`,
                            slug: operation.payload.newSlug || `${originalPage.slug}-copy`,
                            status: 'draft',
                            created_at: new Date().toISOString(),
                            updated_at: new Date().toISOString()
                        };

                        // Duplicate associated widgets
                        const duplicatedWidgets: Record<string, any> = {};
                        Object.values(state.widgets).forEach(widget => {
                            if (widget.pageId === operation.payload.pageId) {
                                const newWidgetId = `widget-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
                                duplicatedWidgets[newWidgetId] = {
                                    ...widget,
                                    id: newWidgetId,
                                    pageId: newPageId,
                                    created_at: new Date().toISOString(),
                                    updated_at: new Date().toISOString()
                                };
                            }
                        });

                        return {
                            pages: {
                                ...state.pages,
                                [newPageId]: duplicatedPage
                            },
                            widgets: {
                                ...state.widgets,
                                ...duplicatedWidgets
                            },
                            metadata: {
                                ...state.metadata,
                                isDirty: true
                            }
                        };
                    });
                    break;

                // Layout operations
                case OperationTypes.CREATE_LAYOUT:
                    this.setState(state => {
                        const newLayout = {
                            id: operation.payload.layoutId,
                            name: operation.payload.name || 'New Layout',
                            slots: operation.payload.slots || [],
                            theme: operation.payload.theme,
                            metadata: operation.payload.metadata || {},
                            created_at: new Date().toISOString(),
                            updated_at: new Date().toISOString()
                        };

                        return {
                            layouts: {
                                ...state.layouts,
                                [newLayout.id]: newLayout
                            },
                            metadata: {
                                ...state.metadata,
                                isDirty: true
                            }
                        };
                    });
                    break;

                case OperationTypes.UPDATE_LAYOUT:
                    this.setState(state => {
                        const layout = state.layouts[operation.payload.layoutId];
                        if (!layout) return state;

                        return {
                            layouts: {
                                ...state.layouts,
                                [operation.payload.layoutId]: {
                                    ...layout,
                                    ...operation.payload.updates,
                                    updated_at: new Date().toISOString()
                                }
                            },
                            metadata: {
                                ...state.metadata,
                                isDirty: true
                            }
                        };
                    });
                    break;

                case OperationTypes.UPDATE_LAYOUT_THEME:
                    this.setState(state => {
                        const layout = state.layouts[operation.payload.layoutId];
                        if (!layout) return state;

                        return {
                            layouts: {
                                ...state.layouts,
                                [operation.payload.layoutId]: {
                                    ...layout,
                                    theme: operation.payload.theme,
                                    updated_at: new Date().toISOString()
                                }
                            },
                            metadata: {
                                ...state.metadata,
                                isDirty: true
                            }
                        };
                    });
                    break;

                case OperationTypes.ADD_LAYOUT_SLOT:
                    this.setState(state => {
                        const layout = state.layouts[operation.payload.layoutId];
                        if (!layout) return state;

                        const newSlot = {
                            id: operation.payload.slot.id || `slot-${Date.now()}`,
                            name: operation.payload.slot.name || 'New Slot',
                            allowedWidgets: operation.payload.slot.allowedWidgets || [],
                            metadata: operation.payload.slot.metadata || {}
                        };

                        return {
                            layouts: {
                                ...state.layouts,
                                [operation.payload.layoutId]: {
                                    ...layout,
                                    slots: [...layout.slots, newSlot],
                                    updated_at: new Date().toISOString()
                                }
                            },
                            metadata: {
                                ...state.metadata,
                                isDirty: true
                            }
                        };
                    });
                    break;

                case OperationTypes.REMOVE_LAYOUT_SLOT:
                    this.setState(state => {
                        const layout = state.layouts[operation.payload.layoutId];
                        if (!layout) return state;

                        return {
                            layouts: {
                                ...state.layouts,
                                [operation.payload.layoutId]: {
                                    ...layout,
                                    slots: layout.slots.filter(slot => slot.id !== operation.payload.slotId),
                                    updated_at: new Date().toISOString()
                                }
                            },
                            metadata: {
                                ...state.metadata,
                                isDirty: true
                            }
                        };
                    });
                    break;

                case OperationTypes.UPDATE_LAYOUT_SLOT:
                    this.setState(state => {
                        const layout = state.layouts[operation.payload.layoutId];
                        if (!layout) return state;

                        return {
                            layouts: {
                                ...state.layouts,
                                [operation.payload.layoutId]: {
                                    ...layout,
                                    slots: layout.slots.map(slot =>
                                        slot.id === operation.payload.slotId
                                            ? { ...slot, ...operation.payload.updates }
                                            : slot
                                    ),
                                    updated_at: new Date().toISOString()
                                }
                            },
                            metadata: {
                                ...state.metadata,
                                isDirty: true
                            }
                        };
                    });
                    break;

                case OperationTypes.REORDER_LAYOUT_SLOTS:
                    this.setState(state => {
                        const layout = state.layouts[operation.payload.layoutId];
                        if (!layout) return state;

                        const reorderedSlots = operation.payload.slotIds.map(slotId =>
                            layout.slots.find(slot => slot.id === slotId)
                        ).filter(Boolean);

                        return {
                            layouts: {
                                ...state.layouts,
                                [operation.payload.layoutId]: {
                                    ...layout,
                                    slots: reorderedSlots,
                                    updated_at: new Date().toISOString()
                                }
                            },
                            metadata: {
                                ...state.metadata,
                                isDirty: true
                            }
                        };
                    });
                    break;

                case OperationTypes.DUPLICATE_LAYOUT:
                    this.setState(state => {
                        const originalLayout = state.layouts[operation.payload.layoutId];
                        if (!originalLayout) return state;

                        const newLayoutId = operation.payload.newLayoutId || 
                                          `layout-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

                        const duplicatedLayout = {
                            ...originalLayout,
                            id: newLayoutId,
                            name: operation.payload.newName || `${originalLayout.name} (Copy)`,
                            created_at: new Date().toISOString(),
                            updated_at: new Date().toISOString()
                        };

                        return {
                            layouts: {
                                ...state.layouts,
                                [newLayoutId]: duplicatedLayout
                            },
                            metadata: {
                                ...state.metadata,
                                isDirty: true
                            }
                        };
                    });
                    break;

                case OperationTypes.DELETE_LAYOUT:
                    this.setState(state => {
                        const { [operation.payload.layoutId]: deletedLayout, ...remainingLayouts } = state.layouts;

                        return {
                            layouts: remainingLayouts,
                            metadata: {
                                ...state.metadata,
                                isDirty: true
                            }
                        };
                    });
                    break;

                // Version operations
                case OperationTypes.CREATE_VERSION:
                    this.setState(state => {
                        const pageId = operation.payload.pageId;
                        const page = state.pages[pageId];
                        if (!page) return state;

                        const newVersionId = operation.payload.versionId || 
                                           `version-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

                        // Get current page widgets for this version
                        const pageWidgets = Object.fromEntries(
                            Object.entries(state.widgets).filter(([_, widget]) => widget.pageId === pageId)
                        );

                        const newVersion = {
                            id: newVersionId,
                            page_id: pageId,
                            number: (Object.values(state.versions).filter(v => v.page_id === pageId).length + 1),
                            data: {
                                layout: page.layout,
                                widgets: pageWidgets,
                                metadata: page.metadata
                            },
                            created_at: new Date().toISOString(),
                            created_by: operation.payload.createdBy || 'system',
                            status: 'draft'
                        };

                        return {
                            versions: {
                                ...state.versions,
                                [newVersionId]: newVersion
                            },
                            pages: {
                                ...state.pages,
                                [pageId]: {
                                    ...page,
                                    version: newVersionId,
                                    updated_at: new Date().toISOString()
                                }
                            },
                            metadata: {
                                ...state.metadata,
                                isDirty: true
                            }
                        };
                    });
                    break;

                case OperationTypes.PUBLISH_VERSION:
                    this.setState(state => {
                        const version = state.versions[operation.payload.versionId];
                        if (!version) return state;

                        // Unpublish other versions of the same page
                        const updatedVersions = Object.fromEntries(
                            Object.entries(state.versions).map(([id, v]) => [
                                id,
                                v.page_id === version.page_id && v.id !== version.id
                                    ? { ...v, status: 'draft' as const }
                                    : v
                            ])
                        );

                        // Publish this version
                        updatedVersions[version.id] = {
                            ...version,
                            status: 'published' as const
                        };

                        return {
                            versions: updatedVersions,
                            metadata: {
                                ...state.metadata,
                                isDirty: true
                            }
                        };
                    });
                    break;

                case OperationTypes.REVERT_VERSION:
                    this.setState(state => {
                        const version = state.versions[operation.payload.versionId];
                        const pageId = operation.payload.pageId;
                        if (!version || !pageId) return state;

                        // Update page to use this version's data
                        const page = state.pages[pageId];
                        if (!page) return state;

                        // Replace current widgets with version's widgets
                        const versionWidgets = version.data.widgets || {};
                        const otherWidgets = Object.fromEntries(
                            Object.entries(state.widgets).filter(([_, widget]) => widget.pageId !== pageId)
                        );

                        return {
                            pages: {
                                ...state.pages,
                                [pageId]: {
                                    ...page,
                                    layout: version.data.layout,
                                    metadata: version.data.metadata,
                                    version: version.id,
                                    updated_at: new Date().toISOString()
                                }
                            },
                            widgets: {
                                ...otherWidgets,
                                ...versionWidgets
                            },
                            metadata: {
                                ...state.metadata,
                                isDirty: true
                            }
                        };
                    });
                    break;

                case OperationTypes.DELETE_VERSION:
                    this.setState(state => {
                        const { [operation.payload.versionId]: deletedVersion, ...remainingVersions } = state.versions;

                        return {
                            versions: remainingVersions,
                            metadata: {
                                ...state.metadata,
                                isDirty: true
                            }
                        };
                    });
                    break;

                case OperationTypes.COMPARE_VERSIONS:
                    // This operation doesn't modify state, just returns comparison data
                    // The comparison logic would be handled in the hook
                    break;
            }

            // Notify operation subscribers
            this.subscriptionManager.notifyOperation(operation);
            
        } catch (error) {
            // Rollback on failure
            this.state = previousState;
            
            // Update error state
            this.setState(state => ({
                metadata: {
                    ...state.metadata,
                    errors: {
                        ...state.metadata.errors,
                        [operation.type]: error
                    }
                }
            }));
            
            throw error;
        }
    }

    /**
     * Process operation with retry logic
     */
    private async executeOperation(
        operation: Operation,
        retries = 3,
        delay = 1000
    ): Promise<void> {
        try {
            await this.processOperation(operation);
        } catch (error) {
            if (retries > 0 && isRetryableError(error)) {
                await new Promise(resolve => setTimeout(resolve, delay));
                await this.executeOperation(operation, retries - 1, delay * 2);
            } else {
                throw error;
            }
        }
    }

    /**
     * Process operation queue with priority handling
     */
    private async processQueue(): Promise<void> {
        if (this.isProcessing || this.operationQueue.length === 0) return;

        this.isProcessing = true;
        
        try {
            // Sort by priority
            this.operationQueue.sort((a, b) => {
                const priorityMap = { high: 0, normal: 1, low: 2 };
                return priorityMap[a.priority || 'normal'] - priorityMap[b.priority || 'normal'];
            });

            while (this.operationQueue.length > 0) {
                const operation = this.operationQueue.shift()!;
                await this.executeOperation(operation);
            }
        } finally {
            this.isProcessing = false;
        }
    }

    /**
     * Dispatch an operation with optional debouncing
     */
    async dispatch(
        operation: Operation,
        options: { 
            priority?: 'high' | 'normal' | 'low';
            debounce?: number;
        } = {}
    ): Promise<void> {
        const { priority = 'normal', debounce } = options;

        if (debounce) {
            return this.debounceOperation(operation, debounce);
        }

        // Queue the operation with priority
        this.operationQueue.push({ ...operation, priority });
        
        // Process queue
        await this.processQueue();
    }

    /**
     * Debounce an operation
     */
    private debounceOperation(operation: Operation, delay: number): Promise<void> {
        const key = `${operation.type}_${operation.payload?.id}`;
        
        // Clear existing debounced operation
        if (this.debouncedOperations.has(key)) {
            const existing = this.debouncedOperations.get(key)!;
            clearTimeout(existing.timeoutId);
            existing.reject(new Error('Operation superseded'));
            this.debouncedOperations.delete(key);
        }

        return new Promise<void>((resolve, reject) => {
            const timeoutId = setTimeout(async () => {
                try {
                    await this.processOperation(operation);
                    this.debouncedOperations.delete(key);
                    resolve();
                } catch (error) {
                    reject(error);
                }
            }, delay);

            this.debouncedOperations.set(key, {
                operation,
                timeoutId,
                resolve,
                reject
            });
        });
    }

    /**
     * Subscribe to state changes with memoization
     */
    subscribe<T>(
        selector: StateSelector<T>,
        callback: StateUpdateCallback<T>,
        options: SubscriptionOptions = {}
    ) {
        return this.subscriptionManager.subscribe(
            (state) => this.getMemoizedSelector(() => selector(state)),
            callback,
            {
                equalityFn: defaultEqualityFn,
                ...options
            }
        );
    }

    /**
     * Subscribe to operations
     */
    subscribeToOperations(
        callback: (operation: Operation) => void,
        operationTypes?: string | string[]
    ) {
        return this.subscriptionManager.subscribeToOperations(
            callback,
            operationTypes
        );
    }

    /**
     * Clear all subscriptions and caches
     */
    clear(): void {
        this.subscriptionManager.clearAllSubscriptions();
        this.selectorCache.clear();
        this.debouncedOperations.forEach(({ timeoutId }) => clearTimeout(timeoutId));
        this.debouncedOperations.clear();
        if (this.batchTimeout) {
            clearTimeout(this.batchTimeout);
            this.batchTimeout = null;
        }
    }
}