/**
 * Main Layout - ECEEE-specific layout for blog posts
 */

import React from 'react';
import WidgetSlot from './WidgetSlot';

export const MainLayout = ({
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
    return (
        <div className="grid grid-cols-3 w-full" style={{ gridTemplateColumns: '1fr minmax(0,1280px) 1fr' }}>
            <div className=""></div>
            <div className="">
                <header className="bg-black h-[132px]">
                    <WidgetSlot
                        name="header"
                        label="Page Header"
                        description="Site navigation, branding, and header content"
                        widgets={widgets}
                        onWidgetAction={onWidgetAction}
                        editable={editable}
                        pageContext={pageContext}
                        onShowWidgetModal={onShowWidgetModal}
                        onClearSlot={onClearSlot}
                        behavior={{
                            maxWidgets: 3,
                            required: true
                        }}
                        // Forward inheritance props
                        inheritedWidgets={inheritedWidgets}
                        slotInheritanceRules={slotInheritanceRules}
                    />
                </header>

                <WidgetSlot
                    name="navbar"
                    label="Navigation Bar"
                    description="Main navigation menu"
                    widgets={widgets}
                    onWidgetAction={onWidgetAction}
                    editable={editable}
                    pageContext={pageContext}
                    onShowWidgetModal={onShowWidgetModal}
                    onClearSlot={onClearSlot}
                    behavior={{
                        maxWidgets: 1,
                        required: false
                    }}
                    // Forward inheritance props
                    inheritedWidgets={inheritedWidgets}
                    slotInheritanceRules={slotInheritanceRules}
                />

                <div className="grid grid-cols-1 lg:grid-cols-[2fr_1fr] min-h-[300px] bg-gray-50">
                    <main className="bg-white">
                        <WidgetSlot
                            name="main"
                            label="Main Content"
                            description="Primary content area for articles and posts"
                            widgets={widgets}
                            onWidgetAction={onWidgetAction}
                            editable={editable}
                            pageContext={pageContext}
                            onShowWidgetModal={onShowWidgetModal}
                            onClearSlot={onClearSlot}
                            behavior={{
                                slotType: "content",
                                required: true
                            }}
                            // Forward inheritance props
                            inheritedWidgets={inheritedWidgets}
                            slotInheritanceRules={slotInheritanceRules}
                        />
                    </main>

                    <aside className="bg-white">
                        <WidgetSlot
                            name="sidebar"
                            label="Sidebar Content"
                            description="Complementary content and widgets"
                            widgets={widgets}
                            onWidgetAction={onWidgetAction}
                            editable={editable}
                            pageContext={pageContext}
                            onShowWidgetModal={onShowWidgetModal}
                            onClearSlot={onClearSlot}
                            behavior={{
                                slotType: "content",
                                maxWidgets: 10,
                                required: false
                            }}
                            // Forward inheritance props
                            inheritedWidgets={inheritedWidgets}
                            slotInheritanceRules={slotInheritanceRules}
                        />
                    </aside>
                </div>

                <footer className="bg-gray-800 shadow-sm min-h-[300px]">
                    <WidgetSlot
                        name="footer"
                        label="Footer Content"
                        description="Page footer spanning all columns"
                        widgets={widgets}
                        onWidgetAction={onWidgetAction}
                        editable={editable}
                        pageContext={pageContext}
                        onShowWidgetModal={onShowWidgetModal}
                        onClearSlot={onClearSlot}
                        behavior={{
                            slotType: "inherited",
                            maxWidgets: 5,
                            required: false
                        }}
                        // Forward inheritance props
                        inheritedWidgets={inheritedWidgets}
                        slotInheritanceRules={slotInheritanceRules}
                    />
                </footer>
            </div>
            <div></div>
        </div>
    );
};

export default MainLayout;
