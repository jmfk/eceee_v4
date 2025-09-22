import { SubscriptionManager } from '../v2/core/SubscriptionManager';
import { UnifiedState } from '../v2/types/state';
import { Operation, OperationTypes } from '../v2/types/operations';

describe('SubscriptionManager v2', () => {
    let subscriptionManager: SubscriptionManager;
    let mockState: UnifiedState;

    beforeEach(() => {
        subscriptionManager = new SubscriptionManager();
        mockState = {
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
    });

    afterEach(() => {
        subscriptionManager.clearAllSubscriptions();
    });

    describe('State Subscriptions', () => {
        it('should subscribe to state changes', () => {
            const callback = jest.fn();
            const selector = (state: UnifiedState) => Object.keys(state.widgets).length > 0;

            const unsubscribe = subscriptionManager.subscribe(selector, callback);

            // Trigger state update
            subscriptionManager.notifyStateUpdate(mockState);

            expect(callback).toHaveBeenCalledWith(false, undefined);

            unsubscribe();
        });

        it('should not call callback when value unchanged', () => {
            const callback = jest.fn();
            const selector = (state: UnifiedState) => Object.keys(state.widgets).length > 0;

            subscriptionManager.subscribe(selector, callback);

            // First notification
            subscriptionManager.notifyStateUpdate(mockState);
            expect(callback).toHaveBeenCalledTimes(1);

            // Second notification with same value
            subscriptionManager.notifyStateUpdate(mockState);
            expect(callback).toHaveBeenCalledTimes(1); // Should not be called again
        });

        it('should call callback when value changes', () => {
            const callback = jest.fn();
            const selector = (state: UnifiedState) => state.metadata.isDirty;

            subscriptionManager.subscribe(selector, callback);

            // First notification
            subscriptionManager.notifyStateUpdate(mockState);
            expect(callback).toHaveBeenCalledWith(false, undefined);

            // Change the state
            const changedState = {
                ...mockState,
                metadata: { ...mockState.metadata, isDirty: true }
            };

            subscriptionManager.notifyStateUpdate(changedState);
            expect(callback).toHaveBeenCalledWith(true, false);
        });

        it('should unsubscribe correctly', () => {
            const callback = jest.fn();
            const selector = (state: UnifiedState) => Object.keys(state.widgets).length > 0;

            const unsubscribe = subscriptionManager.subscribe(selector, callback);
            unsubscribe();

            // Should not call callback after unsubscribe
            subscriptionManager.notifyStateUpdate(mockState);
            expect(callback).not.toHaveBeenCalled();
        });

        it('should handle subscription options', () => {
            const callback = jest.fn();
            const selector = (state: UnifiedState) => state.metadata.isDirty;

            subscriptionManager.subscribe(selector, callback, {
                skipInitial: true,
                debounceMs: 100
            });

            // Initial notification should be skipped
            subscriptionManager.notifyStateUpdate(mockState);
            expect(callback).not.toHaveBeenCalled();

            // Change the state
            const changedState = {
                ...mockState,
                metadata: { ...mockState.metadata, isDirty: true }
            };

            // Should be debounced
            subscriptionManager.notifyStateUpdate(changedState);
            expect(callback).not.toHaveBeenCalled();

            // Wait for debounce
            jest.advanceTimersByTime(150);
            expect(callback).toHaveBeenCalledWith(true, false);
        });
    });

    describe('Operation Subscriptions', () => {
        it('should subscribe to all operations', () => {
            const callback = jest.fn();
            const operation: Operation = {
                type: OperationTypes.UPDATE_WIDGET_CONFIG,
                payload: { widgetId: 'widget1', config: {} }
            };

            subscriptionManager.subscribeToOperations(callback);
            subscriptionManager.notifyOperation(operation);

            expect(callback).toHaveBeenCalledWith(operation);
        });

        it('should subscribe to specific operation types', () => {
            const callback = jest.fn();
            const updateOperation: Operation = {
                type: OperationTypes.UPDATE_WIDGET_CONFIG,
                payload: { widgetId: 'widget1', config: {} }
            };
            const moveOperation: Operation = {
                type: OperationTypes.MOVE_WIDGET,
                payload: { widgetId: 'widget1', slotName: 'main', order: 1 }
            };

            subscriptionManager.subscribeToOperations(callback, [OperationTypes.UPDATE_WIDGET_CONFIG]);

            // Should call for UPDATE_WIDGET_CONFIG
            subscriptionManager.notifyOperation(updateOperation);
            expect(callback).toHaveBeenCalledWith(updateOperation);

            // Should not call for MOVE_WIDGET
            subscriptionManager.notifyOperation(moveOperation);
            expect(callback).toHaveBeenCalledTimes(1);
        });

        it('should handle multiple operation types', () => {
            const callback = jest.fn();
            const updateOperation: Operation = {
                type: OperationTypes.UPDATE_WIDGET_CONFIG,
                payload: { widgetId: 'widget1', config: {} }
            };
            const moveOperation: Operation = {
                type: OperationTypes.MOVE_WIDGET,
                payload: { widgetId: 'widget1', slotName: 'main', order: 1 }
            };

            subscriptionManager.subscribeToOperations(
                callback, 
                [OperationTypes.UPDATE_WIDGET_CONFIG, OperationTypes.MOVE_WIDGET]
            );

            subscriptionManager.notifyOperation(updateOperation);
            subscriptionManager.notifyOperation(moveOperation);

            expect(callback).toHaveBeenCalledTimes(2);
        });

        it('should handle operation metadata', () => {
            const callback = jest.fn();
            const operation: Operation = {
                type: OperationTypes.UPDATE_WIDGET_CONFIG,
                payload: { widgetId: 'widget1', config: {} }
            };

            subscriptionManager.subscribeToOperations(callback);
            subscriptionManager.notifyOperation(operation);

            expect(callback).toHaveBeenCalledWith(expect.objectContaining({
                metadata: expect.objectContaining({
                    timestamp: expect.any(Number),
                    validation: expect.objectContaining({
                        isValid: true
                    })
                })
            }));
        });
    });

    describe('Subscription Management', () => {
        it('should track subscription counts', () => {
            const callback = jest.fn();
            
            const unsubscribe1 = subscriptionManager.subscribe(
                state => Object.keys(state.widgets).length > 0,
                callback
            );
            const unsubscribe2 = subscriptionManager.subscribeToOperations(callback);

            const counts = subscriptionManager.getSubscriptionCounts();
            expect(counts.state).toBe(1);
            expect(counts.operations).toBe(1);

            unsubscribe1();
            unsubscribe2();

            const finalCounts = subscriptionManager.getSubscriptionCounts();
            expect(finalCounts.state).toBe(0);
            expect(finalCounts.operations).toBe(0);
        });

        it('should clear all subscriptions', () => {
            const callback = jest.fn();
            
            subscriptionManager.subscribe(state => Object.keys(state.widgets).length > 0, callback);
            subscriptionManager.subscribeToOperations(callback);

            subscriptionManager.clearAllSubscriptions();

            const counts = subscriptionManager.getSubscriptionCounts();
            expect(counts.state).toBe(0);
            expect(counts.operations).toBe(0);
        });

        it('should handle subscription cleanup', () => {
            const callback = jest.fn();
            const cleanup = jest.fn();
            
            subscriptionManager.subscribe(
                state => Object.keys(state.widgets).length > 0,
                callback,
                { cleanup }
            );

            subscriptionManager.clearAllSubscriptions();
            expect(cleanup).toHaveBeenCalled();
        });
    });

    describe('Error Handling', () => {
        it('should handle callback errors gracefully', () => {
            const errorCallback = jest.fn(() => {
                throw new Error('Callback error');
            });
            const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();

            subscriptionManager.subscribe(state => Object.keys(state.widgets).length > 0, errorCallback);
            subscriptionManager.notifyStateUpdate(mockState);

            expect(consoleErrorSpy).toHaveBeenCalledWith(
                'Error in subscription callback:',
                expect.any(Error)
            );

            consoleErrorSpy.mockRestore();
        });

        it('should handle operation callback errors gracefully', () => {
            const errorCallback = jest.fn(() => {
                throw new Error('Operation callback error');
            });
            const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();

            subscriptionManager.subscribeToOperations(errorCallback);
            subscriptionManager.notifyOperation({
                type: OperationTypes.UPDATE_WIDGET_CONFIG,
                payload: { widgetId: 'widget1', config: {} }
            });

            expect(consoleErrorSpy).toHaveBeenCalledWith(
                'Error in operation subscription callback:',
                expect.any(Error)
            );

            consoleErrorSpy.mockRestore();
        });

        it('should handle invalid subscription options', () => {
            const callback = jest.fn();
            
            expect(() => {
                subscriptionManager.subscribe(
                    state => Object.keys(state.widgets).length > 0,
                    callback,
                    { debounceMs: -1 }
                );
            }).toThrow('Invalid debounce time');
        });
    });
});