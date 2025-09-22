import { UnifiedState } from './state';

export type StateUpdateCallback<T = any> = (newValue: T, prevValue: T) => void;

export interface SubscriptionOptions {
    // Debounce time in milliseconds for state updates
    debounceMs?: number;
    
    // Whether to skip initial callback with current value
    skipInitial?: boolean;
    
    // Whether to run callback only when value changes
    onlyChanges?: boolean;
    
    // Custom equality function for value comparison
    equalityFn?: (a: any, b: any) => boolean;
}

export interface Subscription<T = any> {
    // Unique identifier for the subscription
    id: string;
    
    // Function to select data from state
    selector: (state: UnifiedState) => T;
    
    // Callback to run when selected data changes
    callback: StateUpdateCallback<T>;
    
    // Optional configuration
    options?: SubscriptionOptions;
    
    // Whether the subscription is currently active
    enabled: boolean;
}

export interface OperationSubscription {
    // Unique identifier for the subscription
    id: string;
    
    // Callback to run when matching operations occur
    callback: (operation: any) => void;
    
    // Optional operation types to filter
    operationTypes?: string | string[];
    
    // Whether the subscription is currently active
    enabled: boolean;
}

export interface SubscriptionManager {
    // Add a new subscription
    subscribe: <T>(
        selector: (state: UnifiedState) => T,
        callback: StateUpdateCallback<T>,
        options?: SubscriptionOptions
    ) => () => void;
    
    // Add a new operation subscription
    subscribeToOperations: (
        callback: (operation: any) => void,
        operationTypes?: string | string[]
    ) => () => void;
    
    // Remove a subscription by ID
    unsubscribe: (subscriptionId: string) => void;
    
    // Notify subscribers of state changes
    notifySubscribers: (state: UnifiedState, prevState: UnifiedState) => void;
    
    // Notify operation subscribers
    notifyOperationSubscribers: (operation: any) => void;
    
    // Get all active subscriptions
    getActiveSubscriptions: () => string[];
    
    // Get subscription count
    getSubscriptionCount: () => {
        state: number;
        operations: number;
    };
    
    // Clear all subscriptions
    clearAll: () => void;
}
