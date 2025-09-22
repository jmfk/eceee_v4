import { vi } from 'vitest';
import { StateManager } from '../v2/core/StateManager';
import { OperationTypes } from '../v2/types/operations';
import { UnifiedState } from '../v2/types/state';

// Test implementation of StateManager
class TestStateManager extends StateManager {
    constructor(initialState?: Partial<UnifiedState>) {
        super(initialState);
    }

    async dispatch(operation: any): Promise<void> {
        // Validate operation type
        if (!Object.values(OperationTypes).includes(operation.type)) {
            throw new Error('Invalid operation type');
        }

        // Validate operation payload
        switch (operation.type) {
            case OperationTypes.UPDATE_WIDGET_CONFIG:
                if (!operation.payload?.widgetId || !operation.payload?.config) {
                    throw new Error('Widget ID and config are required');
                }
                this.state.widgets[operation.payload.widgetId] = {
                    ...this.state.widgets[operation.payload.widgetId],
                    config: operation.payload.config
                };
                this.state.metadata.isDirty = true;
                break;

            case OperationTypes.MOVE_WIDGET:
                if (!operation.payload?.widgetId || !operation.payload?.slotName) {
                    throw new Error('Widget ID and slot are required');
                }
                this.state.widgets[operation.payload.widgetId] = {
                    ...this.state.widgets[operation.payload.widgetId],
                    slotName: operation.payload.slotName,
                    order: operation.payload.order
                };
                this.state.metadata.isDirty = true;
                break;

            case OperationTypes.ADD_WIDGET:
                if (!operation.payload?.pageId || !operation.payload?.slotName || !operation.payload?.widgetType) {
                    throw new Error('Invalid widget data');
                }
                this.state.widgets[operation.payload.widgetId] = {
                    id: operation.payload.widgetId,
                    type: operation.payload.widgetType,
                    slotName: operation.payload.slotName,
                    config: operation.payload.config || {},
                    pageId: operation.payload.pageId,
                    order: 0
                };
                this.state.metadata.isDirty = true;
                break;

            case OperationTypes.REMOVE_WIDGET:
                delete this.state.widgets[operation.payload.widgetId];
                break;

            case OperationTypes.SET_METADATA:
                this.state.metadata = {
                    ...this.state.metadata,
                    ...operation.payload
                };
                break;

            case OperationTypes.RESET_STATE:
                this.state = {
                    pages: {},
                    widgets: {},
                    layouts: {},
                    versions: {},
                    metadata: {
                        isDirty: false,
                        hasUnsavedChanges: false,
                        isLoading: false,
                        errors: {}
                    }
                };
                break;

            case OperationTypes.CLEAR_ERRORS:
                this.state.metadata.errors = {};
                break;

            case OperationTypes.MARK_WIDGET_SAVED:
                if (this.state.widgets[operation.payload.widgetId]) {
                    this.state.metadata.isDirty = false;
                    this.state.metadata.hasUnsavedChanges = false;
                }
                break;

            case OperationTypes.BATCH:
                for (const op of operation.payload) {
                    await this.dispatch(op);
                }
                break;

            default:
                throw new Error('Invalid operation type');
        }

        // Add operation metadata
        const metadata = {
            timestamp: Date.now(),
            validation: {
                isValid: true
            }
        };

        // Notify operation subscribers
        if (this.operationSubscribers) {
            this.operationSubscribers.forEach(subscriber => {
                subscriber({
                    ...operation,
                    metadata
                });
            });
        }
    }

    private operationSubscribers: ((operation: any) => void)[] = [];

    subscribeToOperations(callback: (operation: any) => void): () => void {
        this.operationSubscribers.push(callback);
        return () => {
            this.operationSubscribers = this.operationSubscribers.filter(cb => cb !== callback);
        };
    }
}

