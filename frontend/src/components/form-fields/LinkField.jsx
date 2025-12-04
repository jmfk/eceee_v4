/**
 * LinkField - Consolidated form field for menu item links
 * 
 * Stores all link data in a single JSON object:
 * - type, pageId/url/address/number/anchor (link target)
 * - label (display text)
 * - isActive (whether item is visible)
 * - targetBlank (open in new tab)
 * 
 * Used by NavigationWidget and NavbarWidget for menu items.
 */

import React, { useState, useCallback, useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Link, ExternalLink, Loader2, Mail, Phone, Hash, FileText, ToggleLeft, ToggleRight } from 'lucide-react'
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
 * Build a complete link object with all fields
 */
const buildLinkObject = (linkData, label, isActive, targetBlank) => {
    if (!linkData) return null
    
    return {
        ...linkData,
        label: label || '',
        isActive: isActive !== false,
        targetBlank: targetBlank || false
    }
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
                        </span>
                    )
                }
                return <span className="text-orange-600">Page ID: {linkObj.pageId} (not found)</span>
            case 'external':
                return (
                    <span className="flex items-center gap-1 truncate">
                        <ExternalLink size={12} className="text-gray-400 flex-shrink-0" />
                        {linkObj.url || 'External link'}
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
 * Toggle Switch Component
 */
const Toggle = ({ checked, onChange, disabled, label }) => {
    return (
        <label className={`flex items-center gap-2 cursor-pointer ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}>
            <button
                type="button"
                role="switch"
                aria-checked={checked}
                disabled={disabled}
                onClick={() => !disabled && onChange(!checked)}
                className={`
                    relative inline-flex h-5 w-9 flex-shrink-0 rounded-full border-2 border-transparent 
                    transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-1
                    ${checked ? 'bg-blue-600' : 'bg-gray-300'}
                    ${disabled ? 'cursor-not-allowed' : 'cursor-pointer'}
                `}
            >
                <span
                    className={`
                        pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow ring-0 
                        transition duration-200 ease-in-out
                        ${checked ? 'translate-x-4' : 'translate-x-0'}
                    `}
                />
            </button>
            {label && <span className="text-xs text-gray-600">{label}</span>}
        </label>
    )
}

/**
 * LinkField - Complete form field with label, link picker, and toggles
 * 
 * Stores all data in a single JSON object:
 * { type, pageId/url/..., label, isActive, targetBlank }
 */
const LinkField = ({
    value,
    defaultValue,
    onChange,
    label: fieldLabel,
    description,
    required,
    disabled,
    placeholder = 'Select a link...',
    validation,
    // Options to hide specific controls
    showLabel = true,
    showIsActive = true,
    showTargetBlank = true,
    labelPlaceholder = 'Label',
    // Context for LinkPicker
    currentPageId,
    currentSiteRootId,
    currentSiteId,
    context = {},
    ...props
}) => {
    // Internal state for uncontrolled mode
    const [internalValue, setInternalValue] = useState(() => {
        const parsed = parseLinkValue(defaultValue)
        return parsed ? JSON.stringify(parsed) : ''
    })
    
    const [isPickerOpen, setIsPickerOpen] = useState(false)
    
    // Use controlled value if provided, otherwise internal state
    const currentValueStr = value !== undefined ? value : internalValue
    const currentValue = useMemo(() => parseLinkValue(currentValueStr), [currentValueStr])
    
    // Extract fields from current value
    const itemLabel = currentValue?.label || ''
    const isActive = currentValue?.isActive !== false
    const targetBlank = currentValue?.targetBlank || false
    
    // Get context from props or context object
    const pageId = currentPageId || context?.pageId || null
    const siteRootId = currentSiteRootId || context?.siteRootId || context?.webpageData?.cachedRootId || null
    const siteId = currentSiteId || context?.siteId || context?.webpageData?.cachedRootId || null
    
    // Update the full link object
    const updateValue = useCallback((updates) => {
        const newObj = {
            ...(currentValue || {}),
            ...updates
        }
        
        // Only create object if we have link data
        if (!newObj.type && !updates.type) {
            // No link data yet, just store label/isActive/targetBlank
            const partialObj = {
                label: updates.label !== undefined ? updates.label : itemLabel,
                isActive: updates.isActive !== undefined ? updates.isActive : isActive,
                targetBlank: updates.targetBlank !== undefined ? updates.targetBlank : targetBlank
            }
            const newStr = JSON.stringify(partialObj)
            setInternalValue(newStr)
            onChange(newStr)
            return
        }
        
        const newStr = JSON.stringify(newObj)
        setInternalValue(newStr)
        onChange(newStr)
    }, [currentValue, itemLabel, isActive, targetBlank, onChange])
    
    // Handle label change
    const handleLabelChange = useCallback((e) => {
        updateValue({ label: e.target.value })
    }, [updateValue])
    
    // Handle isActive toggle
    const handleIsActiveChange = useCallback((newValue) => {
        updateValue({ isActive: newValue })
    }, [updateValue])
    
    // Handle targetBlank toggle
    const handleTargetBlankChange = useCallback((newValue) => {
        updateValue({ targetBlank: newValue })
    }, [updateValue])
    
    // Handle LinkPicker save
    const handlePickerSave = useCallback((result) => {
        if (result.action === 'remove') {
            setInternalValue('')
            onChange('')
        } else if (result.action === 'insert' && result.link) {
            // Auto-populate label if empty
            let newLabel = itemLabel
            if (!newLabel && result.title) {
                newLabel = result.title
            }
            
            // Merge with existing isActive/targetBlank
            const newObj = {
                ...result.link,
                label: newLabel,
                isActive: isActive,
                targetBlank: targetBlank
            }
            const newStr = JSON.stringify(newObj)
            setInternalValue(newStr)
            onChange(newStr)
        }
        setIsPickerOpen(false)
    }, [itemLabel, isActive, targetBlank, onChange])
    
    // Handle clear
    const handleClear = useCallback((e) => {
        e.stopPropagation()
        setInternalValue('')
        onChange('')
    }, [onChange])
    
    const hasError = validation && !validation.isValid
    const hasLink = currentValue && currentValue.type
    
    return (
        <div className="space-y-2">
            {/* Field label */}
            {fieldLabel && (
                <label className="block text-sm font-medium text-gray-700">
                    {fieldLabel}
                    {required && <span className="text-red-500 ml-1">*</span>}
                </label>
            )}
            
            {/* Main container */}
            <div className={`border rounded-lg overflow-hidden ${hasError ? 'border-red-500' : 'border-gray-300'} ${disabled ? 'bg-gray-50' : 'bg-white'}`}>
                {/* Label input */}
                {showLabel && (
                    <div className="border-b border-gray-200">
                        <input
                            type="text"
                            value={itemLabel}
                            onChange={handleLabelChange}
                            disabled={disabled}
                            placeholder={labelPlaceholder}
                            className={`
                                w-full px-3 py-2 text-sm border-0 focus:outline-none focus:ring-2 focus:ring-inset focus:ring-blue-500
                                ${disabled ? 'bg-gray-50 text-gray-500' : 'bg-white'}
                            `}
                        />
                    </div>
                )}
                
                {/* Link display/picker */}
                <div className={`flex items-center gap-2 px-3 py-2 ${showLabel ? '' : ''}`}>
                    <LinkDisplay
                        url={currentValueStr}
                        onEdit={() => !disabled && setIsPickerOpen(true)}
                        currentSiteId={siteId}
                        disabled={disabled}
                    />
                    {hasLink && !disabled && (
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
                
                {/* Toggles row */}
                {(showIsActive || showTargetBlank) && (
                    <div className="flex items-center gap-4 px-3 py-2 border-t border-gray-200 bg-gray-50">
                        {showIsActive && (
                            <Toggle
                                checked={isActive}
                                onChange={handleIsActiveChange}
                                disabled={disabled}
                                label="Active"
                            />
                        )}
                        {showTargetBlank && (
                            <Toggle
                                checked={targetBlank}
                                onChange={handleTargetBlankChange}
                                disabled={disabled}
                                label="New tab"
                            />
                        )}
                    </div>
                )}
            </div>
            
            {/* Description */}
            {description && !hasError && (
                <p className="text-xs text-gray-500">{description}</p>
            )}
            
            {/* Validation errors */}
            {hasError && validation.errors && (
                <p className="text-xs text-red-500">
                    {validation.errors.join(', ')}
                </p>
            )}
            
            {/* LinkPicker Modal */}
            <LinkPicker
                isOpen={isPickerOpen}
                onClose={() => setIsPickerOpen(false)}
                onSave={handlePickerSave}
                initialLink={currentValueStr}
                initialText=""
                currentPageId={pageId}
                currentSiteRootId={siteRootId}
                showRemoveButton={!!hasLink}
            />
        </div>
    )
}

LinkField.displayName = 'LinkField'

// Export LinkDisplay separately for use in custom editors
export { LinkDisplay, parseLinkValue }

export default LinkField
