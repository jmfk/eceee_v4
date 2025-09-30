/**
 * SlotEditor React Wrapper
 * 
 * Minimal React wrapper for the SelfContainedSlotEditor vanilla JS class.
 * Provides zero-rerender slot editing with UDC integration.
 */

import React, { useRef, useEffect, forwardRef, useImperativeHandle } from 'react';
import { useUnifiedData } from '../../contexts/unified-data/context/UnifiedDataContext';
import { SelfContainedSlotEditor } from './SelfContainedSlotEditor.js';
import PropTypes from 'prop-types';

const SlotEditor = forwardRef(({
    slotName,
    slotLabel,
    widgets = [],
    availableWidgetTypes = [],
    maxWidgets = null,
    parentWidgetId,
    contextType = 'page',
    onWidgetEdit,
    className = '',
    showAddButton = true,
    showMoveButtons = true,
    showEditButton = true,
    showRemoveButton = true,
    emptyMessage = null
}, ref) => {
    // Refs for DOM and slot editor instance
    const containerRef = useRef(null);
    const slotEditorInstanceRef = useRef(null);

    // Get UDC functions
    const { publishUpdate, useExternalChanges } = useUnifiedData();

    // Initialize slot editor when component mounts
    useEffect(() => {
        if (containerRef.current && !slotEditorInstanceRef.current) {
            const slotData = {
                slotName,
                slotLabel,
                widgets,
                availableWidgetTypes,
                maxWidgets,
                parentWidgetId,
                contextType
            };

            const options = {
                publishUpdate,
                onWidgetEdit,
                showAddButton,
                showMoveButtons,
                showEditButton,
                showRemoveButton,
                emptyMessage,
                registry: window.slotRegistry
            };

            const slotEditor = new SelfContainedSlotEditor(slotData, options);

            slotEditor.initialize(containerRef.current).then(success => {
                if (success) {
                    slotEditorInstanceRef.current = slotEditor;
                } else {
                    console.error('Failed to initialize slot editor');
                }
            }).catch(error => {
                console.error('Slot editor initialization error:', error);
            });
        }

        return () => {
            // Cleanup when unmounting
            if (slotEditorInstanceRef.current) {
                slotEditorInstanceRef.current.destroy();
                slotEditorInstanceRef.current = null;
            }
        };
    }, []); // Empty dependency array - no rerenders from props!

    // Subscribe to UDC changes (but don't cause rerenders)
    useExternalChanges(`slot-editor-${parentWidgetId}-${slotName}`, (state) => {
        // Update the vanilla JS instance directly
        if (slotEditorInstanceRef.current && !slotEditorInstanceRef.current.isUpdateLocked()) {
            const updatedWidgets = extractSlotWidgetsFromState(state, parentWidgetId, slotName);
            if (updatedWidgets) {
                slotEditorInstanceRef.current.updateWidgets(updatedWidgets);
            }
        }
    });

    // Helper to extract slot widgets from UDC state
    const extractSlotWidgetsFromState = (state, parentId, slot) => {
        // Implementation depends on UDC state structure
        // For now, return null to indicate no change
        // This would be implemented based on how container widget slots are stored in UDC
        return null;
    };

    // Expose methods to parent components
    useImperativeHandle(ref, () => ({
        updateWidgets: (newWidgets) => {
            if (slotEditorInstanceRef.current) {
                slotEditorInstanceRef.current.updateWidgets(newWidgets);
            }
        },
        getWidgets: () => {
            return slotEditorInstanceRef.current?.getWidgets() || [];
        },
        refresh: () => {
            if (slotEditorInstanceRef.current) {
                slotEditorInstanceRef.current.refresh();
            }
        },
        getSlotId: () => {
            return slotEditorInstanceRef.current?.slotId;
        }
    }), []);

    return (
        <div
            ref={containerRef}
            className={`slot-editor-wrapper ${className}`}
        />
    );
});

SlotEditor.propTypes = {
    slotName: PropTypes.string.isRequired,
    slotLabel: PropTypes.string.isRequired,
    widgets: PropTypes.array,
    availableWidgetTypes: PropTypes.arrayOf(PropTypes.shape({
        type: PropTypes.string.isRequired,
        name: PropTypes.string.isRequired
    })),
    maxWidgets: PropTypes.number,
    parentWidgetId: PropTypes.string.isRequired,
    contextType: PropTypes.oneOf(['page', 'object']),
    onWidgetEdit: PropTypes.func,
    className: PropTypes.string,
    showAddButton: PropTypes.bool,
    showMoveButtons: PropTypes.bool,
    showEditButton: PropTypes.bool,
    showRemoveButton: PropTypes.bool,
    emptyMessage: PropTypes.string
};

SlotEditor.displayName = 'SlotEditor';

export default SlotEditor;
