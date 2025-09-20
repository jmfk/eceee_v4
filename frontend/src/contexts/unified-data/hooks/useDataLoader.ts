import { useCallback, useEffect } from 'react';
import { useUnifiedData } from '../context/UnifiedDataContext';
import { OperationTypes } from '../types/operations';
import { 
    normalizePageData, 
    normalizeSlotWidgets, 
    normalizeLayoutData, 
    normalizeVersionData,
    createAppStateFromAPI,
    denormalizeWidgetsToSlots
} from '../utils/dataLoaders';

export interface UseDataLoaderResult {
    // Loading operations
    loadPageData: (pageData: any, versionData: any, layoutData?: any) => Promise<void>;
    loadWidgets: (widgets: Record<string, any[]>, pageId: string) => Promise<void>;
    loadLayout: (layoutData: any) => Promise<void>;
    syncFromAPI: (apiData: any) => Promise<void>;
    
    // Data conversion utilities
    getWidgetsAsSlots: () => Record<string, any[]>;
    getPageData: (pageId: string) => any;
    getLayoutData: (layoutId: string) => any;
    
    // State management
    markAsLoading: (loading: boolean) => Promise<void>;
    clearData: () => Promise<void>;
}

export function useDataLoader(): UseDataLoaderResult {
    const { dispatch, state } = useUnifiedData();

    // Load complete page data (page + version + layout)
    const loadPageData = useCallback(async (
        pageData: any, 
        versionData: any, 
        layoutData?: any
    ) => {
        try {
            
            const normalizedPage = normalizePageData(pageData);
            const normalizedVersion = normalizeVersionData(versionData);
            const normalizedWidgets = normalizeSlotWidgets(versionData.widgets || {}, normalizedPage.id);
            const normalizedLayout = layoutData ? normalizeLayoutData(layoutData) : undefined;

            await dispatch({
                type: OperationTypes.LOAD_PAGE_DATA,
                payload: {
                    pageId: normalizedPage.id,
                    pageData: normalizedPage,
                    widgets: normalizedWidgets,
                    layouts: normalizedLayout ? {
                        [normalizedLayout.id]: normalizedLayout
                    } : undefined,
                    versions: {
                        [normalizedVersion.id]: normalizedVersion
                    }
                }
            });

        } catch (error) {
            console.error('❌ useDataLoader: Failed to load page data', error);
            throw error;
        }
    }, [dispatch]);

    // Load widgets from slot-based format
    const loadWidgets = useCallback(async (
        slotWidgets: Record<string, any[]>, 
        pageId: string
    ) => {
        try {
            const normalizedWidgets = normalizeSlotWidgets(slotWidgets, pageId);
            
            await dispatch({
                type: OperationTypes.LOAD_WIDGET_DATA,
                payload: {
                    widgets: normalizedWidgets
                }
            });
        } catch (error) {
            console.error('❌ useDataLoader: Failed to load widgets', error);
            throw error;
        }
    }, [dispatch]);

    // Load layout data
    const loadLayout = useCallback(async (layoutData: any) => {
        try {
            const normalizedLayout = normalizeLayoutData(layoutData);
            
            await dispatch({
                type: OperationTypes.LOAD_LAYOUT_DATA,
                payload: {
                    layoutId: normalizedLayout.id,
                    layoutData: normalizedLayout
                }
            });
        } catch (error) {
            console.error('❌ useDataLoader: Failed to load layout', error);
            throw error;
        }
    }, [dispatch]);

    // Sync arbitrary data from API
    const syncFromAPI = useCallback(async (apiData: any) => {
        try {
            const stateUpdates = createAppStateFromAPI(
                apiData.page,
                apiData.version,
                apiData.layout
            );
            
            await dispatch({
                type: OperationTypes.SYNC_FROM_API,
                payload: { stateUpdates }
            });
        } catch (error) {
            console.error('❌ useDataLoader: Failed to sync from API', error);
            throw error;
        }
    }, [dispatch]);

    // Convert current widgets back to slot format for PageEditor compatibility
    const getWidgetsAsSlots = useCallback((): Record<string, any[]> => {
        return denormalizeWidgetsToSlots(state.widgets);
    }, [state.widgets]);

    // Get page data by ID
    const getPageData = useCallback((pageId: string) => {
        return state.pages[pageId] || null;
    }, [state.pages]);

    // Get layout data by ID
    const getLayoutData = useCallback((layoutId: string) => {
        return state.layouts[layoutId] || null;
    }, [state.layouts]);

    // Mark as loading
    const markAsLoading = useCallback(async (loading: boolean) => {
        await dispatch({
            type: OperationTypes.SYNC_FROM_API,
            payload: {
                stateUpdates: {
                    metadata: { isLoading: loading }
                }
            }
        });
    }, [dispatch]);

    // Clear all data
    const clearData = useCallback(async () => {
        await dispatch({
            type: OperationTypes.RESET_STATE,
            payload: undefined
        });
    }, [dispatch]);

    return {
        loadPageData,
        loadWidgets,
        loadLayout,
        syncFromAPI,
        getWidgetsAsSlots,
        getPageData,
        getLayoutData,
        markAsLoading,
        clearData
    };
}
