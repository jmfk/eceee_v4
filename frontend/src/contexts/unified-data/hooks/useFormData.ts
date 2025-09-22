/**
 * Hook for managing form data through UnifiedDataContext
 */

import { useCallback, useMemo, useRef } from 'react';
import { useUnifiedData } from '../context/UnifiedDataContext';
import { OperationTypes } from '../types/operations';
import { FormData, FormFieldData, ValidationError } from '../types/state';

export interface UseFormDataResult {
    // Data access
    form: FormData | null;
    fields: Record<string, FormFieldData>;
    isValid: boolean;
    isDirty: boolean;
    hasUnsavedChanges: boolean;
    errors: ValidationError[];
    fieldErrors: Record<string, ValidationError[]>;
    
    // Field operations
    initializeField: (fieldName: string, value: any) => Promise<void>;
    updateField: (fieldName: string, value: any) => Promise<void>;
    updateFieldData: (fieldName: string, fieldData: Partial<FormFieldData>) => Promise<void>;
    updateFields: (fields: Record<string, any>) => Promise<void>;
    
    // Validation operations
    validateField: (fieldName: string) => Promise<boolean>;
    validateForm: () => Promise<boolean>;
    setFieldError: (fieldName: string, errors: ValidationError[]) => Promise<void>;
    clearFieldErrors: (fieldName: string) => Promise<void>;
    setFormErrors: (errors: ValidationError[]) => Promise<void>;
    clearFormErrors: () => Promise<void>;
    
    // Form operations
    resetForm: () => Promise<void>;
    submitForm: () => Promise<void>;
    
    // Utilities
    getFieldValue: (fieldName: string) => any;
    isFieldDirty: (fieldName: string) => boolean;
    isFieldValid: (fieldName: string) => boolean;
}

/**
 * Hook to manage form data through UnifiedDataContext
 */
