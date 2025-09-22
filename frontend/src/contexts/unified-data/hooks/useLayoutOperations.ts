import { useCallback, useMemo, useState } from 'react';
import { useUnifiedData } from '../context/UnifiedDataContext';
import { LayoutData, LayoutSlot } from '../types/state';
import { OperationTypes } from '../types/operations';

export interface UseLayoutOperationsResult {
    // Layout data
    layout: LayoutData | null;
    slots: LayoutSlot[];
    theme: string | null;
    
    // Operations
    updateLayout: (updates: Partial<LayoutData>) => Promise<void>;
    updateTheme: (theme: string) => Promise<void>;
    addSlot: (slot: LayoutSlot) => Promise<void>;
    removeSlot: (slotId: string) => Promise<void>;
    updateSlot: (slotId: string, updates: Partial<LayoutSlot>) => Promise<void>;
    reorderSlots: (slotIds: string[]) => Promise<void>;
    duplicateLayout: (newName?: string) => Promise<string>;
    deleteLayout: () => Promise<void>;
    
    // Utilities
    getSlot: (slotId: string) => LayoutSlot | null;
    canAddWidget: (slotId: string, widgetType: string) => boolean;
    getSlotWidgets: (slotId: string) => any[];
}

export function useLayoutOperations(layoutId: string): UseLayoutOperationsResult {
    const { dispatch, useExternalChanges } = useUnifiedData();

    // State
    const [layout, setLayout] = useState<LayoutData | null>(null);
    const [slots, setSlots] = useState<LayoutSlot[]>([]);
    const [theme, setTheme] = useState<string | null>(null);

    // Subscribe to external changes
    useExternalChanges(`layout-ops-${layoutId}`, state => {
        setLayout(state.layouts[layoutId] || null);
        setSlots(state.layouts[layoutId]?.slots || []);
        setTheme(state.layouts[layoutId]?.theme || null);
    });

    // Operations
    const updateLayout = useCallback(async (updates: Partial<LayoutData>) => {
        await dispatch({
            type: OperationTypes.UPDATE_LAYOUT,
            sourceId: `layout-ops-${layoutId}`,
            payload: {
                id: layoutId,
                updates
            }
        });
    }, [dispatch, layoutId]);

    const updateTheme = useCallback(async (newTheme: string) => {
        await dispatch({
            type: OperationTypes.UPDATE_LAYOUT_THEME,
            sourceId: `layout-ops-${layoutId}`,
            payload: {
                id: layoutId,
                theme: newTheme
            }
        });
    }, [dispatch, layoutId]);

    const addSlot = useCallback(async (slot: LayoutSlot) => {
        await dispatch({
            type: OperationTypes.ADD_LAYOUT_SLOT,
            sourceId: `layout-ops-${layoutId}`,
            payload: {
                layoutId,
                slot
            }
        });
    }, [dispatch, layoutId]);

    const removeSlot = useCallback(async (slotId: string) => {
        await dispatch({
            type: OperationTypes.REMOVE_LAYOUT_SLOT,
            sourceId: `layout-ops-${layoutId}`,
            payload: {
                layoutId,
                slotId
            }
        });
    }, [dispatch, layoutId]);

    const updateSlot = useCallback(async (slotId: string, updates: Partial<LayoutSlot>) => {
        await dispatch({
            type: OperationTypes.UPDATE_LAYOUT_SLOT,
            sourceId: `layout-ops-${layoutId}`,
            payload: {
                layoutId,
                slotId,
                updates
            }
        });
    }, [dispatch, layoutId]);

    const reorderSlots = useCallback(async (slotIds: string[]) => {
        await dispatch({
            type: OperationTypes.REORDER_LAYOUT_SLOTS,
            sourceId: `layout-ops-${layoutId}`,
            payload: {
                layoutId,
                slotIds
            }
        });
    }, [dispatch, layoutId]);

    const duplicateLayout = useCallback(async (newName?: string): Promise<string> => {
        const result = await dispatch({
            type: OperationTypes.DUPLICATE_LAYOUT,
            sourceId: `layout-ops-${layoutId}`,            
            payload: {
                id: layoutId,
                newName
            }
        });
        return result.newLayoutId;
    }, [dispatch, layoutId]);

    const deleteLayout = useCallback(async () => {
        await dispatch({
            type: OperationTypes.DELETE_LAYOUT,
            sourceId: `layout-ops-${layoutId}`,            
            payload: {
                id: layoutId
            }
        });
    }, [dispatch, layoutId]);

    // Utilities
    const getSlot = useCallback((slotId: string): LayoutSlot | null => {
        return slots.find(slot => slot.id === slotId) || null;
    }, [slots]);

    const canAddWidget = useCallback((slotId: string, widgetType: string): boolean => {
        const slot = getSlot(slotId);
        if (!slot) return false;
        
        // If no allowed widgets specified, allow all
        if (!slot.allowedWidgets || slot.allowedWidgets.length === 0) {
            return true;
        }
        
        return slot.allowedWidgets.includes(widgetType);
    }, [getSlot]);

    const [slotWidgets, setSlotWidgets] = useState<Record<string, any[]>>({});

    // Subscribe to slot widgets changes
    useExternalChanges(`layout-slot-widgets-${layoutId}`, state => {
        const widgetsBySlot = Object.values(state.widgets)
            .reduce((acc, widget) => {
                if (!acc[widget.slot]) acc[widget.slot] = [];
                acc[widget.slot].push(widget);
                return acc;
            }, {} as Record<string, any[]>);
        setSlotWidgets(widgetsBySlot);
    });

    const getSlotWidgets = useCallback((slotId: string) => {
        return slotWidgets[slotId] || [];
    }, [slotWidgets]);

    return useMemo(() => ({
        layout,
        slots,
        theme,
        updateLayout,
        updateTheme,
        addSlot,
        removeSlot,
        updateSlot,
        reorderSlots,
        duplicateLayout,
        deleteLayout,
        getSlot,
        canAddWidget,
        getSlotWidgets
    }), [
        layout,
        slots,
        theme,
        updateLayout,
        updateTheme,
        addSlot,
        removeSlot,
        updateSlot,
        reorderSlots,
        duplicateLayout,
        deleteLayout,
        getSlot,
        canAddWidget,
        getSlotWidgets
    ]);
}
