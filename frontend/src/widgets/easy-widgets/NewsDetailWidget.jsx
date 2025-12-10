/**
 * EASY News Detail Widget
 * 
 * Displays a single news article based on slug in URL path.
 * Widget type: easy_widgets.NewsDetailWidget
 */

import React from 'react';
import { FileText } from 'lucide-react';

const NewsDetailWidget = ({
    config = {},
    mode = 'display',
    widgetId,
    ...props
}) => {
    if (mode === 'editor') {
        return (
            <div className="news-detail-widget-editor p-6 bg-gray-50 border-2 border-dashed border-gray-300 rounded-lg">
                <div className="text-center">
                    <FileText className="w-12 h-12 mx-auto mb-2 text-gray-400" />
                    <div className="text-lg font-semibold text-gray-700 mb-2">News Detail Widget</div>
                    <div className="text-sm text-gray-500 mb-4">
                        Displays a single news article based on URL slug
                    </div>
                    <div className="text-xs text-gray-400 space-y-1">
                        {config.object_types && config.object_types.length > 0 && (
                            <p>Object Types: {config.object_types.join(', ')}</p>
                        )}
                        {config.slug_variable_name && (
                            <p>Slug Variable: {config.slug_variable_name}</p>
                        )}
                        {config.show_metadata && <p>Metadata: Enabled</p>}
                    </div>
                </div>
            </div>
        );
    }

    // In display mode, this widget is rendered server-side
    return (
        <div className="news-detail-widget" data-widget-id={widgetId}>
            <div className="p-4 text-center text-gray-500">
                News detail will be rendered here
            </div>
        </div>
    );
};

// === METADATA ===
NewsDetailWidget.displayName = 'News Detail';
NewsDetailWidget.widgetType = 'easy_widgets.NewsDetailWidget';

// Default configuration matching backend Pydantic model
NewsDetailWidget.defaultConfig = {
    slug_variable_name: 'news_slug',
    object_types: [],
    show_metadata: true,
    show_featured_image: true,
    show_object_type: true,
    render_object_widgets: true
};

// Display metadata
NewsDetailWidget.metadata = {
    name: 'News Detail',
    description: 'Display a single news article based on slug in URL path (multi-type support)',
    category: 'content',
    icon: FileText,
    tags: ['news', 'detail', 'article', 'content'],
    menuItems: []
};

export default NewsDetailWidget;

