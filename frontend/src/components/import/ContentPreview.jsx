/**
 * ContentPreview - Preview imported content with widget and media details
 * 
 * Shows:
 * - Widget count (content and table widgets)
 * - Media items with thumbnails and tags
 * - HTML preview with theme fonts
 */

import React, { useState, useEffect } from 'react';
import { Check, X } from 'lucide-react';

const ContentPreview = ({ html, mediaItems = [], currentTheme = null }) => {
    const [widgetStats, setWidgetStats] = useState({
        contentWidgets: 0,
        tableWidgets: 0,
    });
    const [excludedElements, setExcludedElements] = useState(new Set());

    useEffect(() => {
        if (html) {
            analyzeContent(html);
        }
    }, [html]);

    const analyzeContent = (htmlString) => {
        const parser = new DOMParser();
        const doc = parser.parseFromString(htmlString, 'text/html');

        const stats = {
            contentWidgets: 0,
            tableWidgets: 0,
        };

        // Simulate backend parsing logic:
        // 1. Each table becomes a separate widget
        // 2. Text content between tables is merged into single content widgets

        // Get all tables and content elements in order
        const allElements = Array.from(doc.body.querySelectorAll('h1, h2, h3, h4, h5, h6, p, blockquote, ul, ol, pre, table'));

        let inContentBlock = false;
        let contentBlockCount = 0;

        allElements.forEach(el => {
            if (el.tagName.toLowerCase() === 'table') {
                // Table breaks content blocks
                if (inContentBlock) {
                    contentBlockCount++;
                    inContentBlock = false;
                }
                stats.tableWidgets++;
            } else {
                // Text content - check if it has meaningful content
                const text = el.textContent.trim();
                if (text.length > 20) {
                    inContentBlock = true;
                }
            }
        });

        // Close final content block if exists
        if (inContentBlock) {
            contentBlockCount++;
        }

        stats.contentWidgets = contentBlockCount;

        setWidgetStats(stats);
    };

    const highlightHtml = () => {
        if (!html) return '';

        const parser = new DOMParser();
        const doc = parser.parseFromString(html, 'text/html');

        // Highlight tables (blue)
        doc.querySelectorAll('table').forEach((table, index) => {
            const wrapper = doc.createElement('div');
            wrapper.className = 'border-2 border-blue-500 bg-blue-50 p-2 my-2 relative';
            wrapper.dataset.type = 'table';
            wrapper.dataset.index = index;

            const label = doc.createElement('div');
            label.className = 'text-xs font-semibold text-blue-700 mb-1';
            label.textContent = '📊 Table';

            table.parentNode.insertBefore(wrapper, table);
            wrapper.appendChild(label);
            wrapper.appendChild(table);
        });

        // Highlight images (yellow)
        doc.querySelectorAll('img').forEach((img, index) => {
            const wrapper = doc.createElement('div');
            wrapper.className = 'border-2 border-yellow-500 bg-yellow-50 p-2 my-2 inline-block';
            wrapper.dataset.type = 'image';
            wrapper.dataset.index = index;

            const label = doc.createElement('div');
            label.className = 'text-xs font-semibold text-yellow-700 mb-1';
            label.textContent = '🖼️ Image';

            img.parentNode.insertBefore(wrapper, img);
            wrapper.appendChild(label);
            wrapper.appendChild(img);
        });

        // Highlight file links (purple)
        const fileExtensions = ['.pdf', '.doc', '.docx', '.xls', '.xlsx', '.ppt', '.pptx', '.zip'];
        doc.querySelectorAll('a[href]').forEach((link, index) => {
            const href = link.getAttribute('href').toLowerCase();
            if (fileExtensions.some(ext => href.endsWith(ext))) {
                link.className = (link.className || '') + ' border-2 border-purple-500 bg-purple-50 px-2 py-1 text-purple-700 font-semibold';
                link.dataset.type = 'file';
                link.dataset.index = index;
            }
        });

        return doc.body.innerHTML;
    };

    // Separate media items by type
    const imageItems = mediaItems.filter(item => item.type === 'image' && item.status === 'success');
    const fileItems = mediaItems.filter(item => item.type === 'file' && item.status === 'success');

    // Get theme font settings
    const themeFonts = currentTheme?.fonts || {};
    const headingFont = themeFonts.headingFont || themeFonts.primaryFont || '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';
    const bodyFont = themeFonts.bodyFont || themeFonts.primaryFont || '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';

    return (
        <div className="content-preview">
            {/* Widget Statistics */}
            <div className="mb-4 p-4 bg-gray-50 rounded-lg">
                <h4 className="text-sm font-semibold text-gray-900 mb-3">Widgets to Create:</h4>
                <div className="grid grid-cols-2 gap-3 text-sm">
                    <div className="flex items-center bg-white p-3 rounded border border-gray-200">
                        <span className="text-2xl mr-3">📝</span>
                        <div>
                            <div className="font-semibold text-gray-900">{widgetStats.contentWidgets}</div>
                            <div className="text-xs text-gray-600">Content Widget{widgetStats.contentWidgets !== 1 ? 's' : ''}</div>
                        </div>
                    </div>
                    <div className="flex items-center bg-white p-3 rounded border border-gray-200">
                        <span className="text-2xl mr-3">📊</span>
                        <div>
                            <div className="font-semibold text-gray-900">{widgetStats.tableWidgets}</div>
                            <div className="text-xs text-gray-600">Table Widget{widgetStats.tableWidgets !== 1 ? 's' : ''}</div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Media Items with Thumbnails */}
            {(imageItems.length > 0 || fileItems.length > 0) && (
                <div className="mb-4 p-4 bg-gray-50 rounded-lg">
                    <h4 className="text-sm font-semibold text-gray-900 mb-3">Uploaded Media:</h4>

                    {/* Images */}
                    {imageItems.length > 0 && (
                        <div className="mb-3">
                            <h5 className="text-xs font-semibold text-gray-700 mb-2">Images ({imageItems.length}):</h5>
                            <div className="space-y-2 max-h-64 overflow-y-auto">
                                {imageItems.map((item, idx) => (
                                    <div key={idx} className="bg-white p-2 rounded border border-gray-200 flex items-start gap-3">
                                        {/* Thumbnail */}
                                        <div className="w-16 h-16 bg-gray-100 rounded flex-shrink-0 overflow-hidden">
                                            {item.id && (
                                                <img
                                                    src={item.id}
                                                    alt={item.title || item.filename}
                                                    className="w-full h-full object-cover"
                                                    onError={(e) => {
                                                        e.target.style.display = 'none';
                                                        e.target.parentElement.innerHTML = '<div class="w-full h-full flex items-center justify-center text-2xl">🖼️</div>';
                                                    }}
                                                />
                                            )}
                                        </div>

                                        {/* Details */}
                                        <div className="flex-1 min-w-0">
                                            <div className="font-medium text-sm text-gray-900 truncate">
                                                {item.title || item.filename}
                                            </div>
                                            {item.description && (
                                                <div className="text-xs text-gray-600 truncate">
                                                    {item.description}
                                                </div>
                                            )}
                                            {item.tags && item.tags.length > 0 && (
                                                <div className="mt-1 flex flex-wrap gap-1">
                                                    {item.tags.map((tag, tidx) => (
                                                        <span
                                                            key={tidx}
                                                            className="text-[10px] bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded"
                                                        >
                                                            {tag}
                                                        </span>
                                                    ))}
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Files */}
                    {fileItems.length > 0 && (
                        <div>
                            <h5 className="text-xs font-semibold text-gray-700 mb-2">Files ({fileItems.length}):</h5>
                            <div className="space-y-2 max-h-64 overflow-y-auto">
                                {fileItems.map((item, idx) => (
                                    <div key={idx} className="bg-white p-2 rounded border border-gray-200 flex items-start gap-3">
                                        {/* Icon */}
                                        <div className="w-16 h-16 bg-purple-50 rounded flex-shrink-0 flex items-center justify-center">
                                            <span className="text-3xl">📎</span>
                                        </div>

                                        {/* Details */}
                                        <div className="flex-1 min-w-0">
                                            <div className="font-medium text-sm text-gray-900 truncate">
                                                {item.title || item.filename}
                                            </div>
                                            {item.description && (
                                                <div className="text-xs text-gray-600 truncate">
                                                    {item.description}
                                                </div>
                                            )}
                                            {item.tags && item.tags.length > 0 && (
                                                <div className="mt-1 flex flex-wrap gap-1">
                                                    {item.tags.map((tag, tidx) => (
                                                        <span
                                                            key={tidx}
                                                            className="text-[10px] bg-purple-100 text-purple-700 px-1.5 py-0.5 rounded"
                                                        >
                                                            {tag}
                                                        </span>
                                                    ))}
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            )}

            {/* Preview */}
            <div className="border border-gray-300 rounded-lg p-4 max-h-96 overflow-y-auto bg-white">
                <style>{`
                    .content-preview-html * {
                        background: white !important;
                        background-color: white !important;
                        background-image: none !important;
                        box-shadow: none !important;
                        border-radius: 0 !important;
                    }
                    .content-preview-html {
                        font-family: ${bodyFont} !important;
                        line-height: 1.6 !important;
                        color: #333 !important;
                    }
                    .content-preview-html h1, 
                    .content-preview-html h2, 
                    .content-preview-html h3, 
                    .content-preview-html h4, 
                    .content-preview-html h5, 
                    .content-preview-html h6 {
                        font-family: ${headingFont} !important;
                        color: #111 !important;
                        margin: 1em 0 0.5em !important;
                        font-weight: bold !important;
                    }
                    .content-preview-html p, 
                    .content-preview-html li {
                        margin: 0.5em 0 !important;
                        color: #333 !important;
                    }
                    .content-preview-html img {
                        max-width: 100% !important;
                        height: auto !important;
                        display: block !important;
                        margin: 1em 0 !important;
                    }
                    .content-preview-html table {
                        border-collapse: collapse !important;
                        width: 100% !important;
                        margin: 1em 0 !important;
                    }
                    .content-preview-html th, 
                    .content-preview-html td {
                        border: 1px solid #ddd !important;
                        padding: 8px !important;
                        text-align: left !important;
                        color: #333 !important;
                    }
                    .content-preview-html th {
                        background-color: #f5f5f5 !important;
                        font-weight: bold !important;
                    }
                    .content-preview-html a {
                        color: #2563eb !important;
                        text-decoration: underline !important;
                    }
                `}</style>
                <div
                    className="content-preview-html"
                    dangerouslySetInnerHTML={{ __html: highlightHtml() }}
                />
            </div>
        </div>
    );
};

export default ContentPreview;

