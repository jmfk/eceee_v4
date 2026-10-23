import { authRequest, clearLegacyTokens } from '../api/auth';
import { clearReportDiagnostics } from '../utils/reportDiagnostics'
import React, { createContext, useContext, useState, useEffect, useRef, useCallback } from 'react';

import { reconcileCurrentTenantId, setCurrentTenantId } from '../utils/tenant';

const AuthContext = createContext();

export const useAuth = () => {
    const context = useContext(AuthContext);
    if (!context) {
        throw new Error('useAuth must be used within an AuthProvider');
    }
    return context;
};

export const AuthProvider = ({ children }) => {
    const [isAuthenticated, setIsAuthenticated] = useState(false);
    const [isLoading, setIsLoading] = useState(true);
    const [user, setUser] = useState(null);
    const [sessionExpired, setSessionExpired] = useState(false);
    const requestQueueRef = useRef([]);


    // Listen for session expired events from API client
    useEffect(() => {
        const handleSessionExpired = (event) => {
            const requestData = event.detail;

            // Queue the failed request
            queueRequest(requestData);

            // Show the session expired overlay (only if not already shown)
            if (!sessionExpired) {
                setSessionExpired(true);
            }
        };

        window.addEventListener('session-expired', handleSessionExpired);

        return () => {
            window.removeEventListener('session-expired', handleSessionExpired);
        };
    }, [sessionExpired]);

    const fetchUserDetails = useCallback(async () => {
        const response = await fetch('/api/v1/utils/current-user/', {
            credentials: 'include', cache: 'no-store', headers: { 'Content-Type': 'application/json' },
        });
        if (!response.ok) return null;
        const data = await response.json();
        if (data.designerTenants?.length) reconcileCurrentTenantId(data.currentWorkspace, data.designerTenants);
        return data;
    }, []);

    const checkAuthStatus = useCallback(async () => {
        clearLegacyTokens();
        try {
            const userData = await fetchUserDetails();
            setIsAuthenticated(Boolean(userData));
            setUser(userData);
            return Boolean(userData);
        } catch {
            setIsAuthenticated(false);
            setUser(null);
            return false;
        } finally {
            setIsLoading(false);
        }
    }, [fetchUserDetails]);

    useEffect(() => { checkAuthStatus(); }, [checkAuthStatus]);

    const queueRequest = (request) => {
        // Skip queueing if request doesn't have config (e.g., WebSocket verification events)
        // Only queue actual API requests that can be retried
        if (!request || !request.config) {
            return;
        }

        // Create a unique key for deduplication
        const requestKey = `${request.config.method}-${request.config.url}-${JSON.stringify(request.config.data)}`;

        // Check if this request is already queued
        const isDuplicate = requestQueueRef.current.some(
            queuedRequest => {
                const queuedKey = `${queuedRequest.config.method}-${queuedRequest.config.url}-${JSON.stringify(queuedRequest.config.data)}`;
                return queuedKey === requestKey;
            }
        );

        if (!isDuplicate) {
            requestQueueRef.current.push(request);
        }
    };

    const retryQueuedRequests = async () => {
        const queue = [...requestQueueRef.current];
        requestQueueRef.current = []; // Clear the queue

        // Import apiClient dynamically to avoid circular dependency
        const { default: apiClient } = await import('../api/client');

        // Retry all queued requests
        for (const queuedRequest of queue) {
            try {
                if (queuedRequest.config.headers) delete queuedRequest.config.headers.Authorization;
                const response = await apiClient.request(queuedRequest.config);
                queuedRequest.resolve(response);
            } catch (error) {
                queuedRequest.reject(error);
            }
        }
    };

    const clearRequestQueue = () => {
        // Reject all queued requests
        requestQueueRef.current.forEach(queuedRequest => {
            queuedRequest.reject(new Error('Authentication cancelled'));
        });
        requestQueueRef.current = [];
    };

    const login = async () => {
        if (!await checkAuthStatus()) throw new Error("Sign-in was not completed. Please try again.");
        setSessionExpired(false);
        // Retry all queued requests after successful login
        await retryQueuedRequests();
        // Notify WebSocket hooks to reconnect
        window.dispatchEvent(new CustomEvent('websocket-reconnect'));
    };

    const logout = async () => {
        const result = await authRequest('/auth/session', { method: 'DELETE' });
        if (result.status !== 401 && result.status !== 200) throw new Error("Could not sign out. Please try again.");
        clearLegacyTokens();
        setCurrentTenantId('');
        clearRequestQueue();
        setIsAuthenticated(false);
        setUser(null);
        setSessionExpired(false);
    };

    useEffect(() => { clearReportDiagnostics() }, [user?.id, user?.username]);

    const value = {
        isAuthenticated,
        isLoading,
        user,
        sessionExpired,
        setSessionExpired,
        queueRequest,
        login,
        logout,
        checkAuthStatus
    };

    return (
        <AuthContext.Provider value={value}>
            {children}
        </AuthContext.Provider>
    );
};

export default AuthContext;
