import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react'

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
    ...wrapperProps
}) => {
    // Local state for this field only
    const [localValue, setLocalValue] = useState(initialValue)
    const [validation, setValidation] = useState(null)
    const [isValidating, setIsValidating] = useState(false)
    const [isDirty, setIsDirty] = useState(false)
    const [isTouched, setIsTouched] = useState(false)

    // Refs to prevent re-renders and manage timeouts
    const debounceTimeoutRef = useRef(null)
    const validationTimeoutRef = useRef(null)
    const initializedRef = useRef(false)
    const lastSentValueRef = useRef(initialValue)

    // Initialize local value when initialValue changes (e.g., form reset)
    useEffect(() => {
        if (!initializedRef.current || initialValue !== lastSentValueRef.current) {
            setLocalValue(initialValue)
            setIsDirty(false)
            lastSentValueRef.current = initialValue
            initializedRef.current = true
        }
    }, [initialValue])

    // Debounced function to notify parent of changes
    const notifyParentChange = useCallback((value) => {
        if (debounceTimeoutRef.current) {
            clearTimeout(debounceTimeoutRef.current)
        }
        debounceTimeoutRef.current = setTimeout(() => {
            if (onFieldChange && value !== lastSentValueRef.current) {
                onFieldChange(fieldName, value)
                lastSentValueRef.current = value
            }
        }, debounceMs)
    }, [fieldName, onFieldChange, debounceMs])

    // Debounced validation function
    const validateField = useCallback(async (value) => {
        if (!validateOnChange && !validateOnBlur) return

        if (validationTimeoutRef.current) {
            clearTimeout(validationTimeoutRef.current)
        }

        setIsValidating(true)

        validationTimeoutRef.current = setTimeout(async () => {
            try {
                // If parent provides validation function, use it
                if (onFieldValidation) {
                    const result = await onFieldValidation(fieldName, value)
                    setValidation(result)
                } else {
                    // Basic client-side validation
                    const isRequired = fieldProps.required || wrapperProps.required
                    const isEmpty = !value || (typeof value === 'string' && value.trim() === '')

                    if (isRequired && isEmpty) {
                        setValidation({
                            isValid: false,
                            errors: [`${fieldProps.label || fieldName} is required`],
                            warnings: []
                        })
                    } else {
                        setValidation({
                            isValid: true,
                            errors: [],
                            warnings: []
                        })
                    }
                }
            } catch (error) {
                console.error(`Validation error for field ${fieldName}:`, error)
                setValidation({
                    isValid: false,
                    errors: ['Validation failed'],
                    warnings: []
                })
            } finally {
                setIsValidating(false)
            }
        }, 150) // Shorter timeout for validation
    }, [fieldName, onFieldValidation, validateOnChange, validateOnBlur, fieldProps, wrapperProps])

    // Handle field value changes
    const handleChange = useCallback((newValue) => {
        setLocalValue(newValue)
        setIsDirty(true)

        // Immediately notify parent for real-time updates
        notifyParentChange(newValue)

        // Validate if enabled
        if (validateOnChange) {
            validateField(newValue)
        }
    }, [notifyParentChange, validateOnChange, validateField])

    // Handle field blur events
    const handleBlur = useCallback((e) => {
        setIsTouched(true)

        // Validate on blur if enabled
        if (validateOnBlur && !validateOnChange) {
            validateField(localValue)
        }

        // Call original onBlur if provided
        if (fieldProps.onBlur) {
            fieldProps.onBlur(e)
        }
    }, [validateOnBlur, validateOnChange, validateField, localValue, fieldProps])

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
            validation,
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
        validation,
        isValidating,
        isDirty,
        isTouched,
        fieldName
    ])

    // Cleanup timeouts on unmount
    useEffect(() => {
        return () => {
            if (debounceTimeoutRef.current) {
                clearTimeout(debounceTimeoutRef.current)
            }
            if (validationTimeoutRef.current) {
                clearTimeout(validationTimeoutRef.current)
            }
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
