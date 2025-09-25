import { useCallback, useMemo, useState } from 'react';
import { useUnifiedData } from '../context/UnifiedDataContext';
import { WidgetData, WidgetConfig, AppState } from '../types/state';
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

    const findWidgetById = (state: AppState, id: string): WidgetData | null => {
        const { currentVersionId, currentObjectId } = state.metadata as any;
        if (currentVersionId) {
            const version = state.versions[currentVersionId];
            if (version?.widgets) {
                for (const slotName of Object.keys(version.widgets)) {
                    const found = (version.widgets[slotName] || []).find(w => w.id === id);
                    if (found) return found;
                }
            }
        }
        if (currentObjectId && (state as any).objects) {
            const objValue = (state as any).objects[currentObjectId];
            const widgets = (objValue?.widgets || {}) as Record<string, any[]>;
            for (const slotName of Object.keys(widgets)) {
                const found = (widgets[slotName] || []).find((w: any) => w.id === id);
                if (found) return found as WidgetData;
            }
        }
        return null;
    };

    // Initialize widget from current context
    const initialWidget = findWidgetById(getState(), widgetId);

    // State
    const [widget, setWidget] = useState<WidgetData | null>(initialWidget);
    const [isDirty, setIsDirty] = useState(getState().metadata.isDirty ?? false);
    const [hasErrors, setHasErrors] = useState(Boolean(getState().metadata.widgetStates.errors[widgetId]));

    // Subscribe to external changes
    useExternalChanges(widgetId, state => {
        const w = findWidgetById(state as AppState, widgetId);
        if (w) setWidget(w);
        setIsDirty(state.metadata.isDirty ?? false);
        setHasErrors(Boolean(state.metadata.widgetStates.errors[widgetId]));
    });

    // Operations
    const updateConfig = useCallback(async (config: Partial<WidgetConfig>) => {
        // First ensure the widget exists in state
        if (!widget) {
            await dispatch({
                type: OperationTypes.INIT_WIDGET,
                sourceId: widgetId,            
                payload: {
                    id: widgetId,
                    config: config
                }
            });
        } else {
            // Determine context for payload
            const state = getState();
            const { currentPageId, currentVersionId, currentObjectId } = (state as any).metadata || {};
            const contextFields = currentPageId && currentVersionId
                ? { contextType: 'page' as const, pageId: String(currentPageId) }
                : { contextType: 'object' as const, objectId: String(currentObjectId) };

            await dispatch({
                type: OperationTypes.UPDATE_WIDGET_CONFIG,
                sourceId: widgetId,            
                payload: {
                    id: widgetId,
                    ...contextFields,
                    config
                }
            });
        }
    }, [dispatch, widgetId, widget]);

    const moveWidget = useCallback(async (slotId: string, order: number) => {
        const state = getState();
        const { currentPageId, currentVersionId, currentObjectId } = (state as any).metadata || {};
        const contextFields = currentPageId && currentVersionId
            ? { contextType: 'page' as const, pageId: String(currentPageId) }
            : { contextType: 'object' as const, objectId: String(currentObjectId) };

        await dispatch({
            type: OperationTypes.MOVE_WIDGET,
            sourceId: slotId,
            payload: {
                id: widgetId,
                slot: slotId,
                ...contextFields,
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
