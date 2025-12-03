/**
 * LinkPicker - Modal component for selecting and editing links
 * 
 * Features:
 * - Tab-based interface for different link types (Internal, External, Email, Phone, Anchor)
 * - Hierarchical page browser for internal links
 * - Anchor selection from page widgets
 * - Auto-title from page/anchor with custom override
 * - Link text editing (optional)
 * - Open in new tab option
 * - Remove link action
 */

import { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import { useQuery } from '@tanstack/react-query'
import {
    X,
    Link,
    Globe,
    Mail,
    Phone,
    Hash,
    ChevronRight,
    ChevronLeft,
    Home,
    Search,
    Loader2,
    ExternalLink,
    FileText,
    Trash2
} from 'lucide-react'
import { pagesApi } from '../api'
import { api } from '../api/client'
import { endpoints } from '../api/endpoints'

// Link type definitions
const LINK_TYPES = {
    internal: { label: 'Internal Page', icon: FileText },
    external: { label: 'External URL', icon: Globe },
    email: { label: 'Email', icon: Mail },
    phone: { label: 'Phone', icon: Phone },
    anchor: { label: 'Anchor', icon: Hash }
}

/**
 * Parse a link value to determine its type and extract data
 */
const parseLink = (linkValue) => {
    if (!linkValue) return { type: 'internal', data: {} }
    
    // If it's a string, try to parse as JSON
    if (typeof linkValue === 'string') {
        try {
            const parsed = JSON.parse(linkValue)
            if (parsed && parsed.type) {
                return { type: parsed.type, data: parsed }
            }
        } catch {
            // Not JSON, treat as legacy URL
            if (linkValue.startsWith('mailto:')) {
                const address = linkValue.replace('mailto:', '').split('?')[0]
                return { type: 'email', data: { address } }
            }
            if (linkValue.startsWith('tel:')) {
                return { type: 'phone', data: { number: linkValue.replace('tel:', '') } }
            }
            if (linkValue.startsWith('#')) {
                return { type: 'anchor', data: { anchor: linkValue.slice(1) } }
            }
            if (linkValue.startsWith('http://') || linkValue.startsWith('https://')) {
                return { type: 'external', data: { url: linkValue } }
            }
            // Internal path (starts with / or is a relative path without protocol)
            if (linkValue.startsWith('/') || !linkValue.includes('://')) {
                // Mark as internal with the path for lookup
                return { type: 'internal', data: { legacyPath: linkValue } }
            }
            return { type: 'external', data: { url: linkValue } }
        }
    }
    
    // Already an object
    if (typeof linkValue === 'object' && linkValue.type) {
        return { type: linkValue.type, data: linkValue }
    }
    
    return { type: 'internal', data: {} }
}

/**
 * Build a link object from form data
 */
const buildLinkObject = (type, data, targetBlank = false) => {
    const base = targetBlank ? { targetBlank: true } : {}
    
    switch (type) {
        case 'internal':
            return {
                ...base,
                type: 'internal',
                pageId: data.pageId,
                ...(data.anchor && { anchor: data.anchor })
            }
        case 'external':
            return {
                ...base,
                type: 'external',
                url: data.url
            }
        case 'email':
            return {
                ...base,
                type: 'email',
                address: data.address,
                ...(data.subject && { subject: data.subject })
            }
        case 'phone':
            return {
                ...base,
                type: 'phone',
                number: data.number
            }
        case 'anchor':
            return {
                ...base,
                type: 'anchor',
                anchor: data.anchor
            }
        default:
            return null
    }
}

/**
 * Page Browser Component - Hierarchical navigation
 */
const PageBrowser = ({ 
    selectedPageId, 
    onSelectPage, 
    currentSiteRootId,
    searchTerm,
    onSearchChange 
}) => {
    const [currentParentId, setCurrentParentId] = useState(null)
    const [breadcrumbs, setBreadcrumbs] = useState([])
    
    // Initialize to site root
    useEffect(() => {
        if (currentSiteRootId && currentParentId === null) {
            setCurrentParentId(currentSiteRootId)
            setBreadcrumbs([{ id: currentSiteRootId, title: 'Site Root' }])
        }
    }, [currentSiteRootId, currentParentId])
    
    // Fetch pages for current level
    const { data: pagesData, isLoading } = useQuery({
        queryKey: ['link-picker-pages', currentParentId, searchTerm],
        queryFn: async () => {
            if (searchTerm) {
                // Search mode - search across all pages
                const result = await pagesApi.list({ search: searchTerm, page_size: 50 })
                return result.results || []
            }
            // Browse mode - get children of current parent
            if (currentParentId) {
                const result = await pagesApi.getPageChildren(currentParentId, { page_size: 100 })
                return result.results || []
            }
            // Root level
            const result = await pagesApi.getRootPages({ page_size: 100 })
            return result.results || []
        },
        staleTime: 30000
    })
    
    const pages = pagesData || []
    
    const handleNavigateInto = (page) => {
        setCurrentParentId(page.id)
        setBreadcrumbs(prev => [...prev, { id: page.id, title: page.title }])
        onSearchChange('')
    }
    
    const handleNavigateUp = () => {
        if (breadcrumbs.length > 1) {
            const newBreadcrumbs = breadcrumbs.slice(0, -1)
            setBreadcrumbs(newBreadcrumbs)
            setCurrentParentId(newBreadcrumbs[newBreadcrumbs.length - 1]?.id || null)
        }
    }
    
    const handleNavigateToRoot = () => {
        setBreadcrumbs(currentSiteRootId ? [{ id: currentSiteRootId, title: 'Site Root' }] : [])
        setCurrentParentId(currentSiteRootId || null)
    }
    
    return (
        <div className="flex flex-col h-full">
            {/* Search */}
            <div className="p-2 border-b border-gray-200">
                <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <input
                        type="text"
                        value={searchTerm}
                        onChange={(e) => onSearchChange(e.target.value)}
                        placeholder="Search pages..."
                        className="w-full pl-9 pr-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                </div>
            </div>
            
            {/* Breadcrumb navigation */}
            {!searchTerm && breadcrumbs.length > 0 && (
                <div className="flex items-center gap-1 p-2 border-b border-gray-200 bg-gray-50">
                    <button
                        onClick={handleNavigateToRoot}
                        className="p-1 hover:bg-gray-200 rounded flex-shrink-0"
                        title="Go to root"
                    >
                        <Home className="w-4 h-4 text-gray-600" />
                    </button>
                    {breadcrumbs.length > 1 && (
                        <button
                            onClick={handleNavigateUp}
                            className="p-1 hover:bg-gray-200 rounded flex items-center gap-1 text-sm text-gray-600 flex-shrink-0"
                        >
                            <ChevronLeft className="w-4 h-4" />
                            Back
                        </button>
                    )}
                    <span className="text-sm text-gray-500 ml-2 truncate min-w-0 flex-1">
                        {breadcrumbs[breadcrumbs.length - 1]?.title}
                    </span>
                    {/* Select current folder button */}
                    {currentParentId && (
                        <button
                            onClick={() => onSelectPage({ 
                                id: currentParentId, 
                                title: breadcrumbs[breadcrumbs.length - 1]?.title 
                            })}
                            className={`px-2 py-1 text-xs rounded flex-shrink-0 ${
                                selectedPageId === currentParentId
                                    ? 'bg-blue-600 text-white'
                                    : 'bg-blue-100 text-blue-700 hover:bg-blue-200'
                            }`}
                            title="Select this page"
                        >
                            Select
                        </button>
                    )}
                </div>
            )}
            
            {/* Page list */}
            <div className="flex-1 overflow-y-auto">
                {isLoading ? (
                    <div className="flex items-center justify-center p-4">
                        <Loader2 className="w-5 h-5 animate-spin text-gray-400" />
                    </div>
                ) : pages.length === 0 ? (
                    <div className="p-4 text-center text-gray-500 text-sm">
                        {searchTerm ? 'No pages found' : 'No child pages'}
                    </div>
                ) : (
                    <div className="divide-y divide-gray-100">
                        {pages.map(page => (
                            <div
                                key={page.id}
                                className={`flex items-center gap-2 p-2 hover:bg-gray-50 cursor-pointer ${
                                    selectedPageId === page.id ? 'bg-blue-50 border-l-2 border-blue-500' : ''
                                }`}
                            >
                                <button
                                    onClick={() => onSelectPage(page)}
                                    className="flex-1 min-w-0 text-left"
                                >
                                    <div className="text-sm font-medium text-gray-900 truncate">
                                        {page.title}
                                    </div>
                                    <div className="text-xs text-gray-500 truncate">
                                        {page.cachedPath || page.slug}
                                    </div>
                                </button>
                                {page.childrenCount > 0 && (
                                    <button
                                        onClick={(e) => {
                                            e.stopPropagation()
                                            handleNavigateInto(page)
                                        }}
                                        className="p-1 hover:bg-gray-200 rounded flex-shrink-0"
                                        title={`Browse ${page.childrenCount} children`}
                                    >
                                        <ChevronRight className="w-4 h-4 text-gray-400" />
                                    </button>
                                )}
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    )
}

/**
 * Anchor Selector Component
 */
const AnchorSelector = ({ pageId, selectedAnchor, onSelectAnchor }) => {
    const { data: anchorsData, isLoading } = useQuery({
        queryKey: ['page-anchors', pageId],
        queryFn: async () => {
            if (!pageId) return []
            const response = await api.get(endpoints.pages.anchors(pageId))
            // Handle different response formats
            if (Array.isArray(response)) {
                return response
            }
            if (response && Array.isArray(response.results)) {
                return response.results
            }
            return []
        },
        enabled: !!pageId,
        staleTime: 30000
    })
    
    // Ensure anchors is always an array
    const anchors = Array.isArray(anchorsData) ? anchorsData : []
    
    if (!pageId) {
        return (
            <div className="text-sm text-gray-500 p-2">
                Select a page to see available anchors
            </div>
        )
    }
    
    if (isLoading) {
        return (
            <div className="flex items-center gap-2 p-2 text-sm text-gray-500">
                <Loader2 className="w-4 h-4 animate-spin" />
                Loading anchors...
            </div>
        )
    }
    
    if (anchors.length === 0) {
        return (
            <div className="text-sm text-gray-500 p-2">
                No anchors found on this page
            </div>
        )
    }
    
    return (
        <div className="divide-y divide-gray-100 max-h-32 overflow-y-auto">
            <button
                onClick={() => onSelectAnchor(null, null)}
                className={`w-full text-left p-2 hover:bg-gray-50 text-sm ${
                    !selectedAnchor ? 'bg-blue-50' : ''
                }`}
            >
                <span className="text-gray-600">No anchor (link to page)</span>
            </button>
            {anchors.map((anchor, idx) => (
                <button
                    key={idx}
                    onClick={() => onSelectAnchor(anchor.anchor, anchor.title)}
                    className={`w-full text-left p-2 hover:bg-gray-50 ${
                        selectedAnchor === anchor.anchor ? 'bg-blue-50' : ''
                    }`}
                >
                    <div className="text-sm font-medium text-gray-900">
                        #{anchor.anchor}
                    </div>
                    {anchor.title && anchor.title !== anchor.anchor && (
                        <div className="text-xs text-gray-500">{anchor.title}</div>
                    )}
                </button>
            ))}
        </div>
    )
}

/**
 * Internal Page Tab Content
 */
const InternalPageTab = ({ 
    data, 
    onChange, 
    currentPageId,
    currentSiteRootId 
}) => {
    const [searchTerm, setSearchTerm] = useState('')
    const [selectedPage, setSelectedPage] = useState(null)
    
    // Fetch selected page info if we have a pageId
    const { data: pageInfo } = useQuery({
        queryKey: ['page-lookup', data.pageId],
        queryFn: async () => {
            if (!data.pageId) return null
            const response = await api.get(`${endpoints.pages.lookup}?id=${data.pageId}`)
            return response
        },
        enabled: !!data.pageId,
        staleTime: 60000
    })
    
    // Look up page by path if we have a legacyPath
    const { data: pathLookupResult } = useQuery({
        queryKey: ['page-lookup-path', data.legacyPath],
        queryFn: async () => {
            if (!data.legacyPath) return null
            // Clean up the path - remove leading/trailing slashes for search
            const cleanPath = data.legacyPath.replace(/^\/|\/$/g, '')
            // Search for pages with this slug
            const response = await pagesApi.list({ search: cleanPath, page_size: 10 })
            const results = response.results || []
            // Find exact match by cached_path or slug
            const exactMatch = results.find(p => 
                p.cachedPath === data.legacyPath || 
                p.cachedPath === `/${cleanPath}/` ||
                p.slug === cleanPath
            )
            return exactMatch || null
        },
        enabled: !!data.legacyPath && !data.pageId,
        staleTime: 60000
    })
    
    // When path lookup finds a page, update the data to use pageId
    useEffect(() => {
        if (pathLookupResult && !data.pageId) {
            onChange({ ...data, pageId: pathLookupResult.id, legacyPath: undefined })
            setSelectedPage(pathLookupResult)
        }
    }, [pathLookupResult, data, onChange])
    
    useEffect(() => {
        if (pageInfo) {
            setSelectedPage(pageInfo)
        }
    }, [pageInfo])
    
    const handleSelectPage = (page) => {
        setSelectedPage(page)
        onChange({ ...data, pageId: page.id, anchor: null })
    }
    
    const handleSelectAnchor = (anchor, anchorTitle) => {
        onChange({ 
            ...data, 
            anchor,
            anchorTitle: anchorTitle || anchor
        })
    }
    
    return (
        <div className="grid grid-cols-2 gap-4 h-80">
            {/* Page browser */}
            <div className="border border-gray-200 rounded-md overflow-hidden">
                <PageBrowser
                    selectedPageId={data.pageId}
                    onSelectPage={handleSelectPage}
                    currentSiteRootId={currentSiteRootId}
                    searchTerm={searchTerm}
                    onSearchChange={setSearchTerm}
                />
            </div>
            
            {/* Selected page info and anchors */}
            <div className="border border-gray-200 rounded-md overflow-hidden flex flex-col">
                {selectedPage ? (
                    <>
                        <div className="p-3 border-b border-gray-200 bg-gray-50">
                            <div className="text-sm font-medium text-gray-900">
                                {selectedPage.title}
                            </div>
                            <div className="text-xs text-gray-500">
                                {selectedPage.path || selectedPage.cachedPath}
                            </div>
                        </div>
                        <div className="flex-1 overflow-y-auto">
                            <div className="p-2 text-xs font-medium text-gray-500 uppercase tracking-wide">
                                Anchors
                            </div>
                            <AnchorSelector
                                pageId={data.pageId}
                                selectedAnchor={data.anchor}
                                onSelectAnchor={handleSelectAnchor}
                            />
                        </div>
                    </>
                ) : data.legacyPath ? (
                    <div className="flex flex-col items-center justify-center h-full text-gray-500 text-sm p-4">
                        <Loader2 className="w-5 h-5 animate-spin mb-2" />
                        <div className="text-center">
                            Looking up: <span className="font-mono text-xs">{data.legacyPath}</span>
                        </div>
                    </div>
                ) : (
                    <div className="flex items-center justify-center h-full text-gray-500 text-sm">
                        Select a page from the browser
                    </div>
                )}
            </div>
        </div>
    )
}

/**
 * External URL Tab Content
 */
const ExternalUrlTab = ({ data, onChange }) => {
    return (
        <div className="space-y-4">
            <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                    URL
                </label>
                <input
                    type="url"
                    value={data.url || ''}
                    onChange={(e) => onChange({ ...data, url: e.target.value })}
                    placeholder="https://example.com"
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
            </div>
        </div>
    )
}

/**
 * Email Tab Content
 */
const EmailTab = ({ data, onChange }) => {
    return (
        <div className="space-y-4">
            <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                    Email Address
                </label>
                <input
                    type="email"
                    value={data.address || ''}
                    onChange={(e) => onChange({ ...data, address: e.target.value })}
                    placeholder="contact@example.com"
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
            </div>
            <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                    Subject (optional)
                </label>
                <input
                    type="text"
                    value={data.subject || ''}
                    onChange={(e) => onChange({ ...data, subject: e.target.value })}
                    placeholder="Message subject"
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
            </div>
        </div>
    )
}

/**
 * Phone Tab Content
 */
const PhoneTab = ({ data, onChange }) => {
    return (
        <div className="space-y-4">
            <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                    Phone Number
                </label>
                <input
                    type="tel"
                    value={data.number || ''}
                    onChange={(e) => onChange({ ...data, number: e.target.value })}
                    placeholder="+46 70 123 4567"
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
            </div>
        </div>
    )
}

/**
 * Anchor (same page) Tab Content
 */
const AnchorTab = ({ data, onChange, currentPageId }) => {
    return (
        <div className="space-y-4">
            <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                    Anchor Name
                </label>
                <div className="flex items-center">
                    <span className="px-3 py-2 bg-gray-100 border border-r-0 border-gray-300 rounded-l-md text-gray-500">
                        #
                    </span>
                    <input
                        type="text"
                        value={data.anchor || ''}
                        onChange={(e) => onChange({ ...data, anchor: e.target.value })}
                        placeholder="section-name"
                        className="flex-1 px-3 py-2 border border-gray-300 rounded-r-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                </div>
            </div>
            
            {currentPageId && (
                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                        Available anchors on this page
                    </label>
                    <div className="border border-gray-200 rounded-md">
                        <AnchorSelector
                            pageId={currentPageId}
                            selectedAnchor={data.anchor}
                            onSelectAnchor={(anchor) => onChange({ ...data, anchor })}
                        />
                    </div>
                </div>
            )}
        </div>
    )
}

/**
 * Main LinkPicker Component
 */
const LinkPicker = ({
    isOpen,
    onClose,
    initialLink = null,
    initialText = '',
    currentPageId = null,
    currentSiteRootId = null,
    showRemoveButton = false,
    onSave
}) => {
    // Parse initial link
    const parsed = useMemo(() => parseLink(initialLink), [initialLink])
    
    // State
    const [activeTab, setActiveTab] = useState(parsed.type)
    const [linkData, setLinkData] = useState(parsed.data)
    const [useCustomTitle, setUseCustomTitle] = useState(false)
    const [customTitle, setCustomTitle] = useState('')
    const [replaceText, setReplaceText] = useState(false)
    const [linkText, setLinkText] = useState(initialText)
    const [targetBlank, setTargetBlank] = useState(false)
    
    // Resize state
    const [modalSize, setModalSize] = useState({ width: 672, height: 600 }) // max-w-2xl = 672px
    const [isResizing, setIsResizing] = useState(false)
    const modalRef = useRef(null)
    const resizeStartRef = useRef({ x: 0, y: 0, width: 0, height: 0 })
    
    // Reset state when modal opens with new data
    useEffect(() => {
        if (isOpen) {
            const newParsed = parseLink(initialLink)
            setActiveTab(newParsed.type)
            setLinkData(newParsed.data)
            setUseCustomTitle(false)
            setCustomTitle('')
            setReplaceText(false)
            setLinkText(initialText)
            setTargetBlank(newParsed.data.targetBlank || false)
        }
    }, [isOpen, initialLink, initialText])
    
    // Auto-title based on link type and selection
    const autoTitle = useMemo(() => {
        if (activeTab === 'internal' && linkData.pageId) {
            if (linkData.anchor && linkData.anchorTitle) {
                return linkData.anchorTitle
            }
            // Would need page title from API
            return ''
        }
        if (activeTab === 'external') return linkData.url || ''
        if (activeTab === 'email') return linkData.address || ''
        if (activeTab === 'phone') return linkData.number || ''
        if (activeTab === 'anchor') return `#${linkData.anchor || ''}`
        return ''
    }, [activeTab, linkData])
    
    const handleTabChange = (newTab) => {
        setActiveTab(newTab)
        setLinkData({})
    }
    
    const handleSave = () => {
        const link = buildLinkObject(activeTab, linkData, targetBlank)
        if (!link) return
        
        onSave({
            link,
            title: useCustomTitle ? customTitle : autoTitle,
            text: replaceText ? linkText : undefined,
            replaceText,
            targetBlank,
            action: 'insert'
        })
        onClose()
    }
    
    const handleRemove = () => {
        onSave({
            link: null,
            action: 'remove'
        })
        onClose()
    }
    
    // Resize handlers
    const handleResizeStart = useCallback((e) => {
        e.preventDefault()
        setIsResizing(true)
        resizeStartRef.current = {
            x: e.clientX,
            y: e.clientY,
            width: modalSize.width,
            height: modalSize.height
        }
    }, [modalSize])
    
    const handleResizeMove = useCallback((e) => {
        if (!isResizing) return
        
        const deltaX = e.clientX - resizeStartRef.current.x
        const deltaY = e.clientY - resizeStartRef.current.y
        
        const newWidth = Math.max(400, Math.min(window.innerWidth - 40, resizeStartRef.current.width + deltaX))
        const newHeight = Math.max(400, Math.min(window.innerHeight - 40, resizeStartRef.current.height + deltaY))
        
        setModalSize({ width: newWidth, height: newHeight })
    }, [isResizing])
    
    const handleResizeEnd = useCallback(() => {
        setIsResizing(false)
    }, [])
    
    // Add/remove resize event listeners
    useEffect(() => {
        if (isResizing) {
            window.addEventListener('mousemove', handleResizeMove)
            window.addEventListener('mouseup', handleResizeEnd)
            return () => {
                window.removeEventListener('mousemove', handleResizeMove)
                window.removeEventListener('mouseup', handleResizeEnd)
            }
        }
    }, [isResizing, handleResizeMove, handleResizeEnd])
    
    // Validation
    const isValid = useMemo(() => {
        switch (activeTab) {
            case 'internal':
                return !!linkData.pageId
            case 'external':
                return !!linkData.url
            case 'email':
                return !!linkData.address
            case 'phone':
                return !!linkData.number
            case 'anchor':
                return !!linkData.anchor
            default:
                return false
        }
    }, [activeTab, linkData])
    
    if (!isOpen) return null
    
    return (
        <div className="fixed inset-0 z-[10010] flex items-center justify-center">
            {/* Backdrop */}
            <div 
                className="absolute inset-0 bg-black/50"
                onClick={onClose}
            />
            
            {/* Modal */}
            <div 
                ref={modalRef}
                className="relative bg-white rounded-lg shadow-xl overflow-hidden flex flex-col"
                style={{ 
                    width: modalSize.width, 
                    height: modalSize.height,
                    maxWidth: 'calc(100vw - 40px)',
                    maxHeight: 'calc(100vh - 40px)'
                }}
            >
                {/* Header */}
                <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200">
                    <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                        <Link className="w-5 h-5" />
                        {initialLink ? 'Edit Link' : 'Insert Link'}
                    </h2>
                    <button
                        onClick={onClose}
                        className="p-1 hover:bg-gray-100 rounded"
                    >
                        <X className="w-5 h-5 text-gray-500" />
                    </button>
                </div>
                
                {/* Tabs */}
                <div className="flex border-b border-gray-200 px-4">
                    {Object.entries(LINK_TYPES).map(([type, { label, icon: Icon }]) => (
                        <button
                            key={type}
                            onClick={() => handleTabChange(type)}
                            className={`flex items-center gap-2 px-4 py-2 text-sm font-medium border-b-2 -mb-px ${
                                activeTab === type
                                    ? 'border-blue-500 text-blue-600'
                                    : 'border-transparent text-gray-500 hover:text-gray-700'
                            }`}
                        >
                            <Icon className="w-4 h-4" />
                            {label}
                        </button>
                    ))}
                </div>
                
                {/* Content */}
                <div className="flex-1 overflow-y-auto p-4">
                    {activeTab === 'internal' && (
                        <InternalPageTab
                            data={linkData}
                            onChange={setLinkData}
                            currentPageId={currentPageId}
                            currentSiteRootId={currentSiteRootId}
                        />
                    )}
                    {activeTab === 'external' && (
                        <ExternalUrlTab data={linkData} onChange={setLinkData} />
                    )}
                    {activeTab === 'email' && (
                        <EmailTab data={linkData} onChange={setLinkData} />
                    )}
                    {activeTab === 'phone' && (
                        <PhoneTab data={linkData} onChange={setLinkData} />
                    )}
                    {activeTab === 'anchor' && (
                        <AnchorTab 
                            data={linkData} 
                            onChange={setLinkData}
                            currentPageId={currentPageId}
                        />
                    )}
                    
                    {/* Common options */}
                    <div className="mt-6 pt-4 border-t border-gray-200 space-y-4">
                        {/* Title */}
                        <div>
                            <div className="flex items-center gap-2 mb-2">
                                <input
                                    type="checkbox"
                                    id="useCustomTitle"
                                    checked={useCustomTitle}
                                    onChange={(e) => setUseCustomTitle(e.target.checked)}
                                    className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                                />
                                <label htmlFor="useCustomTitle" className="text-sm font-medium text-gray-700">
                                    Use custom title
                                </label>
                            </div>
                            {useCustomTitle && (
                                <input
                                    type="text"
                                    value={customTitle}
                                    onChange={(e) => setCustomTitle(e.target.value)}
                                    placeholder="Link title"
                                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                                />
                            )}
                        </div>
                        
                        {/* Link text (if we have initial text) */}
                        {initialText && (
                            <div>
                                <div className="flex items-center gap-2 mb-2">
                                    <input
                                        type="checkbox"
                                        id="replaceText"
                                        checked={replaceText}
                                        onChange={(e) => setReplaceText(e.target.checked)}
                                        className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                                    />
                                    <label htmlFor="replaceText" className="text-sm font-medium text-gray-700">
                                        Replace link text
                                    </label>
                                </div>
                                {replaceText && (
                                    <input
                                        type="text"
                                        value={linkText}
                                        onChange={(e) => setLinkText(e.target.value)}
                                        placeholder="Link text"
                                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                                    />
                                )}
                            </div>
                        )}
                        
                        {/* Open in new tab */}
                        <div className="flex items-center gap-2">
                            <input
                                type="checkbox"
                                id="targetBlank"
                                checked={targetBlank}
                                onChange={(e) => setTargetBlank(e.target.checked)}
                                className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                            />
                            <label htmlFor="targetBlank" className="text-sm font-medium text-gray-700 flex items-center gap-1">
                                Open in new tab
                                <ExternalLink className="w-3 h-3 text-gray-400" />
                            </label>
                        </div>
                    </div>
                </div>
                
                {/* Footer */}
                <div className="flex items-center justify-between px-4 py-3 border-t border-gray-200 bg-gray-50">
                    <div>
                        {showRemoveButton && (
                            <button
                                onClick={handleRemove}
                                className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-red-600 hover:bg-red-50 rounded-md"
                            >
                                <Trash2 className="w-4 h-4" />
                                Remove Link
                            </button>
                        )}
                    </div>
                    <div className="flex items-center gap-2">
                        <button
                            onClick={onClose}
                            className="px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 rounded-md"
                        >
                            Cancel
                        </button>
                        <button
                            onClick={handleSave}
                            disabled={!isValid}
                            className="px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-md disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            {initialLink ? 'Update Link' : 'Insert Link'}
                        </button>
                    </div>
                </div>
                
                {/* Resize Handle */}
                <div
                    onMouseDown={handleResizeStart}
                    className="absolute bottom-0 right-0 w-4 h-4 cursor-se-resize group"
                    title="Drag to resize"
                >
                    <svg 
                        className="w-4 h-4 text-gray-400 group-hover:text-gray-600"
                        viewBox="0 0 16 16" 
                        fill="currentColor"
                    >
                        <path d="M14 14H12V12H14V14ZM14 10H12V8H14V10ZM10 14H8V12H10V14ZM14 6H12V4H14V6ZM10 10H8V8H10V10ZM6 14H4V12H6V14Z" />
                    </svg>
                </div>
            </div>
        </div>
    )
}

export default LinkPicker

