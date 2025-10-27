/**
 * ContentPreview - Preview imported content with type highlights
 * 
 * Displays HTML content and highlights different content types:
 * - Green: Text/HTML blocks
 * - Blue: Tables
 * - Yellow: Images
 * - Purple: File links
 */

import React, { useState, useEffect } from 'react';
import { Check, X } from 'lucide-react';

const ContentPreview = ({ html, onContentChange }) => {
    const [contentStats, setContentStats] = useState({
        contentBlocks: 0,
        tables: 0,
        images: 0,
        files: 0,
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
            contentBlocks: 0,
            tables: 0,
            images: 0,
            files: 0,
        };

        // Count content blocks (substantial text)
        const textBlocks = doc.querySelectorAll('p, h1, h2, h3, h4, h5, h6, blockquote, div');
        textBlocks.forEach(el => {
            if (el.textContent.trim().length > 20) {
                stats.contentBlocks++;
            }
        });

        // Count tables
        stats.tables = doc.querySelectorAll('table').length;

        // Count images
        stats.images = doc.querySelectorAll('img').length;

        // Count file links
        const links = doc.querySelectorAll('a[href]');
        const fileExtensions = ['.pdf', '.doc', '.docx', '.xls', '.xlsx', '.ppt', '.pptx', '.zip'];
        links.forEach(link => {
            const href = link.getAttribute('href').toLowerCase();
            if (fileExtensions.some(ext => href.endsWith(ext))) {
                stats.files++;
            }
        });

        setContentStats(stats);
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

    return (
        <div className="content-preview">
            {/* Statistics */}
            <div className="mb-4 p-4 bg-gray-50 rounded-lg">
                <h4 className="text-sm font-semibold text-gray-900 mb-2">Content Summary:</h4>
                <div className="grid grid-cols-2 gap-2 text-sm">
                    <div className="flex items-center">
                        <span className="inline-block w-4 h-4 bg-green-500 rounded mr-2"></span>
                        <span>{contentStats.contentBlocks} text blocks</span>
                    </div>
                    <div className="flex items-center">
                        <span className="inline-block w-4 h-4 bg-blue-500 rounded mr-2"></span>
                        <span>{contentStats.tables} tables</span>
                    </div>
                    <div className="flex items-center">
                        <span className="inline-block w-4 h-4 bg-yellow-500 rounded mr-2"></span>
                        <span>{contentStats.images} images</span>
                    </div>
                    <div className="flex items-center">
                        <span className="inline-block w-4 h-4 bg-purple-500 rounded mr-2"></span>
                        <span>{contentStats.files} files</span>
                    </div>
                </div>
            </div>

            {/* Preview */}
            <div className="border border-gray-300 rounded-lg p-4 max-h-96 overflow-y-auto bg-white">
                <div
                    className="prose max-w-none"
                    dangerouslySetInnerHTML={{ __html: highlightHtml() }}
                />
            </div>

            {/* Legend */}
            <div className="mt-3 text-xs text-gray-600">
                <span className="font-semibold">Legend:</span>
                {' '}
                <span className="text-green-700">Green = Text</span>
                {' • '}
                <span className="text-blue-700">Blue = Tables</span>
                {' • '}
                <span className="text-yellow-700">Yellow = Images</span>
                {' • '}
                <span className="text-purple-700">Purple = Files</span>
            </div>
        </div>
    );
};

export default ContentPreview;

