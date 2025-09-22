import { useCallback, useEffect, useState, useMemo } from 'react';
import { useFormCoordination } from '../context/FormCoordinationContext';
import { FormFieldRegistration, FormFieldOperations } from '../types/form-coordination';

/**
 * Base hook for managing field state and operations
 * 
 * Features:
 * - Field registration and cleanup
 * - Field validation
 * - Field value updates
 * - Field touch state
 * - Debounced updates
 */
export function useField(
    name: string,
    options: {
        debounceTime?: number;
        validateOnChange?: boolean;
        validate?: (value: any) => Promise<{ isValid: boolean; errors: string[]; warnings: string[] }>;
        transformValue?: (value: any) => any;
    } = {}
): FormFieldOperations & {
    value: any;
    isDirty: boolean;
    isTouched: boolean;
    isValid: boolean;
    errors: string[];
    warnings: string[];
} {
    // Get form coordination context
    const { registerForm, unregisterForm } = useFormCoordination();

    // Local state for immediate updates
    const [localValue, setLocalValue] = useState<any>(undefined);
    const [isDirty, setIsDirty] = useState(false);
    const [isTouched, setIsTouched] = useState(false);
    const [isValidating, setIsValidating] = useState(false);
    const [validation, setValidation] = useState({
        isValid: true,
        errors: [],
        warnings: []
    });

    // Create form registration - memoize to prevent object recreation
    const formId = `field-${name}`;
    const fieldRegistration: FormFieldRegistration = useMemo(() => ({
        name,
        type: 'text',
        validate: options.validate,
        transform: options.transformValue
    }), [name, options.validate, options.transformValue]);

    // Register form and field in effect to avoid render-time state updates
    const [formOperations, setFormOperations] = useState<any>(null);
    const [fieldOperations, setFieldOperations] = useState<any>(null);

    useEffect(() => {
        const ops = registerForm({
            id: formId,
            fields: [fieldRegistration]
        });
        setFormOperations(ops);
        
        const fieldOps = ops.registerField(fieldRegistration);
        setFieldOperations(fieldOps);
    }, [formId, fieldRegistration, registerForm]);

    // Cleanup on unmount - use stable references
    useEffect(() => {
        return () => {
            if (formOperations) {
                formOperations.unregisterField(name);
            }
            unregisterForm(formId);
        };
    }, [formId, name, formOperations, unregisterForm]);

    // Handle value changes
    const handleChange = useCallback((value: any) => {
        // Update local state immediately
        setLocalValue(value);
        setIsDirty(true);

        // Transform value if needed
        const transformedValue = options.transformValue ? options.transformValue(value) : value;

        // Update field value with debounce
        const timeoutId = setTimeout(() => {
            if (fieldOperations) {
                fieldOperations.setValue(transformedValue);

                // Validate if enabled and value is not empty (avoid validating empty initial values)
                if (options.validateOnChange && (transformedValue !== '' && transformedValue != null)) {
                    fieldOperations.validate();
                }
            }
        }, options.debounceTime || 500); // Increase default debounce time

        return () => clearTimeout(timeoutId);
    }, [fieldOperations, options.validateOnChange, options.transformValue, options.debounceTime]);

    // Handle blur
    const handleBlur = useCallback(() => {
        setIsTouched(true);
        if (fieldOperations) {
            fieldOperations.setTouched(true);

            // Validate on blur if not validating on change
            if (!options.validateOnChange) {
                fieldOperations.validate();
            }
        }
    }, [fieldOperations, options.validateOnChange]);

    // Handle validation
    const handleValidate = useCallback(async () => {
        setIsValidating(true);

        try {
            if (fieldOperations) {
                const result = await fieldOperations.validate();
                setValidation(result);
                return result;
            }
            return { isValid: true, errors: [], warnings: [] };
        } finally {
            setIsValidating(false);
        }
    }, [fieldOperations]);

    // Handle reset
    const handleReset = useCallback(() => {
        setLocalValue(undefined);
        setIsDirty(false);
        setIsTouched(false);
        setValidation({
            isValid: true,
            errors: [],
            warnings: []
        });
        if (fieldOperations) {
            fieldOperations.reset();
        }
    }, [fieldOperations]);

    // Sync with field state
    useEffect(() => {
        if (formOperations) {
            const fieldState = formOperations.getFieldState(name);
            if (fieldState) {
            setLocalValue(fieldState.value);
            setIsDirty(fieldState.isDirty);
            setIsTouched(fieldState.isTouched);
            setIsValidating(fieldState.isValidating);
            setValidation(fieldState.validation);
            }
        }
    }, [name, formOperations]);

    return {
        // Field operations
        setValue: handleChange,
        setTouched: handleBlur,
        validate: handleValidate,
        reset: handleReset,

        // Field state
        value: localValue,
        isDirty,
        isTouched,
        isValidating,
        isValid: validation.isValid,
        errors: validation.errors,
        warnings: validation.warnings
    };
}