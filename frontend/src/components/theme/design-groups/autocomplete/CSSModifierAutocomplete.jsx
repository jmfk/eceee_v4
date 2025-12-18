/**
 * CSS Modifier Autocomplete Component
 * 
 * A combobox that allows selecting common CSS pseudo-classes or entering custom ones.
 */

import React, { useState, useRef, useEffect } from 'react';
import { ChevronDown } from 'lucide-react';

const COMMON_MODIFIERS = [
    { value: ':first-child', label: ':first-child', description: 'First element among siblings' },
    { value: ':last-child', label: ':last-child', description: 'Last element among siblings' },
    { value: ':nth-child(even)', label: ':nth-child(even)', description: 'Even numbered elements' },
    { value: ':nth-child(odd)', label: ':nth-child(odd)', description: 'Odd numbered elements' },
    { value: ':first-of-type', label: ':first-of-type', description: 'First element of its type' },
    { value: ':last-of-type', label: ':last-of-type', description: 'Last element of its type' },
    { value: ':hover', label: ':hover', description: 'When mouse is over' },
    { value: ':active', label: ':active', description: 'When being clicked' },
    { value: ':focus', label: ':focus', description: 'When focused' },
    { value: ':not()', label: ':not(...)', description: 'Does not match selector' },
    { value: '.active', label: '.active', description: 'Has "active" class' },
];

const CSSModifierAutocomplete = ({ value, onChange, placeholder, disabled }) => {
    const [isOpen, setIsOpen] = useState(false);
    const [highlightedIndex, setHighlightedIndex] = useState(-1);
    const containerRef = useRef(null);
    const inputRef = useRef(null);
    const dropdownRef = useRef(null);

    const filteredModifiers = COMMON_MODIFIERS.filter(m => 
        m.value.toLowerCase().includes((value || '').toLowerCase())
    );

    const handleSelect = (modifierValue) => {
        onChange(modifierValue);
        setIsOpen(false);
        setHighlightedIndex(-1);
    };

    const handleKeyDown = (e) => {
        if (disabled) return;

        if (e.key === 'ArrowDown') {
            e.preventDefault();
            if (!isOpen) {
                setIsOpen(true);
            } else {
                setHighlightedIndex(prev => 
                    prev < filteredModifiers.length - 1 ? prev + 1 : prev
                );
            }
        } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            if (isOpen) {
                setHighlightedIndex(prev => (prev > 0 ? prev - 1 : 0));
            }
        } else if (e.key === 'Enter') {
            if (isOpen && highlightedIndex >= 0 && filteredModifiers[highlightedIndex]) {
                e.preventDefault();
                handleSelect(filteredModifiers[highlightedIndex].value);
            } else if (isOpen) {
                setIsOpen(false);
            }
        } else if (e.key === 'Escape') {
            setIsOpen(false);
        }
    };

    useEffect(() => {
        const handleClickOutside = (e) => {
            if (containerRef.current && !containerRef.current.contains(e.target)) {
                setIsOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    // Adjust scroll when navigating with keyboard
    useEffect(() => {
        if (isOpen && highlightedIndex >= 0 && dropdownRef.current) {
            const item = dropdownRef.current.children[highlightedIndex];
            if (item) {
                item.scrollIntoView({ block: 'nearest' });
            }
        }
    }, [highlightedIndex, isOpen]);

    return (
        <div ref={containerRef} className="relative w-full">
            <div className="relative">
                <input
                    ref={inputRef}
                    type="text"
                    value={value || ''}
                    onChange={(e) => {
                        onChange(e.target.value);
                        setIsOpen(true);
                    }}
                    onFocus={() => setIsOpen(true)}
                    onKeyDown={handleKeyDown}
                    placeholder={placeholder || ":modifier..."}
                    disabled={disabled}
                    className="w-full px-3 py-2 border border-gray-300 rounded text-xs font-mono focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100 disabled:cursor-not-allowed"
                />
                <button
                    type="button"
                    onClick={() => !disabled && setIsOpen(!isOpen)}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 focus:outline-none"
                    disabled={disabled}
                >
                    <ChevronDown size={14} />
                </button>
            </div>

            {isOpen && (
                <div
                    ref={dropdownRef}
                    className="absolute z-[10020] w-full mt-1 bg-white border border-gray-300 rounded shadow-lg max-h-60 overflow-y-auto"
                >
                    {filteredModifiers.length > 0 ? (
                        filteredModifiers.map((mod, index) => (
                            <button
                                key={mod.value}
                                type="button"
                                onClick={() => handleSelect(mod.value)}
                                className={`w-full px-3 py-2 text-left text-xs transition-colors border-b border-gray-50 last:border-0 ${
                                    index === highlightedIndex ? 'bg-blue-50' : 'hover:bg-gray-50'
                                }`}
                                onMouseEnter={() => setHighlightedIndex(index)}
                            >
                                <div className="font-mono font-medium text-blue-700">{mod.label}</div>
                                <div className="text-gray-500 text-[10px]">{mod.description}</div>
                            </button>
                        ))
                    ) : (
                        <div className="px-3 py-2 text-xs text-gray-500 italic">
                            Press Enter to use custom modifier
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};

export default CSSModifierAutocomplete;

