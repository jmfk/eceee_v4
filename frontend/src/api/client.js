import axios from 'axios'
import { convertKeysToCamel } from '../utils/caseConversion'

// API client configuration for Django backend with CSRF token handling
const API_BASE_URL = ''

// Create axios instance with base configuration
const apiClient = axios.create({
    baseURL: API_BASE_URL,
    withCredentials: true, // Important for CSRF and session handling
    headers: {
        'Content-Type': 'application/json',
    },
})

// CSRF token management
let csrfToken = null

// Function to get CSRF token from Django
export const getCsrfToken = async () => {
    try {
        const response = await fetch(`${API_BASE_URL}/csrf-token/`, {
            credentials: 'include', // Include cookies for session
        })
        if (response.ok) {
            const data = await response.json()
            csrfToken = data.csrfToken
            return csrfToken
        }
    } catch (error) {
        console.error('Failed to get CSRF token:', error)
    }

    // Fallback: try to get from cookie
    const cookieValue = document.cookie
        .split('; ')
        .find(row => row.startsWith('csrftoken='))
        ?.split('=')[1]

    if (cookieValue) {
        csrfToken = cookieValue
        return csrfToken
    }

    return null
}

// Request interceptor to add JWT token and CSRF token
apiClient.interceptors.request.use(
    async (config) => {
        // Add JWT token to requests
        const accessToken = localStorage.getItem('access_token');
        if (accessToken) {
            config.headers['Authorization'] = `Bearer ${accessToken}`;
        }

        // Add CSRF token for non-GET requests
        if (config.method && config.method.toLowerCase() !== 'get') {
            // Try to get CSRF token from cookie
            const cookieValue = document.cookie
                .split('; ')
                .find(row => row.startsWith('csrftoken='))
                ?.split('=')[1]

            if (cookieValue) {
                config.headers['X-CSRFToken'] = cookieValue
            } else if (!csrfToken) {
                // If we don't have a token cached, try to get it
                await getCsrfToken()
            }

            if (csrfToken) {
                config.headers['X-CSRFToken'] = csrfToken
            }
        }

        // Note: Case conversion is handled by djangorestframework-camel-case on the backend
        // Frontend should send camelCase data and receive camelCase responses

        return config
    },
    (error) => {
        return Promise.reject(error)
    }
)

// Response interceptor for error handling and token refresh
apiClient.interceptors.response.use(
    (response) => {
        // Note: Case conversion is handled by djangorestframework-camel-case on the backend
        // Backend should send camelCase data directly
        return response
    },
    async (error) => {
        const originalRequest = error.config;

        // If we get a 401 Unauthorized, try to refresh the token
        if (error.response?.status === 401 && !originalRequest._retry) {
            originalRequest._retry = true;

            const refreshToken = localStorage.getItem('refresh_token');
            if (refreshToken) {
                try {
                    const response = await fetch('/api/v1/auth/token/refresh/', {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                        },
                        body: JSON.stringify({
                            refresh: refreshToken
                        })
                    });

                    if (response.ok) {
                        const data = await response.json();
                        localStorage.setItem('access_token', data.access);

                        // Retry the original request with new token
                        originalRequest.headers['Authorization'] = `Bearer ${data.access}`;
                        return apiClient.request(originalRequest);
                    } else {
                        // Refresh failed, clear tokens and redirect to login
                        localStorage.removeItem('access_token');
                        localStorage.removeItem('refresh_token');
                        window.location.href = '/login';
                    }
                } catch (refreshError) {
                    console.error('Token refresh failed:', refreshError);
                    localStorage.removeItem('access_token');
                    localStorage.removeItem('refresh_token');
                    window.location.href = '/login';
                }
            } else {
                // No refresh token, redirect to login
                window.location.href = '/login';
            }
        }

        // Convert error response data as well
        if (error.response?.data && typeof error.response.data === 'object') {
            error.response.data = convertKeysToCamel(error.response.data)
        }

        return Promise.reject(error)
    }
)

// JWT authentication is handled via interceptors

export default apiClient

// Utility functions for common HTTP methods
export const api = {
    get: (url, config = {}) => apiClient.get(url, config),
    post: (url, data = {}, config = {}) => apiClient.post(url, data, config),
    put: (url, data = {}, config = {}) => apiClient.put(url, data, config),
    patch: (url, data = {}, config = {}) => apiClient.patch(url, data, config),
    delete: (url, config = {}) => apiClient.delete(url, config),
}

// Function to manually refresh CSRF token
export const refreshCsrfToken = () => {
    csrfToken = null
    return getCsrfToken()
} 