import { useState, useRef, useEffect } from 'react'

const Tooltip = ({ children, text, position = 'top', delay = 300 }) => {
    const [isVisible, setIsVisible] = useState(false)
    const [timeoutId, setTimeoutId] = useState(null)
    const [tooltipPosition, setTooltipPosition] = useState({ top: 0, left: 0 })
    const triggerRef = useRef(null)
    const tooltipRef = useRef(null)

    const showTooltip = () => {
        const id = setTimeout(() => {
            setIsVisible(true)
        }, delay)
        setTimeoutId(id)
    }

    const hideTooltip = () => {
        if (timeoutId) {
            clearTimeout(timeoutId)
            setTimeoutId(null)
        }
        setIsVisible(false)
    }

    // Calculate tooltip position when visible
    useEffect(() => {
        if (isVisible && triggerRef.current && tooltipRef.current) {
            const triggerRect = triggerRef.current.getBoundingClientRect()
            const tooltipRect = tooltipRef.current.getBoundingClientRect()

            let top, left

            switch (position) {
                case 'top':
                    top = triggerRect.top - tooltipRect.height - 16
                    left = triggerRect.left + (triggerRect.width / 2) - (tooltipRect.width / 2)
                    break
                case 'bottom':
                    top = triggerRect.bottom + 16
                    left = triggerRect.left + (triggerRect.width / 2) - (tooltipRect.width / 2)
                    break
                case 'left':
                    top = triggerRect.top + (triggerRect.height / 2) - (tooltipRect.height / 2)
                    left = triggerRect.left - tooltipRect.width - 16
                    break
                case 'right':
                    top = triggerRect.top + (triggerRect.height / 2) - (tooltipRect.height / 2)
                    left = triggerRect.right + 16
                    break
                default:
                    top = triggerRect.top - tooltipRect.height - 16
                    left = triggerRect.left + (triggerRect.width / 2) - (tooltipRect.width / 2)
            }

            // Ensure tooltip stays within viewport
            const viewportWidth = window.innerWidth
            const viewportHeight = window.innerHeight

            if (left < 8) left = 8
            if (left + tooltipRect.width > viewportWidth - 8) left = viewportWidth - tooltipRect.width - 8
            if (top < 8) top = 8
            if (top + tooltipRect.height > viewportHeight - 8) top = viewportHeight - tooltipRect.height - 8

            setTooltipPosition({ top, left })
        }
    }, [isVisible, position])

    const getArrowClasses = () => {
        switch (position) {
            case 'top':
                return 'top-full left-1/2 transform -translate-x-1/2 border-l-4 border-r-4 border-t-4 border-transparent border-t-gray-800'
            case 'bottom':
                return 'bottom-full left-1/2 transform -translate-x-1/2 border-l-4 border-r-4 border-b-4 border-transparent border-b-gray-800'
            case 'left':
                return 'left-full top-1/2 transform -translate-y-1/2 border-t-4 border-b-4 border-l-4 border-transparent border-l-gray-800'
            case 'right':
                return 'right-full top-1/2 transform -translate-y-1/2 border-t-4 border-b-4 border-r-4 border-transparent border-r-gray-800'
            default:
                return 'top-full left-1/2 transform -translate-x-1/2 border-l-4 border-r-4 border-t-4 border-transparent border-t-gray-800'
        }
    }

    return (
        <>
            <div
                ref={triggerRef}
                className="relative inline-block"
                onMouseEnter={showTooltip}
                onMouseLeave={hideTooltip}
                onFocus={showTooltip}
                onBlur={hideTooltip}
            >
                {children}
            </div>
            {isVisible && text && (
                <div
                    ref={tooltipRef}
                    className="fixed z-[9999] pointer-events-none"
                    style={{
                        top: tooltipPosition.top,
                        left: tooltipPosition.left,
                    }}
                >
                    <div className="bg-gray-800 text-white text-xs rounded py-1 px-2 max-w-xs whitespace-nowrap shadow-lg">
                        {text}
                    </div>
                    <div className={`absolute w-0 h-0 ${getArrowClasses()}`}></div>
                </div>
            )}
        </>
    )
}

export default Tooltip 