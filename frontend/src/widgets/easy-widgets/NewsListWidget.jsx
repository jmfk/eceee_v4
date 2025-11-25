/**
 * EASY News List Widget
 * 
 * Displays a list of news articles from selected ObjectTypes.
 * Widget type: easy_widgets.NewsListWidget
 */

import React, { useEffect, useState } from 'react';
import { Newspaper, Calendar, ArrowRight, Pin } from 'lucide-react';
import { objectInstancesApi } from '../../api';

const NewsListWidget = ({
    config = {},
    mode = 'display',
    widgetId,
    ...props
}) => {
    const [newsItems, setNewsItems] = useState([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);

    // Fetch news items when in display mode
    useEffect(() => {
        if (mode === 'display' && config.objectTypes && config.objectTypes.length > 0) {
            fetchNewsItems();
        }
    }, [mode, config.objectTypes, config.limit, config.sortOrder]);

    const fetchNewsItems = async () => {
        try {
            setLoading(true);
            setError(null);

            const params = {
                limit: config.limit || 10,
                sort_order: config.sortOrder || '-publish_date'
            };

            const response = await objectInstancesApi.getNewsList(config.objectTypes, params);
            setNewsItems(response.results || []);
        } catch (err) {
            console.error('Error fetching news items:', err);
            setError('Failed to load news items');
        } finally {
            setLoading(false);
        }
    };

    const formatDate = (dateString) => {
        if (!dateString) return '';
        const date = new Date(dateString);
        return date.toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'long',
            day: 'numeric'
        });
    };

    const getExcerpt = (item) => {
        const data = item.data || {};
        const maxLength = config.excerptLength || 150;
        const text = data.excerpt || data.summary || data.description || data.content || '';

        if (text.length > maxLength) {
            return text.substring(0, maxLength).trim() + '...';
        }
        return text;
    };

    const getFeaturedImage = (item) => {
        const data = item.data || {};
        return data.featured_image || data.featuredImage;
    };

    const isPinned = (item) => {
        const metadata = item.metadata || {};
        return metadata.pinned || metadata.featured;
    };

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
                        {config.objectTypes && config.objectTypes.length > 0 && (
                            <p>Object Types: {config.objectTypes.join(', ')}</p>
                        )}
                        {config.limit && <p>Limit: {config.limit} items</p>}
                        {config.sortOrder && <p>Sort: {config.sortOrder}</p>}
                        {config.hideOnDetailView && <p>Hidden on detail pages</p>}
                    </div>
                </div>
            </div>
        );
    }

    // Display mode
    if (loading) {
        return (
            <div className="news-list-widget" data-widget-id={widgetId}>
                <div className="p-4 text-center text-gray-500">
                    Loading news items...
                </div>
            </div>
        );
    }

    if (error) {
        return (
            <div className="news-list-widget" data-widget-id={widgetId}>
                <div className="p-4 text-center text-red-500">
                    {error}
                </div>
            </div>
        );
    }

    if (!config.objectTypes || config.objectTypes.length === 0) {
        return (
            <div className="news-list-widget" data-widget-id={widgetId}>
                <div className="p-4 text-center text-gray-500">
                    No object types configured
                </div>
            </div>
        );
    }

    if (newsItems.length === 0) {
        return (
            <div className="news-list-widget" data-widget-id={widgetId}>
                <div className="p-4 text-center text-gray-500">
                    No news articles available at this time.
                </div>
            </div>
        );
    }

    return (
        <div className="news-list-widget cms-content" data-widget-id={widgetId}>
            <div className="news-items-container">
                {newsItems.map((item) => {
                    const featuredImage = config.showFeaturedImage ? getFeaturedImage(item) : null;
                    const pinned = isPinned(item);

                    return (
                        <article
                            key={item.id}
                            className={`news-item ${pinned ? 'pinned' : ''}`}
                            data-object-id={item.id}
                        >
                            {featuredImage && (
                                <div className="news-featured-image">
                                    <img
                                        src={featuredImage}
                                        alt={item.title}
                                        loading="lazy"
                                    />
                                </div>
                            )}

                            <div className="news-content">
                                <div className="news-meta">
                                    <span className="news-type">
                                        {item.object_type?.label || item.object_type?.name}
                                    </span>
                                    {pinned && (
                                        <span className="pinned-badge">
                                            <Pin size={12} />
                                            Pinned
                                        </span>
                                    )}
                                    {config.showPublishDate && item.publish_date && (
                                        <time className="news-date" dateTime={item.publish_date}>
                                            <Calendar size={14} className="inline mr-1" />
                                            {formatDate(item.publish_date)}
                                        </time>
                                    )}
                                </div>

                                <h3 className="news-title">
                                    <a href={`/${item.object_type?.name}/${item.slug}/`}>
                                        {item.title}
                                    </a>
                                </h3>

                                {config.showExcerpts && (
                                    <div className="news-excerpt">
                                        {getExcerpt(item)}
                                    </div>
                                )}

                                <div className="news-footer">
                                    <a
                                        href={`/${item.object_type?.name}/${item.slug}/`}
                                        className="read-more"
                                    >
                                        Read more <ArrowRight size={14} className="inline ml-1" />
                                    </a>
                                </div>
                            </div>
                        </article>
                    );
                })}
            </div>
        </div>
    );
};

// === METADATA ===
NewsListWidget.displayName = 'News List';
NewsListWidget.widgetType = 'easy_widgets.NewsListWidget';

// Default configuration matching backend Pydantic model (camelCase)
NewsListWidget.defaultConfig = {
    objectTypes: [],
    limit: 10,
    sortOrder: '-publish_date',
    hideOnDetailView: false,
    showExcerpts: true,
    excerptLength: 150,
    showFeaturedImage: true,
    showPublishDate: true
};

// Display metadata
NewsListWidget.metadata = {
    name: 'News List',
    description: 'Display a list of news articles from selected ObjectTypes',
    category: 'content',
    icon: Newspaper,
    tags: ['news', 'list', 'content', 'articles'],
    menuItems: []
};

export default NewsListWidget;

