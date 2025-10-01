/**
 * Two Column Layout - Equal columns
 */

import React from 'react';
import WidgetSlot from './WidgetSlot';

export const TwoColumnLayout = ({ widgets, onWidgetAction, editable = true, pageContext = {}, onShowWidgetModal, onClearSlot }) => {
    return (
        <div className="two-column-layout w-full h-full overflow-y-auto bg-gray-50">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 max-w-6xl mx-auto p-6 pb-20">
                {/* Header - spans both columns */}
                <div className="lg:col-span-2">
                    <WidgetSlot
                        name="header"
                        label="Header"
                        description="Page header area"
                        widgets={widgets.header || []}
                        onWidgetAction={onWidgetAction}
                        editable={editable}
                        pageContext={pageContext}
                        className="bg-white p-6 rounded-xl shadow-sm border border-gray-200"
                        allowedWidgetTypes={['default_widgets.HeaderWidget']}
                        maxWidgets={2}
                        required={false}
                        onShowWidgetModal={onShowWidgetModal}
                        onClearSlot={onClearSlot}
                    />
                </div>

                {/* Left Column */}
                <div>
                    <WidgetSlot
                        name="left"
                        label="Left Column"
                        description="Left content column"
                        widgets={widgets.left || []}
                        onWidgetAction={onWidgetAction}
                        editable={editable}
                        pageContext={pageContext}
                        className="bg-white p-6 rounded-xl shadow-sm border border-gray-200 min-h-[400px]"
                        allowedWidgetTypes={['*']}
                        maxWidgets={8}
                        required={true}
                        onShowWidgetModal={onShowWidgetModal}
                        onClearSlot={onClearSlot}
                    />
                </div>

                {/* Right Column */}
                <div>
                    <WidgetSlot
                        name="right"
                        label="Right Column"
                        description="Right content column"
                        widgets={widgets.right || []}
                        onWidgetAction={onWidgetAction}
                        editable={editable}
                        pageContext={pageContext}
                        className="bg-white p-6 rounded-xl shadow-sm border border-gray-200 min-h-[400px]"
                        allowedWidgetTypes={['*']}
                        maxWidgets={8}
                        required={true}
                        onShowWidgetModal={onShowWidgetModal}
                        onClearSlot={onClearSlot}
                    />
                </div>

                {/* Footer - spans both columns */}
                <div className="lg:col-span-2">
                    <WidgetSlot
                        name="footer"
                        label="Footer"
                        description="Page footer area"
                        widgets={widgets.footer || []}
                        onWidgetAction={onWidgetAction}
                        editable={editable}
                        pageContext={pageContext}
                        className="bg-gray-700 text-white p-6 rounded-xl text-center"
                        allowedWidgetTypes={['default_widgets.FooterWidget']}
                        maxWidgets={1}
                        required={false}
                        onShowWidgetModal={onShowWidgetModal}
                        onClearSlot={onClearSlot}
                    />
                </div>
            </div>
        </div>
    );
};

export default TwoColumnLayout;
