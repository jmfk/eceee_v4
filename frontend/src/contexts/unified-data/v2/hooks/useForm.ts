import { useCallback, useEffect } from 'react';
import { useFormCoordination } from '../context/FormCoordinationContext';
import {
    FormRegistration,
    FormOperations,
    FormFieldRegistration,
    FormFieldOperations
} from '../types/form-coordination';

/**
 * Hook for managing form state and operations
 * 
 * Features:
 * - Form registration and cleanup
 * - Field registration and cleanup
 * - Form validation
 * - Form submission
 * - Form reset
 */
export function useForm(form: FormRegistration): FormOperations {
    const {
        registerForm,
        unregisterForm
    } = useFormCoordination();

    // Register form
    const formOperations = registerForm(form);

    // Cleanup on unmount
    useEffect(() => {
        return () => {
            unregisterForm(form.id);
        };
    }, [form.id, unregisterForm]);

    return formOperations;
}

/**
 * Hook for managing form field state and operations
 * 
 * Features:
 * - Field registration and cleanup
 * - Field validation
 * - Field value updates
 * - Field touch state
 */
export function useFormField(
    formOperations: FormOperations,
    field: FormFieldRegistration
): FormFieldOperations {
    // Register field
    const fieldOperations = formOperations.registerField(field);

    // Cleanup on unmount
    useEffect(() => {
        return () => {
            formOperations.unregisterField(field.name);
        };
    }, [field.name, formOperations]);

    return fieldOperations;
}

/**
 * Hook for managing form array fields
 * 
 * Features:
 * - Array field registration and cleanup
 * - Array field validation
 * - Array field value updates
 * - Array field touch state
 */
export function useFormArray(
    formOperations: FormOperations,
    field: FormFieldRegistration
): FormFieldOperations & {
    addItem: (item: any) => void;
    removeItem: (index: number) => void;
    moveItem: (fromIndex: number, toIndex: number) => void;
} {
    // Get base field operations
    const fieldOperations = useFormField(formOperations, field);

    // Get current value
    const getValue = useCallback(() => {
        const state = formOperations.getFieldState(field.name);
        return state?.value || [];
    }, [field.name, formOperations]);

    // Add item
    const addItem = useCallback((item: any) => {
        const value = getValue();
        fieldOperations.setValue([...value, item]);
    }, [fieldOperations, getValue]);

    // Remove item
    const removeItem = useCallback((index: number) => {
        const value = getValue();
        fieldOperations.setValue([
            ...value.slice(0, index),
            ...value.slice(index + 1)
        ]);
    }, [fieldOperations, getValue]);

    // Move item
    const moveItem = useCallback((fromIndex: number, toIndex: number) => {
        const value = getValue();
        const item = value[fromIndex];
        const newValue = [...value];
        newValue.splice(fromIndex, 1);
        newValue.splice(toIndex, 0, item);
        fieldOperations.setValue(newValue);
    }, [fieldOperations, getValue]);

    return {
        ...fieldOperations,
        addItem,
        removeItem,
        moveItem
    };
}

/**
 * Hook for managing form object fields
 * 
 * Features:
 * - Object field registration and cleanup
 * - Object field validation
 * - Object field value updates
 * - Object field touch state
 */
export function useFormObject(
    formOperations: FormOperations,
    field: FormFieldRegistration
): FormFieldOperations & {
    setProperty: (name: string, value: any) => void;
    removeProperty: (name: string) => void;
} {
    // Get base field operations
    const fieldOperations = useFormField(formOperations, field);

    // Get current value
    const getValue = useCallback(() => {
        const state = formOperations.getFieldState(field.name);
        return state?.value || {};
    }, [field.name, formOperations]);

    // Set property
    const setProperty = useCallback((name: string, value: any) => {
        const currentValue = getValue();
        fieldOperations.setValue({
            ...currentValue,
            [name]: value
        });
    }, [fieldOperations, getValue]);

    // Remove property
    const removeProperty = useCallback((name: string) => {
        const currentValue = getValue();
        const { [name]: _, ...rest } = currentValue;
        fieldOperations.setValue(rest);
    }, [fieldOperations, getValue]);

    return {
        ...fieldOperations,
        setProperty,
        removeProperty
    };
}

/**
 * Hook for managing form reference fields
 * 
 * Features:
 * - Reference field registration and cleanup
 * - Reference field validation
 * - Reference field value updates
 * - Reference field touch state
 */
export function useFormReference(
    formOperations: FormOperations,
    field: FormFieldRegistration
): FormFieldOperations & {
    setReference: (id: string) => void;
    clearReference: () => void;
} {
    // Get base field operations
    const fieldOperations = useFormField(formOperations, field);

    // Set reference
    const setReference = useCallback((id: string) => {
        fieldOperations.setValue(id);
    }, [fieldOperations]);

    // Clear reference
    const clearReference = useCallback(() => {
        fieldOperations.setValue(null);
    }, [fieldOperations]);

    return {
        ...fieldOperations,
        setReference,
        clearReference
    };
}
