import React, { useCallback, useEffect, useRef, useState } from 'react'
import { ExternalLink, Eye, FileText, Loader2 } from 'lucide-react'
import { api } from '../../api/client'
import { endpoints } from '../../api/endpoints'
import { versionsApi } from '../../api/versions'
import {
    appendAnchor,
    canShowEditorNavMenu,
    getAnchor,
    getPageId,
    isExternalNavItem,
    isInternalNavItem,
    normalizeNavItem,
} from './editorNavLinkUtils'

const getData = (response) => response?.data || response || null

const fetchPageLookup = async (pageId) => {
    const response = await api.get(`${endpoints.pages.lookup}?id=${pageId}`)
    return getData(response)
}

const fetchLatestVersion = async (pageId) => {
    try {
        return await versionsApi.getLatestVersionForPage(pageId)
    } catch {
        return null
    }
}

export const EditorNavLinkMenu = ({
    item,
    open,
    onClose,
    onAction,
    position = null,
    anchorRef = null,
}) => {
    const menuRef = useRef(null)
    const [pageInfo, setPageInfo] = useState(null)
    const [latestVersion, setLatestVersion] = useState(null)
    const [isLoading, setIsLoading] = useState(false)
    const [loadError, setLoadError] = useState(null)

    const pageId = getPageId(item)
    const anchor = getAnchor(item)
    const isInternal = isInternalNavItem(item)
    const isExternal = isExternalNavItem(item)

    useEffect(() => {
        if (!open || !isInternal || !pageId) return

        let cancelled = false
        setIsLoading(true)
        setLoadError(null)

        Promise.all([
            fetchPageLookup(pageId),
            fetchLatestVersion(pageId),
        ])
            .then(([lookup, latest]) => {
                if (cancelled) return
                setPageInfo(lookup)
                setLatestVersion(latest)
            })
            .catch((error) => {
                if (cancelled) return
                setLoadError(error)
                setPageInfo(null)
                setLatestVersion(null)
            })
            .finally(() => {
                if (!cancelled) {
                    setIsLoading(false)
                }
            })

        return () => {
            cancelled = true
        }
    }, [open, isInternal, pageId])

    useEffect(() => {
        if (!open) return

        const handlePointerDown = (event) => {
            if (menuRef.current?.contains(event.target)) return
            if (anchorRef?.current?.contains(event.target)) return
            onClose?.()
        }

        const handleKeyDown = (event) => {
            if (event.key === 'Escape') {
                onClose?.()
            }
        }

        document.addEventListener('mousedown', handlePointerDown)
        document.addEventListener('keydown', handleKeyDown)

        return () => {
            document.removeEventListener('mousedown', handlePointerDown)
            document.removeEventListener('keydown', handleKeyDown)
        }
    }, [open, onClose, anchorRef])

    if (!open || !canShowEditorNavMenu(item)) return null

    const publicPath = appendAnchor(pageInfo?.path || item.url, anchor)
    const isPublished = pageInfo?.isPublished ?? item.isPublished ?? false
    const versionId = latestVersion?.versionId || latestVersion?.id || item.currentVersionId
    const previewUrl = pageId && versionId ? endpoints.previewSizes.preview(pageId, versionId) : ''
    const editorUrl = pageId ? `/pages/${pageId}/edit` : ''
    const externalUrl = item.url || ''

    const menuStyle = position
        ? {
            position: 'fixed',
            top: `${position.top}px`,
            left: `${position.left}px`,
        }
        : {
            position: 'absolute',
            top: '100%',
            left: 0,
        }

    const runAction = (callback) => {
        callback()
        onAction?.()
        onClose?.()
    }

    const openInNewTab = (url) => {
        window.open(url, '_blank', 'noopener,noreferrer')
    }

    const menuButtonClass = 'flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-gray-700 hover:bg-gray-100 disabled:cursor-not-allowed disabled:text-gray-400 disabled:hover:bg-transparent'

    return (
        <div
            ref={menuRef}
            className="min-w-56 rounded-md border border-gray-200 bg-white py-1 shadow-lg ring-1 ring-black/5"
            style={{ ...menuStyle, zIndex: 10050 }}
            role="menu"
        >
            {isInternal && (
                <>
                    {isLoading && (
                        <div className="flex items-center gap-2 px-3 py-2 text-sm text-gray-500">
                            <Loader2 className="h-4 w-4 animate-spin" />
                            Loading page actions...
                        </div>
                    )}
                    <button
                        type="button"
                        className={menuButtonClass}
                        disabled={isLoading || !isPublished || !publicPath}
                        onClick={() => runAction(() => openInNewTab(publicPath))}
                        title={!isPublished ? 'This page does not have a published version' : undefined}
                        role="menuitem"
                    >
                        <ExternalLink className="h-4 w-4" />
                        Open public page in new tab
                    </button>
                    <button
                        type="button"
                        className={menuButtonClass}
                        disabled={isLoading || !previewUrl}
                        onClick={() => runAction(() => openInNewTab(previewUrl))}
                        title={!previewUrl ? 'No page version is available to preview' : undefined}
                        role="menuitem"
                    >
                        <Eye className="h-4 w-4" />
                        Open preview in new tab
                    </button>
                    <button
                        type="button"
                        className={menuButtonClass}
                        disabled={!editorUrl}
                        onClick={() => runAction(() => window.location.assign(editorUrl))}
                        role="menuitem"
                    >
                        <FileText className="h-4 w-4" />
                        Open editor here
                    </button>
                    <button
                        type="button"
                        className={menuButtonClass}
                        disabled={!editorUrl}
                        onClick={() => runAction(() => openInNewTab(editorUrl))}
                        role="menuitem"
                    >
                        <ExternalLink className="h-4 w-4" />
                        Open editor in new tab
                    </button>
                    {loadError && (
                        <div className="px-3 py-2 text-xs text-red-600">
                            Page details could not be loaded.
                        </div>
                    )}
                </>
            )}

            {isExternal && (
                <button
                    type="button"
                    className={menuButtonClass}
                    disabled={!externalUrl}
                    onClick={() => runAction(() => openInNewTab(externalUrl))}
                    role="menuitem"
                >
                    <ExternalLink className="h-4 w-4" />
                    Open in new tab
                </button>
            )}
        </div>
    )
}

