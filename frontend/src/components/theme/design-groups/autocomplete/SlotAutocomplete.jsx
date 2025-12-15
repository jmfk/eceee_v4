/**
 * Slot Autocomplete Component
 * 
 * Autocomplete component for selecting layout slots with:
 * - Search/filter functionality
 * - Keyboard navigation (arrows, enter, escape)
 * - Click-outside-to-close
 */

import React, { useState, useRef, useEffect } from 'react';
import { Search } from 'lucide-react';

const SlotAutocomplete = ({ availableSlots, onSelect, disabled }) => {
    const [searchTerm, setSearchTerm] = useState('');
    const [isOpen, setIsOpen] = useState(false);
    const [highlightedIndex, setHighlightedIndex] = useState(0);
    const inputRef = useRef(null);
    const dropdownRef = useRef(null);

    // Filter slots based on search term
    const filteredSlots = searchTerm
        ? availableSlots.filter(slot =>
            slot.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
            (slot.layouts && slot.layouts.some(l => l.toLowerCase().includes(searchTerm.toLowerCase())))
        )
        : availableSlots;

    // Handle selection
    const handleSelect = (slot) => {
        onSelect(slot.name);
        setSearchTerm('');
        setIsOpen(false);
        setHighlightedIndex(0);
        inputRef.current?.blur();
    };

    // Handle keyboard navigation
    const handleKeyDown = (e) => {
        if (!isOpen && filteredSlots.length > 0 && (e.key === 'ArrowDown' || e.key === 'Enter')) {
            setIsOpen(true);
            e.preventDefault();
            return;
        }

        if (!isOpen) return;

        switch (e.key) {
            case 'ArrowDown':
                e.preventDefault();
                setHighlightedIndex((prev) =>
                    prev < filteredSlots.length - 1 ? prev + 1 : prev
                );
                break;
            case 'ArrowUp':
                e.preventDefault();
                setHighlightedIndex((prev) => (prev > 0 ? prev - 1 : 0));
                break;
            case 'Enter':
                e.preventDefault();
                if (filteredSlots[highlightedIndex]) {
                    handleSelect(filteredSlots[highlightedIndex]);
                }
                break;
            case 'Escape':
                setIsOpen(false);
                setSearchTerm('');
                inputRef.current?.blur();
                break;
            default:
                break;
        }
    };

    // Close dropdown when clicking outside
    useEffect(() => {
        const handleClickOutside = (e) => {
            if (
                dropdownRef.current &&
                !dropdownRef.current.contains(e.target) &&
                !inputRef.current?.contains(e.target)
            ) {
                setIsOpen(false);
            }
        };

        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    // Reset highlighted index when filtered list changes
    useEffect(() => {
        setHighlightedIndex(0);
    }, [searchTerm]);

    return (
        <div className="relative">
            <div className="relative">
                <input
                    ref={inputRef}
                    type="text"
                    value={searchTerm}
                    onChange={(e) => {
                        setSearchTerm(e.target.value);
                        setIsOpen(true);
                    }}
                    onFocus={() => setIsOpen(true)}
                    onKeyDown={handleKeyDown}
                    placeholder="+ Add slot..."
                    disabled={disabled}
                    className="w-full pl-8 pr-2 py-1 border border-gray-300 rounded text-xs focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100 disabled:cursor-not-allowed"
                />
                <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
            </div>

            {isOpen && filteredSlots.length > 0 && (
                <div
                    ref={dropdownRef}
                    className="absolute z-50 w-full mt-1 bg-white border border-gray-300 rounded shadow-lg max-h-60 overflow-y-auto"
                >
                    {filteredSlots.map((slot, index) => (
                        <button
                            key={slot.name}
                            type="button"
                            onClick={() => handleSelect(slot)}
                            className={`w-full px-3 py-2 text-left text-xs hover:bg-blue-50 transition-colors ${index === highlightedIndex ? 'bg-blue-50' : ''
                                }`}
                            onMouseEnter={() => setHighlightedIndex(index)}
                        >
                            <div className="font-medium text-gray-900">{slot.name}</div>
                            {slot.layouts && slot.layouts.length > 0 && (
                                <div className="text-gray-500 text-xs">
                                    {slot.layouts.length} layout{slot.layouts.length !== 1 ? 's' : ''}
                                </div>
                            )}
                        </button>
                    ))}
                </div>
            )}

            {isOpen && searchTerm && filteredSlots.length === 0 && (
                <div
                    ref={dropdownRef}
                    className="absolute z-50 w-full mt-1 bg-white border border-gray-300 rounded shadow-lg"
                >
                    <div className="px-3 py-2 text-xs text-gray-500">
                        No slots found matching "{searchTerm}"
                    </div>
                </div>
            )}
        </div>
    );
};

export default SlotAutocomplete;




