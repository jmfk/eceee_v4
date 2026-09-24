/**
 * Design Groups Preview Component
 * 
 * Shows live preview of all HTML elements with current design group styling.
 */

import React, { useMemo, useState } from 'react';
import { generateDesignGroupsCSS, generateColorsCSS, mergeGroupElements, getBreakpoints } from '../../utils/themeUtils';

const DesignGroupsPreview = ({ designGroups, colors, widgetType = null, slot = null, breakpoints = null }) => {
    const groups = useMemo(() => designGroups?.groups || [], [designGroups?.groups]);
    const [selectedGroupIndex, setSelectedGroupIndex] = useState(0);

    // Generate CSS for the preview
    const previewCSS = useMemo(() => {
        const previewScope = '.design-groups-preview';
        const colorCSS = generateColorsCSS(colors || {}, previewScope);

        // Find the default group (marked with isDefault: true)
        const defaultGroup = groups.find(g => g.isDefault === true);
        const selectedGroup = groups[selectedGroupIndex];

        // Merge default group elements with selected group elements
        let mergedElements = {};
        if (defaultGroup && selectedGroup && defaultGroup !== selectedGroup) {
            // Merge default + selected
            mergedElements = mergeGroupElements(
                defaultGroup.elements || {},
                selectedGroup.elements || {}
            );
        } else if (selectedGroup) {
            // Only selected group
            mergedElements = selectedGroup.elements || {};
        }

        // Create a temporary group with merged elements for CSS generation
        const mergedGroup = {
            name: selectedGroup?.name || 'Preview',
            className: selectedGroup?.className || 'default',
            elements: mergedElements,
            widgetTypes: [],
            slots: []
        };

        // Get breakpoints (with defaults if not provided)
        const bps = breakpoints || getBreakpoints(null);

        const designGroupsCSS = generateDesignGroupsCSS(
            { groups: [mergedGroup] },
            colors || {},
            previewScope,
            widgetType,
            slot,
            false, // frontendScoped
            bps    // Pass breakpoints
        );

        return `${colorCSS}\n\n${designGroupsCSS}`;
    }, [groups, selectedGroupIndex, colors, widgetType, slot, breakpoints]);

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
                        onChange={(e) => setSelectedGroupIndex(Number(e.target.value))}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    >
                        {groups.map((group, index) => (
                            <option key={index} value={index}>
                                {group.name || `Group ${index + 1}`}
                                {group.targetingMode === 'css-classes' && group.targetCssClasses ? ' (CSS)' : ''}
                            </option>
                        ))}
                    </select>

                    {/* Show targeting info for selected group */}
                    {groups[selectedGroupIndex] && (
                        <div className="mt-2 text-xs text-gray-600">
                            {groups[selectedGroupIndex].targetingMode === 'css-classes' && groups[selectedGroupIndex].targetCssClasses ? (
                                <div className="flex items-start gap-2">
                                    <span className="font-medium">CSS Targeting:</span>
                                    <code className="flex-1 bg-gray-100 px-2 py-1 rounded font-mono text-xs">
                                        {groups[selectedGroupIndex].targetCssClasses.split(/[\n,]/).filter(Boolean).join(', ')}
                                    </code>
                                </div>
                            ) : (
                                <div>
                                    <span className="font-medium">Widget/Slot Targeting</span>
                                </div>
                            )}
                        </div>
                    )}
                </div>
            )}

            <div
                className={`design-groups-preview ${groups[selectedGroupIndex]?.className || 'default'} bg-white border border-gray-300 rounded-lg p-6 space-y-4`}
                {...(widgetType && { 'data-widget-type': widgetType })}
                {...(slot && { 'data-slot-name': slot })}
            >
                <h1 className="text-4xl font-semibold mb-6">Heading 1 - The Quick Brown Fox</h1>
                <h2 className="text-3xl font-medium mb-6">Heading 2 - Jumps Over the Lazy Dog</h2>
                <h3 className="text-2xl font-bold mb-6">Heading 3 - Typography Preview</h3>
                <h4 className="text-xl font-semibold mb-4">Heading 4 - Font Styling Examples</h4>
                <h5 className="text-lg font-semibold mb-4">Heading 5 - Smaller Heading</h5>
                <h6 className="text-base font-semibold mb-4">Heading 6 - Smallest Heading</h6>

                <p className="text-base font-light mb-6">
                    This is a paragraph with some <span className="font-bold">bold text</span> and <span className="italic">italic text</span>.
                    Here's a <a href="#" onClick={(e) => e.preventDefault()}>link to somewhere</a> in the text.
                </p>

                <p className="text-base font-light mb-6">
                    Paragraphs can contain multiple sentences. This helps demonstrate line height,
                    letter spacing, and other typography properties that affect readability and
                    visual hierarchy in your content.
                </p>

                <ul className="mb-6 pl-6">
                    <li className="mb-2 list-item list-disc">Unordered list item one</li>
                    <li className="mb-2 list-item list-disc">Unordered list item two with more content</li>
                    <li className="mb-2 list-item list-disc">Unordered list item three</li>
                </ul>

                <ol className="mb-6 pl-6">
                    <li className="mb-2 list-item list-decimal">Ordered list item one</li>
                    <li className="mb-2 list-item list-decimal">Ordered list item two with more content</li>
                    <li className="mb-2 list-item list-decimal">Ordered list item three</li>
                </ol>

                <blockquote className="border-l-4 border-blue-500 pl-4 my-6 italic">
                    This is a blockquote element. It's typically used for quotes or callouts
                    that need to stand out from the regular content.
                </blockquote>

                <p className="text-base font-light mb-6">
                    Here's some <code className="font-mono text-sm bg-gray-100 px-1 py-0.5 rounded">inline code</code> within a paragraph, and below is a code block:
                </p>

                <pre className="bg-gray-100 p-4 rounded overflow-x-auto font-mono text-sm">{`function example() {
  return "Hello, World!";
}`}</pre>
            </div>
        </div>
    );
};

export default DesignGroupsPreview;
