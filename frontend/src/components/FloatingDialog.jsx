/**
 * FloatingDialog - Reusable free-floating, draggable, resizable dialog component
 * 
 * Uses React Portal to render at document.body level, bypassing parent overflow constraints.
 * Supports dragging via header and resizing via corner handle.
 */

import { useState, useEffect, useRef, useCallback } from 'react'
import { createPortal } from 'react-dom'
import { X } from 'lucide-react'

const FloatingDialog = ({
    isOpen,
    onClose,
    title,
    children,
    defaultSize = { width: 600, height: 500 },
    minSize = { width: 300, height: 200 },
    maxSize = null,
    resizable = true,
    draggable = true,
    showBackdrop = true,
    showCloseButton = true,
    zIndex = 10010,
    headerContent = null,
    footerContent = null,
    className = '',
    contentClassName = ''
}) => {
    // Size state
    const [size, setSize] = useState(defaultSize)
    
    // Position state (centered initially)
    const [position, setPosition] = useState({ x: null, y: null })
    
    // Interaction states
    const [isDragging, setIsDragging] = useState(false)
    const [isResizing, setIsResizing] = useState(false)
    
    // Refs
    const dialogRef = useRef(null)
    const dragStartRef = useRef({ x: 0, y: 0, posX: 0, posY: 0 })
    const resizeStartRef = useRef({ x: 0, y: 0, width: 0, height: 0 })
    
    // Calculate effective max size
    const getMaxSize = useCallback(() => {
        return maxSize || {
            width: window.innerWidth - 40,
            height: window.innerHeight - 40
        }
    }, [maxSize])
    
    // Center dialog when opened
    useEffect(() => {
        if (isOpen && position.x === null) {
            const effectiveMaxSize = getMaxSize()
            const effectiveWidth = Math.min(size.width, effectiveMaxSize.width)
            const effectiveHeight = Math.min(size.height, effectiveMaxSize.height)
            
            setPosition({
                x: (window.innerWidth - effectiveWidth) / 2,
                y: (window.innerHeight - effectiveHeight) / 2
            })
        }
    }, [isOpen, position.x, size, getMaxSize])
    
    // Reset position when dialog reopens
    useEffect(() => {
        if (isOpen) {
            setSize(defaultSize)
            setPosition({ x: null, y: null })
        }
    }, [isOpen]) // intentionally not including defaultSize to avoid resetting on every render
    
    // Handle escape key
    useEffect(() => {
        const handleEscape = (e) => {
            if (e.key === 'Escape' && isOpen) {
                onClose()
            }
        }
        
        document.addEventListener('keydown', handleEscape)
        return () => document.removeEventListener('keydown', handleEscape)
    }, [isOpen, onClose])
    
    // Drag handlers
    const handleDragStart = useCallback((e) => {
        if (!draggable) return
        if (e.target.closest('button') || e.target.closest('input') || e.target.closest('select')) return
        
        e.preventDefault()
        setIsDragging(true)
        
        const rect = dialogRef.current?.getBoundingClientRect()
        dragStartRef.current = {
            x: e.clientX,
            y: e.clientY,
            posX: rect?.left || 0,
            posY: rect?.top || 0
        }
        
        document.body.style.cursor = 'move'
        document.body.style.userSelect = 'none'
    }, [draggable])
    
    const handleDragMove = useCallback((e) => {
        if (!isDragging) return
        
        const deltaX = e.clientX - dragStartRef.current.x
        const deltaY = e.clientY - dragStartRef.current.y
        
        let newX = dragStartRef.current.posX + deltaX
        let newY = dragStartRef.current.posY + deltaY
        
        // Keep dialog within viewport bounds
        const maxX = window.innerWidth - size.width
        const maxY = window.innerHeight - size.height
        
        newX = Math.max(0, Math.min(newX, maxX))
        newY = Math.max(0, Math.min(newY, maxY))
        
        setPosition({ x: newX, y: newY })
    }, [isDragging, size])
    
    const handleDragEnd = useCallback(() => {
        setIsDragging(false)
        document.body.style.cursor = ''
        document.body.style.userSelect = ''
    }, [])
    
    // Resize handlers
    const handleResizeStart = useCallback((e) => {
        if (!resizable) return
        
        e.preventDefault()
        e.stopPropagation()
        setIsResizing(true)
        
        resizeStartRef.current = {
            x: e.clientX,
            y: e.clientY,
            width: size.width,
            height: size.height
        }
        
        document.body.style.cursor = 'se-resize'
        document.body.style.userSelect = 'none'
    }, [resizable, size])
    
    const handleResizeMove = useCallback((e) => {
        if (!isResizing) return
        
        const deltaX = e.clientX - resizeStartRef.current.x
        const deltaY = e.clientY - resizeStartRef.current.y
        
        const effectiveMaxSize = getMaxSize()
        
        let newWidth = Math.max(minSize.width, Math.min(effectiveMaxSize.width, resizeStartRef.current.width + deltaX))
        let newHeight = Math.max(minSize.height, Math.min(effectiveMaxSize.height, resizeStartRef.current.height + deltaY))
        
        setSize({ width: newWidth, height: newHeight })
    }, [isResizing, minSize, getMaxSize])
    
    const handleResizeEnd = useCallback(() => {
        setIsResizing(false)
        document.body.style.cursor = ''
        document.body.style.userSelect = ''
    }, [])
    
    // Global mouse event listeners
    useEffect(() => {
        if (isDragging) {
            document.addEventListener('mousemove', handleDragMove)
            document.addEventListener('mouseup', handleDragEnd)
            return () => {
                document.removeEventListener('mousemove', handleDragMove)
                document.removeEventListener('mouseup', handleDragEnd)
            }
        }
    }, [isDragging, handleDragMove, handleDragEnd])
    
    useEffect(() => {
        if (isResizing) {
            document.addEventListener('mousemove', handleResizeMove)
            document.addEventListener('mouseup', handleResizeEnd)
            return () => {
                document.removeEventListener('mousemove', handleResizeMove)
                document.removeEventListener('mouseup', handleResizeEnd)
            }
        }
    }, [isResizing, handleResizeMove, handleResizeEnd])
    
    if (!isOpen) return null
    
    const dialogContent = (
        <div 
            className="fixed inset-0" 
            style={{ zIndex }}
        >
            {/* Backdrop */}
            {showBackdrop && (
                <div 
                    className="absolute inset-0 bg-black/50"
                    onClick={onClose}
                />
            )}
            
            {/* Dialog */}
            <div
                ref={dialogRef}
                className={`absolute bg-white rounded-lg shadow-xl overflow-hidden flex flex-col ${className}`}
                style={{
                    width: size.width,
                    height: size.height,
                    left: position.x ?? '50%',
                    top: position.y ?? '50%',
                    transform: position.x === null ? 'translate(-50%, -50%)' : 'none',
                    maxWidth: 'calc(100vw - 40px)',
                    maxHeight: 'calc(100vh - 40px)'
                }}
            >
                {/* Header */}
                <div 
                    className={`flex items-center justify-between px-4 py-3 border-b border-gray-200 bg-gray-50 flex-shrink-0 ${draggable ? 'cursor-move' : ''}`}
                    onMouseDown={handleDragStart}
                >
                    <div className="flex items-center gap-2 min-w-0 flex-1">
                        {typeof title === 'string' ? (
                            <h2 className="text-lg font-semibold text-gray-900 truncate">
                                {title}
                            </h2>
                        ) : title}
                        {headerContent}
                    </div>
                    {showCloseButton && (
                        <button
                            onClick={onClose}
                            className="p-1 hover:bg-gray-200 rounded transition-colors flex-shrink-0"
                        >
                            <X className="w-5 h-5 text-gray-500" />
                        </button>
                    )}
                </div>
                
                {/* Content */}
                <div className={`flex-1 overflow-y-auto ${contentClassName}`}>
                    {children}
                </div>
                
                {/* Footer */}
                {footerContent && (
                    <div className="flex-shrink-0 border-t border-gray-200 bg-gray-50">
                        {footerContent}
                    </div>
                )}
                
                {/* Resize Handle */}
                {resizable && (
                    <div
                        onMouseDown={handleResizeStart}
                        className="absolute bottom-0 right-0 w-4 h-4 cursor-se-resize group"
                        title="Drag to resize"
                    >
                        <svg 
                            className="w-4 h-4 text-gray-400 group-hover:text-gray-600"
                            viewBox="0 0 16 16" 
                            fill="currentColor"
                        >
                            <path d="M14 14H12V12H14V14ZM14 10H12V8H14V10ZM10 14H8V12H10V14ZM14 6H12V4H14V6ZM10 10H8V8H10V10ZM6 14H4V12H6V14Z" />
                        </svg>
                    </div>
                )}
            </div>
        </div>
    )
    
    // Render via Portal to document.body
    return createPortal(dialogContent, document.body)
}

export default FloatingDialog

