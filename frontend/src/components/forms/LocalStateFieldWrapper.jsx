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
 * - Synchronous updates to the save buffer; debounced validation
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
    validateOnChange = true,
    validateOnBlur = true,
    context = null,
    ...wrapperProps
}) => {
    // Local state for this field only
    const [localValue, setLocalValue] = useState(initialValue)
    const [validation, setValidation] = useState(null)
    const [isValidating, setIsValidating] = useState(false)
    const [isDirty, setIsDirty] = useState(false)
    const [isTouched, setIsTouched] = useState(false)

    const validationTimeoutRef = useRef(null)
    const validationGenerationRef = useRef(0)
    const currentValueRef = useRef(initialValue)

    useEffect(() => {
        if (initialValue !== currentValueRef.current) {
            validationGenerationRef.current += 1
            clearTimeout(validationTimeoutRef.current)
            setValidation(null)
            setIsValidating(false)
            currentValueRef.current = initialValue
            setLocalValue(initialValue)
            setIsDirty(false)
        }
    }, [initialValue])

    // Debounced validation function
    const validateField = useCallback(async (value) => {
        if (!validateOnChange && !validateOnBlur) return

        if (validationTimeoutRef.current) {
            clearTimeout(validationTimeoutRef.current)
        }

        const generation = ++validationGenerationRef.current
        setIsValidating(true)

        validationTimeoutRef.current = setTimeout(async () => {
            try {
                // If parent provides validation function, use it
                if (onFieldValidation) {
                    const result = await onFieldValidation(fieldName, value)
                    if (generation === validationGenerationRef.current) setValidation(result)
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
                if (generation !== validationGenerationRef.current) return
                console.error(`Validation error for field ${fieldName}:`, error)
                setValidation({
                    isValid: false,
                    errors: ['Validation failed'],
                    warnings: []
                })
            } finally {
                if (generation === validationGenerationRef.current) setIsValidating(false)
            }
        }, 150) // Shorter timeout for validation
    }, [fieldName, onFieldValidation, validateOnChange, validateOnBlur, fieldProps, wrapperProps])

    // Handle field value changes
    const handleChange = useCallback((newValue) => {
        setLocalValue(newValue)
        setIsDirty(true)
        
        currentValueRef.current = newValue
        // Save and dirty tracking must see the keystroke before this handler returns.
        onFieldChange?.(fieldName, newValue)

        // Validate if enabled
        if (validateOnChange) {
            validateField(newValue)
        }
    }, [onFieldChange, validateOnChange, validateField, fieldName])

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
        // Always use localValue for the value prop - this ensures user input works
        // For external updates, we update DOM directly in useEffect, but still need state for controlled component
        
        // Filter out non-DOM props that shouldn't be passed to HTML elements
        const {
            // Remove metadata props
            'data-field-name': dataFieldName,
            'data-local-state': dataLocalState,
            // Remove local state management props that shouldn't reach DOM
            isDirty: removedIsDirty,
            isTouched: removedIsTouched,
            isValidating: removedIsValidating,
            // Preserve context and fieldName for components that need them
            context,
            fieldName: extractedFieldName,
            // Keep the rest
            ...componentProps
        } = {
            ...fieldProps,
            value: localValue, // Always use localValue - don't use ref
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
        
        // Pass context and fieldName to components that need them (like ItemsListField)
        return { ...componentProps, context, fieldName: extractedFieldName }
    }, [
        fieldProps,
        localValue, // Use localValue in dependencies
        handleChange,
        handleBlur,
        handleFocus,
        validation,
        isValidating,
        isDirty,
        isTouched,
        fieldName,
        context
    ])

    // Cleanup timeouts on unmount
    useEffect(() => {
        return () => {
            validationGenerationRef.current += 1
            if (validationTimeoutRef.current) {
                clearTimeout(validationTimeoutRef.current)
            }
        }
    }, [])

    // Render the field component with enhanced props
    if (!FieldComponent) {
        return (
            <div className="p-3 border border-red-200 rounded bg-red-50">
                <div className="text-sm text-red-700">
                    Field component not provided for field: {fieldName}
                </div>
            </div>
        )
    }

    return (
        <FieldComponent {...enhancedFieldProps} />
    )
})

LocalStateFieldWrapper.displayName = 'LocalStateFieldWrapper'

export default LocalStateFieldWrapper
