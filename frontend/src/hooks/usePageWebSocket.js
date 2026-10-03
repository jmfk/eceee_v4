import { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import { getSessionId } from '../utils/sessionId';
import { api } from '../api/client.js';

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
        activeSection = 'content',
        activeWidgetId = null,
        knownVersionId = null,
        knownVersionNumber = null,
        knownRevision = null,
        enabled = true,
        autoReconnect = true,
        reconnectDelay = 3000
    } = options;

    const [isConnected, setIsConnected] = useState(false);
    const [latestUpdate, setLatestUpdate] = useState(null);
    const [isStale, setIsStale] = useState(false);
    const [activeEditors, setActiveEditors] = useState([]);
    
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
    const authFailureDetectedRef = useRef(false);
    const connectionIdRef = useRef(null);
    const presenceRef = useRef(new Map());
    const activeSectionRef = useRef(activeSection);
    const activeWidgetIdRef = useRef(activeWidgetId);
    const knownVersionIdRef = useRef(knownVersionId == null ? null : String(knownVersionId));
    const knownVersionNumberRef = useRef(Number(knownVersionNumber || 0));
    const knownRevisionRef = useRef(knownRevision);
    const latestAcceptedVersionIdRef = useRef(knownVersionId == null ? null : String(knownVersionId));
    const latestAcceptedVersionNumberRef = useRef(Number(knownVersionNumber || 0));
    const latestAcceptedRevisionRef = useRef(knownRevision || 0);
    const latestAcceptedUpdateRef = useRef(null);

    const isLatestVersionUpdate = useCallback((updateInfo) => (
        latestAcceptedUpdateRef.current === updateInfo
    ), []);

    const refreshPresence = useCallback(() => {
        const now = Date.now();
        const byUser = new Map();
        for (const item of presenceRef.current.values()) {
            if (now - item.lastSeen > 60000 || item.connectionId === connectionIdRef.current) continue;
            const existing = byUser.get(item.user.id);
            if (!existing || item.lastSeen >= existing.lastSeen) byUser.set(item.user.id, item);
        }
        setActiveEditors([...byUser.values()]);
    }, []);

    const sendPresence = useCallback((type = 'presence_update') => {
        if (wsRef.current?.readyState !== WebSocket.OPEN) return;
        wsRef.current.send(JSON.stringify({
            type,
            section: activeSectionRef.current,
            widget_id: activeWidgetIdRef.current,
        }));
    }, []);

    // Keep refs updated without triggering reconnections
    useEffect(() => {
        onVersionUpdatedRef.current = onVersionUpdated;
    }, [onVersionUpdated]);

    useEffect(() => {
        activeSectionRef.current = activeSection;
        activeWidgetIdRef.current = activeWidgetId;
        sendPresence('presence_update');
    }, [activeSection, activeWidgetId, sendPresence]);

    useEffect(() => {
        const nextVersionId = knownVersionId == null ? null : String(knownVersionId);
        const nextVersionNumber = Number(knownVersionNumber || 0);
        const versionChanged = nextVersionId !== knownVersionIdRef.current;
        const revisionChanged = knownRevision !== knownRevisionRef.current;
        knownVersionIdRef.current = nextVersionId;
        knownVersionNumberRef.current = nextVersionNumber;
        knownRevisionRef.current = knownRevision;
        if (versionChanged || revisionChanged) {
            latestAcceptedUpdateRef.current = null;
        }
        if (nextVersionId !== latestAcceptedVersionIdRef.current) {
            latestAcceptedVersionIdRef.current = nextVersionId;
            latestAcceptedVersionNumberRef.current = nextVersionNumber;
            latestAcceptedRevisionRef.current = knownRevision || 0;
        } else if (knownRevision && knownRevision > latestAcceptedRevisionRef.current) {
            latestAcceptedRevisionRef.current = knownRevision;
        }
    }, [knownVersionId, knownVersionNumber, knownRevision]);

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
        const wsBaseUrl = import.meta.env.VITE_WS_URL || `${protocol}//${window.location.host}`;
        const wsUrl = `${wsBaseUrl}/ws/pages/${currentPageIdRef.current}/editor/`;

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
                        connectionIdRef.current = data.connection_id;
                        sendPresence('presence_update');
                    } else if (data.type === 'auth_failure') {
                        // Explicit auth failure from backend
                        authFailureDetectedRef.current = true;
                    } else if (data.type === 'version_updated') {
                        const eventVersionId = data.version_id == null ? null : String(data.version_id);
                        const versionNumber = Number(data.version_number || 0);
                        const revision = Number(data.revision || 0);
                        const latestVersionNumber = Math.max(
                            Number(knownVersionNumberRef.current || 0),
                            Number(latestAcceptedVersionNumberRef.current || 0),
                        );
                        if (versionNumber && latestVersionNumber && versionNumber < latestVersionNumber) return;
                        const sameAcceptedVersion = eventVersionId === latestAcceptedVersionIdRef.current;
                        const sameKnownVersion = eventVersionId === knownVersionIdRef.current;
                        const known = Math.max(
                            sameKnownVersion ? Number(knownRevisionRef.current || 0) : 0,
                            sameAcceptedVersion ? Number(latestAcceptedRevisionRef.current || 0) : 0,
                        );
                        if (revision && revision <= known) return;
                        if (revision) {
                            latestAcceptedVersionIdRef.current = eventVersionId;
                            latestAcceptedVersionNumberRef.current = versionNumber;
                            latestAcceptedRevisionRef.current = revision;
                        }
                        const updateInfo = {
                            pageId: data.page_id,
                            versionId: data.version_id,
                            versionNumber,
                            updatedAt: data.updated_at,
                            updatedBy: data.updated_by,
                            revision,
                            mutationType: data.mutation_type,
                            sessionId: data.session_id,
                            timestamp: new Date().toISOString()
                        };
                        latestAcceptedUpdateRef.current = updateInfo;
                        
                        // Check if this is our own session's save
                        if (data.session_id === sessionIdRef.current) {
                            return; // Don't set stale or trigger callback for own saves
                        }
                        
                        setLatestUpdate(updateInfo);
                        setIsStale(true);
                        
                        if (onVersionUpdatedRef.current) {
                            onVersionUpdatedRef.current(updateInfo);
                        }
                    } else if (data.type === 'presence') {
                        if (data.action === 'leave') {
                            presenceRef.current.delete(data.connection_id);
                        } else {
                            presenceRef.current.set(data.connection_id, {
                                connectionId: data.connection_id,
                                user: data.user,
                                section: data.section,
                                widgetId: data.widget_id,
                                lastSeen: Date.now(),
                            });
                        }
                        refreshPresence();
                    } else if (data.type === 'presence_sync_request') {
                        sendPresence('presence_announce');
                    }
                } catch (error) {
                    console.error('[WebSocket] Error parsing message:', error);
                }
            };

            ws.onerror = (error) => {
                console.error('[WebSocket] Error:', error);
            };

            ws.onclose = async (event) => {
                if (!mountedRef.current) return;
                
                setIsConnected(false);
                wsRef.current = null;
                connectionIdRef.current = null;
                presenceRef.current.clear();
                setActiveEditors([]);

                // Check if this is an auth failure
                const isAuthFailure = authFailureDetectedRef.current || 
                                     event.code === 4003 || // Custom auth failure code
                                     event.code === 1008;   // Policy violation
                
                if (isAuthFailure) {
                    console.log('[WebSocket] Auth failure detected, verifying session...');
                    
                    // Verify session with API call using centralized api client
                    try {
                        await api.get('/api/v1/webpages/pages/');
                        // If we get here, authentication succeeded (api client handles token refresh)
                        // Reset auth failure flag to allow reconnection
                        authFailureDetectedRef.current = false;
                    } catch (error) {
                        // API client interceptor handles 401 by:
                        // 1. Attempting token refresh if refresh token exists
                        // 2. Dispatching 'session-expired' event if refresh fails or no refresh token
                        // The session-expired event is handled by AuthContext
                        if (error.response?.status === 401) {
                            // Confirmed auth failure - api client already dispatched session-expired event
                            console.log('[WebSocket] Session expired confirmed, login overlay should be shown');
                            // Don't auto-reconnect on auth failure
                            authFailureDetectedRef.current = true;
                            return;
                        }
                        console.error('[WebSocket] Session verification failed:', error);
                    }
                }

                // Auto-reconnect if enabled, not auth failure, and not exceeded max attempts
                if (autoReconnect && !authFailureDetectedRef.current && reconnectAttemptsRef.current < maxReconnectAttempts) {
                    reconnectAttemptsRef.current += 1;
                    
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
    }, [enabled, autoReconnect, reconnectDelay, refreshPresence, sendPresence]);

    const disconnect = useCallback(() => {
        if (reconnectTimeoutRef.current) {
            clearTimeout(reconnectTimeoutRef.current);
            reconnectTimeoutRef.current = null;
        }

        const socket = wsRef.current;
        if (socket) {
            wsRef.current = null;
            socket.onclose = null;
            socket.close();
        }

        connectionIdRef.current = null;
        presenceRef.current.clear();
        setActiveEditors([]);
        setIsConnected(false);
    }, []);

    const clearStaleFlag = useCallback(() => {
        setIsStale(false);
    }, []);

    // Handle pageId changes - reconnect only when pageId actually changes
    useEffect(() => {
        if (pageId !== currentPageIdRef.current) {
            disconnect();
            currentPageIdRef.current = pageId;
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

    useEffect(() => {
        const heartbeat = setInterval(() => sendPresence('presence_heartbeat'), 20000);
        const expiry = setInterval(refreshPresence, 10000);
        return () => {
            clearInterval(heartbeat);
            clearInterval(expiry);
        };
    }, [refreshPresence, sendPresence]);

    // Listen for websocket-reconnect event after successful re-authentication
    useEffect(() => {
        const handleReconnect = () => {
            console.log('[WebSocket] Reconnect event received, re-establishing connection...');
            // Clear auth failure flag
            authFailureDetectedRef.current = false;
            // Reset reconnect attempts
            reconnectAttemptsRef.current = 0;
            // Clear any pending reconnect timeout
            if (reconnectTimeoutRef.current) {
                clearTimeout(reconnectTimeoutRef.current);
                reconnectTimeoutRef.current = null;
            }
            // Reconnect
            if (enabled && currentPageIdRef.current) {
                connect();
            }
        };

        window.addEventListener('websocket-reconnect', handleReconnect);
        
        return () => {
            window.removeEventListener('websocket-reconnect', handleReconnect);
        };
    }, [enabled, connect]);

    return {
        isConnected,
        isStale,
        latestUpdate,
        activeEditors,
        clearStaleFlag,
        isLatestVersionUpdate,
        reconnect: connect,
        disconnect
    };
}
