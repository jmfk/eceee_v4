import { useCallback, useMemo } from 'react';
import { useUnifiedData } from '../context/UnifiedDataContext';
import { WidgetData, WidgetConfig } from '../types/state';
import { OperationTypes } from '../types/operations';

export interface UseWidgetOperationsResult {
    // Widget data
    widget: WidgetData | null;
    hasUnsavedChanges: boolean;
    hasErrors: boolean;
    
    // Operations
    updateConfig: (config: Partial<WidgetConfig>) => Promise<void>;
    moveWidget: (slotId: string, order: number) => Promise<void>;
    saveWidget: () => Promise<void>;
    deleteWidget: () => Promise<void>;
    
    // Utilities
    reset: () => Promise<void>;
    validate: () => Promise<boolean>;
}

export function useWidgetOperations(widgetId: string): UseWidgetOperationsResult {
    const { dispatch, useSelector } = useUnifiedData();

    // Selectors
    const widget = useSelector(state => state.widgets[widgetId] || null);
    const hasUnsavedChanges = useSelector(
        state => state.metadata.widgetStates.unsavedChanges[widgetId] || false
    );
    const hasErrors = useSelector(
        state => (state.metadata.widgetStates.errors[widgetId]?.length || 0) > 0
    );

    // Operations
    const updateConfig = useCallback(async (config: Partial<WidgetConfig>) => {
        await dispatch({
            type: OperationTypes.UPDATE_WIDGET_CONFIG,
            payload: {
                id: widgetId,
                config
            }
        });
    }, [dispatch, widgetId]);

    const moveWidget = useCallback(async (slotId: string, order: number) => {
        await dispatch({
            type: OperationTypes.MOVE_WIDGET,
            payload: {
                id: widgetId,
                slot: slotId,
                order
            }
        });
    }, [dispatch, widgetId]);

    const saveWidget = useCallback(async () => {
        await dispatch({
            type: OperationTypes.SAVE_WIDGET,
            payload: {
                id: widgetId
            }
        });
    }, [dispatch, widgetId]);

    const deleteWidget = useCallback(async () => {
        await dispatch({
            type: OperationTypes.REMOVE_WIDGET,
            payload: {
                id: widgetId
            }
        });
    }, [dispatch, widgetId]);

    const reset = useCallback(async () => {
        if (widget) {
            await dispatch({
                type: OperationTypes.UPDATE_WIDGET_CONFIG,
                payload: {
                    id: widgetId,
                    config: widget.config
                }
            });
        }
    }, [dispatch, widget, widgetId]);

    const validate = useCallback(async () => {
        const result = await dispatch({
            type: OperationTypes.VALIDATE_WIDGET,
            payload: {
                id: widgetId
            }
        });
        return !hasErrors;
    }, [dispatch, widgetId, hasErrors]);

    return useMemo(() => ({
        widget,
        hasUnsavedChanges,
        hasErrors,
        updateConfig,
        moveWidget,
        saveWidget,
        deleteWidget,
        reset,
        validate
    }), [
        widget,
        hasUnsavedChanges,
        hasErrors,
        updateConfig,
        moveWidget,
        saveWidget,
        deleteWidget,
        reset,
        validate
    ]);
}
