import { render } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter } from 'react-router-dom'
import { NotificationProvider } from '../components/NotificationManager'
import { GlobalNotificationProvider } from '../contexts/GlobalNotificationContext'
import { UnifiedDataProvider } from '../contexts/unified-data/context/UnifiedDataContext'

// Create a test query client that doesn't retry and has no cache time
export const createTestQueryClient = (options = {}) => {
    return new QueryClient({
        defaultOptions: {
            queries: {
                retry: false,
                cacheTime: 0,
                staleTime: 0,
                refetchOnWindowFocus: false,
                ...options.queries
            },
            mutations: {
                retry: false,
                ...options.mutations
            }
        }
    })
}

// Full provider wrapper with QueryClient and both notification providers
export const createTestWrapper = (queryClient = null) => {
    const client = queryClient || createTestQueryClient()

    return ({ children }) => (
        <QueryClientProvider client={client}>
            <GlobalNotificationProvider>
                <NotificationProvider>
                    {children}
                </NotificationProvider>
            </GlobalNotificationProvider>
        </QueryClientProvider>
    )
}

// Custom render function that includes all providers
export const renderWithProviders = (component, options = {}) => {
    const { queryClient, ...renderOptions } = options
    const client = queryClient || createTestQueryClient()

    const wrapper = ({ children }) => (
        <QueryClientProvider client={client}>
            <GlobalNotificationProvider>
                <NotificationProvider>
                    {children}
                </NotificationProvider>
            </GlobalNotificationProvider>
        </QueryClientProvider>
    )

    return {
        ...render(component, { wrapper, ...renderOptions }),
        queryClient: client
    }
}

// Full app-state wrapper for components that depend on UnifiedDataContext.
export const createStateTestWrapper = (options = {}) => {
    const {
        queryClient,
        initialState,
        route = '/',
        enableDevTools = false
    } = options
    const client = queryClient || createTestQueryClient()

    const wrapper = ({ children }) => (
        <QueryClientProvider client={client}>
            <GlobalNotificationProvider>
                <NotificationProvider>
                    <UnifiedDataProvider initialState={initialState} enableDevTools={enableDevTools}>
                        <MemoryRouter initialEntries={[route]}>
                            {children}
                        </MemoryRouter>
                    </UnifiedDataProvider>
                </NotificationProvider>
            </GlobalNotificationProvider>
        </QueryClientProvider>
    )

    wrapper.queryClient = client
    return wrapper
}

export const renderWithStateProviders = (component, options = {}) => {
    const wrapper = createStateTestWrapper(options)
    const { queryClient, initialState, route, enableDevTools, ...renderOptions } = options

    return {
        ...render(component, { wrapper, ...renderOptions }),
        queryClient: wrapper.queryClient
    }
}

// Legacy wrapper for backward compatibility (QueryClient only)
export const createWrapper = (queryClient = null) => {
    const client = queryClient || createTestQueryClient()

    return ({ children }) => (
        <QueryClientProvider client={client}>
            {children}
        </QueryClientProvider>
    )
} 
