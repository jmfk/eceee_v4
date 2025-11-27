/**
 * Session ID utility for tracking browser tab/window instances
 * 
 * Generates a unique session ID per React app instance (browser tab).
 * Used to distinguish own saves from other users' saves in WebSocket notifications.
 */

let sessionId = null;

/**
 * Get or create the session ID for this browser tab/window
 * @returns {string} Unique session ID
 */
export function getSessionId() {
    if (!sessionId) {
        // Generate UUID-like session ID
        sessionId = `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        console.log('[Session] Created session ID:', sessionId);
    }
    return sessionId;
}

/**
 * Reset session ID (useful for testing)
 */
export function resetSessionId() {
    sessionId = null;
}



