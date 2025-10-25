/**
 * GlobalWysiwygToolbar - Global toolbar for all WYSIWYG editors
 * 
 * This component:
 * - Appears between header and content when any editor is active
 * - Sends commands to the active editor via the toolbar manager
 * - Updates its state based on the active editor's formatting state
 */

import React, { useState, useEffect } from 'react';
import { X } from 'lucide-react';
import { toolbarManager } from '../../utils/wysiwygToolbarManager';
import ToolbarButtons from './ToolbarButtons';

const GlobalWysiwygToolbar = () => {
    const [isVisible, setIsVisible] = useState(false);
    const [toolbarState, setToolbarState] = useState(null);

    useEffect(() => {
        // Handle editor activation
        const handleActivation = (editor) => {
            setIsVisible(true);
            // Get initial state
            const state = editor.getToolbarState();
            setToolbarState(state);
        };

        // Handle editor deactivation
        const handleDeactivation = () => {
            setIsVisible(false);
            setToolbarState(null);
        };

        // Handle state updates from active editor
        const handleStateUpdate = (state) => {
            setToolbarState(state);
        };

        // Subscribe to toolbar manager events
        const unsubscribeActivation = toolbarManager.subscribe('editor-activated', handleActivation);
        const unsubscribeDeactivation = toolbarManager.subscribe('editor-deactivated', handleDeactivation);
        const unsubscribeStateUpdate = toolbarManager.subscribe('state-updated', handleStateUpdate);

        // Cleanup subscriptions on unmount
        return () => {
            unsubscribeActivation();
            unsubscribeDeactivation();
            unsubscribeStateUpdate();
        };
    }, []);

    // Handle command button clicks
    const handleCommand = (command, value) => {
        toolbarManager.dispatchCommand(command, value);
    };

    // Handle close button click
    const handleClose = () => {
        // Deactivate the current editor, which will hide the toolbar
        const activeEditor = toolbarManager.getActiveEditor();
        if (activeEditor) {
            activeEditor.deactivate();
            // Blur the editor element to ensure proper cleanup
            if (activeEditor.editorElement) {
                activeEditor.editorElement.blur();
            }
        }
    };

    return (
        <div
            className={`global-wysiwyg-toolbar fixed top-0 left-0 right-0 z-50 bg-gray-50 border-b border-gray-200 px-4 py-2 shadow-lg transition-transform duration-300 ease-in-out ${isVisible && toolbarState ? 'translate-y-0' : '-translate-y-full'
                }`}
            style={{
                pointerEvents: isVisible && toolbarState ? 'auto' : 'none'
            }}
        >
            <div className="max-w-7xl mx-auto flex items-center justify-between">
                <ToolbarButtons state={toolbarState} onCommand={handleCommand} />
                <button
                    onClick={handleClose}
                    className="ml-4 p-1.5 text-gray-500 hover:text-gray-700 hover:bg-gray-200 rounded transition-colors"
                    title="Close toolbar"
                    aria-label="Close toolbar"
                >
                    <X className="w-4 h-4" />
                </button>
            </div>
        </div>
    );
};

export default GlobalWysiwygToolbar;

