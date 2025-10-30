import React, { createContext, useContext, useState, useEffect, useRef } from 'react';

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

    // Check authentication status on mount
    useEffect(() => {
        checkAuthStatus();
    }, []);

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

    const fetchUserDetails = async () => {
        try {
            const accessToken = localStorage.getItem('access_token');
            const headers = {
                'Content-Type': 'application/json',
            };
            
            // Add JWT token if available (not needed for session auth in dev)
            if (accessToken) {
                headers['Authorization'] = `Bearer ${accessToken}`;
            }

            const response = await fetch('/api/v1/utils/current-user/', {
                credentials: 'include',
                headers: headers
            });

            if (response.ok) {
                const data = await response.json();
                return data;
            }
        } catch (error) {
            console.error('Failed to fetch user details:', error);
        }
        return null;
    };

    const checkAuthStatus = async () => {
        try {
            // STEP 1: Try dev auto-login (session-based auth with no tokens)
            // Only in development mode to avoid 401 errors in production
            if (import.meta.env.DEV) {
                const devAuthResponse = await fetch('/api/v1/webpages/pages/', {
                    credentials: 'include', // Include cookies for session auth
                });

                if (devAuthResponse.ok) {
                    // Dev auto-login is working! No tokens needed
                    setIsAuthenticated(true);
                    // Try to fetch user details
                    const userData = await fetchUserDetails();
                    setUser(userData || { username: 'dev_auto_user' });
                    setIsLoading(false);
                    return;
                }
            }

            // STEP 2: Dev auth didn't work, check for JWT tokens
            const accessToken = localStorage.getItem('access_token');
            const refreshToken = localStorage.getItem('refresh_token');

            if (!accessToken || !refreshToken) {
                setIsAuthenticated(false);
                setUser(null);
                setIsLoading(false);
                return;
            }

            // STEP 3: Try JWT authentication
            const response = await fetch('/api/v1/webpages/pages/', {
                credentials: 'include',
                headers: {
                    'Authorization': `Bearer ${accessToken}`
                }
            });

            if (response.ok) {
                setIsAuthenticated(true);
                // Fetch full user details
                const userData = await fetchUserDetails();
                setUser(userData);
            } else if (response.status === 401) {
                // Token might be expired, try to refresh
                try {
                    const refreshResponse = await fetch('/api/v1/auth/token/refresh/', {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                        },
                        body: JSON.stringify({
                            refresh: refreshToken
                        })
                    });

                    if (refreshResponse.ok) {
                        const data = await refreshResponse.json();
                        localStorage.setItem('access_token', data.access);
                        setIsAuthenticated(true);
                        // Fetch full user details
                        const userData = await fetchUserDetails();
                        setUser(userData);
                    } else {
                        // Refresh failed, clear tokens
                        localStorage.removeItem('access_token');
                        localStorage.removeItem('refresh_token');
                        setIsAuthenticated(false);
                        setUser(null);
                    }
                } catch (refreshError) {
                    console.error('Token refresh failed:', refreshError);
                    localStorage.removeItem('access_token');
                    localStorage.removeItem('refresh_token');
                    setIsAuthenticated(false);
                    setUser(null);
                }
            }
        } catch (error) {
            console.error('Auth check failed:', error);
            setIsAuthenticated(false);
            setUser(null);
        } finally {
            setIsLoading(false);
        }
    };

    const queueRequest = (request) => {
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
                // Add the new access token to the request
                const accessToken = localStorage.getItem('access_token');
                if (accessToken) {
                    queuedRequest.config.headers['Authorization'] = `Bearer ${accessToken}`;
                }

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

    const login = async (credentials) => {
        // Update authentication state after successful login
        setIsAuthenticated(true);
        // Refresh auth state to get user details
        await checkAuthStatus();
        // Retry all queued requests after successful login
        await retryQueuedRequests();
    };

    const logout = async () => {
        try {
            // Clear JWT tokens from localStorage
            localStorage.removeItem('access_token');
            localStorage.removeItem('refresh_token');
            // Clear any queued requests
            clearRequestQueue();
        } catch (error) {
            console.error('Logout error:', error);
        } finally {
            setIsAuthenticated(false);
            setUser(null);
            setSessionExpired(false);
        }
    };

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