import React from 'react'
import { AlertCircle, AlertTriangle, CheckCircle, Info, Loader } from 'lucide-react'

/**
 * ValidationMessage Component
 * 
 * Displays validation messages with appropriate styling and icons
 */
export default function ValidationMessage({
    message,
    severity = 'none',
    isValidating = false,
    className = '',
    showIcon = true,
    size = 'sm'
}) {
    if (!message && !isValidating) return null

    const getIcon = () => {
        if (isValidating) return <Loader className="animate-spin" />

        switch (severity) {
            case 'error':
                return <AlertCircle />
            case 'warning':
                return <AlertTriangle />
            case 'valid':
                return <CheckCircle />
            case 'info':
                return <Info />
            default:
                return null
        }
    }

    const getSeverityClasses = () => {
        const baseClasses = 'flex items-center gap-2 transition-all duration-200'
        const sizeClasses = {
            xs: 'text-xs',
            sm: 'text-sm',
            md: 'text-base',
            lg: 'text-lg'
        }

        const iconSizeClasses = {
            xs: 'w-3 h-3',
            sm: 'w-4 h-4',
            md: 'w-5 h-5',
            lg: 'w-6 h-6'
        }

        let colorClasses = ''
        switch (severity) {
            case 'error':
                colorClasses = 'text-red-600'
                break
            case 'warning':
                colorClasses = 'text-yellow-600'
                break
            case 'valid':
                colorClasses = 'text-green-600'
                break
            case 'info':
                colorClasses = 'text-blue-600'
                break
            default:
                colorClasses = 'text-gray-500'
        }

        if (isValidating) {
            colorClasses = 'text-blue-500'
        }

        return {
            container: `${baseClasses} ${sizeClasses[size]} ${colorClasses}`,
            icon: iconSizeClasses[size]
        }
    }

    const classes = getSeverityClasses()
    const Icon = getIcon()

    return (
        <div className={`${classes.container} ${className}`}>
            {showIcon && Icon && (
                <span className={classes.icon}>
                    {React.cloneElement(Icon, { className: classes.icon })}
                </span>
            )}
            <span className="flex-1">
                {isValidating ? 'Validating...' : message}
            </span>
        </div>
    )
}
