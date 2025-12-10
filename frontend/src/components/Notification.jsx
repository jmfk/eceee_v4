import { useState, useEffect } from 'react'
import { X, AlertCircle, AlertTriangle, Info, CheckCircle } from 'lucide-react'

const Notification = ({ message, onClose, type = 'error', duration = 5000 }) => {
    const [isVisible, setIsVisible] = useState(false)

    useEffect(() => {
        if (message) {
            setIsVisible(true)

            // Auto-close after duration
            const timer = setTimeout(() => {
                handleClose()
            }, duration)

            return () => clearTimeout(timer)
        }
    }, [message, duration])

    const handleClose = () => {
        setIsVisible(false)
        setTimeout(() => {
            onClose()
        }, 300) // Wait for fade out animation
    }

    if (!message || !isVisible) return null

    const getIcon = () => {
        switch (type) {
            case 'success':
                return <CheckCircle className="w-5 h-5 text-green-500" />
            case 'warning':
                return <AlertTriangle className="w-5 h-5 text-amber-500" />
            case 'info':
                return <Info className="w-5 h-5 text-blue-500" />
            default:
                return <AlertCircle className="w-5 h-5 text-red-500" />
        }
    }

    const getBackgroundColor = () => {
        switch (type) {
            case 'success':
                return 'bg-green-50 border-green-200'
            case 'warning':
                return 'bg-amber-50 border-amber-200'
            case 'info':
                return 'bg-blue-50 border-blue-200'
            default:
                return 'bg-red-50 border-red-200'
        }
    }

    const getTextColor = () => {
        switch (type) {
            case 'success':
                return 'text-green-800'
            case 'warning':
                return 'text-amber-800'
            case 'info':
                return 'text-blue-800'
            default:
                return 'text-red-800'
        }
    }

    return (
        <div className="fixed top-4 right-4 z-50 max-w-sm w-full">
            {/* Notification */}
            <div className={`
                bg-white rounded-lg shadow-lg border-2 ${getBackgroundColor()} p-4
                transform transition-all duration-300 ease-in-out
                ${isVisible ? 'translate-x-0 opacity-100' : 'translate-x-full opacity-0'}
            `}>
                {/* Header */}
                <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center space-x-2">
                        {getIcon()}
                        <div className={`font-semibold text-sm ${getTextColor()}`} role="heading" aria-level="3">
                            {type === 'success' ? 'Success' : type === 'warning' ? 'Warning' : type === 'info' ? 'Information' : 'Error'}
                        </div>
                    </div>
                    <button
                        onClick={handleClose}
                        className="p-1 rounded-full hover:bg-gray-200 transition-colors"
                        aria-label="Close notification"
                    >
                        <X className="w-4 h-4 text-gray-500" />
                    </button>
                </div>

                {/* Content */}
                <div>
                    <div className={`text-sm ${getTextColor()}`}>
                        {typeof message === 'string'
                            ? message
                            : message.message || message.response?.data?.detail || 'An error occurred'
                        }
                    </div>

                    {/* Show additional error details if available */}
                    {message.response?.data?.detail && (
                        <div className="mt-2 p-2 bg-gray-100 rounded text-xs text-gray-700">
                            <span className="font-bold">Details:</span> {message.response.data.detail}
                        </div>
                    )}

                    {message.stack && process.env.NODE_ENV === 'development' && (
                        <details className="mt-2">
                            <summary className="text-xs text-gray-600 cursor-pointer hover:text-gray-800">
                                Show technical details
                            </summary>
                            <pre className="mt-1 p-2 bg-gray-100 rounded text-xs text-gray-700 overflow-auto max-h-24">
                                {message.stack}
                            </pre>
                        </details>
                    )}
                </div>
            </div>
        </div>
    )
}

export default Notification 