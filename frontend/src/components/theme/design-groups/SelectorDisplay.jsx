/**
 * Selector Display Component
 * 
 * Displays the first selector with clipping and a popup icon.
 * Clicking the icon opens a popup with all selectors.
 */

import React from 'react';
import { ExternalLink } from 'lucide-react';

const SelectorDisplay = ({ selectors, type = 'breakpoint', onOpenPopup, className = '' }) => {
    if (!selectors || selectors.length === 0) return null;

    const firstSelector = selectors[0] || '(global)';
    const bgColor = type === 'tag' ? 'bg-blue-50 text-blue-600' : 'bg-purple-50 text-purple-600';
    const hoverBgColor = type === 'tag' ? 'hover:bg-blue-100' : 'hover:bg-purple-100';

    return (
        <div className={`inline-flex items-center gap-1 ${className}`}>
            <span className={`inline-block px-1.5 py-0.5 ${bgColor} text-xs font-mono rounded max-w-[200px] truncate`} title={firstSelector}>
                {firstSelector}
            </span>
            <button
                type="button"
                onClick={(e) => {
                    e.stopPropagation();
                    if (onOpenPopup) {
                        onOpenPopup(selectors, { x: e.clientX, y: e.clientY });
                    }
                }}
                className={`inline-flex items-center p-0.5 ${bgColor} ${hoverBgColor} rounded transition-colors`}
                title="View all selectors"
            >
                <ExternalLink className="w-3 h-3" />
            </button>
        </div>
    );
};

export default SelectorDisplay;



