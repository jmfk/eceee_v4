/**
 * EASY Top News Plug Widget
 * 
 * Displays top news in various grid configurations for homepage/landing pages.
 * Widget type: easy_widgets.TopNewsPlugWidget
 */

import React from 'react';
import { Layout } from 'lucide-react';

const TopNewsPlugWidget = ({
    config = {},
    mode = 'display',
    widgetId,
    ...props
}) => {
    // Layout descriptions
    const layoutNames = {
        '1x3': '1 Row × 3 Columns',
        '1x2': '1 Row × 2 Columns',
        '2x3_2': '2 Rows (3+2 columns)',
        '2x1': '2 Rows × 1 Column',
        '2x2': '2 Rows × 2 Columns'
    };

    if (mode === 'editor') {
        return (
            <div className="top-news-plug-widget-editor p-6 bg-gray-50 border-2 border-dashed border-gray-300 rounded-lg">
                <div className="text-center">
                    <Layout className="w-12 h-12 mx-auto mb-2 text-gray-400" />
                    <div className="text-lg font-semibold text-gray-700 mb-2">Top News Plug Widget</div>
                    <div className="text-sm text-gray-500 mb-4">
                        Display top/featured news in configurable grid layouts
                    </div>
                    <div className="text-xs text-gray-400 space-y-1">
                        {config.object_types && config.object_types.length > 0 && (
                            <div>Object Types: {config.object_types.join(', ')}</div>
                        )}
                        {config.layout && (
                            <div>Layout: {layoutNames[config.layout] || config.layout}</div>
                        )}
                        {config.show_excerpts && <p>Excerpts: Enabled</p>}
                    </div>
                </div>
            </div>
        );
    }

    // In display mode, this widget is rendered server-side
    return (
        <div className="top-news-plug-widget" data-widget-id={widgetId}>
            <div className="p-4 text-center text-gray-500">
                Top news grid will be rendered here
            </div>
        </div>
    );
};

// === METADATA ===
TopNewsPlugWidget.displayName = 'Top News Plug';
TopNewsPlugWidget.widgetType = 'easy_widgets.TopNewsPlugWidget';

// Default configuration matching backend Pydantic model
TopNewsPlugWidget.defaultConfig = {
    object_types: ['news'],
    layout: '1x3',
    show_excerpts: true,
    excerpt_length: 100,
    show_publish_date: true,
    show_object_type: true
};

// Display metadata
TopNewsPlugWidget.metadata = {
    name: 'Top News Plug',
    description: 'Display top/featured news in configurable grid layouts',
    category: 'content',
    icon: Layout,
    tags: ['news', 'featured', 'grid', 'homepage', 'top'],
    menuItems: []
};

export default TopNewsPlugWidget;

