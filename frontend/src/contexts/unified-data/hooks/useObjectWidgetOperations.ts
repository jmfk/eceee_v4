/**
 * Hook for managing object widget operations
 * Provides write-only operations for widget slot updates without causing re-renders
 */

import { useCallback } from 'react';
import { useUnifiedData } from '../context/UnifiedDataContext';
import { ObjectOperationTypes, UseObjectWidgetOperations, ObjectOperationResult } from '../types/object-operations';
import { WidgetData } from '../types/state';

export function useObjectWidgetOperations(objectId: string): UseObjectWidgetOperations {
    const { dispatch, getState } = useUnifiedData();

    /**
     * Update widget slot
     */
    const updateWidgetSlot = useCallback(async (
        slotName: string,
        widgets: WidgetData[],
        options?: { 
            source?: 'user' | 'system';
            validateWidgets?: boolean; // Skip widget validation if false
        }
    ): Promise<ObjectOperationResult> => {
        try {
            // Get current state for validation and previous value
            const currentState = getState();
            const currentObject = currentState.objects?.[objectId];
            
            if (!currentObject) {
                throw new Error('Object not found');
            }

            // Get current widgets for comparison
            const currentWidgets = currentObject.widgets?.[slotName] || [];

            // Skip update if widgets haven't changed
            if (JSON.stringify(currentWidgets) === JSON.stringify(widgets)) {
                return {
                    success: true,
                    data: widgets,
                    validation: { isValid: true }
                };
            }

            // Get slot configuration from object type
            const slotConfig = currentObject.objectType?.slotConfiguration?.slots?.find(
                slot => slot.name === slotName
            );

            // Validate before updating (unless explicitly skipped)
            if (options?.validateWidgets !== false) {
                const validation = await validateWidgetSlot(slotName, widgets, slotConfig);
                if (!validation.isValid) {
                    return validation;
                }
            }

            // Dispatch update operation
            await dispatch({
                type: ObjectOperationTypes.UPDATE_SLOT,
                payload: {
                    id: objectId,
                    slotName,
                    widgets
                },
                metadata: {
                    source: options?.source || 'user',
                    previousWidgets: currentWidgets,
                    validation: {
                        isValid: true
                    }
                }
            });

            return {
                success: true,
                data: widgets,
                validation: { isValid: true }
            };

        } catch (error) {
            return {
                success: false,
                error: error instanceof Error ? error.message : 'Failed to update widget slot',
                validation: {
                    isValid: false,
                    errors: [{
                        field: slotName,
                        message: error instanceof Error ? error.message : 'Failed to update widget slot',
                        code: 'UPDATE_FAILED'
                    }]
                }
            };
        }
    }, [objectId, dispatch, getState]);

    /**
     * Validate widget slot
     */
    const validateWidgetSlot = useCallback(async (
        slotName: string,
        widgets: WidgetData[],
        slotConfig?: any
    ): Promise<ObjectOperationResult> => {
        try {
            const errors: Array<{ field: string; message: string; code: string }> = [];

            // Get current state for slot config if not provided
            if (!slotConfig) {
                const currentState = getState();
                const currentObject = currentState.objects?.[objectId];
                slotConfig = currentObject?.objectType?.slotConfiguration?.slots?.find(
                    slot => slot.name === slotName
                );
            }

            // Basic validations
            if (!Array.isArray(widgets)) {
                return {
                    success: false,
                    validation: {
                        isValid: false,
                        errors: [{
                            field: slotName,
                            message: 'Widgets must be an array',
                            code: 'INVALID_TYPE'
                        }]
                    }
                };
            }

            // Validate each widget
            for (let i = 0; i < widgets.length; i++) {
                const widget = widgets[i];

                // Required fields
                if (!widget.id) {
                    errors.push({
                        field: `${slotName}[${i}].id`,
                        message: 'Widget ID is required',
                        code: 'REQUIRED'
                    });
                }

                if (!widget.type) {
                    errors.push({
                        field: `${slotName}[${i}].type`,
                        message: 'Widget type is required',
                        code: 'REQUIRED'
                    });
                }

                // Slot configuration validations
                if (slotConfig) {
                    // Allowed widget types
                    if (slotConfig.allowedWidgets && !slotConfig.allowedWidgets.includes(widget.type)) {
                        errors.push({
                            field: `${slotName}[${i}].type`,
                            message: `Widget type ${widget.type} is not allowed in slot ${slotName}`,
                            code: 'INVALID_WIDGET_TYPE'
                        });
                    }

                    // Max widgets per slot
                    if (slotConfig.maxWidgets && widgets.length > slotConfig.maxWidgets) {
                        errors.push({
                            field: slotName,
                            message: `Slot ${slotName} cannot have more than ${slotConfig.maxWidgets} widgets`,
                            code: 'MAX_WIDGETS'
                        });
                        break; // No need to check more widgets
                    }
                }

                // Widget config validation
                if (!widget.config || typeof widget.config !== 'object') {
                    errors.push({
                        field: `${slotName}[${i}].config`,
                        message: 'Widget config must be an object',
                        code: 'INVALID_CONFIG'
                    });
                }

                // Order validation
                if (typeof widget.order !== 'number') {
                    errors.push({
                        field: `${slotName}[${i}].order`,
                        message: 'Widget order must be a number',
                        code: 'INVALID_ORDER'
                    });
                }
            }

            return {
                success: errors.length === 0,
                data: widgets,
                validation: {
                    isValid: errors.length === 0,
                    errors: errors.length > 0 ? errors : undefined
                }
            };

        } catch (error) {
            return {
                success: false,
                error: error instanceof Error ? error.message : 'Validation failed',
                validation: {
                    isValid: false,
                    errors: [{
                        field: slotName,
                        message: error instanceof Error ? error.message : 'Validation failed',
                        code: 'VALIDATION_ERROR'
                    }]
                }
            };
        }
    }, [objectId, getState]);

    /**
     * Get current slot widgets (non-reactive)
     */
    const getCurrentSlotWidgets = useCallback((slotName: string): WidgetData[] => {
        const currentState = getState();
        return currentState.objects?.[objectId]?.widgets?.[slotName] || [];
    }, [objectId, getState]);

    return {
        updateWidgetSlot,
        validateWidgetSlot,
        getCurrentSlotWidgets
    };
}

export default useObjectWidgetOperations;
