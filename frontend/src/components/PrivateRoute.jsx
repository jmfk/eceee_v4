import React, { useEffect } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { canAccessCmsPath } from '../utils/cmsNavigation';
import AccessDenied from './AccessDenied';
import Navbar from './Navbar';
import StatusBar from './StatusBar';

/**
 * PrivateRoute - Protects routes that require authentication
 * 
 * Redirects unauthenticated users to the login page while preserving
 * the intended destination for post-login redirect.
 */
const PrivateRoute = ({ children }) => {
    const { isAuthenticated, isLoading, checkAuthStatus, user } = useAuth();
    const location = useLocation();

    // Re-check auth status when component mounts
    useEffect(() => {
        if (!isAuthenticated && !isLoading) {
            checkAuthStatus();
        }
    }, [isAuthenticated, isLoading, checkAuthStatus]);

    // Show loading spinner while checking auth status
    if (isLoading) {
        return (
            <div className="min-h-screen bg-gray-50 flex items-center justify-center">
                <div className="text-center">
                    <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
                    <div className="text-gray-600">Loading...</div>
                </div>
            </div>
        );
    }

    // Redirect to login if not authenticated
    if (!isAuthenticated) {
        return <Navigate to="/login" state={{ from: location }} replace />;
    }

    if (!canAccessCmsPath(user, location.pathname)) {
        return <div className="fixed inset-0 flex flex-col bg-gray-50">
            <Navbar />
            <main className="flex-1 overflow-y-auto"><AccessDenied /></main>
            <StatusBar />
        </div>;
    }

    // Render the protected component
    return children;
};

export default PrivateRoute;