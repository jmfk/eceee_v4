import { useState, useCallback, useEffect } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import {
    ChevronRight,
    ChevronDown,
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
    Search
} from 'lucide-react'
import { getPageChildren, movePage, deletePage } from '../api/pages'
import { pageTreeUtils } from '../api/pages'
import { api } from '../api/client.js'
import { getPageDisplayUrl, isRootPage, sanitizePageData } from '../utils/apiValidation.js'
import Tooltip from './Tooltip'

const PageTreeNode = ({
    page,
    level = 0,
    onExpand,
    onCollapse,
    onLoadChildren,
    onEdit,
    onCut,
    onPaste,
    onDelete,
    onAddPageBelow,
    cutPageId,
    onRefreshChildren,
    isSearchMode = false,
    searchTerm = ''
}) => {
    const [isExpanded, setIsExpanded] = useState(page.isExpanded || false)
    const [isLoading, setIsLoading] = useState(false)
    const [showHostnameModal, setShowHostnameModal] = useState(false)
    const [isEditingTitle, setIsEditingTitle] = useState(false)
    const [editingTitle, setEditingTitle] = useState('')
    const [isEditingSlug, setIsEditingSlug] = useState(false)
    const [editingSlug, setEditingSlug] = useState('')
    const [isTogglingPublication, setIsTogglingPublication] = useState(false)
    const queryClient = useQueryClient()

    // Sync local expansion state with page prop changes
    useEffect(() => {
        if (page.isExpanded !== undefined) {
            setIsExpanded(page.isExpanded)
        }
    }, [page.isExpanded])

    // Check if page has children
    const hasChildren = pageTreeUtils.hasChildren(page)

    // Check if page is cut
    const isCut = cutPageId === page.id

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

    // Expand/collapse toggle
    const handleToggleExpand = async () => {
        if (!hasChildren) return

        if (!isExpanded && !page.childrenLoaded) {
            setIsLoading(true)
            try {
                await onLoadChildren(page.id)
            } catch (error) {
                console.error('Error loading children:', error)
            } finally {
                setIsLoading(false)
            }
        }

        const newExpanded = !isExpanded
        setIsExpanded(newExpanded)

        if (newExpanded) {
            onExpand?.(page.id)
        } else {
            onCollapse?.(page.id)
        }
    }

    // Context menu or button handlers
    const handleEdit = () => {
        onEdit?.(page)
    }

    const handleCut = () => {
        onCut?.(page.id)
    }

    const handleDelete = () => {
        if (confirm(`Are you sure you want to delete "${page.title}"? This action cannot be undone.`)) {
            onDelete?.(page.id)
        }
    }

    const handleAddPageBelow = () => {
        onAddPageBelow?.(page)
    }

    const handleHostnameClick = () => {
        if (isRootPageCheck) {
            setShowHostnameModal(true)
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

        if (page.publication_status === 'published') {
            unpublishPageMutation.mutate()
        } else {
            publishPageMutation.mutate()
        }
    }

    const canTogglePublication = () => {
        // Only allow toggling between published and unpublished for simplicity
        return page.publication_status === 'published' || page.publication_status === 'unpublished'
    }

    // Utility function to update page data in cache
    const updatePageInCache = useCallback((pageId, updates) => {
        // Update root pages cache
        queryClient.setQueryData(['pages', 'root'], (oldData) => {
            if (!oldData) return oldData

            const updatePageInResults = (results) => {
                return results.map(p => {
                    if (p.id === pageId) {
                        return { ...p, ...updates }
                    }
                    if (p.children && p.children.length > 0) {
                        return { ...p, children: updatePageInResults(p.children) }
                    }
                    return p
                })
            }

            return {
                ...oldData,
                results: updatePageInResults(oldData.results)
            }
        })

        // Update search results cache
        queryClient.setQueryData(['pages', 'search'], (oldData) => {
            if (!oldData) return oldData

            const updatePageInResults = (results) => {
                return results.map(p => {
                    if (p.id === pageId) {
                        return { ...p, ...updates }
                    }
                    return p
                })
            }

            return {
                ...oldData,
                results: updatePageInResults(oldData.results)
            }
        })

        // Update children cache for this page
        queryClient.setQueryData(['page-children', pageId], (oldData) => {
            if (!oldData) return oldData

            const updatePageInChildren = (results) => {
                return results.map(p => {
                    if (p.id === pageId) {
                        return { ...p, ...updates }
                    }
                    if (p.children && p.children.length > 0) {
                        return { ...p, children: updatePageInChildren(p.children) }
                    }
                    return p
                })
            }

            return {
                ...oldData,
                results: updatePageInChildren(oldData.results)
            }
        })
    }, [queryClient])

    // Update page hostnames mutation
    const updateHostnamesMutation = useMutation({
        mutationFn: async (hostnamesData) => {
            const response = await api.patch(`/api/v1/webpages/pages/${page.id}/`, hostnamesData)
            return response.data
        },
        onSuccess: (updatedPage) => {
            setShowHostnameModal(false)

            // Update the specific page in the tree with optimistic update
            updatePageInCache(page.id, { hostnames: updatedPage.hostnames })
        },
        onError: (error) => {
            console.error('Failed to update hostnames:', error.response?.data?.detail || error.message)
        }
    })

    // Update page title mutation
    const updateTitleMutation = useMutation({
        mutationFn: async (titleData) => {
            const response = await api.patch(`/api/v1/webpages/pages/${page.id}/`, titleData)
            return response.data
        },
        onSuccess: (updatedPage) => {
            setIsEditingTitle(false)

            // Update the specific page in the tree with optimistic update
            updatePageInCache(page.id, { title: updatedPage.title })
        },
        onError: (error) => {
            console.error('Failed to update title:', error.response?.data?.detail || error.message)
            setEditingTitle(page.title) // Reset to original title on error
        }
    })

    // Update page slug mutation
    const updateSlugMutation = useMutation({
        mutationFn: async (slugData) => {
            const response = await api.patch(`/api/v1/webpages/pages/${page.id}/`, slugData)
            return response.data
        },
        onSuccess: (updatedPage) => {
            setIsEditingSlug(false)

            // Update the specific page in the tree with optimistic update
            updatePageInCache(page.id, { slug: updatedPage.slug })
        },
        onError: (error) => {
            console.error('Failed to update slug:', error.response?.data?.detail || error.message)
            setEditingSlug(page.slug) // Reset to original slug on error
        }
    })

    // Publish page mutation
    const publishPageMutation = useMutation({
        mutationFn: async () => {
            const response = await api.post(`/api/v1/webpages/pages/${page.id}/publish/`)
            return response.data
        },
        onSuccess: (updatedPage) => {
            setIsTogglingPublication(false)

            // Update the specific page in the tree with optimistic update
            updatePageInCache(page.id, { publication_status: updatedPage.publication_status || 'published' })
        },
        onError: (error) => {
            console.error('Failed to publish page:', error.response?.data?.detail || error.message)
            setIsTogglingPublication(false)
        }
    })

    // Unpublish page mutation
    const unpublishPageMutation = useMutation({
        mutationFn: async () => {
            const response = await api.post(`/api/v1/webpages/pages/${page.id}/unpublish/`)
            return response.data
        },
        onSuccess: (updatedPage) => {
            setIsTogglingPublication(false)

            // Update the specific page in the tree with optimistic update
            updatePageInCache(page.id, { publication_status: updatedPage.publication_status || 'unpublished' })
        },
        onError: (error) => {
            console.error('Failed to unpublish page:', error.response?.data?.detail || error.message)
            setIsTogglingPublication(false)
        }
    })

    // Status icon based on publication status
    const getStatusIcon = () => {
        switch (page.publication_status) {
            case 'published':
                return <Globe className="w-3 h-3 text-green-500" />
            case 'scheduled':
                return <Clock className="w-3 h-3 text-blue-500" />
            case 'unpublished':
                return <AlertCircle className="w-3 h-3 text-gray-400" />
            default:
                return <AlertCircle className="w-3 h-3 text-gray-400" />
        }
    }

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
                    flex items-center px-2 py-1 hover:bg-gray-50 group relative
                    ${isCut ? 'opacity-60 bg-orange-50' : ''}
                    ${page.isSearchResult ? 'bg-blue-50 border-l-4 border-blue-400' : ''}
                    ${page.highlightSearch ? 'bg-yellow-50 border-l-4 border-yellow-400' : ''}
                    ${level > 0 ? 'border-l border-gray-200' : ''}
                    ${isAnimating ? 'transition-all duration-500 ease-in-out' : ''}
                    ${animationDirection === 'up' ? 'transform -translate-y-8' : ''}
                    ${animationDirection === 'down' ? 'transform translate-y-8' : ''}
                    ${animationDirection === 'left' ? 'transform -translate-x-8' : ''}
                    ${animationDirection === 'right' ? 'transform translate-x-8' : ''}
                `}
                style={{ paddingLeft: `${level * 24 + 8}px` }}
            >
                {/* Expand/collapse button */}
                <button
                    onClick={handleToggleExpand}
                    className={`
                            mr-1 p-1 rounded transition-all duration-200 hover:shadow-sm
                            ${!hasChildren ? 'invisible' : ''}
                            hover:bg-gray-200
                        `}
                    disabled={isLoading}
                >
                    {isLoading ? (
                        <Loader2 className="w-3 h-3 animate-spin text-gray-400" />
                    ) : hasChildren ? (
                        isExpanded ? (
                            <ChevronDown className="w-3 h-3 text-gray-600" />
                        ) : (
                            <ChevronRight className="w-3 h-3 text-gray-600" />
                        )
                    ) : null}
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
                                    <Save className="w-3 h-3" />
                                </button>
                                <button
                                    onClick={handleTitleCancel}
                                    disabled={updateTitleMutation.isPending}
                                    className="p-0.5 rounded hover:bg-red-100 text-red-600 transition-colors disabled:opacity-50"
                                    title="Cancel (Escape)"
                                >
                                    <X className="w-3 h-3" />
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
                                    <Save className="w-3 h-3" />
                                </button>
                                <button
                                    onClick={handleSlugCancel}
                                    disabled={updateSlugMutation.isPending}
                                    className="p-0.5 rounded hover:bg-red-100 text-red-600 transition-colors disabled:opacity-50"
                                    title="Cancel (Escape)"
                                >
                                    <X className="w-3 h-3" />
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
                        <Tooltip
                            text={
                                canTogglePublication() ?
                                    (page.publication_status === 'published' ?
                                        'Published - Click to unpublish' :
                                        'Unpublished - Click to publish') :
                                    (page.publication_status === 'scheduled' ?
                                        'Scheduled' :
                                        page.publication_status === 'expired' ?
                                            'Expired' :
                                            'Draft')
                            }
                            position="top"
                        >
                            <div
                                className={`${canTogglePublication() ? 'cursor-pointer hover:scale-110 transition-transform' : 'cursor-help'} ${isTogglingPublication ? 'opacity-50' : ''}`}
                                onClick={canTogglePublication() ? handlePublicationToggle : undefined}
                            >
                                {isTogglingPublication ? (
                                    <Loader2 className="w-3 h-3 animate-spin text-blue-500" />
                                ) : (
                                    getStatusIcon()
                                )}
                            </div>
                        </Tooltip>

                        {/* Hostname warning for top-level pages */}
                        {needsHostnameWarning && (
                            <Tooltip text="Missing hostname - This top-level page needs at least one hostname" position="top">
                                <div className="cursor-help ml-1">
                                    <AlertTriangle className="w-3 h-3 text-amber-500" />
                                </div>
                            </Tooltip>
                        )}
                    </div>
                </div>

                {/* Children count */}
                {hasChildren && (
                    <span className="text-xs text-gray-400 mr-2 cursor-help">
                        ({page.children_count})
                    </span>
                )}

                {/* Action buttons - shown on hover */}
                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <Tooltip text="Edit" position="top">
                        <button
                            onClick={handleEdit}
                            className="p-1 rounded hover:bg-gray-200 text-gray-500 hover:text-blue-600 transition-colors"
                        >
                            <Edit className="w-3 h-3" />
                        </button>
                    </Tooltip>

                    <Tooltip text="Cut" position="top">
                        <button
                            onClick={handleCut}
                            className="p-1 rounded hover:bg-gray-200 text-gray-500 hover:text-orange-600 transition-colors"
                        >
                            <Scissors className="w-3 h-3" />
                        </button>
                    </Tooltip>

                    <Tooltip text="Add child page" position="top">
                        <button
                            onClick={handleAddPageBelow}
                            className="p-1 rounded hover:bg-green-100 text-gray-500 hover:text-green-600 transition-colors"
                        >
                            <Plus className="w-3 h-3" />
                        </button>
                    </Tooltip>

                    {cutPageId && (
                        <>
                            <Tooltip text="Paste above" position="top">
                                <button
                                    onClick={() => onPaste?.(page.id, 'above')}
                                    className="p-1 rounded hover:bg-green-100 text-gray-500 hover:text-green-700 transition-colors"
                                >
                                    <span className="text-xs font-semibold">📋↑</span>
                                </button>
                            </Tooltip>
                            <Tooltip text="Paste below" position="top">
                                <button
                                    onClick={() => onPaste?.(page.id, 'below')}
                                    className="p-1 rounded hover:bg-green-100 text-gray-500 hover:text-green-700 transition-colors"
                                >
                                    <span className="text-xs font-semibold">📋↓</span>
                                </button>
                            </Tooltip>
                            <Tooltip text="Paste as child" position="top">
                                <button
                                    onClick={() => onPaste?.(page.id, 'child')}
                                    className="p-1 rounded hover:bg-green-100 text-gray-500 hover:text-green-700 transition-colors"
                                >
                                    <span className="text-xs font-semibold">📋→</span>
                                </button>
                            </Tooltip>
                        </>
                    )}

                    <Tooltip text="Delete" position="top">
                        <button
                            onClick={handleDelete}
                            className="p-1 rounded hover:bg-red-100 text-gray-500 hover:text-red-700 transition-colors"
                        >
                            <Trash2 className="w-3 h-3" />
                        </button>
                    </Tooltip>
                </div>
            </div>

            {/* Children */}
            {isExpanded && page.children && page.children.length > 0 && (
                <div className="ml-4">
                    {page.children.map((child) => (
                        <PageTreeNode
                            key={child.id}
                            page={child}
                            level={level + 1}
                            onExpand={onExpand}
                            onCollapse={onCollapse}
                            onLoadChildren={onLoadChildren}
                            onEdit={onEdit}
                            onCut={onCut}
                            onPaste={onPaste}
                            onDelete={onDelete}
                            onAddPageBelow={onAddPageBelow}
                            cutPageId={cutPageId}
                            onRefreshChildren={onRefreshChildren}
                            isSearchMode={isSearchMode}
                            searchTerm={searchTerm}
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
}

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
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
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