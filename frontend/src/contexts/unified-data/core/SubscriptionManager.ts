import { AppState, StateSelector } from '../types/state';
import { Operation } from '../types/operations';
import {
    Subscription,
    OperationSubscription,
    StateUpdateCallback,
    OperationCallback,
    SubscriptionOptions,
    defaultEqualityFn
} from '../types/subscriptions';

/**
 * Manages subscriptions to state changes and operations
 */
export class SubscriptionManager {
    private stateSubscriptions: Map<string, Subscription> = new Map();
    private operationSubscriptions: Map<string, OperationSubscription> = new Map();
    private nextSubscriptionId = 1;

    /**
     * Generate unique subscription ID
     */
    private generateSubscriptionId(): string {
        return `sub_${this.nextSubscriptionId++}`;
    }

    /**
     * Subscribe to state changes
     */
    subscribe<T>(
        selector: StateSelector<T>,
        callback: StateUpdateCallback<T>,
        options: SubscriptionOptions = {}
    ) {
        const id = this.generateSubscriptionId();
        
        this.stateSubscriptions.set(id, {
            id,
            selector,
            callback,
            options: {
                equalityFn: defaultEqualityFn,
                ...options
            }
        });

        return () => {
            this.stateSubscriptions.delete(id);
        };
    }

    /**
     * Subscribe to operations
     */
    subscribeToOperations(
        callback: OperationCallback,
        operationType?: string | string[],
        options: SubscriptionOptions = {}
    ) {
        const id = this.generateSubscriptionId();
        
        this.operationSubscriptions.set(id, {
            id,
            callback,
            operationType: operationType ? 
                (Array.isArray(operationType) ? operationType : [operationType]) 
                : undefined,
            options
        });

        return () => {
            this.operationSubscriptions.delete(id);
        };
    }

    /**
     * Notify subscribers of state updates
     * 
     * Defers callbacks to next microtask to avoid React render-phase conflicts
     * when one component's update triggers another component's subscription.
     */
    notifyStateUpdate(state: AppState, operation: Operation): void {
        console.log('[SubscriptionManager] Notifying', this.stateSubscriptions.size, 'state subscribers for operation:', operation.type);
        for (const subscription of this.stateSubscriptions.values()) {
            // Defer callback execution to avoid render-phase conflicts
            queueMicrotask(() => {
                try {
                    let newValue = state;
                    if (subscription.selector) {
                        newValue = subscription.selector(state);
                    }
                    
                    // Skip if value hasn't changed according to equality function
                    if (
                        subscription.lastValue !== undefined &&
                        subscription.options.equalityFn?.(subscription.lastValue, newValue)
                    ) {
                        console.log('[SubscriptionManager] Skipping notification - value unchanged for subscription', subscription.id);
                        return;
                    }

                    const prevValue = subscription.lastValue;
                    subscription.lastValue = newValue;
                    console.log('[SubscriptionManager] Calling subscription callback for id:', subscription.id);
                    subscription.callback(newValue, operation);
                } catch (error) {
                    console.error('❌ Error in subscription callback:', error);
                    subscription.options?.onError?.(error as Error);
                }
            });
        }
    }

    /**
     * Notify subscribers of operations
     * 
     * Defers callbacks to next microtask to avoid React render-phase conflicts.
     */
    notifyOperation(operation: Operation): void {
        for (const subscription of this.operationSubscriptions.values()) {
            // Defer callback execution to avoid render-phase conflicts
            queueMicrotask(() => {
                try {
                    // Check if subscription cares about this operation type
                    if (
                        subscription.operationType &&
                        !subscription.operationType.includes(operation.type)
                    ) {
                        return;
                    }

                    subscription.callback(operation);
                } catch (error) {
                    console.error('Error in operation subscription callback:', error);
                    subscription.options?.onError?.(error as Error);
                }
            });
        }
    }

    /**
     * Clear all subscriptions
     */
    clearAllSubscriptions(): void {
        this.stateSubscriptions.clear();
        this.operationSubscriptions.clear();
    }

    /**
     * Get number of active subscriptions
     */
    getSubscriptionCounts(): { state: number; operations: number } {
        return {
            state: this.stateSubscriptions.size,
            operations: this.operationSubscriptions.size
        };
    }
}
