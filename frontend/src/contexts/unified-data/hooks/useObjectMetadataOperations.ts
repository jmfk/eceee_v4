/**
 * Hook for managing object metadata operations
 * Provides write-only operations for object-specific metadata updates without causing re-renders
 * 
 * NOTE: This hook only handles object-specific metadata (custom fields, tags, etc.)
 * App state metadata (isDirty, hasErrors, etc.) is managed directly by UnifiedDataContext
 */

import { useCallback } from 'react';
import { useUnifiedData } from '../context/UnifiedDataContext';
import { ObjectOperationTypes, UseObjectMetadataOperations, ObjectOperationResult } from '../types/object-operations';

// Reserved metadata keys that are managed by UnifiedDataContext
const RESERVED_METADATA_KEYS = [
    'isDirty',
    'hasErrors',
    'isValid',
    'isSaving',
    'isLoading',
    'lastSaved',
    'lastError',
    'validationErrors'
];

export function useObjectMetadataOperations(objectId: string): UseObjectMetadataOperations {
    const { dispatch, getState } = useUnifiedData();

    /**
     * Update object metadata
     * Only updates object-specific metadata, not app state metadata
     */
    const updateMetadata = useCallback(async (
        metadata: Record<string, any>,
        options?: { source?: 'user' | 'system' }
    ): Promise<ObjectOperationResult> => {
        try {
            // Get current state for validation and previous value
            const currentState = getState();
            const currentObject = currentState.objects?.[objectId];
            
            if (!currentObject) {
                throw new Error('Object not found');
            }

            // Filter out reserved metadata keys
            const filteredMetadata = Object.entries(metadata).reduce((acc, [key, value]) => {
                if (!RESERVED_METADATA_KEYS.includes(key)) {
                    acc[key] = value;
                }
                return acc;
            }, {} as Record<string, any>);

            // Skip update if no valid metadata changes
            if (Object.keys(filteredMetadata).length === 0) {
                return {
                    success: true,
                    data: currentObject.metadata,
                    validation: { isValid: true }
                };
            }

            // Validate before updating
            const validation = await validateMetadata(filteredMetadata);
            if (!validation.isValid) {
                return validation;
            }

            // Merge with existing metadata
            const mergedMetadata = {
                ...currentObject.metadata,
                ...filteredMetadata
            };

            // Dispatch update operation
            await dispatch({
                type: ObjectOperationTypes.UPDATE_METADATA,
                payload: {
                    id: objectId,
                    metadata: mergedMetadata
                },
                metadata: {
                    source: options?.source || 'user',
                    previousMetadata: currentObject.metadata,
                    validation: validation.validation
                }
            });

            return {
                success: true,
                data: mergedMetadata,
                validation: validation.validation
            };

        } catch (error) {
            return {
                success: false,
                error: error instanceof Error ? error.message : 'Failed to update metadata',
                validation: {
                    isValid: false,
                    errors: [{
                        field: 'metadata',
                        message: error instanceof Error ? error.message : 'Failed to update metadata',
                        code: 'UPDATE_FAILED'
                    }]
                }
            };
        }
    }, [objectId, dispatch, getState]);

    /**
     * Validate metadata
     * Ensures metadata follows object-specific rules
     */
    const validateMetadata = useCallback(async (
        metadata: Record<string, any>
    ): Promise<ObjectOperationResult> => {
        try {
            const errors: Array<{ field: string; message: string; code: string }> = [];

            // Basic type validation
            if (!metadata || typeof metadata !== 'object' || Array.isArray(metadata)) {
                return {
                    success: false,
                    validation: {
                        isValid: false,
                        errors: [{
                            field: 'metadata',
                            message: 'Metadata must be an object',
                            code: 'INVALID_TYPE'
                        }]
                    }
                };
            }

            // Check for reserved keys
            const reservedKeys = Object.keys(metadata).filter(key => 
                RESERVED_METADATA_KEYS.includes(key)
            );

            if (reservedKeys.length > 0) {
                errors.push({
                    field: 'metadata',
                    message: `Cannot update reserved metadata keys: ${reservedKeys.join(', ')}`,
                    code: 'RESERVED_KEYS'
                });
            }

            // Validate each metadata value
            Object.entries(metadata).forEach(([key, value]) => {
                // Skip reserved keys
                if (RESERVED_METADATA_KEYS.includes(key)) return;

                // Key validation
                if (!/^[a-zA-Z][a-zA-Z0-9_]*$/.test(key)) {
                    errors.push({
                        field: `metadata.${key}`,
                        message: 'Metadata keys must start with a letter and contain only letters, numbers, and underscores',
                        code: 'INVALID_KEY'
                    });
                }

                // Value validation
                if (value === undefined) {
                    errors.push({
                        field: `metadata.${key}`,
                        message: 'Metadata values cannot be undefined',
                        code: 'INVALID_VALUE'
                    });
                }

                // Nested object validation (only allow one level deep)
                if (typeof value === 'object' && value !== null) {
                    const nestedKeys = Object.keys(value).filter(k => 
                        typeof value[k] === 'object' && value[k] !== null && !Array.isArray(value[k])
                    );

                    if (nestedKeys.length > 0) {
                        errors.push({
                            field: `metadata.${key}`,
                            message: 'Metadata objects can only be one level deep',
                            code: 'NESTED_OBJECT'
                        });
                    }
                }
            });

            return {
                success: errors.length === 0,
                data: metadata,
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
                        field: 'metadata',
                        message: error instanceof Error ? error.message : 'Validation failed',
                        code: 'VALIDATION_ERROR'
                    }]
                }
            };
        }
    }, []);

    /**
     * Get current metadata (non-reactive)
     * Only returns object-specific metadata, not app state metadata
     */
    const getCurrentMetadata = useCallback((): Record<string, any> => {
        const currentState = getState();
        const metadata = currentState.objects?.[objectId]?.metadata || {};

        // Filter out reserved keys
        return Object.entries(metadata).reduce((acc, [key, value]) => {
            if (!RESERVED_METADATA_KEYS.includes(key)) {
                acc[key] = value;
            }
            return acc;
        }, {} as Record<string, any>);
    }, [objectId, getState]);

    return {
        updateMetadata,
        validateMetadata,
        getCurrentMetadata
    };
}

export default useObjectMetadataOperations;
