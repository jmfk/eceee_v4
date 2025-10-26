import React, { createContext, useContext, useRef, useCallback, useEffect } from 'react';
import { DataManager } from '../core/DataManager';
import { UnifiedDataContextValue, UnifiedDataProviderProps } from '../types/context';
import { Operation, OperationTypes } from '../types/operations';
import { pagesApi } from '../../../api/pages';
import { versionsApi } from '../../../api/versions';
import { objectInstancesApi } from '../../../api/objectStorage';
import { StateChangeCallback, VersionData, PageData } from '../types/state';
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
        // Use ref to keep latest callback without causing subscription recreation
        const callbackRef = React.useRef(callback);

        // Update ref when callback changes, but don't trigger effect
        React.useEffect(() => {
            callbackRef.current = callback;
        }, [callback]);

        useEffect(() => {
            const unsubscribe = manager.subscribe(
                () => manager.getState(),
                (_, operation: Operation) => {
                    // Trigger callback if:
                    // 1. Operation has no sourceId (system operations like SET_DIRTY)
                    // 2. Operation sourceId is different from this component's ID
                    const shouldTrigger = !operation?.sourceId || operation.sourceId !== componentId;

                    if (operation && shouldTrigger) {
                        // Pass metadata including sourceId to callback
                        const metadata = {
                            sourceId: operation.sourceId,
                            type: operation.type,
                            timestamp: Date.now()
                        };
                        // Use current callback from ref
                        callbackRef.current(manager.getState(), metadata);
                    }
                },
                { equalityFn: defaultEqualityFn, componentId }
            );
            return () => {
                if (typeof unsubscribe === 'function') {
                    unsubscribe();
                }
            };
        }, [manager, componentId]); // Removed stableCallback dependency!
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
            const { currentPageId, currentVersionId, currentObjectId } = (state as any).metadata || {};
            if (currentPageId && currentVersionId) {
                augmentedData = {
                    ...augmentedData,
                    contextType: 'page',
                    pageId: String(currentPageId)
                };
            } else if (currentObjectId) {
                augmentedData = {
                    ...augmentedData,
                    contextType: 'object',
                    objectId: String(currentObjectId)
                };
            }
        }

        // Operations that need to preserve their own ID (not componentId)
        const PRESERVE_ID_OPS: Set<keyof typeof OperationTypes> = new Set([
            OperationTypes.INIT_OBJECT,
            OperationTypes.INIT_VERSION,
            OperationTypes.SWITCH_OBJECT_VERSION,
            OperationTypes.SWITCH_VERSION
        ] as unknown as Array<keyof typeof OperationTypes>);

        const operation = {
            type,
            sourceId: componentId,
            payload: PRESERVE_ID_OPS.has(type)
                ? augmentedData  // Don't add componentId, preserve the ID from data
                : {
                    id: componentId,
                    ...augmentedData
                }
        };

        await manager.dispatch(operation);
    }, [manager]);

    // Save to current version using granular smart save API
    const saveCurrentVersion = useCallback(async () => {
        const state = manager.getState();
        const { currentPageId, currentVersionId, currentObjectId } = state.metadata;

        // Determine context type based on what's currently active
        if (currentPageId && currentVersionId) {
            // Page context - save both WebPage and PageVersion data
            const pageData = state.pages[String(currentPageId)] as PageData;
            const versionData = state.versions[String(currentVersionId)] as VersionData;

            if (!versionData) {
                throw new Error(`Version ${currentVersionId} not found in UDC state`);
            }

            // Save WebPage data first (title, slug, pathPattern, hostnames, etc.)
            let pageResult;
            if (pageData) {
                pageResult = await pagesApi.update(currentPageId, pageData);
            }

            // Save PageVersion data (widgets, codeLayout, metaTitle, metaDescription, etc.)
            const versionResult = await versionsApi.update(currentVersionId, versionData);

            // Update page dirty state
            if (versionResult) {
                manager.dispatch({
                    type: OperationTypes.SET_DIRTY,
                    sourceId: 'udc-save-current-version',
                    payload: { isDirty: false }
                });
            }

            return versionResult;
        } else if (currentObjectId) {
            // Object context - save using objectInstancesApi
            const objectData = state.objects[String(currentObjectId)];
            if (!objectData) {
                throw new Error(`Object ${currentObjectId} not found in UDC state`);
            }

            const result = await objectInstancesApi.updateCurrentVersion(currentObjectId, objectData);
            // Update dirty state (use same flag as pages)
            if (result) {
                manager.dispatch({
                    type: OperationTypes.SET_DIRTY,
                    sourceId: 'udc-save-current-version',
                    payload: { isDirty: false }
                });
            }

            // let apiCall
            // if (isNewInstance) {
            //     apiCall = objectInstancesApi.create(data)
            // } else if (mode === 'update_current') {
            //     apiCall = objectInstancesApi.updateCurrentVersion(instance.id, data)
            // } else {
            //     apiCall = objectInstancesApi.update(instance.id, data)
            // }


            return result;
        } else {
            throw new Error('No current page or object selected in UDC');
        }
    }, [manager]);

    // Theme operations
    const initTheme = useCallback((id: string, data: any) => {
        manager.dispatch({
            type: OperationTypes.INIT_THEME,
            sourceId: undefined, // No sourceId so all components receive the update
            payload: { id, data }
        });
    }, [manager]);

    const switchTheme = useCallback((id: string) => {
        manager.dispatch({
            type: OperationTypes.SWITCH_THEME,
            sourceId: 'theme-editor',
            payload: { id }
        });
    }, [manager]);

    const updateTheme = useCallback((updates: any, id?: string) => {
        manager.dispatch({
            type: OperationTypes.UPDATE_THEME,
            sourceId: undefined,
            payload: { id, updates }
        });
    }, [manager]);

    const updateThemeField = useCallback((field: string, value: any, id?: string) => {
        manager.dispatch({
            type: OperationTypes.UPDATE_THEME_FIELD,
            sourceId: undefined,
            payload: { id, field, value }
        });
    }, [manager]);

    const setThemeDirty = useCallback((isDirty: boolean) => {
        manager.dispatch({
            type: OperationTypes.SET_THEME_DIRTY,
            sourceId: undefined,
            payload: { isDirty }
        });
    }, [manager]);

    const saveCurrentTheme = useCallback(async () => {
        const state = manager.getState();
        const currentThemeId = state.metadata.currentThemeId;

        if (!currentThemeId) {
            throw new Error('No current theme selected in UDC');
        }

        const themeData = state.themes[currentThemeId];
        if (!themeData) {
            throw new Error(`Theme ${currentThemeId} not found in UDC state`);
        }

        // Import themesApi dynamically to avoid circular dependencies
        const { themesApi } = await import('../../../api/themes');

        // Save theme data
        const result = await themesApi.update(currentThemeId, themeData);

        // Update dirty state
        if (result) {
            manager.dispatch({
                type: OperationTypes.SET_THEME_DIRTY,
                sourceId: 'udc-save-current-theme',
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
        saveCurrentVersion,
        // Theme operations
        initTheme,
        switchTheme,
        updateTheme,
        updateThemeField,
        setThemeDirty,
        saveCurrentTheme
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