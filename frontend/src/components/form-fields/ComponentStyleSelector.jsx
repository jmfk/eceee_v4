import React, { useState, useEffect, useMemo } from 'react'
import ValidatedInput from '../validation/ValidatedInput'

/**
 * ComponentStyleSelector Component
 * 
 * Dropdown for selecting component styles from the current page theme.
 * Fetches available component styles from theme.component_styles.
 */
const ComponentStyleSelector = ({
    value,
    defaultValue,
    onChange,
    validation,
    isValidating,
    label = "Component Style",
    description = "Select a style template for this widget",
    required,
    disabled,
    placeholder = 'Default (No Style)',
    // Custom props
    context,
    formData,
    pageTheme, // Optional: directly provided theme
    type: schemaType,
    ...props
}) => {
    const [componentStyles, setComponentStyles] = useState({})
    const [loading, setLoading] = useState(false)

    // Fetch component styles from theme
    useEffect(() => {
        fetchComponentStyles()
    }, [pageTheme, context])

    const fetchComponentStyles = async () => {
        try {
            setLoading(true)
            
            // Try to get theme from various sources (in order of priority)
            let theme = pageTheme
            
            // Try context.theme (from widget editing context)
            if (!theme && context?.theme) {
                theme = context.theme
            }
            
            // Try context.pageVersionData.effectiveTheme (fallback)
            if (!theme && context?.pageVersionData?.effectiveTheme) {
                theme = context.pageVersionData.effectiveTheme
            }
            
            // Try context.pageData.theme (legacy)
            if (!theme && context?.pageData?.theme) {
                theme = context.pageData.theme
            }
            
            // Get component styles from theme (handle both camelCase and snake_case)
            if (theme && theme.componentStyles) {
                setComponentStyles(theme.componentStyles || {})
            } else if (theme && theme.component_styles) {
                setComponentStyles(theme.component_styles || {})
            } else {
                // No theme available
                setComponentStyles({})
            }
        } catch (error) {
            console.error('Failed to load component styles:', error)
            setComponentStyles({})
        } finally {
            setLoading(false)
        }
    }

    // Convert component styles object to options array
    const options = useMemo(() => {
        const styleOptions = Object.entries(componentStyles).map(([key, style]) => ({
            value: key,
            label: style.name || key,
            description: style.description || ''
        }))
        
        // Add default option at the top
        return [
            { value: 'default', label: 'Default (No Style)', description: 'Use widget default rendering' },
            ...styleOptions
        ]
    }, [componentStyles])

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
        inputProps.value = value || 'default'
    } else if (defaultValue !== undefined) {
        inputProps.defaultValue = defaultValue || 'default'
    } else {
        inputProps.defaultValue = 'default'
    }

    return (
        <ValidatedInput {...inputProps}>
            {loading ? (
                <option disabled>Loading styles...</option>
            ) : (
                options.map((option) => (
                    <option key={option.value} value={option.value} title={option.description}>
                        {option.label}
                    </option>
                ))
            )}
        </ValidatedInput>
    )
}

ComponentStyleSelector.displayName = 'ComponentStyleSelector'

export default ComponentStyleSelector

