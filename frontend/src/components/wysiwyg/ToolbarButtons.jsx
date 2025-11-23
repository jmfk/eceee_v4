/**
 * ToolbarButtons - Toolbar UI components for WYSIWYG editor
 * 
 * Renders toolbar buttons and controls that dispatch commands to the active editor
 */

import React, { useState, useRef, useEffect } from 'react';

// SVG Icons (matching the vanilla JS editor)
const ICONS = {
    bold: (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M6 12h9a4 4 0 0 1 0 8H7a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1h7a4 4 0 0 1 0 8" />
        </svg>
    ),
    italic: (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="19" x2="10" y1="4" y2="4" />
            <line x1="14" x2="5" y1="20" y2="20" />
            <line x1="15" x2="9" y1="4" y2="20" />
        </svg>
    ),
    link: (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
            <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
        </svg>
    ),
    list: (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="8" x2="21" y1="6" y2="6" />
            <line x1="8" x2="21" y1="12" y2="12" />
            <line x1="8" x2="21" y1="18" y2="18" />
            <line x1="3" x2="3.01" y1="6" y2="6" />
            <line x1="3" x2="3.01" y1="12" y2="12" />
            <line x1="3" x2="3.01" y1="18" y2="18" />
        </svg>
    ),
    listOrdered: (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="10" x2="21" y1="6" y2="6" />
            <line x1="10" x2="21" y1="12" y2="12" />
            <line x1="10" x2="21" y1="18" y2="18" />
            <path d="M4 6h1v4" />
            <path d="M4 10h2" />
            <path d="M6 18H4c0-1 2-2 2-3s-1-1.5-2-1.5S2 14 2 15" />
        </svg>
    ),
    undo: (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M3 7v6h6" />
            <path d="m21 17a9 9 0 00-9-9 9 9 0 00-6 2.3L3 13" />
        </svg>
    ),
    redo: (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 7v6h-6" />
            <path d="m3 17a9 9 0 0 1 9-9 9 9 0 0 1 6 2.3l3-2.3" />
        </svg>
    ),
    cleanup: (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 3v9" />
            <path d="M7 14h10v2c0 1.1-.9 2-2 2H9c-1.1 0-2-.9-2-2v-2z" />
            <path d="M9 18v3M15 18v3M12 18v3" />
        </svg>
    ),
    image: (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <rect width="18" height="18" x="3" y="3" rx="2" ry="2" />
            <circle cx="9" cy="9" r="2" />
            <path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21" />
        </svg>
    ),
    code: (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="16 18 22 12 16 6" />
            <polyline points="8 6 2 12 8 18" />
        </svg>
    ),
    quote: (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M3 21c3 0 7-1 7-8V5c0-1.25-.756-2.017-2-2H4c-1.25 0-2 .75-2 1.972V11c0 1.25.75 2 2 2 1 0 1 0 1 1v1c0 1-1 2-2 2s-1 .008-1 1.031V20c0 1 0 1 1 1z" />
            <path d="M15 21c3 0 7-1 7-8V5c0-1.25-.757-2.017-2-2h-4c-1.25 0-2 .75-2 1.972V11c0 1.25.75 2 2 2h.75c0 2.25.25 4-2.75 4v3c0 1 0 1 1 1z" />
        </svg>
    ),
};

/**
 * Toolbar button component
 */
const ToolbarButton = ({ command, title, icon, isActive, onClick }) => {
    const handleClick = (e) => {
        e.preventDefault();
        onClick(command);
    };

    return (
        <button
            type="button"
            className={`p-1 rounded transition-colors ${isActive
                ? 'bg-blue-500 text-white'
                : 'hover:bg-gray-200'
                }`}
            title={title}
            onClick={handleClick}
            onMouseDown={(e) => e.preventDefault()} // Prevent focus loss
        >
            {icon}
        </button>
    );
};

/**
 * Toolbar separator
 */
const ToolbarSeparator = () => (
    <div className="w-px h-6 bg-gray-300 mx-1" />
);

/**
 * Format dropdown component
 */
