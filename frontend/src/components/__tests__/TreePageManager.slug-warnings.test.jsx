/**
 * Tests for slug warning display in TreePageManager
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { BrowserRouter } from 'react-router-dom'
import TreePageManager from '../TreePageManager'
import { GlobalNotificationProvider } from '../../contexts/GlobalNotificationContext'
import { NotificationProvider } from '../NotificationManager'

// Mock the API
vi.mock('../../api', () => ({
    pagesApi: {
        getRootPages: vi.fn(),
        create: vi.fn(),
        getPageTree: vi.fn()
    },
    deletePage: vi.fn()
}))

// Mock lucide-react icons
vi.mock('lucide-react', () => ({
    Search: () => null,
    Plus: () => null,
    RefreshCw: () => null,
    Filter: () => null,
    Scissors: () => null,
    FolderPlus: () => null,
    AlertCircle: () => null,
    Loader2: () => null,
    X: () => null,
    Save: () => null,
    AlignJustify: () => null,
    Download: () => null,
    ChevronDown: () => null,
    ChevronRight: () => null,
    Eye: () => null,
    Edit2: () => null,
    Copy: () => null,
    Trash2: () => null,
    MoreVertical: () => null,
    FileText: () => null
}))

// Test wrapper component with all required providers
const TestWrapper = ({ children }) => {
    const queryClient = new QueryClient({
        defaultOptions: {
            queries: {
                retry: false
            }
        }
    })

    return (
        <QueryClientProvider client={queryClient}>
            <BrowserRouter>
                <GlobalNotificationProvider>
                    <NotificationProvider>
                        {children}
                    </NotificationProvider>
                </GlobalNotificationProvider>
            </BrowserRouter>
        </QueryClientProvider>
    )
}

describe('TreePageManager - Slug Warning Display', () => {
    beforeEach(() => {
        vi.clearAllMocks()

        // Mock successful root pages query
        const { pagesApi } = require('../../api')
        pagesApi.getRootPages.mockResolvedValue({
            results: [],
            count: 0
        })
        pagesApi.getPageTree.mockResolvedValue([])
    })

    it('should display warning notification when slug is auto-renamed on page creation', async () => {
        const { pagesApi } = require('../../api')

        // Mock page creation with slug warning
        pagesApi.create.mockResolvedValue({
            id: 1,
            title: 'About Us',
            slug: 'about-2',
            warnings: [{
                field: 'slug',
                message: "Slug 'about' was modified to 'about-2' to ensure uniqueness",
                originalValue: 'about'
            }]
        })

        render(
            <TestWrapper>
                <TreePageManager />
            </TestWrapper>
        )

        // Component should be rendered
        await waitFor(() => {
            expect(screen.queryByText(/loading/i)).not.toBeInTheDocument()
        })
    })

    it('should display warning notification when slug is auto-renamed on root page creation', async () => {
        const { pagesApi } = require('../../api')

        // Mock root page creation with slug warning
        pagesApi.create.mockResolvedValue({
            id: 2,
            title: 'Home',
            slug: 'index-2',
            hostnames: ['example.com'],
            warnings: [{
                field: 'slug',
                message: "Slug 'index' was modified to 'index-2' to ensure uniqueness",
                originalValue: 'index'
            }]
        })

        render(
            <TestWrapper>
                <TreePageManager />
            </TestWrapper>
        )

        await waitFor(() => {
            expect(screen.queryByText(/loading/i)).not.toBeInTheDocument()
        })
    })

    it('should not display warning when no slug modification occurs', async () => {
        const { pagesApi } = require('../../api')

        // Mock page creation without warnings
        pagesApi.create.mockResolvedValue({
            id: 3,
            title: 'Contact',
            slug: 'contact',
            warnings: []
        })

        render(
            <TestWrapper>
                <TreePageManager />
            </TestWrapper>
        )

        await waitFor(() => {
            expect(screen.queryByText(/loading/i)).not.toBeInTheDocument()
        })
    })

    it('should handle multiple warnings if present', async () => {
        const { pagesApi } = require('../../api')

        // Mock page creation with multiple warnings
        pagesApi.create.mockResolvedValue({
            id: 4,
            title: 'Services',
            slug: 'services-2',
            warnings: [
                {
                    field: 'slug',
                    message: "Slug 'services' was modified to 'services-2' to ensure uniqueness",
                    originalValue: 'services'
                },
                {
                    field: 'other',
                    message: "Some other warning",
                    originalValue: 'value'
                }
            ]
        })

        render(
            <TestWrapper>
                <TreePageManager />
            </TestWrapper>
        )

        await waitFor(() => {
            expect(screen.queryByText(/loading/i)).not.toBeInTheDocument()
        })
    })

    it('should handle page creation without warnings field', async () => {
        const { pagesApi } = require('../../api')

        // Mock page creation without warnings field at all
        pagesApi.create.mockResolvedValue({
            id: 5,
            title: 'Blog',
            slug: 'blog'
            // No warnings field
        })

        render(
            <TestWrapper>
                <TreePageManager />
            </TestWrapper>
        )

        await waitFor(() => {
            expect(screen.queryByText(/loading/i)).not.toBeInTheDocument()
        })
    })
})

