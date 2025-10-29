import { useState, useEffect, useCallback, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
    Search,
    Plus,
    RefreshCw,
    Filter,
    Scissors,
    FolderPlus,
    AlertCircle,
    Loader2,
    X,
    Save,
    AlignJustify,
    Download
} from 'lucide-react'
import { pagesApi } from '../api'
import { deletePage } from '../api/pages'
import PageTreeNode from './PageTreeNode'
import TreeImporterModalV2 from './TreeImporterModalV2'
import BulkActionsToolbar from './BulkActionsToolbar'
import Tooltip from './Tooltip'
import { useNotificationContext } from './NotificationManager'
import { useGlobalNotifications } from '../contexts/GlobalNotificationContext'
import pageTreeUtils from '../utils/pageTreeUtils'
import DeletedPagesView from './DeletedPagesView'

// Search helper function - excludes root pages
const searchAllPages = async (searchTerm, filters = {}) => {
    return await pagesApi.list({
        search: searchTerm,
        parent_isnull: 'false', // Exclude root pages (only show child pages)
        ...filters
    })
}

// Debounce hook for search
const useDebounce = (value, delay) => {
    const [debouncedValue, setDebouncedValue] = useState(value)

    useEffect(() => {
        const handler = setTimeout(() => {
            setDebouncedValue(value)
        }, delay)

        return () => {
            clearTimeout(handler)
        }
    }, [value, delay])

    return debouncedValue
}

