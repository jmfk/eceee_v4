/**
 * Types for form coordination in the v2 context
 */

// Form field types
export type FormFieldType = 'text' | 'number' | 'boolean' | 'array' | 'object' | 'reference';

// Form field validation
export interface FormFieldValidation {
    isValid: boolean;
    errors: string[];
    warnings: string[];
}

// Form field state
export interface FormFieldState {
    value: any;
    isDirty: boolean;
    isTouched: boolean;
    isValidating: boolean;
    validation: FormFieldValidation;
}

// Form field registration
export interface FormFieldRegistration {
    name: string;
    type: FormFieldType;
    validate?: (value: any) => Promise<FormFieldValidation>;
    transform?: (value: any) => any;
    defaultValue?: any;
}

// Form field operations
export interface FormFieldOperations {
    setValue: (value: any) => void;
    setTouched: (touched: boolean) => void;
    validate: () => Promise<FormFieldValidation>;
    reset: () => void;
}

// Form state
export interface FormState {
    fields: Record<string, FormFieldState>;
    isDirty: boolean;
    isValidating: boolean;
    isValid: boolean;
    errors: string[];
    warnings: string[];
}

// Form registration
export interface FormRegistration {
    id: string;
    fields: FormFieldRegistration[];
    onSubmit?: (values: Record<string, any>) => Promise<void>;
    onReset?: () => void;
}

// Form operations
export interface FormOperations {
    // Field operations
    registerField: (field: FormFieldRegistration) => FormFieldOperations;
    unregisterField: (name: string) => void;
    getFieldState: (name: string) => FormFieldState;
    setFieldValue: (name: string, value: any) => void;
    setFieldTouched: (name: string, touched: boolean) => void;
    validateField: (name: string) => Promise<FormFieldValidation>;
    resetField: (name: string) => void;

    // Form operations
    submit: () => Promise<void>;
    reset: () => void;
    validate: () => Promise<boolean>;

    // Form state
    getState: () => FormState;
    isDirty: boolean;
    isValidating: boolean;
    isValid: boolean;
    errors: string[];
    warnings: string[];
}

// Form coordination context
export interface FormCoordinationContext {
    // Form registration
    registerForm: (form: FormRegistration) => FormOperations;
    unregisterForm: (id: string) => void;
    getFormState: (id: string) => FormState;

    // Form operations
    submitForm: (id: string) => Promise<void>;
    resetForm: (id: string) => void;
    validateForm: (id: string) => Promise<boolean>;

    // Form state
    isDirty: boolean;
    isValidating: boolean;
    isValid: boolean;
    errors: string[];
    warnings: string[];
}
