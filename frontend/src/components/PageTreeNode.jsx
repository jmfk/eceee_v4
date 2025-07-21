import { useState, useCallback } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import {
    ChevronRight,
    ChevronDown,
    FileText,
    Folder,
    FolderOpen,
    Edit,
    Copy,
    Scissors,
    Trash2,
    Globe,
    Clock,
    AlertCircle,
    AlertTriangle,
    Loader2
} from 'lucide-react'
import { getPageChildren, movePage, deletePage } from '../api/pages'
import { pageTreeUtils } from '../api/pages'
import toast from 'react-hot-toast'
import Tooltip from './Tooltip'

const PageTreeNode = ({
    page,
    level = 0,
    onExpand,
    onCollapse,
    onLoadChildren,
    onEdit,
    onCut,
    onCopy,
    onPaste,
    onDelete,
    cutPageId,
    copiedPageId
}) => {
    const [isExpanded, setIsExpanded] = useState(page.isExpanded || false)
    const [isLoading, setIsLoading] = useState(false)
    const queryClient = useQueryClient()

    // Check if page has children
    const hasChildren = pageTreeUtils.hasChildren(page)

    // Check if page is cut/copied
    const isCut = cutPageId === page.id
    const isCopied = copiedPageId === page.id

    // Animation state for page movement
    const [isAnimating, setIsAnimating] = useState(false)
    const [animationDirection, setAnimationDirection] = useState('') // 'up', 'down', 'left', 'right'

    // Check if this is a top-level page without hostname
    const isTopLevel = level === 0
    const hasHostnames = page.hostnames && page.hostnames.length > 0
    const needsHostnameWarning = isTopLevel && !hasHostnames

    // Expand/collapse toggle
    const handleToggleExpand = async () => {
        if (!hasChildren) return

        if (!isExpanded && !page.childrenLoaded) {
            setIsLoading(true)
            try {
                await onLoadChildren(page.id)
            } catch (error) {
                toast.error('Failed to load child pages')
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
        toast.success('Page cut to clipboard')
    }

    const handleCopy = () => {
        onCopy?.(page.id)
        toast.success('Page copied to clipboard')
    }

    const handleDelete = () => {
        if (confirm(`Are you sure you want to delete "${page.title}"? This action cannot be undone.`)) {
            onDelete?.(page.id)
        }
    }

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
                    ${isCopied ? 'bg-blue-50' : ''}
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
                        <span className="truncate font-medium text-sm">
                            {page.title}
                        </span>
                        <span className="text-xs text-gray-500 truncate">
                            /{page.slug}
                        </span>
                        <Tooltip
                            text={
                                page.publication_status === 'published' ?
                                    `Published` :
                                    page.publication_status === 'scheduled' ?
                                        `Scheduled` :
                                        page.publication_status === 'unpublished' ?
                                            `Unpublished` :
                                            `Draft`
                            }
                            position="top"
                        >
                            <div className="cursor-help">
                                {getStatusIcon()}
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

                    <Tooltip text="Copy" position="top">
                        <button
                            onClick={handleCopy}
                            className="p-1 rounded hover:bg-gray-200 text-gray-500 hover:text-blue-600 transition-colors"
                        >
                            <Copy className="w-3 h-3" />
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

                    {(cutPageId || copiedPageId) && (
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
                            onCopy={onCopy}
                            onPaste={onPaste}
                            onDelete={onDelete}
                            cutPageId={cutPageId}
                            copiedPageId={copiedPageId}
                        />
                    ))}
                </div>
            )}
        </div>
    )
}

export default PageTreeNode 