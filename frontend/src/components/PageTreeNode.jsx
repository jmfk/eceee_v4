import { useState, useCallback, useEffect, memo, useMemo, useRef } from 'react'
import { createPortal } from 'react-dom'
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
    Upload,
    MoreHorizontal,
} from 'lucide-react'
import { pagesApi } from '../api'
import { getPageDisplayUrl, isRootPage, sanitizePageData } from '../utils/apiValidation.js'
import Tooltip from './Tooltip'
import { useNotificationContext } from './NotificationManager'
import pageTreeUtils from '../utils/pageTreeUtils'

// Separate component for publication status icon that only re-renders when status changes
const PublicationStatusIcon = memo(({
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
                {canToggle ? (
                    <button
                        type="button"
                        disabled={isToggling}
                        aria-label={getTooltipText()}
                        className={`flex min-h-8 min-w-8 shrink-0 cursor-pointer items-center justify-center rounded transition-transform hover:scale-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 ${isToggling ? 'opacity-50' : ''}`}
                        onClick={(event) => {
                            event.stopPropagation()
                            onToggle()
                        }}
                    >
                        {isToggling ? <Loader2 className="h-3 w-3 animate-spin text-blue-500" /> : getStatusIcon()}
                    </button>
                ) : (
                    <span className="flex min-h-8 min-w-8 shrink-0 cursor-help items-center justify-center" aria-label={getTooltipText()}>
                        {getStatusIcon()}
                    </span>
                )}
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

const PageActionOverflowMenu = ({ page, pageTestId, actions }) => {
    const [isOpen, setIsOpen] = useState(false)
    const [position, setPosition] = useState({ top: 0, left: 0 })
    const buttonRef = useRef(null)
    const menuRef = useRef(null)

    useEffect(() => {
        if (!isOpen) return undefined

        const updatePosition = () => {
            if (!buttonRef.current) return

            const buttonRect = buttonRef.current.getBoundingClientRect()
            const menuWidth = Math.min(240, window.innerWidth - 16)
            const menuHeight = menuRef.current?.offsetHeight || 320
            const left = Math.max(8, Math.min(buttonRect.right - menuWidth, window.innerWidth - menuWidth - 8))
            const spaceBelow = window.innerHeight - buttonRect.bottom
            const top = spaceBelow >= menuHeight + 8
                ? buttonRect.bottom + 8
                : Math.max(8, buttonRect.top - menuHeight - 8)

            setPosition({ top, left })
        }

        const handlePointerDown = (event) => {
            if (!buttonRef.current?.contains(event.target) && !menuRef.current?.contains(event.target)) {
                setIsOpen(false)
            }
        }
        const handleKeyDown = (event) => {
            if (event.key === 'Escape') {
                setIsOpen(false)
                buttonRef.current?.focus()
            }
        }

        updatePosition()
        menuRef.current?.querySelector('button:not(:disabled)')?.focus()
        document.addEventListener('mousedown', handlePointerDown)
        document.addEventListener('keydown', handleKeyDown)
        window.addEventListener('resize', updatePosition)
        window.addEventListener('scroll', updatePosition, true)

        return () => {
            document.removeEventListener('mousedown', handlePointerDown)
            document.removeEventListener('keydown', handleKeyDown)
            window.removeEventListener('resize', updatePosition)
            window.removeEventListener('scroll', updatePosition, true)
        }
    }, [isOpen])

    const openMenu = (event) => {
        event.stopPropagation()
        setIsOpen(previous => !previous)
    }

    const runAction = (event, action) => {
        event.stopPropagation()
        if (action.disabled) return
        setIsOpen(false)
        action.onClick()
    }

    return (
        <>
            <Tooltip text="More page actions" position="top">
                <button
                    ref={buttonRef}
                    type="button"
                    data-testid={`page-tree-actions-${pageTestId}`}
                    onClick={openMenu}
                    aria-label={`More actions for ${page.title}`}
                    aria-haspopup="menu"
                    aria-expanded={isOpen}
                    className="flex min-h-11 min-w-11 items-center justify-center rounded text-gray-500 transition-colors hover:bg-gray-200 hover:text-gray-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 xl:hidden"
                >
                    <MoreHorizontal className="h-5 w-5" />
                </button>
            </Tooltip>
            {isOpen && createPortal(
                <div
                    ref={menuRef}
                    role="menu"
                    aria-label={`Actions for ${page.title}`}
                    data-testid={`page-tree-actions-menu-${pageTestId}`}
                    className="fixed z-[10020] max-h-[calc(100vh-1rem)] w-60 overflow-y-auto rounded-lg border border-gray-200 bg-white py-1 shadow-xl"
                    style={position}
                >
                    {actions.map((action) => {
                        const Icon = action.icon
                        return (
                            <button
                                key={action.label}
                                type="button"
                                role="menuitem"
                                data-testid={action.testId}
                                disabled={action.disabled}
                                onClick={(event) => runAction(event, action)}
                                className={`flex min-h-11 w-full items-center gap-3 px-4 py-2 text-left text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-blue-500 disabled:cursor-not-allowed disabled:opacity-40 ${action.danger ? 'text-red-700 hover:bg-red-50' : 'text-gray-700 hover:bg-gray-50'}`}
                            >
                                <Icon className="h-4 w-4 shrink-0" />
                                <span>{action.label}</span>
                            </button>
                        )
                    })}
                </div>,
                document.body
            )}
        </>
    )
}

const PageTreeNode = memo(({
    page: initialPage,
    level = 0,
    onEdit,
    onCut,
    onPaste,
    onDelete,
    onAddPageBelow,
    onImport,
    onExport,
    cutPageIds = [],
    copyPageIds = [],
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
    const isCut = useMemo(() => cutPageIds.includes(page.id), [cutPageIds, page.id])

    // Check if page is copied (memoized)
    const isCopied = useMemo(() => copyPageIds.includes(page.id), [copyPageIds, page.id])

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
    const pageTestId = useMemo(() => {
        const source = page.slug || page.title || String(page.id)
        const normalized = source
            .toString()
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, '-')
            .replace(/^-+|-+$/g, '')

        return normalized || String(page.id)
    }, [page.id, page.slug, page.title])

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

    const handleExport = () => {
        onExport?.(page)
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
            const updatePromises = newChildren.map(async (child) =>
                await pagesApi.update(child.id, { sortOrder: child.sortOrder })
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
            const updatePromises = newChildren.map(async (child) =>
                await pagesApi.update(child.id, { sortOrder: child.sortOrder })
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

    // Title click handler - opens page editor
    const handleTitleClick = () => {
        handleEdit()
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

    // Publish page mutation - uses new version-aware endpoint
    const publishPageMutation = useMutation({
        mutationFn: async () => {
            return await pagesApi.publishLatestVersion(page.id)
        },
        onSuccess: (response) => {
            setIsTogglingPublication(false)
            // Invalidate queries to refresh tree with new version data
            queryClient.invalidateQueries(['pages'])
            queryClient.invalidateQueries(['page-children'])
        },
        onError: (error) => {
            console.error('Failed to publish page:', error.response?.data?.detail || error.message)
            showError(error, 'error')
            setIsTogglingPublication(false)
        }
    })

    // Unpublish page mutation - uses new version-aware endpoint
    const unpublishPageMutation = useMutation({
        mutationFn: async () => {
            return await pagesApi.unpublishVersion(page.id, { mode: 'current' })
        },
        onSuccess: (response) => {
            setIsTogglingPublication(false)
            // Invalidate queries to refresh tree with new version data
            queryClient.invalidateQueries(['pages'])
            queryClient.invalidateQueries(['page-children'])
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

    const secondaryActions = [
        {
            label: 'Move up',
            icon: ChevronUp,
            onClick: handleMoveUp,
            disabled: !canMoveUp,
            desktopTestId: `page-tree-move-up-${pageTestId}`,
            testId: `page-tree-move-up-menu-${pageTestId}`,
        },
        {
            label: 'Move down',
            icon: ChevronDown,
            onClick: handleMoveDown,
            disabled: !canMoveDown,
            desktopTestId: `page-tree-move-down-${pageTestId}`,
            testId: `page-tree-move-down-menu-${pageTestId}`,
        },
        { label: 'Cut', icon: Scissors, onClick: handleCut, testId: `page-tree-cut-menu-${pageTestId}` },
        {
            label: 'Import as child',
            icon: Upload,
            onClick: handleImport,
            ariaLabel: `Import external site under ${page.title}`,
            testId: `page-tree-import-menu-${pageTestId}`,
        },
        ...(level === 0 && onExport ? [{
            label: 'Export site package',
            icon: Download,
            onClick: handleExport,
            ariaLabel: `Export root site package for ${page.title}`,
            testId: `page-tree-export-menu-${pageTestId}`,
        }] : []),
        ...((cutPageIds.length > 0 || copyPageIds.length > 0) ? [
            { label: 'Paste above', icon: FileText, onClick: () => onPaste?.(page, 'above') },
            { label: 'Paste below', icon: FileText, onClick: () => onPaste?.(page, 'below') },
            { label: 'Paste as child', icon: FileText, onClick: () => onPaste?.(page, 'child') },
        ] : []),
        { label: 'Delete', icon: Trash2, onClick: handleDelete, danger: true, testId: `page-tree-delete-menu-${pageTestId}` },
    ]

    return (
        <div className="select-none">
            {/* Main node */}
            <div
                data-testid={`page-tree-node-${pageTestId}`}
                className={`
                    page-tree-row flex flex-wrap items-start gap-x-2 px-2 ${rowHeight === 'spacious' ? 'py-4' : 'py-2.5'} ${isSelected ? 'hover:bg-blue-200' : 'hover:bg-gray-50'} group relative
                    ${isCut && isSelected ? 'opacity-70 bg-orange-100 border-l-4 border-blue-500 ring-2 ring-orange-300' : ''}
                    ${isCut && !isSelected ? 'opacity-60 bg-orange-50' : ''}
                    ${isCopied && isSelected && !isCut ? 'opacity-70 bg-green-100 border-l-4 border-blue-500 ring-2 ring-green-300' : ''}
                    ${isCopied && !isSelected && !isCut ? 'opacity-60 bg-green-50' : ''}
                    ${isSelected && !isCut && !isCopied ? 'bg-blue-100 border-l-4 border-blue-500' : ''}
                    ${page.isSearchResult && !isSelected && !isCut && !isCopied ? 'bg-blue-50 border-l-4 border-blue-400' : ''}
                    ${page.highlightSearch && !isSelected && !isCut && !isCopied ? 'bg-yellow-50 border-l-4 border-yellow-400' : ''}
                    ${level > 0 ? 'border-l border-gray-200' : ''}
                    ${isAnimating ? 'transition-all duration-500 ease-in-out' : ''}
                    ${animationDirection === 'up' ? 'transform -translate-y-8' : ''}
                    ${animationDirection === 'down' ? 'transform translate-y-8' : ''}
                    ${animationDirection === 'left' ? 'transform -translate-x-8' : ''}
                    ${animationDirection === 'right' ? 'transform translate-x-8' : ''}
                    ${onPageClick ? 'cursor-pointer' : ''}
                `}
                style={{
                    '--tree-indent-mobile': `${Math.min(level, 3) * 12 + 8}px`,
                    '--tree-indent-desktop': `${level * 24 + 8}px`,
                }}
                onClick={handleRowClick}
            >
                {/* Expand/collapse button */}
                <button
                    type="button"
                    data-testid={`page-tree-expand-${pageTestId}`}
                    onClick={(e) => {
                        e.stopPropagation()
                        handleToggleExpand()
                    }}
                    className={`
                            flex min-h-11 min-w-11 shrink-0 items-center justify-center rounded transition-all duration-200 hover:shadow-sm xl:min-h-8 xl:min-w-8
                            ${!hasChildren ? 'opacity-30 cursor-default' : 'hover:bg-gray-200'}
                        `}
                    disabled={isLoading || !hasChildren}
                    aria-label={`${isExpanded ? 'Collapse' : 'Expand'} ${page.title}`}
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
                <div className="min-w-0 flex-1 xl:flex xl:items-center xl:gap-3">
                    {/* Page identity */}
                    <div data-testid={`page-tree-identity-${pageTestId}`} className="flex min-w-0 items-start gap-2 xl:flex-1 xl:items-center">
                        <div className="flex min-h-8 shrink-0 items-center">{getFolderIcon()}</div>
                        {page.isSearchResult && (
                            <div className="flex min-h-8 shrink-0 items-center">
                                <Search className="w-3 h-3 text-blue-500" />
                            </div>
                        )}
                        <div className="min-w-0 flex-1">
                            <button
                                type="button"
                                className="block max-w-full truncate text-left text-sm font-medium transition-colors hover:text-blue-600 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
                                onClick={(event) => {
                                    event.stopPropagation()
                                    handleTitleClick()
                                }}
                                title={page.title}
                                aria-label={`Edit ${page.title}`}
                            >
                                {highlightSearchTerm(page.title, searchTerm)}
                            </button>
                            {isTopLevel ? (
                                <button
                                    type="button"
                                    onClick={(event) => {
                                        event.stopPropagation()
                                        handleHostnameClick()
                                    }}
                                    className="block max-w-full truncate text-left text-xs text-gray-500 transition-colors hover:text-blue-600 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
                                    title={sanitizedPage.hostnames?.[0] || 'Hostname missing — click to edit'}
                                >
                                    {sanitizedPage.hostnames?.[0] || '(hostname missing)'}
                                </button>
                            ) : isEditingSlug ? (
                                <div className="flex min-w-0 items-center gap-1" onClick={(event) => event.stopPropagation()}>
                                    <span className="text-xs text-gray-500">/</span>
                                    <input
                                        type="text"
                                        value={editingSlug}
                                        onChange={(event) => setEditingSlug(event.target.value)}
                                        onKeyDown={handleSlugKeyDown}
                                        className="min-w-0 flex-1 truncate rounded border border-blue-300 bg-white px-1 py-0.5 text-xs focus:outline-none focus:ring-1 focus:ring-blue-500"
                                        autoFocus
                                        disabled={updateSlugMutation.isPending}
                                        aria-label={`Slug for ${page.title}`}
                                    />
                                    <button type="button" onClick={handleSlugSave} disabled={updateSlugMutation.isPending} className="rounded p-1 text-green-600 hover:bg-green-100 disabled:opacity-50" title="Save slug (Enter)" aria-label="Save slug">
                                        <Save className="w-4 h-4" />
                                    </button>
                                    <button type="button" onClick={handleSlugCancel} disabled={updateSlugMutation.isPending} className="rounded p-1 text-red-600 hover:bg-red-100 disabled:opacity-50" title="Cancel (Escape)" aria-label="Cancel slug editing">
                                        <X className="w-4 h-4" />
                                    </button>
                                </div>
                            ) : (
                                <button
                                    type="button"
                                    className="block max-w-full truncate text-left text-xs text-gray-500 transition-colors hover:text-blue-600 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
                                    onClick={(event) => {
                                        event.stopPropagation()
                                        handleSlugClick()
                                    }}
                                    title={page.slug || 'Click to edit slug'}
                                >
                                    {highlightSearchTerm(page.slug || '', searchTerm)}
                                </button>
                            )}
                        </div>
                        {hasChildren && (
                            <span className="shrink-0 rounded-full bg-gray-100 px-1.5 py-0.5 text-xs text-gray-500" title={`${page.childrenCount} child pages`}>
                                {page.childrenCount}
                            </span>
                        )}
                    </div>

                    {/* Publication and version metadata */}
                    <div data-testid={`page-tree-metadata-${pageTestId}`} className="mt-1 flex min-w-0 flex-wrap items-center gap-1.5 pl-10 xl:mt-0 xl:shrink-0 xl:pl-0">
                        <PublicationStatusIcon
                            publicationStatus={page.publicationStatus}
                            canToggle={canTogglePublication()}
                            isToggling={isTogglingPublication}
                            onToggle={handlePublicationToggle}
                            latestVersionNumber={page.latestVersionNumber}
                            publishedVersionNumber={page.publishedVersionNumber}
                        />

                        {/* Version badges */}
                        <div className="flex flex-wrap items-center gap-1">
                            {/* Published version badge */}
                            {page.publishedVersionNumber && (
                                <Tooltip
                                    text={`Published version ${page.publishedVersionNumber}${page.publishedEffectiveDate ? ` on ${new Date(page.publishedEffectiveDate).toLocaleDateString()}` : ''}`}
                                    position="top"
                                >
                                    <span className="flex items-center gap-0.5 whitespace-nowrap rounded border border-green-200 bg-green-50 px-1 py-0.5 text-[10px] font-medium text-green-600 transition-colors hover:border-green-300 hover:bg-green-100 hover:text-green-700">
                                        📗 v{page.publishedVersionNumber}
                                    </span>
                                </Tooltip>
                            )}

                            {/* Draft version badge (if has unpublished changes) */}
                            {page.hasUnpublishedChanges && page.latestDraftVersionNumber && (
                                <Tooltip
                                    text={`Draft version ${page.latestDraftVersionNumber} (unpublished changes)`}
                                    position="top"
                                >
                                    <span className="flex items-center gap-0.5 whitespace-nowrap rounded border border-yellow-200 bg-yellow-50 px-1 py-0.5 text-[10px] font-medium text-yellow-600 transition-colors hover:border-yellow-300 hover:bg-yellow-100 hover:text-yellow-700">
                                        ✏️ v{page.latestDraftVersionNumber}
                                    </span>
                                </Tooltip>
                            )}

                            {/* Scheduled version badge */}
                            {page.scheduledVersionNumber && page.scheduledEffectiveDate && (
                                <Tooltip
                                    text={`Version ${page.scheduledVersionNumber} scheduled for ${new Date(page.scheduledEffectiveDate).toLocaleString()}`}
                                    position="top"
                                >
                                    <span className="flex items-center gap-0.5 whitespace-nowrap rounded border border-blue-200 bg-blue-50 px-1 py-0.5 text-[10px] font-medium text-blue-600 transition-colors hover:border-blue-300 hover:bg-blue-100 hover:text-blue-700">
                                        📅 v{page.scheduledVersionNumber} → {new Date(page.scheduledEffectiveDate).toLocaleDateString()}
                                    </span>
                                </Tooltip>
                            )}
                        </div>

                        {/* Error page badge */}
                        {(() => {
                            const slug = page.slug || '';
                            const isErrorCode = /^[45]\d{2}$/.test(slug);
                            if (isErrorCode) {
                                return (
                                    <Tooltip text={`HTTP ${slug} Error Page`} position="top">
                                        <span className="whitespace-nowrap rounded border border-red-300 bg-red-100 px-1.5 py-0.5 text-xs font-medium text-red-700">
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
                                <div className="cursor-help" aria-label="Missing hostname">
                                    <AlertTriangle className="w-4 h-4 text-amber-500" />
                                </div>
                            </Tooltip>
                        )}
                    </div>
                </div>

                {/* Primary actions stay visible; secondary actions collapse below xl. */}
                <div data-testid={`page-tree-primary-actions-${pageTestId}`} className="mt-1 flex w-full shrink-0 items-center justify-end gap-1 pl-10 sm:mt-0 sm:w-auto sm:pl-0">
                    <Tooltip text="Edit" position="top">
                        <button
                            type="button"
                            data-testid={`page-tree-edit-${pageTestId}`}
                            onClick={(e) => {
                                e.stopPropagation()
                                handleEdit()
                            }}
                            aria-label={`Edit ${page.title}`}
                            className="flex min-h-11 min-w-11 items-center justify-center rounded text-gray-500 transition-colors hover:bg-gray-200 hover:text-blue-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 xl:min-h-8 xl:min-w-8"
                        >
                            <Edit className="w-4 h-4" />
                        </button>
                    </Tooltip>

                    <Tooltip text="Add child page" position="top">
                        <button
                            type="button"
                            data-testid={`page-tree-add-child-${pageTestId}`}
                            onClick={(e) => {
                                e.stopPropagation()
                                handleAddPageBelow()
                            }}
                            aria-label={`Add child page under ${page.title}`}
                            className="flex min-h-11 min-w-11 items-center justify-center rounded text-gray-500 transition-colors hover:bg-green-100 hover:text-green-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 xl:min-h-8 xl:min-w-8"
                        >
                            <Plus className="w-4 h-4" />
                        </button>
                    </Tooltip>

                    <div className="hidden items-center gap-1 xl:flex">
                        {secondaryActions.map((action) => {
                            const Icon = action.icon
                            return (
                                <Tooltip key={action.label} text={action.label} position="top">
                                    <button
                                        type="button"
                                        data-testid={action.desktopTestId}
                                        onClick={(event) => {
                                            event.stopPropagation()
                                            action.onClick()
                                        }}
                                        disabled={action.disabled}
                                        aria-label={action.ariaLabel || `${action.label} ${page.title}`}
                                        className={`flex min-h-8 min-w-8 items-center justify-center rounded transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 disabled:cursor-not-allowed disabled:opacity-30 ${action.danger ? 'text-gray-500 hover:bg-red-100 hover:text-red-700' : 'text-gray-500 hover:bg-gray-200 hover:text-blue-600'}`}
                                    >
                                        <Icon className="h-4 w-4" />
                                    </button>
                                </Tooltip>
                            )
                        })}
                    </div>

                    <PageActionOverflowMenu page={page} pageTestId={pageTestId} actions={secondaryActions} />
                </div>
            </div>

            {/* Children */}
            {isExpanded && childrenRef.current && childrenRef.current.length > 0 && (
                <div>
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
                            onExport={onExport}
                            cutPageIds={cutPageIds}
                            copyPageIds={copyPageIds}
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

    // Compare array props by stringifying for simplicity
    const cutPageIdsChanged = JSON.stringify(prevProps.cutPageIds) !== JSON.stringify(nextProps.cutPageIds)
    const copyPageIdsChanged = JSON.stringify(prevProps.copyPageIds) !== JSON.stringify(nextProps.copyPageIds)

    if (cutPageIdsChanged || copyPageIdsChanged) {
        return false // Re-render because clipboard changed
    }

    // Check for version-related changes
    const versionChanged = (
        prevProps.page.publishedVersionNumber !== nextProps.page.publishedVersionNumber ||
        prevProps.page.latestDraftVersionNumber !== nextProps.page.latestDraftVersionNumber ||
        prevProps.page.scheduledVersionNumber !== nextProps.page.scheduledVersionNumber ||
        prevProps.page.hasUnpublishedChanges !== nextProps.page.hasUnpublishedChanges
    )

    if (versionChanged) {
        return false // Re-render because version data changed
    }

    return (
        prevProps.page.id === nextProps.page.id &&
        prevProps.page.title === nextProps.page.title &&
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
                    <div className="text-lg font-medium text-gray-900" role="heading" aria-level="3">
                        Edit Hostnames for "{page.title}"
                    </div>
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
                        <div className="text-xs text-gray-500 mt-1">
                            Enter hostnames separated by commas. Root pages need at least one hostname.
                        </div>
                    </div>

                    <div className="bg-blue-50 border border-blue-200 rounded-md p-3">
                        <div className="text-sm text-blue-800">
                            Root pages are accessed directly via these hostnames. Each hostname should point to your server.
                        </div>
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
