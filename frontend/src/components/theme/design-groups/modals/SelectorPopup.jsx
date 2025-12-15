/**
 * Selector Popup Component
 * 
 * Popup showing list of CSS selectors when there are multiple selectors.
 * Positioned at click location with overflow handling.
 * Each selector can be clicked to copy to clipboard.
 */

import React, { useState } from 'react';
import { X, Copy, Check } from 'lucide-react';

const SelectorPopup = ({ selectors, position, type, onClose }) => {
    const [copiedIndex, setCopiedIndex] = useState(null);

    if (!selectors || selectors.length === 0) return null;

    const handleCopy = async (selector, index) => {
        try {
            await navigator.clipboard.writeText(selector);
            setCopiedIndex(index);
            setTimeout(() => setCopiedIndex(null), 2000);
        } catch (error) {
            console.error('Failed to copy selector:', error);
        }
    };

    return (
        <>
            {/* Backdrop */}
            <div
                className="fixed inset-0 z-[10020]"
                onClick={onClose}
            />
            {/* Popup */}
            <div
                className="fixed z-[10021] bg-white border border-gray-300 rounded-lg shadow-lg p-3 max-w-md"
                style={{
                    left: `${Math.min(position.x, window.innerWidth - 320)}px`,
                    top: `${Math.min(position.y, window.innerHeight - 200)}px`,
                }}
            >
                <div className="flex items-center justify-between mb-2">
                    <h3 className="text-sm font-semibold text-gray-700">CSS Selectors</h3>
                    <button
                        type="button"
                        onClick={onClose}
                        className="text-gray-400 hover:text-gray-600"
                    >
                        <X className="w-4 h-4" />
                    </button>
                </div>
                <div className="space-y-1 max-h-64 overflow-y-auto">
                    {selectors.map((selector, idx) => {
                        const selectorText = selector || '(global)';
                        const isCopied = copiedIndex === idx;
                        return (
                            <div
                                key={idx}
                                className={`flex items-center justify-between gap-2 px-2 py-1.5 ${type === 'tag' ? 'bg-blue-50 text-blue-700' : 'bg-purple-50 text-purple-700'} text-xs font-mono rounded hover:opacity-80 transition-opacity cursor-pointer`}
                                onClick={() => handleCopy(selectorText, idx)}
                            >
                                <span className="flex-1 select-all">{selectorText}</span>
                                <button
                                    type="button"
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        handleCopy(selectorText, idx);
                                    }}
                                    className="p-1 hover:bg-white/50 rounded transition-colors"
                                    title="Copy selector"
                                >
                                    {isCopied ? (
                                        <Check className="w-3 h-3 text-green-600" />
                                    ) : (
                                        <Copy className="w-3 h-3" />
                                    )}
                                </button>
                            </div>
                        );
                    })}
                </div>
            </div>
        </>
    );
};

export default SelectorPopup;




