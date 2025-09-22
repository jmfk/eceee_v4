/**
 * Hook for managing object title operations
 * Provides write-only operations for title updates without causing re-renders
 */

import { useCallback } from 'react';
import { useUnifiedData } from '../context/UnifiedDataContext';
import { ObjectOperationTypes, UseObjectTitleOperations, ObjectOperationResult } from '../types/object-operations';

export function useObjectTitleOperations(objectId: string): UseObjectTitleOperations {
    const { dispatch, getState } = useUnifiedData();

    /**
     * Update object title
     */
    const updateTitle = useCallback(async (
        title: string,
        options?: { source?: 'user' | 'system' }
    ): Promise<ObjectOperationResult<string>> => {
        try {
            // Get current state for validation and previous value
            const currentState = getState();
            const currentObject = currentState.objects?.[objectId];
            
            if (!currentObject) {
                throw new Error('Object not found');
            }

            // Validate before updating
            const validation = await validateTitle(title);
            if (!validation.isValid) {
                return validation;
            }

            // Dispatch update operation
            await dispatch({
                type: ObjectOperationTypes.UPDATE_TITLE,
                payload: {
                    id: objectId,
                    title
                },
                metadata: {
                    source: options?.source || 'user',
                    previousTitle: currentObject.title,
                    validation: validation.validation
                }
            });

            return {
                success: true,
                data: title,
                validation: validation.validation
            };

        } catch (error) {
            return {
                success: false,
                error: error instanceof Error ? error.message : 'Failed to update title',
                validation: {
                    isValid: false,
                    errors: [{
                        field: 'title',
                        message: error instanceof Error ? error.message : 'Failed to update title',
                        code: 'UPDATE_FAILED'
                    }]
                }
            };
        }
    }, [objectId, dispatch, getState]);

    /**
     * Validate title
     */
    const validateTitle = useCallback(async (title: string): Promise<ObjectOperationResult<string>> => {
        // Basic validation rules
        if (!title || typeof title !== 'string') {
            return {
                success: false,
                validation: {
                    isValid: false,
                    errors: [{
                        field: 'title',
                        message: 'Title is required',
                        code: 'REQUIRED'
                    }]
                }
            };
        }

        if (title.trim().length === 0) {
            return {
                success: false,
                validation: {
                    isValid: false,
                    errors: [{
                        field: 'title',
                        message: 'Title cannot be empty',
                        code: 'EMPTY'
                    }]
                }
            };
        }

        if (title.length > 255) {
            return {
                success: false,
                validation: {
                    isValid: false,
                    errors: [{
                        field: 'title',
                        message: 'Title cannot be longer than 255 characters',
                        code: 'TOO_LONG'
                    }]
                }
            };
        }

        return {
            success: true,
            data: title,
            validation: {
                isValid: true
            }
        };
    }, []);

    /**
     * Get current title (non-reactive)
     */
    const getCurrentTitle = useCallback((): string => {
        const currentState = getState();
        return currentState.objects?.[objectId]?.title || '';
    }, [objectId, getState]);

    return {
        updateTitle,
        validateTitle,
        getCurrentTitle
    };
}

export default useObjectTitleOperations;
