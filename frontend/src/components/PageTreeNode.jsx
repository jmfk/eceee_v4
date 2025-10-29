import { useState, useCallback, useEffect, memo, useMemo, useRef } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import {
    ChevronRight,
    ChevronDown,
    ChevronUp,
    FileText,
    Folder,
    FolderOpen,
    Edit,
    Scissors,
    Trash2,
    Globe,
    Clock,
    AlertCircle,
    AlertTriangle,
    Loader2,
    Plus,
    X,
    Save,
    Search,
    Download,
} from 'lucide-react'
import { pagesApi, publishingApi } from '../api'
import { getPageDisplayUrl, isRootPage, sanitizePageData } from '../utils/apiValidation.js'
import Tooltip from './Tooltip'
import { useNotificationContext } from './NotificationManager'
import pageTreeUtils from '../utils/pageTreeUtils'

// Separate component for publication status icon that only re-renders when status changes
const PublicationStatusIcon = memo(({
    pageId,
    publicationStatus,
    canToggle,
    isToggling,
    onToggle,
    latestVersionNumber,
    publishedVersionNumber
}) => {
    const getStatusIcon = () => {
        switch (publicationStatus) {
            case 'published':
                return <Globe className="w-3 h-3 text-green-500" />
            case 'scheduled':
                return <Clock className="w-3 h-3 text-blue-500" />
            case 'expired':
                return <AlertCircle className="w-3 h-3 text-orange-500" />
            case 'draft':
                return <AlertCircle className="w-3 h-3 text-yellow-500" />
            case 'unpublished':
                return <AlertCircle className="w-3 h-3 text-gray-400" />
            default:
                return <AlertCircle className="w-3 h-3 text-gray-400" />
        }
    }

    const getStatusText = () => {
        switch (publicationStatus) {
            case 'published':
                return 'Published'
            case 'scheduled':
                return 'Scheduled'
            case 'expired':
                return 'Expired'
            case 'draft':
                return 'Draft'
            case 'unpublished':
                return 'Unpublished'
            default:
                return 'Unknown'
        }
    }

    const getStatusTextColor = () => {
        switch (publicationStatus) {
            case 'published':
                return 'text-green-600'
            case 'scheduled':
                return 'text-blue-600'
            case 'expired':
                return 'text-orange-600'
            case 'draft':
                return 'text-yellow-600'
            case 'unpublished':
                return 'text-gray-500'
            default:
                return 'text-gray-500'
        }
    }

    const getVersionDisplay = () => {
        if (!latestVersionNumber) {
            return null
        }
        if (publishedVersionNumber && publishedVersionNumber !== latestVersionNumber) {
            return `v${latestVersionNumber} / v${publishedVersionNumber}`
        }
        return `v${latestVersionNumber}`
    }

    const getTooltipText = () => {
        let tooltip = getStatusText()
        const versionDisplay = getVersionDisplay()
        if (versionDisplay) {
            tooltip += ` (${versionDisplay})`
        }
        if (canToggle) {
            tooltip += publicationStatus === 'published' ?
                ' - Click to unpublish' :
                ' - Click to publish'
        }
        return tooltip
    }

    return (
        <Tooltip text={getTooltipText()} position="top">
            <div className="flex items-center gap-1.5">
                <div
                    className={`flex-shrink-0 ${canToggle ? 'cursor-pointer hover:scale-110 transition-transform' : 'cursor-help'} ${isToggling ? 'opacity-50' : ''}`}
                    onClick={canToggle ? onToggle : undefined}
                >
                    {isToggling ? (
                        <Loader2 className="w-3 h-3 animate-spin text-blue-500" />
                    ) : (
                        getStatusIcon()
                    )}
                </div>
                <span className={`text-xs font-medium ${getStatusTextColor()}`}>
                    {getStatusText()}
                </span>
                {getVersionDisplay() && (
                    <span className="text-xs text-gray-500 font-mono">
                        {getVersionDisplay()}
                    </span>
                )}
            </div>
        </Tooltip>
    )
})

PublicationStatusIcon.displayName = 'PublicationStatusIcon'

