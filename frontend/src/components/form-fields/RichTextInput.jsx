import React from 'react'
import { AlertCircle } from 'lucide-react'

/**
 * RichTextInput Component
 * 
 * Rich text editor component for formatted text input.
 * Currently a placeholder that renders as a textarea until a proper
 * rich text editor is integrated.
 */
const RichTextInput = ({
    value,
    onChange,
    validation,
    isValidating,
    label,
    description,
    required,
    disabled,
    placeholder,
    rows = 6,
    toolbar = 'basic',
    ...props
}) => {
    // Get validation status for styling
    const getValidationStatus = () => {
        if (isValidating) return 'validating'
        if (!validation) return 'none'
        if (validation.errors?.length > 0) return 'error'
        if (validation.warnings?.length > 0) return 'warning'
        return 'valid'
    }

    const validationStatus = getValidationStatus()
    const hasError = validationStatus === 'error'
    const hasWarning = validationStatus === 'warning'

    const handleChange = (e) => {
        onChange(e.target.value)
    }

    return (
        <div className="space-y-2">
            {/* Label */}
            {label && (
                <label className="block text-sm font-medium text-gray-700">
                    {label}
                    {required && <span className="text-red-500 ml-1">*</span>}
                </label>
            )}

            {/* Description */}
            {description && (
                <p className="text-sm text-gray-500">{description}</p>
            )}

            {/* Rich Text Editor Placeholder */}
            <div className="relative">
                {/* TODO: Replace with proper rich text editor like TinyMCE, Quill, or similar */}
                <div className="mb-2 p-2 bg-yellow-50 border border-yellow-200 rounded-md flex items-center space-x-2">
                    <AlertCircle className="w-4 h-4 text-yellow-600" />
                    <span className="text-xs text-yellow-700">
                        Rich text editor not yet implemented - using textarea
                    </span>
                </div>

                <textarea
                    value={value || ''}
                    onChange={handleChange}
                    disabled={disabled}
                    placeholder={placeholder || 'Enter rich text content...'}
                    rows={rows}
                    className={`
                        w-full px-3 py-2 border rounded-md resize-y
                        focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent
                        disabled:bg-gray-50 disabled:text-gray-500 disabled:cursor-not-allowed
                        ${hasError ? 'border-red-300 bg-red-50' :
                            hasWarning ? 'border-yellow-300 bg-yellow-50' :
                                'border-gray-300 bg-white'}
                        ${isValidating ? 'animate-pulse' : ''}
                    `}
                    {...props}
                />
            </div>

            {/* Validation Messages */}
            {hasError && validation.errors?.map((error, index) => (
                <p key={index} className="text-sm text-red-600 flex items-center space-x-1">
                    <AlertCircle className="w-4 h-4" />
                    <span>{error}</span>
                </p>
            ))}

            {hasWarning && validation.warnings?.map((warning, index) => (
                <p key={index} className="text-sm text-yellow-600 flex items-center space-x-1">
                    <AlertCircle className="w-4 h-4" />
                    <span>{warning}</span>
                </p>
            ))}

            {/* Loading State */}
            {isValidating && (
                <p className="text-sm text-blue-600">Validating...</p>
            )}
        </div>
    )
}

RichTextInput.displayName = 'RichTextInput'

export default RichTextInput
