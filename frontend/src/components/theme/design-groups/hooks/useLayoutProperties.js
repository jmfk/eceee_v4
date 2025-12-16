/**
 * useLayoutProperties Hook
 * 
 * Manages layout properties state and operations including:
 * - Local input values with debouncing
 * - Property CRUD operations
 * - Part and breakpoint management
 * - CSS conversion functions
 */

import { useState, useRef, useEffect } from 'react';

export const useLayoutProperties = (groups, onChange, onDirty, breakpoints) => {
    const [layoutInputValues, setLayoutInputValues] = useState({});
    const layoutDebounceTimerRef = useRef({});

    // Cleanup debounce timers on unmount
    useEffect(() => {
        return () => {
            Object.values(layoutDebounceTimerRef.current).forEach(timer => {
                if (timer) clearTimeout(timer);
            });
        };
    }, []);

    // Update layout property with debouncing
    const handleUpdateLayoutProperty = (groupIndex, part, breakpoint, property, value, immediate = false) => {
        const key = `${groupIndex}-${part}-${breakpoint}-${property}`;

        // Update local input state immediately
        setLayoutInputValues(prev => ({
            ...prev,
            [key]: value
        }));

        // Clear previous debounce timer for this specific property
        if (layoutDebounceTimerRef.current[key]) {
            clearTimeout(layoutDebounceTimerRef.current[key]);
        }

        // Function to perform the actual update
        const performUpdate = () => {
            const updatedGroups = [...groups];
            const layoutProperties = updatedGroups[groupIndex].layoutProperties || {};
            const partProps = layoutProperties[part] || {};
            const breakpointProps = partProps[breakpoint] || {};

            // Update or remove property
            if (value === null) {
                // Only delete if explicitly set to null (user wants to remove)
                delete breakpointProps[property];
            } else {
                // Keep the property even if empty string (allows field to show)
                breakpointProps[property] = value;
            }

            // Clean up empty objects
            if (Object.keys(breakpointProps).length === 0) {
                delete partProps[breakpoint];
            } else {
                partProps[breakpoint] = breakpointProps;
            }

            if (Object.keys(partProps).length === 0) {
                delete layoutProperties[part];
            } else {
                layoutProperties[part] = partProps;
            }

            updatedGroups[groupIndex] = {
                ...updatedGroups[groupIndex],
                layoutProperties: Object.keys(layoutProperties).length > 0 ? layoutProperties : undefined,
            };

            // Recalculate selectors to include layout part selectors
            if (typeof window !== 'undefined' && window.calculateSelectorsForGroup) {
                updatedGroups[groupIndex].calculatedSelectors = window.calculateSelectorsForGroup(updatedGroups[groupIndex]);
            }

            onChange({ groups: updatedGroups });
            if (onDirty) onDirty();

            // Clear the local input value after successful update
            setLayoutInputValues(prev => {
                const newState = { ...prev };
                delete newState[key];
                return newState;
            });
        };

        // Either update immediately or debounce
        if (immediate) {
            performUpdate();
        } else {
            layoutDebounceTimerRef.current[key] = setTimeout(performUpdate, 500);
        }
    };

    // Handle blur event - trigger immediate update
    const handleLayoutPropertyBlur = (groupIndex, part, breakpoint, property) => {
        const key = `${groupIndex}-${part}-${breakpoint}-${property}`;

        // Clear any pending debounce timer
        if (layoutDebounceTimerRef.current[key]) {
            clearTimeout(layoutDebounceTimerRef.current[key]);
        }

        // Trigger immediate update with current local value
        const value = layoutInputValues[key];
        if (value !== undefined) {
            handleUpdateLayoutProperty(groupIndex, part, breakpoint, property, value, true);
        }
    };

    // Add layout part
    const handleAddLayoutPart = (groupIndex, part, expandedLayoutProps, setExpandedLayoutProps, expandedLayoutParts, setExpandedLayoutParts) => {
        const updatedGroups = [...groups];
        const layoutProperties = updatedGroups[groupIndex].layoutProperties || {};

        // Only initialize if the part doesn't exist
        if (!(part in layoutProperties)) {
            // Initialize the part with empty sm breakpoint (mobile-first base)
            layoutProperties[part] = { sm: {} };

            updatedGroups[groupIndex] = {
                ...updatedGroups[groupIndex],
                layoutProperties
            };

            // Recalculate selectors when layout parts are added
            if (typeof window !== 'undefined' && window.calculateSelectorsForGroup) {
                updatedGroups[groupIndex].calculatedSelectors = window.calculateSelectorsForGroup(updatedGroups[groupIndex]);
            }

            onChange({ groups: updatedGroups });
            if (onDirty) onDirty();
        }

        // Always ensure Layout Properties section is expanded
        if (!expandedLayoutProps[groupIndex]) {
            setExpandedLayoutProps({ ...expandedLayoutProps, [groupIndex]: true });
        }

        // Always auto-expand the part (whether new or existing)
        const partKey = `${groupIndex}-${part}`;
        setExpandedLayoutParts({ ...expandedLayoutParts, [partKey]: true });
    };

    // Remove layout part
    const handleRemoveLayoutPart = (groupIndex, part, expandedLayoutParts, setExpandedLayoutParts) => {
        const updatedGroups = [...groups];
        const layoutProperties = updatedGroups[groupIndex].layoutProperties || {};

        // Remove the part
        delete layoutProperties[part];

        updatedGroups[groupIndex] = {
            ...updatedGroups[groupIndex],
            layoutProperties: Object.keys(layoutProperties).length > 0 ? layoutProperties : undefined
        };

        // Recalculate selectors when layout parts are removed
        if (typeof window !== 'undefined' && window.calculateSelectorsForGroup) {
            updatedGroups[groupIndex].calculatedSelectors = window.calculateSelectorsForGroup(updatedGroups[groupIndex]);
        }

        onChange({ groups: updatedGroups });
        if (onDirty) onDirty();

        // Remove from expanded state
        const partKey = `${groupIndex}-${part}`;
        const newExpandedLayoutParts = { ...expandedLayoutParts };
        delete newExpandedLayoutParts[partKey];
        setExpandedLayoutParts(newExpandedLayoutParts);
    };

    // Add breakpoint
    const handleAddBreakpoint = (groupIndex, part, breakpoint, expandedLayoutBreakpoints, setExpandedLayoutBreakpoints) => {
        const updatedGroups = [...groups];
        const layoutProperties = updatedGroups[groupIndex].layoutProperties || {};
        const partProps = layoutProperties[part] || {};

        partProps[breakpoint] = {}; // Initialize with empty object
        layoutProperties[part] = partProps;

        updatedGroups[groupIndex] = {
            ...updatedGroups[groupIndex],
            layoutProperties
        };

        onChange({ groups: updatedGroups });
        if (onDirty) onDirty();

        // Auto-expand the new breakpoint
        const breakpointKey = `${groupIndex}-${part}-${breakpoint}`;
        setExpandedLayoutBreakpoints({ ...expandedLayoutBreakpoints, [breakpointKey]: true });
    };

    // Remove breakpoint
    const handleRemoveBreakpoint = (groupIndex, part, breakpoint, expandedLayoutBreakpoints, setExpandedLayoutBreakpoints) => {
        const updatedGroups = [...groups];
        const layoutProperties = updatedGroups[groupIndex].layoutProperties || {};
        const partProps = layoutProperties[part] || {};

        // Check if breakpoint has properties
        const breakpointProps = partProps[breakpoint] || {};
        const hasProperties = Object.keys(breakpointProps).length > 0;

        // Show confirmation if breakpoint has properties
        if (hasProperties) {
            const confirmed = window.confirm(
                `This breakpoint has ${Object.keys(breakpointProps).length} property/properties. Are you sure you want to remove it?`
            );
            if (!confirmed) return;
        }

        // Remove the breakpoint
        delete partProps[breakpoint];

        // If part has no breakpoints left, remove the part entirely
        if (Object.keys(partProps).length === 0) {
            delete layoutProperties[part];
        } else {
            layoutProperties[part] = partProps;
        }

        updatedGroups[groupIndex] = {
            ...updatedGroups[groupIndex],
            layoutProperties: Object.keys(layoutProperties).length > 0 ? layoutProperties : undefined
        };

        onChange({ groups: updatedGroups });
        if (onDirty) onDirty();

        // Remove from expanded state
        const breakpointKey = `${groupIndex}-${part}-${breakpoint}`;
        const newExpandedLayoutBreakpoints = { ...expandedLayoutBreakpoints };
        delete newExpandedLayoutBreakpoints[breakpointKey];
        setExpandedLayoutBreakpoints(newExpandedLayoutBreakpoints);
    };

    // Add property to breakpoint
    const handleAddProperty = (groupIndex, part, breakpoint, property) => {
        // Initialize property with empty string (will show the form field)
        handleUpdateLayoutProperty(groupIndex, part, breakpoint, property, '', true);
    };

    return {
        layoutInputValues,
        handleUpdateLayoutProperty,
        handleLayoutPropertyBlur,
        handleAddLayoutPart,
        handleRemoveLayoutPart,
        handleAddBreakpoint,
        handleRemoveBreakpoint,
        handleAddProperty,
    };
};






