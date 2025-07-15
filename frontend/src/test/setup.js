import '@testing-library/jest-dom'
import { beforeAll, afterEach, afterAll } from 'vitest'
import { cleanup } from '@testing-library/react'

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

// Mock fetch for API calls
global.fetch = vi.fn()

beforeAll(() => {
    // Setup global mocks
})

afterAll(() => {
    // Cleanup global mocks
}) 