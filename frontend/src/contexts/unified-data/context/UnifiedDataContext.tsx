import React, { createContext, useContext, useRef, useCallback, useEffect } from 'react';
import { DataManager } from '../core/DataManager';
import { UnifiedDataContextValue, UnifiedDataProviderProps } from '../types/context';
import { Operation, OperationTypes } from '../types/operations';
import { versionsApi } from '../../../api/versions';
import { processLoadedVersionData } from '../../../utils/smartSaveUtils';
import { StateChangeCallback, VersionData } from '../types/state';
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

    // Error handling
    const handleError = useCallback((error: Error) => {
        console.error('UnifiedDataContext error:', error);
        onError?.(error);
    }, [onError]);

    const useExternalChanges = useCallback(<T,>(componentId: string, callback: StateChangeCallback<T>): void => {
        const stableCallback = React.useMemo(
            () => (state: any) => callback(state),
            [callback.toString(), componentId]
        );
        useEffect(() => {
            manager.subscribe(
                () => manager.getState(),
                (_, operation: Operation) => {
                    if (operation && operation?.sourceId && operation?.sourceId !== componentId) {
                        stableCallback(manager.getState());
                    }
                },
                { equalityFn: defaultEqualityFn, componentId }
            );
        }, [stableCallback, componentId]);
    }, [manager]);


    // Convenience methods for metadata operations
    const setIsDirty = useCallback((isDirty: boolean) => {
        manager.dispatch({
            type: OperationTypes.SET_DIRTY,
            sourceId: undefined,
            payload: { isDirty }
        });
    }, [manager]);

    const setIsLoading = useCallback((isLoading: boolean) => {
        manager.dispatch({
            type: OperationTypes.SET_LOADING,
            sourceId: undefined,
            payload: { isLoading }
        });
    }, [manager]);

    const setIsObjectDirty = useCallback((isDirty: boolean) => {
        manager.dispatch({
            type: OperationTypes.SET_OBJECT_DIRTY,
            sourceId: undefined,
            payload: { isDirty }
        });
    }, [manager]);

    const setIsObjectLoading = useCallback((isLoading: boolean) => {
        manager.dispatch({
            type: OperationTypes.SET_OBJECT_LOADING,
            sourceId: undefined,
            payload: { isLoading }
        });
    }, [manager]);

    const markWidgetDirty = useCallback((widgetId: string) => {
        manager.dispatch({
            type: OperationTypes.MARK_WIDGET_DIRTY,
            sourceId: widgetId,
            payload: { widgetId }
        });
    }, [manager]);

    const markWidgetSaved = useCallback((widgetId: string) => {
        manager.dispatch({
            type: OperationTypes.MARK_WIDGET_SAVED,
            sourceId: widgetId,
            payload: { widgetId }
        });
    }, [manager]);

    const addError = useCallback((message: string, category?: string, sourceId?: string) => {
        manager.dispatch({
            type: OperationTypes.ADD_ERROR,
            sourceId: sourceId,
            payload: { message, category }
        });
    }, [manager]);

    const addWarning = useCallback((message: string, category?: string, sourceId?: string) => {
        manager.dispatch({
            type: OperationTypes.ADD_WARNING,
            sourceId: sourceId,
            payload: { message, category }
        });
    }, [manager]);

    const clearErrors = useCallback(() => {
        manager.dispatch({
            type: OperationTypes.CLEAR_ERRORS,
            sourceId: undefined,
            payload: undefined
        });
    }, [manager]);

    const clearWarnings = useCallback(() => {
        manager.dispatch({
            type: OperationTypes.CLEAR_WARNINGS,
            sourceId: undefined,
            payload: undefined
        });
    }, [manager]);

    const resetState = useCallback(() => {
        manager.dispatch({
            type: OperationTypes.RESET_STATE,
            sourceId: undefined,
            payload: {}
        });
    }, [manager]);

    const resetErrors = useCallback(() => {
        manager.dispatch({
            type: OperationTypes.RESET_STATE,
            sourceId: undefined,
            payload: undefined
        });
    }, [manager]);

    // Generic publish update function for pub/sub system
    const publishUpdate = useCallback(async <T,>(componentId: string, type: keyof typeof OperationTypes, data: T) => {
        // Auto-attach context for widget operations so widgets know if they are on a page or object
        const WIDGET_OPS: Set<keyof typeof OperationTypes> = new Set([
            OperationTypes.ADD_WIDGET,
            OperationTypes.UPDATE_WIDGET_CONFIG,
            OperationTypes.MOVE_WIDGET,
            OperationTypes.REMOVE_WIDGET
        ] as unknown as Array<keyof typeof OperationTypes>);

        const state = manager.getState();
        let augmentedData: any = { ...data };

        if (WIDGET_OPS.has(type)) {
            const { currentPageId, currentVersionId, currentObjectId, currentObjectVersionId } = (state as any).metadata || {};
            if (currentPageId && currentVersionId) {
                augmentedData = {
                    ...augmentedData,
                    contextType: 'page',
                    pageId: String(currentPageId)
                };
            } else if (currentObjectId && currentObjectVersionId) {
                augmentedData = {
                    ...augmentedData,
                    contextType: 'object',
                    objectId: String(currentObjectId)
                };
            }
        }

        await manager.dispatch({
            type,
            sourceId: componentId,
            payload: {
                id: componentId,
                ...augmentedData
            }
        });
    }, [manager]);

    // Save to current version using granular smart save API
    const saveCurrentVersion = useCallback(async () => {
        const state = manager.getState();
        const versionId = state.metadata.currentVersionId;
        if (!versionId) {
            throw new Error('No current version selected in UDC');
        }

        const version = state.versions[String(versionId)] as VersionData;
        if (!version) {
            throw new Error(`Version ${versionId} not found in UDC state`);
        }

        const result = await versionsApi.update(versionId, version);
        // Update versions state with processed data if available
        if (result) {
            manager.dispatch({
                type: OperationTypes.SET_DIRTY,
                sourceId: 'udc-save-current-version',
                payload: { isDirty: false }
            });
        }

        return result;
    }, [manager]);

    // Create context value
    const contextValue: UnifiedDataContextValue = {
        state: manager.getState(),
        getState: manager.getState.bind(manager),
        dispatch: (operation) => {
            try {
                manager.dispatch(operation);
            } catch (error) {
                handleError(error as Error);
                throw error;
            }
        },
        subscribe: manager.subscribe.bind(manager),
        subscribeToOperations: manager.subscribeToOperations.bind(manager),
        useExternalChanges,
        setIsDirty,
        setIsLoading,
        setIsObjectDirty,
        setIsObjectLoading,
        markWidgetDirty,
        markWidgetSaved,
        addError,
        addWarning,
        clearErrors,
        clearWarnings,
        resetState,
        resetErrors,
        publishUpdate,
        saveCurrentVersion
    };

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
export function useUnifiedData(): UnifiedDataContextValue {
    const context = useContext(UnifiedDataContext);
    if (!context) {
        throw new Error('useUnifiedData must be used within UnifiedDataProvider');
    }
    return context;
}

export default UnifiedDataContext;