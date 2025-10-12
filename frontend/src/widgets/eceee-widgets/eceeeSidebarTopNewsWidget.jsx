/**
 * ECEEE Sidebar Top News Widget
 * 
 * Compact vertical list of top news for sidebar placement.
 * Widget type: eceee_widgets.SidebarTopNewsWidget
 */

import React from 'react';
import { Sidebar } from 'lucide-react';

const eceeeSidebarTopNewsWidget = ({
    config = {},
    mode = 'display',
    widgetId,
    ...props
}) => {
    if (mode === 'editor') {
        return (
            <div className="sidebar-top-news-widget-editor p-6 bg-gray-50 border-2 border-dashed border-gray-300 rounded-lg">
                <div className="text-center">
                    <Sidebar className="w-12 h-12 mx-auto mb-2 text-gray-400" />
                    <h3 className="text-lg font-semibold text-gray-700 mb-2">Sidebar Top News Widget</h3>
                    <p className="text-sm text-gray-500 mb-4">
                        Compact list of top news for sidebars
                    </p>
                    <div className="text-xs text-gray-400 space-y-1">
                        {config.widget_title && <p>Title: {config.widget_title}</p>}
                        {config.object_types && config.object_types.length > 0 && (
                            <p>Object Types: {config.object_types.join(', ')}</p>
                        )}
                        {config.limit && <p>Limit: {config.limit} items</p>}
                        {config.show_thumbnails && <p>Thumbnails: Enabled</p>}
                    </div>
                </div>
            </div>
        );
    }

    // In display mode, this widget is rendered server-side
    return (
        <div className="sidebar-top-news-widget" data-widget-id={widgetId}>
            <div className="p-4 text-center text-gray-500">
                Sidebar news will be rendered here
            </div>
        </div>
    );
};

// === METADATA ===
eceeeSidebarTopNewsWidget.displayName = 'Sidebar Top News';
eceeeSidebarTopNewsWidget.widgetType = 'eceee_widgets.SidebarTopNewsWidget';

// Default configuration matching backend Pydantic model
eceeeSidebarTopNewsWidget.defaultConfig = {
    object_types: ['news'],
    limit: 5,
    show_thumbnails: true,
    show_dates: true,
    show_object_type: false,
    widget_title: 'Top News'
};

// Display metadata
eceeeSidebarTopNewsWidget.metadata = {
    name: 'Sidebar Top News',
    description: 'Compact list of top/featured news for sidebars',
    category: 'content',
    icon: Sidebar,
    tags: ['news', 'sidebar', 'compact', 'featured'],
    menuItems: []
};

export default eceeeSidebarTopNewsWidget;

