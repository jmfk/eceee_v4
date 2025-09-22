import React, { useState, useEffect, useCallback, useMemo } from 'react'
import { useField } from '../../contexts/unified-data/v2/hooks/useField'

/**
 * LocalStateFieldWrapper Component
 * 
 * A wrapper component that manages local state for form fields independently.
 * This prevents parent re-renders when field values change and only communicates
 * changes back to the parent form when needed for serialization.
 * 
 * Key Features:
 * - Local state management for each field
 * - Debounced updates to parent form
 * - Validation state isolation
 * - Memoized to prevent unnecessary re-renders
 * - Ref-based parent communication to avoid prop drilling
 */
const LocalStateFieldWrapper = React.memo(({
    fieldName,
    initialValue = '',
    FieldComponent,
    fieldProps = {},
    onFieldChange,
    onFieldValidation,
    debounceMs = 300,
    validateOnChange = true,
    validateOnBlur = true,
    formId = null,
    ...wrapperProps
}) => {
    // Use unified field hook
    const {
        value: contextValue,
        setValue,
        isDirty,
        isTouched,
        isValid,
        errors,
        isValidating,
        validate,
        handleBlur: handleFieldBlur,
        reset
    } = useField(formId ? `form.${formId}.${fieldName}` : fieldName, {
        debounceTime: debounceMs,
        validateOnChange,
        validate: onFieldValidation,
        transformValue: wrapperProps.transformValue
    })

    // Local state for immediate updates
    const [localValue, setLocalValue] = useState(initialValue)

    // Sync with context value
    useEffect(() => {
        if (contextValue !== undefined && contextValue !== localValue) {
            setLocalValue(contextValue)
        }
    }, [contextValue])

    // Initialize with initial value
    useEffect(() => {
        if (initialValue !== undefined && initialValue !== contextValue) {
            setValue(initialValue)
        }
    }, [initialValue, contextValue, setValue]) // Add proper dependencies

    // Handle value changes
    const handleChange = useCallback((newValue) => {
        // Update local state immediately
        setLocalValue(newValue)

        // Update context (debounced)
        setValue(newValue)

        // Notify parent if needed
        if (onFieldChange) {
            onFieldChange(fieldName, newValue)
        }
    }, [fieldName, setValue, onFieldChange])

    // Handle blur
    const handleBlur = useCallback((e) => {
        // Handle context blur
        handleFieldBlur()

        // Call original onBlur if provided
        if (fieldProps.onBlur) {
            fieldProps.onBlur(e)
        }
    }, [handleFieldBlur, fieldProps])

    // Handle field focus events
    const handleFocus = useCallback((e) => {
        // Call original onFocus if provided
        if (fieldProps.onFocus) {
            fieldProps.onFocus(e)
        }
    }, [fieldProps])

    // Memoize the enhanced field props to prevent unnecessary re-renders
    const enhancedFieldProps = useMemo(() => {
        // Filter out non-DOM props that shouldn't be passed to HTML elements
        const {
            // Remove metadata props
            'data-field-name': dataFieldName,
            'data-local-state': dataLocalState,
            // Remove local state management props that shouldn't reach DOM
            isDirty: removedIsDirty,
            isTouched: removedIsTouched,
            isValidating: removedIsValidating,
            // Keep the rest
            ...componentProps
        } = {
            ...fieldProps,
            value: localValue,
            onChange: handleChange,
            onBlur: handleBlur,
            onFocus: handleFocus,
            validation: {
                isValid,
                errors,
                warnings: []
            },
            isValidating,
            isDirty,
            isTouched,
            // Add metadata for debugging (these will be filtered out above)
            'data-field-name': fieldName,
            'data-local-state': true
        }

        return componentProps
    }, [
        fieldProps,
        localValue,
        handleChange,
        handleBlur,
        handleFocus,
        isValid,
        errors,
        isValidating,
        isDirty,
        isTouched,
        fieldName
    ])

    // Cleanup on unmount
    useEffect(() => {
        return () => {
            // Cleanup is now handled by useField hook
        }
    }, [])
    // Render the field component with enhanced props
    if (!FieldComponent) {
        return (
            <div className="p-3 border border-red-200 rounded bg-red-50">
                <p className="text-sm text-red-700">
                    Field component not provided for field: {fieldName}
                </p>
            </div>
        )
    }


    return (
        <FieldComponent {...enhancedFieldProps} />
    )
})

LocalStateFieldWrapper.displayName = 'LocalStateFieldWrapper'

export default LocalStateFieldWrapper
