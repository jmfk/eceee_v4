import React, { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { LogIn, AlertCircle } from 'lucide-react';

/**
 * SessionExpiredOverlay - Modal overlay shown when session expires
 * 
 * Blocks interaction with the underlying page and prompts user to re-authenticate.
 * After successful login, automatically retries all queued API requests.
 */
const SessionExpiredOverlay = () => {
    const { sessionExpired, login, setSessionExpired } = useAuth();
    const [credentials, setCredentials] = useState({ username: '', password: '' });
    const [error, setError] = useState('');
    const [isLoading, setIsLoading] = useState(false);

    // Don't render if session hasn't expired
    if (!sessionExpired) {
        return null;
    }

    const handleChange = (e) => {
        const { name, value } = e.target;
        setCredentials(prev => ({ ...prev, [name]: value }));
        // Clear error when user starts typing
        if (error) setError('');
    };

    const handleSubmit = async (e) => {
        e.preventDefault();

        if (!credentials.username || !credentials.password) {
            setError('Please enter both username and password');
            return;
        }

        setIsLoading(true);
        setError('');

        try {
            // Use JWT authentication endpoint
            const response = await fetch('/api/v1/auth/token/', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                credentials: 'include',
                body: JSON.stringify({
                    username: credentials.username,
                    password: credentials.password,
                })
            });

            if (response.ok) {
                const data = await response.json();

                // Store JWT tokens
                localStorage.setItem('access_token', data.access);
                localStorage.setItem('refresh_token', data.refresh);

                // Update authentication state and retry queued requests
                await login(credentials);

                // Clear form and close overlay
                setCredentials({ username: '', password: '' });
                setSessionExpired(false);
            } else {
                const errorData = await response.json().catch(() => ({}));
                if (response.status === 401) {
                    setError('Invalid username or password');
                } else {
                    setError(errorData.detail || 'Login failed. Please try again.');
                }
            }
        } catch (err) {
            console.error('Login error:', err);
            setError('An error occurred during login. Please try again.');
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div
            className="fixed inset-0 bg-black/50 flex items-center justify-center"
            style={{ zIndex: 10000 }}
        >
            <div className="bg-white rounded-lg shadow-2xl p-8 max-w-md w-full mx-4">
                {/* Header */}
                <div className="flex items-center justify-center mb-6">
                    <div className="bg-yellow-100 p-3 rounded-full">
                        <AlertCircle className="w-8 h-8 text-yellow-600" />
                    </div>
                </div>

                <div className="text-2xl font-bold text-gray-900 text-center mb-2" role="heading" aria-level="2">
                    Session Expired
                </div>
                <div className="text-gray-600 text-center mb-6">
                    Your session has expired. Please log in to continue working.
                </div>
                <div className="text-sm text-gray-500 text-center mb-6">
                    Don't worry — your work is safe and will be preserved.
                </div>

                {/* Login Form */}
                <form onSubmit={handleSubmit} className="space-y-4">
                    {error && (
                        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">
                            {error}
                        </div>
                    )}

                    <div>
                        <label htmlFor="username" className="block text-sm font-medium text-gray-700 mb-1">
                            Username
                        </label>
                        <input
                            id="username"
                            name="username"
                            type="text"
                            autoComplete="username"
                            autoFocus
                            required
                            value={credentials.username}
                            onChange={handleChange}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                            disabled={isLoading}
                        />
                    </div>

                    <div>
                        <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-1">
                            Password
                        </label>
                        <input
                            id="password"
                            name="password"
                            type="password"
                            autoComplete="current-password"
                            required
                            value={credentials.password}
                            onChange={handleChange}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                            disabled={isLoading}
                        />
                    </div>

                    <button
                        type="submit"
                        disabled={isLoading}
                        className="w-full flex items-center justify-center gap-2 bg-blue-600 text-white py-2 px-4 rounded-lg hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                    >
                        {isLoading ? (
                            <>
                                <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                                <span>Logging in...</span>
                            </>
                        ) : (
                            <>
                                <LogIn className="w-5 h-5" />
                                <span>Log In</span>
                            </>
                        )}
                    </button>
                </form>
            </div>
        </div>
    );
};

export default SessionExpiredOverlay;

