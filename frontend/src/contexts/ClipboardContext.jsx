/**
 * ClipboardContext - Global clipboard state management
 * 
 * Manages clipboard data, paste mode state, and polling for cross-window support.
 */

import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { readFromClipboard, clearClipboard } from '../utils/clipboardService';

const ClipboardContext = createContext(null);

export const ClipboardProvider = ({ children }) => {
    const [clipboardData, setClipboardData] = useState(null);
    const [pasteModePaused, setPasteModePaused] = useState(false);
    const [pasteModeActive, setPasteModeActive] = useState(false);
    const lastClipboardIdRef = useRef(null);
    
    // Polling clipboard - check server-side clipboard every 2 seconds
    useEffect(() => {
        let mounted = true;
        let intervalId;
        
        const checkClipboard = async () => {
            if (!mounted) return;
            
            try {
                const result = await readFromClipboard('widgets', true); // silent = true for polling
                if (mounted && result && result.data && result.data.length > 0) {
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
                } else if (mounted) {
                    setClipboardData(null);
                    setPasteModeActive(false);
                    setPasteModePaused(false);
                    lastClipboardIdRef.current = null;
                }
            } catch (error) {
                // Silently handle errors - clipboard might be empty or user not authenticated
                if (mounted) {
                    setClipboardData(null);
                    setPasteModeActive(false);
                    setPasteModePaused(false);
                    lastClipboardIdRef.current = null;
                }
            }
        };
        
        checkClipboard();
        intervalId = setInterval(checkClipboard, 500); // Poll every 500ms for faster updates
        
        return () => {
            mounted = false;
            if (intervalId) {
                clearInterval(intervalId);
            }
        };
    }, [pasteModePaused]);
    
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
        return true; // Return success for callback chaining
    }, []);
    
    const value = {
        clipboardData,
        pasteModePaused,
        pasteModeActive,
        togglePasteMode,
        clearClipboardState
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

