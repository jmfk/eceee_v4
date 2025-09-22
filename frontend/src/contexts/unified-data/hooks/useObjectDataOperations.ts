/**
 * Hook for managing object data field operations
 * Provides write-only operations for schema data updates without causing re-renders
 */

import { useCallback } from 'react';
import { useUnifiedData } from '../context/UnifiedDataContext';
import { ObjectOperationTypes, UseObjectDataOperations, ObjectOperationResult } from '../types/object-operations';

export function useObjectDataOperations(objectId: string): UseObjectDataOperations {
    const { dispatch, getState } = useUnifiedData();

    /**
     * Update object data field
     */
    const updateField = useCallback(async (
        fieldName: string,
        value: any,
        options?: { 
            source?: 'user' | 'system';
            schema?: any; // Optional schema for validation
        }
    ): Promise<ObjectOperationResult> => {
        try {
            // Get current state for validation and previous value
            const currentState = getState();
            const currentObject = currentState.objects?.[objectId];
            
            if (!currentObject) {
                throw new Error('Object not found');
            }

            // Get current field value for comparison
            const currentValue = currentObject.data?.[fieldName];

            // Skip update if value hasn't changed
            if (currentValue === value) {
                return {
                    success: true,
                    data: value,
                    validation: { isValid: true }
                };
            }

            // Get schema from object type or options
            const schema = options?.schema || currentObject.objectType?.schema;

            // Validate before updating
            const validation = await validateField(fieldName, value, schema);
            if (!validation.isValid) {
                return validation;
            }

            // Dispatch update operation
            await dispatch({
                type: ObjectOperationTypes.UPDATE_FIELD,
                payload: {
                    id: objectId,
                    fieldName,
                    value,
                    schema
                },
                metadata: {
                    source: options?.source || 'user',
                    previousValue: currentValue,
                    validation: validation.validation
                }
            });

            return {
                success: true,
                data: value,
                validation: validation.validation
            };

        } catch (error) {
            return {
                success: false,
                error: error instanceof Error ? error.message : 'Failed to update field',
                validation: {
                    isValid: false,
                    errors: [{
                        field: fieldName,
                        message: error instanceof Error ? error.message : 'Failed to update field',
                        code: 'UPDATE_FAILED'
                    }]
                }
            };
        }
    }, [objectId, dispatch, getState]);

    /**
     * Validate field value against schema
     */
    const validateField = useCallback(async (
        fieldName: string,
        value: any,
        schema?: any
    ): Promise<ObjectOperationResult> => {
        try {
            // Get current state for schema if not provided
            if (!schema) {
                const currentState = getState();
                const currentObject = currentState.objects?.[objectId];
                schema = currentObject?.objectType?.schema;
            }

            // Skip validation if no schema
            if (!schema?.properties?.[fieldName]) {
                return {
                    success: true,
                    data: value,
                    validation: { isValid: true }
                };
            }

            const fieldSchema = schema.properties[fieldName];
            const errors: Array<{ field: string; message: string; code: string }> = [];

            // Required field validation
            if (schema.required?.includes(fieldName)) {
                if (value === undefined || value === null || value === '') {
                    errors.push({
                        field: fieldName,
                        message: `${fieldName} is required`,
                        code: 'REQUIRED'
                    });
                }
            }

            // Type validation
            if (fieldSchema.type && value !== undefined && value !== null) {
                const valueType = Array.isArray(value) ? 'array' : typeof value;
                if (valueType !== fieldSchema.type) {
                    errors.push({
                        field: fieldName,
                        message: `${fieldName} must be of type ${fieldSchema.type}`,
                        code: 'INVALID_TYPE'
                    });
                }
            }

            // String validations
            if (fieldSchema.type === 'string' && typeof value === 'string') {
                if (fieldSchema.minLength && value.length < fieldSchema.minLength) {
                    errors.push({
                        field: fieldName,
                        message: `${fieldName} must be at least ${fieldSchema.minLength} characters`,
                        code: 'MIN_LENGTH'
                    });
                }
                if (fieldSchema.maxLength && value.length > fieldSchema.maxLength) {
                    errors.push({
                        field: fieldName,
                        message: `${fieldName} cannot be longer than ${fieldSchema.maxLength} characters`,
                        code: 'MAX_LENGTH'
                    });
                }
                if (fieldSchema.pattern) {
                    const regex = new RegExp(fieldSchema.pattern);
                    if (!regex.test(value)) {
                        errors.push({
                            field: fieldName,
                            message: fieldSchema.patternError || `${fieldName} does not match required pattern`,
                            code: 'PATTERN_MISMATCH'
                        });
                    }
                }
            }

            // Number validations
            if (fieldSchema.type === 'number' && typeof value === 'number') {
                if (fieldSchema.minimum !== undefined && value < fieldSchema.minimum) {
                    errors.push({
                        field: fieldName,
                        message: `${fieldName} must be at least ${fieldSchema.minimum}`,
                        code: 'MIN_VALUE'
                    });
                }
                if (fieldSchema.maximum !== undefined && value > fieldSchema.maximum) {
                    errors.push({
                        field: fieldName,
                        message: `${fieldName} cannot be more than ${fieldSchema.maximum}`,
                        code: 'MAX_VALUE'
                    });
                }
            }

            // Array validations
            if (fieldSchema.type === 'array' && Array.isArray(value)) {
                if (fieldSchema.minItems && value.length < fieldSchema.minItems) {
                    errors.push({
                        field: fieldName,
                        message: `${fieldName} must have at least ${fieldSchema.minItems} items`,
                        code: 'MIN_ITEMS'
                    });
                }
                if (fieldSchema.maxItems && value.length > fieldSchema.maxItems) {
                    errors.push({
                        field: fieldName,
                        message: `${fieldName} cannot have more than ${fieldSchema.maxItems} items`,
                        code: 'MAX_ITEMS'
                    });
                }
            }

            // Custom validations from schema
            if (fieldSchema.validate) {
                try {
                    const customErrors = await fieldSchema.validate(value, fieldName);
                    if (Array.isArray(customErrors)) {
                        errors.push(...customErrors);
                    }
                } catch (error) {
                    errors.push({
                        field: fieldName,
                        message: error instanceof Error ? error.message : 'Custom validation failed',
                        code: 'CUSTOM_VALIDATION'
                    });
                }
            }

            return {
                success: errors.length === 0,
                data: value,
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
                        field: fieldName,
                        message: error instanceof Error ? error.message : 'Validation failed',
                        code: 'VALIDATION_ERROR'
                    }]
                }
            };
        }
    }, [objectId, getState]);

    /**
     * Get current field value (non-reactive)
     */
    const getCurrentFieldValue = useCallback((fieldName: string): any => {
        const currentState = getState();
        return currentState.objects?.[objectId]?.data?.[fieldName];
    }, [objectId, getState]);

    return {
        updateField,
        validateField,
        getCurrentFieldValue
    };
}

export default useObjectDataOperations;
