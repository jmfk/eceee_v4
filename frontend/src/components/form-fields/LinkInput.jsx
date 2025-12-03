/**
 * LinkInput - Form field component for link selection using LinkPicker
 * 
 * Displays a button that opens the LinkPicker modal for selecting
 * internal pages, external URLs, email, phone, or anchor links.
 */

import React, { useState, useCallback, useMemo } from 'react'
import { Link, ExternalLink, Mail, Phone, Hash, FileText } from 'lucide-react'
import LinkPicker from '../LinkPicker'

/**
 * Parse a link value to get display information
 */
const parseLinkValue = (value) => {
    if (!value) return { type: 'empty', display: 'No link set' }
    
    // Try to parse as JSON link object
    if (typeof value === 'string' && value.startsWith('{')) {
        try {
            const linkObj = JSON.parse(value)
            return parseLinkObject(linkObj)
        } catch {
            // Not valid JSON, treat as plain URL
        }
    }
    
    // Object
    if (typeof value === 'object' && value.type) {
        return parseLinkObject(value)
    }
    
    // Plain URL string
    return { type: 'url', display: value, icon: ExternalLink }
}

const parseLinkObject = (linkObj) => {
    switch (linkObj.type) {
        case 'internal':
            return {
                type: 'internal',
                display: `Page ID: ${linkObj.pageId}${linkObj.anchor ? ` #${linkObj.anchor}` : ''}`,
                icon: FileText
            }
        case 'external':
            return {
                type: 'external',
                display: linkObj.url || 'External link',
                icon: ExternalLink
            }
        case 'email':
            return {
                type: 'email',
                display: linkObj.address || 'Email link',
                icon: Mail
            }
        case 'phone':
            return {
                type: 'phone',
                display: linkObj.number || 'Phone link',
                icon: Phone
            }
        case 'anchor':
            return {
                type: 'anchor',
                display: `#${linkObj.anchor || ''}`,
                icon: Hash
            }
        default:
            return {
                type: 'unknown',
                display: JSON.stringify(linkObj),
                icon: Link
            }
    }
}

const LinkInput = ({
    value,
    defaultValue,
    onChange,
    label,
    description,
    required,
    disabled,
    placeholder = 'Select a link...',
    validation,
    // Context for LinkPicker
    currentPageId,
    currentSiteRootId,
    context = {},
    ...props
}) => {
    // Use value or defaultValue
    const currentValue = value !== undefined ? value : defaultValue
    
    const [isPickerOpen, setIsPickerOpen] = useState(false)
    
    // Get page context from props or context object
    const pageId = currentPageId || context?.pageId || null
    const siteRootId = currentSiteRootId || context?.siteRootId || context?.webpageData?.cachedRootId || null
    
    // Parse current value for display
    const linkInfo = useMemo(() => parseLinkValue(currentValue), [currentValue])
    const IconComponent = linkInfo.icon || Link
    
    // Handle LinkPicker save
    const handleSave = useCallback((result) => {
        if (result.action === 'remove') {
            onChange('')
        } else if (result.action === 'insert' && result.link) {
            // Store as JSON string
            onChange(JSON.stringify(result.link))
        }
        setIsPickerOpen(false)
    }, [onChange])
    
    // Handle clear
    const handleClear = useCallback((e) => {
        e.stopPropagation()
        onChange('')
    }, [onChange])
    
    const hasError = validation && !validation.isValid
    
    return (
        <div className="space-y-1">
            {label && (
                <label className="block text-sm font-medium text-gray-700">
                    {label}
                    {required && <span className="text-red-500 ml-1">*</span>}
                </label>
            )}
            
            <button
                type="button"
                onClick={() => !disabled && setIsPickerOpen(true)}
                disabled={disabled}
                className={`
                    w-full flex items-center gap-2 px-3 py-2 text-sm text-left
                    border rounded-md transition-colors
                    ${disabled 
                        ? 'bg-gray-100 text-gray-500 cursor-not-allowed border-gray-200' 
                        : 'bg-white hover:bg-gray-50 border-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500'
                    }
                    ${hasError ? 'border-red-500' : ''}
                `}
            >
                <IconComponent size={16} className="text-gray-400 flex-shrink-0" />
                <span className={`flex-1 truncate ${linkInfo.type === 'empty' ? 'text-gray-400' : 'text-gray-700'}`}>
                    {linkInfo.display}
                </span>
                {currentValue && !disabled && (
                    <button
                        type="button"
                        onClick={handleClear}
                        className="p-1 hover:bg-gray-200 rounded text-gray-400 hover:text-gray-600"
                        title="Clear link"
                    >
                        ×
                    </button>
                )}
            </button>
            
            {description && !hasError && (
                <p className="text-xs text-gray-500">{description}</p>
            )}
            
            {hasError && validation.errors && (
                <p className="text-xs text-red-500">
                    {validation.errors.join(', ')}
                </p>
            )}
            
            {/* LinkPicker Modal */}
            <LinkPicker
                isOpen={isPickerOpen}
                onClose={() => setIsPickerOpen(false)}
                onSave={handleSave}
                initialLink={currentValue}
                initialText=""
                currentPageId={pageId}
                currentSiteRootId={siteRootId}
                showRemoveButton={!!currentValue}
            />
        </div>
    )
}

LinkInput.displayName = 'LinkInput'

export default LinkInput

