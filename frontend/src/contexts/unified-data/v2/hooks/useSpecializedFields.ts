import { useCallback } from 'react';
import { useField } from './useField';
import { FormFieldOperations } from '../types/form-coordination';

/**
 * Hook for managing text fields
 */
export function useTextField(
    name: string,
    options: {
        debounceTime?: number;
        validateOnChange?: boolean;
        validate?: (value: string) => Promise<{ isValid: boolean; errors: string[]; warnings: string[] }>;
        transformValue?: (value: string) => string;
    } = {}
): FormFieldOperations & {
    value: string;
    isDirty: boolean;
    isTouched: boolean;
    isValid: boolean;
    errors: string[];
    warnings: string[];
} {
    // Use base field hook
    const field = useField(name, {
        ...options,
        transformValue: (value) => String(value)
    });

    return field;
}

/**
 * Hook for managing number fields
 */
export function useNumberField(
    name: string,
    options: {
        debounceTime?: number;
        validateOnChange?: boolean;
        validate?: (value: number) => Promise<{ isValid: boolean; errors: string[]; warnings: string[] }>;
        transformValue?: (value: number) => number;
        min?: number;
        max?: number;
        step?: number;
    } = {}
): FormFieldOperations & {
    value: number;
    isDirty: boolean;
    isTouched: boolean;
    isValid: boolean;
    errors: string[];
    warnings: string[];
} {
    // Use base field hook
    const field = useField(name, {
        ...options,
        transformValue: (value) => {
            const num = Number(value);
            if (isNaN(num)) return undefined;
            if (options.min !== undefined && num < options.min) return options.min;
            if (options.max !== undefined && num > options.max) return options.max;
            return num;
        },
        validate: async (value) => {
            if (options.validate) {
                return options.validate(value);
            }

            const errors: string[] = [];
            if (isNaN(value)) {
                errors.push('Value must be a number');
            } else {
                if (options.min !== undefined && value < options.min) {
                    errors.push(`Value must be at least ${options.min}`);
                }
                if (options.max !== undefined && value > options.max) {
                    errors.push(`Value must be at most ${options.max}`);
                }
            }

            return {
                isValid: errors.length === 0,
                errors,
                warnings: []
            };
        }
    });

    return field;
}

/**
 * Hook for managing boolean fields
 */
export function useBooleanField(
    name: string,
    options: {
        debounceTime?: number;
        validateOnChange?: boolean;
        validate?: (value: boolean) => Promise<{ isValid: boolean; errors: string[]; warnings: string[] }>;
        transformValue?: (value: boolean) => boolean;
    } = {}
): FormFieldOperations & {
    value: boolean;
    isDirty: boolean;
    isTouched: boolean;
    isValid: boolean;
    errors: string[];
    warnings: string[];
} {
    // Use base field hook
    const field = useField(name, {
        ...options,
        transformValue: (value) => Boolean(value)
    });

    return field;
}

/**
 * Hook for managing array fields
 */
export function useArrayField<T>(
    name: string,
    options: {
        debounceTime?: number;
        validateOnChange?: boolean;
        validate?: (value: T[]) => Promise<{ isValid: boolean; errors: string[]; warnings: string[] }>;
        transformValue?: (value: T[]) => T[];
        minItems?: number;
        maxItems?: number;
        itemValidator?: (item: T) => Promise<{ isValid: boolean; errors: string[]; warnings: string[] }>;
    } = {}
): FormFieldOperations & {
    value: T[];
    isDirty: boolean;
    isTouched: boolean;
    isValid: boolean;
    errors: string[];
    warnings: string[];
    addItem: (item: T) => void;
    removeItem: (index: number) => void;
    moveItem: (fromIndex: number, toIndex: number) => void;
} {
    // Use base field hook
    const field = useField(name, {
        ...options,
        validate: async (value) => {
            if (options.validate) {
                return options.validate(value);
            }

            const errors: string[] = [];
            if (!Array.isArray(value)) {
                errors.push('Value must be an array');
                return { isValid: false, errors, warnings: [] };
            }

            if (options.minItems !== undefined && value.length < options.minItems) {
                errors.push(`Array must have at least ${options.minItems} items`);
            }
            if (options.maxItems !== undefined && value.length > options.maxItems) {
                errors.push(`Array must have at most ${options.maxItems} items`);
            }

            if (options.itemValidator) {
                const itemResults = await Promise.all(value.map(options.itemValidator));
                itemResults.forEach((result, index) => {
                    if (!result.isValid) {
                        errors.push(`Item ${index + 1}: ${result.errors.join(', ')}`);
                    }
                });
            }

            return {
                isValid: errors.length === 0,
                errors,
                warnings: []
            };
        }
    });

    // Array operations
    const addItem = useCallback((item: T) => {
        field.setValue([...(field.value || []), item]);
    }, [field]);

    const removeItem = useCallback((index: number) => {
        field.setValue([
            ...field.value.slice(0, index),
            ...field.value.slice(index + 1)
        ]);
    }, [field]);

    const moveItem = useCallback((fromIndex: number, toIndex: number) => {
        const value = [...field.value];
        const [item] = value.splice(fromIndex, 1);
        value.splice(toIndex, 0, item);
        field.setValue(value);
    }, [field]);

    return {
        ...field,
        addItem,
        removeItem,
        moveItem
    };
}

