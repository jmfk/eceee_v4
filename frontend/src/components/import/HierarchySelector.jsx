/**
 * HierarchySelector - Display and select from element hierarchy
 * 
 * Shows parent elements in a list with statistics, allowing users to choose
 * the correct container level for import. Provides hover feedback to iframe.
 */

import React, { useState, useEffect } from 'react';
import { Loader } from 'lucide-react';

const HierarchySelector = ({
    hierarchy,
    selectedIndex,
    onSelect,
    onHover,
    onClearHover,
    stats = [],
    isLoadingStats = false
}) => {
    const [hoveredIndex, setHoveredIndex] = useState(null);

    const handleMouseEnter = (index) => {
        setHoveredIndex(index);
        if (onHover) {
            onHover(index);
        }
    };

    const handleMouseLeave = () => {
        setHoveredIndex(null);
        if (onClearHover) {
            onClearHover();
        }
    };

    const handleSelect = (index) => {
        if (onSelect) {
            onSelect(index);
        }
    };

    const formatElementLabel = (element) => {
        let label = `<${element.tagName}>`;

        if (element.id) {
            label += `#${element.id}`;
        }

        if (element.classes) {
            const classList = element.classes.split(' ').filter(c => c.trim());
            if (classList.length > 0) {
                label += `.${classList.slice(0, 2).join('.')}`;
                if (classList.length > 2) {
                    label += '...';
                }
            }
        }

        return label;
    };

    const formatStatsSummary = (element, stat) => {
        if (!stat) {
            // Use quick stats from iframe if detailed stats not loaded
            if (element.quickStats) {
                const { textBlocks, images, tables, files } = element.quickStats;
                const parts = [];
                if (textBlocks > 0) parts.push(`${textBlocks} text`);
                if (images > 0) parts.push(`${images} img`);
                if (tables > 0) parts.push(`${tables} table`);
                if (files > 0) parts.push(`${files} file`);
                return parts.join(', ') || 'No content';
            }
            return 'Analyzing...';
        }

        return stat.summary || 'No content';
    };

    const getDetailedStats = (stat) => {
        if (!stat) return null;

        const details = [];

        // Headings breakdown
        if (stat.headings && Object.keys(stat.headings).length > 0) {
            const headingStr = Object.entries(stat.headings)
                .map(([tag, count]) => `${count} ${tag}`)
                .join(', ');
            details.push(`Headings: ${headingStr}`);
        }

        // Lists
        if (stat.lists > 0) {
            details.push(`${stat.lists} list${stat.lists !== 1 ? 's' : ''}`);
        }

        // Text length
        if (stat.total_text_length > 0) {
            const chars = stat.total_text_length;
            if (chars > 1000) {
                details.push(`~${Math.round(chars / 1000)}k chars`);
            } else {
                details.push(`${chars} chars`);
            }
        }

        // Child containers
        if (stat.child_containers > 0) {
            details.push(`${stat.child_containers} containers`);
        }

        return details.length > 0 ? details.join(' • ') : null;
    };

    if (!hierarchy || hierarchy.length === 0) {
        return (
            <div className="text-sm text-gray-500 p-4 text-center">
                Click on an element to see hierarchy
            </div>
        );
    }

    return (
        <div className="hierarchy-selector h-full flex flex-col">
            <div className="flex-shrink-0 text-xs font-semibold text-gray-700 uppercase tracking-wide px-3 py-2 bg-white border-b border-gray-200">
                Select Container Level {isLoadingStats && (
                    <span className="ml-2 inline-flex items-center text-blue-600">
                        <Loader className="h-3 w-3 animate-spin mr-1" />
                        Analyzing...
                    </span>
                )}
            </div>

            <div className="space-y-1 overflow-y-auto flex-1 p-2">
                {hierarchy.map((element, index) => {
                    const stat = stats[index];
                    const isSelected = index === selectedIndex;
                    const isHovered = index === hoveredIndex;
                    const details = getDetailedStats(stat);

                    return (
                        <div
                            key={index}
                            className={`
                                p-3 border rounded-lg cursor-pointer transition-all
                                ${isSelected
                                    ? 'border-green-500 bg-green-50 ring-2 ring-green-200'
                                    : isHovered
                                        ? 'border-blue-400 bg-blue-50'
                                        : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                                }
                            `}
                            onMouseEnter={() => handleMouseEnter(index)}
                            onMouseLeave={handleMouseLeave}
                            onClick={() => handleSelect(index)}
                        >
                            <div className="flex items-start justify-between">
                                <div className="flex-1 min-w-0">
                                    {/* Element label */}
                                    <div className="flex items-center gap-2 mb-1">
                                        <span className={`
                                            font-mono text-sm font-medium
                                            ${isSelected ? 'text-green-700' : 'text-gray-900'}
                                        `}>
                                            {formatElementLabel(element)}
                                        </span>
                                        {isSelected && (
                                            <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-green-100 text-green-800">
                                                Selected
                                            </span>
                                        )}
                                    </div>

                                    {/* Stats summary */}
                                    <div className="text-xs text-gray-600 mb-1">
                                        {formatStatsSummary(element, stat)}
                                    </div>

                                    {/* Detailed stats */}
                                    {details && (
                                        <div className="text-xs text-gray-500">
                                            {details}
                                        </div>
                                    )}
                                </div>

                                {/* Selection indicator */}
                                <div className="ml-2 flex-shrink-0">
                                    <div className={`
                                        w-5 h-5 rounded-full border-2 flex items-center justify-center
                                        ${isSelected
                                            ? 'border-green-500 bg-green-500'
                                            : 'border-gray-300'
                                        }
                                    `}>
                                        {isSelected && (
                                            <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 20 20">
                                                <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                                            </svg>
                                        )}
                                    </div>
                                </div>
                            </div>
                        </div>
                    );
                })}
            </div>

            {/* Help text */}
            <div className="flex-shrink-0 px-3 py-2 bg-blue-50 border-t border-blue-200 text-xs text-blue-700">
                <strong>Tip:</strong> Hover to preview, click to select. Drag the left border to resize this panel.
            </div>
        </div>
    );
};

export default HierarchySelector;

