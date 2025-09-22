import { useCallback, useEffect, useState } from 'react';
import { useUnifiedData } from '../context/UnifiedDataContext';
import { PathString } from '../types/paths';

export interface ObjectFieldOptions {
    // Validation options
    validateOnChange?: boolean;
    validateOnBlur?: boolean;
    validate?: (value: any) => Promise<string[]>;
    
    // Update behavior
    debounceTime?: number;
    transformValue?: (value: any) => any;
    
    // Metadata
    label?: string;
    description?: string;
}

export interface ObjectFieldState<T> {
    value: T;
    isDirty: boolean;
    isTouched: boolean;
    isValid: boolean;
    errors: string[];
    isValidating: boolean;
    metadata: Record<string, any>;
}

export function useObjectField<T>(
    objectId: string,
    fieldName: string,
    options: ObjectFieldOptions = {}
) {
    const {
        validateOnChange = true,
        validateOnBlur = true,
        validate,
        debounceTime = 300,
        transformValue,
        label,
        description
    } = options;

    const { get, set, subscribe } = useUnifiedData();
    const path = `object.${objectId}.${fieldName}` as PathString;

    // Local state for immediate updates
    const [state, setState] = useState<ObjectFieldState<T>>(() => ({
        value: get(path) as T,
        isDirty: false,
        isTouched: false,
        isValid: true,
        errors: [],
        isValidating: false,
        metadata: {}
    }));

    // Subscribe to external changes
    useEffect(() => {
        return subscribe(
            path,
            (newValue) => {
                setState(prev => ({
                    ...prev,
                    value: newValue as T,
                    isDirty: false // Reset dirty state for external updates
                }));
            },
            { debounceTime }
        );
    }, [path, debounceTime, subscribe]);

    // Validation
    const runValidation = useCallback(async (value: T): Promise<string[]> => {
        if (!validate) return [];

        setState(prev => ({ ...prev, isValidating: true }));
        try {
            const errors = await validate(value);
            setState(prev => ({
                ...prev,
                isValidating: false,
                isValid: errors.length === 0,
                errors
            }));
            return errors;
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Validation failed';
            setState(prev => ({
                ...prev,
                isValidating: false,
                isValid: false,
                errors: [errorMessage]
            }));
            return [errorMessage];
        }
    }, [validate]);

    // Update value
    const setValue = useCallback(async (newValue: T) => {
        // Transform value if needed
        const valueToSet = transformValue ? transformValue(newValue) : newValue;

        // Update local state immediately
        setState(prev => ({
            ...prev,
            value: valueToSet,
            isDirty: true,
            isTouched: true
        }));

        // Validate if needed
        if (validateOnChange) {
            await runValidation(valueToSet);
        }

        // Update context
        set({
            path,
            value: valueToSet,
            metadata: {
                label,
                description,
                lastUpdated: new Date().toISOString()
            }
        });
    }, [path, set, transformValue, validateOnChange, runValidation, label, description]);

    // Handle blur
    const handleBlur = useCallback(async () => {
        setState(prev => ({ ...prev, isTouched: true }));

        if (validateOnBlur && !validateOnChange) {
            await runValidation(state.value);
        }
    }, [validateOnBlur, validateOnChange, runValidation, state.value]);

    // Reset field
    const reset = useCallback(() => {
        const initialValue = get(path) as T;
        setState({
            value: initialValue,
            isDirty: false,
            isTouched: false,
            isValid: true,
            errors: [],
            isValidating: false,
            metadata: {}
        });
    }, [path, get]);

    return {
        // Field state
        value: state.value,
        isDirty: state.isDirty,
        isTouched: state.isTouched,
        isValid: state.isValid,
        errors: state.errors,
        isValidating: state.isValidating,
        metadata: state.metadata,

        // Methods
        setValue,
        handleBlur,
        reset,
        validate: () => runValidation(state.value)
    };
}
