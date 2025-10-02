/**
 * ECEEE Content Widget
 * 
 * ECEEE-specific implementation of the Content widget.
 * Widget type: eceee_widgets.ContentWidget
 */

import React from 'react';
import ContentWidget from '../default-widgets/ContentWidget';

const eceeeContentWidget = (props) => {
    // Use the default ContentWidget component but with eceee_widgets namespace
    return <ContentWidget {...props} />;
};

// Widget metadata
eceeeContentWidget.displayName = 'ECEEE Content';
eceeeContentWidget.widgetType = 'eceee_widgets.ContentWidget';

eceeeContentWidget.defaultConfig = {
    content: '<h2>ECEEE Content</h2><p>This is an ECEEE-specific content widget.</p>',
    allow_scripts: false,
    sanitize_html: true
};

eceeeContentWidget.metadata = {
    name: 'ECEEE Content',
    description: 'ECEEE-specific HTML content widget',
    category: 'content',
    icon: null,
    tags: ['content', 'html', 'eceee'],
    menuItems: []
};

export default eceeeContentWidget;

