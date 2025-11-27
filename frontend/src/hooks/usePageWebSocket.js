import { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import { getSessionId } from '../utils/sessionId';

/**
 * WebSocket hook for real-time page editor notifications
 * 
 * @param {number} pageId - ID of the page being edited
 * @param {Object} options - Configuration options
 * @returns {Object} WebSocket state and handlers
 */
export function usePageWebSocket(pageId, options = {}) {
    const {
        onVersionUpdated,
        enabled = true,
        autoReconnect = true,
        reconnectDelay = 3000
    } = options;

    const [isConnected, setIsConnected] = useState(false);
    const [latestUpdate, setLatestUpdate] = useState(null);
    const [isStale, setIsStale] = useState(false);
    
    // Generate session ID once per hook instance
    const sessionId = useMemo(() => getSessionId(), []);
    
    const wsRef = useRef(null);
    const reconnectTimeoutRef = useRef(null);
    const reconnectAttemptsRef = useRef(0);
    const maxReconnectAttempts = 5;
    const mountedRef = useRef(true);
    const currentPageIdRef = useRef(pageId);
    const onVersionUpdatedRef = useRef(onVersionUpdated);
    const sessionIdRef = useRef(sessionId);

    // Keep refs updated without triggering reconnections
    useEffect(() => {
        onVersionUpdatedRef.current = onVersionUpdated;
    }, [onVersionUpdated]);

    useEffect(() => {
        currentPageIdRef.current = pageId;
    }, [pageId]);

    const connect = useCallback(() => {
        // Don't connect if disabled, no pageId, or already connected to the same page
        if (!enabled || !currentPageIdRef.current) {
            return;
        }

        // If already connected to this page, don't reconnect
        if (wsRef.current?.readyState === WebSocket.OPEN) {
            return;
        }

        // Close any existing connection first
        if (wsRef.current) {
            wsRef.current.close();
            wsRef.current = null;
        }

        // Determine WebSocket URL based on current location
        const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        const host = window.location.hostname;
        const port = '8000'; // Django backend port
        const wsUrl = `${protocol}//${host}:${port}/ws/pages/${currentPageIdRef.current}/editor/`;

        try {
            const ws = new WebSocket(wsUrl);
            wsRef.current = ws;

            ws.onopen = () => {
                if (!mountedRef.current) return;
                setIsConnected(true);
                reconnectAttemptsRef.current = 0;
            };

            ws.onmessage = (event) => {
                if (!mountedRef.current) return;
                try {
                    const data = JSON.parse(event.data);
                    
                    if (data.type === 'connection_established') {
                        // Connection confirmed
                    } else if (data.type === 'version_updated') {
                        const updateInfo = {
                            pageId: data.page_id,
                            versionId: data.version_id,
                            updatedAt: data.updated_at,
                            updatedBy: data.updated_by,
                            sessionId: data.session_id,
                            timestamp: new Date().toISOString()
                        };
                        
                        // Check if this is our own session's save
                        if (data.session_id === sessionIdRef.current) {
                            return; // Don't set stale or trigger callback for own saves
                        }
                        
                        setLatestUpdate(updateInfo);
                        setIsStale(true);
                        
                        if (onVersionUpdatedRef.current) {
                            onVersionUpdatedRef.current(updateInfo);
                        }
                    }
                } catch (error) {
                    console.error('[WebSocket] Error parsing message:', error);
                }
            };

            ws.onerror = (error) => {
                console.error('[WebSocket] Error:', error);
            };

            ws.onclose = (event) => {
                if (!mountedRef.current) return;
                
                console.log('[WebSocket] Disconnected:', event.code, event.reason);
                setIsConnected(false);
                wsRef.current = null;

                // Auto-reconnect if enabled and not exceeded max attempts
                if (autoReconnect && reconnectAttemptsRef.current < maxReconnectAttempts) {
                    reconnectAttemptsRef.current += 1;
                    console.log(`[WebSocket] Reconnecting in ${reconnectDelay}ms (attempt ${reconnectAttemptsRef.current}/${maxReconnectAttempts})`);
                    
                    reconnectTimeoutRef.current = setTimeout(() => {
                        if (mountedRef.current) {
                            connect();
                        }
                    }, reconnectDelay);
                }
            };

        } catch (error) {
            console.error('[WebSocket] Connection error:', error);
        }
    }, [enabled, autoReconnect, reconnectDelay]); // Removed pageId and onVersionUpdated from dependencies

    const disconnect = useCallback(() => {
        if (reconnectTimeoutRef.current) {
            clearTimeout(reconnectTimeoutRef.current);
            reconnectTimeoutRef.current = null;
        }

        if (wsRef.current) {
            wsRef.current.close();
            wsRef.current = null;
        }

        setIsConnected(false);
    }, []);

    const clearStaleFlag = useCallback(() => {
        setIsStale(false);
    }, []);

    // Handle pageId changes - reconnect only when pageId actually changes
    useEffect(() => {
        if (pageId !== currentPageIdRef.current && wsRef.current) {
            disconnect();
            if (enabled) {
                connect();
            }
        }
    }, [pageId, enabled, connect, disconnect]);

    // Initial connection on mount, cleanup on unmount
    useEffect(() => {
        mountedRef.current = true;
        
        if (enabled) {
            connect();
        }
        
        return () => {
            mountedRef.current = false;
            if (reconnectTimeoutRef.current) {
                clearTimeout(reconnectTimeoutRef.current);
            }
            if (wsRef.current) {
                wsRef.current.close();
            }
        };
    }, []); // Empty dependency array - only run once on mount/unmount

    return {
        isConnected,
        isStale,
        latestUpdate,
        clearStaleFlag,
        reconnect: connect,
        disconnect
    };
}
