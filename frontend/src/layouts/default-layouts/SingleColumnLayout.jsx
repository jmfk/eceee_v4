/**
 * Single Column Layout - Simple single column for articles
 */

import React from 'react';
import WidgetSlot from './WidgetSlot';

export const SingleColumnLayout = ({
    widgets,
    onWidgetAction,
    editable = true,
    pageContext = {},
    onShowWidgetModal,
    onClearSlot,
    // Inheritance props
    inheritedWidgets = {},
    slotInheritanceRules = {}
}) => {
    console.log("SingleColumnLayout")
    console.log("inheritedWidgets", inheritedWidgets)
    console.log("slotInheritanceRules", slotInheritanceRules)

    return (
        <div className="single-column-layout w-full h-full overflow-y-auto">
            <div className="max-w-4xl mx-auto p-6 pb-20">
                <WidgetSlot
                    name="main"
                    label="Main Content"
                    description="Primary content area for articles and posts"
                    widgets={widgets}
                    onWidgetAction={onWidgetAction}
                    editable={editable}
                    pageContext={pageContext}
                    className="bg-white p-8 rounded-xl shadow-sm border border-gray-200 min-h-[500px]"
                    allowedWidgetTypes={['*']}
                    maxWidgets={20}
                    required={true}
                    onShowWidgetModal={onShowWidgetModal}
                    onClearSlot={onClearSlot}
                    // Forward inheritance props
                    inheritedWidgets={inheritedWidgets}
                    slotInheritanceRules={slotInheritanceRules}
                />
            </div>
        </div>
    );
};

export default SingleColumnLayout;
