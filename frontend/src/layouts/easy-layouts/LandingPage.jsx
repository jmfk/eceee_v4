/**
 * Landing Page Layout - EASY-specific layout for landing pages
 * 
 * Full-width landing page layout optimized for conversions with:
 * - Hero section
 * - Features showcase
 * - Testimonials/social proof
 * - Call to action
 * - Footer
 */

import React from 'react';
import WidgetSlot from './WidgetSlot';

export const LandingPage = ({
    widgets,
    onWidgetAction,
    editable = true,
    pageContext = {},
    onShowWidgetModal,
    onClearSlot,
    // Inheritance props
    inheritedWidgets = {},
    slotInheritanceRules = {},
    // Selection props
    selectedWidgets,
    cutWidgets,
    onToggleWidgetSelection,
    isWidgetSelected,
    isWidgetCut,
    onDeleteCutWidgets,
    buildWidgetPath,
    parseWidgetPath
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
                        // Forward selection props
                        selectedWidgets={selectedWidgets}
                        cutWidgets={cutWidgets}
                        onToggleWidgetSelection={onToggleWidgetSelection}
                        isWidgetSelected={isWidgetSelected}
                        isWidgetCut={isWidgetCut}
                        buildWidgetPath={buildWidgetPath}
                        parseWidgetPath={parseWidgetPath}
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
                    // Forward selection props
                    selectedWidgets={selectedWidgets}
                    cutWidgets={cutWidgets}
                    onToggleWidgetSelection={onToggleWidgetSelection}
                    isWidgetSelected={isWidgetSelected}
                    isWidgetCut={isWidgetCut}
                />

                <WidgetSlot
                    name="hero"
                    label="Hero"
                    description="The Hero space"
                    widgets={widgets}
                    onWidgetAction={onWidgetAction}
                    editable={editable}
                    pageContext={pageContext}
                    onShowWidgetModal={onShowWidgetModal}
                    onClearSlot={onClearSlot}
                    behavior={{
                        maxWidgets: 1,
                        required: false,
                        allowedWidgetTypes: ['easy_widgets.HeroWidget']
                    }}
                    // Forward inheritance props
                    inheritedWidgets={inheritedWidgets}
                    slotInheritanceRules={slotInheritanceRules}
                    // Forward selection props
                    selectedWidgets={selectedWidgets}
                    cutWidgets={cutWidgets}
                    onToggleWidgetSelection={onToggleWidgetSelection}
                    isWidgetSelected={isWidgetSelected}
                    isWidgetCut={isWidgetCut}
                />

                <main className="bg-white min-h-[310px]">
                    <WidgetSlot
                        name="landingPage"
                        label="Landing Page"
                        description="Primary content area for articles and posts"
                        widgets={widgets}
                        onWidgetAction={onWidgetAction}
                        editable={editable}
                        pageContext={pageContext}
                        onShowWidgetModal={onShowWidgetModal}
                        onClearSlot={onClearSlot}
                        behavior={{
                            slotType: "content",
                            required: true,
                            allowedWidgetTypes: [
                                'easy_widgets.BannerWidget',
                                'easy_widgets.HeroWidget',
                                'easy_widgets.TwoColumnsWidget',
                                'easy_widgets.ThreeColumnsWidget'
                            ]
                        }}
                        // Forward inheritance props
                        inheritedWidgets={inheritedWidgets}
                        slotInheritanceRules={slotInheritanceRules}
                        // Forward selection props
                        selectedWidgets={selectedWidgets}
                        cutWidgets={cutWidgets}
                        onToggleWidgetSelection={onToggleWidgetSelection}
                        isWidgetSelected={isWidgetSelected}
                        isWidgetCut={isWidgetCut}
                        onDeleteCutWidgets={onDeleteCutWidgets}
                        buildWidgetPath={buildWidgetPath}
                        parseWidgetPath={parseWidgetPath}
                    />
                </main>

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
                        // Forward selection props
                        selectedWidgets={selectedWidgets}
                        cutWidgets={cutWidgets}
                        onToggleWidgetSelection={onToggleWidgetSelection}
                        isWidgetSelected={isWidgetSelected}
                        isWidgetCut={isWidgetCut}
                        buildWidgetPath={buildWidgetPath}
                        parseWidgetPath={parseWidgetPath}
                    />
                </footer>
            </div>
            <div></div>
        </div>
    );
};

export default LandingPage;

