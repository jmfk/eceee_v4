import { useCallback } from 'react';
import { useUnifiedData } from '../context/UnifiedDataContext';
import { validateWidgetData } from '../utils/validation';
import { WidgetData, WidgetOperations } from '../types/widget-operations';

/**
 * Hook for managing widget operations in the v2 context
 * 
 * Features:
 * - Granular state updates
 * - Validation
 * - Error handling
 * - Real-time sync
 */
export function useWidgetOperations(widgetId?: string): WidgetOperations {
    const { get, dispatch } = useUnifiedData();

    // Get widget state
    const getWidgetState = useCallback(() => {
        if (!widgetId) return null;
        return get(`widgets.${widgetId}`) || null;
    }, [get, widgetId]);

    // Add widget
    const addWidget = useCallback(async (data: Partial<WidgetData>) => {
        try {
            // Validate widget before adding
            const isValid = await validateWidgetData(data);
            if (!isValid) {
                throw new Error('Invalid widget data');
            }

            // Add widget
            const result = await dispatch({
                type: 'ADD_WIDGET',
                payload: data
            });

            return result.widget;
        } catch (error) {
            console.error('Failed to add widget:', error);
            throw error;
        }
    }, [dispatch]);

    // Remove widget
    const removeWidget = useCallback(async (id: string) => {
        try {
            await dispatch({
                type: 'REMOVE_WIDGET',
                payload: {
                    id
                }
            });
        } catch (error) {
            console.error('Failed to remove widget:', error);
            throw error;
        }
    }, [dispatch]);

    // Move widget
    const moveWidget = useCallback(async (id: string, slotName: string, order: number) => {
        try {
            await dispatch({
                type: 'MOVE_WIDGET',
                payload: {
                    id,
                    slot: slotName,
                    order
                }
            });
        } catch (error) {
            console.error('Failed to move widget:', error);
            throw error;
        }
    }, [dispatch]);

    // Update widget config
    const updateWidgetConfig = useCallback(async (id: string, config: Record<string, any>) => {
        try {
            // Validate config before updating
            const isValid = await validateWidgetData({ id, config });
            if (!isValid) {
                throw new Error('Invalid widget configuration');
            }

            await dispatch({
                type: 'UPDATE_WIDGET_CONFIG',
                payload: {
                    id,
                    config
                }
            });
        } catch (error) {
            console.error('Failed to update widget config:', error);
            throw error;
        }
    }, [dispatch]);

    // Save widget
    const saveWidget = useCallback(async () => {
        if (!widgetId) return;

        try {
            // Validate widget before saving
            const widgetState = getWidgetState();
            if (!widgetState) {
                throw new Error('Widget not found');
            }

            const isValid = await validateWidgetData(widgetState);
            if (!isValid) {
                throw new Error('Invalid widget data');
            }

            // Save widget
            await dispatch({
                type: 'SAVE_WIDGET',
                payload: {
                    id: widgetId
                }
            });
        } catch (error) {
            console.error('Failed to save widget:', error);
            throw error;
        }
    }, [widgetId, dispatch, getWidgetState]);

    // Reset widget
    const resetWidget = useCallback(async () => {
        if (!widgetId) return;

        try {
            await dispatch({
                type: 'RESET_WIDGET',
                payload: {
                    id: widgetId
                }
            });
        } catch (error) {
            console.error('Failed to reset widget:', error);
            throw error;
        }
    }, [widgetId, dispatch]);

    // Validate widget
    const validateWidget = useCallback(async (data?: Partial<WidgetData>) => {
        try {
            if (data) {
                return await validateWidgetData(data);
            }

            if (!widgetId) return false;

            const widgetState = getWidgetState();
            if (!widgetState) {
                throw new Error('Widget not found');
            }

            return await validateWidgetData(widgetState);
        } catch (error) {
            console.error('Failed to validate widget:', error);
            return false;
        }
    }, [widgetId, getWidgetState]);

    return {
        // State
        getWidgetState,

        // Operations
        addWidget,
        removeWidget,
        moveWidget,
        updateWidgetConfig,
        saveWidget,
        resetWidget,
        validateWidget,

        // Derived state
        isDirty: Boolean(get(`widgets.${widgetId}.isDirty`)),
        hasUnsavedChanges: Boolean(get(`widgets.${widgetId}.hasUnsavedChanges`)),
        isLoading: Boolean(get(`widgets.${widgetId}.isLoading`)),
        errors: get(`widgets.${widgetId}.errors`) || []
    };
}