export function useFormData(formId: string, formType: 'object' | 'page' | 'widget' | 'layout' = 'object'): UseFormDataResult {
    const { 
        state, 
        dispatch, 
        useSelector, 
        hasUnsavedChanges, 
        isDirty,
        setIsDirty 
    } = useUnifiedData();

    // Select form from state - safely handle case where forms might not exist yet
    const form = useSelector(state => state.forms?.[formId] || null);

    // Memoized computed values
    const fields = useMemo(() => form?.fields || {}, [form?.fields]);
    const isValid = useMemo(() => form?.isValid ?? true, [form?.isValid]);
    const errors = useMemo(() => form?.errors || [], [form?.errors]);
    
    const fieldErrors = useMemo(() => {
        const errorMap: Record<string, ValidationError[]> = {};
        Object.entries(fields).forEach(([fieldName, fieldData]) => {
            if (fieldData.errors.length > 0) {
                errorMap[fieldName] = fieldData.errors;
            }
        });
        return errorMap;
    }, [fields]);

    // Track initialization to prevent multiple CREATE_FORM operations
    const initializationRef = useRef(false);
    
    // Initialize form if it doesn't exist
    const initializeForm = useCallback(async () => {
        if (!form && !initializationRef.current) {
            initializationRef.current = true;
            try {
                await dispatch({
                    type: OperationTypes.CREATE_FORM,
                    payload: {
                        formId,
                        formData: {
                            id: formId,
                            type: formType,
                            fields: {},
                            isValid: true,
                            isDirty: false,
                            errors: [],
                            metadata: {}
                        }
                    },
                    metadata: { source: 'system' }
                });
            } catch (error) {
                initializationRef.current = false;
                throw error;
            }
        }
    }, [form, formId, formType, dispatch]);

    // Initialize field value without setting dirty flag (for form initialization)
    const initializeField = useCallback(async (fieldName: string, value: any) => {
        await initializeForm();
        
        await dispatch({
            type: OperationTypes.UPDATE_FORM_FIELD,
            payload: { formId, fieldName, value },
            metadata: { source: 'system' } // Mark as system to avoid dirty flag
        });
        // Don't set dirty flag for initialization
    }, [dispatch, formId, initializeForm]);

    // Update single field value (for user interactions)
    const updateField = useCallback(async (fieldName: string, value: any) => {
        await initializeForm();
        
        await dispatch({
            type: OperationTypes.UPDATE_FORM_FIELD,
            payload: { formId, fieldName, value },
            metadata: { source: 'user' }
        });
        setIsDirty(true);
    }, [dispatch, formId, initializeForm, setIsDirty]);

    // Update field data (including validation state)
    const updateFieldData = useCallback(async (fieldName: string, fieldData: Partial<FormFieldData>) => {
        await initializeForm();
        
        await dispatch({
            type: OperationTypes.UPDATE_FORM_FIELD_DATA,
            payload: { formId, fieldName, fieldData },
            metadata: { source: 'user' }
        });
        setIsDirty(true);
    }, [dispatch, formId, initializeForm, setIsDirty]);

    // Update multiple fields at once
    const updateFields = useCallback(async (fieldUpdates: Record<string, any>) => {
        await initializeForm();
        
        const fieldDataUpdates: Record<string, FormFieldData> = {};
        Object.entries(fieldUpdates).forEach(([fieldName, value]) => {
            fieldDataUpdates[fieldName] = {
                fieldName,
                value,
                isValid: true, // Will be validated separately
                errors: [],
                isDirty: true,
                lastUpdated: new Date().toISOString()
            };
        });
        
        await dispatch({
            type: OperationTypes.UPDATE_FORM_FIELDS,
            payload: { formId, fields: fieldDataUpdates },
            metadata: { source: 'user' }
        });
        setIsDirty(true);
    }, [dispatch, formId, initializeForm, setIsDirty]);

    // Validate single field
    const validateField = useCallback(async (fieldName: string): Promise<boolean> => {
        await dispatch({
            type: OperationTypes.VALIDATE_FORM_FIELD,
            payload: { formId, fieldName },
            metadata: { source: 'system' }
        });
        
        // Return validation result
        const updatedForm = state.forms[formId];
        const fieldData = updatedForm?.fields[fieldName];
        return fieldData?.isValid ?? true;
    }, [dispatch, formId, state.forms]);

    // Validate entire form
    const validateForm = useCallback(async (): Promise<boolean> => {
        await dispatch({
            type: OperationTypes.VALIDATE_FORM,
            payload: { formId },
            metadata: { source: 'system' }
        });
        
        // Return validation result
        const updatedForm = state.forms[formId];
        return updatedForm?.isValid ?? true;
    }, [dispatch, formId, state.forms]);

    // Set field errors
    const setFieldError = useCallback(async (fieldName: string, errors: ValidationError[]) => {
        await updateFieldData(fieldName, { errors, isValid: errors.length === 0 });
    }, [updateFieldData]);

    // Clear field errors
    const clearFieldErrors = useCallback(async (fieldName: string) => {
        await updateFieldData(fieldName, { errors: [], isValid: true });
    }, [updateFieldData]);

    // Set form-level errors
    const setFormErrors = useCallback(async (errors: ValidationError[]) => {
        await dispatch({
            type: OperationTypes.SET_FORM_ERRORS,
            payload: { formId, errors },
            metadata: { source: 'system' }
        });
    }, [dispatch, formId]);

    // Clear form-level errors
    const clearFormErrors = useCallback(async () => {
        await dispatch({
            type: OperationTypes.CLEAR_FORM_ERRORS,
            payload: { formId },
            metadata: { source: 'system' }
        });
    }, [dispatch, formId]);

    // Reset form to initial state
    const resetForm = useCallback(async () => {
        await dispatch({
            type: OperationTypes.RESET_FORM,
            payload: { formId },
            metadata: { source: 'user' }
        });
        setIsDirty(false);
    }, [dispatch, formId, setIsDirty]);

    // Submit form (this would trigger validation and API call)
    const submitForm = useCallback(async () => {
        const isFormValid = await validateForm();
        if (!isFormValid) {
            throw new Error('Form validation failed');
        }
        
        await dispatch({
            type: OperationTypes.SUBMIT_FORM,
            payload: { formId },
            metadata: { source: 'user' }
        });
        setIsDirty(false);
    }, [dispatch, formId, validateForm, setIsDirty]);

    // Utility functions
    const getFieldValue = useCallback((fieldName: string) => {
        return fields[fieldName]?.value;
    }, [fields]);

    const isFieldDirty = useCallback((fieldName: string) => {
        return fields[fieldName]?.isDirty ?? false;
    }, [fields]);

    const isFieldValid = useCallback((fieldName: string) => {
        return fields[fieldName]?.isValid ?? true;
    }, [fields]);

    return {
        // Data access
        form,
        fields,
        isValid,
        isDirty,
        hasUnsavedChanges,
        errors,
        fieldErrors,
        
        // Field operations
        initializeField,
        updateField,
        updateFieldData,
        updateFields,
        
        // Validation operations
        validateField,
        validateForm,
        setFieldError,
        clearFieldErrors,
        setFormErrors,
        clearFormErrors,
        
        // Form operations
        resetForm,
        submitForm,
        
        // Utilities
        getFieldValue,
        isFieldDirty,
        isFieldValid
    };
}

export default useFormData;
