/**
 * Hook for managing object status operations
 * Provides write-only operations for status transitions without causing re-renders
 */

import { useCallback } from 'react';
import { useUnifiedData } from '../context/UnifiedDataContext';
import { ObjectOperationTypes, UseObjectStatusOperations, ObjectOperationResult } from '../types/object-operations';

// Valid status transitions map
const VALID_TRANSITIONS: Record<string, ('draft' | 'published' | 'scheduled')[]> = {
    'draft': ['published', 'scheduled'],
    'published': ['draft'],
    'scheduled': ['draft', 'published']
};

// Status requirements
const STATUS_REQUIREMENTS = {
    'scheduled': {
        requiredFields: ['scheduledDate'],
        validate: (data: any) => {
            if (!data.scheduledDate) return false;
            const scheduledDate = new Date(data.scheduledDate);
            return scheduledDate > new Date();
        }
    },
    'published': {
        requiredFields: ['title'],
        validate: (data: any) => {
            return !!data.title?.trim();
        }
    }
};

export function useObjectStatusOperations(objectId: string): UseObjectStatusOperations {
    const { dispatch, getState } = useUnifiedData();

    /**
     * Update object status
     */
    const updateStatus = useCallback(async (
        status: 'draft' | 'published' | 'scheduled',
        options?: { 
            source?: 'user' | 'system';
            skipValidation?: boolean;
        }
    ): Promise<ObjectOperationResult> => {
        try {
            // Get current state for validation and previous value
            const currentState = getState();
            const currentObject = currentState.objects?.[objectId];
            
            if (!currentObject) {
                throw new Error('Object not found');
            }

            // Skip if status hasn't changed
            if (currentObject.status === status) {
                return {
                    success: true,
                    data: status,
                    validation: { isValid: true }
                };
            }

            // Validate status transition unless explicitly skipped
            if (!options?.skipValidation) {
                const validation = await validateStatusTransition(status);
                if (!validation.isValid) {
                    return validation;
                }
            }

            // Dispatch update operation
            await dispatch({
                type: ObjectOperationTypes.UPDATE_STATUS,
                payload: {
                    id: objectId,
                    status
                },
                metadata: {
                    source: options?.source || 'user',
                    previousStatus: currentObject.status,
                    transitionRules: {
                        allowedTransitions: VALID_TRANSITIONS[currentObject.status] || [],
                        requiresApproval: status === 'published',
                        requiresSchedule: status === 'scheduled'
                    }
                }
            });

            return {
                success: true,
                data: status,
                validation: { isValid: true }
            };

        } catch (error) {
            return {
                success: false,
                error: error instanceof Error ? error.message : 'Failed to update status',
                validation: {
                    isValid: false,
                    errors: [{
                        field: 'status',
                        message: error instanceof Error ? error.message : 'Failed to update status',
                        code: 'UPDATE_FAILED'
                    }]
                }
            };
        }
    }, [objectId, dispatch, getState]);

    /**
     * Validate status transition
     */
    const validateStatusTransition = useCallback(async (
        newStatus: 'draft' | 'published' | 'scheduled'
    ): Promise<ObjectOperationResult> => {
        try {
            const currentState = getState();
            const currentObject = currentState.objects?.[objectId];

            if (!currentObject) {
                throw new Error('Object not found');
            }

            const errors: Array<{ field: string; message: string; code: string }> = [];

            // Check if transition is allowed
            const allowedTransitions = VALID_TRANSITIONS[currentObject.status] || [];
            if (!allowedTransitions.includes(newStatus)) {
                errors.push({
                    field: 'status',
                    message: `Cannot transition from ${currentObject.status} to ${newStatus}`,
                    code: 'INVALID_TRANSITION'
                });
            }

            // Check status-specific requirements
            const requirements = STATUS_REQUIREMENTS[newStatus];
            if (requirements) {
                // Check required fields
                requirements.requiredFields?.forEach(field => {
                    if (!currentObject.data?.[field]) {
                        errors.push({
                            field,
                            message: `${field} is required for ${newStatus} status`,
                            code: 'REQUIRED_FIELD'
                        });
                    }
                });

                // Run status-specific validation
                if (requirements.validate && !requirements.validate(currentObject.data)) {
                    errors.push({
                        field: 'status',
                        message: `Object does not meet requirements for ${newStatus} status`,
                        code: 'VALIDATION_FAILED'
                    });
                }
            }

            return {
                success: errors.length === 0,
                data: newStatus,
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
                        field: 'status',
                        message: error instanceof Error ? error.message : 'Validation failed',
                        code: 'VALIDATION_ERROR'
                    }]
                }
            };
        }
    }, [objectId, getState]);

    /**
     * Get current status (non-reactive)
     */
    const getCurrentStatus = useCallback((): 'draft' | 'published' | 'scheduled' => {
        const currentState = getState();
        return currentState.objects?.[objectId]?.status || 'draft';
    }, [objectId, getState]);

    /**
     * Get allowed status transitions (non-reactive)
     */
    const getAllowedTransitions = useCallback((): ('draft' | 'published' | 'scheduled')[] => {
        const currentStatus = getCurrentStatus();
        return VALID_TRANSITIONS[currentStatus] || [];
    }, [getCurrentStatus]);

    return {
        updateStatus,
        validateStatusTransition,
        getCurrentStatus,
        getAllowedTransitions
    };
}

export default useObjectStatusOperations;
