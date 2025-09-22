/**
 * Hook for managing object instance data through UnifiedDataContext
 */

import { useCallback, useMemo } from 'react';
import { useUnifiedData } from '../context/UnifiedDataContext';
import { OperationTypes } from '../types/operations';
import { ObjectData, WidgetData } from '../types/state';

export interface UseObjectDataResult {
    // Data access
    object: ObjectData | null;
    isLoading: boolean;
    hasUnsavedChanges: boolean;
    isDirty: boolean;
    errors: Record<string, Error>;
    
    // Object operations
    updateObject: (updates: Partial<ObjectData>) => Promise<void>;
    updateField: (fieldName: string, value: any) => Promise<void>;
    updateTitle: (title: string) => Promise<void>;
    updateStatus: (status: 'draft' | 'published' | 'scheduled') => Promise<void>;
    updateMetadata: (metadata: Record<string, any>) => Promise<void>;
    
    // Widget operations
    updateWidgets: (widgets: Record<string, WidgetData[]>) => Promise<void>;
    updateSlot: (slotName: string, widgets: WidgetData[]) => Promise<void>;
    addWidgetToSlot: (slotName: string, widget: WidgetData) => Promise<void>;
    removeWidgetFromSlot: (slotName: string, widgetId: string) => Promise<void>;
    moveWidget: (fromSlot: string, toSlot: string, widgetId: string, newIndex?: number) => Promise<void>;
    
    // Utility operations
    save: () => Promise<void>;
    reset: () => Promise<void>;
    validate: () => Promise<boolean>;
}

/**
 * Hook to manage object instance data through UnifiedDataContext
 */
export function useObjectData(objectId: string): UseObjectDataResult {
    const { 
        state, 
        dispatch, 
        useSelector, 
        isLoading, 
        hasUnsavedChanges, 
        isDirty,
        errors,
        setIsDirty 
    } = useUnifiedData();

    // Select object from state - safely handle case where objects might not exist yet
    const object = useSelector(state => state.objects?.[objectId] || null);

    // Update entire object
    const updateObject = useCallback(async (updates: Partial<ObjectData>) => {
        await dispatch({
            type: OperationTypes.UPDATE_OBJECT,
            payload: { id: objectId, updates },
            metadata: { source: 'user' }
        });
        setIsDirty(true);
    }, [dispatch, objectId, setIsDirty]);

    // Update specific field in object data
    const updateField = useCallback(async (fieldName: string, value: any) => {
        await dispatch({
            type: OperationTypes.UPDATE_OBJECT_FIELD,
            payload: { id: objectId, fieldName, value },
            metadata: { source: 'user' }
        });
        setIsDirty(true);
    }, [dispatch, objectId, setIsDirty]);

    // Update object title
    const updateTitle = useCallback(async (title: string) => {
        await dispatch({
            type: OperationTypes.UPDATE_OBJECT_TITLE,
            payload: { id: objectId, title },
            metadata: { source: 'user' }
        });
        setIsDirty(true);
    }, [dispatch, objectId, setIsDirty]);

    // Update object status
    const updateStatus = useCallback(async (status: 'draft' | 'published' | 'scheduled') => {
        await dispatch({
            type: OperationTypes.UPDATE_OBJECT_STATUS,
            payload: { id: objectId, status },
            metadata: { source: 'user' }
        });
        setIsDirty(true);
    }, [dispatch, objectId, setIsDirty]);

    // Update object metadata
    const updateMetadata = useCallback(async (metadata: Record<string, any>) => {
        await dispatch({
            type: OperationTypes.UPDATE_OBJECT_METADATA,
            payload: { id: objectId, metadata },
            metadata: { source: 'user' }
        });
        setIsDirty(true);
    }, [dispatch, objectId, setIsDirty]);

    // Update all object widgets
    const updateWidgets = useCallback(async (widgets: Record<string, WidgetData[]>) => {
        await dispatch({
            type: OperationTypes.UPDATE_OBJECT_WIDGETS,
            payload: { id: objectId, widgets },
            metadata: { source: 'user' }
        });
        setIsDirty(true);
    }, [dispatch, objectId, setIsDirty]);

    // Update specific slot widgets
    const updateSlot = useCallback(async (slotName: string, widgets: WidgetData[]) => {
        await dispatch({
            type: OperationTypes.UPDATE_OBJECT_SLOT,
            payload: { id: objectId, slotName, widgets },
            metadata: { source: 'user' }
        });
        setIsDirty(true);
    }, [dispatch, objectId, setIsDirty]);

    // Add widget to slot
    const addWidgetToSlot = useCallback(async (slotName: string, widget: WidgetData) => {
        if (!object) return;
        
        const currentSlotWidgets = object.widgets[slotName] || [];
        const updatedWidgets = [...currentSlotWidgets, widget];
        
        await updateSlot(slotName, updatedWidgets);
    }, [object, updateSlot]);

    // Remove widget from slot
    const removeWidgetFromSlot = useCallback(async (slotName: string, widgetId: string) => {
        if (!object) return;
        
        const currentSlotWidgets = object.widgets[slotName] || [];
        const updatedWidgets = currentSlotWidgets.filter(w => w.id !== widgetId);
        
        await updateSlot(slotName, updatedWidgets);
    }, [object, updateSlot]);

    // Move widget between slots
    const moveWidget = useCallback(async (
        fromSlot: string, 
        toSlot: string, 
        widgetId: string, 
        newIndex?: number
    ) => {
        if (!object) return;
        
        const fromWidgets = [...(object.widgets[fromSlot] || [])];
        const toWidgets = [...(object.widgets[toSlot] || [])];
        
        // Find and remove widget from source slot
        const widgetIndex = fromWidgets.findIndex(w => w.id === widgetId);
        if (widgetIndex === -1) return;
        
        const [widget] = fromWidgets.splice(widgetIndex, 1);
        
        // Add widget to destination slot
        const insertIndex = newIndex !== undefined ? newIndex : toWidgets.length;
        toWidgets.splice(insertIndex, 0, { ...widget, slot: toSlot });
        
        // Update both slots
        const updatedWidgets = {
            ...object.widgets,
            [fromSlot]: fromWidgets,
            [toSlot]: toWidgets
        };
        
        await updateWidgets(updatedWidgets);
    }, [object, updateWidgets]);

    // Save object (this would trigger API call)
    const save = useCallback(async () => {
        // This would be handled by the APIDataManager
        // For now, just mark as saved
        setIsDirty(false);
    }, [setIsDirty]);

    // Reset object to original state
    const reset = useCallback(async () => {
        await dispatch({
            type: OperationTypes.LOAD_OBJECT_DATA,
            payload: { id: objectId },
            metadata: { source: 'system' }
        });
        setIsDirty(false);
    }, [dispatch, objectId, setIsDirty]);

    // Validate object
    const validate = useCallback(async (): Promise<boolean> => {
        // Validation logic would go here
        // For now, return true
        return true;
    }, []);

    return {
        // Data access
        object,
        isLoading,
        hasUnsavedChanges,
        isDirty,
        errors,
        
        // Object operations
        updateObject,
        updateField,
        updateTitle,
        updateStatus,
        updateMetadata,
        
        // Widget operations
        updateWidgets,
        updateSlot,
        addWidgetToSlot,
        removeWidgetFromSlot,
        moveWidget,
        
        // Utility operations
        save,
        reset,
        validate
    };
}

export default useObjectData;
