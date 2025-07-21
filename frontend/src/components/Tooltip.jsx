import { useState } from 'react'

const Tooltip = ({ children, text, position = 'top', delay = 300 }) => {
    const [isVisible, setIsVisible] = useState(false)
    const [timeoutId, setTimeoutId] = useState(null)

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

    const getPositionClasses = () => {
        switch (position) {
            case 'top':
                return 'bottom-full left-1/2 transform -translate-x-1/2 mb-4'
            case 'bottom':
                return 'top-full left-1/2 transform -translate-x-1/2 mt-4'
            case 'left':
                return 'right-full top-1/2 transform -translate-y-1/2 mr-4'
            case 'right':
                return 'left-full top-1/2 transform -translate-y-1/2 ml-4'
            default:
                return 'bottom-full left-1/2 transform -translate-x-1/2 mb-4'
        }
    }

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
        <div
            className="relative inline-block"
            onMouseEnter={showTooltip}
            onMouseLeave={hideTooltip}
            onFocus={showTooltip}
            onBlur={hideTooltip}
        >
            {children}
            {isVisible && text && (
                <div className="absolute z-50 pointer-events-none">
                    <div className={`absolute ${getPositionClasses()}`}>
                        <div className="bg-gray-800 text-white text-xs rounded py-1 px-2 max-w-xs whitespace-nowrap shadow-lg">
                            {text}
                        </div>
                        <div className={`absolute w-0 h-0 ${getArrowClasses()}`}></div>
                    </div>
                </div>
            )}
        </div>
    )
}

export default Tooltip 