/**
 * Simple Two-Column Widget Component
 * 
 * A simple two-column layout with left and right slots that work like regular page slots.
 */

import React from 'react';
import SlotEditor from '../../components/editors/SlotEditor';
import PropTypes from 'prop-types';

const TwoColumnsWidget = ({
    config = {},
    mode = 'display',
    widgetId,
    availableWidgetTypes = [],
    onWidgetEdit,
    contextType = 'page',
    ...props
}) => {
    // Get slots data (like PageVersion.widgets structure)
    const slotsData = config.slots || { left: [], right: [] };

    // In edit mode, show SlotEditor components
    if (mode === 'edit') {
        return (
            <div className="two-columns-widget-editor">
                <div className="columns-grid grid grid-cols-1 lg:grid-cols-2 gap-4">
                    <SlotEditor
                        slotName="left"
                        slotLabel="Left Column"
                        widgets={slotsData.left || []}
                        availableWidgetTypes={availableWidgetTypes}
                        parentWidgetId={widgetId}
                        contextType={contextType}
                        onWidgetEdit={onWidgetEdit}
                        emptyMessage="No widgets in left column"
                        className="bg-blue-50 border-blue-200"
                    />

                    <SlotEditor
                        slotName="right"
                        slotLabel="Right Column"
                        widgets={slotsData.right || []}
                        availableWidgetTypes={availableWidgetTypes}
                        parentWidgetId={widgetId}
                        contextType={contextType}
                        onWidgetEdit={onWidgetEdit}
                        emptyMessage="No widgets in right column"
                        className="bg-green-50 border-green-200"
                    />
                </div>
            </div>
        );
    }

    // In display mode, just show the layout structure
    // The actual widget rendering will be handled by the backend template
    return (
        <div className="two-columns-widget">
            <div className="column-slot left" data-slot="left">
                {slotsData.left?.length === 0 && (
                    <div className="empty-slot">Left column</div>
                )}
            </div>

            <div className="column-slot right" data-slot="right">
                {slotsData.right?.length === 0 && (
                    <div className="empty-slot">Right column</div>
                )}
            </div>
        </div>
    );
};

TwoColumnsWidget.propTypes = {
    config: PropTypes.shape({
        slots: PropTypes.shape({
            left: PropTypes.array,
            right: PropTypes.array
        })
    }),
    mode: PropTypes.oneOf(['display', 'edit']),
    widgetId: PropTypes.string,
    availableWidgetTypes: PropTypes.arrayOf(PropTypes.shape({
        type: PropTypes.string.isRequired,
        name: PropTypes.string.isRequired
    })),
    onWidgetEdit: PropTypes.func,
    contextType: PropTypes.oneOf(['page', 'object'])
};

TwoColumnsWidget.displayName = 'Two Columns';
TwoColumnsWidget.description = 'Simple two-column layout with left and right slots for widgets';

// Define slot configuration for the editor
TwoColumnsWidget.slotConfiguration = {
    slots: [
        {
            name: "left",
            label: "Left Column",
            description: "Widgets in the left column",
            maxWidgets: null,
            required: false
        },
        {
            name: "right",
            label: "Right Column",
            description: "Widgets in the right column",
            maxWidgets: null,
            required: false
        }
    ]
};

export default TwoColumnsWidget;
