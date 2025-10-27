/**
 * PageSlotIconMenu - Simple icon buttons for PageEditor slots
 * 
 * This component provides direct access to add and clear slot actions
 * with simple icon buttons instead of a dropdown menu.
 */

import React, { useState } from 'react';
import { Plus, XCircle, Download } from 'lucide-react';
import ConfirmationModal from '../../components/ConfirmationModal';

const PageSlotIconMenu = ({
    slotName,
    slotLabel,
    widgets = [],
    maxWidgets = 10,
    onAddWidget,
    onClearSlot,
    onShowWidgetModal,
    onImportContent
}) => {
    const [showClearConfirm, setShowClearConfirm] = useState(false);

    const handleAddWidgetClick = () => {
        if (onShowWidgetModal) {
            onShowWidgetModal(slotName);
        } else if (onAddWidget) {
            // Fallback to direct widget addition
            onAddWidget(slotName);
        }
    };

    const handleClearSlotClick = () => {
        setShowClearConfirm(true);
    };

    const handleConfirmClear = () => {
        if (onClearSlot) {
            onClearSlot(slotName);
        }
    };
    
    const handleImportContentClick = () => {
        if (onImportContent) {
            onImportContent(slotName);
        }
    };

    const canAddWidget = widgets.length < maxWidgets;
    const hasWidgets = widgets.length > 0;

    return (
        <>
            <div className="flex items-center space-x-1">
                {/* Import Content Button */}
                {onImportContent && (
                    <button
                        onClick={handleImportContentClick}
                        className="p-1 text-blue-600 hover:text-blue-800 hover:bg-blue-50 transition-colors rounded"
                        title="Import content from web"
                    >
                        <Download className="h-4 w-4" />
                    </button>
                )}
                
                {/* Add Widget Button */}
                {canAddWidget && (
                    <button
                        onClick={handleAddWidgetClick}
                        className="p-1 text-green-600 hover:text-green-800 hover:bg-green-50 transition-colors rounded"
                        title="Add widget to slot"
                    >
                        <Plus className="h-4 w-4" />
                    </button>
                )}

                {/* Clear Slot Button */}
                {hasWidgets && (
                    <button
                        onClick={handleClearSlotClick}
                        className="p-1 text-red-600 hover:text-red-800 hover:bg-red-50 transition-colors rounded"
                        title="Clear all widgets from slot"
                    >
                        <XCircle className="h-4 w-4" />
                    </button>
                )}
            </div>

            {/* Confirmation Modal */}
            <ConfirmationModal
                isOpen={showClearConfirm}
                onClose={() => setShowClearConfirm(false)}
                onConfirm={handleConfirmClear}
                title="Clear All Widgets"
                message={`Are you sure you want to clear all ${widgets.length} widget${widgets.length !== 1 ? 's' : ''} from the "${slotLabel}" slot? This action cannot be undone.`}
                confirmText="Clear All"
                cancelText="Cancel"
                variant="warning"
            />
        </>
    );
};

export default PageSlotIconMenu;
