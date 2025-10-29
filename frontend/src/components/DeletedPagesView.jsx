import { useState, useCallback, useEffect } from 'react'
import { useInfiniteQuery, useQueryClient } from '@tantml:invoke>react-query'
import { Trash2, RefreshCw, Search, X, AlertCircle, CheckCircle } from 'lucide-react'
import { pagesApi } from '@/api/pages'
import { useNotification } from '@/hooks/useNotification'
import { useConfirm } from '@/hooks/useConfirm'
import RestorePageDialog from './RestorePageDialog'

/**
 * DeletedPagesView Component
 * 
 * Displays a searchable, infinite-scroll list of soft-deleted pages
 * with restoration capabilities.
 */
export default function DeletedPagesView({ isStaff = false }) {
    const [searchTerm, setSearchTerm] = useState('')
    const [selectedPageIds, setSelectedPageIds] = useState(new Set())
    const [restoreDialogPage, setRestoreDialogPage] = useState(null)
    const { addNotification } = useNotification()
    const { showConfirm } = useConfirm()
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
    } = useInfiniteQuery(
        ['deleted-pages', searchTerm],
        async ({ pageParam = 1 }) => {
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
        {
            getNextPageParam: (lastPage) => {
                if (lastPage.next) {
                    // Extract page number from next URL
                    const url = new URL(lastPage.next, window.location.origin)
                    return url.searchParams.get('page')
                }
                return undefined
            },
            enabled: isStaff
        }
    )

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
            addNotification(result.message || 'Page restored successfully', 'success')

            // Show warnings if any
            if (result.result?.warnings && result.result.warnings.length > 0) {
                result.result.warnings.forEach(warning => {
                    addNotification(warning, 'warning')
                })
            }

            // Refetch deleted pages and active pages
            queryClient.invalidateQueries(['deleted-pages'])
            queryClient.invalidateQueries(['pages'])
            setRestoreDialogPage(null)
            setSelectedPageIds(prev => {
                const next = new Set(prev)
                next.delete(pageId)
                return next
            })
        } catch (error) {
            console.error('Failed to restore page:', error)
            addNotification(error.message || 'Failed to restore page', 'error')
        }
    }, [addNotification, queryClient])

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
            addNotification(result.message || 'Pages restored successfully', 'success')

            // Show warnings if any
            if (result.warnings && result.warnings.length > 0) {
                result.warnings.forEach(warning => {
                    addNotification(warning, 'warning')
                })
            }

            // Refetch
            queryClient.invalidateQueries(['deleted-pages'])
            queryClient.invalidateQueries(['pages'])
            setSelectedPageIds(new Set())
        } catch (error) {
            console.error('Failed to bulk restore:', error)
            addNotification(error.message || 'Failed to restore pages', 'error')
        }
    }, [selectedPageIds, addNotification, showConfirm, queryClient])

    // Permission check
    if (!isStaff) {
        return (
            <div className="flex items-center justify-center h-64">
                <div className="text-center">
                    <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
                    <h3 className="text-lg font-medium text-gray-900">Access Denied</h3>
                    <p className="text-gray-600 mt-2">
                        You need staff/admin permissions to view deleted pages.
                    </p>
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
                    <p className="text-gray-600">Loading deleted pages...</p>
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
                    <h3 className="text-lg font-medium text-gray-900">Error Loading Pages</h3>
                    <p className="text-gray-600 mt-2">{error?.message || 'Unknown error'}</p>
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
            {/* Header */}
            <div className="flex-shrink-0 border-b border-gray-200 bg-white px-6 py-4">
                <div className="flex items-center justify-between mb-4">
                    <div>
                        <h2 className="text-lg font-semibold text-gray-900">Deleted Pages</h2>
                        <p className="text-sm text-gray-600 mt-1">
                            {deletedPages.length} deleted page{deletedPages.length !== 1 ? 's' : ''}
                        </p>
                    </div>
                    {selectedPageIds.size > 0 && (
                        <button
                            onClick={handleBulkRestore}
                            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
                        >
                            <RefreshCw className="w-4 h-4" />
                            Restore Selected ({selectedPageIds.size})
                        </button>
                    )}
                </div>

                {/* Search */}
                <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                    <input
                        type="text"
                        placeholder="Search deleted pages..."
                        value={searchTerm}
                        onChange={(e) => handleSearch(e.target.value)}
                        className="w-full pl-10 pr-10 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                    {searchTerm && (
                        <button
                            onClick={handleClearSearch}
                            className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                        >
                            <X className="w-5 h-5" />
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
                            <h3 className="text-lg font-medium text-gray-900">No Deleted Pages</h3>
                            <p className="text-gray-600 mt-2">
                                {searchTerm
                                    ? 'No deleted pages match your search.'
                                    : 'There are no deleted pages to restore.'}
                            </p>
                        </div>
                    </div>
                ) : (
                    <div className="divide-y divide-gray-200">
                        {/* Select all header */}
                        <div className="bg-gray-50 px-6 py-3 flex items-center gap-3 sticky top-0 z-10">
                            <input
                                type="checkbox"
                                checked={selectedPageIds.size === deletedPages.length && deletedPages.length > 0}
                                onChange={handleSelectAll}
                                className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                            />
                            <span className="text-sm font-medium text-gray-700">
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
function DeletedPageRow({ page, isSelected, onToggleSelect, onRestore }) {
    const hasWarnings = page.restorationWarnings && page.restorationWarnings.length > 0

    return (
        <div className="px-6 py-4 hover:bg-gray-50 flex items-start gap-3">
            {/* Checkbox */}
            <input
                type="checkbox"
                checked={isSelected}
                onChange={() => onToggleSelect(page.id)}
                className="mt-1 w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
            />

            {/* Content */}
            <div className="flex-1 min-w-0">
                <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                        <h3 className="text-sm font-medium text-gray-900 truncate">
                            {page.title || page.slug || `Page ${page.id}`}
                        </h3>
                        <p className="text-sm text-gray-500 mt-1">
                            <span className="font-mono text-xs">{page.slug || 'No slug'}</span>
                        </p>
                        <p className="text-xs text-gray-600 mt-1">
                            Original location: <span className="font-medium">{page.parentPath}</span>
                        </p>
                        {page.childrenCount > 0 && (
                            <p className="text-xs text-gray-600 mt-1">
                                {page.childrenCount} subpage{page.childrenCount !== 1 ? 's' : ''}
                            </p>
                        )}
                        <p className="text-xs text-gray-500 mt-1">
                            Deleted {new Date(page.deletedAt).toLocaleDateString()} by {page.deletedByUsername}
                        </p>
                    </div>

                    {/* Restore button */}
                    <button
                        onClick={() => onRestore(page)}
                        className="flex-shrink-0 flex items-center gap-2 px-3 py-1.5 text-sm bg-blue-600 text-white rounded-md hover:bg-blue-700"
                    >
                        <RefreshCw className="w-4 h-4" />
                        Restore
                    </button>
                </div>

                {/* Warnings */}
                {hasWarnings && (
                    <div className="mt-3 p-2 bg-yellow-50 border border-yellow-200 rounded-md">
                        <div className="flex items-start gap-2">
                            <AlertCircle className="w-4 h-4 text-yellow-600 flex-shrink-0 mt-0.5" />
                            <div className="flex-1">
                                <p className="text-xs font-medium text-yellow-800">Restoration Warnings:</p>
                                <ul className="text-xs text-yellow-700 mt-1 space-y-1">
                                    {page.restorationWarnings.map((warning, idx) => (
                                        <li key={idx}>• {warning}</li>
                                    ))}
                                </ul>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    )
}

