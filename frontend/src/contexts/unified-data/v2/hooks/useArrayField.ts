import { useCallback, useEffect, useState } from 'react';
import { useUnifiedData } from '../context/UnifiedDataContext';
import { PathString } from '../types/paths';

export interface ArrayFieldOptions<T> {
    // Validation options
    validateOnChange?: boolean;
    validateItem?: (item: T) => Promise<string[]>;
    validateArray?: (items: T[]) => Promise<string[]>;
    
    // Update behavior
    debounceTime?: number;
    transformItem?: (item: T) => T;
    
    // Array constraints
    minItems?: number;
    maxItems?: number;
    uniqueItems?: boolean;
    
    // Metadata
    label?: string;
    description?: string;
}

export interface ArrayFieldState<T> {
    items: T[];
    isDirty: boolean;
    isTouched: boolean;
    isValid: boolean;
    errors: string[];
    itemErrors: Record<number, string[]>;
    isValidating: boolean;
    metadata: Record<string, any>;
}

export function useArrayField<T>(
    objectId: string,
    fieldName: string,
    options: ArrayFieldOptions<T> = {}
) {
    const {
        validateOnChange = true,
        validateItem,
        validateArray,
        debounceTime = 300,
        transformItem,
        minItems,
        maxItems,
        uniqueItems,
        label,
        description
    } = options;

    const { get, set, subscribe } = useUnifiedData();
    const path = `object.${objectId}.${fieldName}` as PathString;

    // Local state for immediate updates
    const [state, setState] = useState<ArrayFieldState<T>>(() => ({
        items: get(path) as T[] || [],
        isDirty: false,
        isTouched: false,
        isValid: true,
        errors: [],
        itemErrors: {},
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
                    items: newValue as T[] || [],
                    isDirty: false // Reset dirty state for external updates
                }));
            },
            { debounceTime }
        );
    }, [path, debounceTime, subscribe]);

    // Validate array and items
    const runValidation = useCallback(async (items: T[]): Promise<boolean> => {
        setState(prev => ({ ...prev, isValidating: true }));
        const errors: string[] = [];
        const itemErrors: Record<number, string[]> = {};

        try {
            // Validate array constraints
            if (minItems !== undefined && items.length < minItems) {
                errors.push(`Minimum ${minItems} items required`);
            }
            if (maxItems !== undefined && items.length > maxItems) {
                errors.push(`Maximum ${maxItems} items allowed`);
            }
            if (uniqueItems && new Set(items).size !== items.length) {
                errors.push('Duplicate items are not allowed');
            }

            // Validate individual items
            if (validateItem) {
                await Promise.all(items.map(async (item, index) => {
                    try {
                        const itemValidationErrors = await validateItem(item);
                        if (itemValidationErrors.length > 0) {
                            itemErrors[index] = itemValidationErrors;
                        }
                    } catch (error) {
                        itemErrors[index] = [(error as Error).message];
                    }
                }));
            }

            // Validate entire array
            if (validateArray) {
                const arrayErrors = await validateArray(items);
                errors.push(...arrayErrors);
            }

            const isValid = errors.length === 0 && Object.keys(itemErrors).length === 0;
            setState(prev => ({
                ...prev,
                isValidating: false,
                isValid,
                errors,
                itemErrors
            }));

            return isValid;
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Validation failed';
            setState(prev => ({
                ...prev,
                isValidating: false,
                isValid: false,
                errors: [errorMessage],
                itemErrors: {}
            }));
            return false;
        }
    }, [minItems, maxItems, uniqueItems, validateItem, validateArray]);

    // Array operations
    const addItem = useCallback(async (item: T) => {
        const transformedItem = transformItem ? transformItem(item) : item;
        const newItems = [...state.items, transformedItem];

        setState(prev => ({
            ...prev,
            items: newItems,
            isDirty: true,
            isTouched: true
        }));

        if (validateOnChange) {
            await runValidation(newItems);
        }

        set({
            path,
            value: newItems,
            metadata: {
                label,
                description,
                lastUpdated: new Date().toISOString()
            }
        });
    }, [path, set, state.items, transformItem, validateOnChange, runValidation, label, description]);

    const updateItem = useCallback(async (index: number, item: T) => {
        const transformedItem = transformItem ? transformItem(item) : item;
        const newItems = [...state.items];
        newItems[index] = transformedItem;

        setState(prev => ({
            ...prev,
            items: newItems,
            isDirty: true,
            isTouched: true
        }));

        if (validateOnChange) {
            await runValidation(newItems);
        }

        set({
            path,
            value: newItems,
            metadata: {
                label,
                description,
                lastUpdated: new Date().toISOString()
            }
        });
    }, [path, set, state.items, transformItem, validateOnChange, runValidation, label, description]);

    const removeItem = useCallback(async (index: number) => {
        const newItems = state.items.filter((_, i) => i !== index);

        setState(prev => ({
            ...prev,
            items: newItems,
            isDirty: true,
            isTouched: true
        }));

        if (validateOnChange) {
            await runValidation(newItems);
        }

        set({
            path,
            value: newItems,
            metadata: {
                label,
                description,
                lastUpdated: new Date().toISOString()
            }
        });
    }, [path, set, state.items, validateOnChange, runValidation, label, description]);

    const moveItem = useCallback(async (fromIndex: number, toIndex: number) => {
        const newItems = [...state.items];
        const [movedItem] = newItems.splice(fromIndex, 1);
        newItems.splice(toIndex, 0, movedItem);

        setState(prev => ({
            ...prev,
            items: newItems,
            isDirty: true,
            isTouched: true
        }));

        if (validateOnChange) {
            await runValidation(newItems);
        }

        set({
            path,
            value: newItems,
            metadata: {
                label,
                description,
                lastUpdated: new Date().toISOString()
            }
        });
    }, [path, set, state.items, validateOnChange, runValidation, label, description]);

    // Reset field
    const reset = useCallback(() => {
        const initialItems = get(path) as T[] || [];
        setState({
            items: initialItems,
            isDirty: false,
            isTouched: false,
            isValid: true,
            errors: [],
            itemErrors: {},
            isValidating: false,
            metadata: {}
        });
    }, [path, get]);

    return {
        // Field state
        items: state.items,
        isDirty: state.isDirty,
        isTouched: state.isTouched,
        isValid: state.isValid,
        errors: state.errors,
        itemErrors: state.itemErrors,
        isValidating: state.isValidating,
        metadata: state.metadata,

        // Array operations
        addItem,
        updateItem,
        removeItem,
        moveItem,
        reset,
        validate: () => runValidation(state.items)
    };
}
