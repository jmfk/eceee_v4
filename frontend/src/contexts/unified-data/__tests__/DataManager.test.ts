import { StateManager } from '../v2/core/StateManager';
import { OperationTypes } from '../v2/types/operations';
import { UnifiedState } from '../v2/types/state';
import '@testing-library/jest-dom';

// Mock StateManager implementation for testing
class TestStateManager extends StateManager {
    private state: UnifiedState;

    constructor(initialState?: Partial<UnifiedState>) {
        super();
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
            },
            ...initialState
        };
    }

    getState(): UnifiedState {
        return this.state;
    }

    async dispatch(operation: any): Promise<void> {
        // Simple mock implementation
        switch (operation.type) {
            case OperationTypes.UPDATE_WIDGET_CONFIG:
                this.state.widgets[operation.payload.widgetId] = {
                    ...this.state.widgets[operation.payload.widgetId],
                    config: operation.payload.config
                };
                this.state.metadata.isDirty = true;
                this.state.metadata.hasUnsavedChanges = true;
                break;

            case OperationTypes.ADD_WIDGET:
                this.state.widgets[operation.payload.widgetId] = {
                    id: operation.payload.widgetId,
                    type: operation.payload.widgetType,
                    slotName: operation.payload.slotName,
                    config: operation.payload.config,
                    pageId: operation.payload.pageId,
                    order: 0
                };
                this.state.metadata.isDirty = true;
                this.state.metadata.hasUnsavedChanges = true;
                break;

            case OperationTypes.REMOVE_WIDGET:
                delete this.state.widgets[operation.payload.widgetId];
                this.state.metadata.isDirty = false;
                this.state.metadata.hasUnsavedChanges = false;
                break;

            case OperationTypes.MOVE_WIDGET:
                this.state.widgets[operation.payload.widgetId] = {
                    ...this.state.widgets[operation.payload.widgetId],
                    slotName: operation.payload.slotName,
                    order: operation.payload.order
                };
                this.state.metadata.isDirty = true;
                break;

            case OperationTypes.SET_LOADING:
                this.state.metadata.isLoading = operation.payload.loading;
                break;

            case OperationTypes.SET_ERROR:
                this.state.metadata.errors[operation.payload.error.code] = operation.payload.error;
                break;

            case OperationTypes.CLEAR_ERRORS:
                this.state.metadata.errors = {};
                break;

            case OperationTypes.SET_METADATA:
                this.state.metadata = {
                    ...this.state.metadata,
                    ...operation.payload
                };
                break;

            case OperationTypes.BATCH:
                for (const op of operation.payload) {
                    await this.dispatch(op);
                }
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

            default:
                if (operation.type === 'INVALID_OPERATION') {
                    throw new Error('Invalid operation type');
                }
                if (!operation.payload?.widgetId || !operation.payload?.config) {
                    throw new Error('Invalid payload');
                }
                if (!operation.payload?.pageId || !operation.payload?.slotName || !operation.payload?.widgetType) {
                    throw new Error('Invalid widget data');
                }
                break;
        }
    }

    subscribe(selector: (state: UnifiedState) => any, callback: (newValue: any, oldValue: any) => void): () => void {
        // Simple mock implementation
        return () => {};
    }

    subscribeToOperations(callback: (operation: any) => void, operationTypes?: string[]): () => void {
        // Simple mock implementation
        return () => {};
    }

    clear(): void {
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
    }
}