/**
 * Hook for managing object fields
 */
export function useObjectField<T extends Record<string, any>>(
    name: string,
    options: {
        debounceTime?: number;
        validateOnChange?: boolean;
        validate?: (value: T) => Promise<{ isValid: boolean; errors: string[]; warnings: string[] }>;
        transformValue?: (value: T) => T;
        requiredFields?: (keyof T)[];
        fieldValidators?: {
            [K in keyof T]?: (value: T[K]) => Promise<{ isValid: boolean; errors: string[]; warnings: string[] }>;
        };
    } = {}
): FormFieldOperations & {
    value: T;
    isDirty: boolean;
    isTouched: boolean;
    isValid: boolean;
    errors: string[];
    warnings: string[];
    setProperty: <K extends keyof T>(key: K, value: T[K]) => void;
    removeProperty: (key: keyof T) => void;
} {
    // Use base field hook
    const field = useField(name, {
        ...options,
        validate: async (value) => {
            if (options.validate) {
                return options.validate(value);
            }

            const errors: string[] = [];
            if (!value || typeof value !== 'object') {
                errors.push('Value must be an object');
                return { isValid: false, errors, warnings: [] };
            }

            if (options.requiredFields) {
                for (const field of options.requiredFields) {
                    if (!(field in value)) {
                        errors.push(`Field ${String(field)} is required`);
                    }
                }
            }

            if (options.fieldValidators) {
                for (const [field, validator] of Object.entries(options.fieldValidators)) {
                    if (field in value && validator) {
                        const result = await validator(value[field]);
                        if (!result.isValid) {
                            errors.push(`Field ${field}: ${result.errors.join(', ')}`);
                        }
                    }
                }
            }

            return {
                isValid: errors.length === 0,
                errors,
                warnings: []
            };
        }
    });

    // Object operations
    const setProperty = useCallback(<K extends keyof T>(key: K, value: T[K]) => {
        field.setValue({
            ...field.value,
            [key]: value
        });
    }, [field]);

    const removeProperty = useCallback((key: keyof T) => {
        const { [key]: _, ...rest } = field.value;
        field.setValue(rest as T);
    }, [field]);

    return {
        ...field,
        setProperty,
        removeProperty
    };
}

/**
 * Hook for managing reference fields
 */
export function useReferenceField<T extends string>(
    name: string,
    options: {
        debounceTime?: number;
        validateOnChange?: boolean;
        validate?: (value: T) => Promise<{ isValid: boolean; errors: string[]; warnings: string[] }>;
        transformValue?: (value: T) => T;
        allowedTypes?: string[];
        validateReference?: (id: T) => Promise<boolean>;
    } = {}
): FormFieldOperations & {
    value: T;
    isDirty: boolean;
    isTouched: boolean;
    isValid: boolean;
    errors: string[];
    warnings: string[];
    setReference: (id: T) => void;
    clearReference: () => void;
} {
    // Use base field hook
    const field = useField(name, {
        ...options,
        validate: async (value) => {
            if (options.validate) {
                return options.validate(value);
            }

            const errors: string[] = [];
            if (!value) {
                errors.push('Reference ID is required');
                return { isValid: false, errors, warnings: [] };
            }

            if (options.allowedTypes) {
                const type = value.split(':')[0];
                if (!options.allowedTypes.includes(type)) {
                    errors.push(`Invalid reference type: ${type}. Allowed types: ${options.allowedTypes.join(', ')}`);
                }
            }

            if (options.validateReference) {
                const exists = await options.validateReference(value);
                if (!exists) {
                    errors.push(`Referenced item does not exist: ${value}`);
                }
            }

            return {
                isValid: errors.length === 0,
                errors,
                warnings: []
            };
        }
    });

    // Reference operations
    const setReference = useCallback((id: T) => {
        field.setValue(id);
    }, [field]);

    const clearReference = useCallback(() => {
        field.setValue(undefined);
    }, [field]);

    return {
        ...field,
        setReference,
        clearReference
    };
}