const PageTreeNode = memo(({
    page: initialPage,
    level = 0,
    onEdit,
    onCut,
    onPaste,
    onDelete,
    onAddPageBelow,
    onImport,
    cutPageId,
    isSearchMode = false,
    searchTerm = '',
    rowHeight = 'compact',
    onMoveUp,
    onMoveDown,
    canMoveUp = true,
    canMoveDown = true,
    selectedPageIds = new Set(),
    onPageClick = null,
    isSelectionMode = false
}) => {
    // Each node manages its own state independently
    const [page, setPage] = useState(initialPage)
    const childrenRef = useRef([])
    const [, forceUpdate] = useState({})
    const [isExpanded, setIsExpanded] = useState(initialPage.isExpanded || false)
    const [childrenLoaded, setChildrenLoaded] = useState(false)
    const [isLoading, setIsLoading] = useState(false)
    const [showHostnameModal, setShowHostnameModal] = useState(false)
    const [isEditingTitle, setIsEditingTitle] = useState(false)
    const [editingTitle, setEditingTitle] = useState('')
    const [isEditingSlug, setIsEditingSlug] = useState(false)
    const [editingSlug, setEditingSlug] = useState('')
    const [isTogglingPublication, setIsTogglingPublication] = useState(false)
    const queryClient = useQueryClient()
    const { showError, showConfirm } = useNotificationContext()

    // Update local state when prop changes (for updates from parent)
    useEffect(() => {
        setPage(initialPage)
    }, [initialPage.id, initialPage.title, initialPage.slug, initialPage.publicationStatus])

    // Sync local expansion state with page prop changes
    useEffect(() => {
        if (page.isExpanded !== undefined) {
            setIsExpanded(page.isExpanded)
        }
    }, [page.isExpanded, page.id])

    // Check if page has children (memoized)
    const hasChildren = useMemo(() => pageTreeUtils.hasChildren(page), [page])

    // Check if page is cut (memoized)
    const isCut = useMemo(() => cutPageId === page.id, [cutPageId, page.id])

    // Check if page is selected (memoized)
    const isSelected = useMemo(() => selectedPageIds.has(page.id), [selectedPageIds, page.id])

    // Animation state for page movement
    const [isAnimating, setIsAnimating] = useState(false)
    const [animationDirection, setAnimationDirection] = useState('') // 'up', 'down', 'left', 'right'

    // Check if this is a top-level page without hostname
    const isTopLevel = level === 0
    const sanitizedPage = sanitizePageData(page)
    const isRootPageCheck = isRootPage(sanitizedPage)
    const hasHostnames = sanitizedPage.hostnames && sanitizedPage.hostnames.length > 0
    const needsHostnameWarning = isRootPageCheck && !hasHostnames

    // Helper function to highlight search terms
    const highlightSearchTerm = (text, searchTerm) => {
        if (!searchTerm || !text) return text

        const regex = new RegExp(`(${searchTerm.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi')
        const parts = text.split(regex)

        return parts.map((part, index) =>
            regex.test(part) ? (
                <mark key={index} className="bg-yellow-200 px-1 rounded">
                    {part}
                </mark>
            ) : part
        )
    }

    // Load children for this node
    const loadChildren = useCallback(async () => {
        if (childrenLoaded || isLoading) return

        setIsLoading(true)
        try {
            const childrenData = await pagesApi.getPageChildren(page.id)
            const loadedChildren = childrenData.results.map(child =>
                pageTreeUtils.formatPageForTree(child)
            )
            childrenRef.current = loadedChildren
            setChildrenLoaded(true)

            // Cache the children data in React Query for invalidation
            queryClient.setQueryData(['page-children', page.id], childrenData)
        } catch (error) {
            console.error('Error loading children:', error)
            showError(error, 'error')
        } finally {
            setIsLoading(false)
        }
    }, [page.id, childrenLoaded, isLoading, queryClient, showError])

    // Auto-load children if this node starts expanded and has children
    useEffect(() => {
        if (isExpanded && hasChildren && !childrenLoaded && !isLoading) {
            loadChildren()
        }
    }, [isExpanded, hasChildren, childrenLoaded, isLoading, loadChildren, page.title, page.id, page.childrenCount])

    // Expand/collapse toggle
    const handleToggleExpand = async () => {
        if (!hasChildren) return

        const newExpanded = !isExpanded
        setIsExpanded(newExpanded)

        // Load children when expanding if not already loaded
        if (newExpanded && !childrenLoaded) {
            await loadChildren()
        }
    }

    // Context menu or button handlers
    const handleEdit = () => {
        onEdit?.(page)
    }

    const handleCut = () => {
        onCut?.(page.id)
    }

    // Handle row click for selection
    const handleRowClick = (event) => {
        // Only handle selection if onPageClick is provided and not clicking on buttons
        if (onPageClick && !event.defaultPrevented) {
            onPageClick(page.id, event)
        }
    }

    const handleDelete = async () => {
        let message = `Are you sure you want to delete "${page.title}"?`
        let descendants = []

        // If page has children, fetch them recursively to show what will be deleted
        if (hasChildren && page.childrenCount > 0) {
            try {
                // Recursive function to fetch all descendants
                const fetchAllDescendants = async (pageId) => {
                    const children = await pagesApi.getPageChildren(pageId)
                    const allDescendants = []
                    
                    for (const child of children.results || []) {
                        allDescendants.push(child)
                        // If this child has children, fetch them recursively
                        if (child.childrenCount > 0) {
                            const childDescendants = await fetchAllDescendants(child.id)
                            allDescendants.push(...childDescendants)
                        }
                    }
                    
                    return allDescendants
                }

                // Fetch all descendants recursively
                descendants = await fetchAllDescendants(page.id)
                const totalCount = descendants.length + 1 // +1 for the page itself

                if (descendants.length > 0) {
                    // Create a list of pages that will be deleted
                    const pageList = descendants.slice(0, 10).map(p => `• ${p.title}`).join('\n')
                    const moreText = descendants.length > 10 ? `\n... and ${descendants.length - 10} more subpages` : ''

                    message = `⚠️ RECURSIVE DELETION\n\nDeleting "${page.title}" will also delete ALL ${descendants.length} subpage(s):\n\n${pageList}${moreText}\n\nTotal pages to delete: ${totalCount}\n\nThis action cannot be undone.`
                }
            } catch (error) {
                console.error('Error loading descendants for delete confirmation:', error)
                // Fall back to showing count if available
                if (page.childrenCount > 0) {
                    message = `⚠️ RECURSIVE DELETION\n\nThis page has ${page.childrenCount} direct subpage(s). Deleting "${page.title}" will also delete ALL of its subpages and their descendants recursively.\n\nThis action cannot be undone.`
                }
            }
        } else {
            message += '\n\nThis action cannot be undone.'
        }

        const confirmed = await showConfirm({
            title: 'Delete Page',
            message: message,
            confirmText: 'Delete',
            confirmButtonStyle: 'danger'
        })

        if (confirmed) {
            onDelete?.(page.id)
        }
    }

    const handleAddPageBelow = () => {
        onAddPageBelow?.(page)
    }

    const handleImport = () => {
        onImport?.(page)
    }

    const handleMoveUp = async () => {
        if (!canMoveUp) return
        // Animate immediately (optimistic)
        setAnimationDirection('up')
        setIsAnimating(true)

        // Clear animation after it completes
        setTimeout(() => {
            setIsAnimating(false)
            setAnimationDirection('')
        }, 500)

        // Trigger the actual move
        try {
            await onMoveUp?.(page.id)
            // Invalidate React Query cache to refresh
            queryClient.invalidateQueries(['pages', 'root'])
            queryClient.invalidateQueries(['page-children'])
        } catch (error) {
            console.error('Failed to move page up:', error)
            showError(error, 'error')
        }
    }

    const handleMoveDown = async () => {
        if (!canMoveDown) return
        // Animate immediately (optimistic)
        setAnimationDirection('down')
        setIsAnimating(true)

        // Clear animation after it completes
        setTimeout(() => {
            setIsAnimating(false)
            setAnimationDirection('')
        }, 500)

        // Trigger the actual move
        try {
            await onMoveDown?.(page.id)
            // Invalidate React Query cache to refresh
            queryClient.invalidateQueries(['pages', 'root'])
            queryClient.invalidateQueries(['page-children'])
        } catch (error) {
            console.error('Failed to move page down:', error)
            showError(error, 'error')
        }
    }

    const handleHostnameClick = () => {
        if (isRootPageCheck) {
            setShowHostnameModal(true)
        }
    }

    // Child move handlers
    const handleChildMoveUp = async (childId) => {
        // Boundary check: Hitta child i arrayen
        const childIndex = childrenRef.current.findIndex(c => c.id === childId)

        // Boundary check: Kan inte flytta upp om:
        // - childIndex är -1 (inte hittad)
        // - childIndex är 0 (redan först)
        if (childIndex <= 0) return

        // Safe access: childIndex är nu garanterat >= 1
        const currentChild = childrenRef.current[childIndex]
        const previousChild = childrenRef.current[childIndex - 1]  // Safe: childIndex >= 1

        // 1. FÖRST: Uppdatera lokalt (byt plats i arrayen)
        const newChildren = [...childrenRef.current]
        newChildren[childIndex] = previousChild
        newChildren[childIndex - 1] = currentChild

        // Uppdatera sortOrder för alla children med 10-intervaller
        newChildren.forEach((child, index) => {
            child.sortOrder = index * 10
        })

        childrenRef.current = newChildren

        try {
            // Update via API - skicka alla ändringar
            const updatePromises = newChildren.map(child =>
                pagesApi.update(child.id, { sortOrder: child.sortOrder })
            )
            await Promise.all(updatePromises)
            forceUpdate({})

            // Invalidate parent's children query to refresh counts
            queryClient.invalidateQueries(['page-children', page.id])
        } catch (error) {
            // Om det misslyckas, återställ till original ordning
            console.error('Failed to update sort order:', error)
            await loadChildren()
            throw error
        }
    }

    const handleChildMoveDown = async (childId) => {
        // Boundary check: Hitta child i arrayen
        const childIndex = childrenRef.current.findIndex(c => c.id === childId)

        // Boundary check: Kan inte flytta ner om:
        // - childIndex är -1 (inte hittad)
        // - childIndex är childrenRef.current.length - 1 (redan sist)
        if (childIndex < 0 || childIndex >= childrenRef.current.length - 1) return

        // Safe access: childIndex är nu garanterat 0 <= childIndex < childrenRef.current.length - 1
        const currentChild = childrenRef.current[childIndex]
        const nextChild = childrenRef.current[childIndex + 1]  // Safe: childIndex < childrenRef.current.length - 1

        // 1. FÖRST: Uppdatera lokalt (byt plats i arrayen)
        const newChildren = [...childrenRef.current]
        newChildren[childIndex] = nextChild
        newChildren[childIndex + 1] = currentChild

        // Uppdatera sortOrder för alla children med 10-intervaller
        newChildren.forEach((child, index) => {
            child.sortOrder = index * 10
        })

        childrenRef.current = newChildren

        // 2. SEN: Skicka alla uppdaterade sortOrder till backend
        try {
            // Update via API - skicka alla ändringar
            const updatePromises = newChildren.map(child =>
                pagesApi.update(child.id, { sortOrder: child.sortOrder })
            )
            await Promise.all(updatePromises)
            forceUpdate({})

            // Invalidate parent's children query to refresh counts
            queryClient.invalidateQueries(['page-children', page.id])
        } catch (error) {
            // Om det misslyckas, återställ till original ordning
            console.error('Failed to update sort order:', error)
            await loadChildren()
            throw error
        }
    }

    // Title editing handlers
    const handleTitleClick = () => {
        setIsEditingTitle(true)
        setEditingTitle(page.title)
    }

    const handleTitleSave = () => {
        const trimmedTitle = editingTitle.trim()
        if (!trimmedTitle) {
            return
        }
        if (trimmedTitle === page.title) {
            setIsEditingTitle(false)
            return
        }
        updateTitleMutation.mutate({ title: trimmedTitle })
    }

    const handleTitleCancel = () => {
        setIsEditingTitle(false)
        setEditingTitle('')
    }

    const handleTitleKeyDown = (e) => {
        if (e.key === 'Enter') {
            e.preventDefault()
            handleTitleSave()
        } else if (e.key === 'Escape') {
            e.preventDefault()
            handleTitleCancel()
        }
    }

    // Slug editing handlers
    const handleSlugClick = () => {
        setIsEditingSlug(true)
        setEditingSlug(page.slug)
    }

    const generateSlug = (text) => {
        return text
            .toLowerCase()
            .replace(/[^a-z0-9\s-]/g, '')
            .replace(/\s+/g, '-')
            .replace(/-+/g, '-')
            .replace(/^-+|-+$/g, '') // Remove leading and trailing dashes
            .trim()
    }

    const handleSlugSave = () => {
        const trimmedSlug = editingSlug.trim()
        if (!trimmedSlug) {
            return
        }

        // Auto-sanitize the slug
        const sanitizedSlug = generateSlug(trimmedSlug)
        if (sanitizedSlug !== trimmedSlug) {
            setEditingSlug(sanitizedSlug)
            return
        }

        if (sanitizedSlug === page.slug) {
            setIsEditingSlug(false)
            return
        }
        updateSlugMutation.mutate({ slug: sanitizedSlug })
    }

    const handleSlugCancel = () => {
        setIsEditingSlug(false)
        setEditingSlug('')
    }

    const handleSlugKeyDown = (e) => {
        if (e.key === 'Enter') {
            e.preventDefault()
            handleSlugSave()
        } else if (e.key === 'Escape') {
            e.preventDefault()
            handleSlugCancel()
        }
    }

    // Publication status handlers
    const handlePublicationToggle = () => {
        if (isTogglingPublication) return // Prevent double-clicks

        setIsTogglingPublication(true)

        if (page.publicationStatus === 'published') {
            unpublishPageMutation.mutate()
        } else {
            publishPageMutation.mutate()
        }
    }

    const canTogglePublication = () => {
        // Only allow toggling between published and unpublished for simplicity
        return page.publicationStatus === 'published' || page.publicationStatus === 'unpublished'
    }

    // Update page hostnames mutation
    const updateHostnamesMutation = useMutation({
        mutationFn: async (hostnamesData) => {
            return await pagesApi.update(page.id, hostnamesData)
        },
        onSuccess: (updatedPage) => {
            setShowHostnameModal(false)
            // Update local state
            setPage(prev => ({ ...prev, hostnames: updatedPage.hostnames }))
        },
        onError: (error) => {
            console.error('Failed to update hostnames:', error.response?.data?.detail || error.message)
            showError(error, 'error')
        }
    })

    // Update page title mutation
    const updateTitleMutation = useMutation({
        mutationFn: async (titleData) => {
            return await pagesApi.update(page.id, titleData)
        },
        onSuccess: (updatedPage) => {
            setIsEditingTitle(false)
            // Update local state
            setPage(prev => ({ ...prev, title: updatedPage.title }))
        },
        onError: (error) => {
            console.error('Failed to update title:', error.response?.data?.detail || error.message)
            showError(error, 'error')
            setEditingTitle(page.title) // Reset to original title on error
        }
    })

    // Update page slug mutation
    const updateSlugMutation = useMutation({
        mutationFn: async (slugData) => {
            return await pagesApi.update(page.id, slugData)
        },
        onSuccess: (updatedPage) => {
            setIsEditingSlug(false)
            // Update local state
            setPage(prev => ({ ...prev, slug: updatedPage.slug }))
        },
        onError: (error) => {
            console.error('Failed to update slug:', error.response?.data?.detail || error.message)
            showError(error, 'error')
            setEditingSlug(page.slug) // Reset to original slug on error
        }
    })

    // Publish page mutation
    const publishPageMutation = useMutation({
        mutationFn: async () => {
            return await publishingApi.publishPage(page.id)
        },
        onSuccess: (updatedPage) => {
            setIsTogglingPublication(false)
            // Update local state
            setPage(prev => ({ ...prev, publicationStatus: updatedPage.publicationStatus || 'published' }))
        },
        onError: (error) => {
            console.error('Failed to publish page:', error.response?.data?.detail || error.message)
            showError(error, 'error')
            setIsTogglingPublication(false)
        }
    })

    // Unpublish page mutation
    const unpublishPageMutation = useMutation({
        mutationFn: async () => {
            return await publishingApi.unpublishPage(page.id)
        },
        onSuccess: (updatedPage) => {
            setIsTogglingPublication(false)
            // Update local state
            setPage(prev => ({ ...prev, publicationStatus: updatedPage.publicationStatus || 'unpublished' }))
        },
        onError: (error) => {
            console.error('Failed to unpublish page:', error.response?.data?.detail || error.message)
            showError(error, 'error')
            setIsTogglingPublication(false)
        }
    })

    // Folder icon based on state
    const getFolderIcon = () => {
        if (!hasChildren) {
            return <FileText className="w-4 h-4 text-gray-500" />
        }
        return isExpanded ?
            <FolderOpen className="w-4 h-4 text-blue-500" /> :
            <Folder className="w-4 h-4 text-blue-500" />
    }

    return (
        <div className="select-none">
            {/* Main node */}
            <div
                className={`
                    flex items-center px-2 ${rowHeight === 'spacious' ? 'py-4' : 'py-2.5'} ${isSelected ? 'hover:bg-blue-200' : 'hover:bg-gray-50'} group relative
                    ${isCut && isSelected ? 'opacity-70 bg-orange-100 border-l-4 border-blue-500 ring-2 ring-orange-300' : ''}
                    ${isCut && !isSelected ? 'opacity-60 bg-orange-50' : ''}
                    ${isSelected && !isCut ? 'bg-blue-100 border-l-4 border-blue-500' : ''}
                    ${page.isSearchResult && !isSelected ? 'bg-blue-50 border-l-4 border-blue-400' : ''}
                    ${page.highlightSearch && !isSelected ? 'bg-yellow-50 border-l-4 border-yellow-400' : ''}
                    ${level > 0 ? 'border-l border-gray-200' : ''}
                    ${isAnimating ? 'transition-all duration-500 ease-in-out' : ''}
                    ${animationDirection === 'up' ? 'transform -translate-y-8' : ''}
                    ${animationDirection === 'down' ? 'transform translate-y-8' : ''}
                    ${animationDirection === 'left' ? 'transform -translate-x-8' : ''}
                    ${animationDirection === 'right' ? 'transform translate-x-8' : ''}
                    ${onPageClick ? 'cursor-pointer' : ''}
                `}
                style={{ paddingLeft: `${level * 24 + 8}px` }}
                onClick={handleRowClick}
            >
                {/* Expand/collapse button */}
                <button
                    onClick={(e) => {
                        e.stopPropagation()
                        handleToggleExpand()
                    }}
                    className={`
                            mr-1 p-1.5 rounded transition-all duration-200 hover:shadow-sm
                            ${!hasChildren ? 'opacity-30 cursor-default' : 'hover:bg-gray-200'}
                        `}
                    disabled={isLoading || !hasChildren}
                >
                    {isLoading ? (
                        <Loader2 className="w-4 h-4 animate-spin text-gray-400" />
                    ) : isExpanded ? (
                        <ChevronDown className="w-4 h-4 text-gray-600" />
                    ) : (
                        <ChevronRight className="w-4 h-4 text-gray-600" />
                    )}
                </button>

                {/* Page content area */}
                <div className="flex-1 min-w-0 flex items-center gap-2">
                    {/* Page icon */}
                    <div className="mr-2">
                        <div>
                            {getFolderIcon()}
                        </div>
                    </div>

                    {/* Page info */}
                    <div className="flex-1 min-w-0 flex items-center gap-2">
                        {page.isSearchResult && (
                            <div className="flex items-center">
                                <Search className="w-3 h-3 text-blue-500" />
                            </div>
                        )}
                        {isEditingTitle ? (
                            <div className="flex items-center gap-1">
                                <input
                                    type="text"
                                    value={editingTitle}
                                    onChange={(e) => setEditingTitle(e.target.value)}
                                    onKeyDown={handleTitleKeyDown}
                                    className="truncate font-medium text-sm bg-white border border-blue-300 rounded px-1 py-0.5 focus:outline-none focus:ring-1 focus:ring-blue-500 min-w-0 flex-1"
                                    autoFocus
                                    disabled={updateTitleMutation.isPending}
                                />
                                <button
                                    onClick={handleTitleSave}
                                    disabled={updateTitleMutation.isPending}
                                    className="p-0.5 rounded hover:bg-green-100 text-green-600 transition-colors disabled:opacity-50"
                                    title="Save (Enter)"
                                >
                                    <Save className="w-4 h-4" />
                                </button>
                                <button
                                    onClick={handleTitleCancel}
                                    disabled={updateTitleMutation.isPending}
                                    className="p-0.5 rounded hover:bg-red-100 text-red-600 transition-colors disabled:opacity-50"
                                    title="Cancel (Escape)"
                                >
                                    <X className="w-4 h-4" />
                                </button>
                            </div>
                        ) : (
                            <span
                                className="truncate font-medium text-sm cursor-pointer hover:text-blue-600 hover:underline transition-colors"
                                onClick={handleTitleClick}
                                title="Click to edit title"
                            >
                                {highlightSearchTerm(page.title, searchTerm)}
                            </span>
                        )}
                        {isRootPageCheck ? (
                            <button
                                onClick={handleHostnameClick}
                                className="text-xs text-gray-500 truncate hover:text-blue-600 hover:underline cursor-pointer transition-colors"
                                title="Click to edit hostnames"
                            >
                                {getPageDisplayUrl(sanitizedPage)}
                            </button>
                        ) : isEditingSlug ? (
                            <div className="flex items-center gap-1">
                                <span className="text-xs text-gray-500">/</span>
                                <input
                                    type="text"
                                    value={editingSlug}
                                    onChange={(e) => setEditingSlug(e.target.value)}
                                    onKeyDown={handleSlugKeyDown}
                                    className="truncate text-xs bg-white border border-blue-300 rounded px-1 py-0.5 focus:outline-none focus:ring-1 focus:ring-blue-500 min-w-0 flex-1"
                                    autoFocus
                                    disabled={updateSlugMutation.isPending}
                                />
                                <button
                                    onClick={handleSlugSave}
                                    disabled={updateSlugMutation.isPending}
                                    className="p-0.5 rounded hover:bg-green-100 text-green-600 transition-colors disabled:opacity-50"
                                    title="Save slug (Enter)"
                                >
                                    <Save className="w-4 h-4" />
                                </button>
                                <button
                                    onClick={handleSlugCancel}
                                    disabled={updateSlugMutation.isPending}
                                    className="p-0.5 rounded hover:bg-red-100 text-red-600 transition-colors disabled:opacity-50"
                                    title="Cancel (Escape)"
                                >
                                    <X className="w-4 h-4" />
                                </button>
                            </div>
                        ) : (
                            <span
                                className="text-xs text-gray-500 truncate cursor-pointer hover:text-blue-600 hover:underline transition-colors"
                                onClick={handleSlugClick}
                                title="Click to edit slug"
                            >
                                {highlightSearchTerm(getPageDisplayUrl(sanitizedPage), searchTerm)}
                            </span>
                        )}
                        <PublicationStatusIcon
                            pageId={page.id}
                            publicationStatus={page.publicationStatus}
                            canToggle={canTogglePublication()}
                            isToggling={isTogglingPublication}
                            onToggle={handlePublicationToggle}
                            latestVersionNumber={page.latestVersionNumber}
                            publishedVersionNumber={page.publishedVersionNumber}
                        />

                        {/* Error page badge */}
                        {(() => {
                            const slug = page.slug || '';
                            const isErrorCode = /^[45]\d{2}$/.test(slug);
                            if (isErrorCode) {
                                return (
                                    <Tooltip text={`HTTP ${slug} Error Page`} position="top">
                                        <span className="ml-1 px-1.5 py-0.5 text-xs font-medium bg-red-100 text-red-700 rounded border border-red-300">
                                            {slug}
                                        </span>
                                    </Tooltip>
                                );
                            }
                            return null;
                        })()}

                        {/* Hostname warning for top-level pages */}
                        {needsHostnameWarning && (
                            <Tooltip text="Missing hostname - This top-level page needs at least one hostname" position="top">
                                <div className="cursor-help ml-1">
                                    <AlertTriangle className="w-4 h-4 text-amber-500" />
                                </div>
                            </Tooltip>
                        )}
                    </div>
                </div>

                {/* Children count */}
                {hasChildren && (
                    <span className="text-xs text-gray-400 mr-2 cursor-help">
                        ({page.childrenCount})
                    </span>
                )}

                {/* Action buttons - always visible */}
                <div className="flex items-center gap-1">
                    <Tooltip text="Edit" position="top">
                        <button
                            onClick={(e) => {
                                e.stopPropagation()
                                handleEdit()
                            }}
                            className="p-1.5 rounded hover:bg-gray-200 text-gray-500 hover:text-blue-600 transition-colors"
                        >
                            <Edit className="w-4 h-4" />
                        </button>
                    </Tooltip>

                    <Tooltip text="Move up" position="top">
                        <button
                            onClick={(e) => {
                                e.stopPropagation()
                                handleMoveUp()
                            }}
                            disabled={!canMoveUp}
                            className="p-1.5 rounded hover:bg-blue-100 text-gray-500 hover:text-blue-600 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                        >
                            <ChevronUp className="w-4 h-4" />
                        </button>
                    </Tooltip>

                    <Tooltip text="Move down" position="top">
                        <button
                            onClick={(e) => {
                                e.stopPropagation()
                                handleMoveDown()
                            }}
                            disabled={!canMoveDown}
                            className="p-1.5 rounded hover:bg-blue-100 text-gray-500 hover:text-blue-600 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                        >
                            <ChevronDown className="w-4 h-4" />
                        </button>
                    </Tooltip>

                    <Tooltip text="Cut" position="top">
                        <button
                            onClick={(e) => {
                                e.stopPropagation()
                                handleCut()
                            }}
                            className="p-1.5 rounded hover:bg-gray-200 text-gray-500 hover:text-orange-600 transition-colors"
                        >
                            <Scissors className="w-4 h-4" />
                        </button>
                    </Tooltip>

                    <Tooltip text="Add child page" position="top">
                        <button
                            onClick={(e) => {
                                e.stopPropagation()
                                handleAddPageBelow()
                            }}
                            className="p-1.5 rounded hover:bg-green-100 text-gray-500 hover:text-green-600 transition-colors"
                        >
                            <Plus className="w-4 h-4" />
                        </button>
                    </Tooltip>

                    <Tooltip text="Import page tree as subpage of this page" position="top">
                        <button
                            onClick={(e) => {
                                e.stopPropagation()
                                handleImport()
                            }}
                            className="p-1.5 rounded hover:bg-blue-100 text-gray-500 hover:text-blue-600 transition-colors"
                        >
                            <Download className="w-4 h-4" />
                        </button>
                    </Tooltip>

                    {cutPageId && (
                        <>
                            <Tooltip text="Paste above" position="top">
                                <button
                                    onClick={(e) => {
                                        e.stopPropagation()
                                        onPaste?.(page, 'above')
                                    }}
                                    className="p-1.5 rounded hover:bg-green-100 text-gray-500 hover:text-green-700 transition-colors"
                                >
                                    <span className="text-xs font-semibold">📋↑</span>
                                </button>
                            </Tooltip>
                            <Tooltip text="Paste below" position="top">
                                <button
                                    onClick={(e) => {
                                        e.stopPropagation()
                                        onPaste?.(page, 'below')
                                    }}
                                    className="p-1.5 rounded hover:bg-green-100 text-gray-500 hover:text-green-700 transition-colors"
                                >
                                    <span className="text-xs font-semibold">📋↓</span>
                                </button>
                            </Tooltip>
                            <Tooltip text="Paste as child" position="top">
                                <button
                                    onClick={(e) => {
                                        e.stopPropagation()
                                        onPaste?.(page, 'child')
                                    }}
                                    className="p-1.5 rounded hover:bg-green-100 text-gray-500 hover:text-green-700 transition-colors"
                                >
                                    <span className="text-xs font-semibold">📋→</span>
                                </button>
                            </Tooltip>
                        </>
                    )}

                    <Tooltip text="Delete" position="top">
                        <button
                            onClick={(e) => {
                                e.stopPropagation()
                                handleDelete()
                            }}
                            className="p-1.5 rounded hover:bg-red-100 text-gray-500 hover:text-red-700 transition-colors"
                        >
                            <Trash2 className="w-4 h-4" />
                        </button>
                    </Tooltip>
                </div>
            </div>

            {/* Children */}
            {isExpanded && childrenRef.current && childrenRef.current.length > 0 && (
                <div className="ml-4">
                    {childrenRef.current.map((child, index) => (
                        <PageTreeNode
                            key={child.id}
                            page={child}
                            level={level + 1}
                            onEdit={onEdit}
                            onCut={onCut}
                            onPaste={onPaste}
                            onDelete={onDelete}
                            onAddPageBelow={onAddPageBelow}
                            onImport={onImport}
                            cutPageId={cutPageId}
                            isSearchMode={isSearchMode}
                            searchTerm={searchTerm}
                            rowHeight={rowHeight}
                            onMoveUp={handleChildMoveUp}
                            onMoveDown={handleChildMoveDown}
                            canMoveUp={index > 0}
                            canMoveDown={index < childrenRef.current.length - 1}
                            selectedPageIds={selectedPageIds}
                            onPageClick={onPageClick}
                            isSelectionMode={isSelectionMode}
                        />
                    ))}
                </div>
            )}

            {/* Hostname Editing Modal */}
            {showHostnameModal && (
                <HostnameEditModal
                    page={page}
                    onSave={(hostnamesData) => {
                        updateHostnamesMutation.mutate(hostnamesData)
                    }}
                    onCancel={() => setShowHostnameModal(false)}
                    isLoading={updateHostnamesMutation.isPending}
                />
            )}
        </div>
    )
}, (prevProps, nextProps) => {
    // Custom comparison function for React.memo
    // Only re-render if these specific props change

    // If selectedPageIds Set reference changed, we need to re-render to update selection visual state
    // This is simpler and more reliable than checking individual page selection
    if (prevProps.selectedPageIds !== nextProps.selectedPageIds) {
        return false // Re-render because selection changed
    }

    return (
        prevProps.page.id === nextProps.page.id &&
        prevProps.cutPageId === nextProps.cutPageId &&
        prevProps.rowHeight === nextProps.rowHeight &&
        prevProps.canMoveUp === nextProps.canMoveUp &&
        prevProps.canMoveDown === nextProps.canMoveDown &&
        prevProps.searchTerm === nextProps.searchTerm &&
        prevProps.level === nextProps.level &&
        prevProps.isSelectionMode === nextProps.isSelectionMode
    )
})

PageTreeNode.displayName = 'PageTreeNode'

// Hostname editing modal component
const HostnameEditModal = ({ page, onSave, onCancel, isLoading }) => {
    const [formData, setFormData] = useState({
        hostnames: page.hostnames ? page.hostnames.join(', ') : ''
    })

    const handleSubmit = (e) => {
        e.preventDefault()

        // Parse hostnames from comma-separated string
        const hostnamesArray = formData.hostnames
            .split(',')
            .map(h => h.trim())
            .filter(h => h.length > 0)

        const hostnamesData = {
            hostnames: hostnamesArray
        }

        onSave(hostnamesData)
    }

    return (
        <div className="fixed inset-0 bg-orange-50/10 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg shadow-xl p-6 w-full max-w-md mx-4">
                <div className="flex items-center justify-between mb-6">
                    <h3 className="text-lg font-medium text-gray-900">
                        Edit Hostnames for "{page.title}"
                    </h3>
                    <button
                        onClick={onCancel}
                        className="text-gray-400 hover:text-gray-500"
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="space-y-4">
                    <div>
                        <label htmlFor="hostnames" className="block text-sm font-medium text-gray-700 mb-1">
                            Hostnames *
                        </label>
                        <input
                            id="hostnames"
                            type="text"
                            value={formData.hostnames}
                            onChange={(e) => setFormData(prev => ({ ...prev, hostnames: e.target.value }))}
                            placeholder="example.com, www.example.com"
                            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                            required
                        />
                        <p className="text-xs text-gray-500 mt-1">
                            Enter hostnames separated by commas. Root pages need at least one hostname.
                        </p>
                    </div>

                    <div className="bg-blue-50 border border-blue-200 rounded-md p-3">
                        <p className="text-sm text-blue-800">
                            Root pages are accessed directly via these hostnames. Each hostname should point to your server.
                        </p>
                    </div>

                    <div className="flex items-center justify-end space-x-3 pt-4">
                        <button
                            type="button"
                            onClick={onCancel}
                            className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            disabled={isLoading}
                            className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
                        >
                            <Save className="w-4 h-4 mr-2" />
                            {isLoading ? 'Saving...' : 'Save Hostnames'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    )
}

export default PageTreeNode 