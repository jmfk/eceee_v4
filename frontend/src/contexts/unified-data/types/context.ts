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
    
    // Metadata state
    isDirty: boolean;
    hasUnsavedChanges: boolean;
    isLoading: boolean;
    errors: Record<string, Error>;
    widgetStates: {
        unsavedChanges: Record<string, boolean>;
        errors: Record<string, Error>;
        activeEditors: string[];
    };

    // Metadata actions
    setIsDirty: (dirty: boolean) => void;
    setIsLoading: (loading: boolean) => void;
    setError: (key: string, error: Error | null) => void;
    markWidgetDirty: (widgetId: string) => void;
    markWidgetSaved: (widgetId: string) => void;
    setWidgetError: (widgetId: string, error: Error | null) => void;
    setWidgetStates: React.Dispatch<React.SetStateAction<{
        unsavedChanges: Record<string, boolean>;
        errors: Record<string, Error>;
        activeEditors: string[];
    }>>;
}

/**
 * Provider props interface
 */
export interface UnifiedDataProviderProps {
    children: React.ReactNode;
    initialState?: Partial<AppState>;
    // enableDevTools removed to simplify the system
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