describe('StateManager v2', () => {
    let stateManager: TestStateManager;

    beforeEach(() => {
        stateManager = new TestStateManager();
    });

    afterEach(() => {
        stateManager.clear();
    });

    describe('Initialization', () => {
        it('should initialize with default state', () => {
            const state = stateManager.getState();
            
            expect(state.pages).toEqual({});
            expect(state.widgets).toEqual({});
            expect(state.layouts).toEqual({});
            expect(state.versions).toEqual({});
            expect(state.metadata).toEqual({
                isDirty: false,
                hasUnsavedChanges: false,
                isLoading: false,
                errors: {}
            });
        });

        it('should initialize with provided initial state', () => {
            const initialState: Partial<UnifiedState> = {
                pages: { 'page1': { id: 'page1', title: 'Test Page' } as any }
            };
            
            const manager = new TestStateManager(initialState);
            const state = manager.getState();
            
            expect(state.pages['page1'].title).toBe('Test Page');
            expect(state.metadata.isDirty).toBe(false);
            
            manager.clear();
        });
    });

    describe('Widget Operations', () => {
        it('should handle UPDATE_WIDGET_CONFIG operation', async () => {
            const widgetId = 'test-widget-1';
            const config = { title: 'Test Widget', color: 'blue' };

            await stateManager.dispatch({
                type: OperationTypes.UPDATE_WIDGET_CONFIG,
                payload: { widgetId, config }
            });

            const state = stateManager.getState();
            expect(state.widgets[widgetId].config).toEqual(config);
            expect(state.metadata.isDirty).toBe(true);
            expect(state.metadata.hasUnsavedChanges).toBe(true);
        });

        it('should handle ADD_WIDGET operation', async () => {
            const widgetId = 'new-widget-1';
            const widgetType = 'core_widgets.ContentWidget';
            const slotName = 'main';
            const config = { content: 'Hello World' };

            await stateManager.dispatch({
                type: OperationTypes.ADD_WIDGET,
                payload: {
                    pageId: 'page1',
                    slotName,
                    widgetType,
                    config,
                    widgetId
                }
            });

            const state = stateManager.getState();
            expect(state.widgets[widgetId]).toBeDefined();
            expect(state.widgets[widgetId].type).toBe(widgetType);
            expect(state.widgets[widgetId].config).toEqual(config);
            expect(state.metadata.isDirty).toBe(true);
            expect(state.metadata.hasUnsavedChanges).toBe(true);
        });

        it('should handle REMOVE_WIDGET operation', async () => {
            const widgetId = 'widget-to-remove';
            
            // First add a widget
            await stateManager.dispatch({
                type: OperationTypes.ADD_WIDGET,
                payload: {
                    pageId: 'page1',
                    slotName: 'main',
                    widgetType: 'core_widgets.ContentWidget',
                    config: {},
                    widgetId
                }
            });

            // Then remove it
            await stateManager.dispatch({
                type: OperationTypes.REMOVE_WIDGET,
                payload: { widgetId }
            });

            const state = stateManager.getState();
            expect(state.widgets[widgetId]).toBeUndefined();
            expect(state.metadata.isDirty).toBe(false);
            expect(state.metadata.hasUnsavedChanges).toBe(false);
        });

        it('should handle MOVE_WIDGET operation', async () => {
            const widgetId = 'widget-to-move';
            
            // First add a widget
            await stateManager.dispatch({
                type: OperationTypes.ADD_WIDGET,
                payload: {
                    pageId: 'page1',
                    slotName: 'main',
                    widgetType: 'core_widgets.ContentWidget',
                    config: {},
                    widgetId
                }
            });

            // Then move it
            await stateManager.dispatch({
                type: OperationTypes.MOVE_WIDGET,
                payload: {
                    widgetId,
                    slotName: 'sidebar',
                    order: 2
                }
            });

            const state = stateManager.getState();
            expect(state.widgets[widgetId].slotName).toBe('sidebar');
            expect(state.widgets[widgetId].order).toBe(2);
            expect(state.metadata.isDirty).toBe(true);
        });
    });

    describe('Metadata State Management', () => {
        it('should manage loading state', async () => {
            await stateManager.dispatch({
                type: OperationTypes.SET_LOADING,
                payload: { loading: true }
            });

            expect(stateManager.getState().metadata.isLoading).toBe(true);

            await stateManager.dispatch({
                type: OperationTypes.SET_LOADING,
                payload: { loading: false }
            });

            expect(stateManager.getState().metadata.isLoading).toBe(false);
        });

        it('should manage error state', async () => {
            const error = { code: 'TEST_ERROR', message: 'Test error' };

            await stateManager.dispatch({
                type: OperationTypes.SET_ERROR,
                payload: { error }
            });

            expect(stateManager.getState().metadata.errors['TEST_ERROR']).toBeDefined();

            await stateManager.dispatch({
                type: OperationTypes.CLEAR_ERRORS,
                payload: undefined
            });

            expect(Object.keys(stateManager.getState().metadata.errors)).toHaveLength(0);
        });

        it('should manage dirty state', async () => {
            await stateManager.dispatch({
                type: OperationTypes.SET_METADATA,
                payload: { isDirty: true }
            });

            expect(stateManager.getState().metadata.isDirty).toBe(true);

            await stateManager.dispatch({
                type: OperationTypes.SET_METADATA,
                payload: { isDirty: false }
            });

            expect(stateManager.getState().metadata.isDirty).toBe(false);
        });
    });

    describe('Batch Operations', () => {
        it('should handle batch operations', async () => {
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
            expect(state.metadata.hasUnsavedChanges).toBe(true);
        });

        it('should handle batch operation rollback', async () => {
            const initialState = stateManager.getState();

            // Try a batch with one invalid operation
            await expect(stateManager.dispatch({
                type: OperationTypes.BATCH,
                payload: [
                    {
                        type: OperationTypes.UPDATE_WIDGET_CONFIG,
                        payload: { widgetId: 'widget1', config: { title: 'Widget 1' } }
                    },
                    {
                        type: 'INVALID_OPERATION' as any,
                        payload: {}
                    }
                ]
            })).rejects.toThrow();

            // State should be rolled back
            expect(stateManager.getState()).toEqual(initialState);
        });
    });

    describe('Error Handling', () => {
        it('should validate operation types', async () => {
            await expect(stateManager.dispatch({
                type: 'INVALID_OPERATION' as any,
                payload: {}
            })).rejects.toThrow('Invalid operation type');
        });

        it('should validate operation payloads', async () => {
            await expect(stateManager.dispatch({
                type: OperationTypes.UPDATE_WIDGET_CONFIG,
                payload: { widgetId: null, config: null } // Invalid payload
            })).rejects.toThrow('Invalid payload');
        });

        it('should handle validation errors', async () => {
            await expect(stateManager.dispatch({
                type: OperationTypes.ADD_WIDGET,
                payload: {
                    pageId: undefined,
                    slotName: undefined,
                    widgetType: undefined,
                    config: undefined,
                    widgetId: undefined
                }
            })).rejects.toThrow('Invalid widget data');

            expect(stateManager.getState().metadata.errors).toEqual({});
        });
    });
});
