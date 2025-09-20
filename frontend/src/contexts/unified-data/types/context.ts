import { AppState, StateSelector } from './state';
import { Operation } from './operations';
import { StateUpdateCallback, SubscriptionOptions } from './subscriptions';

/**
 * Options for operation dispatch
 */
export interface DispatchOptions {
    priority?: 'high' | 'normal' | 'low';
    debounce?: number;
}

/**
 * Context value interface
 */
export interface UnifiedDataContextValue {
    // State access
    state: AppState;
    getState: () => AppState;
    
    // Operations
    dispatch: (operation: Operation, options?: DispatchOptions) => Promise<void>;
    batchDispatch: (operations: Operation[]) => Promise<void>;
    
    // Subscriptions
    subscribe: <T>(
        selector: StateSelector<T>,
        callback: StateUpdateCallback<T>,
        options?: SubscriptionOptions
    ) => () => void;
    
    subscribeToOperations: (
        callback: (operation: Operation) => void,
        operationTypes?: string | string[]
    ) => () => void;
    
    // Utilities
    useSelector: <T>(selector: StateSelector<T>) => T;
    createSelector: <T>(selector: StateSelector<T>) => StateSelector<T>;
    
    // React state values for reliable re-renders
    isDirtyState: boolean;
    hasUnsavedChangesState: boolean;
}

/**
 * Provider props interface
 */
export interface UnifiedDataProviderProps {
    children: React.ReactNode;
    initialState?: Partial<AppState>;
    enableDevTools?: boolean;
    enableAPIIntegration?: boolean;
    enableOptimisticUpdates?: boolean;
    onError?: (error: Error) => void;
}

/**
 * Hook result types
 */
export interface UseUnifiedDataResult extends UnifiedDataContextValue {
    // Additional utility methods
    reset: () => void;
    clearErrors: () => void;
    isLoading: boolean;
    hasUnsavedChanges: boolean;
    isDirty: boolean;
    setIsDirty: (dirty: boolean) => void;
}

/**
 * Operation dispatch result
 */
export interface DispatchResult<T = void> {
    success: boolean;
    data?: T;
    error?: Error;
    operation: Operation;
}

/**
 * Selector factory options
 */
export interface SelectorOptions {
    equalityFn?: (a: any, b: any) => boolean;
    dependencies?: any[];
}