const TreePageManager = () => {
    const navigate = useNavigate()

    // State management
    const pagesRef = useRef([])
    const [, forceUpdate] = useState({})
    const [activeTab, setActiveTab] = useState('active') // 'active' or 'deleted'
    const [searchTerm, setSearchTerm] = useState('')
    const [showFilters, setShowFilters] = useState(false)
    const [statusFilter, setStatusFilter] = useState('all')
    const [cutPageIds, setCutPageIds] = useState([])
    const [showCreateModal, setShowCreateModal] = useState(false)
    const [showRootPageModal, setShowRootPageModal] = useState(false)
    const [showImportModal, setShowImportModal] = useState(false)
    const [importParentPage, setImportParentPage] = useState(null)
    const [positioningParams, setPositioningParams] = useState(null)
    const [searchResults, setSearchResults] = useState([])
    const [isSearching, setIsSearching] = useState(false)

    // Multi-select state
    const [selectedPageIds, setSelectedPageIds] = useState(new Set())
    const [lastSelectedId, setLastSelectedId] = useState(null)
    const [copyPageIds, setCopyPageIds] = useState([])
    const [isBulkProcessing, setIsBulkProcessing] = useState(false)

    // Row height preference from localStorage
    const [rowHeight, setRowHeight] = useState(() => {
        return localStorage.getItem('pageTreeRowHeight') || 'compact'
    })

    const queryClient = useQueryClient()
    const { showError, showConfirm } = useNotificationContext()
    const { addNotification } = useGlobalNotifications()

    // Debounce search term to avoid excessive API calls
    const debouncedSearchTerm = useDebounce(searchTerm, 300)

    // Note: Search result expansion is now handled by individual PageTreeNode components
    // Each node can check if it's in the search hierarchy path and expand accordingly

    // Create page mutation
    const createPageMutation = useMutation({
        mutationFn: async (pageData) => {
            return await pagesApi.create(pageData)
        },
        onMutate: () => {
            addNotification('Creating page...', 'info', 'page-create')
        },
        onSuccess: (newPage) => {
            setShowCreateModal(false)
            setPositioningParams(null)
            // Invalidate queries to refresh data
            queryClient.invalidateQueries(['pages', 'root'])
            addNotification(`Page "${newPage.title}" created successfully`, 'success', 'page-create')

            // Check for slug warnings
            if (newPage.warnings && newPage.warnings.length > 0) {
                newPage.warnings.forEach(warning => {
                    if (warning.field === 'slug') {
                        addNotification(
                            `Note: ${warning.message}`,
                            'warning',
                            `slug-warning-${newPage.id}`
                        )
                    }
                })
            }
        },
        onError: (error) => {
            console.error('Failed to create page:', error.response?.data?.detail || error.message)
            showError(error, 'error')
            addNotification('Failed to create page', 'error', 'page-create')
        }
    })

    // Create root page mutation
    const createRootPageMutation = useMutation({
        mutationFn: async (pageData) => {
            return await pagesApi.create(pageData)
        },
        onMutate: () => {
            addNotification('Creating root page...', 'info', 'page-create-root')
        },
        onSuccess: (newPage) => {
            setShowRootPageModal(false)
            // Invalidate queries to refresh data
            queryClient.invalidateQueries(['pages', 'root'])
            addNotification(`Root page "${newPage.title}" created successfully`, 'success', 'page-create-root')

            // Check for slug warnings
            if (newPage.warnings && newPage.warnings.length > 0) {
                newPage.warnings.forEach(warning => {
                    if (warning.field === 'slug') {
                        addNotification(
                            `Note: ${warning.message}`,
                            'warning',
                            `slug-warning-${newPage.id}`
                        )
                    }
                })
            }
        },
        onError: (error) => {
            console.error('Failed to create root page:', error.response?.data?.detail || error.message)
            showError(error, 'error')
            addNotification('Failed to create root page', 'error', 'page-create-root')
        }
    })

    // Fetch root pages
    const {
        data: rootPagesData,
        isLoading,
        error,
        refetch
    } = useQuery({
        queryKey: ['pages', 'root', { search: debouncedSearchTerm, status: statusFilter }],
        queryFn: () => {
            const filters = {}
            if (debouncedSearchTerm) filters.search = debouncedSearchTerm
            if (statusFilter !== 'all') filters.publicationStatus = statusFilter
            return pagesApi.getRootPages(filters)
        },
        enabled: !debouncedSearchTerm, // Only fetch root pages when not searching
        staleTime: 30000, // Cache for 30 seconds
        refetchOnWindowFocus: false
    })

    // Comprehensive search query
    const {
        data: searchData,
        isLoading: searchLoading,
        error: searchError
    } = useQuery({
        queryKey: ['pages', 'search', { search: debouncedSearchTerm, status: statusFilter }],
        queryFn: () => {
            const filters = {}
            if (statusFilter !== 'all') filters.publicationStatus = statusFilter
            return searchAllPages(debouncedSearchTerm, filters)
        },
        enabled: !!debouncedSearchTerm && debouncedSearchTerm.length >= 2, // Only search when term is 2+ characters
        staleTime: 30000 // Cache search results for 30 seconds
    })

    // Add loading notifications for data fetching (after variables are declared)
    useEffect(() => {
        if (isLoading) {
            addNotification('Loading pages...', 'info', 'pages-loading')
        } else if (rootPagesData) {
            addNotification(`Loaded ${rootPagesData.length || 0} pages`, 'success', 'pages-loading')
        }
    }, [isLoading, rootPagesData])

    useEffect(() => {
        if (searchLoading) {
            addNotification(`Searching for "${debouncedSearchTerm}"...`, 'info', 'pages-search')
        } else if (searchData && debouncedSearchTerm) {
            addNotification(`Found ${searchData.length || 0} pages matching "${debouncedSearchTerm}"`, 'success', 'pages-search')
        }
    }, [searchLoading, searchData, debouncedSearchTerm])

    // Add notifications for user interactions  
    useEffect(() => {
        if (searchTerm) {
            addNotification(`Search term: "${searchTerm}"`, 'info', 'search-input')
        }
    }, [searchTerm])

    useEffect(() => {
        if (statusFilter !== 'all') {
            addNotification(`Filter: ${statusFilter} pages`, 'info', 'filter-change')
        } else {
            addNotification('Showing all pages', 'info', 'filter-change')
        }
    }, [statusFilter])

    // Function to handle refresh with notification
    const handleRefresh = useCallback(async () => {
        addNotification('Refreshing pages...', 'info', 'pages-refresh')

        // Use refetchQueries to force immediate refetch regardless of staleTime
        await queryClient.refetchQueries({
            queryKey: ['pages'],
            type: 'active' // Only refetch currently active queries
        })

        addNotification('Pages refreshed', 'success', 'pages-refresh')
    }, [addNotification, queryClient])

    // Move page mutation (for cut/paste)
    const movePageMutation = useMutation({
        mutationFn: ({ pageId, parentId, sortOrder }) =>
            pagesApi.update(pageId, { parentId: parentId, sortOrder: sortOrder }),
        onMutate: () => {
            addNotification('Moving page...', 'info', 'page-move')
        },
        onSuccess: async () => {
            // Clear local state to prevent duplication
            pagesRef.current = []
            forceUpdate({})

            // Clear cache and refetch all page queries
            queryClient.removeQueries({ queryKey: ['pages'] })
            queryClient.removeQueries({ queryKey: ['page-children'] })

            // Wait a moment for backend transaction to commit, then refetch
            setTimeout(async () => {
                await queryClient.refetchQueries({ queryKey: ['pages'], type: 'active' })
            }, 100)

            addNotification('Page moved successfully', 'success', 'page-move')
        },
        onError: (error) => {
            console.error('Failed to move page:', error.message)
            showError(error, 'error')
            addNotification('Failed to move page', 'error', 'page-move')
        }
    })

    // Delete page mutation
    const deletePageMutation = useMutation({
        mutationFn: deletePage,
        onMutate: () => {
            addNotification('Deleting page...', 'info', 'page-delete')
        },
        onSuccess: () => {
            // Invalidate relevant queries to refresh data
            queryClient.invalidateQueries({ queryKey: ['pages', 'root'] })
            queryClient.invalidateQueries({ queryKey: ['page-children'] })
            addNotification('Page deleted successfully', 'success', 'page-delete')
        },
        onError: (error) => {
            console.error('Failed to delete page:', error.message)
            showError(error, 'error')
            addNotification('Failed to delete page', 'error', 'page-delete')
        }
    })

    // Toggle row height
    const toggleRowHeight = useCallback(() => {
        const newHeight = rowHeight === 'compact' ? 'spacious' : 'compact'
        setRowHeight(newHeight)
        localStorage.setItem('pageTreeRowHeight', newHeight)
        addNotification(`Row height: ${newHeight}`, 'info', 'row-height-toggle')
    }, [rowHeight, addNotification])

    // Format pages for tree display
    const formatPage = useCallback((pageData) => {
        return pageTreeUtils.formatPageForTree(pageData)
    }, [])

    // Update pages when data changes
    useEffect(() => {
        if (rootPagesData?.results) {
            // Simply format and set pages - each node manages its own expansion and children
            const formattedPages = rootPagesData.results.map(page => {
                const formatted = formatPage(page)
                // Auto-expand root pages on initial load
                formatted.isExpanded = true
                return formatted
            })

            pagesRef.current = formattedPages
            forceUpdate({})
        }
    }, [rootPagesData, formatPage])

    // Process search results
    useEffect(() => {
        if (searchData?.results && debouncedSearchTerm) {
            setIsSearching(true)
            setSearchResults(searchData.results)
        } else if (!debouncedSearchTerm) {
            setIsSearching(false)
            setSearchResults([])
        }
    }, [searchData, debouncedSearchTerm])

    // Handle move up - simple swap like in PageTreeNode
    const handleMoveUp = useCallback(async (pageId) => {
        const pageIndex = pagesRef.current.findIndex(p => p.id === pageId)

        // Boundary check
        if (pageIndex <= 0) return

        const currentPage = pagesRef.current[pageIndex]
        const previousPage = pagesRef.current[pageIndex - 1]

        // Swap in local array
        const newPages = [...pagesRef.current]
        newPages[pageIndex] = previousPage
        newPages[pageIndex - 1] = currentPage

        // Update sortOrder for all pages
        newPages.forEach((page, index) => {
            page.sortOrder = index * 10
        })

        pagesRef.current = newPages

        // Update server
        try {
            addNotification('Moving page up...', 'info', 'page-move-up')
            const updatePromises = newPages.map(page =>
                pagesApi.update(page.id, { sortOrder: page.sortOrder })
            )
            await Promise.all(updatePromises)
            forceUpdate({})
            addNotification('Page moved up', 'success', 'page-move-up')
        } catch (error) {
            console.error('Failed to move page up:', error)
            showError(error, 'error')
            addNotification('Failed to move page up', 'error', 'page-move-up')
            // Reload on error
            refetch()
        }
    }, [addNotification, showError, refetch])

    // Handle move down - simple swap like in PageTreeNode
    const handleMoveDown = useCallback(async (pageId) => {
        const pageIndex = pagesRef.current.findIndex(p => p.id === pageId)

        // Boundary check
        if (pageIndex < 0 || pageIndex >= pagesRef.current.length - 1) return

        const currentPage = pagesRef.current[pageIndex]
        const nextPage = pagesRef.current[pageIndex + 1]

        // Swap in local array
        const newPages = [...pagesRef.current]
        newPages[pageIndex] = nextPage
        newPages[pageIndex + 1] = currentPage

        // Update sortOrder for all pages
        newPages.forEach((page, index) => {
            page.sortOrder = index * 10
        })

        pagesRef.current = newPages

        // Update server
        try {
            addNotification('Moving page down...', 'info', 'page-move-down')
            const updatePromises = newPages.map(page =>
                pagesApi.update(page.id, { sortOrder: page.sortOrder })
            )
            await Promise.all(updatePromises)
            forceUpdate({})
            addNotification('Page moved down', 'success', 'page-move-down')
        } catch (error) {
            console.error('Failed to move page down:', error)
            showError(error, 'error')
            addNotification('Failed to move page down', 'error', 'page-move-down')
            // Reload on error
            refetch()
        }
    }, [addNotification, showError, refetch])

    // Note: loadChildren is now handled by each PageTreeNode independently
    // No need for central loading or expand/collapse tracking

    // Cut/Copy/Paste handlers
    const handleCut = useCallback((pageId) => {
        setCutPageIds([pageId])
        setCopyPageIds([]) // Clear copy clipboard when cutting
    }, [])

    const handlePaste = useCallback(async (targetPage, pasteMode = 'child') => {
        const isCutOperation = cutPageIds.length > 0
        const isCopyOperation = copyPageIds.length > 0
        const sourcePageIds = isCutOperation ? cutPageIds : copyPageIds

        if (sourcePageIds.length === 0 || !targetPage) return

        try {
            let newParentId = null
            let baseSortOrder = 0

            // Calculate new parent and base sort order based on paste mode
            if (pasteMode === 'child') {
                newParentId = targetPage.id
                baseSortOrder = 0
            } else if (pasteMode === 'top' || pasteMode === 'bottom') {
                newParentId = null
                baseSortOrder = pasteMode === 'top' ? -1 : 999999
            } else if (pasteMode === 'above' || pasteMode === 'below') {
                // targetPage is now the full page object with parent info
                newParentId = targetPage.parent?.id || null
                baseSortOrder = pasteMode === 'above' ?
                    pageTreeUtils.calculateSortOrderAbove([], targetPage) :
                    pageTreeUtils.calculateSortOrderBelow([], targetPage)
            }

            // Paste all pages in order
            for (let i = 0; i < sourcePageIds.length; i++) {
                const sourcePageId = sourcePageIds[i]
                const newSortOrder = baseSortOrder + (i * 10) // Space pages 10 units apart

                if (isCutOperation) {
                    // Move the page
                    await movePageMutation.mutateAsync({
                        pageId: sourcePageId,
                        parentId: newParentId,
                        sortOrder: newSortOrder
                    })
                } else {
                    // Copy operation - duplicate the page
                    const duplicatedPage = await pagesApi.duplicate(sourcePageId)
                    // Move the duplicated page to the target location
                    await pagesApi.update(duplicatedPage.id, {
                        parentId: newParentId,
                        sortOrder: newSortOrder
                    })
                }
            }

            // Clear clipboard only for cut operations
            if (isCutOperation) {
                setCutPageIds([])
            }

            addNotification(
                `${isCutOperation ? 'Moved' : 'Copied'} ${sourcePageIds.length} page(s)`,
                'success',
                'paste-operation'
            )
        } catch (error) {
            console.error('Failed to paste pages:', error)
            showError(error, 'error')
            addNotification('Failed to paste pages', 'error', 'paste-operation')
        }
    }, [cutPageIds, copyPageIds, movePageMutation, showError, addNotification])

    // Delete handler
    const handleDelete = useCallback(async (pageId) => {
        try {
            await deletePageMutation.mutateAsync(pageId)
            // Force refetch to update the tree
            await refetch()
        } catch (error) {
            console.error('Delete error:', error)
            showError(error, 'error')
        }
    }, [deletePageMutation, refetch, showError])

    // Edit handler
    const handleEdit = useCallback((page) => {
        navigate(`/pages/${page.id}/edit/content`, {
            state: { previousView: '/pages' }
        })
    }, [navigate])

    // Add child page handler
    const handleAddPageBelow = useCallback((targetPage) => {
        navigate('/pages/new/content', {
            state: {
                previousView: '/pages',
                parentPage: targetPage,
                parentId: targetPage.id,
                suggestedSortOrder: 0
            }
        })
    }, [navigate])

    // Handle create new page
    const handleCreateNewPage = useCallback(() => {
        addNotification('Opening new page editor...', 'info', 'navigation')
        navigate('/pages/new/content', {
            state: { previousView: '/pages' }
        })
    }, [navigate, addNotification])

    // Handle create root page
    const handleCreateRootPage = useCallback(() => {
        addNotification('Opening create root page dialog...', 'info', 'modal-open')
        setShowRootPageModal(true)
    }, [addNotification])

    // Handle import tree
    const handleImportTree = useCallback((parentPage = null) => {
        setImportParentPage(parentPage)
        setShowImportModal(true)
    }, [])

    const handleImportSuccess = useCallback(async () => {
        addNotification('Page tree imported successfully', 'success', 'import-success')
        addNotification('Refreshing page tree...', 'info', 'tree-refresh')

        // Clear cache and refetch to ensure complete refresh
        queryClient.removeQueries({ queryKey: ['pages'] })
        queryClient.removeQueries({ queryKey: ['page-children'] })

        await queryClient.refetchQueries({ queryKey: ['pages'], type: 'active' })

        addNotification('Page tree refreshed', 'success', 'tree-refresh')
    }, [addNotification, queryClient])

    // Clear clipboard
    const clearClipboard = () => {
        addNotification('Clipboard cleared', 'info', 'clipboard')
        setCutPageIds([])
        setCopyPageIds([])
    }

    // Selection handlers
    const handlePageClick = useCallback((pageId, event) => {
        if (event.ctrlKey || event.metaKey) {
            // Ctrl/Cmd+Click: Toggle selection
            setSelectedPageIds(prev => {
                const newSet = new Set(prev)
                if (newSet.has(pageId)) {
                    newSet.delete(pageId)
                } else {
                    newSet.add(pageId)
                }
                return newSet
            })
            setLastSelectedId(pageId)
        } else if (event.shiftKey && lastSelectedId) {
            // Shift+Click: Select range
            // Find all page IDs in order
            const allPageIds = []
            const collectIds = (pages) => {
                pages.forEach(page => {
                    allPageIds.push(page.id)
                    if (page.children && page.children.length > 0) {
                        collectIds(page.children)
                    }
                })
            }
            collectIds(pagesRef.current)

            const lastIndex = allPageIds.indexOf(lastSelectedId)
            const currentIndex = allPageIds.indexOf(pageId)
            if (lastIndex !== -1 && currentIndex !== -1) {
                const start = Math.min(lastIndex, currentIndex)
                const end = Math.max(lastIndex, currentIndex)
                const rangeIds = allPageIds.slice(start, end + 1)
                setSelectedPageIds(new Set(rangeIds))
            }
        } else {
            // Regular click: Select single page
            setSelectedPageIds(new Set([pageId]))
            setLastSelectedId(pageId)
        }
    }, [lastSelectedId])

    const handleClearSelection = useCallback(() => {
        setSelectedPageIds(new Set())
        setLastSelectedId(null)
        addNotification('Selection cleared', 'info', 'selection-clear')
    }, [addNotification])

    // Keyboard handler for Escape
    useEffect(() => {
        const handleKeyDown = (event) => {
            if (event.key === 'Escape' && selectedPageIds.size > 0) {
                handleClearSelection()
            }
        }
        window.addEventListener('keydown', handleKeyDown)
        return () => window.removeEventListener('keydown', handleKeyDown)
    }, [selectedPageIds.size, handleClearSelection])

    // Bulk operation handlers
    const handleBulkCut = useCallback(() => {
        const idsArray = Array.from(selectedPageIds)
        setCutPageIds(idsArray)
        setCopyPageIds([]) // Clear copy clipboard when cutting
        setSelectedPageIds(new Set())
        addNotification(`Cut ${idsArray.length} page(s)`, 'info', 'bulk-cut')
    }, [selectedPageIds, addNotification])

    const handleBulkCopy = useCallback(() => {
        const idsArray = Array.from(selectedPageIds)
        setCopyPageIds(idsArray)
        setCutPageIds([]) // Clear cut clipboard when copying
        setSelectedPageIds(new Set())
        addNotification(`Copied ${idsArray.length} page(s)`, 'info', 'bulk-copy')
    }, [selectedPageIds, addNotification])

    const handleBulkDuplicate = useCallback(async () => {
        const idsArray = Array.from(selectedPageIds)
        setIsBulkProcessing(true)
        addNotification(`Duplicating ${idsArray.length} page(s)...`, 'info', 'bulk-duplicate')

        let successCount = 0
        let errorCount = 0

        for (const pageId of idsArray) {
            try {
                await pagesApi.duplicate(pageId)
                successCount++
            } catch (error) {
                console.error(`Failed to duplicate page ${pageId}:`, error)
                errorCount++
            }
        }

        setIsBulkProcessing(false)
        setSelectedPageIds(new Set())

        queryClient.removeQueries({ queryKey: ['pages'] })
        await queryClient.refetchQueries({ queryKey: ['pages'], type: 'active' })

        if (errorCount === 0) {
            addNotification(`Successfully duplicated ${successCount} page(s)`, 'success', 'bulk-duplicate')
        } else {
            addNotification(
                `Duplicated ${successCount} page(s) with ${errorCount} error(s)`,
                'warning',
                'bulk-duplicate'
            )
        }
    }, [selectedPageIds, addNotification, queryClient])

    const handleBulkPublish = useCallback(async () => {
        const idsArray = Array.from(selectedPageIds)
        setIsBulkProcessing(true)
        addNotification(`Publishing ${idsArray.length} page(s)...`, 'info', 'bulk-publish')

        try {
            const result = await pagesApi.bulkPublish(idsArray)
            setIsBulkProcessing(false)
            setSelectedPageIds(new Set())

            queryClient.removeQueries({ queryKey: ['pages'] })
            await queryClient.refetchQueries({ queryKey: ['pages'], type: 'active' })

            addNotification(result.message || 'Pages published successfully', 'success', 'bulk-publish')
        } catch (error) {
            setIsBulkProcessing(false)
            console.error('Failed to bulk publish:', error)
            showError(error, 'error')
            addNotification('Failed to publish pages', 'error', 'bulk-publish')
        }
    }, [selectedPageIds, addNotification, queryClient, showError])

    const handleBulkUnpublish = useCallback(async () => {
        const idsArray = Array.from(selectedPageIds)
        setIsBulkProcessing(true)
        addNotification(`Unpublishing ${idsArray.length} page(s)...`, 'info', 'bulk-unpublish')

        try {
            const result = await pagesApi.bulkUnpublish(idsArray)
            setIsBulkProcessing(false)
            setSelectedPageIds(new Set())

            queryClient.removeQueries({ queryKey: ['pages'] })
            await queryClient.refetchQueries({ queryKey: ['pages'], type: 'active' })

            addNotification(result.message || 'Pages unpublished successfully', 'success', 'bulk-unpublish')
        } catch (error) {
            setIsBulkProcessing(false)
            console.error('Failed to bulk unpublish:', error)
            showError(error, 'error')
            addNotification('Failed to unpublish pages', 'error', 'bulk-unpublish')
        }
    }, [selectedPageIds, addNotification, queryClient, showError])

    const handleBulkDelete = useCallback(async () => {
        const idsArray = Array.from(selectedPageIds)

        // Fetch all descendants for selected pages to show what will be deleted
        let allAffectedPages = []
        let message = ''

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

            addNotification('Loading page details...', 'info', 'bulk-delete-check')

            // Fetch details and descendants for all selected pages
            for (const pageId of idsArray) {
                try {
                    const pageDetails = await pagesApi.get(pageId)
                    allAffectedPages.push(pageDetails)

                    // If page has children, fetch all descendants
                    if (pageDetails.childrenCount > 0) {
                        const descendants = await fetchAllDescendants(pageId)
                        allAffectedPages.push(...descendants)
                    }
                } catch (error) {
                    console.error(`Error fetching details for page ${pageId}:`, error)
                }
            }

            // Remove duplicates (in case of overlapping hierarchies)
            const uniquePages = Array.from(new Map(allAffectedPages.map(p => [p.id, p])).values())

            if (uniquePages.length > idsArray.length) {
                // Show the list of affected pages
                const pageList = uniquePages.slice(0, 10).map(p => `• ${p.title}`).join('\n')
                const moreText = uniquePages.length > 10 ? `\n... and ${uniquePages.length - 10} more pages` : ''

                message = `⚠️ RECURSIVE DELETION\n\nYou selected ${idsArray.length} page(s), but deleting them will also delete ALL ${uniquePages.length - idsArray.length} subpage(s):\n\n${pageList}${moreText}\n\nTotal pages to delete: ${uniquePages.length}\n\nThis action cannot be undone.`
            } else {
                message = `Are you sure you want to delete ${idsArray.length} page(s)?\n\nThis action cannot be undone.`
            }
        } catch (error) {
            console.error('Error fetching page details:', error)
            message = `⚠️ RECURSIVE DELETION\n\nAre you sure you want to delete ${idsArray.length} selected page(s)?\n\nNote: All subpages will also be deleted recursively.\n\nThis action cannot be undone.`
        }

        const confirmed = await showConfirm({
            title: 'Delete Pages',
            message: message,
            confirmText: 'Delete',
            confirmButtonStyle: 'danger'
        })

        if (!confirmed) return

        setIsBulkProcessing(true)
        addNotification(`Deleting pages...`, 'info', 'bulk-delete')

        try {
            const result = await pagesApi.bulkDelete(idsArray, true)
            setIsBulkProcessing(false)
            setSelectedPageIds(new Set())

            // Clear the cache completely before refetching
            queryClient.removeQueries({ queryKey: ['pages'] })
            queryClient.removeQueries({ queryKey: ['page-children'] })

            // Force refetch with fresh data
            await queryClient.refetchQueries({ queryKey: ['pages'], type: 'active' })

            addNotification(result.message || `Successfully deleted ${result.totalDeleted || result.total_deleted} page(s)`, 'success', 'bulk-delete')
        } catch (error) {
            setIsBulkProcessing(false)
            console.error('Failed to bulk delete:', error)
            showError(error, 'error')
            addNotification('Failed to delete pages', 'error', 'bulk-delete')
        }
    }, [selectedPageIds, addNotification, queryClient, showError, showConfirm])

    // Handle clear search with notification
    const handleClearSearch = useCallback(() => {
        addNotification('Search cleared', 'info', 'search-clear')
        setSearchTerm('')
    }, [addNotification])

    // Handle modal close with notification
    const handleModalClose = useCallback((modalType) => {
        addNotification(`${modalType} dialog closed`, 'info', 'modal-close')
    }, [addNotification])

    if (error) {
        return (
            <div className="p-6 text-center">
                <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
                <h3 className="text-lg font-semibold text-gray-900 mb-2">Failed to load pages</h3>
                <p className="text-gray-600 mb-4">{error.message}</p>
                <button
                    onClick={handleRefresh}
                    className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                >
                    Try Again
                </button>
            </div>
        )
    }

    // Handle search error
    if (searchError && searchTerm) {
        return (
            <div className="p-6 text-center">
                <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
                <h3 className="text-lg font-semibold text-gray-900 mb-2">Search failed</h3>
                <p className="text-gray-600 mb-4">{searchError.message}</p>
                <button
                    onClick={handleClearSearch}
                    className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                >
                    Clear Search
                </button>
            </div>
        )
    }

    return (
        <div className="flex flex-col bg-white shadow-lg rounded-lg overflow-hidden" style={{ height: 'calc(100vh - 200px)' }}>
            {/* Fixed Header - combines title, bulk actions, and controls */}
            <div className="flex-shrink-0">
                {/* Main Header - Title and Actions in One Row */}
                <div className="border-b border-gray-200 p-4 space-y-4 bg-white">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-4">
                            <h2 className="text-lg font-semibold text-gray-900">Page Tree Manager</h2>

                            {/* Tabs - Material Design Underline Style */}
                            <div className="flex items-center border-l border-gray-300 pl-4">
                                <button
                                    onClick={() => setActiveTab('active')}
                                    className={`px-4 py-2 text-sm font-medium transition-all relative ${activeTab === 'active'
                                        ? 'text-blue-600'
                                        : 'text-gray-600 hover:text-gray-900'
                                        }`}
                                >
                                    Active Pages
                                    {activeTab === 'active' && (
                                        <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-600 transition-all" />
                                    )}
                                </button>
                                <button
                                    onClick={() => setActiveTab('deleted')}
                                    className={`px-4 py-2 text-sm font-medium transition-all relative ${activeTab === 'deleted'
                                        ? 'text-blue-600'
                                        : 'text-gray-600 hover:text-gray-900'
                                        }`}
                                >
                                    Deleted Pages
                                    {activeTab === 'deleted' && (
                                        <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-600 transition-all" />
                                    )}
                                </button>
                            </div>

                            {/* Bulk Actions Toolbar - Inline - Only show on active tab */}
                            {activeTab === 'active' && (
                                <BulkActionsToolbar
                                    selectedCount={selectedPageIds.size}
                                    onCut={handleBulkCut}
                                    onCopy={handleBulkCopy}
                                    onDuplicate={handleBulkDuplicate}
                                    onPublish={handleBulkPublish}
                                    onUnpublish={handleBulkUnpublish}
                                    onDelete={handleBulkDelete}
                                    onClear={handleClearSelection}
                                    isProcessing={isBulkProcessing}
                                />
                            )}
                        </div>

                        {/* Toolbar buttons - Only show on active tab */}
                        {activeTab === 'active' && (
                            <div className="flex items-center gap-2">
                                <Tooltip text={`Row height: ${rowHeight}`} position="top">
                                    <button
                                        onClick={toggleRowHeight}
                                        className={`p-2 rounded transition-colors ${rowHeight === 'spacious' ? 'text-blue-600 bg-blue-50' : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'}`}
                                    >
                                        <AlignJustify className="w-4 h-4" />
                                    </button>
                                </Tooltip>
                                <Tooltip text="Import page tree as new root page" position="top">
                                    <button
                                        data-testid="import-tree-button"
                                        onClick={() => handleImportTree(null)}
                                        className="p-2 text-gray-500 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors"
                                    >
                                        <Download className="w-4 h-4" />
                                    </button>
                                </Tooltip>
                                <Tooltip text="Add root page" position="top">
                                    <button
                                        data-testid="add-root-page-button"
                                        onClick={handleCreateRootPage}
                                        className="p-2 text-gray-500 hover:text-purple-600 hover:bg-purple-50 rounded transition-colors"
                                    >
                                        <Plus className="w-4 h-4" />
                                    </button>
                                </Tooltip>
                                <Tooltip text="Refresh" position="top">
                                    <button
                                        data-testid="refresh-button"
                                        onClick={handleRefresh}
                                        className="p-2 text-gray-500 hover:text-green-600 hover:bg-green-50 rounded transition-colors disabled:opacity-50"
                                        disabled={isLoading}
                                    >
                                        <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
                                    </button>
                                </Tooltip>
                            </div>
                        )}
                    </div>

                    {/* Search and filters - Only show on active tab */}
                    {activeTab === 'active' && (
                        <>
                            <div className="flex items-center gap-2">
                                <div className="flex-1 relative">
                                    <Tooltip text="Search pages" position="top">
                                        <div className="absolute left-3 top-1/2 transform -translate-y-1/2 cursor-help">
                                            <Search className="w-4 h-4 text-gray-400" />
                                        </div>
                                    </Tooltip>
                                    <input
                                        type="text"
                                        placeholder="Search pages..."
                                        value={searchTerm}
                                        onChange={(e) => setSearchTerm(e.target.value)}
                                        className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                    />
                                </div>

                                <button
                                    data-testid="filter-button"
                                    onClick={() => setShowFilters(!showFilters)}
                                    className={`p-2 rounded-lg border transition-colors ${showFilters ? 'bg-blue-50 border-blue-300 text-blue-600' : 'border-gray-300 text-gray-500 hover:bg-gray-50 hover:text-gray-700'}`}
                                >
                                    <Filter className="w-4 h-4" />
                                </button>
                            </div>

                            {/* Filters */}
                            {showFilters && (
                                <div className="flex items-center gap-4 p-3 bg-gray-50 rounded-lg">
                                    <label className="flex items-center gap-2">
                                        <span className="text-sm font-medium text-gray-700">Status:</span>
                                        <select
                                            value={statusFilter}
                                            onChange={(e) => setStatusFilter(e.target.value)}
                                            className="px-3 py-1 border border-gray-300 rounded text-sm"
                                        >
                                            <option value="all">All</option>
                                            <option value="published">Published</option>
                                            <option value="unpublished">Unpublished</option>
                                            <option value="scheduled">Scheduled</option>
                                        </select>
                                    </label>
                                </div>
                            )}
                        </>
                    )}
                </div>
            </div>

            {/* Scrollable Tree Content or Deleted Pages View */}
            {activeTab === 'active' ? (
                <>
                    <div className="flex-1 overflow-auto min-h-0">
                        {(isLoading || searchLoading) ? (
                            <div className="flex items-center justify-center p-8">
                                <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
                                <span className="ml-2 text-gray-600">
                                    {searchLoading ? 'Searching pages...' : 'Loading pages...'}
                                </span>
                            </div>
                        ) : pagesRef.current.length === 0 ? (
                            <div className="text-center p-8 text-gray-500">
                                <Tooltip text="No pages found" position="top">
                                    <div className="cursor-help inline-block">
                                        <FolderPlus className="w-12 h-12 mx-auto mb-4 text-gray-400" />
                                    </div>
                                </Tooltip>
                                <p>
                                    {searchTerm ? 'No pages found matching your search' : 'No pages found'}
                                </p>
                                {searchTerm ? (
                                    <div className="mt-4">
                                        <button
                                            onClick={handleClearSearch}
                                            className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors"
                                        >
                                            Clear Search
                                        </button>
                                    </div>
                                ) : (
                                    <div className="mt-4">
                                        <button
                                            onClick={handleCreateNewPage}
                                            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                                        >
                                            <Plus className="w-4 h-4 inline mr-2" />
                                            Create First Page
                                        </button>
                                    </div>
                                )}
                            </div>
                        ) : (
                            <div className="p-2">
                                {searchTerm && searchResults.length > 0 && (
                                    <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                                        <div className="flex items-center justify-between">
                                            <div className="flex items-center gap-2">
                                                <Search className="w-4 h-4 text-blue-600" />
                                                <span className="text-sm font-medium text-blue-800">
                                                    Found {searchResults.length} result{searchResults.length !== 1 ? 's' : ''} for "{debouncedSearchTerm}"
                                                </span>
                                            </div>
                                            <button
                                                onClick={handleClearSearch}
                                                className="text-blue-600 hover:text-blue-800 text-sm"
                                            >
                                                Clear Search
                                            </button>
                                        </div>
                                    </div>
                                )}
                                {pagesRef.current.map((page, index) => (
                                    <PageTreeNode
                                        key={page.id}
                                        page={page}
                                        level={0}
                                        onEdit={handleEdit}
                                        onCut={handleCut}
                                        onPaste={handlePaste}
                                        onDelete={handleDelete}
                                        onAddPageBelow={handleAddPageBelow}
                                        onImport={handleImportTree}
                                        cutPageIds={cutPageIds}
                                        copyPageIds={copyPageIds}
                                        isSearchMode={!!searchTerm}
                                        searchTerm={searchTerm}
                                        rowHeight={rowHeight}
                                        onMoveUp={handleMoveUp}
                                        onMoveDown={handleMoveDown}
                                        canMoveUp={index > 0}
                                        canMoveDown={index < pagesRef.current.length - 1}
                                        selectedPageIds={selectedPageIds}
                                        onPageClick={handlePageClick}
                                        isSelectionMode={selectedPageIds.size > 0}
                                    />
                                ))}
                            </div>
                        )}
                    </div>

                    {/* Fixed Footer */}
                    <div className="flex-shrink-0 border-t border-gray-200 p-4 bg-gray-50">
                        <div className="flex items-center justify-between text-sm text-gray-600">
                            <span>
                                {pagesRef.current.length} root page{pagesRef.current.length !== 1 ? 's' : ''}
                                {searchTerm && ' (filtered)'}
                            </span>
                            <div className="flex items-center gap-4">
                                <span>Cut to move pages • Use + (purple) to add root pages • Use + (green) on pages to add child pages</span>
                            </div>
                        </div>
                    </div>
                </>
            ) : (
                /* Deleted Pages View */
                <DeletedPagesView isStaff={true} />
            )}

            {/* Page Creation Modal */}
            {showCreateModal && (
                <PageCreationModal
                    positioningParams={positioningParams}
                    onSave={(pageData) => {
                        // Add positioning params to page data if available
                        const finalPageData = { ...pageData }
                        if (positioningParams) {
                            finalPageData.parentId = positioningParams.parentId
                            finalPageData.sortOrder = positioningParams.suggestedSortOrder
                        }
                        createPageMutation.mutate(finalPageData)
                    }}
                    onCancel={() => {
                        setShowCreateModal(false)
                        setPositioningParams(null)
                    }}
                    isLoading={createPageMutation.isPending}
                />
            )}

            {/* Root Page Creation Modal */}
            {showRootPageModal && (
                <RootPageCreationModal
                    onSave={(pageData) => {
                        createRootPageMutation.mutate(pageData)
                    }}
                    onCancel={() => {
                        setShowRootPageModal(false)
                    }}
                    isLoading={createRootPageMutation.isPending}
                />
            )}

            {/* Tree Importer Modal */}
            <TreeImporterModalV2
                isOpen={showImportModal}
                onClose={() => setShowImportModal(false)}
                parentPage={importParentPage}
                onSuccess={handleImportSuccess}
            />
        </div>
    )
}

