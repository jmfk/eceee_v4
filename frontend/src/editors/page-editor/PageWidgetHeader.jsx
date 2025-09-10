/**
 * PageEditor Widget Header
 * 
 * Widget header component specifically designed for PageEditor with
 * version management, publishing controls, and layout-specific features.
 */
import React, { useState, useRef, useEffect } from 'react'
import {
    Settings,
    Trash2,
    ChevronUp,
    ChevronDown,
    Eye,
    MoreHorizontal,
    Calendar,
    GitBranch,
    Globe,
    Lock
} from 'lucide-react'

const PageWidgetHeader = ({
    widgetType,
    onEdit,
    onDelete,
    onMoveUp,
    onMoveDown,
    onPreview,
    onModalPreview,
    canMoveUp = false,
    canMoveDown = false,
    showControls = true,
    // PageEditor-specific props
    isPublished = false,
    versionId,
    onPublishingAction,
    className = ''
}) => {
    const [showMenu, setShowMenu] = useState(false)
    const menuRef = useRef(null)

    // Close menu when clicking outside
    useEffect(() => {
        const handleClickOutside = (event) => {
            if (menuRef.current && !menuRef.current.contains(event.target)) {
                setShowMenu(false)
            }
        }

        if (showMenu) {
            document.addEventListener('mousedown', handleClickOutside)
            return () => document.removeEventListener('mousedown', handleClickOutside)
        }
    }, [showMenu])

    // Handle publishing actions
    const handlePublishingAction = (action) => {
        if (onPublishingAction) {
            onPublishingAction(action, versionId)
        }
        setShowMenu(false)
    }

    const handleMenuToggle = () => {
        setShowMenu(!showMenu)
    }

    if (!showControls) {
        return null
    }

    return (
        <div className={`widget-header page-editor-header bg-gray-100 border border-gray-200 rounded-t px-3 py-2 flex items-center justify-between ${className}`}>
            {/* Left side - Widget info and status */}
            <div className="flex items-center space-x-2">
                <div className="flex items-center space-x-2">
                    <span className="text-xs font-medium text-gray-700">
                        {widgetType}
                    </span>
                </div>
            </div>

            {/* Right side - Action buttons */}
            <div className="flex items-center space-x-1">
                {/* Move controls */}
                {(canMoveUp || canMoveDown) && (
                    <div className="flex items-center border-r border-gray-300 pr-2 mr-2">
                        <button
                            onClick={onMoveUp}
                            disabled={!canMoveUp}
                            className={`p-1 rounded transition-colors ${canMoveUp
                                ? 'text-gray-600 hover:text-gray-900 hover:bg-gray-200'
                                : 'text-gray-400 cursor-not-allowed'
                                }`}
                            title="Move up"
                        >
                            <ChevronUp className="h-3 w-3" />
                        </button>
                        <button
                            onClick={onMoveDown}
                            disabled={!canMoveDown}
                            className={`p-1 rounded transition-colors ${canMoveDown
                                ? 'text-gray-600 hover:text-gray-900 hover:bg-gray-200'
                                : 'text-gray-400 cursor-not-allowed'
                                }`}
                            title="Move down"
                        >
                            <ChevronDown className="h-3 w-3" />
                        </button>
                    </div>
                )}

                {/* Quick actions */}
                <div className="flex items-center space-x-1">
                    {onPreview && (
                        <button
                            onClick={onPreview}
                            className="p-1 text-gray-600 hover:text-gray-900 hover:bg-gray-200 rounded transition-colors"
                            title="Preview widget"
                        >
                            <Eye className="h-3 w-3" />
                        </button>
                    )}

                    {onEdit && (
                        <button
                            onClick={onEdit}
                            className="p-1 text-gray-600 hover:text-gray-900 hover:bg-gray-200 rounded transition-colors"
                            title={isPublished ? "Edit (will create new version)" : "Edit widget"}
                        >
                            <Settings className="h-3 w-3" />
                        </button>
                    )}
                </div>

                {/* More actions menu */}
                <div className="relative" ref={menuRef}>
                    <button
                        onClick={handleMenuToggle}
                        className="p-1 text-gray-600 hover:text-gray-900 hover:bg-gray-200 rounded transition-colors"
                        title="More actions"
                    >
                        <MoreHorizontal className="h-3 w-3" />
                    </button>

                    {showMenu && (
                        <div className="absolute right-0 top-full mt-1 w-48 bg-white border border-gray-200 rounded-lg shadow-lg z-50">
                            <div className="py-1">
                                {/* Preview in modal */}
                                {onModalPreview && (
                                    <button
                                        onClick={() => {
                                            onModalPreview()
                                            setShowMenu(false)
                                        }}
                                        className="w-full flex items-center px-3 py-2 text-sm text-gray-700 hover:bg-gray-100 transition-colors"
                                    >
                                        <Eye className="h-4 w-4 mr-3" />
                                        Preview in Modal
                                    </button>
                                )}

                                {/* Publishing actions */}
                                {onPublishingAction && (
                                    <>
                                        <div className="border-t border-gray-200 my-1"></div>
                                        <div className="px-3 py-2">
                                            <div className="text-xs font-medium text-gray-500 uppercase tracking-wider">
                                                Publishing
                                            </div>
                                        </div>

                                        {!isPublished && (
                                            <button
                                                onClick={() => handlePublishingAction('publish')}
                                                className="w-full flex items-center px-3 py-2 text-sm text-green-700 hover:bg-green-50 transition-colors"
                                            >
                                                <Globe className="h-4 w-4 mr-3" />
                                                Publish Now
                                            </button>
                                        )}

                                        <button
                                            onClick={() => handlePublishingAction('schedule')}
                                            className="w-full flex items-center px-3 py-2 text-sm text-blue-700 hover:bg-blue-50 transition-colors"
                                        >
                                            <Calendar className="h-4 w-4 mr-3" />
                                            Schedule Publication
                                        </button>

                                        {isPublished && (
                                            <button
                                                onClick={() => handlePublishingAction('unpublish')}
                                                className="w-full flex items-center px-3 py-2 text-sm text-orange-700 hover:bg-orange-50 transition-colors"
                                            >
                                                <Lock className="h-4 w-4 mr-3" />
                                                Unpublish
                                            </button>
                                        )}
                                    </>
                                )}

                                {/* Destructive actions */}
                                {onDelete && (
                                    <>
                                        <div className="border-t border-gray-200 my-1"></div>
                                        <button
                                            onClick={() => {
                                                onDelete()
                                                setShowMenu(false)
                                            }}
                                            className="w-full flex items-center px-3 py-2 text-sm text-red-700 hover:bg-red-50 transition-colors"
                                        >
                                            <Trash2 className="h-4 w-4 mr-3" />
                                            {isPublished ? 'Delete (affects live page)' : 'Delete Widget'}
                                        </button>
                                    </>
                                )}
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    )
}

export default PageWidgetHeader
