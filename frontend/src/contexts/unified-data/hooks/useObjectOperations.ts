/**
 * Write-only hook for object operations (no state subscriptions)
 * This hook provides write-only access to UnifiedDataContext without causing re-renders
 * 
 * Based on PageEditor's approach - operations only, no reactive state
 */

import { useCallback } from 'react';
import { useUnifiedData } from '../context/UnifiedDataContext';
import { OperationTypes } from '../types/operations';
import { WidgetData } from '../types/state';

export interface UseObjectOperationsResult {
    // Object field operations (write-only, no re-renders)
    updateTitle: (title: string, source?: 'user' | 'system') => Promise<void>;
    updateStatus: (status: 'draft' | 'published' | 'scheduled', source?: 'user' | 'system') => Promise<void>;
    updateField: (fieldName: string, value: any, source?: 'user' | 'system') => Promise<void>;
    updateMetadata: (metadata: Record<string, any>, source?: 'user' | 'system') => Promise<void>;
    
    // Widget operations (write-only, no re-renders)
    updateWidgetSlot: (slotName: string, widgets: WidgetData[], source?: 'user' | 'system') => Promise<void>;
    updateAllWidgets: (widgets: Record<string, WidgetData[]>, source?: 'user' | 'system') => Promise<void>;
    
    // Utility operations
    markDirty: () => void;
    markSaved: () => void;
    
    // Non-reactive data access (point-in-time reads)
    getCurrentData: () => any;
    objectExists: () => boolean;
}

/**
 * Hook for write-only object operations without state subscriptions
 * Use this in components that should NOT re-render when object data changes
 */
export function useObjectOperations(objectId: string): UseObjectOperationsResult {
    const { 
        dispatch, 
        getState, // Use getState instead of useSelector to avoid subscriptions
        setIsDirty 
    } = useUnifiedData();

    // Update object title
    const updateTitle = useCallback(async (title: string, source: 'user' | 'system' = 'user') => {
        await dispatch({
            type: OperationTypes.UPDATE_OBJECT_TITLE,
            payload: { id: objectId, title },
            metadata: { source }
        });
        
        if (source === 'user') {
            setIsDirty(true);
        }
    }, [dispatch, objectId, setIsDirty]);

    // Update object status
    const updateStatus = useCallback(async (status: 'draft' | 'published' | 'scheduled', source: 'user' | 'system' = 'user') => {
        await dispatch({
            type: OperationTypes.UPDATE_OBJECT_STATUS,
            payload: { id: objectId, status },
            metadata: { source }
        });
        
        if (source === 'user') {
            setIsDirty(true);
        }
    }, [dispatch, objectId, setIsDirty]);

    // Update specific field in object data
    const updateField = useCallback(async (fieldName: string, value: any, source: 'user' | 'system' = 'user') => {
        await dispatch({
            type: OperationTypes.UPDATE_OBJECT_FIELD,
            payload: { id: objectId, fieldName, value },
            metadata: { source }
        });
        
        if (source === 'user') {
            setIsDirty(true);
        }
    }, [dispatch, objectId, setIsDirty]);

    // Update object metadata
    const updateMetadata = useCallback(async (metadata: Record<string, any>, source: 'user' | 'system' = 'user') => {
        await dispatch({
            type: OperationTypes.UPDATE_OBJECT_METADATA,
            payload: { id: objectId, metadata },
            metadata: { source }
        });
        
        if (source === 'user') {
            setIsDirty(true);
        }
    }, [dispatch, objectId, setIsDirty]);

    // Update specific widget slot
    const updateWidgetSlot = useCallback(async (slotName: string, widgets: WidgetData[], source: 'user' | 'system' = 'user') => {
        await dispatch({
            type: OperationTypes.UPDATE_OBJECT_SLOT,
            payload: { id: objectId, slotName, widgets },
            metadata: { source }
        });
        
        if (source === 'user') {
            setIsDirty(true);
        }
    }, [dispatch, objectId, setIsDirty]);

    // Update all object widgets
    const updateAllWidgets = useCallback(async (widgets: Record<string, WidgetData[]>, source: 'user' | 'system' = 'user') => {
        await dispatch({
            type: OperationTypes.UPDATE_OBJECT_WIDGETS,
            payload: { id: objectId, widgets },
            metadata: { source }
        });
        
        if (source === 'user') {
            setIsDirty(true);
        }
    }, [dispatch, objectId, setIsDirty]);

    // Mark object as dirty (for manual dirty state management)
    const markDirty = useCallback(() => {
        setIsDirty(true);
    }, [setIsDirty]);

    // Mark object as saved (clear dirty state)
    const markSaved = useCallback(() => {
        setIsDirty(false);
    }, [setIsDirty]);

    // Get current object data (point-in-time read, no subscription)
    const getCurrentData = useCallback(() => {
        const currentState = getState();
        return currentState.objects?.[objectId] || null;
    }, [objectId, getState]);

    // Check if object exists (non-reactive)
    const objectExists = useCallback(() => {
        const currentState = getState();
        return !!currentState.objects?.[objectId];
    }, [objectId, getState]);

    return {
        // Object field operations (write-only, no re-renders)
        updateTitle,
        updateStatus,
        updateField,
        updateMetadata,
        
        // Widget operations (write-only, no re-renders)
        updateWidgetSlot,
        updateAllWidgets,
        
        // Utility operations
        markDirty,
        markSaved,
        
        // Non-reactive data access
        getCurrentData,
        objectExists
    };
}

export default useObjectOperations;