const EditorNavLink = ({
    item,
    mode = 'preview',
    enableEditorMenu = false,
    className = '',
    style,
    children,
    onEditorAction,
    onClick,
    ...linkProps
}) => {
    const [isMenuOpen, setIsMenuOpen] = useState(false)
    const [menuPosition, setMenuPosition] = useState(null)
    const anchorRef = useRef(null)
    const normalizedItem = normalizeNavItem(item)
    const isEditor = enableEditorMenu || mode === 'editor'
    const hasMenu = canShowEditorNavMenu(normalizedItem)
    const href = isEditor ? '#' : normalizedItem.url
    const targetBlank = normalizedItem.targetBlank || normalizedItem.target_blank

    const handleClick = useCallback((event) => {
        if (!isEditor) {
            onClick?.(event)
            return
        }

        event.preventDefault()
        event.stopPropagation()

        if (hasMenu) {
            const rect = anchorRef.current?.getBoundingClientRect()
            setMenuPosition(rect ? { top: rect.bottom + 4, left: rect.left } : null)
            setIsMenuOpen((value) => !value)
        }

        onClick?.(event)
    }, [hasMenu, isEditor, onClick])

    return (
        <span className="relative inline-block">
            <a
                {...linkProps}
                ref={anchorRef}
                href={href}
                data-href={normalizedItem.url}
                target={!isEditor && targetBlank ? '_blank' : undefined}
                rel={!isEditor && targetBlank ? 'noopener noreferrer' : undefined}
                className={className}
                style={style}
                onClick={handleClick}
            >
                {children ?? normalizedItem.label}
            </a>
            <EditorNavLinkMenu
                item={normalizedItem}
                open={isMenuOpen}
                onClose={() => setIsMenuOpen(false)}
                onAction={onEditorAction}
                position={menuPosition}
                anchorRef={anchorRef}
            />
        </span>
    )
}

export default EditorNavLink
