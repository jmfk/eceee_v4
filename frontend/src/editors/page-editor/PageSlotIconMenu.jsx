/**
 * PageSlotIconMenu - Add widget menu for PageEditor slots
 * 
 * This component replicates the ObjectContentEditor SlotIconMenu functionality
 * but is completely separate and tailored for PageEditor's needs.
 */

import React, { useState, useRef, useEffect } from 'react';
import { MoreHorizontal, Plus, Trash2 } from 'lucide-react';

const PageSlotIconMenu = ({
    slotName,
    slotLabel,
    widgets = [],
    maxWidgets = 10,
    onAddWidget,
    onClearSlot,
    onShowWidgetModal
}) => {
    const [isOpen, setIsOpen] = useState(false);
    const menuRef = useRef(null);

    // Close menu when clicking outside
    useEffect(() => {
        const handleClickOutside = (event) => {
            if (menuRef.current && !menuRef.current.contains(event.target)) {
                setIsOpen(false);
            }
        };

        if (isOpen) {
            document.addEventListener('mousedown', handleClickOutside);
            return () => document.removeEventListener('mousedown', handleClickOutside);
        }
    }, [isOpen]);

    const handleMenuToggle = () => {
        setIsOpen(!isOpen);
    };

    const handleAddWidgetClick = () => {
        if (onShowWidgetModal) {
            onShowWidgetModal(slotName);
        } else if (onAddWidget) {
            // Fallback to direct widget addition
            onAddWidget(slotName);
        }
        setIsOpen(false);
    };

    const handleClearSlotClick = () => {
        if (onClearSlot) {
            onClearSlot(slotName);
        }
        setIsOpen(false);
    };

    const canAddWidget = widgets.length < maxWidgets;
    const hasWidgets = widgets.length > 0;

    return (
        <div className="relative" ref={menuRef}>
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
                <div className="absolute top-full right-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg min-w-48 z-50">
                    {/* Add Widget */}
                    {canAddWidget && (
                        <>
                            <button
                                onClick={handleAddWidgetClick}
                                className="flex items-center w-full px-3 py-2 text-sm text-left hover:bg-gray-100 transition-colors text-green-700 hover:bg-green-50"
                            >
                                <Plus className="h-4 w-4 mr-3 text-gray-600" />
                                <span className="text-gray-900">Add Widget</span>
                            </button>
                            {hasWidgets && <div className="border-t border-gray-200 my-1"></div>}
                        </>
                    )}

                    {/* Clear Slot */}
                    {hasWidgets && (
                        <button
                            onClick={handleClearSlotClick}
                            className="flex items-center w-full px-3 py-2 text-sm text-left hover:bg-gray-100 transition-colors text-red-700 hover:bg-red-50"
                        >
                            <Trash2 className="h-4 w-4 mr-3 text-gray-600" />
                            <span className="text-gray-900">Clear Slot</span>
                        </button>
                    )}

                    {/* No options available */}
                    {!canAddWidget && !hasWidgets && (
                        <div className="px-3 py-2 text-sm text-gray-500">
                            Slot is at maximum capacity
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};

export default PageSlotIconMenu;
