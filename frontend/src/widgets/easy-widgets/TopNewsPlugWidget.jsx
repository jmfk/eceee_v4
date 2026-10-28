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
}) => {
    // Layout descriptions
    const layoutNames = {
        '1x3': 'Three featured news blocks',
        '1x2': 'Two featured news blocks',
    };

    if (mode === 'editor') {
        return (
            <div className="top-news-plug-widget-editor p-6 bg-gray-50 border-2 border-dashed border-gray-300 rounded-lg">
                <div className="text-center">
                    <Layout className="w-12 h-12 mx-auto mb-2 text-gray-400" />
                    <div className="text-lg font-semibold text-gray-700 mb-2">Featured news</div>
                    <div className="text-sm text-gray-500 mb-4">
                        Two or three featured stories from the published news feed
                    </div>
                    <div className="text-xs text-gray-400 space-y-1">
                        {(config.objectTypes || config.object_types)?.length > 0 && (
                            <div>Object Types: {(config.objectTypes || config.object_types).join(', ')}</div>
                        )}
                        {config.layout && (
                            <div>Layout: {layoutNames[config.layout] || config.layout}</div>
                        )}
                        {(config.showExcerpts ?? config.show_excerpts) && <p>Excerpts: Enabled</p>}
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
    objectTypes: ['news'],
    layout: '1x2',
    newsPagePath: '/news/',
    showExcerpts: true,
    excerptLength: 100,
    showPublishDate: true,
    showObjectType: true
};

// Display metadata
TopNewsPlugWidget.metadata = {
    name: 'Featured news',
    description: 'Display two or three featured news blocks',
    category: 'content',
    icon: Layout,
    tags: ['news', 'featured', 'grid', 'homepage', 'top'],
    menuItems: []
};

export default TopNewsPlugWidget;

