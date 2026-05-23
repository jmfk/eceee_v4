/*
 * Copyright (C) 2025 Johan Mats Fred Karlsson
 *
 * This file is part of easy_v4.
 *
 * This program is licensed under the Server Side Public License, version 1,
 * as published by MongoDB, Inc. See the LICENSE file for details.
 */

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
    Download,
    Upload,
    MoreVertical,
    CheckCircle,
    Trash2
} from 'lucide-react'
import { pagesApi, sitePackagesApi } from '../api'
import { deletePage } from '../api/pages'
import PageTreeNode from './PageTreeNode'
import TreeImporterModalV2 from './TreeImporterModalV2'
import BulkActionsToolbar from './BulkActionsToolbar'
import Tooltip from './Tooltip'
import { useNotificationContext } from './NotificationManager'
import { useGlobalNotifications } from '../contexts/GlobalNotificationContext'
import pageTreeUtils from '../utils/pageTreeUtils'
import DeletedPagesView from './DeletedPagesView'
import { useDocumentTitle } from '../hooks/useDocumentTitle'

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

const SITE_PACKAGE_POLL_INTERVAL_MS = 2000
const SITE_PACKAGE_MAX_POLLS = 900
const SITE_PACKAGE_DISMISSED_JOBS_KEY = 'sitePackageDismissedJobs'

const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms))

const getSitePackageJobList = (response) => {
    if (Array.isArray(response)) return response
    if (Array.isArray(response?.results)) return response.results
    return []
}

const isActiveSitePackageJob = (job) => job.status === 'pending' || job.status === 'running'

const getDismissedSitePackageJobIds = () => {
    try {
        return new Set(JSON.parse(localStorage.getItem(SITE_PACKAGE_DISMISSED_JOBS_KEY) || '[]'))
    } catch {
        return new Set()
    }
}

const persistDismissedSitePackageJobIds = (jobIds) => {
    localStorage.setItem(SITE_PACKAGE_DISMISSED_JOBS_KEY, JSON.stringify([...jobIds]))
}

