/**
 * Three Column Layout - Header, three columns, footer
 */

import React from 'react';
import WidgetSlot from './WidgetSlot';

export const ThreeColumnLayout = ({ widgets, onWidgetAction, editable = true, pageContext = {}, onShowWidgetModal, onClearSlot }) => {
    return (
        <div className="three-column-layout w-full h-full overflow-y-auto bg-gray-50">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 max-w-7xl mx-auto p-6 pb-20">
                {/* Header - spans all columns */}
                <div className="lg:col-span-3">
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
                        className="bg-white p-4 rounded-xl shadow-sm border border-gray-200 min-h-[300px]"
                        allowedWidgetTypes={['*']}
                        maxWidgets={6}
                        required={false}
                        onShowWidgetModal={onShowWidgetModal}
                        onClearSlot={onClearSlot}
                    />
                </div>

                {/* Center Column */}
                <div>
                    <WidgetSlot
                        name="center"
                        label="Center Column"
                        description="Center content column"
                        widgets={widgets.center || []}
                        onWidgetAction={onWidgetAction}
                        editable={editable}
                        pageContext={pageContext}
                        className="bg-white p-4 rounded-xl shadow-sm border border-gray-200 min-h-[300px]"
                        allowedWidgetTypes={['*']}
                        maxWidgets={6}
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
                        className="bg-white p-4 rounded-xl shadow-sm border border-gray-200 min-h-[300px]"
                        allowedWidgetTypes={['*']}
                        maxWidgets={6}
                        required={false}
                        onShowWidgetModal={onShowWidgetModal}
                        onClearSlot={onClearSlot}
                    />
                </div>

                {/* Footer - spans all columns */}
                <div className="lg:col-span-3">
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

export default ThreeColumnLayout;
