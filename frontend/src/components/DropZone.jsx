import { useState, useEffect } from 'react'

const DropZone = ({
    position, // 'before' | 'after' | 'inside'
    isVisible,
    isHovered = false,
    onDrop,
    onMouseEnter,
    onMouseLeave,
    level = 0,
    label = '',
    targetPageTitle = '',
    isDragging = false // New prop to know if a drag operation is in progress
}) => {
    const [isAnimating, setIsAnimating] = useState(false)

    useEffect(() => {
        if (isVisible || isDragging) {
            // Small delay to trigger animation
            const timer = setTimeout(() => setIsAnimating(true), 10)
            return () => clearTimeout(timer)
        } else {
            setIsAnimating(false)
        }
    }, [isVisible, isDragging])

    const handleDragOver = (e) => {
        e.preventDefault()
        e.stopPropagation()
        e.dataTransfer.dropEffect = 'move'
    }

    const handleDrop = (e) => {
        e.preventDefault()
        e.stopPropagation()
        onDrop?.(e, position)
    }



    const getPositionStyles = () => {
        const baseClasses = isHovered
            ? 'border-blue-500 bg-blue-100/80'
            : isDragging
                ? 'border-gray-400 bg-gray-50/40'
                : 'border-gray-300 bg-gray-100/30'

        switch (position) {
            case 'before':
                return `border-t-4 ${baseClasses}`
            case 'after':
                return `border-b-4 ${baseClasses}`
            case 'inside':
                return `border-2 border-dashed ${baseClasses} rounded-md`
            default:
                return `border-t-4 ${baseClasses}`
        }
    }

    const getDropText = () => {
        switch (position) {
            case 'before':
                return `Drop before "${targetPageTitle}"`
            case 'after':
                return `Drop after "${targetPageTitle}"`
            case 'inside':
                return label || `Drop inside "${targetPageTitle}"`
            default:
                return `Drop before "${targetPageTitle}"`
        }
    }

    const getAnimationClasses = () => {
        // Show subtle zones during drag even when not hovered
        if (isDragging && !isVisible) {
            return 'opacity-30 scale-y-50 transition-all duration-200 ease-out'
        }
        if (!isVisible && !isAnimating) return 'opacity-0 scale-y-0'
        return isAnimating
            ? 'opacity-100 scale-y-100 transition-all duration-200 ease-out'
            : 'opacity-0 scale-y-0'
    }

    // Always render during drag operations, but with different visibility
    if (!isVisible && !isAnimating && !isDragging) return null

    return (
        <div
            className={`
                ${getPositionStyles()}
                ${getAnimationClasses()}
                transform origin-center
                relative
                ${isDragging ? 'h-6' : 'h-10'} mx-2 my-1
                pointer-events-auto
                z-10
                cursor-copy
                transition-all duration-200
            `}
            style={{
                paddingLeft: position === 'inside' ? `${level * 24 + 16}px` : `${level * 24 + 8}px`,
                transformOrigin: 'center'
            }}
            onDragOver={handleDragOver}
            onDrop={handleDrop}
            onMouseEnter={onMouseEnter}
            onMouseLeave={onMouseLeave}
        >
            {/* Drop indicator with text label */}
            <div className={`
                absolute inset-0 
                ${position === 'inside' ? 'rounded-md' : ''}
                ${isAnimating ? 'animate-pulse' : ''}
                flex items-center justify-center
            `}>
                {(isVisible || isHovered) && (
                    <span className={`
                        text-xs font-medium
                        ${isHovered ? 'text-blue-700' : 'text-gray-600'}
                        transition-colors duration-200
                        px-2 py-1 rounded-md
                        ${isHovered ? 'bg-blue-50' : 'bg-white/80'}
                    `}>
                        {getDropText()}
                    </span>
                )}
            </div>
        </div>
    )
}

export default DropZone 