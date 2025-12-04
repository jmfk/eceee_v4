/**
 * LinkField - Form field component for link selection with rich display
 * 
 * Combines LinkDisplay (shows page info with lookup, draft/published status, etc.)
 * with LinkPicker modal for selecting/editing links.
 * 
 * Supports internal pages, external URLs, email, phone, and anchor links.
 */

import React, { useState, useCallback, useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Link, ExternalLink, Loader2, Mail, Phone, Hash, FileText } from 'lucide-react'
import { api } from '../../api/client'
import { endpoints } from '../../api/endpoints'
import LinkPicker from '../LinkPicker'

/**
 * Parse a link value to get the link object
 */
const parseLinkValue = (value) => {
    if (!value) return null
    
    if (typeof value === 'string' && value.startsWith('{')) {
        try {
            return JSON.parse(value)
        } catch {
            return null
        }
    }
    
    if (typeof value === 'object' && value.type) {
        return value
    }
    
    return null
}

/**
 * LinkDisplay - Shows rich link info with page lookup for internal pages
 */
const LinkDisplay = ({ url, onEdit, currentSiteId, disabled }) => {
    const linkObj = useMemo(() => parseLinkValue(url), [url])

    // Fetch page info for internal links
    const { data: pageInfo, isLoading } = useQuery({
        queryKey: ['page-lookup', linkObj?.pageId, currentSiteId],
        queryFn: async () => {
            if (!linkObj?.pageId) return null
            let lookupUrl = `${endpoints.pages.lookup}?id=${linkObj.pageId}`
            if (currentSiteId) {
                lookupUrl += `&currentSiteId=${currentSiteId}`
            }
            const response = await api.get(lookupUrl)
            return response
        },
        enabled: linkObj?.type === 'internal' && !!linkObj?.pageId,
        staleTime: 60000
    })

    // Get display content based on link type
    const getDisplayContent = () => {
        if (!url) {
            return <span className="text-gray-400 italic">No link set</span>
        }

        if (!linkObj) {
            // Plain text URL (legacy format)
            return <span className="truncate">{url}</span>
        }

        switch (linkObj.type) {
            case 'internal':
                if (isLoading) {
                    return (
                        <span className="flex items-center gap-1 text-gray-500">
                            <Loader2 size={12} className="animate-spin" />
                            Loading...
                        </span>
                    )
                }
                if (pageInfo) {
                    const data = pageInfo.data || pageInfo
                    return (
                        <span className="flex items-center gap-1 min-w-0">
                            {pageInfo.site && (
                                <span className="text-purple-600 text-xs flex-shrink-0">[{pageInfo.site.title}]</span>
                            )}
                            {!data.isPublished && (
                                <span className="text-orange-500 text-xs flex-shrink-0">[Draft]</span>
                            )}
                            <span className="truncate font-medium">{data.title}</span>
                            <span className="text-gray-400 text-xs truncate flex-shrink-0">
                                {data.path}
                                {linkObj.anchor && `#${linkObj.anchor}`}
                            </span>
                            {linkObj.targetBlank && (
                                <span className="text-blue-500 text-xs flex-shrink-0" title="Opens in new tab">↗</span>
                            )}
                        </span>
                    )
                }
                return <span className="text-orange-600">Page ID: {linkObj.pageId} (not found)</span>
            case 'external':
                return (
                    <span className="flex items-center gap-1 truncate">
                        <ExternalLink size={12} className="text-gray-400 flex-shrink-0" />
                        {linkObj.url || 'External link'}
                        {linkObj.targetBlank && (
                            <span className="text-blue-500 text-xs flex-shrink-0">↗</span>
                        )}
                    </span>
                )
            case 'email':
                return (
                    <span className="flex items-center gap-1 truncate">
                        <Mail size={12} className="text-gray-400 flex-shrink-0" />
                        {linkObj.address || 'Email link'}
                    </span>
                )
            case 'phone':
                return (
                    <span className="flex items-center gap-1 truncate">
                        <Phone size={12} className="text-gray-400 flex-shrink-0" />
                        {linkObj.number || 'Phone link'}
                    </span>
                )
            case 'anchor':
                return (
                    <span className="flex items-center gap-1 truncate">
                        <Hash size={12} className="text-gray-400 flex-shrink-0" />
                        #{linkObj.anchor || ''}
                    </span>
                )
            default:
                return <span className="truncate">{url}</span>
        }
    }

    const handleOpenPage = (e) => {
        e.stopPropagation()
        if (linkObj?.type === 'internal' && linkObj?.pageId) {
            window.open(`/pages/${linkObj.pageId}/edit`, '_blank')
        }
    }

    const handleEdit = (e) => {
        e.preventDefault()
        e.stopPropagation()
        if (!disabled) {
            onEdit()
        }
    }

    // Get icon based on link type
    const getIcon = () => {
        if (!linkObj) return Link
        switch (linkObj.type) {
            case 'internal': return FileText
            case 'external': return ExternalLink
            case 'email': return Mail
            case 'phone': return Phone
            case 'anchor': return Hash
            default: return Link
        }
    }

    const IconComponent = getIcon()

    return (
        <div className="flex items-center gap-1 min-w-0 flex-1">
            <IconComponent size={14} className="text-gray-400 flex-shrink-0" />
            <button
                type="button"
                onClick={handleEdit}
                disabled={disabled}
                className={`flex-1 min-w-0 text-left text-sm truncate ${
                    disabled 
                        ? 'text-gray-500 cursor-not-allowed' 
                        : 'text-gray-700 hover:text-blue-600'
                }`}
            >
                {getDisplayContent()}
            </button>
            {linkObj?.type === 'internal' && linkObj?.pageId && !disabled && (
                <button
                    type="button"
                    onClick={handleOpenPage}
                    className="p-1 text-gray-400 hover:text-blue-600 flex-shrink-0"
                    title="Open page in new tab"
                >
                    <ExternalLink size={14} />
                </button>
            )}
        </div>
    )
}