// Simple page creation modal component
const PageCreationModal = ({ positioningParams, onSave, onCancel, isLoading }) => {
    const [formData, setFormData] = useState({
        title: '',
        slug: '',
        publicationStatus: 'unpublished'
    })

    const generateSlug = (title) => {
        return title
            .toLowerCase()
            .replace(/[^a-z0-9\s-]/g, '')
            .replace(/\s+/g, '-')
            .replace(/-+/g, '-')
            .trim()
    }

    const handleTitleChange = (e) => {
        const title = e.target.value
        setFormData(prev => ({
            ...prev,
            title,
            // Auto-generate slug if it's empty or matches the previous auto-generated slug
            slug: (!prev.slug || prev.slug === generateSlug(prev.title))
                ? generateSlug(title)
                : prev.slug
        }))
    }

    const handleSubmit = (e) => {
        e.preventDefault()
        if (!formData.title.trim()) {
            console.error('Page title is required')
            return
        }
        if (!formData.slug.trim()) {
            console.error('Page slug is required')
            return
        }
        onSave(formData)
    }

    return (
        <div className="fixed inset-0 bg-black/10 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg shadow-xl p-6 w-full max-w-md mx-4">
                <div className="flex items-center justify-between mb-6">
                    <h3 className="text-lg font-medium text-gray-900">
                        {positioningParams ?
                            `Add Child Page to "${positioningParams.parentPage.title}"` :
                            'Create New Page'
                        }
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
                        <label htmlFor="page-title" className="block text-sm font-medium text-gray-700 mb-1">
                            Page Title *
                        </label>
                        <input
                            id="page-title"
                            type="text"
                            value={formData.title}
                            onChange={handleTitleChange}
                            placeholder="Enter page title"
                            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                            required
                        />
                    </div>

                    <div>
                        <label htmlFor="page-slug" className="block text-sm font-medium text-gray-700 mb-1">
                            URL Slug *
                        </label>
                        <input
                            id="page-slug"
                            type="text"
                            value={formData.slug}
                            onChange={(e) => setFormData(prev => ({ ...prev, slug: e.target.value }))}
                            placeholder="page-url-slug"
                            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                            required
                        />
                    </div>

                    <div>
                        <label htmlFor="publication-status" className="block text-sm font-medium text-gray-700 mb-1">
                            Publication Status
                        </label>
                        <select
                            id="publication-status"
                            value={formData.publicationStatus}
                            onChange={(e) => setFormData(prev => ({ ...prev, publicationStatus: e.target.value }))}
                            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                        >
                            <option value="unpublished">Unpublished</option>
                            <option value="scheduled">Scheduled</option>
                            <option value="published">Published</option>
                            <option value="expired">Expired</option>
                        </select>
                    </div>

                    {positioningParams && (
                        <div className="bg-blue-50 border border-blue-200 rounded-md p-3">
                            <p className="text-sm text-blue-800">
                                This page will be created as a child page under "{positioningParams.parentPage.title}".
                            </p>
                        </div>
                    )}

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
                            {isLoading ? 'Creating...' : 'Create Page'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    )
}

// Root page creation modal component with hosts field
const RootPageCreationModal = ({ onSave, onCancel, isLoading }) => {
    const [formData, setFormData] = useState({
        title: '',
        hostnames: '',
        publicationStatus: 'unpublished'
    })

    const generateSlug = (title) => {
        return title
            .toLowerCase()
            .replace(/[^a-z0-9\s-]/g, '')
            .replace(/\s+/g, '-')
            .replace(/-+/g, '-')
            .trim()
    }

    const handleSubmit = (e) => {
        e.preventDefault()
        if (!formData.title.trim()) {
            console.error('Page title is required')
            return
        }
        if (!formData.hostnames.trim()) {
            console.error('At least one hostname is required for root pages')
            return
        }

        // Auto-generate slug from title
        const slug = generateSlug(formData.title)

        // Parse hostnames from comma-separated string
        const hostnamesArray = formData.hostnames
            .split(',')
            .map(h => h.trim())
            .filter(h => h.length > 0)

        const pageData = {
            title: formData.title,
            slug: slug,
            publicationStatus: formData.publicationStatus,
            hostnames: hostnamesArray,
            parentId: null // Root pages have no parent
        }

        onSave(pageData)
    }

    return (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg shadow-xl p-6 w-full max-w-md mx-4">
                <div className="flex items-center justify-between mb-6">
                    <h3 className="text-lg font-medium text-gray-900">
                        Create Root Page
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
                        <label htmlFor="root-page-title" className="block text-sm font-medium text-gray-700 mb-1">
                            Page Title *
                        </label>
                        <input
                            id="root-page-title"
                            type="text"
                            value={formData.title}
                            onChange={(e) => setFormData(prev => ({ ...prev, title: e.target.value }))}
                            placeholder="Enter page title"
                            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500"
                            required
                        />
                        <p className="text-xs text-gray-500 mt-1">
                            URL slug will be automatically generated from the title
                        </p>
                    </div>

                    <div>
                        <label htmlFor="root-page-hostnames" className="block text-sm font-medium text-gray-700 mb-1">
                            Hostnames *
                        </label>
                        <input
                            id="root-page-hostnames"
                            type="text"
                            value={formData.hostnames}
                            onChange={(e) => setFormData(prev => ({ ...prev, hostnames: e.target.value }))}
                            placeholder="example.com, www.example.com"
                            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500"
                            required
                        />
                        <p className="text-xs text-gray-500 mt-1">
                            Enter hostnames separated by commas. Root pages need at least one hostname.
                        </p>
                    </div>

                    <div>
                        <label htmlFor="root-publication-status" className="block text-sm font-medium text-gray-700 mb-1">
                            Publication Status
                        </label>
                        <select
                            id="root-publication-status"
                            value={formData.publicationStatus}
                            onChange={(e) => setFormData(prev => ({ ...prev, publicationStatus: e.target.value }))}
                            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500"
                        >
                            <option value="unpublished">Unpublished</option>
                            <option value="scheduled">Scheduled</option>
                            <option value="published">Published</option>
                            <option value="expired">Expired</option>
                        </select>
                    </div>

                    <div className="bg-purple-50 border border-purple-200 rounded-md p-3">
                        <p className="text-sm text-purple-800">
                            Root pages are top-level pages that can be accessed directly via hostnames.
                            They serve as entry points to your site.
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
                            className="inline-flex items-center px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors disabled:opacity-50"
                        >
                            <Save className="w-4 h-4 mr-2" />
                            {isLoading ? 'Creating...' : 'Create Root Page'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    )
}

export default TreePageManager 