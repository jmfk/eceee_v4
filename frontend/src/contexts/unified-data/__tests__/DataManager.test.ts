import { DataManager } from '../core/DataManager';
import { OperationTypes } from '../types/operations';
import { AppState } from '../types/state';

describe('DataManager', () => {
    let dataManager: DataManager;

    beforeEach(() => {
        dataManager = new DataManager();
    });

    afterEach(() => {
        dataManager.clear();
    });

    describe('Initialization', () => {
        it('should initialize with default state', () => {
            const state = dataManager.getState();
            
            expect(state.pages).toEqual({});
            expect(state.widgets).toEqual({});
            expect(state.layouts).toEqual({});
            expect(state.versions).toEqual({});
            expect(state.metadata.isDirty).toBe(false);
            expect(state.metadata.isLoading).toBe(false);
            expect(state.metadata.widgetStates.unsavedChanges).toEqual({});
        });

        it('should initialize with provided initial state', () => {
            const initialState = {
                pages: { 'page1': { id: 'page1', title: 'Test Page' } as any },
                metadata: { isDirty: true }
            };
            
            const manager = new DataManager(initialState);
            const state = manager.getState();
            
            expect(state.pages['page1'].title).toBe('Test Page');
            expect(state.metadata.isDirty).toBe(true);
            
            manager.clear();
        });
    });

    describe('Widget Operations', () => {
        it('should handle UPDATE_WIDGET_CONFIG operation', async () => {
            const widgetId = 'test-widget-1';
            const config = { title: 'Test Widget', color: 'blue' };

            await dataManager.dispatch({
                type: OperationTypes.UPDATE_WIDGET_CONFIG,
                payload: { id: widgetId, config }
            });

            const state = dataManager.getState();
            expect(state.metadata.isDirty).toBe(true);
            expect(state.metadata.widgetStates.unsavedChanges[widgetId]).toBe(true);
        });

        it('should handle ADD_WIDGET operation', async () => {
            const widgetId = 'new-widget-1';
            const widgetType = 'core_widgets.ContentWidget';
            const slotId = 'main';
            const config = { content: 'Hello World' };

            await dataManager.dispatch({
                type: OperationTypes.ADD_WIDGET,
                payload: {
                    pageId: 'page1',
                    slotId,
                    widgetType,
                    config,
                    widgetId
                }
            });

            const state = dataManager.getState();
            expect(state.widgets[widgetId]).toBeDefined();
            expect(state.widgets[widgetId].type).toBe(widgetType);
            expect(state.widgets[widgetId].config).toEqual(config);
            expect(state.metadata.isDirty).toBe(true);
            expect(state.metadata.widgetStates.unsavedChanges[widgetId]).toBe(true);
        });

        it('should handle REMOVE_WIDGET operation', async () => {
            const widgetId = 'widget-to-remove';
            
            // First add a widget
            await dataManager.dispatch({
                type: OperationTypes.ADD_WIDGET,
                payload: {
                    pageId: 'page1',
                    slotId: 'main',
                    widgetType: 'core_widgets.ContentWidget',
                    config: {},
                    widgetId
                }
            });

            // Then remove it
            await dataManager.dispatch({
                type: OperationTypes.REMOVE_WIDGET,
                payload: { id: widgetId }
            });

            const state = dataManager.getState();
            expect(state.widgets[widgetId]).toBeUndefined();
            expect(state.metadata.widgetStates.unsavedChanges[widgetId]).toBeUndefined();
            expect(state.metadata.isDirty).toBe(false); // Should be false since no unsaved changes remain
        });

        it('should handle MOVE_WIDGET operation', async () => {
            const widgetId = 'widget-to-move';
            
            // First add a widget
            await dataManager.dispatch({
                type: OperationTypes.ADD_WIDGET,
                payload: {
                    pageId: 'page1',
                    slotId: 'main',
                    widgetType: 'core_widgets.ContentWidget',
                    config: {},
                    widgetId
                }
            });

            // Then move it
            await dataManager.dispatch({
                type: OperationTypes.MOVE_WIDGET,
                payload: {
                    id: widgetId,
                    slot: 'sidebar',
                    order: 2
                }
            });

            const state = dataManager.getState();
            expect(state.widgets[widgetId].slot).toBe('sidebar');
            expect(state.widgets[widgetId].order).toBe(2);
            expect(state.metadata.isDirty).toBe(true);
        });
    });

    describe('Dirty State Management', () => {
        it('should compute isDirty from unsaved changes', async () => {
            const widgetId1 = 'widget1';
            const widgetId2 = 'widget2';

            // Add first widget - should be dirty
            await dataManager.dispatch({
                type: OperationTypes.UPDATE_WIDGET_CONFIG,
                payload: { id: widgetId1, config: { title: 'Widget 1' } }
            });

            expect(dataManager.getState().metadata.isDirty).toBe(true);

            // Add second widget - should still be dirty
            await dataManager.dispatch({
                type: OperationTypes.UPDATE_WIDGET_CONFIG,
                payload: { id: widgetId2, config: { title: 'Widget 2' } }
            });

            expect(dataManager.getState().metadata.isDirty).toBe(true);

            // Mark first widget as saved - should still be dirty (widget2 unsaved)
            await dataManager.dispatch({
                type: OperationTypes.MARK_WIDGET_SAVED,
                payload: { widgetId: widgetId1 }
            });

            expect(dataManager.getState().metadata.isDirty).toBe(true);

            // Mark second widget as saved - should be clean
            await dataManager.dispatch({
                type: OperationTypes.MARK_WIDGET_SAVED,
                payload: { widgetId: widgetId2 }
            });

            expect(dataManager.getState().metadata.isDirty).toBe(false);
        });

        it('should handle SET_DIRTY operation', async () => {
            await dataManager.dispatch({
                type: OperationTypes.SET_DIRTY,
                payload: { isDirty: true }
            });

            expect(dataManager.getState().metadata.isDirty).toBe(true);

            await dataManager.dispatch({
                type: OperationTypes.SET_DIRTY,
                payload: { isDirty: false }
            });

            expect(dataManager.getState().metadata.isDirty).toBe(false);
        });

        it('should handle RESET_STATE operation', async () => {
            // Create some unsaved changes
            await dataManager.dispatch({
                type: OperationTypes.UPDATE_WIDGET_CONFIG,
                payload: { id: 'widget1', config: { title: 'Test' } }
            });

            expect(dataManager.getState().metadata.isDirty).toBe(true);

            // Reset state
            await dataManager.dispatch({
                type: OperationTypes.RESET_STATE,
                payload: undefined
            });

            const state = dataManager.getState();
            expect(state.metadata.isDirty).toBe(false);
            expect(state.metadata.widgetStates.unsavedChanges).toEqual({});
        });
    });

    describe('Batch Operations', () => {
        it('should handle batch operations', async () => {
            await dataManager.dispatch({
                type: OperationTypes.BATCH,
                payload: [
                    {
                        type: OperationTypes.UPDATE_WIDGET_CONFIG,
                        payload: { id: 'widget1', config: { title: 'Widget 1' } }
                    },
                    {
                        type: OperationTypes.UPDATE_WIDGET_CONFIG,
                        payload: { id: 'widget2', config: { title: 'Widget 2' } }
                    }
                ]
            });

            const state = dataManager.getState();
            expect(state.metadata.isDirty).toBe(true);
            expect(state.metadata.widgetStates.unsavedChanges['widget1']).toBe(true);
            expect(state.metadata.widgetStates.unsavedChanges['widget2']).toBe(true);
        });
    });

    describe('Subscriptions', () => {
        it('should notify subscribers of state changes', async () => {
            const callback = jest.fn();
            
            const unsubscribe = dataManager.subscribe(
                state => state.metadata.isDirty,
                callback
            );

            await dataManager.dispatch({
                type: OperationTypes.UPDATE_WIDGET_CONFIG,
                payload: { id: 'widget1', config: { title: 'Test' } }
            });

            expect(callback).toHaveBeenCalledWith(true, undefined);

            unsubscribe();
        });

        it('should notify operation subscribers', async () => {
            const callback = jest.fn();
            
            const unsubscribe = dataManager.subscribeToOperations(
                callback,
                ['UPDATE_WIDGET_CONFIG']
            );

            const operation = {
                type: OperationTypes.UPDATE_WIDGET_CONFIG,
                payload: { id: 'widget1', config: { title: 'Test' } }
            };

            await dataManager.dispatch(operation);

            expect(callback).toHaveBeenCalledWith(expect.objectContaining({
                type: 'UPDATE_WIDGET_CONFIG',
                payload: operation.payload
            }));

            unsubscribe();
        });
    });

    describe('Error Handling', () => {
        it('should validate operation types', async () => {
            await expect(dataManager.dispatch({
                type: 'INVALID_OPERATION' as any,
                payload: {}
            })).rejects.toThrow('Invalid operation');
        });

        it('should validate operation payloads', async () => {
            await expect(dataManager.dispatch({
                type: OperationTypes.UPDATE_WIDGET_CONFIG,
                payload: { id: null, config: null } // Invalid payload
            })).rejects.toThrow('Widget ID and config are required');
        });

        it('should handle rollback on operation failure', async () => {
            const initialState = dataManager.getState();
            
            // Mock a failing operation by throwing in setState
            const originalSetState = (dataManager as any).setState;
            (dataManager as any).setState = jest.fn(() => {
                throw new Error('Simulated failure');
            });

            await expect(dataManager.dispatch({
                type: OperationTypes.UPDATE_WIDGET_CONFIG,
                payload: { id: 'widget1', config: { title: 'Test' } }
            })).rejects.toThrow('Simulated failure');

            // State should be rolled back
            expect(dataManager.getState()).toEqual(initialState);

            // Restore original setState
            (dataManager as any).setState = originalSetState;
        });
    });
});
