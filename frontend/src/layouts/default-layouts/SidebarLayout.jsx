/**
 * Sidebar Layout - Main content with sidebar
 */

import React from 'react';
import WidgetSlot from './WidgetSlot';

export const SidebarLayout = ({
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
    console.log("SidebarLayout")
    console.log("inheritedWidgets", inheritedWidgets)
    console.log("slotInheritanceRules", slotInheritanceRules)

    return (
        <div className="sidebar-layout w-full h-full overflow-y-auto bg-gray-50">
            <div className="grid grid-cols-1 lg:grid-cols-[2fr_1fr] gap-6 max-w-7xl mx-auto p-6 pb-20">
                {/* Header - spans full width */}
                <div className="lg:col-span-2">
                    <WidgetSlot
                        name="header"
                        label="Page Header"
                        description="Site navigation, branding, and header content"
                        widgets={widgets}
                        onWidgetAction={onWidgetAction}
                        editable={editable}
                        pageContext={pageContext}
                        className="bg-white p-6 rounded-xl shadow-sm border border-gray-200"
                        allowedWidgetTypes={['default_widgets.HeaderWidget', 'default_widgets.NavigationWidget']}
                        maxWidgets={3}
                        required={false}
                        onShowWidgetModal={onShowWidgetModal}
                        onClearSlot={onClearSlot}
                        // Forward inheritance props
                        inheritedWidgets={inheritedWidgets}
                        slotInheritanceRules={slotInheritanceRules}
                    />
                </div>

                {/* Main Content */}
                <div>
                    <WidgetSlot
                        name="main"
                        label="Main Content"
                        description="Primary content area for articles and posts"
                        widgets={widgets}
                        onWidgetAction={onWidgetAction}
                        editable={editable}
                        pageContext={pageContext}
                        className="bg-white p-8 rounded-xl shadow-sm border border-gray-200 min-h-[400px]"
                        allowedWidgetTypes={['default_widgets.ContentWidget', 'default_widgets.ImageWidget', 'default_widgets.TableWidget']}
                        maxWidgets={10}
                        required={true}
                        onShowWidgetModal={onShowWidgetModal}
                        onClearSlot={onClearSlot}
                        // Forward inheritance props
                        inheritedWidgets={inheritedWidgets}
                        slotInheritanceRules={slotInheritanceRules}
                    />
                </div>

                {/* Sidebar */}
                <div>
                    <WidgetSlot
                        name="sidebar"
                        label="Sidebar"
                        description="Complementary content and navigation widgets"
                        widgets={widgets}
                        onWidgetAction={onWidgetAction}
                        editable={editable}
                        pageContext={pageContext}
                        className="bg-white p-6 rounded-xl shadow-sm border border-gray-200 min-h-[300px]"
                        allowedWidgetTypes={['default_widgets.NavigationWidget', 'default_widgets.ContentWidget']}
                        maxWidgets={5}
                        required={false}
                        onShowWidgetModal={onShowWidgetModal}
                        onClearSlot={onClearSlot}
                        // Forward inheritance props
                        inheritedWidgets={inheritedWidgets}
                        slotInheritanceRules={slotInheritanceRules}
                    />
                </div>

                {/* Footer - spans full width */}
                <div className="lg:col-span-2">
                    <WidgetSlot
                        name="footer"
                        label="Footer"
                        description="Site footer with links and copyright"
                        widgets={widgets}
                        onWidgetAction={onWidgetAction}
                        editable={editable}
                        pageContext={pageContext}
                        className="bg-gray-700 text-white p-6 rounded-xl text-center"
                        allowedWidgetTypes={['default_widgets.FooterWidget', 'default_widgets.NavigationWidget']}
                        maxWidgets={2}
                        required={false}
                        onShowWidgetModal={onShowWidgetModal}
                        onClearSlot={onClearSlot}
                        // Forward inheritance props
                        inheritedWidgets={inheritedWidgets}
                        slotInheritanceRules={slotInheritanceRules}
                    />
                </div>
            </div>
        </div>
    );
};

export default SidebarLayout;
