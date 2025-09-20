import React, { createContext, useContext, useRef, useMemo, useCallback, useEffect } from 'react';
import { DataManager } from '../core/DataManager';
import { UnifiedDataContextValue, UnifiedDataProviderProps, UseUnifiedDataResult } from '../types/context';
import { Operation } from '../types/operations';
import { StateSelector } from '../types/state';
import { defaultEqualityFn } from '../utils/equality';

// Create the context
const UnifiedDataContext = createContext<UnifiedDataContextValue | null>(null);

/**
 * UnifiedDataProvider component
 */
export function UnifiedDataProvider({
    children,
    initialState,
    enableDevTools = false,
    onError
}: UnifiedDataProviderProps) {
    // Create DataManager instance
    const managerRef = useRef<DataManager | null>(null);
    if (!managerRef.current) {
        managerRef.current = new DataManager(initialState);
    }
    const manager = managerRef.current;

    // Direct state management for isDirty to ensure React re-renders
    const [isDirtyState, setIsDirtyState] = React.useState(false);
    const [hasUnsavedChangesState, setHasUnsavedChangesState] = React.useState(false);

    // Subscribe to DataManager state changes and update React state
    useEffect(() => {
        return manager.subscribe(
            state => state.metadata.isDirty,
            (newIsDirty) => {
                setIsDirtyState(newIsDirty);
            }
        );
    }, [manager]);

    useEffect(() => {
        return manager.subscribe(
            state => Object.values(state.metadata.widgetStates.unsavedChanges).some(Boolean),
            (newHasUnsavedChanges) => {
                setHasUnsavedChangesState(newHasUnsavedChanges);
            }
        );
    }, [manager]);

    // Error handling
    const handleError = useCallback((error: Error) => {
        console.error('UnifiedDataContext error:', error);
        onError?.(error);
    }, [onError]);

    // Create selector hook
    const useSelector = useCallback(<T,>(selector: StateSelector<T>): T => {
        const [value, setValue] = React.useState(() => selector(manager.getState()));
        const selectorRef = React.useRef(selector);
        selectorRef.current = selector;

        useEffect(() => {
            return manager.subscribe(
                (state) => selectorRef.current(state),
                (newValue) => setValue(newValue),
                { equalityFn: defaultEqualityFn }
            );
        }, []); // Empty dependency array - subscription stays stable

        return value;
    }, [manager]);

    // Create selector factory
    const createSelector = useCallback(<T,>(selector: StateSelector<T>): StateSelector<T> => {
        return (state) => selector(state);
    }, []);

    // Batch dispatch helper
    const batchDispatch = useCallback(async (operations: Operation[]) => {
        try {
            await manager.dispatch({
                type: 'BATCH',
                payload: operations
            });
        } catch (error) {
            handleError(error as Error);
            throw error;
        }
    }, [manager, handleError]);

    // Create context value
    const contextValue = useMemo<UnifiedDataContextValue>(() => ({
        // State access
        state: manager.getState(),
        getState: manager.getState.bind(manager),

        // Operations
        dispatch: async (operation, options) => {
            try {
                await manager.dispatch(operation, options);
            } catch (error) {
                handleError(error as Error);
                throw error;
            }
        },
        batchDispatch,

        // Subscriptions
        subscribe: manager.subscribe.bind(manager),
        subscribeToOperations: manager.subscribeToOperations.bind(manager),

        // Utilities
        useSelector,
        createSelector,

        // React state values for reliable re-renders
        isDirtyState,
        hasUnsavedChangesState
    }), [manager, batchDispatch, useSelector, createSelector, handleError, isDirtyState, hasUnsavedChangesState]);

    // Set up dev tools if enabled
    useEffect(() => {
        if (enableDevTools && typeof window !== 'undefined') {
            (window as any).__UNIFIED_DATA__ = {
                getState: manager.getState.bind(manager),
                dispatch: manager.dispatch.bind(manager),
                subscribe: manager.subscribe.bind(manager)
            };
        }

        return () => {
            if (enableDevTools && typeof window !== 'undefined') {
                delete (window as any).__UNIFIED_DATA__;
            }
        };
    }, [enableDevTools, manager]);

    // Cleanup on unmount
    useEffect(() => {
        return () => {
            manager.clear();
        };
    }, [manager]);

    return (
        <UnifiedDataContext.Provider value={contextValue}>
            {children}
        </UnifiedDataContext.Provider>
    );
}

/**
 * Hook to use the UnifiedDataContext
 */
export function useUnifiedData(): UseUnifiedDataResult {
    const context = useContext(UnifiedDataContext);
    if (!context) {
        throw new Error('useUnifiedData must be used within UnifiedDataProvider');
    }

    const {
        state,
        dispatch,
        useSelector,
        ...rest
    } = context;

    // Additional utility methods
    const reset = useCallback(() => {
        dispatch({
            type: 'RESET_STATE',
            payload: undefined
        });
    }, [dispatch]);

    const clearErrors = useCallback(() => {
        dispatch({
            type: 'CLEAR_ERRORS',
            payload: undefined
        });
    }, [dispatch]);

    // Derived state (using direct React state for reliable re-renders)
    const isLoading = useSelector(state => state.metadata.isLoading);
    const hasUnsavedChanges = context.hasUnsavedChangesState; // Use React state from context
    const isDirty = context.isDirtyState; // Use React state from context

    // setIsDirty method
    const setIsDirty = useCallback((dirty: boolean) => {
        dispatch({
            type: 'SET_DIRTY',
            payload: { isDirty: dirty }
        });
    }, [dispatch]);

    return {
        state,
        dispatch,
        useSelector,
        ...rest,
        reset,
        clearErrors,
        isLoading,
        hasUnsavedChanges,
        isDirty,
        setIsDirty
    };
}

export default UnifiedDataContext;
