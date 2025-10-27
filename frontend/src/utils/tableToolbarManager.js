/**
 * TableToolbarManager - Global singleton for managing table editor toolbar
 * 
 * This manager handles:
 * - Tracking the currently active table editor instance
 * - Dispatching commands to the active editor via custom events
 * - Notifying subscribers when editor activation changes
 * - Managing toolbar state updates
 */

class TableToolbarManager {
    constructor() {
        this.activeEditor = null;
        this.listeners = new Map();
        this.stateUpdateInterval = null;
    }

    /**
     * Register an editor as the active editor
     * @param {Object} editorInstance - The TableEditorCore instance
     */
    registerEditor(editorInstance) {
        // Deactivate previous editor if exists
        if (this.activeEditor && this.activeEditor !== editorInstance) {
            this.activeEditor.isActive = false;
            // Call deactivate on the previous editor
            if (typeof this.activeEditor.deactivate === 'function') {
                this.activeEditor.deactivate();
            }
        }

        this.activeEditor = editorInstance;
        this.notifyListeners('editor-activated', editorInstance);

        // Start polling for state updates
        this.startStateUpdates();
    }

    /**
     * Unregister an editor
     * @param {Object} editorInstance - The TableEditorCore instance
     */
    unregisterEditor(editorInstance) {
        if (this.activeEditor === editorInstance) {
            this.activeEditor = null;
            this.notifyListeners('editor-deactivated');
            this.stopStateUpdates();
        }
    }

    /**
     * Dispatch a command to the active editor
     * @param {string} command - The command to execute (e.g., 'addRow', 'mergeCells')
     * @param {*} value - Optional value for the command
     */
    dispatchCommand(command, value) {
        if (this.activeEditor && this.activeEditor.container) {
            const event = new CustomEvent('table-command', {
                detail: { command, value }
            });
            this.activeEditor.container.dispatchEvent(event);
        }
    }

    /**
     * Get the current toolbar state from the active editor
     * @returns {Object|null} Toolbar state or null if no active editor
     */
    getToolbarState() {
        if (this.activeEditor && typeof this.activeEditor.getToolbarState === 'function') {
            return this.activeEditor.getToolbarState();
        }
        return null;
    }

    /**
     * Subscribe to toolbar manager events
     * @param {string} event - Event name ('editor-activated', 'editor-deactivated', 'state-updated')
     * @param {Function} callback - Callback function
     * @returns {Function} Unsubscribe function
     */
    subscribe(event, callback) {
        if (!this.listeners.has(event)) {
            this.listeners.set(event, new Set());
        }
        this.listeners.get(event).add(callback);

        // Return unsubscribe function
        return () => {
            const eventListeners = this.listeners.get(event);
            if (eventListeners) {
                eventListeners.delete(callback);
            }
        };
    }

    /**
     * Notify all listeners of an event
     * @param {string} event - Event name
     * @param {*} data - Event data
     */
    notifyListeners(event, data) {
        const eventListeners = this.listeners.get(event);
        if (eventListeners) {
            eventListeners.forEach(callback => callback(data));
        }
    }

    /**
     * Start polling for toolbar state updates
     */
    startStateUpdates() {
        // Clear any existing interval
        this.stopStateUpdates();

        // Poll every 100ms for state changes
        this.stateUpdateInterval = setInterval(() => {
            if (this.activeEditor) {
                const state = this.getToolbarState();
                this.notifyListeners('state-updated', state);
            }
        }, 100);
    }

    /**
     * Stop polling for toolbar state updates
     */
    stopStateUpdates() {
        if (this.stateUpdateInterval) {
            clearInterval(this.stateUpdateInterval);
            this.stateUpdateInterval = null;
        }
    }

    /**
     * Get the currently active editor instance
     * @returns {Object|null} Active editor or null
     */
    getActiveEditor() {
        return this.activeEditor;
    }
}

// Export singleton instance
export const tableToolbarManager = new TableToolbarManager();

