import React, { useEffect, useRef, useState } from 'react'
import { MoreHorizontal, Plus, Trash2, Download } from 'lucide-react'

// SlotIconMenu component that replicates the PageEditor three-dot menu
const SlotIconMenu = ({ slotName, slot, availableWidgetTypes, isFilteringTypes, onAddWidget, onClearSlot, onShowWidgetModal, onImportContent, context }) => {
    const menuRef = useRef<HTMLDivElement | null>(null)
    const [isOpen, setIsOpen] = useState(false)

    // Close menu when clicking outside
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            const target = event.target as Node | null
            if (menuRef.current && target && !menuRef.current.contains(target)) {
                setIsOpen(false)
            }
        }

        if (isOpen) {
            document.addEventListener('mousedown', handleClickOutside)
            return () => document.removeEventListener('mousedown', handleClickOutside)
        }
    }, [isOpen])

    const handleMenuToggle = () => {
        setIsOpen(!isOpen)
    }

    const handleAddWidgetClick = () => {
        onShowWidgetModal(slot)
        setIsOpen(false)
    }

    const handleClearSlotClick = () => {
        onClearSlot(slotName)
        setIsOpen(false)
    }

    const handleImportContentClick = () => {
        if (onImportContent) {
            onImportContent(slotName)
        }
        setIsOpen(false)
    }

    return (
        <div className="absolute top-2 right-2 z-20 opacity-80 hover:opacity-100 transition-opacity" ref={menuRef}>
            {/* Menu Button (3 dots icon) */}
            <button
                onClick={handleMenuToggle}
                className="bg-gray-300 hover:bg-gray-500 text-black hover:text-white p-1 rounded-lg transition-colors"
                title={`Slot: ${slotName}`}
            >
                <MoreHorizontal className="h-4 w-4" />
            </button>

            {/* Menu Dropdown */}
            {isOpen && (
                <div className="absolute top-full right-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg min-w-48">
                    {/* Add Widget */}
                    {!isFilteringTypes && (
                        <>
                            <button
                                onClick={handleAddWidgetClick}
                                className="flex items-center w-full px-3 py-2 text-sm text-left hover:bg-gray-100 transition-colors text-green-700 hover:bg-green-50"
                            >
                                <Plus className="h-4 w-4 mr-3 text-gray-600" />
                                <span className="text-gray-900">Add Widget</span>
                            </button>
                            <div className="border-t border-gray-200 my-1"></div>
                        </>
                    )}

                    {/* Import Content */}
                    {onImportContent && (
                        <>
                            <button
                                onClick={handleImportContentClick}
                                className="flex items-center w-full px-3 py-2 text-sm text-left hover:bg-gray-100 transition-colors text-blue-700 hover:bg-blue-50"
                            >
                                <Download className="h-4 w-4 mr-3 text-gray-600" />
                                <span className="text-gray-900">Import Content</span>
                            </button>
                            <div className="border-t border-gray-200 my-1"></div>
                        </>
                    )}

                    {/* Clear Slot */}
                    <button
                        onClick={handleClearSlotClick}
                        className="flex items-center w-full px-3 py-2 text-sm text-left hover:bg-gray-100 transition-colors text-red-700 hover:bg-red-50"
                    >
                        <Trash2 className="h-4 w-4 mr-3 text-gray-600" />
                        <span className="text-gray-900">Clear Slot</span>
                    </button>
                </div>
            )}
        </div>
    )
}

export default SlotIconMenu