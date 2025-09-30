/**
 * Two Columns Editor - Zero Rerender Implementation
 * 
 * Uses self-contained SlotEditor instances to avoid React rerenders.
 * Integrates with UDC for real-time synchronization.
 */

import React, { useRef, useEffect, forwardRef, useImperativeHandle } from 'react';
import { useUnifiedData } from '../../contexts/unified-data/context/UnifiedDataContext';
import SlotEditor from '../../components/editors/SlotEditor';
import PropTypes from 'prop-types';

const TwoColumnsEditor = forwardRef(({
    widgetData,  // Complete widget data including config
    availableWidgetTypes = [],
    onWidgetEdit,
    contextType = 'page'
}, ref) => {
    // Refs for slot editors (no React state!)
    const leftSlotRef = useRef(null);
    const rightSlotRef = useRef(null);

    // Get UDC (but don't use it for state - only for passing to children)
    const { useExternalChanges } = useUnifiedData();

    // Subscribe to UDC changes for this widget (but don't rerender!)
    const componentId = `two-columns-editor-${widgetData.id}`;
    useExternalChanges(componentId, (state) => {
        // Update slot editors directly without React rerenders
        const updatedSlots = extractSlotsFromState(state, widgetData.id);
        if (updatedSlots) {
            if (leftSlotRef.current) {
                leftSlotRef.current.updateWidgets(updatedSlots.left || []);
            }
            if (rightSlotRef.current) {
                rightSlotRef.current.updateWidgets(updatedSlots.right || []);
            }
        }
    });

    // Helper to extract slot data from UDC state
    const extractSlotsFromState = (state, widgetId) => {
        // Extract slot data from UDC state
        // Implementation depends on UDC structure - for now return null
        return null;
    };

    // Get initial slot data
    const slots = widgetData.config?.slots || { left: [], right: [] };

    // Expose methods to parent
    useImperativeHandle(ref, () => ({
        getSlots: () => {
            return {
                left: leftSlotRef.current?.getWidgets() || [],
                right: rightSlotRef.current?.getWidgets() || []
            };
        },
        refreshSlots: () => {
            leftSlotRef.current?.refresh();
            rightSlotRef.current?.refresh();
        },
        updateSlots: (newSlots) => {
            if (newSlots.left && leftSlotRef.current) {
                leftSlotRef.current.updateWidgets(newSlots.left);
            }
            if (newSlots.right && rightSlotRef.current) {
                rightSlotRef.current.updateWidgets(newSlots.right);
            }
        }
    }), []);

    console.log("TwoColumnsEditor")
    return (
        <div className="two-columns-editor space-y-6">
            <div className="editor-header">
                <h2 className="text-xl font-bold text-gray-800">Two Columns Editor</h2>
                <p className="text-sm text-gray-600 mt-1">
                    Configure widgets in the left and right column slots.
                </p>
            </div>

            <div className="slots-editor">
                <h3 className="font-semibold mb-4 text-gray-700">Column Content</h3>
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    <SlotEditor
                        ref={leftSlotRef}
                        slotName="left"
                        slotLabel="Left Column"
                        widgets={slots.left || []}
                        availableWidgetTypes={availableWidgetTypes}
                        parentWidgetId={widgetData.id}
                        contextType={contextType}
                        onWidgetEdit={onWidgetEdit}
                        emptyMessage="No widgets in left column"
                        className="bg-blue-50 border-blue-200"
                    />

                    <SlotEditor
                        ref={rightSlotRef}
                        slotName="right"
                        slotLabel="Right Column"
                        widgets={slots.right || []}
                        availableWidgetTypes={availableWidgetTypes}
                        parentWidgetId={widgetData.id}
                        contextType={contextType}
                        onWidgetEdit={onWidgetEdit}
                        emptyMessage="No widgets in right column"
                        className="bg-green-50 border-green-200"
                    />
                </div>
            </div>

            <div className="editor-info bg-gray-50 p-4 rounded-lg">
                <h4 className="font-medium text-gray-800 mb-2">Layout Information</h4>
                <div className="text-sm text-gray-600 space-y-1">
                    <div>• Fixed 50/50 column split</div>
                    <div>• 1rem gap between columns</div>
                    <div>• Responsive: stacks on mobile</div>
                    <div>• Each column can hold unlimited widgets</div>
                </div>
            </div>
        </div>
    );
});

TwoColumnsEditor.propTypes = {
    widgetData: PropTypes.shape({
        id: PropTypes.string.isRequired,
        config: PropTypes.object
    }).isRequired,
    availableWidgetTypes: PropTypes.arrayOf(PropTypes.shape({
        type: PropTypes.string.isRequired,
        name: PropTypes.string.isRequired
    })),
    onWidgetEdit: PropTypes.func,
    contextType: PropTypes.oneOf(['page', 'object'])
};

TwoColumnsEditor.displayName = 'TwoColumnsEditor';

export default TwoColumnsEditor;