describe('Operation Validation v2', () => {
    let stateManager: TestStateManager;

    beforeEach(() => {
        stateManager = new TestStateManager();
    });

    afterEach(() => {
        stateManager.clear();
    });

    describe('UPDATE_WIDGET_CONFIG Validation', () => {
        it('should require widget ID', async () => {
            await expect(stateManager.dispatch({
                type: OperationTypes.UPDATE_WIDGET_CONFIG,
                payload: { config: { title: 'Test' } } // Missing widgetId
            })).rejects.toThrow('Widget ID and config are required');
        });

        it('should require config', async () => {
            await expect(stateManager.dispatch({
                type: OperationTypes.UPDATE_WIDGET_CONFIG,
                payload: { widgetId: 'widget1' } // Missing config
            })).rejects.toThrow('Widget ID and config are required');
        });

        it('should accept valid payload', async () => {
            await expect(stateManager.dispatch({
                type: OperationTypes.UPDATE_WIDGET_CONFIG,
                payload: { widgetId: 'widget1', config: { title: 'Test' } }
            })).resolves.not.toThrow();
        });
    });

    describe('MOVE_WIDGET Validation', () => {
        it('should require widget ID', async () => {
            await expect(stateManager.dispatch({
                type: OperationTypes.MOVE_WIDGET,
                payload: { slotName: 'main', order: 1 } // Missing widgetId
            })).rejects.toThrow('Widget ID and slot are required');
        });

        it('should require slot', async () => {
            await expect(stateManager.dispatch({
                type: OperationTypes.MOVE_WIDGET,
                payload: { widgetId: 'widget1', order: 1 } // Missing slotName
            })).rejects.toThrow('Widget ID and slot are required');
        });

        it('should accept valid payload', async () => {
            await expect(stateManager.dispatch({
                type: OperationTypes.MOVE_WIDGET,
                payload: { widgetId: 'widget1', slotName: 'main', order: 1 }
            })).resolves.not.toThrow();
        });
    });

    describe('Operation Type Validation', () => {
        it('should reject invalid operation types', async () => {
            await expect(stateManager.dispatch({
                type: 'INVALID_OPERATION' as any,
                payload: {}
            })).rejects.toThrow('Invalid operation type');
        });

        it('should accept all valid operation types', async () => {
            const validOperations = [
                {
                    type: OperationTypes.UPDATE_WIDGET_CONFIG,
                    payload: { widgetId: 'widget1', config: {} }
                },
                {
                    type: OperationTypes.MOVE_WIDGET,
                    payload: { widgetId: 'widget1', slotName: 'main', order: 1 }
                },
                {
                    type: OperationTypes.ADD_WIDGET,
                    payload: {
                        pageId: 'page1',
                        slotName: 'main',
                        widgetType: 'core_widgets.ContentWidget',
                        config: {},
                        widgetId: 'new-widget'
                    }
                },
                {
                    type: OperationTypes.REMOVE_WIDGET,
                    payload: { widgetId: 'widget1' }
                },
                {
                    type: OperationTypes.SET_METADATA,
                    payload: { isDirty: true }
                },
                {
                    type: OperationTypes.RESET_STATE,
                    payload: undefined
                },
                {
                    type: OperationTypes.CLEAR_ERRORS,
                    payload: undefined
                },
                {
                    type: OperationTypes.MARK_WIDGET_SAVED,
                    payload: { widgetId: 'widget1' }
                }
            ];

            for (const operation of validOperations) {
                await expect(stateManager.dispatch(operation)).resolves.not.toThrow();
            }
        });
    });

    describe('Operation Metadata', () => {
        it('should add timestamp to operations', async () => {
            const operationCallback = vi.fn();
            
            stateManager.subscribeToOperations(operationCallback);

            await stateManager.dispatch({
                type: OperationTypes.UPDATE_WIDGET_CONFIG,
                payload: { widgetId: 'widget1', config: {} }
            });

            expect(operationCallback).toHaveBeenCalledWith(
                expect.objectContaining({
                    metadata: expect.objectContaining({
                        timestamp: expect.any(Number)
                    })
                })
            );
        });

        it('should add validation results to operations', async () => {
            const operationCallback = vi.fn();
            
            stateManager.subscribeToOperations(operationCallback);

            await stateManager.dispatch({
                type: OperationTypes.UPDATE_WIDGET_CONFIG,
                payload: { widgetId: 'widget1', config: {} }
            });

            expect(operationCallback).toHaveBeenCalledWith(
                expect.objectContaining({
                    metadata: expect.objectContaining({
                        validation: expect.objectContaining({
                            isValid: true
                        })
                    })
                })
            );
        });
    });

    describe('Batch Operations', () => {
        it('should validate all operations in batch', async () => {
            await expect(stateManager.dispatch({
                type: OperationTypes.BATCH,
                payload: [
                    {
                        type: OperationTypes.UPDATE_WIDGET_CONFIG,
                        payload: { widgetId: 'widget1', config: {} }
                    },
                    {
                        type: 'INVALID_OPERATION' as any,
                        payload: {}
                    }
                ]
            })).rejects.toThrow();
        });

        it('should process valid batch operations', async () => {
            await stateManager.dispatch({
                type: OperationTypes.BATCH,
                payload: [
                    {
                        type: OperationTypes.UPDATE_WIDGET_CONFIG,
                        payload: { widgetId: 'widget1', config: { title: 'Widget 1' } }
                    },
                    {
                        type: OperationTypes.UPDATE_WIDGET_CONFIG,
                        payload: { widgetId: 'widget2', config: { title: 'Widget 2' } }
                    }
                ]
            });

            const state = stateManager.getState();
            expect(state.widgets['widget1'].config.title).toBe('Widget 1');
            expect(state.widgets['widget2'].config.title).toBe('Widget 2');
            expect(state.metadata.isDirty).toBe(true);
        });
    });
});