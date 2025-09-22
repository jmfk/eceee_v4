import { useCallback, useMemo, useState } from 'react';
import { useUnifiedData } from '../context/UnifiedDataContext';
import { WidgetData, WidgetConfig } from '../types/state';
import { OperationTypes, DispatchOptions } from '../types/operations';

export interface UseWidgetOperationsResult {
    // Widget data
    widget: WidgetData | null;
    isDirty: boolean;
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
    const { dispatch, useExternalChanges, getState } = useUnifiedData();
    
    // Initialize widget from current state
    const initialWidget = getState().widgets[widgetId] || null;

    // State
    const [widget, setWidget] = useState<WidgetData | null>(initialWidget);
    const [isDirty, setIsDirty] = useState(getState().metadata.isDirty ?? false);
    const [hasErrors, setHasErrors] = useState(Boolean(getState().metadata.widgetStates.errors[widgetId]));

    // Subscribe to external changes
    useExternalChanges(widgetId, state => {
        const widget: WidgetData = state.widgets[widgetId];
        if (widget) {
            setWidget(widget);            
            setIsDirty(state.metadata.isDirty ?? false);
            setHasErrors(Boolean(state.metadata.widgetStates.errors[widgetId]));
        }
    });

    // Operations
    const updateConfig = useCallback(async (config: Partial<WidgetConfig>) => {
        // First ensure the widget exists in state
        if (!widget) {
            await dispatch({
                type: OperationTypes.ADD_WIDGET,
                sourceId: widgetId,            
                payload: {
                    id: widgetId,
                    config: config
                }
            });
        } else {
            await dispatch({
                type: OperationTypes.UPDATE_WIDGET_CONFIG,
                sourceId: widgetId,            
                payload: {
                    id: widgetId,
                    config
                }
            });
        }
    }, [dispatch, widgetId, widget]);

    const moveWidget = useCallback(async (slotId: string, order: number) => {
        await dispatch({
            type: OperationTypes.MOVE_WIDGET,
            sourceId: slotId,
            payload: {
                id: widgetId,
                slot: slotId,
                order
            }
        });
    }, [dispatch, widgetId]);

    const saveWidget = useCallback(async () => {
        await dispatch({
            type: OperationTypes.MARK_WIDGET_SAVED,
            sourceId: widgetId,
            payload: {
                id: widgetId
            }
        });
    }, [dispatch, widgetId]);

    const deleteWidget = useCallback(async () => {
        await dispatch({
            type: OperationTypes.REMOVE_WIDGET,
            sourceId: widgetId,
            payload: {
                id: widgetId
            }
        });
    }, [dispatch, widgetId]);

    const reset = useCallback(async () => {
        if (widget) {
            await dispatch({
                type: OperationTypes.UPDATE_WIDGET_CONFIG,
                sourceId: widgetId,
                payload: {
                    id: widgetId,
                    config: widget.config
                }
            });
        }
    }, [dispatch, widget, widgetId]);

    const validate = useCallback(async () => {
        const result = await dispatch({
            type: OperationTypes.UPDATE_WIDGET,
            sourceId: widgetId,
            payload: {
                id: widgetId
            }
        });
        return !hasErrors;
    }, [dispatch, widgetId, hasErrors]);

    return useMemo(() => ({
        widget,
        isDirty,
        hasErrors,
        updateConfig,
        moveWidget,
        saveWidget,
        deleteWidget,
        reset,
        validate
    }), [
        widget,
        isDirty,
        hasErrors,
        updateConfig,
        moveWidget,
        saveWidget,
        deleteWidget,
        reset,
        validate
    ]);
}
