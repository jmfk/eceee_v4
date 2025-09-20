import { AppState, StateSelector } from '../types/state';
import { Operation } from '../types/operations';
import {
    Subscription,
    OperationSubscription,
    StateUpdateCallback,
    OperationCallback,
    SubscriptionOptions
} from '../types/subscriptions';
import { defaultEqualityFn } from '../utils/equality';

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
     */
    notifyStateUpdate(state: AppState): void {
        for (const subscription of this.stateSubscriptions.values()) {
            try {
                const newValue = subscription.selector(state);
                
                // Skip if value hasn't changed according to equality function
                if (
                    subscription.lastValue !== undefined &&
                    subscription.options.equalityFn?.(subscription.lastValue, newValue)
                ) {
                    continue;
                }

                const prevValue = subscription.lastValue;
                subscription.lastValue = newValue;
                
                subscription.callback(newValue, prevValue);
            } catch (error) {
                console.error('Error in subscription callback:', error);
                subscription.options.onError?.(error as Error);
            }
        }
    }

    /**
     * Notify subscribers of operations
     */
    notifyOperation(operation: Operation): void {
        for (const subscription of this.operationSubscriptions.values()) {
            try {
                // Check if subscription cares about this operation type
                if (
                    subscription.operationType &&
                    !subscription.operationType.includes(operation.type)
                ) {
                    continue;
                }

                subscription.callback(operation);
            } catch (error) {
                console.error('Error in operation subscription callback:', error);
                subscription.options.onError?.(error as Error);
            }
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
