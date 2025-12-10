import { useState, useCallback, useEffect } from 'react'
import { useInfiniteQuery, useQueryClient } from '@tanstack/react-query'
import { Trash2, RefreshCw, Search, X, AlertCircle, CheckCircle, AlertTriangle } from 'lucide-react'
import { pagesApi } from '@/api/pages'
import useNotifications from '@/hooks/useNotifications'
import RestorePageDialog from './RestorePageDialog'

/**
 * DeletedPagesView Component
 * 
 * Displays a searchable, infinite-scroll list of soft-deleted pages
 * with restoration and permanent deletion capabilities.
 */
export default function DeletedPagesView({ isStaff = false }) {
    const [searchTerm, setSearchTerm] = useState('')
    const [selectedPageIds, setSelectedPageIds] = useState(new Set())
    const [restoreDialogPage, setRestoreDialogPage] = useState(null)
    const { showNotification, showConfirm } = useNotifications()
    const queryClient = useQueryClient()

    // Infinite query for deleted pages
    const {
        data,
        fetchNextPage,
        hasNextPage,
        isFetchingNextPage,
        isLoading,
        isError,
        error,
        refetch
    } = useInfiniteQuery({
        queryKey: ['deleted-pages', searchTerm],
        queryFn: async ({ pageParam = 1 }) => {
            const params = {
                page: pageParam,
                pageSize: 20,
                ordering: '-deletedAt'
            }
            if (searchTerm) {
                params.search = searchTerm
            }
            return await pagesApi.getDeletedPages(params)
        },
        getNextPageParam: (lastPage) => {
            if (lastPage.next) {
                // Extract page number from next URL
                const url = new URL(lastPage.next, window.location.origin)
                return url.searchParams.get('page')
            }
            return undefined
        },
        enabled: isStaff
    })

    // Flatten pages from all pages
    const deletedPages = data?.pages?.flatMap(page => page.results) || []

    // Handle infinite scroll
    const handleScroll = useCallback((e) => {
        const { scrollTop, scrollHeight, clientHeight } = e.target
        if (scrollHeight - scrollTop <= clientHeight * 1.5 && hasNextPage && !isFetchingNextPage) {
            fetchNextPage()
        }
    }, [hasNextPage, isFetchingNextPage, fetchNextPage])

    // Handle search
    const handleSearch = useCallback((value) => {
        setSearchTerm(value)
        setSelectedPageIds(new Set())
    }, [])

    // Handle clear search
    const handleClearSearch = useCallback(() => {
        setSearchTerm('')
    }, [])

    // Handle select/deselect page
    const handleToggleSelect = useCallback((pageId) => {
        setSelectedPageIds(prev => {
            const next = new Set(prev)
            if (next.has(pageId)) {
                next.delete(pageId)
            } else {
                next.add(pageId)
            }
            return next
        })
    }, [])

    // Handle select all
    const handleSelectAll = useCallback(() => {
        if (selectedPageIds.size === deletedPages.length) {
            setSelectedPageIds(new Set())
        } else {
            setSelectedPageIds(new Set(deletedPages.map(p => p.id)))
        }
    }, [deletedPages, selectedPageIds])

    // Handle restore single page
    const handleRestorePage = useCallback((page) => {
        setRestoreDialogPage(page)
    }, [])

    // Handle restore dialog confirm
    const handleRestoreConfirm = useCallback(async (pageId, options) => {
        try {
            const result = await pagesApi.restorePage(pageId, options)
            showNotification(result.message || 'Page restored successfully', 'success')

            // Show warnings if any
            if (result.result?.warnings && result.result.warnings.length > 0) {
                result.result.warnings.forEach(warning => {
                    showNotification(warning, 'warning')
                })
            }

            // Refetch deleted pages and active pages
            queryClient.invalidateQueries({ queryKey: ['deleted-pages'] })
            queryClient.invalidateQueries({ queryKey: ['pages'] })
            setRestoreDialogPage(null)
            setSelectedPageIds(prev => {
                const next = new Set(prev)
                next.delete(pageId)
                return next
            })
        } catch (error) {
            console.error('Failed to restore page:', error)
            showNotification(error.message || 'Failed to restore page', 'error')
        }
    }, [showNotification, queryClient])

    // Handle bulk restore
    const handleBulkRestore = useCallback(async () => {
        const idsArray = Array.from(selectedPageIds)

        const confirmed = await showConfirm({
            title: 'Restore Pages',
            message: `Are you sure you want to restore ${idsArray.length} page(s)?`,
            confirmText: 'Restore',
            confirmButtonStyle: 'primary'
        })

        if (!confirmed) return

        try {
            const result = await pagesApi.bulkRestore(idsArray, false)
            showNotification(result.message || 'Pages restored successfully', 'success')

            // Show warnings if any
            if (result.warnings && result.warnings.length > 0) {
                result.warnings.forEach(warning => {
                    showNotification(warning, 'warning')
                })
            }

            // Refetch
            queryClient.invalidateQueries({ queryKey: ['deleted-pages'] })
            queryClient.invalidateQueries({ queryKey: ['pages'] })
            setSelectedPageIds(new Set())
        } catch (error) {
            console.error('Failed to bulk restore:', error)
            showNotification(error.message || 'Failed to restore pages', 'error')
        }
    }, [selectedPageIds, showNotification, showConfirm, queryClient])

    // Handle permanent delete single page
    const handlePermanentDelete = useCallback(async (page) => {
        const confirmed = await showConfirm({
            title: '⚠️ Permanently Delete Page',
            message: `Are you ABSOLUTELY SURE you want to permanently delete "${page.title || page.slug}"?\n\n⚠️ WARNING: This action CANNOT be undone! The page and all its data will be permanently removed from the database.`,
            confirmText: 'Permanently Delete',
            confirmButtonStyle: 'danger',
            cancelText: 'Cancel'
        })

        if (!confirmed) return

        try {
            const result = await pagesApi.permanentDelete(page.id, { recursive: false })
            showNotification(result.message || 'Page permanently deleted', 'success')

            // Refetch
            queryClient.invalidateQueries({ queryKey: ['deleted-pages'] })
            setSelectedPageIds(prev => {
                const next = new Set(prev)
                next.delete(page.id)
                return next
            })
        } catch (error) {
            console.error('Failed to permanently delete page:', error)
            showNotification(error.message || 'Failed to permanently delete page', 'error')
        }
    }, [showNotification, showConfirm, queryClient])

    // Handle bulk permanent delete
    const handleBulkPermanentDelete = useCallback(async () => {
        const idsArray = Array.from(selectedPageIds)

        const confirmed = await showConfirm({
            title: '⚠️ Permanently Delete Multiple Pages',
            message: `Are you ABSOLUTELY SURE you want to permanently delete ${idsArray.length} page(s)?\n\n⚠️ WARNING: This action CANNOT be undone! All selected pages and their data will be permanently removed from the database.`,
            confirmText: `Permanently Delete ${idsArray.length} Page(s)`,
            confirmButtonStyle: 'danger',
            cancelText: 'Cancel'
        })

        if (!confirmed) return

        try {
            const result = await pagesApi.bulkPermanentDelete(idsArray, false)
            showNotification(result.message || 'Pages permanently deleted', 'success')

            // Refetch
            queryClient.invalidateQueries({ queryKey: ['deleted-pages'] })
            setSelectedPageIds(new Set())
        } catch (error) {
            console.error('Failed to bulk permanently delete:', error)
            showNotification(error.message || 'Failed to permanently delete pages', 'error')
        }
    }, [selectedPageIds, showNotification, showConfirm, queryClient])

    // Handle permanent delete all
    const handlePermanentDeleteAll = useCallback(async () => {
        const confirmed = await showConfirm({
            title: '⚠️ DANGER: Permanently Delete ALL Deleted Pages',
            message: `Are you ABSOLUTELY SURE you want to permanently delete ALL ${deletedPages.length} deleted page(s)?\n\n⚠️ CRITICAL WARNING: This action CANNOT be undone! ALL soft-deleted pages will be permanently removed from the database forever.`,
            confirmText: `Permanently Delete ALL ${deletedPages.length} Page(s)`,
            confirmButtonStyle: 'danger',
            cancelText: 'Cancel'
        })

        if (!confirmed) return

        try {
            const result = await pagesApi.permanentDeleteAll(true)
            showNotification(result.message || 'All deleted pages permanently deleted', 'success')

            // Refetch
            queryClient.invalidateQueries({ queryKey: ['deleted-pages'] })
            setSelectedPageIds(new Set())
        } catch (error) {
            console.error('Failed to permanently delete all:', error)
            showNotification(error.message || 'Failed to permanently delete all pages', 'error')
        }
    }, [deletedPages.length, showNotification, showConfirm, queryClient])

    // Permission check
    if (!isStaff) {
        return (
            <div className="flex items-center justify-center h-64">
                <div className="text-center">
                    <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
                    <div className="text-lg font-medium text-gray-900" role="heading" aria-level="3">Access Denied</div>
                    <div className="text-gray-600 mt-2">
                        You need staff/admin permissions to view deleted pages.
                    </div>
                </div>
            </div>
        )
    }

    // Loading state
    if (isLoading) {
        return (
            <div className="flex items-center justify-center h-64">
                <div className="text-center">
                    <RefreshCw className="w-8 h-8 text-blue-500 animate-spin mx-auto mb-2" />
                    <div className="text-gray-600">Loading deleted pages...</div>
                </div>
            </div>
        )
    }

    // Error state
    if (isError) {
        return (
            <div className="flex items-center justify-center h-64">
                <div className="text-center">
                    <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
                    <div className="text-lg font-medium text-gray-900" role="heading" aria-level="3">Error Loading Pages</div>
                    <div className="text-gray-600 mt-2">{error?.message || 'Unknown error'}</div>
                    <button
                        onClick={() => refetch()}
                        className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
                    >
                        Try Again
                    </button>
                </div>
            </div>
        )
    }

    return (
        <div className="flex flex-col h-full">
            {/* Header - Compact and responsive */}
            <div className="flex-shrink-0 bg-white px-2 sm:px-4 py-2 sm:py-3 space-y-2">
                <div className="flex items-center justify-between gap-2">
                    <div className="text-xs sm:text-sm text-gray-600">
                        {deletedPages.length} deleted page{deletedPages.length !== 1 ? 's' : ''}
                    </div>
                    <div className="flex items-center gap-1 sm:gap-2">
                        {deletedPages.length > 0 && (
                            <button
                                onClick={handlePermanentDeleteAll}
                                className="flex items-center gap-1 sm:gap-1.5 px-2 sm:px-3 py-1.5 sm:py-2 text-xs sm:text-sm bg-red-600 text-white rounded-md hover:bg-red-700"
                                title="Permanently delete all deleted pages"
                            >
                                <AlertTriangle className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                                <span className="hidden sm:inline">Clean All</span>
                                <span className="sm:hidden">All</span>
                            </button>
                        )}
                        {selectedPageIds.size > 0 && (
                            <>
                                <button
                                    onClick={handleBulkPermanentDelete}
                                    className="flex items-center gap-1 sm:gap-1.5 px-2 sm:px-3 py-1.5 sm:py-2 text-xs sm:text-sm bg-red-600 text-white rounded-md hover:bg-red-700"
                                    title="Permanently delete selected pages"
                                >
                                    <Trash2 className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                                    <span className="hidden sm:inline">Clean ({selectedPageIds.size})</span>
                                    <span className="sm:hidden">Del</span>
                                </button>
                                <button
                                    onClick={handleBulkRestore}
                                    className="flex items-center gap-1 sm:gap-1.5 px-2 sm:px-3 py-1.5 sm:py-2 text-xs sm:text-sm bg-blue-600 text-white rounded-md hover:bg-blue-700"
                                >
                                    <RefreshCw className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                                    <span className="hidden sm:inline">Restore ({selectedPageIds.size})</span>
                                    <span className="sm:hidden">Res</span>
                                </button>
                            </>
                        )}
                    </div>
                </div>

                {/* Search */}
                <div className="relative">
                    <Search className="absolute left-2 sm:left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <input
                        type="text"
                        placeholder="Search deleted pages..."
                        value={searchTerm}
                        onChange={(e) => handleSearch(e.target.value)}
                        className="w-full pl-8 sm:pl-10 pr-8 sm:pr-10 py-1.5 sm:py-2 text-sm border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                    {searchTerm && (
                        <button
                            onClick={handleClearSearch}
                            className="absolute right-2 sm:right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                        >
                            <X className="w-4 h-4" />
                        </button>
                    )}
                </div>
            </div>

            {/* Content */}
            <div
                className="flex-1 overflow-y-auto"
                onScroll={handleScroll}
            >
                {deletedPages.length === 0 ? (
                    <div className="flex items-center justify-center h-64">
                        <div className="text-center">
                            <Trash2 className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                            <div className="text-lg font-medium text-gray-900" role="heading" aria-level="3">No Deleted Pages</div>
                            <div className="text-gray-600 mt-2">
                                {searchTerm
                                    ? 'No deleted pages match your search.'
                                    : 'There are no deleted pages to restore.'}
                            </div>
                        </div>
                    </div>
                ) : (
                    <div className="divide-y divide-gray-200">
                        {/* Select all header - Responsive */}
                        <div className="bg-gray-50 px-2 sm:px-4 md:px-6 py-2 sm:py-3 flex items-center gap-2 sm:gap-3 sticky top-0 z-10">
                            <input
                                type="checkbox"
                                checked={selectedPageIds.size === deletedPages.length && deletedPages.length > 0}
                                onChange={handleSelectAll}
                                className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                            />
                            <span className="text-xs sm:text-sm font-medium text-gray-700">
                                {selectedPageIds.size > 0
                                    ? `${selectedPageIds.size} selected`
                                    : 'Select all'}
                            </span>
                        </div>

                        {/* Page list */}
                        {deletedPages.map((page) => (
                            <DeletedPageRow
                                key={page.id}
                                page={page}
                                isSelected={selectedPageIds.has(page.id)}
                                onToggleSelect={handleToggleSelect}
                                onRestore={handleRestorePage}
                                onPermanentDelete={handlePermanentDelete}
                            />
                        ))}

                        {/* Loading indicator */}
                        {isFetchingNextPage && (
                            <div className="px-6 py-4 text-center">
                                <RefreshCw className="w-6 h-6 text-blue-500 animate-spin mx-auto" />
                            </div>
                        )}
                    </div>
                )}
            </div>

            {/* Restore Dialog */}
            {restoreDialogPage && (
                <RestorePageDialog
                    page={restoreDialogPage}
                    onConfirm={handleRestoreConfirm}
                    onCancel={() => setRestoreDialogPage(null)}
                />
            )}
        </div>
    )
}

