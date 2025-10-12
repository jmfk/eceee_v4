/**
 * ECEEE News List Widget
 * 
 * Displays a list of news articles from selected ObjectTypes.
 * Widget type: eceee_widgets.NewsListWidget
 */

import React from 'react';
import { Newspaper } from 'lucide-react';

const eceeeNewsListWidget = ({
    config = {},
    mode = 'display',
    widgetId,
    ...props
}) => {
    if (mode === 'editor') {
        return (
            <div className="news-list-widget-editor p-6 bg-gray-50 border-2 border-dashed border-gray-300 rounded-lg">
                <div className="text-center">
                    <Newspaper className="w-12 h-12 mx-auto mb-2 text-gray-400" />
                    <h3 className="text-lg font-semibold text-gray-700 mb-2">News List Widget</h3>
                    <p className="text-sm text-gray-500 mb-4">
                        Displays a list of news articles from selected ObjectTypes
                    </p>
                    <div className="text-xs text-gray-400 space-y-1">
                        {config.object_types && config.object_types.length > 0 && (
                            <p>Object Types: {config.object_types.join(', ')}</p>
                        )}
                        {config.limit && <p>Limit: {config.limit} items</p>}
                        {config.hide_on_detail_view && <p>Hidden on detail pages</p>}
                    </div>
                </div>
            </div>
        );
    }

    // In display mode, this widget is rendered server-side
    return (
        <div className="news-list-widget" data-widget-id={widgetId}>
            <div className="p-4 text-center text-gray-500">
                News list will be rendered here
            </div>
        </div>
    );
};

// === METADATA ===
eceeeNewsListWidget.displayName = 'News List';
eceeeNewsListWidget.widgetType = 'eceee_widgets.NewsListWidget';

// Default configuration matching backend Pydantic model
eceeeNewsListWidget.defaultConfig = {
    object_types: ['news'],
    limit: 10,
    hide_on_detail_view: false,
    show_excerpts: true,
    excerpt_length: 150,
    show_featured_image: true,
    show_publish_date: true
};

// Display metadata
eceeeNewsListWidget.metadata = {
    name: 'News List',
    description: 'Display a list of news articles from selected ObjectTypes',
    category: 'content',
    icon: Newspaper,
    tags: ['news', 'list', 'content', 'articles'],
    menuItems: []
};

export default eceeeNewsListWidget;

