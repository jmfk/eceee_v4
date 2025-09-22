import React, { createContext, useContext, useCallback, useState } from 'react';
import {
    FormCoordinationContext as FormCoordinationContextType,
    FormRegistration,
    FormOperations,
    FormState,
    FormFieldRegistration,
    FormFieldOperations,
    FormFieldState,
    FormFieldValidation
} from '../types/form-coordination';

// Create context
const FormCoordinationContext = createContext<FormCoordinationContextType | null>(null);

// Provider props
interface FormCoordinationProviderProps {
    children: React.ReactNode;
}

// Provider component
export function FormCoordinationProvider({ children }: FormCoordinationProviderProps) {
    // Form state
    const [forms, setForms] = useState<Record<string, FormState>>({});
    const [formOperations, setFormOperations] = useState<Record<string, FormOperations>>({});

    // Register form
    const registerForm = useCallback((form: FormRegistration): FormOperations => {
        // Create initial form state
        const initialState: FormState = {
            fields: {},
            isDirty: false,
            isValidating: false,
            isValid: true,
            errors: [],
            warnings: []
        };

        // Create form operations
        const operations: FormOperations = {
            // Field operations
            registerField: (field: FormFieldRegistration): FormFieldOperations => {
                // Create initial field state
                const fieldState: FormFieldState = {
                    value: field.defaultValue,
                    isDirty: false,
                    isTouched: false,
                    isValidating: false,
                    validation: {
                        isValid: true,
                        errors: [],
                        warnings: []
                    }
                };

                // Update form state
                setForms(prev => ({
                    ...prev,
                    [form.id]: {
                        ...prev[form.id],
                        fields: {
                            ...prev[form.id].fields,
                            [field.name]: fieldState
                        }
                    }
                }));

                // Return field operations
                return {
                    setValue: (value: any) => {
                        setForms(prev => ({
                            ...prev,
                            [form.id]: {
                                ...prev[form.id],
                                fields: {
                                    ...prev[form.id].fields,
                                    [field.name]: {
                                        ...prev[form.id].fields[field.name],
                                        value: field.transform ? field.transform(value) : value,
                                        isDirty: true
                                    }
                                },
                                isDirty: true
                            }
                        }));
                    },
                    setTouched: (touched: boolean) => {
                        setForms(prev => ({
                            ...prev,
                            [form.id]: {
                                ...prev[form.id],
                                fields: {
                                    ...prev[form.id].fields,
                                    [field.name]: {
                                        ...prev[form.id].fields[field.name],
                                        isTouched: touched
                                    }
                                }
                            }
                        }));
                    },
                    validate: async () => {
                        if (!field.validate) {
                            return { isValid: true, errors: [], warnings: [] };
                        }

                        setForms(prev => ({
                            ...prev,
                            [form.id]: {
                                ...prev[form.id],
                                fields: {
                                    ...prev[form.id].fields,
                                    [field.name]: {
                                        ...prev[form.id].fields[field.name],
                                        isValidating: true
                                    }
                                },
                                isValidating: true
                            }
                        }));

                        try {
                            const validation = await field.validate(forms[form.id].fields[field.name].value);

                            setForms(prev => ({
                                ...prev,
                                [form.id]: {
                                    ...prev[form.id],
                                    fields: {
                                        ...prev[form.id].fields,
                                        [field.name]: {
                                            ...prev[form.id].fields[field.name],
                                            isValidating: false,
                                            validation
                                        }
                                    },
                                    isValidating: false,
                                    isValid: validation.isValid,
                                    errors: validation.errors,
                                    warnings: validation.warnings
                                }
                            }));

                            return validation;
                        } catch (error) {
                            const validation: FormFieldValidation = {
                                isValid: false,
                                errors: [error.message],
                                warnings: []
                            };

                            setForms(prev => ({
                                ...prev,
                                [form.id]: {
                                    ...prev[form.id],
                                    fields: {
                                        ...prev[form.id].fields,
                                        [field.name]: {
                                            ...prev[form.id].fields[field.name],
                                            isValidating: false,
                                            validation
                                        }
                                    },
                                    isValidating: false,
                                    isValid: false,
                                    errors: [error.message],
                                    warnings: []
                                }
                            }));

                            return validation;
                        }
                    },
                    reset: () => {
                        setForms(prev => ({
                            ...prev,
                            [form.id]: {
                                ...prev[form.id],
                                fields: {
                                    ...prev[form.id].fields,
                                    [field.name]: {
                                        value: field.defaultValue,
                                        isDirty: false,
                                        isTouched: false,
                                        isValidating: false,
                                        validation: {
                                            isValid: true,
                                            errors: [],
                                            warnings: []
                                        }
                                    }
                                }
                            }
                        }));
                    }
                };
            },
            unregisterField: (name: string) => {
                setForms(prev => {
                    const formState = prev[form.id] || initialState;
                    const { [name]: _, ...fields } = formState.fields || {};
                    return {
                        ...prev,
                        [form.id]: {
                            ...formState,
                            fields
                        }
                    };
                });
            },
            getFieldState: (name: string) => forms[form.id]?.fields?.[name] || {
                value: undefined,
                isDirty: false,
                isTouched: false,
                isValidating: false,
                validation: {
                    isValid: true,
                    errors: [],
                    warnings: []
                }
            },
            setFieldValue: (name: string, value: any) => {
                const field = form.fields.find(f => f.name === name);
                if (!field) return;

                setForms(prev => ({
                    ...prev,
                    [form.id]: {
                        ...prev[form.id],
                        fields: {
                            ...prev[form.id].fields,
                            [name]: {
                                ...prev[form.id].fields[name],
                                value: field.transform ? field.transform(value) : value,
                                isDirty: true
                            }
                        },
                        isDirty: true
                    }
                }));
            },
            setFieldTouched: (name: string, touched: boolean) => {
                setForms(prev => ({
                    ...prev,
                    [form.id]: {
                        ...prev[form.id],
                        fields: {
                            ...prev[form.id].fields,
                            [name]: {
                                ...prev[form.id].fields[name],
                                isTouched: touched
                            }
                        }
                    }
                }));
            },
            validateField: async (name: string) => {
                const field = form.fields.find(f => f.name === name);
                if (!field || !field.validate) {
                    return { isValid: true, errors: [], warnings: [] };
                }

                setForms(prev => ({
                    ...prev,
                    [form.id]: {
                        ...prev[form.id],
                        fields: {
                            ...prev[form.id].fields,
                            [name]: {
                                ...prev[form.id].fields[name],
                                isValidating: true
                            }
                        },
                        isValidating: true
                    }
                }));

                try {
                    const validation = await field.validate(forms[form.id].fields[name].value);

                    setForms(prev => ({
                        ...prev,
                        [form.id]: {
                            ...prev[form.id],
                            fields: {
                                ...prev[form.id].fields,
                                [name]: {
                                    ...prev[form.id].fields[name],
                                    isValidating: false,
                                    validation
                                }
                            },
                            isValidating: false,
                            isValid: validation.isValid,
                            errors: validation.errors,
                            warnings: validation.warnings
                        }
                    }));

                    return validation;
                } catch (error) {
                    const validation: FormFieldValidation = {
                        isValid: false,
                        errors: [error.message],
                        warnings: []
                    };

                    setForms(prev => ({
                        ...prev,
                        [form.id]: {
                            ...prev[form.id],
                            fields: {
                                ...prev[form.id].fields,
                                [name]: {
                                    ...prev[form.id].fields[name],
                                    isValidating: false,
                                    validation
                                }
                            },
                            isValidating: false,
                            isValid: false,
                            errors: [error.message],
                            warnings: []
                        }
                    }));

                    return validation;
                }
            },
            resetField: (name: string) => {
                const field = form.fields.find(f => f.name === name);
                if (!field) return;

                setForms(prev => ({
                    ...prev,
                    [form.id]: {
                        ...prev[form.id],
                        fields: {
                            ...prev[form.id].fields,
                            [name]: {
                                value: field.defaultValue,
                                isDirty: false,
                                isTouched: false,
                                isValidating: false,
                                validation: {
                                    isValid: true,
                                    errors: [],
                                    warnings: []
                                }
                            }
                        }
                    }
                }));
            },

            // Form operations
            submit: async () => {
                if (!form.onSubmit) return;

                const values = Object.entries(forms[form.id].fields).reduce(
                    (acc, [name, field]) => ({
                        ...acc,
                        [name]: field.value
                    }),
                    {}
                );

                await form.onSubmit(values);
            },
            reset: () => {
                if (form.onReset) {
                    form.onReset();
                }

                setForms(prev => ({
                    ...prev,
                    [form.id]: {
                        ...initialState,
                        fields: Object.fromEntries(
                            form.fields.map(field => [
                                field.name,
                                {
                                    value: field.defaultValue,
                                    isDirty: false,
                                    isTouched: false,
                                    isValidating: false,
                                    validation: {
                                        isValid: true,
                                        errors: [],
                                        warnings: []
                                    }
                                }
                            ])
                        )
                    }
                }));
            },
            validate: async () => {
                const validations = await Promise.all(
                    form.fields
                        .filter(field => field.validate)
                        .map(field => operations.validateField(field.name))
                );

                const isValid = validations.every(v => v.isValid);
                const errors = validations.flatMap(v => v.errors);
                const warnings = validations.flatMap(v => v.warnings);

                setForms(prev => ({
                    ...prev,
                    [form.id]: {
                        ...prev[form.id],
                        isValid,
                        errors,
                        warnings
                    }
                }));

                return isValid;
            },

            // Form state
            getState: () => forms[form.id],
            isDirty: forms[form.id]?.isDirty || false,
            isValidating: forms[form.id]?.isValidating || false,
            isValid: forms[form.id]?.isValid || true,
            errors: forms[form.id]?.errors || [],
            warnings: forms[form.id]?.warnings || []
        };

        // Initialize form state with fields
        const initialFormState = {
            ...initialState,
            fields: Object.fromEntries(
                form.fields.map(field => [
                    field.name,
                    {
                        value: field.defaultValue,
                        isDirty: false,
                        isTouched: false,
                        isValidating: false,
                        validation: {
                            isValid: true,
                            errors: [],
                            warnings: []
                        }
                    }
                ])
            )
        };

        // Update form state and operations
        setForms(prev => ({
            ...prev,
            [form.id]: initialFormState
        }));
        setFormOperations(prev => ({
            ...prev,
            [form.id]: operations
        }));

        return operations;
    }, [forms]);

    // Unregister form
    const unregisterForm = useCallback((id: string) => {
        setForms(prev => {
            const { [id]: _, ...rest } = prev;
            return rest;
        });
        setFormOperations(prev => {
            const { [id]: _, ...rest } = prev;
            return rest;
        });
    }, []);

    // Get form state
    const getFormState = useCallback((id: string) => forms[id], [forms]);

    // Submit form
    const submitForm = useCallback(async (id: string) => {
        const operations = formOperations[id];
        if (!operations) return;
        await operations.submit();
    }, [formOperations]);

    // Reset form
    const resetForm = useCallback((id: string) => {
        const operations = formOperations[id];
        if (!operations) return;
        operations.reset();
    }, [formOperations]);

    // Validate form
    const validateForm = useCallback(async (id: string) => {
        const operations = formOperations[id];
        if (!operations) return false;
        return await operations.validate();
    }, [formOperations]);

    // Calculate global form state
    const isDirty = Object.values(forms).some(form => form.isDirty);
    const isValidating = Object.values(forms).some(form => form.isValidating);
    const isValid = Object.values(forms).every(form => form.isValid);
    const errors = Object.values(forms).flatMap(form => form.errors);
    const warnings = Object.values(forms).flatMap(form => form.warnings);

    // Context value
    const value: FormCoordinationContextType = {
        // Form registration
        registerForm,
        unregisterForm,
        getFormState,

        // Form operations
        submitForm,
        resetForm,
        validateForm,

        // Form state
        isDirty,
        isValidating,
        isValid,
        errors,
        warnings
    };

    return (
        <FormCoordinationContext.Provider value={value}>
            {children}
        </FormCoordinationContext.Provider>
    );
}

// Hook for using form coordination
export function useFormCoordination() {
    const context = useContext(FormCoordinationContext);
    if (!context) {
        throw new Error('useFormCoordination must be used within FormCoordinationProvider');
    }
    return context;
}
