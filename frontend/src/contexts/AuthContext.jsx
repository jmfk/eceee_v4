import React, { createContext, useContext, useState, useEffect } from 'react';

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

    // Check authentication status on mount
    useEffect(() => {
        checkAuthStatus();
    }, []);

    const checkAuthStatus = async () => {
        try {
            // Check if we have tokens
            const accessToken = localStorage.getItem('access_token');
            const refreshToken = localStorage.getItem('refresh_token');

            if (!accessToken || !refreshToken) {
                setIsAuthenticated(false);
                setUser(null);
                setIsLoading(false);
                return;
            }

            // Try to make an authenticated request to check status
            const response = await fetch('/api/v1/webpages/pages/', {
                headers: {
                    'Authorization': `Bearer ${accessToken}`
                }
            });

            if (response.ok) {
                setIsAuthenticated(true);
                // Optionally fetch user details
                // const userData = await fetchUserDetails();
                // setUser(userData);
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

    const login = async (credentials) => {
        // Update authentication state after successful login
        setIsAuthenticated(true);
        // Refresh auth state to get user details
        await checkAuthStatus();
    };

    const logout = async () => {
        try {
            // Clear JWT tokens from localStorage
            localStorage.removeItem('access_token');
            localStorage.removeItem('refresh_token');
        } catch (error) {
            console.error('Logout error:', error);
        } finally {
            setIsAuthenticated(false);
            setUser(null);
        }
    };

    const value = {
        isAuthenticated,
        isLoading,
        user,
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