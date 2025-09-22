import { useCallback, useMemo, useState } from 'react';
import { useUnifiedData } from '../context/UnifiedDataContext';
import { WidgetData } from '../types/state';
import { OperationTypes } from '../types/operations';

export interface UsePageWidgetsResult {
    // Widget data
    widgets: WidgetData[];
    widgetsBySlot: Record<string, WidgetData[]>;
    widgetCount: number;
    isDirty: boolean;
    
    // Operations
    addWidget: (slotId: string, widgetType: string, config?: any) => Promise<string>;
    removeWidget: (widgetId: string) => Promise<void>;
    moveWidget: (widgetId: string, targetSlotId: string, order: number) => Promise<void>;
    reorderWidgets: (slotId: string, widgetIds: string[]) => Promise<void>;
    duplicateWidget: (widgetId: string, targetSlotId?: string) => Promise<string>;
    bulkUpdateWidgets: (updates: Record<string, Partial<WidgetData>>) => Promise<void>;
    
    // Utilities
    getWidget: (widgetId: string) => WidgetData | null;
    getSlotWidgets: (slotId: string) => WidgetData[];
    getWidgetsByType: (widgetType: string) => WidgetData[];
    canMoveWidget: (widgetId: string, targetSlotId: string) => boolean;
    getNextOrder: (slotId: string) => number;
}

export function usePageWidgets(pageId: string): UsePageWidgetsResult {
    const { dispatch, useExternalChanges } = useUnifiedData();

    // State
    const [widgets, setWidgets] = useState<WidgetData[]>([]);
    const [widgetsBySlot, setWidgetsBySlot] = useState<Record<string, WidgetData[]>>({});
    const [isDirty, setIsDirty] = useState(false);

    // Subscribe to external changes
    useExternalChanges(`page-widgets-${pageId}`, state => {
        const pageWidgets = Object.values(state.widgets).filter(widget => widget.pageId === pageId);
        setWidgets(pageWidgets);
        
        const bySlot = pageWidgets.reduce((acc, widget) => {
            if (!acc[widget.slot]) {
                acc[widget.slot] = [];
            }
            acc[widget.slot].push(widget);
            return acc;
        }, {} as Record<string, WidgetData[]>);
        setWidgetsBySlot(bySlot);
        
        setIsDirty(state.metadata.isDirty);
    });

    const widgetCount = widgets.length;

    // Operations
    const addWidget = useCallback(async (
        slotId: string, 
        widgetType: string, 
        config: any = {}
    ): Promise<string> => {
        const result = await dispatch({
            type: OperationTypes.ADD_WIDGET,
            sourceId: pageId,
            payload: {
                pageId,
                slotId,
                widgetType,
                config
            }
        });
        return result.widgetId;
    }, [dispatch, pageId]);

    const removeWidget = useCallback(async (widgetId: string) => {
        await dispatch({
            type: OperationTypes.REMOVE_WIDGET,
            sourceId: pageId,
            payload: {
                id: widgetId
            }
        });
    }, [dispatch]);

    const moveWidget = useCallback(async (
        widgetId: string, 
        targetSlotId: string, 
        order: number
    ) => {
        await dispatch({
            type: OperationTypes.MOVE_WIDGET,
            sourceId: targetSlotId,
            payload: {
                id: widgetId,
                slot: targetSlotId,
                order
            }
        });
    }, [dispatch]);

    const reorderWidgets = useCallback(async (slotId: string, widgetIds: string[]) => {
        await dispatch({
            type: OperationTypes.REORDER_WIDGETS,
            sourceId: slotId,
            payload: {
                slotId,
                widgetIds
            }
        });
    }, [dispatch]);

    const duplicateWidget = useCallback(async (
        widgetId: string, 
        targetSlotId?: string
    ): Promise<string> => {
        const widget = getWidget(widgetId);
        if (!widget) throw new Error(`Widget ${widgetId} not found`);

        const result = await dispatch({
            type: OperationTypes.DUPLICATE_WIDGET,
            sourceId: targetSlotId || widget.slot,
            payload: {
                id: widgetId,
                targetSlotId: targetSlotId || widget.slot
            }
        });
        return result.newWidgetId;
    }, [dispatch]);

    // Utilities
    const getWidget = useCallback((widgetId: string): WidgetData | null => {
        return widgets.find(w => w.id === widgetId) || null;
    }, [widgets]);

    const getSlotWidgets = useCallback((slotId: string): WidgetData[] => {
        return widgetsBySlot[slotId] || [];
    }, [widgetsBySlot]);

    const getWidgetsByType = useCallback((widgetType: string): WidgetData[] => {
        return widgets.filter(w => w.type === widgetType);
    }, [widgets]);

    const canMoveWidget = useCallback((widgetId: string, targetSlotId: string): boolean => {
        const widget = getWidget(widgetId);
        if (!widget) return false;

        // Add your business logic here
        // For example, check if the target slot allows this widget type
        return true;
    }, [getWidget]);

    const getNextOrder = useCallback((slotId: string): number => {
        const slotWidgets = getSlotWidgets(slotId);
        if (slotWidgets.length === 0) return 0;
        return Math.max(...slotWidgets.map(w => w.order)) + 1;
    }, [getSlotWidgets]);

    return useMemo(() => ({
        widgets,
        widgetsBySlot,
        widgetCount,
        isDirty,
        addWidget,
        removeWidget,
        moveWidget,
        reorderWidgets,
        duplicateWidget,
        bulkUpdateWidgets,
        getWidget,
        getSlotWidgets,
        getWidgetsByType,
        canMoveWidget,
        getNextOrder
    }), [
        widgets,
        widgetsBySlot,
        widgetCount,
        isDirty,
        addWidget,
        removeWidget,
        moveWidget,
        reorderWidgets,
        duplicateWidget,
        bulkUpdateWidgets,
        getWidget,
        getSlotWidgets,
        getWidgetsByType,
        canMoveWidget,
        getNextOrder
    ]);
}
