import { useCallback, useEffect } from 'react';
import { useUnifiedData } from '../context/UnifiedDataContext';
import { useDataLoader } from './useDataLoader';
import { OperationTypes } from '../types/operations';
import { normalizeSlotWidgets, denormalizeWidgetsToSlots } from '../utils/dataLoaders';

export interface UseWidgetSyncResult {
    // Sync operations
    syncWidgetsToContext: (slotWidgets: Record<string, any[]>, pageId: string) => Promise<void>;
    syncWidgetsFromContext: () => Record<string, any[]>;
    
    // Bidirectional sync
    syncWidgetChange: (widgetId: string, updates: any) => Promise<void>;
    syncSlotChange: (slotName: string, widgets: any[]) => Promise<void>;
    
    // Utilities
    isContextPrimary: boolean;
    getWidgetSource: () => 'context' | 'local';
}

export function useWidgetSync(pageId: string): UseWidgetSyncResult {
    const { state, dispatch } = useUnifiedData();
    const { getWidgetsAsSlots, loadWidgets } = useDataLoader();

    // Determine if UnifiedDataContext should be the primary source
    const isContextPrimary = Object.keys(state.widgets).length > 0;

    // Sync widgets from slot format to UnifiedDataContext
    const syncWidgetsToContext = useCallback(async (
        slotWidgets: Record<string, any[]>, 
        pageId: string
    ) => {
        try {
            await loadWidgets(slotWidgets, pageId);
        } catch (error) {
            console.error('❌ Failed to sync widgets to context:', error);
            throw error;
        }
    }, [loadWidgets]);

    // Get widgets from UnifiedDataContext in slot format
    const syncWidgetsFromContext = useCallback((): Record<string, any[]> => {
        return getWidgetsAsSlots();
    }, [getWidgetsAsSlots]);

    // Sync individual widget changes to UnifiedDataContext
    const syncWidgetChange = useCallback(async (widgetId: string, updates: any) => {
        try {
            await dispatch({
                type: OperationTypes.UPDATE_WIDGET_CONFIG,
                payload: {
                    id: widgetId,
                    config: updates.config || updates
                }
            });
        } catch (error) {
            console.error('❌ Failed to sync widget change to context:', error);
            throw error;
        }
    }, [dispatch]);

    // Sync entire slot changes to UnifiedDataContext
    const syncSlotChange = useCallback(async (slotName: string, widgets: any[]) => {
        try {
            // Convert slot widgets to normalized format and update context
            const normalizedWidgets = normalizeSlotWidgets({ [slotName]: widgets }, pageId);
            
            await dispatch({
                type: OperationTypes.LOAD_WIDGET_DATA,
                payload: {
                    widgets: normalizedWidgets
                }
            });
        } catch (error) {
            console.error('❌ Failed to sync slot change to context:', error);
            throw error;
        }
    }, [dispatch, pageId]);

    // Get current widget source
    const getWidgetSource = useCallback((): 'context' | 'local' => {
        return isContextPrimary ? 'context' : 'local';
    }, [isContextPrimary]);

    return {
        syncWidgetsToContext,
        syncWidgetsFromContext,
        syncWidgetChange,
        syncSlotChange,
        isContextPrimary,
        getWidgetSource
    };
}
