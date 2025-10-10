import React, { useState, useEffect, useMemo } from 'react'
import ValidatedInput from '../validation/ValidatedInput'
import { valueListsApi } from '../../api/valueLists'
import { executeOptionsFunction, hasOptionsFunction } from '../../utils/optionsFunctions'

/**
 * SelectInput Component
 * 
 * Dropdown selection field component that integrates with the validation system.
 * Supports single selection from a list of options.
 * Supports both controlled (value) and uncontrolled (defaultValue) modes.
 */
const SelectInput = ({
    value,
    defaultValue,
    onChange,
    validation,
    isValidating,
    label,
    description,
    required,
    disabled,
    placeholder = 'Select an option...',
    options = [],
    valueListName = null, // Name of value list to load options from
    optionsFunction = null, // Name of function to generate options dynamically
    // Custom props that shouldn't be spread to DOM or override component behavior
    context,
    formData,
    type: schemaType, // Don't let schema type override input type
    ...props
}) => {
    const [valueListOptions, setValueListOptions] = useState([])
    const [loadingValueList, setLoadingValueList] = useState(false)

    // Execute options function if provided
    const functionOptions = useMemo(() => {
        if (optionsFunction && hasOptionsFunction(optionsFunction)) {
            return executeOptionsFunction(optionsFunction, context, formData)
        }
        return []
    }, [optionsFunction, context, formData])

    // Load value list options if valueListName is provided
    useEffect(() => {
        if (valueListName) {
            loadValueListOptions()
        }
    }, [valueListName])

    const loadValueListOptions = async () => {
        try {
            setLoadingValueList(true)
            const response = await valueListsApi.getForFields()
            const valueList = response.value_lists?.find(vl => vl.slug === valueListName)

            if (valueList) {
                setValueListOptions(valueList.items || [])
            } else {
                console.warn(`Value list '${valueListName}' not found`)
                setValueListOptions([])
            }
        } catch (error) {
            console.error('Failed to load value list options:', error)
            setValueListOptions([])
        } finally {
            setLoadingValueList(false)
        }
    }

    // Handle both array of strings and array of objects
    const normalizeOptions = (opts) => {
        if (!Array.isArray(opts)) return []

        return opts.map(option => {
            if (typeof option === 'string') {
                return { value: option, label: option }
            }
            if (typeof option === 'object' && option.value !== undefined) {
                return { value: option.value, label: option.label || option.value }
            }
            return { value: String(option), label: String(option) }
        })
    }

    // Priority: optionsFunction > valueList > static options
    const effectiveOptions = functionOptions.length > 0
        ? functionOptions
        : (valueListName && valueListOptions.length > 0 ? valueListOptions : options)
    const normalizedOptions = normalizeOptions(effectiveOptions)

    // Build props for ValidatedInput
    const inputProps = {
        type: "select",
        onChange,
        validation,
        isValidating,
        label,
        description,
        required,
        disabled,
        ...props
    }

    // Add either value or defaultValue, but never both
    if (value !== undefined) {
        inputProps.value = value || ''
    } else if (defaultValue !== undefined) {
        inputProps.defaultValue = defaultValue
    }

    return (
        <ValidatedInput {...inputProps}>
            {!required && (
                <option value="">{loadingValueList ? 'Loading...' : placeholder}</option>
            )}
            {loadingValueList ? (
                <option disabled>Loading options...</option>
            ) : (
                normalizedOptions.map((option, index) => (
                    <option key={`${option.value}-${index}`} value={option.value}>
                        {option.label}
                    </option>
                ))
            )}
        </ValidatedInput>
    )
}

SelectInput.displayName = 'SelectInput'

export default SelectInput