/**
 * LinkField - Complete form field with display and picker
 * 
 * Supports both controlled (value prop) and uncontrolled (defaultValue prop) modes.
 * In uncontrolled mode, maintains internal state like native inputs.
 */
const LinkField = ({
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
    currentSiteId,
    context = {},
    ...props
}) => {
    // Internal state for uncontrolled mode - initialized from defaultValue
    // This mirrors how native uncontrolled inputs work
    const [internalValue, setInternalValue] = useState(defaultValue)
    
    const [isPickerOpen, setIsPickerOpen] = useState(false)
    
    // Use controlled value if provided, otherwise internal state
    const currentValue = value !== undefined ? value : internalValue
    
    // Get context from props or context object
    const pageId = currentPageId || context?.pageId || null
    const siteRootId = currentSiteRootId || context?.siteRootId || context?.webpageData?.cachedRootId || null
    const siteId = currentSiteId || context?.siteId || context?.webpageData?.cachedRootId || null
    
    // Handle LinkPicker save
    const handleSave = useCallback((result) => {
        let newValue = ''
        if (result.action === 'remove') {
            newValue = ''
        } else if (result.action === 'insert' && result.link) {
            // Store as JSON string
            newValue = JSON.stringify(result.link)
        }
        // Update internal state for immediate display
        setInternalValue(newValue)
        // Notify parent
        onChange(newValue)
        setIsPickerOpen(false)
    }, [onChange])
    
    // Handle clear
    const handleClear = useCallback((e) => {
        e.stopPropagation()
        setInternalValue('')
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
            
            <div
                className={`
                    w-full flex items-center gap-2 px-3 py-2 text-sm
                    border rounded-md transition-colors
                    ${disabled 
                        ? 'bg-gray-100 border-gray-200 cursor-not-allowed' 
                        : 'bg-white border-gray-300 hover:border-gray-400'
                    }
                    ${hasError ? 'border-red-500' : ''}
                `}
            >
                <LinkDisplay
                    url={currentValue}
                    onEdit={() => !disabled && setIsPickerOpen(true)}
                    currentSiteId={siteId}
                    disabled={disabled}
                />
                {currentValue && !disabled && (
                    <button
                        type="button"
                        onClick={handleClear}
                        className="p-1 hover:bg-gray-200 rounded text-gray-400 hover:text-gray-600 flex-shrink-0"
                        title="Clear link"
                    >
                        ×
                    </button>
                )}
            </div>
            
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

LinkField.displayName = 'LinkField'

// Export LinkDisplay separately for use in custom editors
export { LinkDisplay }

export default LinkField

