import React, { useState, useEffect, useCallback, useMemo } from 'react'
import { useField } from '../../contexts/unified-data/v2/hooks/useField'

/**
 * LocalStateFieldWrapper Component (v2)
 * 
 * A wrapper component that manages field state using the v2 UnifiedData context.
 * Provides local state management with context synchronization.
 * 
 * Key Features:
 * - Granular field-level state management
 * - Real-time updates with debouncing
 * - Built-in validation
 * - Performance optimized
 * - Type-safe field operations
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
    }, []) // Only run once on mount

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

    // Handle focus
    const handleFocus = useCallback((e) => {
        // Call original onFocus if provided
        if (fieldProps.onFocus) {
            fieldProps.onFocus(e)
        }
    }, [fieldProps])

    // Enhanced field props
    const enhancedFieldProps = useMemo(() => {
        // Filter out non-DOM props
        const {
            'data-field-name': dataFieldName,
            'data-local-state': dataLocalState,
            isDirty: removedIsDirty,
            isTouched: removedIsTouched,
            isValidating: removedIsValidating,
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

    // Error display
    if (!FieldComponent) {
        return (
            <div className="p-3 border border-red-200 rounded bg-red-50">
                <p className="text-sm text-red-700">
                    Field component not provided for field: {fieldName}
                </p>
            </div>
        )
    }

    return <FieldComponent {...enhancedFieldProps} />
})

LocalStateFieldWrapper.displayName = 'LocalStateFieldWrapper'

export default LocalStateFieldWrapper
