/**
 * useDesignGroupState Hook
 * 
 * Manages all UI state for design groups including:
 * - Expanded/collapsed states for sections
 * - Clipboard for copy/paste
 * - Edit modes (form vs CSS)
 * - Import modal state
 */

import { useState } from 'react';

export const useDesignGroupState = () => {
    const [expandedContent, setExpandedContent] = useState({});
    const [expandedTags, setExpandedTags] = useState({});
    const [expandedTargeting, setExpandedTargeting] = useState({});
    const [expandedLayoutProps, setExpandedLayoutProps] = useState({});
    const [expandedLayoutParts, setExpandedLayoutParts] = useState({});
    const [expandedLayoutBreakpoints, setExpandedLayoutBreakpoints] = useState({});
    const [clipboard, setClipboard] = useState(null);
    const [copiedIndicator, setCopiedIndicator] = useState(null);
    const [editMode, setEditMode] = useState({});
    const [groupEditMode, setGroupEditMode] = useState({});
    const [layoutEditMode, setLayoutEditMode] = useState({});
    const [importModal, setImportModal] = useState(null);

    // Toggle functions
    const toggleContent = (index) => {
        setExpandedContent({
            ...expandedContent,
            [index]: !expandedContent[index],
        });
    };

    const toggleTag = (groupIndex, tagBase) => {
        const key = `${groupIndex}-${tagBase}`;
        setExpandedTags({
            ...expandedTags,
            [key]: !expandedTags[key],
        });
    };

    const toggleTargeting = (groupIndex) => {
        setExpandedTargeting({
            ...expandedTargeting,
            [groupIndex]: !expandedTargeting[groupIndex],
        });
    };

    const toggleLayoutProps = (groupIndex) => {
        setExpandedLayoutProps({
            ...expandedLayoutProps,
            [groupIndex]: !expandedLayoutProps[groupIndex],
        });
    };

    const toggleLayoutPart = (groupIndex, part) => {
        const key = `${groupIndex}-${part}`;
        setExpandedLayoutParts({
            ...expandedLayoutParts,
            [key]: !expandedLayoutParts[key],
        });
    };

    const toggleLayoutBreakpoint = (groupIndex, part, breakpoint) => {
        const key = `${groupIndex}-${part}-${breakpoint}`;
        setExpandedLayoutBreakpoints({
            ...expandedLayoutBreakpoints,
            [key]: !expandedLayoutBreakpoints[key],
        });
    };

    // Clipboard functions
    const copyTag = (element, styles) => {
        setClipboard({ type: 'tag', element, data: styles });
        setCopiedIndicator(`tag-${element}`);
        setTimeout(() => setCopiedIndicator(null), 2000);
    };

    const copyGroup = (group) => {
        setClipboard({ type: 'group', data: group.elements });
        setCopiedIndicator('group');
        setTimeout(() => setCopiedIndicator(null), 2000);
    };

    const copyLayoutBreakpoint = (groupIndex, part, breakpoint, data) => {
        setClipboard({
            type: 'layoutBreakpoint',
            part,
            breakpoint,
            data
        });
        const key = `${groupIndex}-${part}-${breakpoint}`;
        setCopiedIndicator(`layout-${key}`);
        setTimeout(() => setCopiedIndicator(null), 2000);
    };

    // Edit mode functions
    const toggleEditMode = (groupIndex, tagBase, variant) => {
        const key = `${groupIndex}-${tagBase}-${variant}`;
        const currentMode = editMode[key] || 'form';
        setEditMode({
            ...editMode,
            [key]: currentMode === 'css' ? 'form' : 'css',
        });
    };

    const toggleGroupEditMode = (groupIndex) => {
        const currentMode = groupEditMode[groupIndex] || 'tags';
        setGroupEditMode({
            ...groupEditMode,
            [groupIndex]: currentMode === 'css' ? 'tags' : 'css',
        });
    };

    const setLayoutEditModeFor = (groupIndex, part, breakpoint, mode) => {
        const key = `${groupIndex}-${part}-${breakpoint}`;
        setLayoutEditMode({
            ...layoutEditMode,
            [key]: mode,
        });
    };

    // Import modal functions
    const openImportModal = (type, groupIndex = null, elementKey = null) => {
        setImportModal({ type, groupIndex, elementKey });
    };

    const closeImportModal = () => {
        setImportModal(null);
    };

    // Initialize expanded states for groups with content
    const initializeExpandedStates = (groups) => {
        const initialExpandedLayoutProps = {};
        const initialExpandedParts = {};
        const initialExpandedBreakpoints = {};

        groups.forEach((group, groupIndex) => {
            const layoutProps = group.layoutProperties || {};

            // Check if this group has any layout properties at all
            const hasAnyLayoutProps = Object.keys(layoutProps).length > 0;
            if (hasAnyLayoutProps) {
                initialExpandedLayoutProps[groupIndex] = true;
            }

            // Auto-expand parts that have content
            Object.entries(layoutProps).forEach(([part, partProps]) => {
                const hasContent = Object.values(partProps).some(bp => Object.keys(bp).length > 0);
                if (hasContent) {
                    initialExpandedParts[`${groupIndex}-${part}`] = true;

                    // Auto-expand breakpoints within those parts that have properties
                    Object.entries(partProps).forEach(([breakpoint, bpProps]) => {
                        if (Object.keys(bpProps).length > 0) {
                            initialExpandedBreakpoints[`${groupIndex}-${part}-${breakpoint}`] = true;
                        }
                    });
                }
            });
        });

        if (Object.keys(initialExpandedLayoutProps).length > 0) {
            setExpandedLayoutProps(initialExpandedLayoutProps);
        }
        if (Object.keys(initialExpandedParts).length > 0) {
            setExpandedLayoutParts(initialExpandedParts);
        }
        if (Object.keys(initialExpandedBreakpoints).length > 0) {
            setExpandedLayoutBreakpoints(initialExpandedBreakpoints);
        }
    };

    return {
        // State
        expandedContent,
        expandedTags,
        expandedTargeting,
        expandedLayoutProps,
        expandedLayoutParts,
        expandedLayoutBreakpoints,
        clipboard,
        copiedIndicator,
        editMode,
        groupEditMode,
        layoutEditMode,
        importModal,

        // Setters for direct access
        setExpandedContent,
        setExpandedTags,
        setExpandedTargeting,
        setExpandedLayoutProps,
        setExpandedLayoutParts,
        setExpandedLayoutBreakpoints,
        setClipboard,
        setCopiedIndicator,
        setEditMode,
        setGroupEditMode,
        setLayoutEditMode,
        setImportModal,

        // Toggle functions
        toggleContent,
        toggleTag,
        toggleTargeting,
        toggleLayoutProps,
        toggleLayoutPart,
        toggleLayoutBreakpoint,

        // Clipboard functions
        copyTag,
        copyGroup,
        copyLayoutBreakpoint,

        // Edit mode functions
        toggleEditMode,
        toggleGroupEditMode,
        setLayoutEditModeFor,

        // Import modal functions
        openImportModal,
        closeImportModal,

        // Initialization
        initializeExpandedStates,
    };
};






