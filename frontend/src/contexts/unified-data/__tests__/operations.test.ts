import { DataManager } from '../core/DataManager';
import { OperationTypes } from '../types/operations';
import { ValidationError } from '../utils/errors';

describe('Operation Validation', () => {
    let dataManager: DataManager;

    beforeEach(() => {
        dataManager = new DataManager();
    });

    afterEach(() => {
        dataManager.clear();
    });

    describe('UPDATE_WIDGET_CONFIG Validation', () => {
        it('should require widget ID', async () => {
            await expect(dataManager.dispatch({
                type: OperationTypes.UPDATE_WIDGET_CONFIG,
                payload: { config: { title: 'Test' } } // Missing id
            })).rejects.toThrow('Widget ID and config are required');
        });

        it('should require config', async () => {
            await expect(dataManager.dispatch({
                type: OperationTypes.UPDATE_WIDGET_CONFIG,
                payload: { id: 'widget1' } // Missing config
            })).rejects.toThrow('Widget ID and config are required');
        });

        it('should accept valid payload', async () => {
            await expect(dataManager.dispatch({
                type: OperationTypes.UPDATE_WIDGET_CONFIG,
                payload: { id: 'widget1', config: { title: 'Test' } }
            })).resolves.not.toThrow();
        });
    });

    describe('MOVE_WIDGET Validation', () => {
        it('should require widget ID', async () => {
            await expect(dataManager.dispatch({
                type: OperationTypes.MOVE_WIDGET,
                payload: { slot: 'main', order: 1 } // Missing id
            })).rejects.toThrow('Widget ID and slot are required');
        });

        it('should require slot', async () => {
            await expect(dataManager.dispatch({
                type: OperationTypes.MOVE_WIDGET,
                payload: { id: 'widget1', order: 1 } // Missing slot
            })).rejects.toThrow('Widget ID and slot are required');
        });

        it('should accept valid payload', async () => {
            await expect(dataManager.dispatch({
                type: OperationTypes.MOVE_WIDGET,
                payload: { id: 'widget1', slot: 'main', order: 1 }
            })).resolves.not.toThrow();
        });
    });

    describe('Operation Type Validation', () => {
        it('should reject invalid operation types', async () => {
            await expect(dataManager.dispatch({
                type: 'INVALID_OPERATION' as any,
                payload: {}
            })).rejects.toThrow('Invalid operation type');
        });

        it('should accept all valid operation types', async () => {
            const validOperations = [
                {
                    type: OperationTypes.UPDATE_WIDGET_CONFIG,
                    payload: { id: 'widget1', config: {} }
                },
                {
                    type: OperationTypes.MOVE_WIDGET,
                    payload: { id: 'widget1', slot: 'main', order: 1 }
                },
                {
                    type: OperationTypes.ADD_WIDGET,
                    payload: {
                        pageId: 'page1',
                        slotId: 'main',
                        widgetType: 'core_widgets.ContentWidget',
                        config: {},
                        widgetId: 'new-widget'
                    }
                },
                {
                    type: OperationTypes.REMOVE_WIDGET,
                    payload: { id: 'widget1' }
                },
                {
                    type: OperationTypes.SET_DIRTY,
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
                await expect(dataManager.dispatch(operation)).resolves.not.toThrow();
            }
        });
    });

    describe('Operation Metadata', () => {
        it('should add timestamp to operations', async () => {
            const operationCallback = jest.fn();
            
            dataManager.subscribeToOperations(operationCallback);

            await dataManager.dispatch({
                type: OperationTypes.UPDATE_WIDGET_CONFIG,
                payload: { id: 'widget1', config: {} }
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
            const operationCallback = jest.fn();
            
            dataManager.subscribeToOperations(operationCallback);

            await dataManager.dispatch({
                type: OperationTypes.UPDATE_WIDGET_CONFIG,
                payload: { id: 'widget1', config: {} }
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
            await expect(dataManager.dispatch({
                type: OperationTypes.BATCH,
                payload: [
                    {
                        type: OperationTypes.UPDATE_WIDGET_CONFIG,
                        payload: { id: 'widget1', config: {} }
                    },
                    {
                        type: 'INVALID_OPERATION' as any,
                        payload: {}
                    }
                ]
            })).rejects.toThrow();
        });

        it('should process valid batch operations', async () => {
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
});
