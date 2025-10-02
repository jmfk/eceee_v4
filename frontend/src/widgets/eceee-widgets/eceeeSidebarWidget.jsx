/**
 * ECEEE Sidebar Widget
 * 
 * ECEEE-specific implementation of the Sidebar widget.
 * Widget type: eceee_widgets.SidebarWidget
 */

import React from 'react';
import SidebarWidget from '../default-widgets/SidebarWidget';

const eceeeSidebarWidget = (props) => {
    // Use the default SidebarWidget component but with eceee_widgets namespace
    return <SidebarWidget {...props} />;
};

// Widget metadata
eceeeSidebarWidget.displayName = 'ECEEE Sidebar';
eceeeSidebarWidget.widgetType = 'eceee_widgets.SidebarWidget';

eceeeSidebarWidget.defaultConfig = {
    content: '<h3>Sidebar</h3><p>Sidebar content goes here.</p>',
    background_color: null,
    background_image: null,
    background_size: 'cover',
    background_position: 'center',
    text_color: null,
    padding: null,
    margin: null,
    text_align: 'left',
    css_class: null,
    custom_css: null,
    position: 'right',
    width: null,
    collapsible: false,
    widgets: []
};

eceeeSidebarWidget.metadata = {
    name: 'ECEEE Sidebar',
    description: 'ECEEE-specific sidebar widget with nested widget support',
    category: 'layout',
    icon: null,
    tags: ['sidebar', 'layout', 'eceee'],
    menuItems: []
};

export default eceeeSidebarWidget;

