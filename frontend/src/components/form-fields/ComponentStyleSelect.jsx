import React, { useMemo, useState, useEffect, useRef } from 'react';
import { useTheme } from '../../hooks/useTheme';
import { ChevronDown } from 'lucide-react';

/**
 * Smart visual selector for component styles with preview
 * Shows all component styles from the current theme
 */
const ComponentStyleSelect = ({
    value,
    onChange,
    ...props
}) => {
    const { currentTheme } = useTheme();
    const [isOpen, setIsOpen] = useState(false);
    const dropdownRef = useRef(null);

    // Get available component styles from theme
    const availableStyles = useMemo(() => {
        if (!currentTheme) return [];

        const styles = currentTheme.componentStyles || {};

        return Object.entries(styles).map(([key, style]) => ({
            value: key,
            label: style.name || key,
            description: style.description,
            template: style.template,
            css: style.css,
            variables: style.variables
        }));
    }, [currentTheme]);

    const hasStyles = availableStyles.length > 0;
    const selectedStyle = availableStyles.find(s => s.value === value);

    // Close dropdown when clicking outside
    useEffect(() => {
        const handleClickOutside = (event) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
                setIsOpen(false);
            }
        };

        if (isOpen) {
            document.addEventListener('mousedown', handleClickOutside);
        }

        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, [isOpen]);

    // Render style option
    const renderStyleOption = (style, isDefault = false) => {
        const isSelected = isDefault ? !value : value === style?.value;

        return (
            <div
                onClick={() => {
                    onChange(isDefault ? null : style.value);
                    setIsOpen(false);
                }}
                className={`p-3 hover:bg-blue-50 cursor-pointer border-b flex items-center gap-3 transition-colors ${
                    isSelected ? 'bg-blue-50 border-l-4 border-l-blue-600' : ''
                }`}
            >
                <div className="flex-1 min-w-0">
                    <div className="font-medium text-sm text-gray-900">
                        {isDefault ? 'Default' : style.label}
                    </div>
                    {!isDefault && style.description && (
                        <div className="text-xs text-gray-500 truncate mt-0.5">
                            {style.description}
                        </div>
                    )}
                </div>
                {isSelected && (
                    <div className="text-blue-600">
                        <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                        </svg>
                    </div>
                )}
            </div>
        );
    };

    if (!hasStyles) {
        return (
            <div className="px-3 py-2 bg-gray-100 border border-gray-300 rounded-md text-sm text-gray-600">
                Default (No component styles available in theme)
            </div>
        );
    }

    return (
        <div className="relative" ref={dropdownRef}>
            {/* Selected style display button */}
            <button
                type="button"
                onClick={() => setIsOpen(!isOpen)}
                className="w-full flex items-center justify-between px-3 py-2 border border-gray-300 rounded-md bg-white hover:bg-gray-50 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
                <span className="text-sm text-gray-900">
                    {selectedStyle?.label || 'Default'}
                </span>
                <ChevronDown className={`w-4 h-4 text-gray-400 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
            </button>

            {/* Dropdown menu */}
            {isOpen && (
                <div className="absolute z-50 mt-1 w-full bg-white border border-gray-300 rounded-md shadow-lg max-h-96 overflow-y-auto">
                    {/* Default option */}
                    <div key="default">
                        {renderStyleOption(null, true)}
                    </div>

                    {/* Custom styles */}
                    {availableStyles.map((style) => (
                        <div key={style.value}>
                            {renderStyleOption(style, false)}
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};

export default ComponentStyleSelect;

