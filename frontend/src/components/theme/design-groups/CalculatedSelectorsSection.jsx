/**
 * Calculated Selectors Section Component
 * 
 * Displays all calculated CSS selectors for a design group in a prominent,
 * easy-to-find section with copy functionality.
 * 
 * Shows:
 * - Base selectors (widget/slot targeting)
 * - Layout part selectors (e.g., .widget-type-header .header-widget)
 * - Element selectors (e.g., .widget-type-header h1)
 */

import React, { useState } from 'react';
import { Code, Copy, Check, ChevronDown, ChevronRight, FileCode } from 'lucide-react';

const CalculatedSelectorsSection = ({ calculatedSelectors }) => {
    const [copiedSelector, setCopiedSelector] = useState(null);
    const [expandedSections, setExpandedSections] = useState({
        base: true,
        layoutParts: true,
        elements: true
    });

    // Early return if no selectors
    if (!calculatedSelectors) {
        return null;
    }

    const { baseSelectors = [], layoutPartSelectors = {}, elementSelectors = {} } = calculatedSelectors;

    // Check if we have any selectors at all
    const hasBaseSelectors = baseSelectors.length > 0;
    const hasLayoutPartSelectors = Object.keys(layoutPartSelectors).length > 0;
    const hasElementSelectors = Object.keys(elementSelectors).length > 0;

    if (!hasBaseSelectors && !hasLayoutPartSelectors && !hasElementSelectors) {
        return null;
    }

    const copyToClipboard = async (text, id) => {
        try {
            await navigator.clipboard.writeText(text);
            setCopiedSelector(id);
            setTimeout(() => setCopiedSelector(null), 2000);
        } catch (err) {
            console.error('Failed to copy:', err);
        }
    };

    const copyAllSelectors = async (selectors, section) => {
        const text = Array.isArray(selectors)
            ? selectors.join('\n')
            : Object.entries(selectors)
                .flatMap(([part, sels]) => sels)
                .join('\n');
        await copyToClipboard(text, `${section}-all`);
    };

    const toggleSection = (section) => {
        setExpandedSections({
            ...expandedSections,
            [section]: !expandedSections[section]
        });
    };

    const SelectorBadge = ({ selector, id, label = null }) => (
        <div className="flex items-center gap-0.5 group mt-3 mb-2">
            {label && (
                <span className="text-sm font-medium text-gray-600 min-w-[70px]">
                    {label}:
                </span>
            )}
            <div className="flex-1 flex items-center gap-0.5">
                <span className="flex-1 px-2 py-1.5 bg-white text-purple-700 text-[10px] font-mono rounded border border-purple-200 break-all leading-tight">
                    {selector || '(global)'}
                </span>
                <button
                    type="button"
                    onClick={() => copyToClipboard(selector, id)}
                    className="p-0.5 bg-white hover:bg-purple-50 text-purple-600 rounded border border-purple-200 transition-colors flex-shrink-0"
                    title="Copy selector"
                >
                    {copiedSelector === id ? (
                        <Check className="w-2 h-2 text-green-600" />
                    ) : (
                        <Copy className="w-2 h-2" />
                    )}
                </button>
            </div>
        </div>
    );

    const SectionHeader = ({ title, count, isExpanded, onToggle, onCopyAll, icon: Icon }) => (
        <div className="flex items-center justify-between mb-0.5">
            <button
                type="button"
                onClick={onToggle}
                className="flex items-center gap-0.5 text-[9px] font-medium text-purple-900 hover:text-purple-700 transition-colors"
            >
                {isExpanded ? (
                    <ChevronDown className="w-2 h-2" />
                ) : (
                    <ChevronRight className="w-2 h-2" />
                )}
                <Icon className="w-2 h-2" />
                <span className="px-0.5 py-0 bg-purple-100 text-purple-700 text-sm rounded leading-none">{title}</span>
                <span className="px-0.5 py-0 bg-purple-100 text-purple-700 text-sm rounded leading-none">
                    {count}
                </span>
            </button>
            {isExpanded && (
                <button
                    type="button"
                    onClick={onCopyAll}
                    className="flex items-center gap-0.5 px-0.5 py-0 text-sm text-purple-700 hover:bg-purple-100 rounded transition-colors"
                    title="Copy all selectors in this section"
                >
                    {copiedSelector && copiedSelector.includes('all') ? (
                        <>
                            <Check className="w-1.5 h-1.5 text-green-600" />
                            <span className="text-green-600">Copied!</span>
                        </>
                    ) : (
                        <>
                            <Copy className="w-1.5 h-1.5" />
                            <span className="text-[12px]">Copy All</span>
                        </>
                    )}
                </button>
            )}
        </div>
    );

    return (
        <div className="bg-gradient-to-br from-purple-50 to-blue-50 border border-purple-200 rounded p-1.5 mt-4">
            {/* Section Title */}
            <div className="flex items-center gap-0.5 mb-1 pb-0.5 border-b border-purple-200">
                <Code className="w-2 h-2 text-purple-700" />
                <span className="text-sm font-medium text-purple-900">
                    Generated CSS Selectors
                </span>
                <span className="text-sm text-purple-600">
                    (for styles.css)
                </span>
            </div>

            <div className="space-y-1">
                {/* Base Selectors */}
                {hasBaseSelectors && (
                    <div className="bg-white/50 rounded p-1.5 border border-purple-100">
                        <SectionHeader
                            title="Base Selectors"
                            count={baseSelectors.length}
                            isExpanded={expandedSections.base}
                            onToggle={() => toggleSection('base')}
                            onCopyAll={() => copyAllSelectors(baseSelectors, 'base')}
                            icon={FileCode}
                        />
                        {expandedSections.base && (
                            <div className="space-y-1 mt-1">
                                {baseSelectors.map((selector, idx) => (
                                    <SelectorBadge
                                        key={idx}
                                        selector={selector}
                                        id={`base-${idx}`}
                                    />
                                ))}
                            </div>
                        )}
                    </div>
                )}

                {/* Layout Part Selectors */}
                {hasLayoutPartSelectors && (
                    <div className="bg-white/50 rounded p-1.5 border border-purple-100">
                        <SectionHeader
                            title="Layout Part Selectors"
                            count={Object.values(layoutPartSelectors).flat().length}
                            isExpanded={expandedSections.layoutParts}
                            onToggle={() => toggleSection('layoutParts')}
                            onCopyAll={() => copyAllSelectors(layoutPartSelectors, 'layoutParts')}
                            icon={FileCode}
                        />
                        {expandedSections.layoutParts && (
                            <div className="space-y-1 mt-1">
                                {Object.entries(layoutPartSelectors).map(([part, selectors]) => (
                                    <div key={part} className="space-y-1">
                                        <div className="text-sm font-medium text-purple-800 uppercase tracking-wide">
                                            {part}
                                        </div>
                                        {selectors.map((selector, idx) => (
                                            <SelectorBadge
                                                key={idx}
                                                selector={selector}
                                                id={`layout-${part}-${idx}`}
                                            />
                                        ))}
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                )}

                {/* Element Selectors */}
                {hasElementSelectors && (
                    <div className="bg-white/50 rounded p-1.5 border border-purple-100">
                        <SectionHeader
                            title="Element Selectors"
                            count={Object.values(elementSelectors).flat().length}
                            isExpanded={expandedSections.elements}
                            onToggle={() => toggleSection('elements')}
                            onCopyAll={() => copyAllSelectors(elementSelectors, 'elements')}
                            icon={FileCode}
                        />
                        {expandedSections.elements && (
                            <div className="space-y-1 mt-1">
                                {Object.entries(elementSelectors).map(([element, selectors]) => (
                                    <div key={element} className="space-y-1">
                                        <div className="text-sm font-medium text-purple-800 uppercase tracking-wide">
                                            {element}
                                        </div>
                                        {selectors.map((selector, idx) => (
                                            <SelectorBadge
                                                key={idx}
                                                selector={selector}
                                                id={`element-${element}-${idx}`}
                                            />
                                        ))}
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                )}
            </div>

            {/* Helper Text */}
            <div className="mt-1 pt-0.5 border-t border-purple-200 text-sm text-purple-600">
                <div className="flex items-center gap-0.5">
                    <span className="text-sm">💡</span>
                    <span>Copy for <span className="px-0.5 py-0 bg-purple-100 rounded text-xs font-mono">styles.css</span></span>
                </div>
            </div>
        </div>
    );
};

export default CalculatedSelectorsSection;

