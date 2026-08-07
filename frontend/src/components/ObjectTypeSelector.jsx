import React, { useState, useMemo, useRef, useEffect, useCallback } from 'react'
import { createPortal } from 'react-dom'
import { Plus, ChevronDown, Layout } from 'lucide-react'
import OptimizedImage from './media/OptimizedImage'

const ObjectTypeSelector = ({
    allowedChildTypes = [],
    onSelect,
    disabled = false,
    placeholder = "Add sub-object",
    parentId = null
}) => {
    const [isOpen, setIsOpen] = useState(false)
    const buttonRef = useRef(null)
    const [coords, setCoords] = useState({ top: 0, left: 0, width: 0 })

    const updateCoords = useCallback(() => {
        if (buttonRef.current) {
            const rect = buttonRef.current.getBoundingClientRect()
            setCoords({
                top: rect.bottom,
                left: rect.left,
                width: rect.width
            })
        }
    }, [])

    const handleToggle = () => {
        if (!isOpen) {
            updateCoords()
        }
        setIsOpen(!isOpen)
    }

    const handleSelect = (childType) => {
        onSelect(childType, parentId)
        setIsOpen(false)
    }

    const buttonLabel = useMemo(() => {
        if (allowedChildTypes.length === 1) {
            return `Add ${allowedChildTypes[0].label}`
        }
        return "Add..."
    }, [allowedChildTypes])

    // Update coordinates on scroll or resize to keep menu attached to button
    useEffect(() => {
        if (isOpen) {
            window.addEventListener('scroll', updateCoords, true)
            window.addEventListener('resize', updateCoords)
            return () => {
                window.removeEventListener('scroll', updateCoords, true)
                window.removeEventListener('resize', updateCoords)
            }
        }
    }, [isOpen, updateCoords])

    if (allowedChildTypes.length === 0) {
        return null
    }

    const dropdownMenu = (
        <>
            {/* Backdrop */}
            <div 
                className="fixed inset-0 z-[10009] bg-transparent" 
                onClick={() => setIsOpen(false)}
            />
            {/* Menu - aligned to the button, opening downwards */}
            <div 
                className="fixed z-[10010] mt-1 w-80 bg-white border border-gray-200 rounded-lg shadow-xl overflow-hidden animate-scale-in origin-top-right"
                style={{ 
                    top: `${coords.top}px`, 
                    left: `${Math.max(10, Math.min(window.innerWidth - 330, coords.left + coords.width - 320))}px` // Aligned to right, but safe-guarded
                }}
            >
                <div className="p-2">
                    <div className="text-[10px] font-bold text-gray-400 uppercase tracking-widest px-3 py-2 border-b border-gray-50 mb-1">
                        Choose type to create
                    </div>
                    <div className="max-h-[300px] overflow-y-auto custom-scrollbar">
                        {allowedChildTypes.map((childType) => (
                            <button
                                key={childType.id}
                                type="button"
                                onClick={() => handleSelect(childType)}
                                className="w-full flex items-center p-3 text-left hover:bg-blue-50 rounded-md transition-colors group"
                            >
                                <div className="flex items-center space-x-3 flex-1 min-w-0">
                                    <div className="w-10 h-10 flex-shrink-0">
                                        {childType.iconImage ? (
                                            <OptimizedImage
                                                src={childType.iconImage}
                                                alt={childType.label}
                                                width={40}
                                                height={40}
                                                className="w-full h-full rounded-lg object-cover shadow-sm border border-gray-100"
                                            />
                                        ) : (
                                            <div className="w-full h-full bg-blue-100 rounded-lg flex items-center justify-center border border-blue-200">
                                                <span className="text-blue-600 font-bold text-lg">
                                                    {childType.label?.charAt(0) || 'O'}
                                                </span>
                                            </div>
                                        )}
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <div className="font-semibold text-gray-900 group-hover:text-blue-700 transition-colors truncate">
                                            {childType.label}
                                        </div>
                                        <div className="text-xs text-gray-500 line-clamp-2">
                                            {childType.description || `Create a new ${childType.label.toLowerCase()}`}
                                        </div>
                                    </div>
                                    <div className="opacity-0 group-hover:opacity-100 transition-opacity">
                                        <Plus className="w-4 h-4 text-blue-600" />
                                    </div>
                                </div>
                            </button>
                        ))}
                    </div>
                </div>
            </div>
        </>
    )

    return (
        <div className="relative">
            <button
                ref={buttonRef}
                type="button"
                onClick={handleToggle}
                disabled={disabled}
                className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors shadow-sm whitespace-nowrap"
            >
                <Plus className="w-4 h-4 mr-2" />
                {buttonLabel}
                {allowedChildTypes.length > 1 && (
                    <ChevronDown className={`w-4 h-4 ml-2 transform transition-transform ${isOpen ? 'rotate-180' : ''}`} />
                )}
            </button>

            {isOpen && createPortal(dropdownMenu, document.body)}
        </div>
    )
}

export default ObjectTypeSelector