const FormatDropdown = ({ currentFormat, maxHeaderLevel, onCommand }) => {
    const [isOpen, setIsOpen] = useState(false);
    const dropdownRef = useRef(null);

    // Close dropdown when clicking outside
    useEffect(() => {
        const handleClickOutside = (event) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
                setIsOpen(false);
            }
        };

        if (isOpen) {
            document.addEventListener('mousedown', handleClickOutside);
            return () => {
                document.removeEventListener('mousedown', handleClickOutside);
            };
        }
    }, [isOpen]);

    const formatOptions = [
        { value: '<p>', label: 'Paragraph' },
        ...Array.from({ length: maxHeaderLevel || 3 }, (_, i) => ({
            value: `<h${i + 1}>`,
            label: `Heading ${i + 1}`
        }))
    ];

    const handleFormatClick = (value, label) => {
        onCommand('formatBlock', value);
        setIsOpen(false);
    };

    return (
        <div className="relative" ref={dropdownRef}>
            <button
                type="button"
                className="flex items-center gap-1 px-2 py-1 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                onClick={() => setIsOpen(!isOpen)}
                onMouseDown={(e) => e.preventDefault()}
            >
                <span>{currentFormat}</span>
                <svg className="w-4 h-4 ml-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
                </svg>
            </button>

            {isOpen && (
                <div className="absolute left-0 mt-1 w-32 bg-white border border-gray-200 rounded-md shadow-lg z-50">
                    {formatOptions.map(option => (
                        <button
                            key={option.value}
                            type="button"
                            className="w-full px-3 py-2 text-sm text-left text-gray-700 hover:bg-blue-50 hover:text-blue-700 focus:outline-none focus:bg-blue-50"
                            onClick={() => handleFormatClick(option.value, option.label)}
                            onMouseDown={(e) => e.preventDefault()}
                        >
                            {option.label}
                        </button>
                    ))}
                </div>
            )}
        </div>
    );
};

/**
 * Main toolbar buttons component
 */
const ToolbarButtons = ({ state, onCommand }) => {
    if (!state) {
        return null;
    }

    // Get allowed buttons (default to all if not specified)
    const allowedButtons = state.allowedButtons || ['bold', 'italic', 'link', 'format', 'list', 'code', 'quote', 'image'];
    const isAllowed = (button) => allowedButtons.includes(button);

    return (
        <div className="flex items-center gap-1">
            {isAllowed('bold') && (
                <ToolbarButton
                    command="bold"
                    title="Bold"
                    icon={ICONS.bold}
                    isActive={state.bold}
                    onClick={onCommand}
                />
            )}

            {isAllowed('italic') && (
                <ToolbarButton
                    command="italic"
                    title="Italic"
                    icon={ICONS.italic}
                    isActive={state.italic}
                    onClick={onCommand}
                />
            )}

            {isAllowed('link') && (
                <ToolbarButton
                    command="createLink"
                    title="Insert/Edit Link"
                    icon={ICONS.link}
                    isActive={state.link}
                    onClick={onCommand}
                />
            )}

            {isAllowed('format') && (
                <>
                    <ToolbarSeparator />
                    <FormatDropdown
                        currentFormat={state.format}
                        maxHeaderLevel={state.maxHeaderLevel}
                        onCommand={onCommand}
                    />
                </>
            )}

            {isAllowed('list') && (
                <>
                    <ToolbarSeparator />
                    <ToolbarButton
                        command="insertUnorderedList"
                        title="Bullet List"
                        icon={ICONS.list}
                        isActive={state.insertUnorderedList}
                        onClick={onCommand}
                    />
                    <ToolbarButton
                        command="insertOrderedList"
                        title="Numbered List"
                        icon={ICONS.listOrdered}
                        isActive={state.insertOrderedList}
                        onClick={onCommand}
                    />
                </>
            )}

            {isAllowed('code') && (
                <>
                    <ToolbarSeparator />
                    <ToolbarButton
                        command="formatCode"
                        title="Code (Cmd+K)"
                        icon={ICONS.code}
                        isActive={state.code}
                        onClick={onCommand}
                    />
                </>
            )}

            {isAllowed('quote') && (
                <ToolbarButton
                    command="formatBlockquote"
                    title="Quote (Cmd+J)"
                    icon={ICONS.quote}
                    isActive={state.blockquote}
                    onClick={onCommand}
                />
            )}

            {isAllowed('image') && (
                <>
                    <ToolbarSeparator />
                    <ToolbarButton
                        command="insertImage"
                        title="Insert Image or Collection"
                        icon={ICONS.image}
                        isActive={false}
                        onClick={onCommand}
                    />
                </>
            )}

            <ToolbarSeparator />

            <ToolbarButton
                command="undo"
                title="Undo"
                icon={ICONS.undo}
                isActive={false}
                onClick={onCommand}
            />

            <ToolbarButton
                command="redo"
                title="Redo"
                icon={ICONS.redo}
                isActive={false}
                onClick={onCommand}
            />

            <ToolbarSeparator />

            <ToolbarButton
                command="cleanup"
                title="Clean HTML"
                icon={ICONS.cleanup}
                isActive={false}
                onClick={onCommand}
            />
        </div>
    );
};

export default ToolbarButtons;

