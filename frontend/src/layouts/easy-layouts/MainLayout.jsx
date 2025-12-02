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
    onImportContent,
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
    parseWidgetPath,
    // Paste mode props
    pasteModeActive,
    onPasteAtPosition
}) => {
    return (
        <div className="grid grid-cols-3 w-full" style={{ gridTemplateColumns: '1fr minmax(0,1280px) 1fr' }}>
            <div className=""></div>
            <div className="">
                <header className={`bg-black ${editable ? 'min-h-[132px]' : 'h-[132px]'}`}>
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
                        onImportContent={onImportContent}
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
                        onDeleteCutWidgets={onDeleteCutWidgets}
                        buildWidgetPath={buildWidgetPath}
                        parseWidgetPath={parseWidgetPath}
                        pasteModeActive={pasteModeActive}
                        onPasteAtPosition={onPasteAtPosition}
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
                    onImportContent={onImportContent}
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
                    onDeleteCutWidgets={onDeleteCutWidgets}
                    buildWidgetPath={buildWidgetPath}
                    parseWidgetPath={parseWidgetPath}
                    pasteModeActive={pasteModeActive}
                    onPasteAtPosition={onPasteAtPosition}
                />
                <div>
                    <WidgetSlot
                        name="hero"
                        label="Hero slot"
                        description="Place for placing the hero"
                        widgets={widgets}
                        onWidgetAction={onWidgetAction}
                        editable={editable}
                        pageContext={pageContext}
                        onShowWidgetModal={onShowWidgetModal}
                        onClearSlot={onClearSlot}
                        onImportContent={onImportContent}
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
                        onDeleteCutWidgets={onDeleteCutWidgets}
                        buildWidgetPath={buildWidgetPath}
                        parseWidgetPath={parseWidgetPath}
                        pasteModeActive={pasteModeActive}
                        onPasteAtPosition={onPasteAtPosition}
                    />
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-3 bg-gray-50" style={{ gridTemplateRows: 'minmax(300px, auto)', gap: '30px' }}>
                    <main className="p-0 m-0 lg:col-span-2">
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
                            onImportContent={onImportContent}
                            behavior={{
                                slotType: "content",
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
                            onDeleteCutWidgets={onDeleteCutWidgets}
                            buildWidgetPath={buildWidgetPath}
                            parseWidgetPath={parseWidgetPath}
                            pasteModeActive={pasteModeActive}
                            onPasteAtPosition={onPasteAtPosition}
                        />
                    </main>

                    <aside className="">
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
                            onImportContent={onImportContent}
                            behavior={{
                                slotType: "content",
                                maxWidgets: 10,
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
                            onDeleteCutWidgets={onDeleteCutWidgets}
                            buildWidgetPath={buildWidgetPath}
                            parseWidgetPath={parseWidgetPath}
                            pasteModeActive={pasteModeActive}
                            onPasteAtPosition={onPasteAtPosition}
                        />
                    </aside>
                </div>

                <footer className="min-h-[300px]">
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
                        onImportContent={onImportContent}
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
                        onDeleteCutWidgets={onDeleteCutWidgets}
                        buildWidgetPath={buildWidgetPath}
                        parseWidgetPath={parseWidgetPath}
                        pasteModeActive={pasteModeActive}
                        onPasteAtPosition={onPasteAtPosition}
                    />
                </footer>
            </div>
            <div></div>
        </div>
    );
};

export default MainLayout;
