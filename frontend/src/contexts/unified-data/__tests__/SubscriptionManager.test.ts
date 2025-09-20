import { SubscriptionManager } from '../core/SubscriptionManager';
import { AppState } from '../types/state';
import { Operation } from '../types/operations';

describe('SubscriptionManager', () => {
    let subscriptionManager: SubscriptionManager;
    let mockState: AppState;

    beforeEach(() => {
        subscriptionManager = new SubscriptionManager();
        mockState = {
            pages: {},
            widgets: {},
            layouts: {},
            versions: {},
            metadata: {
                lastUpdated: new Date().toISOString(),
                isLoading: false,
                isDirty: false,
                errors: {},
                widgetStates: {
                    unsavedChanges: {},
                    errors: {},
                    activeEditors: []
                }
            }
        };
    });

    afterEach(() => {
        subscriptionManager.clearAllSubscriptions();
    });

    describe('State Subscriptions', () => {
        it('should subscribe to state changes', () => {
            const callback = jest.fn();
            const selector = (state: AppState) => Object.keys(state.widgets).length > 0;

            const unsubscribe = subscriptionManager.subscribe(selector, callback);

            // Trigger state update
            subscriptionManager.notifyStateUpdate(mockState);

            expect(callback).toHaveBeenCalledWith(false, undefined);

            unsubscribe();
        });

        it('should not call callback when value unchanged', () => {
            const callback = jest.fn();
            const selector = (state: AppState) => Object.keys(state.widgets).length > 0;

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
            const selector = (state: AppState) => Object.keys(state.widgets).length > 0;

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
            const selector = (state: AppState) => Object.keys(state.widgets).length > 0;

            const unsubscribe = subscriptionManager.subscribe(selector, callback);
            unsubscribe();

            // Should not call callback after unsubscribe
            subscriptionManager.notifyStateUpdate(mockState);
            expect(callback).not.toHaveBeenCalled();
        });
    });

    describe('Operation Subscriptions', () => {
        it('should subscribe to all operations', () => {
            const callback = jest.fn();
            const operation: Operation = {
                type: 'UPDATE_WIDGET_CONFIG',
                payload: { id: 'widget1', config: {} }
            };

            subscriptionManager.subscribeToOperations(callback);
            subscriptionManager.notifyOperation(operation);

            expect(callback).toHaveBeenCalledWith(operation);
        });

        it('should subscribe to specific operation types', () => {
            const callback = jest.fn();
            const updateOperation: Operation = {
                type: 'UPDATE_WIDGET_CONFIG',
                payload: { id: 'widget1', config: {} }
            };
            const moveOperation: Operation = {
                type: 'MOVE_WIDGET',
                payload: { id: 'widget1', slot: 'main', order: 1 }
            };

            subscriptionManager.subscribeToOperations(callback, ['UPDATE_WIDGET_CONFIG']);

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
                type: 'UPDATE_WIDGET_CONFIG',
                payload: { id: 'widget1', config: {} }
            };
            const moveOperation: Operation = {
                type: 'MOVE_WIDGET',
                payload: { id: 'widget1', slot: 'main', order: 1 }
            };

            subscriptionManager.subscribeToOperations(
                callback, 
                ['UPDATE_WIDGET_CONFIG', 'MOVE_WIDGET']
            );

            subscriptionManager.notifyOperation(updateOperation);
            subscriptionManager.notifyOperation(moveOperation);

            expect(callback).toHaveBeenCalledTimes(2);
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
                type: 'UPDATE_WIDGET_CONFIG',
                payload: { id: 'widget1', config: {} }
            });

            expect(consoleErrorSpy).toHaveBeenCalledWith(
                'Error in operation subscription callback:',
                expect.any(Error)
            );

            consoleErrorSpy.mockRestore();
        });
    });
});
