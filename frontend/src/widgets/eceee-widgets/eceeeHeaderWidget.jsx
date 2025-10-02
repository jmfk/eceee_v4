/**
 * ECEEE Header Widget
 * 
 * ECEEE-specific implementation of the Header widget.
 * Widget type: eceee_widgets.HeaderWidget
 */

import React from 'react';
import HeaderWidget from '../default-widgets/HeaderWidget';

const eceeeHeaderWidget = (props) => {
    // Use the default HeaderWidget component but with eceee_widgets namespace
    return <HeaderWidget {...props} />;
};

// Widget metadata
eceeeHeaderWidget.displayName = 'ECEEE Header';
eceeeHeaderWidget.widgetType = 'eceee_widgets.HeaderWidget';

eceeeHeaderWidget.defaultConfig = {
    content: '<h1>ECEEE Header</h1>',
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
    show_overlay: false,
    overlay_color: null,
    overlay_opacity: 0.5,
    hero_style: false,
    min_height: null
};

eceeeHeaderWidget.metadata = {
    name: 'ECEEE Header',
    description: 'ECEEE-specific header widget with background and styling options',
    category: 'layout',
    icon: null,
    tags: ['header', 'hero', 'eceee'],
    menuItems: []
};

export default eceeeHeaderWidget;

