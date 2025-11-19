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
        for (const subscription of this.stateSubscriptions.values()) {
            // Defer callback execution to avoid render-phase conflicts
            queueMicrotask(() => {
                try {
                    // Filter: For field-level subscriptions, only notify if sourceId matches componentId pattern
                    const subscriptionComponentId = subscription.options.componentId;
                    const operationSourceId = operation?.sourceId || '';

                    console.log("subscriptionComponentId", subscriptionComponentId)
                    console.log("operationSourceId", operationSourceId)

                    if (subscriptionComponentId && operationSourceId) {
                        // Check if this is a field-level subscription (starts with "field-")
                        if (subscriptionComponentId.startsWith('field-')) {
                            // Extract field name from componentId: field-${widgetId}-${fieldName}
                            // The fieldName is the last segment after splitting on '-'
                            const parts = subscriptionComponentId.split('-');
                            const fieldNameFromComponentId = parts[parts.length - 1]; // e.g., "content" from "field-widget-1763502841353-1-y249k9l5t-content"
                            
                            // Check if sourceId contains this field name
                            // sourceId format: bannerwidget-${widgetId}-field-${fieldName} or isolated-form-${widgetId}-field-${fieldName}
                            if (operationSourceId.includes('-field-')) {
                                const fieldNameFromSourceId = operationSourceId.split('-field-')[1];
                                // Only notify if field names match
                                if (fieldNameFromSourceId !== fieldNameFromComponentId) {
                                    return; // Skip this subscription - different field
                                }
                            } else {
                                // sourceId doesn't specify a field, skip field-level subscriptions
                                return;
                            }
                        }
                    }
                    
                    let newValue = state;
                    if (subscription.selector) {
                        newValue = subscription.selector(state);
                    }
                    
                    // Skip if value hasn't changed according to equality function
                    if (
                        subscription.lastValue !== undefined &&
                        subscription.options.equalityFn?.(subscription.lastValue, newValue)
                    ) {
                        return;
                    }

                    const prevValue = subscription.lastValue;
                    subscription.lastValue = newValue;
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
