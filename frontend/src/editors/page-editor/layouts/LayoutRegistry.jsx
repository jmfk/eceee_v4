/**
 * Layout Registry - Manual React Layout Definitions
 * 
 * This file contains all layout definitions as pure React components.
 * No backend protocol, no Django templates, no complex parsing - just React.
 */

import React from 'react';
import WidgetSlot from './WidgetSlot';

/**
 * Single Column Layout - Simple single column for articles
 */
export const SingleColumnLayout = ({ widgets, onWidgetAction, editable = true, pageContext = {} }) => {
    return (
        <div className="single-column-layout w-full h-full overflow-y-auto">
            <div className="max-w-4xl mx-auto p-6 pb-20">
                <WidgetSlot
                    name="main"
                    label="Main Content"
                    description="Primary content area for articles and posts"
                    widgets={widgets.main || []}
                    onWidgetAction={onWidgetAction}
                    editable={editable}
                    pageContext={pageContext}
                    className="bg-white p-8 rounded-xl shadow-sm border border-gray-200 min-h-[500px]"
                    allowedWidgetTypes={['*']}
                    maxWidgets={20}
                    required={true}
                />
            </div>
        </div>
    );
};

/**
 * Sidebar Layout - Main content with sidebar
 */
export const SidebarLayout = ({ widgets, onWidgetAction, editable = true, pageContext = {} }) => {
    return (
        <div className="sidebar-layout w-full h-full overflow-y-auto bg-gray-50">
            <div className="grid grid-cols-1 lg:grid-cols-[2fr_1fr] gap-6 max-w-7xl mx-auto p-6 pb-20">
                {/* Header - spans full width */}
                <div className="lg:col-span-2">
                    <WidgetSlot
                        name="header"
                        label="Page Header"
                        description="Site navigation, branding, and header content"
                        widgets={widgets.header || []}
                        onWidgetAction={onWidgetAction}
                        editable={editable}
                        pageContext={pageContext}
                        className="bg-white p-6 rounded-xl shadow-sm border border-gray-200"
                        allowedWidgetTypes={['core_widgets.HeaderWidget', 'core_widgets.NavigationWidget']}
                        maxWidgets={3}
                        required={false}
                    />
                </div>

                {/* Main Content */}
                <div>
                    <WidgetSlot
                        name="main"
                        label="Main Content"
                        description="Primary content area for articles and posts"
                        widgets={widgets.main || []}
                        onWidgetAction={onWidgetAction}
                        editable={editable}
                        pageContext={pageContext}
                        className="bg-white p-8 rounded-xl shadow-sm border border-gray-200 min-h-[400px]"
                        allowedWidgetTypes={['core_widgets.ContentWidget', 'core_widgets.ImageWidget', 'core_widgets.TableWidget']}
                        maxWidgets={10}
                        required={true}
                    />
                </div>

                {/* Sidebar */}
                <div>
                    <WidgetSlot
                        name="sidebar"
                        label="Sidebar"
                        description="Complementary content and navigation widgets"
                        widgets={widgets.sidebar || []}
                        onWidgetAction={onWidgetAction}
                        editable={editable}
                        pageContext={pageContext}
                        className="bg-white p-6 rounded-xl shadow-sm border border-gray-200 min-h-[300px]"
                        allowedWidgetTypes={['core_widgets.NavigationWidget', 'core_widgets.ContentWidget']}
                        maxWidgets={5}
                        required={false}
                    />
                </div>

                {/* Footer - spans full width */}
                <div className="lg:col-span-2">
                    <WidgetSlot
                        name="footer"
                        label="Footer"
                        description="Site footer with links and copyright"
                        widgets={widgets.footer || []}
                        onWidgetAction={onWidgetAction}
                        editable={editable}
                        pageContext={pageContext}
                        className="bg-gray-700 text-white p-6 rounded-xl text-center"
                        allowedWidgetTypes={['core_widgets.FooterWidget', 'core_widgets.NavigationWidget']}
                        maxWidgets={2}
                        required={false}
                    />
                </div>
            </div>
        </div>
    );
};

/**
 * Two Column Layout - Equal columns
 */
export const TwoColumnLayout = ({ widgets, onWidgetAction, editable = true, pageContext = {} }) => {
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
                        allowedWidgetTypes={['core_widgets.HeaderWidget']}
                        maxWidgets={2}
                        required={false}
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
                        allowedWidgetTypes={['core_widgets.FooterWidget']}
                        maxWidgets={1}
                        required={false}
                    />
                </div>
            </div>
        </div>
    );
};

/**
 * Three Column Layout - Header, three columns, footer
 */
export const ThreeColumnLayout = ({ widgets, onWidgetAction, editable = true, pageContext = {} }) => {
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
                        allowedWidgetTypes={['core_widgets.HeaderWidget']}
                        maxWidgets={2}
                        required={false}
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
                        allowedWidgetTypes={['core_widgets.FooterWidget']}
                        maxWidgets={1}
                        required={false}
                    />
                </div>
            </div>
        </div>
    );
};

/**
 * Layout Registry - Maps layout names to React components
 */
export const LAYOUT_REGISTRY = {
    'single_column': {
        component: SingleColumnLayout,
        name: 'single_column',
        label: 'Single Column',
        description: 'Simple single column layout for articles and content',
        slots: ['main'],
        responsive: true
    },
    'sidebar_layout': {
        component: SidebarLayout,
        name: 'sidebar_layout',
        label: 'Sidebar Layout',
        description: 'Main content with sidebar for complementary content',
        slots: ['header', 'main', 'sidebar', 'footer'],
        responsive: true
    },
    'two_column': {
        component: TwoColumnLayout,
        name: 'two_column',
        label: 'Two Column',
        description: 'Equal two column layout',
        slots: ['header', 'left', 'right', 'footer'],
        responsive: true
    },
    'three_column': {
        component: ThreeColumnLayout,
        name: 'three_column',
        label: 'Three Column',
        description: 'Three column layout with header and footer',
        slots: ['header', 'left', 'center', 'right', 'footer'],
        responsive: true
    }
};

/**
 * Get layout component by name
 */
export const getLayoutComponent = (layoutName) => {
    const layout = LAYOUT_REGISTRY[layoutName];
    return layout ? layout.component : null;
};

/**
 * Get layout metadata
 */
export const getLayoutMetadata = (layoutName) => {
    return LAYOUT_REGISTRY[layoutName] || null;
};

/**
 * Get all available layouts
 */
export const getAvailableLayouts = () => {
    return Object.values(LAYOUT_REGISTRY);
};

/**
 * Check if layout exists
 */
export const layoutExists = (layoutName) => {
    return layoutName in LAYOUT_REGISTRY;
};
