/**
 * SlotEditor React Component
 * 
 * Direct React component using SelfContainedSlotEditor.
 * Provides slot editing with UDC integration.
 */

import React, { forwardRef, useImperativeHandle, useRef } from 'react';
import { SelfContainedSlotEditor } from './SelfContainedSlotEditor.jsx';
import PropTypes from 'prop-types';

const SlotEditor = forwardRef(({
    slotName,
    slotLabel,
    widgets = [],
    availableWidgetTypes = [],
    maxWidgets = null,
    parentWidgetId,
    parentSlotName, // Top-level slot where parent widget lives (legacy)
    contextType = 'page',
    onWidgetEdit,
    onOpenWidgetEditor,
    onSlotChange, // Callback for when slot widgets change
    parentComponentId, // Parent's UDC componentId
    widgetPath = [], // Full path to parent widget (for infinite nesting)
    className = '',
    showAddButton = true,
    showMoveButtons = true,
    showEditButton = true,
    showRemoveButton = true,
    showClearButton = true,
    compactAddButton = false,
    emptyMessage = null,
    mode = 'editor', // Mode for nested widgets: 'editor' or 'display'
    // Selection props
    selectedWidgets,
    cutWidgets,
    onToggleWidgetSelection,
    isWidgetSelected,
    isWidgetCut,
    buildWidgetPath,
    parseWidgetPath
}, ref) => {
    // Ref to the SelfContainedSlotEditor component
    const slotEditorRef = useRef(null);

    // Expose methods to parent components
    useImperativeHandle(ref, () => ({
        updateWidgets: (newWidgets) => {
            // The React component will handle this through props
        },
        getWidgets: () => {
            return widgets;
        },
        refresh: () => {
            // The React component will handle this through re-renders
        },
        getSlotId: () => {
            return `${parentWidgetId}-${slotName}`;
        }
    }), [widgets, parentWidgetId, slotName]);

    return (
        <div className={`slot-editor-wrapper ${className}`}>
            <SelfContainedSlotEditor
                ref={slotEditorRef}
                slotName={slotName}
                slotLabel={slotLabel}
                widgets={widgets}
                availableWidgetTypes={availableWidgetTypes}
                maxWidgets={maxWidgets}
                parentWidgetId={parentWidgetId}
                parentSlotName={parentSlotName}
                contextType={contextType}
                onWidgetEdit={onWidgetEdit}
                onOpenWidgetEditor={onOpenWidgetEditor}
                onSlotChange={onSlotChange}
                parentComponentId={parentComponentId}
                widgetPath={widgetPath}
                showAddButton={showAddButton}
                showMoveButtons={showMoveButtons}
                showEditButton={showEditButton}
                showRemoveButton={showRemoveButton}
                showClearButton={showClearButton}
                compactAddButton={compactAddButton}
                emptyMessage={emptyMessage}
                mode={mode}
                // Selection props
                selectedWidgets={selectedWidgets}
                cutWidgets={cutWidgets}
                onToggleWidgetSelection={onToggleWidgetSelection}
                isWidgetSelected={isWidgetSelected}
                isWidgetCut={isWidgetCut}
                buildWidgetPath={buildWidgetPath}
                parseWidgetPath={parseWidgetPath}
            />
        </div>
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
    onOpenWidgetEditor: PropTypes.func,
    onSlotChange: PropTypes.func,
    parentComponentId: PropTypes.string,
    className: PropTypes.string,
    showAddButton: PropTypes.bool,
    showMoveButtons: PropTypes.bool,
    showEditButton: PropTypes.bool,
    showRemoveButton: PropTypes.bool,
    showClearButton: PropTypes.bool,
    compactAddButton: PropTypes.bool,
    emptyMessage: PropTypes.string,
    mode: PropTypes.oneOf(['editor', 'display'])
};

SlotEditor.displayName = 'SlotEditor';

export default SlotEditor;