const TreePageManager = () => {
    const navigate = useNavigate()
    
    // Set document title
    useDocumentTitle('Pages')

    // State management
    const pagesRef = useRef([])
    const sitePackagePollingJobsRef = useRef(new Set())
    const [, forceUpdate] = useState({})
    const [activeTab, setActiveTab] = useState('active') // 'active' or 'deleted'
    const [searchTerm, setSearchTerm] = useState('')
    const [showFilters, setShowFilters] = useState(false)
    const [statusFilter, setStatusFilter] = useState('all')
    const [cutPageIds, setCutPageIds] = useState([])
    const [showCreateModal, setShowCreateModal] = useState(false)
    const [showRootPageModal, setShowRootPageModal] = useState(false)
    const [showImportModal, setShowImportModal] = useState(false)
    const [showSitePackageImportModal, setShowSitePackageImportModal] = useState(false)
    const [importParentPage, setImportParentPage] = useState(null)
    const [exportRootPage, setExportRootPage] = useState(null)
    const [sitePackageJobs, setSitePackageJobs] = useState([])
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

    // Global commands dropdown state
    const [showGlobalMenu, setShowGlobalMenu] = useState(false)

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
        queryFn: async () => {
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
        queryFn: async () => {
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
        mutationFn: async ({ pageId, parentId, sortOrder }) => await pagesApi.update(pageId, { parentId: parentId, sortOrder: sortOrder }),
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
            const updatePromises = newPages.map(async (page) =>
                await pagesApi.update(page.id, { sortOrder: page.sortOrder })
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
            const updatePromises = newPages.map(async (page) =>
                await pagesApi.update(page.id, { sortOrder: page.sortOrder })
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

    // Handle legacy external site import. Root ZIP imports use site packages.
    const handleImportTree = useCallback((parentPage = null) => {
        if (!parentPage) {
            setShowSitePackageImportModal(true)
            return
        }

        setImportParentPage(parentPage)
        setShowImportModal(true)
    }, [])

    const handleImportSuccess = useCallback(async () => {
        addNotification('External site imported successfully', 'success', 'import-success')
        addNotification('Refreshing page tree...', 'info', 'tree-refresh')

        // Clear cache and refetch to ensure complete refresh
        queryClient.removeQueries({ queryKey: ['pages'] })
        queryClient.removeQueries({ queryKey: ['page-children'] })

        await queryClient.refetchQueries({ queryKey: ['pages'], type: 'active' })

        addNotification('Page tree refreshed', 'success', 'tree-refresh')
    }, [addNotification, queryClient])

    const decorateSitePackageJob = useCallback((job) => {
        const rootTitle = job.rootTitle || job.rootPageTitle
        const label = job.label || (job.kind === 'export'
            ? `Export ${rootTitle || 'site package'}`
            : 'Import site package')

        return {
            ...job,
            rootTitle,
            label
        }
    }, [])

    const upsertSitePackageJob = useCallback((job) => {
        setSitePackageJobs(prev => {
            const decoratedJob = decorateSitePackageJob(job)
            const existingIndex = prev.findIndex(existingJob => existingJob.id === job.id)
            if (existingIndex === -1) {
                return [decoratedJob, ...prev].slice(0, 5)
            }

            const next = [...prev]
            next[existingIndex] = decorateSitePackageJob({ ...next[existingIndex], ...job })
            return next
        })
    }, [decorateSitePackageJob])

    const removeSitePackageJob = useCallback((jobId) => {
        const dismissedJobIds = getDismissedSitePackageJobIds()
        dismissedJobIds.add(jobId)
        persistDismissedSitePackageJobIds(dismissedJobIds)
        setSitePackageJobs(prev => prev.filter(job => job.id !== jobId))
    }, [])

    const pollSitePackageJob = useCallback(async ({ jobId, getJob, onCompleted }) => {
        for (let i = 0; i < SITE_PACKAGE_MAX_POLLS; i += 1) {
            const job = await getJob(jobId)
            upsertSitePackageJob(job)

            if (job.status === 'completed') {
                await onCompleted(job)
                return
            }

            if (job.status === 'failed') {
                const errorMessage = Array.isArray(job.errors) && job.errors.length > 0
                    ? job.errors[job.errors.length - 1]
                    : 'Site package job failed'
                throw new Error(errorMessage)
            }

            await delay(SITE_PACKAGE_POLL_INTERVAL_MS)
        }

        upsertSitePackageJob({
            id: jobId,
            status: 'running',
            message: 'Still running. This job will reappear after reload.'
        })
    }, [upsertSitePackageJob])

    const completeSitePackageJob = useCallback(async (completedJob) => {
        if (completedJob.kind === 'export') {
            const download = await sitePackagesApi.getExportDownload(completedJob.id)
            const downloadUrl = download.downloadUrl || download.download_url
            upsertSitePackageJob({
                ...completedJob,
                downloadUrl
            })
            addNotification(`Export "${completedJob.rootPageTitle || completedJob.rootTitle || 'site package'}" is ready`, 'success', `site-export-${completedJob.id}`)
            return
        }

        upsertSitePackageJob(completedJob)
        queryClient.removeQueries({ queryKey: ['pages'] })
        queryClient.removeQueries({ queryKey: ['page-children'] })
        await queryClient.refetchQueries({ queryKey: ['pages'], type: 'active' })
        addNotification('Site package imported as a new root', 'success', `site-import-${completedJob.id}`)
    }, [addNotification, queryClient, upsertSitePackageJob])

    const resumeSitePackagePolling = useCallback((job) => {
        if (!isActiveSitePackageJob(job) || sitePackagePollingJobsRef.current.has(job.id)) {
            return
        }

        sitePackagePollingJobsRef.current.add(job.id)
        pollSitePackageJob({
            jobId: job.id,
            getJob: job.kind === 'export' ? sitePackagesApi.getExport : sitePackagesApi.getImport,
            onCompleted: completeSitePackageJob
        }).catch((error) => {
            console.error('Failed to poll site package job:', error)
            upsertSitePackageJob({
                ...job,
                status: 'failed',
                errors: [error.message]
            })
        }).finally(() => {
            sitePackagePollingJobsRef.current.delete(job.id)
        })
    }, [completeSitePackageJob, pollSitePackageJob, upsertSitePackageJob])

    useEffect(() => {
        let isMounted = true

        const loadSitePackageJobs = async () => {
            try {
                const [exportResponse, importResponse] = await Promise.all([
                    sitePackagesApi.listExports(),
                    sitePackagesApi.listImports()
                ])

                if (!isMounted) return

                const dismissedJobIds = getDismissedSitePackageJobIds()
                const jobs = [
                    ...getSitePackageJobList(exportResponse),
                    ...getSitePackageJobList(importResponse)
                ]
                    .filter(job => isActiveSitePackageJob(job) || !dismissedJobIds.has(job.id))
                    .sort((a, b) => new Date(b.createdAt || b.created_at || 0) - new Date(a.createdAt || a.created_at || 0))

                jobs.slice(0, 5).forEach((job) => {
                    upsertSitePackageJob(job)
                    if (isActiveSitePackageJob(job)) {
                        resumeSitePackagePolling(job)
                    } else if (job.kind === 'export' && job.status === 'completed' && job.downloadAvailable) {
                        sitePackagesApi.getExportDownload(job.id)
                            .then((download) => {
                                if (!isMounted) return
                                upsertSitePackageJob({
                                    ...job,
                                    downloadUrl: download.downloadUrl || download.download_url
                                })
                            })
                            .catch((error) => {
                                console.error('Failed to recover site package download URL:', error)
                            })
                    }
                })
            } catch (error) {
                console.error('Failed to load site package jobs:', error)
            }
        }

        loadSitePackageJobs()

        return () => {
            isMounted = false
        }
    }, [resumeSitePackagePolling, upsertSitePackageJob])

    const openExportRootPackage = useCallback((rootPage) => {
        setExportRootPage(rootPage)
    }, [])

    const handleExportRootPackage = useCallback(async (rootPage, { includeMedia, includeThemes }) => {
        addNotification(`Starting export for "${rootPage.title}"...`, 'info', `site-export-${rootPage.id}`)

        try {
            const job = await sitePackagesApi.createExport({
                rootPageId: rootPage.id,
                includeMedia,
                includeThemes
            })
            setExportRootPage(null)
            upsertSitePackageJob({
                ...job,
                rootTitle: rootPage.title,
                label: `Export ${rootPage.title}`
            })

            pollSitePackageJob({
                jobId: job.id,
                getJob: sitePackagesApi.getExport,
                onCompleted: async (completedJob) => {
                    const download = await sitePackagesApi.getExportDownload(completedJob.id)
                    const downloadUrl = download.downloadUrl || download.download_url
                    upsertSitePackageJob({
                        ...completedJob,
                        rootTitle: rootPage.title,
                        label: `Export ${rootPage.title}`,
                        downloadUrl
                    })
                    addNotification(`Export for "${rootPage.title}" is ready`, 'success', `site-export-${rootPage.id}`)
                }
            }).catch((error) => {
                console.error('Failed to export root site package:', error)
                upsertSitePackageJob({
                    id: job.id,
                    kind: 'export',
                    status: 'failed',
                    rootTitle: rootPage.title,
                    label: `Export ${rootPage.title}`,
                    errors: [error.message]
                })
                addNotification(`Export failed: ${error.message}`, 'error', `site-export-${rootPage.id}`)
            })
        } catch (error) {
            console.error('Failed to start root site package export:', error)
            showError(error, 'error')
            addNotification('Failed to start site export', 'error', `site-export-${rootPage.id}`)
            throw error
        }
    }, [addNotification, pollSitePackageJob, showError, upsertSitePackageJob])

    const handleImportRootPackage = useCallback(async ({ file, preservePublicationStatus }) => {
        addNotification(`Uploading "${file.name}"...`, 'info', 'site-import')

        try {
            const job = await sitePackagesApi.createImport({ file, preservePublicationStatus })
            setShowSitePackageImportModal(false)
            upsertSitePackageJob({
                ...job,
                label: `Import ${file.name}`
            })

            pollSitePackageJob({
                jobId: job.id,
                getJob: sitePackagesApi.getImport,
                onCompleted: async (completedJob) => {
                    upsertSitePackageJob({
                        ...completedJob,
                        label: `Import ${file.name}`
                    })
                    queryClient.removeQueries({ queryKey: ['pages'] })
                    queryClient.removeQueries({ queryKey: ['page-children'] })
                    await queryClient.refetchQueries({ queryKey: ['pages'], type: 'active' })
                    addNotification('Site package imported as a new root', 'success', 'site-import')
                }
            }).catch((error) => {
                console.error('Failed to import root site package:', error)
                upsertSitePackageJob({
                    id: job.id,
                    kind: 'import',
                    status: 'failed',
                    label: `Import ${file.name}`,
                    errors: [error.message]
                })
                addNotification(`Import failed: ${error.message}`, 'error', 'site-import')
            })
        } catch (error) {
            console.error('Failed to start root site package import:', error)
            showError(error, 'error')
            addNotification('Failed to start site import', 'error', 'site-import')
            throw error
        }
    }, [addNotification, pollSitePackageJob, queryClient, showError, upsertSitePackageJob])

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
                <div className="text-lg font-semibold text-gray-900 mb-2" role="heading" aria-level="3">Failed to load pages</div>
                <div className="text-gray-600 mb-4">{error.message}</div>
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
                <div className="text-lg font-semibold text-gray-900 mb-2" role="heading" aria-level="3">Search failed</div>
                <div className="text-gray-600 mb-4">{searchError.message}</div>
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
        <div className="flex flex-col bg-white shadow-lg rounded-lg overflow-hidden h-full max-h-screen">
            {/* Fixed Header - Responsive */}
            <div className="flex-shrink-0 border-b border-gray-200 bg-white">
                {/* Tabs and Actions */}
                <div className="px-2 sm:px-4 py-2 sm:py-3">
                    {/* First Row: Tabs, Bulk Actions (on large screens), Global Commands */}
                    <div className="flex items-center justify-between gap-2 flex-wrap">
                        {/* Tabs */}
                        <div className="flex items-center gap-1 sm:gap-2">
                            <button
                                onClick={() => setActiveTab('active')}
                                className={`px-2 sm:px-4 py-1.5 sm:py-2 text-xs sm:text-sm font-medium transition-all relative whitespace-nowrap ${activeTab === 'active'
                                    ? 'text-blue-600'
                                    : 'text-gray-600 hover:text-gray-900'
                                    }`}
                            >
                                Pages
                                {activeTab === 'active' && (
                                    <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-600 transition-all" />
                                )}
                            </button>
                            <button
                                onClick={() => setActiveTab('deleted')}
                                className={`px-2 sm:px-4 py-1.5 sm:py-2 text-xs sm:text-sm font-medium transition-all relative whitespace-nowrap ${activeTab === 'deleted'
                                    ? 'text-blue-600'
                                    : 'text-gray-600 hover:text-gray-900'
                                    }`}
                            >
                                Deleted
                                {activeTab === 'deleted' && (
                                    <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-600 transition-all" />
                                )}
                            </button>
                        </div>

                        {/* Bulk Actions - Show inline on xl screens, hide on smaller */}
                        {activeTab === 'active' && (
                            <div className="hidden xl:block flex-1 max-w-2xl">
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
                            </div>
                        )}

                        {/* Global Commands + Menu */}
                        {activeTab === 'active' && (
                            <div className="flex items-center gap-2">
                                {/* Desktop: Show all buttons */}
                                <div className="hidden lg:flex items-center gap-2">
                                    <Tooltip text={`Row height: ${rowHeight}`} position="top">
                                        <button
                                            onClick={toggleRowHeight}
                                            className={`p-2 rounded transition-colors ${rowHeight === 'spacious' ? 'text-blue-600 bg-blue-50' : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'}`}
                                        >
                                            <AlignJustify className="w-4 h-4" />
                                        </button>
                                    </Tooltip>
                                    <Tooltip text="Import root site package ZIP" position="top">
                                        <button
                                            data-testid="import-site-package-button"
                                            onClick={() => setShowSitePackageImportModal(true)}
                                            aria-label="Import root site package ZIP"
                                            className="p-2 text-gray-500 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors"
                                        >
                                            <Upload className="w-4 h-4" />
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

                                {/* Falafel Menu - Shows global commands on md-lg, bulk actions + global commands on smaller */}
                                <div className="relative lg:hidden">
                                    <button
                                        onClick={() => setShowGlobalMenu(!showGlobalMenu)}
                                        className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-50 rounded transition-colors"
                                        aria-label="Menu"
                                    >
                                        <MoreVertical className="w-5 h-5" />
                                    </button>

                                    {showGlobalMenu && (
                                        <>
                                            {/* Backdrop */}
                                            <div
                                                className="fixed inset-0 z-10"
                                                onClick={() => setShowGlobalMenu(false)}
                                            />
                                            {/* Dropdown menu */}
                                            <div className="absolute right-0 top-full mt-1 w-56 bg-white rounded-lg shadow-lg border border-gray-200 py-1 z-20 max-h-96 overflow-y-auto">
                                                {/* Bulk Actions in menu on small screens only */}
                                                <div className="md:hidden border-b border-gray-200 pb-1 mb-1">
                                                    <div className="px-4 py-2 text-xs font-semibold text-gray-500 uppercase">
                                                        Bulk Actions
                                                    </div>
                                                    <button
                                                        onClick={() => {
                                                            handleBulkCut()
                                                            setShowGlobalMenu(false)
                                                        }}
                                                        disabled={selectedPageIds.size === 0}
                                                        className="w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-3 disabled:opacity-50"
                                                    >
                                                        <Scissors className="w-4 h-4" />
                                                        <span>Cut ({selectedPageIds.size})</span>
                                                    </button>
                                                    <button
                                                        onClick={() => {
                                                            handleBulkCopy()
                                                            setShowGlobalMenu(false)
                                                        }}
                                                        disabled={selectedPageIds.size === 0}
                                                        className="w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-3 disabled:opacity-50"
                                                    >
                                                        <Save className="w-4 h-4" />
                                                        <span>Copy ({selectedPageIds.size})</span>
                                                    </button>
                                                    <button
                                                        onClick={() => {
                                                            handleBulkPublish()
                                                            setShowGlobalMenu(false)
                                                        }}
                                                        disabled={selectedPageIds.size === 0 || isBulkProcessing}
                                                        className="w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-3 disabled:opacity-50"
                                                    >
                                                        <CheckCircle className="w-4 h-4" />
                                                        <span>Publish ({selectedPageIds.size})</span>
                                                    </button>
                                                    <button
                                                        onClick={() => {
                                                            handleBulkDelete()
                                                            setShowGlobalMenu(false)
                                                        }}
                                                        disabled={selectedPageIds.size === 0 || isBulkProcessing}
                                                        className="w-full px-4 py-2 text-left text-sm text-red-700 hover:bg-red-50 flex items-center gap-3 disabled:opacity-50"
                                                    >
                                                        <Trash2 className="w-4 h-4" />
                                                        <span>Delete ({selectedPageIds.size})</span>
                                                    </button>
                                                    {selectedPageIds.size > 0 && (
                                                        <button
                                                            onClick={() => {
                                                                handleClearSelection()
                                                                setShowGlobalMenu(false)
                                                            }}
                                                            className="w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-3"
                                                        >
                                                            <X className="w-4 h-4" />
                                                            <span>Clear Selection</span>
                                                        </button>
                                                    )}
                                                </div>

                                                {/* Global Commands */}
                                                <div className="px-4 py-2 text-xs font-semibold text-gray-500 uppercase">
                                                    Commands
                                                </div>
                                                <button
                                                    onClick={() => {
                                                        toggleRowHeight()
                                                        setShowGlobalMenu(false)
                                                    }}
                                                    className="w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-3"
                                                >
                                                    <AlignJustify className="w-4 h-4" />
                                                    <span>Row height: {rowHeight}</span>
                                                </button>
                                                <button
                                                    onClick={() => {
                                                        setShowSitePackageImportModal(true)
                                                        setShowGlobalMenu(false)
                                                    }}
                                                    className="w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-3"
                                                >
                                                    <Upload className="w-4 h-4" />
                                                    <span>Import root ZIP</span>
                                                </button>
                                                <button
                                                    onClick={() => {
                                                        handleCreateRootPage()
                                                        setShowGlobalMenu(false)
                                                    }}
                                                    className="w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-3"
                                                >
                                                    <Plus className="w-4 h-4" />
                                                    <span>Add root page</span>
                                                </button>
                                                <button
                                                    onClick={() => {
                                                        handleRefresh()
                                                        setShowGlobalMenu(false)
                                                    }}
                                                    disabled={isLoading}
                                                    className="w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-3 disabled:opacity-50"
                                                >
                                                    <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
                                                    <span>Refresh</span>
                                                </button>
                                            </div>
                                        </>
                                    )}
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Second Row: Bulk Actions on md-lg screens */}
                    {activeTab === 'active' && (
                        <div className="hidden md:block xl:hidden mt-2 pt-2 border-t border-gray-100">
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
                        </div>
                    )}
                </div>

                {/* Search and filters - Only show on active tab */}
                {activeTab === 'active' && (
                    <div className="px-2 sm:px-4 pb-2 sm:pb-3 space-y-2">
                        <div className="flex items-center gap-2">
                            <div className="flex-1 relative">
                                <Search className="absolute left-2 sm:left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                                <input
                                    type="text"
                                    placeholder="Search pages..."
                                    value={searchTerm}
                                    onChange={(e) => setSearchTerm(e.target.value)}
                                    className="w-full pl-8 sm:pl-10 pr-3 sm:pr-4 py-1.5 sm:py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                />
                            </div>

                            <button
                                data-testid="filter-button"
                                onClick={() => setShowFilters(!showFilters)}
                                className={`p-1.5 sm:p-2 rounded-lg border transition-colors ${showFilters ? 'bg-blue-50 border-blue-300 text-blue-600' : 'border-gray-300 text-gray-500 hover:bg-gray-50 hover:text-gray-700'}`}
                            >
                                <Filter className="w-4 h-4" />
                            </button>
                        </div>

                        {/* Filters */}
                        {showFilters && (
                            <div className="flex items-center gap-4 p-2 sm:p-3 bg-gray-50 rounded-lg">
                                <label className="flex items-center gap-2">
                                    <span className="text-xs sm:text-sm font-medium text-gray-700">Status:</span>
                                    <select
                                        value={statusFilter}
                                        onChange={(e) => setStatusFilter(e.target.value)}
                                        className="px-2 sm:px-3 py-1 border border-gray-300 rounded text-xs sm:text-sm"
                                    >
                                        <option value="all">All</option>
                                        <option value="published">Published</option>
                                        <option value="unpublished">Unpublished</option>
                                        <option value="scheduled">Scheduled</option>
                                    </select>
                                </label>
                            </div>
                        )}
                    </div>
                )}
            </div>

            {/* Scrollable Tree Content or Deleted Pages View */}
            {activeTab === 'active' ? (
                <>
                    {sitePackageJobs.length > 0 && (
                        <SitePackageJobsPanel
                            jobs={sitePackageJobs}
                            onDismiss={removeSitePackageJob}
                        />
                    )}
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
                                <div>
                                    {searchTerm ? 'No pages found matching your search' : 'No pages found'}
                                </div>
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
                                        onExport={openExportRootPackage}
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

                    {/* Fixed Footer - Responsive */}
                    <div className="flex-shrink-0 border-t border-gray-200 px-2 sm:px-4 py-2 sm:py-3 bg-gray-50">
                        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1 sm:gap-4 text-xs sm:text-sm text-gray-600">
                            <span className="whitespace-nowrap">
                                {pagesRef.current.length} root page{pagesRef.current.length !== 1 ? 's' : ''}
                                {searchTerm && ' (filtered)'}
                            </span>
                            <span className="hidden md:block text-xs">
                                Cut to move pages • Use + (purple) to add root pages • Use + (green) on pages to add child pages
                            </span>
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

            {/* External Site Importer Modal */}
            <TreeImporterModalV2
                isOpen={showImportModal}
                onClose={() => setShowImportModal(false)}
                parentPage={importParentPage}
                onSuccess={handleImportSuccess}
            />

            <SitePackageImportModal
                isOpen={showSitePackageImportModal}
                onClose={() => setShowSitePackageImportModal(false)}
                onImport={handleImportRootPackage}
            />

            <SitePackageExportModal
                rootPage={exportRootPage}
                onClose={() => setExportRootPage(null)}
                onExport={handleExportRootPackage}
            />
        </div>
    )
}

const SitePackageJobsPanel = ({ jobs, onDismiss }) => {
    const getStatusText = (job) => {
        if (job.status === 'completed') return job.downloadUrl ? 'Ready to download' : 'Completed'
        if (job.status === 'failed') return Array.isArray(job.errors) && job.errors.length > 0 ? job.errors[job.errors.length - 1] : 'Failed'
        if (job.status === 'running') return 'Running'
        return 'Queued'
    }

    return (
        <div className="flex-shrink-0 border-b border-gray-200 bg-indigo-50 px-2 sm:px-4 py-2 space-y-2">
            {jobs.map((job) => (
                <div key={job.id} className="flex items-center justify-between gap-3 text-sm">
                    <div className="min-w-0 flex items-center gap-2">
                        {job.status === 'completed' ? (
                            <CheckCircle className="w-4 h-4 text-green-600 flex-shrink-0" />
                        ) : job.status === 'failed' ? (
                            <AlertCircle className="w-4 h-4 text-red-600 flex-shrink-0" />
                        ) : (
                            <Loader2 className="w-4 h-4 text-indigo-600 animate-spin flex-shrink-0" />
                        )}
                        <span className="font-medium text-gray-900 truncate">
                            {job.label || `${job.kind === 'import' ? 'Import' : 'Export'} site package`}
                        </span>
                        <span className={`truncate ${job.status === 'failed' ? 'text-red-700' : 'text-gray-600'}`}>
                            {getStatusText(job)}
                        </span>
                    </div>

                    <div className="flex items-center gap-2 flex-shrink-0">
                        {job.downloadUrl && (
                            <a
                                href={job.downloadUrl}
                                target="_blank"
                                rel="noreferrer"
                                className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium text-indigo-700 bg-white border border-indigo-200 rounded hover:bg-indigo-100"
                            >
                                <Download className="w-3 h-3" />
                                Download ZIP
                            </a>
                        )}
                        {(job.status === 'completed' || job.status === 'failed') && (
                            <button
                                onClick={() => onDismiss(job.id)}
                                className="p-1 text-gray-500 hover:text-gray-700 hover:bg-white rounded"
                                aria-label="Dismiss site package job"
                            >
                                <X className="w-4 h-4" />
                            </button>
                        )}
                    </div>
                </div>
            ))}
        </div>
    )
}

const SitePackageExportModal = ({ rootPage, onClose, onExport }) => {
    const [includeMedia, setIncludeMedia] = useState(true)
    const [includeThemes, setIncludeThemes] = useState(true)
    const [isExporting, setIsExporting] = useState(false)
    const [error, setError] = useState('')

    useEffect(() => {
        if (rootPage) {
            setIncludeMedia(true)
            setIncludeThemes(true)
            setIsExporting(false)
            setError('')
        }
    }, [rootPage])

    if (!rootPage) return null

    const handleSubmit = async (event) => {
        event.preventDefault()
        setIsExporting(true)
        setError('')
        try {
            await onExport(rootPage, { includeMedia, includeThemes })
        } catch (exportError) {
            setError(exportError.message || 'Failed to start export.')
            setIsExporting(false)
        }
    }

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg shadow-xl w-full max-w-lg mx-4">
                <form onSubmit={handleSubmit}>
                    <div className="flex items-center justify-between p-6 border-b border-gray-200">
                        <div>
                            <h2 className="text-xl font-semibold text-gray-900">Export Root Site</h2>
                            <p className="text-sm text-gray-600 mt-1">
                                Export "{rootPage.title}" as a site package ZIP.
                            </p>
                        </div>
                        <button
                            type="button"
                            onClick={onClose}
                            disabled={isExporting}
                            aria-label="Close export root site modal"
                            className="text-gray-400 hover:text-gray-600 disabled:opacity-50"
                        >
                            <X className="w-6 h-6" />
                        </button>
                    </div>

                    <div className="p-6 space-y-4">
                        {error && (
                            <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
                                {error}
                            </div>
                        )}

                        <label className="flex items-center gap-2 text-sm text-gray-700">
                            <input
                                type="checkbox"
                                checked={includeMedia}
                                onChange={(event) => setIncludeMedia(event.target.checked)}
                                disabled={isExporting}
                                className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                            />
                            <span>Include referenced media files</span>
                        </label>

                        <label className="flex items-center gap-2 text-sm text-gray-700">
                            <input
                                type="checkbox"
                                checked={includeThemes}
                                onChange={(event) => setIncludeThemes(event.target.checked)}
                                disabled={isExporting}
                                className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                            />
                            <span>Include referenced themes and theme assets</span>
                        </label>
                    </div>

                    <div className="flex justify-end gap-3 p-6 border-t border-gray-200">
                        <button
                            type="button"
                            onClick={onClose}
                            disabled={isExporting}
                            className="px-4 py-2 text-gray-700 bg-gray-100 rounded hover:bg-gray-200 disabled:opacity-50"
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            disabled={isExporting}
                            className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
                        >
                            {isExporting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
                            {isExporting ? 'Starting...' : 'Export Root'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    )
}

const SitePackageImportModal = ({ isOpen, onClose, onImport }) => {
    const [file, setFile] = useState(null)
    const [preservePublicationStatus, setPreservePublicationStatus] = useState(true)
    const [isImporting, setIsImporting] = useState(false)
    const [error, setError] = useState('')

    useEffect(() => {
        if (isOpen) {
            setFile(null)
            setPreservePublicationStatus(true)
            setIsImporting(false)
            setError('')
        }
    }, [isOpen])

    if (!isOpen) return null

    const handleSubmit = async (event) => {
        event.preventDefault()
        if (!file) {
            setError('Choose a ZIP file to import.')
            return
        }

        setIsImporting(true)
        setError('')
        try {
            await onImport({ file, preservePublicationStatus })
        } catch (importError) {
            setError(importError.message || 'Failed to start import.')
            setIsImporting(false)
        }
    }

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg shadow-xl w-full max-w-lg mx-4">
                <form onSubmit={handleSubmit}>
                    <div className="flex items-center justify-between p-6 border-b border-gray-200">
                        <div>
                            <h2 className="text-xl font-semibold text-gray-900">Import Root Site</h2>
                            <p className="text-sm text-gray-600 mt-1">
                                Creates a new root page tree from a site package ZIP.
                            </p>
                        </div>
                        <button
                            type="button"
                            onClick={onClose}
                            disabled={isImporting}
                            aria-label="Close import root site modal"
                            className="text-gray-400 hover:text-gray-600 disabled:opacity-50"
                        >
                            <X className="w-6 h-6" />
                        </button>
                    </div>

                    <div className="p-6 space-y-4">
                        {error && (
                            <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
                                {error}
                            </div>
                        )}

                        <label className="block">
                            <span className="block text-sm font-medium text-gray-700 mb-1">Site package ZIP</span>
                            <input
                                type="file"
                                accept=".zip,application/zip,application/x-zip-compressed"
                                onChange={(event) => setFile(event.target.files?.[0] || null)}
                                disabled={isImporting}
                                className="block w-full text-sm text-gray-700 file:mr-3 file:px-3 file:py-2 file:border-0 file:rounded file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100 disabled:opacity-50"
                            />
                        </label>

                        <label className="flex items-center gap-2 text-sm text-gray-700">
                            <input
                                type="checkbox"
                                checked={preservePublicationStatus}
                                onChange={(event) => setPreservePublicationStatus(event.target.checked)}
                                disabled={isImporting}
                                className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                            />
                            <span>Preserve publication status</span>
                        </label>
                    </div>

                    <div className="flex justify-end gap-3 p-6 border-t border-gray-200">
                        <button
                            type="button"
                            onClick={onClose}
                            disabled={isImporting}
                            className="px-4 py-2 text-gray-700 bg-gray-100 rounded hover:bg-gray-200 disabled:opacity-50"
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            disabled={isImporting || !file}
                            className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
                        >
                            {isImporting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
                            {isImporting ? 'Uploading...' : 'Import Root'}
                        </button>
                    </div>
                </form>
            </div>
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
                    <div className="text-lg font-medium text-gray-900" role="heading" aria-level="3">
                        {positioningParams ?
                            `Add Child Page to "${positioningParams.parentPage.title}"` :
                            'Create New Page'
                        }
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
                            <div className="text-sm text-blue-800">
                                This page will be created as a child page under "{positioningParams.parentPage.title}".
                            </div>
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
                    <div className="text-lg font-medium text-gray-900" role="heading" aria-level="3">
                        Create Root Page
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
                        <div className="text-xs text-gray-500 mt-1">
                            URL slug will be automatically generated from the title
                        </div>
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
                        <div className="text-xs text-gray-500 mt-1">
                            Enter hostnames separated by commas. Root pages need at least one hostname.
                        </div>
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
                        <div className="text-sm text-purple-800">
                            Root pages are top-level pages that can be accessed directly via hostnames.
                            They serve as entry points to your site.
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
