/**
 * Selector Popup Component
 * 
 * Popup showing list of CSS selectors when there are multiple selectors.
 * Positioned at click location with overflow handling.
 */

import React from 'react';
import { X } from 'lucide-react';

const SelectorPopup = ({ selectors, position, type, onClose }) => {
    if (!selectors || selectors.length === 0) return null;

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
                    {selectors.map((selector, idx) => (
                        <div
                            key={idx}
                            className={`px-2 py-1 ${type === 'tag' ? 'bg-blue-50 text-blue-700' : 'bg-purple-50 text-purple-700'} text-xs font-mono rounded`}
                        >
                            {selector || '(global)'}
                        </div>
                    ))}
                </div>
            </div>
        </>
    );
};

export default SelectorPopup;


