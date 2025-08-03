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
            // Try to make an authenticated request to check status
            const response = await fetch('/api/v1/webpages/pages/', {
                credentials: 'include'
            });

            if (response.ok) {
                setIsAuthenticated(true);
                // Optionally fetch user details
                // const userData = await fetchUserDetails();
                // setUser(userData);
            } else if (response.status === 401) {
                setIsAuthenticated(false);
                setUser(null);
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
            // Get CSRF token first
            const csrfResponse = await fetch('/csrf-token/', {
                credentials: 'include'
            });
            const csrfData = await csrfResponse.json();

            // Logout request
            await fetch('/admin/logout/', {
                method: 'POST',
                headers: {
                    'X-CSRFToken': csrfData.csrfToken,
                },
                credentials: 'include'
            });
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