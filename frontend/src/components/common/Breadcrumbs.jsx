import React from 'react'
import { Link } from 'react-router-dom'
import { ChevronRight, Home } from 'lucide-react'

/**
 * Breadcrumbs component for hierarchical navigation
 * 
 * @param {Array} items - List of items { label, path, icon }
 * @param {string} className - Optional container class
 */
const Breadcrumbs = ({ items = [], className = '' }) => {
    if (!items || items.length === 0) return null

    return (
        <nav className={`flex items-center space-x-1 text-sm text-gray-500 overflow-x-auto whitespace-nowrap py-1 ${className}`} aria-label="Breadcrumb">
            {items.map((item, index) => {
                const isLast = index === items.length - 1
                const Icon = item.icon

                return (
                    <React.Fragment key={index}>
                        <div className="flex items-center">
                            {index > 0 && (
                                <ChevronRight className="w-4 h-4 mx-1 text-gray-400 flex-shrink-0" />
                            )}
                            
                            {isLast ? (
                                <span className="font-medium text-gray-900 truncate max-w-[200px]" aria-current="page">
                                    {item.label}
                                </span>
                            ) : (
                                <Link
                                    to={item.path}
                                    className="flex items-center hover:text-blue-600 transition-colors truncate max-w-[150px]"
                                >
                                    {Icon && <Icon className="w-3.5 h-3.5 mr-1 flex-shrink-0" />}
                                    {item.label}
                                </Link>
                            )}
                        </div>
                    </React.Fragment>
                )
            })}
        </nav>
    )
}

export default Breadcrumbs

