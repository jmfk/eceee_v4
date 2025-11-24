/**
 * ClipboardContext - Global clipboard state management
 * 
 * Manages clipboard data, paste mode state with localStorage events for cross-window support.
 */

import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { readFromClipboard, clearClipboard } from '../utils/clipboardService';

const ClipboardContext = createContext(null);

export const ClipboardProvider = ({ children }) => {
    const [clipboardData, setClipboardData] = useState(null);
    const [pasteModePaused, setPasteModePaused] = useState(false);
    const [pasteModeActive, setPasteModeActive] = useState(false);
    const [hoveredWidgetId, setHoveredWidgetId] = useState(null);
    const lastClipboardIdRef = useRef(null);
    
    // Helper to update clipboard state
    const updateClipboardState = useCallback(async (silent = true) => {
        try {
            const result = await readFromClipboard('widgets', silent);
            if (result && result.data && result.data.length > 0) {
                const clipboardId = result.id || result.timestamp;
                const isNewClipboard = clipboardId !== lastClipboardIdRef.current;
                
                setClipboardData(result);
                
                // Auto-activate if new clipboard data (new cut/copy operation)
                if (isNewClipboard) {
                    lastClipboardIdRef.current = clipboardId;
                    setPasteModeActive(true);
                    setPasteModePaused(false); // Reset pause state on new cut/copy
                } else if (!pasteModePaused) {
                    // Keep active if not paused
                    setPasteModeActive(true);
                }
            } else {
                setClipboardData(null);
                setPasteModeActive(false);
                setPasteModePaused(false);
                lastClipboardIdRef.current = null;
            }
        } catch (error) {
            // Silently handle errors
            setClipboardData(null);
            setPasteModeActive(false);
            setPasteModePaused(false);
            lastClipboardIdRef.current = null;
        }
    }, [pasteModePaused]);
    
    // Initial clipboard check on mount
    useEffect(() => {
        updateClipboardState(true);
    }, [updateClipboardState]);
    
    // Storage event listener for cross-window clipboard sync
    useEffect(() => {
        const handleStorageChange = async (e) => {
            // Only respond to clipboard_widgets_uuid changes
            if (e.key === 'clipboard_widgets_uuid') {
                if (e.newValue) {
                    // Clipboard was updated in another window - fetch new data
                    await updateClipboardState(true);
                } else {
                    // Clipboard was cleared in another window
                    setClipboardData(null);
                    setPasteModeActive(false);
                    setPasteModePaused(false);
                    lastClipboardIdRef.current = null;
                }
            }
        };
        
        window.addEventListener('storage', handleStorageChange);
        return () => window.removeEventListener('storage', handleStorageChange);
    }, [updateClipboardState]);
    
    // Window focus listener - refresh clipboard when returning to window
    useEffect(() => {
        const handleFocus = async () => {
            await updateClipboardState(true);
        };
        
        window.addEventListener('focus', handleFocus);
        return () => window.removeEventListener('focus', handleFocus);
    }, [updateClipboardState]);
    
    // Toggle paste mode between active and paused
    const togglePasteMode = useCallback(() => {
        setPasteModePaused(prev => {
            const newPaused = !prev;
            // Update active state based on new paused state
            if (newPaused) {
                setPasteModeActive(false);
            } else if (clipboardData && clipboardData.data && clipboardData.data.length > 0) {
                setPasteModeActive(true);
            }
            return newPaused;
        });
    }, [clipboardData]);
    
    // Clear clipboard completely
    const clearClipboardState = useCallback(async () => {
        await clearClipboard('widgets');
        setClipboardData(null);
        setPasteModeActive(false);
        setPasteModePaused(false);
        lastClipboardIdRef.current = null;
        return true; // Return success for callback chaining
    }, []);
    
    // Manually refresh clipboard (call after cut/copy operations in current window)
    const refreshClipboard = useCallback(async () => {
        await updateClipboardState(true);
    }, [updateClipboardState]);
    
    // Hover tracking for nested widgets
    const setHoveredWidget = useCallback((widgetId) => {
        setHoveredWidgetId(widgetId);
    }, []);
    
    const clearHoveredWidget = useCallback((widgetId) => {
        // Only clear if this widget is the current hover target
        setHoveredWidgetId(prev => prev === widgetId ? null : prev);
    }, []);
    
    const value = {
        clipboardData,
        pasteModePaused,
        pasteModeActive,
        togglePasteMode,
        clearClipboardState,
        refreshClipboard,
        hoveredWidgetId,
        setHoveredWidget,
        clearHoveredWidget
    };
    
    return <ClipboardContext.Provider value={value}>{children}</ClipboardContext.Provider>;
};

export const useClipboard = () => {
    const context = useContext(ClipboardContext);
    if (!context) {
        throw new Error('useClipboard must be used within ClipboardProvider');
    }
    return context;
};

