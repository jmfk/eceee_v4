import { AppState, StateChangeCallback, StateSelector } from './state';
import { Operation, OperationTypes } from './operations';
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
    dispatch: (operation: Operation) => void;
    publishUpdate: <T extends object>(
        componentId: string,
        type: keyof typeof OperationTypes,
        data: T & { id?: string }
    ) => Promise<void>;
    
    // Persistence
    saveCurrentVersion: () => Promise<any>;
    saveCurrentTheme: () => Promise<any>;
    
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
    useExternalChanges: <T>(componentId: string, callback: StateChangeCallback<T>) => void;
    
    // Metadata operations
    setIsDirty: (isDirty: boolean) => void;
    setIsLoading: (isLoading: boolean) => void;
    setIsObjectLoading: (isLoading: boolean) => void;
    markWidgetDirty: (widgetId: string) => void;
    markWidgetSaved: (widgetId: string) => void;
    addError: (message: string, category?: string) => void;
    addWarning: (message: string, category?: string) => void;
    resetErrors: () => void;
    clearErrors: () => void;
    clearWarnings: () => void;
    resetState: () => void;
    
    // Theme operations
    initTheme: (id: string, data: any) => void;
    switchTheme: (id: string) => void;
    updateTheme: (updates: any, id?: string) => void;
    updateThemeField: (field: string, value: any, id?: string) => void;
    setThemeDirty: (isDirty: boolean) => void;
}

/**
 * Provider props interface
 */
export interface UnifiedDataProviderProps {
    children: React.ReactNode;
    initialState?: Partial<AppState>;
    enableDevTools?: boolean;
    onError?: (error: Error) => void;
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
