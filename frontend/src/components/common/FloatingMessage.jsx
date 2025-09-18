import React, { useState, useEffect } from 'react'
import { X, AlertCircle, Info, CheckCircle } from 'lucide-react'

const FloatingMessage = ({ message, type = 'info', onClose, autoClose = true }) => {
    const [isVisible, setIsVisible] = useState(true)
    const [isExiting, setIsExiting] = useState(false)

    useEffect(() => {
        if (autoClose) {
            const timer = setTimeout(() => {
                setIsExiting(true)
                setTimeout(() => {
                    setIsVisible(false)
                    if (onClose) onClose()
                }, 300) // Match transition duration
            }, 3000)
            return () => clearTimeout(timer)
        }
    }, [autoClose, onClose])

    if (!isVisible) return null

    const getIcon = () => {
        switch (type) {
            case 'success':
                return <CheckCircle className="w-5 h-5 text-green-500" />
            case 'error':
                return <AlertCircle className="w-5 h-5 text-red-500" />
            case 'info':
            default:
                return <Info className="w-5 h-5 text-blue-500" />
        }
    }

    return (
        <div
            className={`
                fixed bottom-4 right-4 z-50
                max-w-md bg-white rounded-lg shadow-lg
                transform transition-all duration-300 ease-in-out
                ${isExiting ? 'opacity-0 translate-y-2' : 'opacity-100 translate-y-0'}
            `}
        >
            <div className="flex items-start p-4 gap-3">
                <div className="flex-shrink-0">
                    {getIcon()}
                </div>
                <div className="flex-1 text-sm text-gray-700">
                    {message}
                </div>
                <button
                    onClick={() => {
                        setIsExiting(true)
                        setTimeout(() => {
                            setIsVisible(false)
                            if (onClose) onClose()
                        }, 300)
                    }}
                    className="flex-shrink-0 ml-2 text-gray-400 hover:text-gray-600"
                >
                    <X className="w-4 h-4" />
                </button>
            </div>
        </div>
    )
}

export default FloatingMessage
