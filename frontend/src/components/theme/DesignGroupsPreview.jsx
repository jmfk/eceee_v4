/**
 * Design Groups Preview Component
 * 
 * Shows live preview of all HTML elements with current design group styling.
 */

import React, { useMemo, useState } from 'react';
import { generateDesignGroupsCSS, generateColorsCSS } from '../../utils/themeUtils';

const DesignGroupsPreview = ({ designGroups, colors, widgetType = null, slot = null }) => {
    const groups = designGroups?.groups || [];
    const [selectedGroupIndex, setSelectedGroupIndex] = useState('all');

    // Generate CSS for the preview
    const previewCSS = useMemo(() => {
        const colorCSS = generateColorsCSS(colors || {}, ':root');

        // Filter to selected group if not "all"
        const filteredDesignGroups = selectedGroupIndex === 'all'
            ? designGroups
            : { groups: [groups[selectedGroupIndex]] };

        const designGroupsCSS = generateDesignGroupsCSS(
            filteredDesignGroups || {},
            colors || {},
            '',  // No scope - use data attributes
            widgetType,
            slot
        );

        return `${colorCSS}\n\n${designGroupsCSS}`;
    }, [designGroups, groups, selectedGroupIndex, colors, widgetType, slot]);

    return (
        <div className="design-groups-preview-container">
            <style>{previewCSS}</style>

            {/* Group Selector */}
            {groups.length > 1 && (
                <div className="mb-4">
                    <label htmlFor="group-selector" className="block text-sm font-medium text-gray-700 mb-2">
                        Preview Group
                    </label>
                    <select
                        id="group-selector"
                        value={selectedGroupIndex}
                        onChange={(e) => setSelectedGroupIndex(e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    >
                        <option value="all">All Groups</option>
                        {groups.map((group, index) => (
                            <option key={index} value={index}>
                                {group.name || `Group ${index + 1}`}
                            </option>
                        ))}
                    </select>
                </div>
            )}

            <div
                className="design-groups-preview default bg-white border border-gray-300 rounded-lg p-6 space-y-4"
                data-widget-type="text_block"
                data-slot-name="preview"
            >
                <h1>Heading 1 - The Quick Brown Fox</h1>
                <h2>Heading 2 - Jumps Over the Lazy Dog</h2>
                <h3>Heading 3 - Typography Preview</h3>
                <h4>Heading 4 - Font Styling Examples</h4>
                <h5>Heading 5 - Smaller Heading</h5>
                <h6>Heading 6 - Smallest Heading</h6>

                <p>
                    This is a paragraph with some <strong>bold text</strong> and <em>italic text</em>.
                    Here's a <a href="#" onClick={(e) => e.preventDefault()}>link to somewhere</a> in the text.
                </p>

                <p>
                    Paragraphs can contain multiple sentences. This helps demonstrate line height,
                    letter spacing, and other typography properties that affect readability and
                    visual hierarchy in your content.
                </p>

                <ul>
                    <li>Unordered list item one</li>
                    <li>Unordered list item two with more content</li>
                    <li>Unordered list item three</li>
                </ul>

                <ol>
                    <li>Ordered list item one</li>
                    <li>Ordered list item two with more content</li>
                    <li>Ordered list item three</li>
                </ol>

                <blockquote>
                    This is a blockquote element. It's typically used for quotes or callouts
                    that need to stand out from the regular content.
                </blockquote>

                <p>
                    Here's some <code>inline code</code> within a paragraph, and below is a code block:
                </p>

                <pre><code>{`function example() {
  return "Hello, World!";
}`}</code></pre>
            </div>
        </div>
    );
};

export default DesignGroupsPreview;

