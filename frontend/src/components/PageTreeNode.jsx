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
import DropZone from './DropZone'

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
    copiedPageId,
    onDragStart,
    onDragEnd,
    onDragOver,
    onDrop,
    isDragOver,
    canDrop,
    isDragging,
    draggedPageId,
    hoveredPageId
}) => {
    const [isExpanded, setIsExpanded] = useState(page.isExpanded || false)
    const [isLoading, setIsLoading] = useState(false)
    const [isNodeDragging, setIsNodeDragging] = useState(false)
    const queryClient = useQueryClient()

    // Check if page has children
    const hasChildren = pageTreeUtils.hasChildren(page)

    // Check if page is cut/copied
    const isCut = cutPageId === page.id
    const isCopied = copiedPageId === page.id

    // Derived drag states
    const isBeingDragged = draggedPageId === page.id
    const isHovered = hoveredPageId === page.id && isDragging && !isBeingDragged

    // Individual dropzone hover states
    const [hoveredDropzone, setHoveredDropzone] = useState(null) // 'before', 'inside', 'after', or null
    const [dragOverZone, setDragOverZone] = useState(null) // Track which zone of main node is being dragged over

    // Animation state for page movement
    const [isAnimating, setIsAnimating] = useState(false)
    const [animationDirection, setAnimationDirection] = useState('') // 'up', 'down', 'left', 'right'

    // Check if this is a top-level page without hostname
    const isTopLevel = level === 0
    const hasHostnames = page.hostnames && page.hostnames.length > 0
    const needsHostnameWarning = isTopLevel && !hasHostnames

    // Expand/collapse toggle (disabled during drag operations)
    const handleToggleExpand = async () => {
        if (!hasChildren || isDragging) return

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

    // Drag and drop handlers
    const handleDragStart = (e) => {
        setIsNodeDragging(true)
        e.dataTransfer.setData('text/plain', page.id.toString())
        e.dataTransfer.effectAllowed = 'move'
        onDragStart?.(page)
    }

    const handleDragEnd = () => {
        setIsNodeDragging(false)
        setDragOverZone(null) // Clear zone state when drag ends
        onDragEnd?.()
    }

    const handleDragOver = (e) => {
        e.preventDefault()
        e.dataTransfer.dropEffect = 'move'

        // Track which zone of the node is being dragged over for visual feedback
        if (isDragging && !isBeingDragged) {
            const rect = e.currentTarget.getBoundingClientRect()
            const mouseY = e.clientY - rect.top
            const elementHeight = rect.height

            const topZone = elementHeight * 0.25
            const bottomZone = elementHeight * 0.75

            let zone = 'inside'
            if (mouseY < topZone) {
                zone = 'before'
            } else if (mouseY > bottomZone) {
                zone = 'after'
            } else if (hasChildren) {
                zone = 'inside'
            } else {
                zone = 'after'
            }

            setDragOverZone(zone)
        }

        onDragOver?.(page)
    }

    const handleDragLeave = (e) => {
        // Clear zone state when drag leaves the element
        if (!e.currentTarget.contains(e.relatedTarget)) {
            setDragOverZone(null)
        }
    }

    const handleDrop = (e) => {
        e.preventDefault()
        e.stopPropagation()

        const draggedPageId = parseInt(e.dataTransfer.getData('text/plain'))
        if (draggedPageId && draggedPageId !== page.id) {
            // Smart position detection based on mouse coordinates
            const rect = e.currentTarget.getBoundingClientRect()
            const mouseY = e.clientY - rect.top
            const elementHeight = rect.height

            let position = 'child' // default fallback

            // Divide the element into zones for position detection
            const topZone = elementHeight * 0.25  // Top 25% = before
            const bottomZone = elementHeight * 0.75  // Bottom 25% = after

            if (mouseY < topZone) {
                position = 'before'
            } else if (mouseY > bottomZone) {
                position = 'after'
            } else if (hasChildren) {
                // Middle zone - if page has children, default to 'inside', otherwise 'before'
                position = 'inside'
            } else {
                // If no children, prefer 'after' for middle drops
                position = 'after'
            }

            console.log(`Smart drop detection: mouseY=${mouseY}, height=${elementHeight}, position=${position}`)
            setDragOverZone(null) // Clear zone state after drop
            onDrop?.(draggedPageId, page.id, e, position)
        }
    }

    // DropZone drop handler
    const handleDropZoneDrop = (e, position) => {
        e.preventDefault()
        e.stopPropagation()

        const draggedPageId = parseInt(e.dataTransfer.getData('text/plain'))
        if (draggedPageId && draggedPageId !== page.id) {
            // Handle different drop positions
            onDrop?.(draggedPageId, page.id, e, position)
        }
    }

    // DropZone hover handlers
    const handleDropZoneMouseEnter = (position) => {
        if (isDragging) {
            setHoveredDropzone(position)
        }
    }

    const handleDropZoneMouseLeave = () => {
        setHoveredDropzone(null)
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
            {/* Drop zone before */}
            <DropZone
                position="before"
                isVisible={isHovered || hoveredDropzone === 'before'}
                isHovered={hoveredDropzone === 'before'}
                onDrop={handleDropZoneDrop}
                level={level}
                targetPageTitle={page.title}
                onMouseEnter={() => handleDropZoneMouseEnter('before')}
                onMouseLeave={handleDropZoneMouseLeave}
                isDragging={isDragging}
            />

            {/* Main node */}
            <div
                className={`
                    flex items-center px-2 py-1 hover:bg-gray-50 cursor-pointer group relative
                    ${isBeingDragged ? 'opacity-50' : ''}
                    ${isCut ? 'opacity-60 bg-orange-50' : ''}
                    ${isCopied ? 'bg-blue-50' : ''}
                    ${isDragOver && canDrop ? 'bg-green-100 border-l-4 border-green-500' : ''}
                    ${level > 0 ? 'border-l border-gray-200' : ''}
                    ${isAnimating ? 'transition-all duration-500 ease-in-out' : ''}
                    ${animationDirection === 'up' ? 'transform -translate-y-8' : ''}
                    ${animationDirection === 'down' ? 'transform translate-y-8' : ''}
                    ${animationDirection === 'left' ? 'transform -translate-x-8' : ''}
                    ${animationDirection === 'right' ? 'transform translate-x-8' : ''}
                    ${dragOverZone === 'before' ? 'border-t-4 border-blue-400 bg-blue-50' : ''}
                    ${dragOverZone === 'after' ? 'border-b-4 border-blue-400 bg-blue-50' : ''}
                    ${dragOverZone === 'inside' ? 'bg-blue-50 border-2 border-blue-300 border-dashed' : ''}
                `}
                style={{ paddingLeft: `${level * 24 + 8}px` }}
                draggable={true}
                onDragStart={handleDragStart}
                onDragEnd={handleDragEnd}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
            >
                {/* Visual zone indicator overlay during drag */}
                {dragOverZone && isDragging && !isBeingDragged && (
                    <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                        <div className="bg-blue-600 text-white text-xs px-2 py-1 rounded-md font-medium shadow-md">
                            {dragOverZone === 'before' && 'Drop before'}
                            {dragOverZone === 'after' && 'Drop after'}
                            {dragOverZone === 'inside' && 'Drop inside'}
                        </div>
                    </div>
                )}

                {/* Expand/collapse button */}
                <button
                    onClick={handleToggleExpand}
                    className={`
                            mr-1 p-1 rounded transition-all duration-200 hover:shadow-sm
                            ${!hasChildren ? 'invisible' : ''}
                            ${isDragging ? 'cursor-not-allowed bg-gray-100 text-gray-400' : 'hover:bg-gray-200'}
                        `}
                    disabled={isLoading || isDragging}
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

                {/* Page icon */}
                <div className="mr-2">
                    <div className="cursor-help">
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

            {/* Drop zone inside (for folders) - indented to show it's inside the page */}
            {hasChildren && (
                <DropZone
                    position="inside"
                    isVisible={isHovered || hoveredDropzone === 'inside'}
                    isHovered={hoveredDropzone === 'inside'}
                    onDrop={handleDropZoneDrop}
                    level={level + 1}
                    targetPageTitle={page.title}
                    onMouseEnter={() => handleDropZoneMouseEnter('inside')}
                    onMouseLeave={handleDropZoneMouseLeave}
                    isDragging={isDragging}
                />
            )}

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
                            onDragStart={onDragStart}
                            onDragEnd={onDragEnd}
                            onDragOver={onDragOver}
                            onDrop={onDrop}
                            isDragOver={isDragOver}
                            canDrop={canDrop}
                            isDragging={isDragging}
                            draggedPageId={draggedPageId}
                            hoveredPageId={hoveredPageId}
                        />
                    ))}
                </div>
            )}

            {/* Drop zone after - appears after the page and all its children */}
            <DropZone
                position="after"
                isVisible={isHovered || hoveredDropzone === 'after'}
                isHovered={hoveredDropzone === 'after'}
                onDrop={handleDropZoneDrop}
                level={level}
                targetPageTitle={page.title}
                onMouseEnter={() => handleDropZoneMouseEnter('after')}
                onMouseLeave={handleDropZoneMouseLeave}
                isDragging={isDragging}
            />
        </div>
    )
}

export default PageTreeNode 