import axios from 'axios'

// API client configuration for Django backend with CSRF token handling
const API_BASE_URL = 'http://localhost:8000'

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

// Request interceptor to add CSRF token
apiClient.interceptors.request.use(
    async (config) => {
        // Get CSRF token if we don't have one
        if (!csrfToken) {
            await getCsrfToken()
        }

        // Add CSRF token to headers for unsafe methods
        if (config.method && !['get', 'head', 'options', 'trace'].includes(config.method.toLowerCase())) {
            if (csrfToken) {
                config.headers['X-CSRFToken'] = csrfToken
            }
        }

        return config
    },
    (error) => {
        return Promise.reject(error)
    }
)

// Response interceptor for error handling
apiClient.interceptors.response.use(
    (response) => response,
    async (error) => {
        // If we get a 403 Forbidden (CSRF failure), try to refresh the token
        if (error.response?.status === 403 && error.response?.data?.detail?.includes('CSRF')) {
            console.log('CSRF token expired, refreshing...')
            csrfToken = null
            await getCsrfToken()

            // Retry the original request with new token
            if (csrfToken && error.config) {
                error.config.headers['X-CSRFToken'] = csrfToken
                return apiClient.request(error.config)
            }
        }

        return Promise.reject(error)
    }
)

// Initialize CSRF token when module loads
getCsrfToken()

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