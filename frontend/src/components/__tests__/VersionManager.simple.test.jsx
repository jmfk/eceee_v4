import { describe, it, expect, vi } from 'vitest'
import { render } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import VersionManager from '../VersionManager'

// Mock the API module
vi.mock('../../api/versions', () => ({
    getPageVersions: vi.fn().mockResolvedValue({ results: [] }),
    getVersion: vi.fn().mockResolvedValue({}),
    createVersion: vi.fn().mockResolvedValue({}),
    updateVersion: vi.fn().mockResolvedValue({}),
    deleteVersion: vi.fn().mockResolvedValue({}),
    publishVersion: vi.fn().mockResolvedValue({}),
    createDraftFromPublished: vi.fn().mockResolvedValue({}),
    restoreVersion: vi.fn().mockResolvedValue({}),
    compareVersions: vi.fn().mockResolvedValue({}),
    getVersionStats: vi.fn().mockResolvedValue({
        total_drafts: 0,
        total_published: 0,
        has_current: false,
        current_version: null
    }),
    formatVersionForDisplay: vi.fn().mockImplementation(v => v),
    canEditVersion: vi.fn().mockReturnValue(false),
    canPublishVersion: vi.fn().mockReturnValue(false),
    canDeleteVersion: vi.fn().mockReturnValue(false),
    canCreateDraft: vi.fn().mockReturnValue(false)
}))

// Mock react-hot-toast
vi.mock('react-hot-toast', () => ({
    default: {
        success: vi.fn(),
        error: vi.fn()
    }
}))

const createWrapper = () => {
    const queryClient = new QueryClient({
        defaultOptions: {
            queries: { retry: false },
            mutations: { retry: false }
        }
    })

    return ({ children }) => (
        <QueryClientProvider client={queryClient}>
            {children}
        </QueryClientProvider>
    )
}

describe('VersionManager', () => {
    it('renders without errors', () => {
        const onClose = vi.fn()

        expect(() => {
            render(
                <VersionManager pageId={1} onClose={onClose} />,
                { wrapper: createWrapper() }
            )
        }).not.toThrow()
    })

    it('accepts required props', () => {
        const onClose = vi.fn()
        const pageId = 123

        expect(() => {
            render(
                <VersionManager pageId={pageId} onClose={onClose} />,
                { wrapper: createWrapper() }
            )
        }).not.toThrow()
    })
}) 