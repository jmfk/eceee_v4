/**
 * ECEEE Navigation Widget
 * 
 * ECEEE-specific implementation of the Navigation widget.
 * Widget type: eceee_widgets.NavigationWidget
 */

import React from 'react';
import NavigationWidget from '../default-widgets/NavigationWidget';

const eceeeNavigationWidget = (props) => {
    // Use the default NavigationWidget component but with eceee_widgets namespace
    return <NavigationWidget {...props} />;
};

// Widget metadata
eceeeNavigationWidget.displayName = 'ECEEE Navigation';
eceeeNavigationWidget.widgetType = 'eceee_widgets.NavigationWidget';

eceeeNavigationWidget.defaultConfig = {
    content: '',
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
    brand_name: 'ECEEE',
    brand_url: '/',
    brand_logo: null,
    menu_items: [],
    mobile_friendly: true,
    sticky: false,
    dropdown_enabled: true
};

eceeeNavigationWidget.metadata = {
    name: 'ECEEE Navigation',
    description: 'ECEEE-specific navigation widget with menu and branding',
    category: 'layout',
    icon: null,
    tags: ['navigation', 'menu', 'eceee'],
    menuItems: []
};

export default eceeeNavigationWidget;

