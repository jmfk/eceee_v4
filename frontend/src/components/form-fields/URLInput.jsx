import React from 'react'
import ValidatedInput from '../validation/ValidatedInput'
import { Link, ExternalLink } from 'lucide-react'

/**
 * URLInput Component
 * 
 * URL input field component with built-in URL validation.
 * Includes visual link icon and optional link preview.
 */
const URLInput = ({
    value,
    onChange,
    validation,
    isValidating,
    label,
    description,
    required,
    disabled,
    placeholder = 'https://example.com',
    showPreview = false,
    ...props
}) => {
    const isValidUrl = (url) => {
        try {
            new URL(url)
            return true
        } catch {
            return false
        }
    }

    const handleOpenLink = () => {
        if (value && isValidUrl(value)) {
            window.open(value, '_blank', 'noopener,noreferrer')
        }
    }

    return (
        <div className="space-y-1">
            {label && (
                <label className="block text-sm font-medium text-gray-700">
                    {label}
                    {required && <span className="text-red-500 ml-1">*</span>}
                </label>
            )}

            <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <Link className="h-4 w-4 text-gray-400" />
                </div>

                <ValidatedInput
                    type="url"
                    value={value || ''}
                    onChange={onChange}
                    validation={validation}
                    isValidating={isValidating}
                    disabled={disabled}
                    placeholder={placeholder}
                    className={`pl-10 ${value && isValidUrl(value) ? 'pr-10' : ''}`}
                    {...props}
                />

                {value && isValidUrl(value) && (
                    <div className="absolute inset-y-0 right-0 pr-3 flex items-center">
                        <button
                            type="button"
                            onClick={handleOpenLink}
                            className="text-gray-400 hover:text-blue-600 transition-colors"
                            title="Open link in new tab"
                        >
                            <ExternalLink className="h-4 w-4" />
                        </button>
                    </div>
                )}
            </div>

            {description && (
                <p className="text-sm text-gray-500">{description}</p>
            )}

            {showPreview && value && isValidUrl(value) && (
                <div className="mt-2 p-2 bg-gray-50 border border-gray-200 rounded text-sm">
                    <span className="text-gray-600">Preview: </span>
                    <a
                        href={value}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-blue-600 hover:text-blue-800 underline"
                    >
                        {value}
                    </a>
                </div>
            )}
        </div>
    )
}

URLInput.displayName = 'URLInput'

export default URLInput
