/**
 * EASY Sidebar Top News Widget
 * 
 * Compact vertical list of top news for sidebar placement.
 * Widget type: easy_widgets.SidebarTopNewsWidget
 */

import React from 'react';
import { Sidebar } from 'lucide-react';

const SidebarTopNewsWidget = ({
    config = {},
    mode = 'display',
    widgetId,
}) => {
    if (mode === 'editor') {
        return (
            <div className="sidebar-top-news-widget-editor p-6 bg-gray-50 border-2 border-dashed border-gray-300 rounded-lg">
                <div className="text-center">
                    <Sidebar className="w-12 h-12 mx-auto mb-2 text-gray-400" />
                    <div className="text-lg font-semibold text-gray-700 mb-2">Latest news</div>
                    <div className="text-sm text-gray-500 mb-4">
                        Latest published stories in the header or page content
                    </div>
                    <div className="text-xs text-gray-400 space-y-1">
                        {(config.widgetTitle || config.widget_title) && <p>Title: {config.widgetTitle || config.widget_title}</p>}
                        {(config.objectTypes || config.object_types)?.length > 0 && (
                            <p>Object Types: {(config.objectTypes || config.object_types).join(', ')}</p>
                        )}
                        {config.limit && <p>Limit: {config.limit} items</p>}
                        <p>Placement: {config.displayVariant || config.display_variant || 'content'}</p>
                        {(config.showThumbnails ?? config.show_thumbnails) && <p>Thumbnails: Enabled</p>}
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
SidebarTopNewsWidget.displayName = 'Sidebar Top News';
SidebarTopNewsWidget.widgetType = 'easy_widgets.SidebarTopNewsWidget';

// Default configuration matching backend Pydantic model
SidebarTopNewsWidget.defaultConfig = {
    objectTypes: ['news'],
    limit: 5,
    displayVariant: 'content',
    newsPagePath: '/news/',
    showThumbnails: true,
    showDates: true,
    showObjectType: false,
    widgetTitle: 'Latest News'
};

// Display metadata
SidebarTopNewsWidget.metadata = {
    name: 'Latest news',
    description: 'Latest published news for header or content',
    category: 'content',
    icon: Sidebar,
    tags: ['news', 'header', 'content', 'latest'],
    menuItems: []
};

export default SidebarTopNewsWidget;

