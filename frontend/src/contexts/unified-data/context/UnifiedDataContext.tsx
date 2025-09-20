import React, { createContext, useContext, useRef, useMemo, useCallback, useEffect } from 'react';
import { DataManager } from '../core/DataManager';
import { APIDataManager } from '../core/APIDataManager';
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
    // enableDevTools removed
    enableAPIIntegration = true,
    enableOptimisticUpdates = true,
    onError
}: UnifiedDataProviderProps) {
    // Create DataManager instance (API-enabled or basic)
    const managerRef = useRef<DataManager | null>(null);
    if (!managerRef.current) {
        if (enableAPIIntegration) {
            managerRef.current = new APIDataManager(initialState, {
                enableAPIIntegration,
                enableOptimisticUpdates
            }) as DataManager;
        } else {
            managerRef.current = new DataManager(initialState);
        }
    }
    const manager = managerRef.current;

    // Metadata state management
    const [isDirtyState, setIsDirtyState] = React.useState(false);
    const [hasUnsavedChangesState, setHasUnsavedChangesState] = React.useState(false);
    const [isLoadingState, setIsLoadingState] = React.useState(false);
    const [errorsState, setErrorsState] = React.useState<Record<string, Error>>({});
    const [widgetStates, setWidgetStates] = React.useState({
        unsavedChanges: {} as Record<string, boolean>,
        errors: {} as Record<string, Error>,
        activeEditors: [] as string[]
    });

    // Subscribe to operations to update metadata state
    useEffect(() => {
        return manager.subscribeToOperations((operation) => {
            // Update metadata state based on operations
            switch (operation.type) {
                case 'UPDATE_WIDGET_CONFIG':
                case 'MOVE_WIDGET':
                case 'ADD_WIDGET':
                    // Mark widget as dirty
                    const widgetId = operation.payload.id || operation.payload.widgetId;
                    if (widgetId) {
                        setWidgetStates(prev => {
                            const newUnsavedChanges = { ...prev.unsavedChanges, [widgetId]: true };
                            const hasChanges = Object.values(newUnsavedChanges).some(Boolean);
                            setHasUnsavedChangesState(hasChanges);
                            setIsDirtyState(hasChanges);
                            return {
                                ...prev,
                                unsavedChanges: newUnsavedChanges
                            };
                        });
                    }
                    break;
                case 'REMOVE_WIDGET':
                    // Remove widget from unsaved changes
                    const removedWidgetId = operation.payload.id;
                    if (removedWidgetId) {
                        setWidgetStates(prev => {
                            const { [removedWidgetId]: _, ...remainingChanges } = prev.unsavedChanges;
                            const hasChanges = Object.values(remainingChanges).some(Boolean);
                            setHasUnsavedChangesState(hasChanges);
                            setIsDirtyState(hasChanges);
                            return {
                                ...prev,
                                unsavedChanges: remainingChanges
                            };
                        });
                    }
                    break;
                case 'SET_DIRTY':
                    setIsDirtyState(operation.payload.isDirty);
                    setHasUnsavedChangesState(operation.payload.isDirty);
                    break;
                case 'RESET_STATE':
                    setWidgetStates(prev => ({
                        ...prev,
                        unsavedChanges: {}
                    }));
                    setIsDirtyState(false);
                    setHasUnsavedChangesState(false);
                    break;
                case 'MARK_WIDGET_SAVED':
                    const savedWidgetId = operation.payload.widgetId;
                    if (savedWidgetId) {
                        setWidgetStates(prev => {
                            const { [savedWidgetId]: _, ...remainingChanges } = prev.unsavedChanges;
                            const hasChanges = Object.values(remainingChanges).some(Boolean);
                            setHasUnsavedChangesState(hasChanges);
                            setIsDirtyState(hasChanges);
                            return {
                                ...prev,
                                unsavedChanges: remainingChanges
                            };
                        });
                    }
                    break;
            }
        });
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

    // Methods for managing widget states
    const markWidgetDirty = useCallback((widgetId: string) => {
        setWidgetStates(prev => ({
            ...prev,
            unsavedChanges: { ...prev.unsavedChanges, [widgetId]: true }
        }));
    }, []);

    const markWidgetSaved = useCallback((widgetId: string) => {
        setWidgetStates(prev => {
            const { [widgetId]: _, ...remainingChanges } = prev.unsavedChanges;
            return {
                ...prev,
                unsavedChanges: remainingChanges
            };
        });
    }, []);

    const setWidgetError = useCallback((widgetId: string, error: Error | null) => {
        setWidgetStates(prev => {
            const newErrors = { ...prev.errors };
            if (error) {
                newErrors[widgetId] = error;
            } else {
                delete newErrors[widgetId];
            }
            return {
                ...prev,
                errors: newErrors
            };
        });
    }, []);

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
                // Update error state in context
                setErrorsState(prev => ({
                    ...prev,
                    [operation.type]: error as Error
                }));
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

        // Metadata state
        isDirty: isDirtyState,
        hasUnsavedChanges: hasUnsavedChangesState,
        isLoading: isLoadingState,
        errors: errorsState,
        widgetStates,

        // Metadata actions
        setIsDirty: setIsDirtyState,
        setIsLoading: setIsLoadingState,
        setError: (key: string, error: Error | null) => {
            setErrorsState(prev => {
                const newErrors = { ...prev };
                if (error) {
                    newErrors[key] = error;
                } else {
                    delete newErrors[key];
                }
                return newErrors;
            });
        },
        markWidgetDirty,
        markWidgetSaved,
        setWidgetError,
        setWidgetStates
    }), [
        manager, batchDispatch, useSelector, createSelector, handleError,
        isDirtyState, hasUnsavedChangesState, isLoadingState, errorsState, widgetStates,
        markWidgetDirty, markWidgetSaved, setWidgetError
    ]);

    // DevTools integration removed to simplify the system

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

    // Use React state from context for all metadata
    const isLoading = context.isLoading;
    const hasUnsavedChanges = context.hasUnsavedChanges;
    const isDirty = context.isDirty;

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
