import { useCallback } from 'react';
import { useUnifiedData } from '../context/UnifiedDataContext';
import { validateLayoutData } from '../utils/validation';
import { LayoutData, LayoutOperations } from '../types/layout-operations';

/**
 * Hook for managing layout operations in the v2 context
 * 
 * Features:
 * - Granular state updates
 * - Validation
 * - Error handling
 * - Real-time sync
 */
export function useLayoutOperations(): LayoutOperations {
    const { get, dispatch } = useUnifiedData();

    // Get layout state
    const getLayoutState = useCallback(() => {
        return get('layout') || null;
    }, [get]);

    // Update layout
    const updateLayout = useCallback(async (layoutName: string) => {
        try {
            // Validate layout before updating
            const isValid = await validateLayoutData({ name: layoutName });
            if (!isValid) {
                throw new Error('Invalid layout data');
            }

            // Update layout
            await dispatch({
                type: 'UPDATE_LAYOUT',
                payload: {
                    name: layoutName
                }
            });
        } catch (error) {
            console.error('Failed to update layout:', error);
            throw error;
        }
    }, [dispatch]);

    // Update layout config
    const updateLayoutConfig = useCallback(async (config: Record<string, any>) => {
        try {
            // Validate config before updating
            const isValid = await validateLayoutData({ config });
            if (!isValid) {
                throw new Error('Invalid layout configuration');
            }

            // Update layout config
            await dispatch({
                type: 'UPDATE_LAYOUT_CONFIG',
                payload: {
                    config
                }
            });
        } catch (error) {
            console.error('Failed to update layout config:', error);
            throw error;
        }
    }, [dispatch]);

    // Save layout
    const saveLayout = useCallback(async () => {
        try {
            // Validate layout before saving
            const layoutState = getLayoutState();
            if (!layoutState) {
                throw new Error('Layout not found');
            }

            const isValid = await validateLayoutData(layoutState);
            if (!isValid) {
                throw new Error('Invalid layout data');
            }

            // Save layout
            await dispatch({
                type: 'SAVE_LAYOUT',
                payload: {}
            });
        } catch (error) {
            console.error('Failed to save layout:', error);
            throw error;
        }
    }, [dispatch, getLayoutState]);

    // Reset layout
    const resetLayout = useCallback(async () => {
        try {
            await dispatch({
                type: 'RESET_LAYOUT',
                payload: {}
            });
        } catch (error) {
            console.error('Failed to reset layout:', error);
            throw error;
        }
    }, [dispatch]);

    // Validate layout
    const validateLayout = useCallback(async (layoutName?: string) => {
        try {
            if (layoutName) {
                return await validateLayoutData({ name: layoutName });
            }

            const layoutState = getLayoutState();
            if (!layoutState) {
                throw new Error('Layout not found');
            }

            return await validateLayoutData(layoutState);
        } catch (error) {
            console.error('Failed to validate layout:', error);
            return false;
        }
    }, [getLayoutState]);

    return {
        // State
        getLayoutState,

        // Operations
        updateLayout,
        updateLayoutConfig,
        saveLayout,
        resetLayout,
        validateLayout,

        // Derived state
        isDirty: Boolean(get('layout')?.isDirty),
        hasUnsavedChanges: Boolean(get('layout')?.hasUnsavedChanges),
        isLoading: Boolean(get('layout')?.isLoading),
        errors: get('layout')?.errors || []
    };
}