/**
 * Deleted Page Row Component
 */
function DeletedPageRow({ page, isSelected, onToggleSelect, onRestore, onPermanentDelete }) {
    const hasWarnings = page.restorationWarnings && page.restorationWarnings.length > 0

    return (
        <div className="px-2 sm:px-4 md:px-6 py-2 hover:bg-gray-50 flex items-start sm:items-center gap-2 sm:gap-3">
            {/* Checkbox */}
            <input
                type="checkbox"
                checked={isSelected}
                onChange={() => onToggleSelect(page.id)}
                className="w-4 h-4 mt-1 sm:mt-0 text-blue-600 border-gray-300 rounded focus:ring-blue-500 flex-shrink-0"
            />

            {/* Content */}
            <div className="flex-1 min-w-0">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 sm:gap-4">
                    <div className="flex-1 min-w-0 space-y-0.5 sm:space-y-1">
                        {/* Row 1: Title and slug */}
                        <div className="flex flex-col sm:flex-row sm:items-baseline gap-0.5 sm:gap-2">
                            <div className="text-xs sm:text-sm font-medium text-gray-900 truncate" role="heading" aria-level="3">
                                {page.title || page.slug || `Page ${page.id}`}
                            </div>
                            <span className="font-mono text-xs text-gray-500 truncate">/{page.slug}</span>
                        </div>

                        {/* Row 2: Metadata inline - Simplified on mobile */}
                        <div className="flex flex-wrap items-center gap-1 sm:gap-2 text-xs text-gray-600">
                            <span className="truncate max-w-full sm:max-w-none">
                                {page.parentPath}
                            </span>
                            {page.childrenCount > 0 && (
                                <>
                                    <span className="hidden sm:inline">•</span>
                                    <span className="whitespace-nowrap">{page.childrenCount} subpage{page.childrenCount !== 1 ? 's' : ''}</span>
                                </>
                            )}
                            <span className="hidden sm:inline">•</span>
                            <span className="whitespace-nowrap">
                                <span className="hidden sm:inline">Deleted </span>
                                {new Date(page.deletedAt).toLocaleDateString()}
                                <span className="hidden sm:inline"> by {page.deletedByUsername}</span>
                            </span>
                        </div>

                        {/* Warnings - compact */}
                        {hasWarnings && (
                            <div className="flex items-center gap-1 text-xs text-yellow-700">
                                <AlertCircle className="w-3 h-3" />
                                <span>{page.restorationWarnings.length} warning{page.restorationWarnings.length !== 1 ? 's' : ''}</span>
                            </div>
                        )}
                    </div>

                    {/* Action buttons */}
                    <div className="flex-shrink-0 flex items-center gap-1 sm:gap-2">
                        <button
                            onClick={() => onPermanentDelete(page)}
                            className="flex items-center gap-1 sm:gap-1.5 px-2 sm:px-3 py-1 text-xs sm:text-sm bg-red-600 text-white rounded-md hover:bg-red-700"
                            title="Permanently delete this page (cannot be undone)"
                        >
                            <Trash2 className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
                            <span className="hidden sm:inline">Clean</span>
                        </button>
                        <button
                            onClick={() => onRestore(page)}
                            className="flex items-center gap-1 sm:gap-1.5 px-2 sm:px-3 py-1 text-xs sm:text-sm bg-blue-600 text-white rounded-md hover:bg-blue-700"
                        >
                            <RefreshCw className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
                            Restore
                        </button>
                    </div>
                </div>
            </div>
        </div>
    )
}
