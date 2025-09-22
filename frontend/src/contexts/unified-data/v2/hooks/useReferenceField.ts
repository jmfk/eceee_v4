import { useCallback, useEffect, useState } from 'react';
import { useUnifiedData } from '../context/UnifiedDataContext';
import { PathString } from '../types/paths';

export interface ReferenceFieldOptions {
    // Reference type
    referenceType: 'object' | 'widget' | 'layout';
    
    // Validation options
    validateOnChange?: boolean;
    validateReference?: (referenceId: string) => Promise<string[]>;
    
    // Update behavior
    debounceTime?: number;
    
    // Reference constraints
    allowNull?: boolean;
    allowMultiple?: boolean;
    
    // Metadata
    label?: string;
    description?: string;
}

export interface ReferenceFieldState {
    referenceId: string | string[] | null;
    referencedData: any | any[] | null;
    isDirty: boolean;
    isTouched: boolean;
    isValid: boolean;
    errors: string[];
    isValidating: boolean;
    isLoading: boolean;
    metadata: Record<string, any>;
}

export function useReferenceField(
    objectId: string,
    fieldName: string,
    options: ReferenceFieldOptions
) {
    const {
        referenceType,
        validateOnChange = true,
        validateReference,
        debounceTime = 300,
        allowNull = true,
        allowMultiple = false,
        label,
        description
    } = options;

    const { get, set, subscribe } = useUnifiedData();
    const path = `object.${objectId}.${fieldName}` as PathString;

    // Local state for immediate updates
    const [state, setState] = useState<ReferenceFieldState>(() => ({
        referenceId: get(path) || (allowMultiple ? [] : null),
        referencedData: null,
        isDirty: false,
        isTouched: false,
        isValid: true,
        errors: [],
        isValidating: false,
        isLoading: false,
        metadata: {}
    }));

    // Subscribe to external changes
    useEffect(() => {
        return subscribe(
            path,
            (newValue) => {
                setState(prev => ({
                    ...prev,
                    referenceId: newValue || (allowMultiple ? [] : null),
                    isDirty: false // Reset dirty state for external updates
                }));
            },
            { debounceTime }
        );
    }, [path, debounceTime, subscribe, allowMultiple]);

    // Load referenced data
    useEffect(() => {
        const loadReferencedData = async () => {
            if (!state.referenceId || (Array.isArray(state.referenceId) && state.referenceId.length === 0)) {
                setState(prev => ({ ...prev, referencedData: null, isLoading: false }));
                return;
            }

            setState(prev => ({ ...prev, isLoading: true }));

            try {
                if (Array.isArray(state.referenceId)) {
                    // Load multiple references
                    const dataPromises = state.referenceId.map(id => 
                        get(`${referenceType}.${id}`) as Promise<any>
                    );
                    const referencedData = await Promise.all(dataPromises);
                    setState(prev => ({ ...prev, referencedData, isLoading: false }));
                } else {
                    // Load single reference
                    const referencedData = await get(`${referenceType}.${state.referenceId}`);
                    setState(prev => ({ ...prev, referencedData, isLoading: false }));
                }
            } catch (error) {
                console.error('Failed to load referenced data:', error);
                setState(prev => ({
                    ...prev,
                    referencedData: null,
                    isLoading: false,
                    errors: ['Failed to load referenced data']
                }));
            }
        };

        loadReferencedData();
    }, [state.referenceId, referenceType, get]);

    // Validate reference
    const runValidation = useCallback(async (referenceId: string | string[] | null): Promise<string[]> => {
        if (!validateReference) return [];

        setState(prev => ({ ...prev, isValidating: true }));
        try {
            const errors: string[] = [];

            // Check null constraint
            if (!allowNull && !referenceId) {
                errors.push('Reference is required');
            }

            // Check multiple constraint
            if (!allowMultiple && Array.isArray(referenceId)) {
                errors.push('Multiple references are not allowed');
            }

            // Validate references
            if (referenceId) {
                if (Array.isArray(referenceId)) {
                    const validationPromises = referenceId.map(validateReference);
                    const validationResults = await Promise.all(validationPromises);
                    validationResults.forEach((result, index) => {
                        if (result.length > 0) {
                            errors.push(`Invalid reference at index ${index}: ${result.join(', ')}`);
                        }
                    });
                } else {
                    const validationErrors = await validateReference(referenceId);
                    errors.push(...validationErrors);
                }
            }

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
    }, [validateReference, allowNull, allowMultiple]);

    // Update reference
    const setReference = useCallback(async (newReferenceId: string | string[] | null) => {
        setState(prev => ({
            ...prev,
            referenceId: newReferenceId,
            isDirty: true,
            isTouched: true
        }));

        if (validateOnChange) {
            await runValidation(newReferenceId);
        }

        set({
            path,
            value: newReferenceId,
            metadata: {
                label,
                description,
                referenceType,
                lastUpdated: new Date().toISOString()
            }
        });
    }, [path, set, validateOnChange, runValidation, label, description, referenceType]);

    // Add reference (for multiple references)
    const addReference = useCallback(async (referenceId: string) => {
        if (!allowMultiple) {
            throw new Error('Multiple references are not allowed');
        }

        const currentRefs = Array.isArray(state.referenceId) ? state.referenceId : [];
        const newRefs = [...currentRefs, referenceId];

        await setReference(newRefs);
    }, [allowMultiple, state.referenceId, setReference]);

    // Remove reference
    const removeReference = useCallback(async (referenceId: string) => {
        if (Array.isArray(state.referenceId)) {
            const newRefs = state.referenceId.filter(ref => ref !== referenceId);
            await setReference(newRefs);
        } else {
            await setReference(null);
        }
    }, [state.referenceId, setReference]);

    // Reset field
    const reset = useCallback(() => {
        const initialValue = get(path) || (allowMultiple ? [] : null);
        setState({
            referenceId: initialValue,
            referencedData: null,
            isDirty: false,
            isTouched: false,
            isValid: true,
            errors: [],
            isValidating: false,
            isLoading: false,
            metadata: {}
        });
    }, [path, get, allowMultiple]);

    return {
        // Field state
        referenceId: state.referenceId,
        referencedData: state.referencedData,
        isDirty: state.isDirty,
        isTouched: state.isTouched,
        isValid: state.isValid,
        errors: state.errors,
        isValidating: state.isValidating,
        isLoading: state.isLoading,
        metadata: state.metadata,

        // Reference operations
        setReference,
        addReference,
        removeReference,
        reset,
        validate: () => runValidation(state.referenceId)
    };
}
