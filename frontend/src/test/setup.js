import '@testing-library/jest-dom'
import { beforeAll, afterEach, afterAll, vi } from 'vitest'
import { cleanup } from '@testing-library/react'

// Compatibility for legacy tests that still use Jest globals.
global.jest = vi

const createStorageMock = () => {
    const storage = {}
    const entries = new Map()

    Object.defineProperty(storage, 'length', {
        get: () => entries.size,
    })

    storage.key = vi.fn((index) => Array.from(entries.keys())[index] ?? null)
    storage.getItem = vi.fn((key) => {
        const normalizedKey = String(key)
        return entries.has(normalizedKey) ? entries.get(normalizedKey) : null
    })
    storage.setItem = vi.fn((key, value) => {
        const normalizedKey = String(key)
        const normalizedValue = String(value)
        entries.set(normalizedKey, normalizedValue)
        storage[normalizedKey] = normalizedValue
    })
    storage.removeItem = vi.fn((key) => {
        const normalizedKey = String(key)
        entries.delete(normalizedKey)
        delete storage[normalizedKey]
    })
    storage.clear = vi.fn(() => {
        for (const key of entries.keys()) {
            delete storage[key]
        }
        entries.clear()
    })

    return storage
}

const installStorageMock = (storageName) => {
    const storage = createStorageMock()

    Object.defineProperty(globalThis, storageName, {
        value: storage,
        configurable: true,
        writable: true,
    })

    if (globalThis.window) {
        Object.defineProperty(globalThis.window, storageName, {
            value: storage,
            configurable: true,
            writable: true,
        })
    }

    return storage
}

installStorageMock('localStorage')
installStorageMock('sessionStorage')

// Mock IntersectionObserver
global.IntersectionObserver = class IntersectionObserver {
    constructor() { }
    disconnect() { }
    observe() { }
    unobserve() { }
}

// Mock ResizeObserver
global.ResizeObserver = class ResizeObserver {
    constructor() { }
    disconnect() { }
    observe() { }
    unobserve() { }
}

// Mock scrollTo
global.scrollTo = vi.fn()

// Clean up after each test
afterEach(() => {
    cleanup()
})

// Mock axios for API calls
const mockAxiosInstance = {
    get: vi.fn(() => Promise.resolve({ data: {} })),
    post: vi.fn(() => Promise.resolve({ data: {} })),
    put: vi.fn(() => Promise.resolve({ data: {} })),
    patch: vi.fn(() => Promise.resolve({ data: {} })),
    delete: vi.fn(() => Promise.resolve({ data: {} })),
    interceptors: {
        request: { use: vi.fn() },
        response: { use: vi.fn() }
    }
}

vi.mock('axios', () => ({
    default: {
        create: vi.fn(() => mockAxiosInstance),
        get: vi.fn(() => Promise.resolve({ data: {} })),
        post: vi.fn(() => Promise.resolve({ data: {} })),
        put: vi.fn(() => Promise.resolve({ data: {} })),
        patch: vi.fn(() => Promise.resolve({ data: {} })),
        delete: vi.fn(() => Promise.resolve({ data: {} })),
    },
}))

// Export the mock instance for tests to use
export { mockAxiosInstance }

// Mock react-hot-toast
vi.mock('react-hot-toast', () => ({
    default: {
        success: vi.fn(),
        error: vi.fn(),
        loading: vi.fn(),
    },
}))

// Mock react-router-dom for components that use navigation
vi.mock('react-router-dom', async () => {
    const actual = await vi.importActual('react-router-dom')
    return {
        ...actual,
        useNavigate: () => vi.fn(),
        useLocation: () => ({
            pathname: '/',
            search: '',
            hash: '',
            state: null,
        }),
    }
})

// Mock IntersectionObserver
global.IntersectionObserver = vi.fn(() => ({
    observe: vi.fn(),
    disconnect: vi.fn(),
    unobserve: vi.fn(),
}))

// Mock ResizeObserver
global.ResizeObserver = vi.fn(() => ({
    observe: vi.fn(),
    disconnect: vi.fn(),
    unobserve: vi.fn(),
}))
