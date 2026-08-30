import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import PageTreeNode from '../PageTreeNode'
import { NotificationProvider } from '../NotificationManager'

vi.mock('../../utils/apiValidation.js', () => ({
    getPageDisplayUrl: vi.fn(() => '/responsive-page'),
    isRootPage: vi.fn(() => true),
    sanitizePageData: vi.fn(page => page),
}))

const responsivePage = {
    id: 42,
    title: 'A very long published page title that must remain available to editors',
    slug: 'long-published-page-title',
    parent: null,
    sortOrder: 10,
    children: [],
    childrenCount: 12,
    hostnames: [],
    publicationStatus: 'published',
    latestVersionNumber: 8,
    publishedVersionNumber: 7,
    latestDraftVersionNumber: 8,
    hasUnpublishedChanges: true,
}

const renderNode = props => {
    const queryClient = new QueryClient({
        defaultOptions: {
            queries: { retry: false },
            mutations: { retry: false },
        },
    })

    return render(
        <QueryClientProvider client={queryClient}>
            <NotificationProvider>
                <PageTreeNode page={responsivePage} {...props} />
            </NotificationProvider>
        </QueryClientProvider>
    )
}

describe('PageTreeNode responsive actions and metadata', () => {
    beforeEach(() => {
        vi.clearAllMocks()
    })

    it('keeps long titles and publication metadata accessible in separate regions', () => {
        renderNode({ level: 6 })

        expect(screen.getByTestId('page-tree-identity-long-published-page-title')).toBeInTheDocument()
        expect(screen.getByTestId('page-tree-metadata-long-published-page-title')).toBeInTheDocument()
        expect(screen.getByTitle(responsivePage.title)).toHaveAccessibleName(`Edit ${responsivePage.title}`)
        expect(screen.getByText('Published')).toBeVisible()
        expect(screen.getByText('📗 v7')).toBeVisible()
        expect(screen.getByText('✏️ v8')).toBeVisible()
        expect(screen.getByLabelText('Missing hostname')).toBeVisible()

        const row = screen.getByTestId('page-tree-node-long-published-page-title')
        expect(row.style.getPropertyValue('--tree-indent-mobile')).toBe('44px')
        expect(row.style.getPropertyValue('--tree-indent-desktop')).toBe('152px')
    })

    it('keeps primary actions visible and exposes secondary actions through a labelled menu', async () => {
        const user = userEvent.setup()
        const onEdit = vi.fn()
        const onAddPageBelow = vi.fn()
        const onCut = vi.fn()
        renderNode({ onEdit, onAddPageBelow, onCut })

        await user.click(screen.getByTestId('page-tree-edit-long-published-page-title'))
        await user.click(screen.getByTestId('page-tree-add-child-long-published-page-title'))
        expect(onEdit).toHaveBeenCalledWith(expect.objectContaining({ id: 42 }))
        expect(onAddPageBelow).toHaveBeenCalledWith(expect.objectContaining({ id: 42 }))

        const menuButton = screen.getByRole('button', { name: `More actions for ${responsivePage.title}` })
        await user.click(menuButton)

        const menu = screen.getByRole('menu', { name: `Actions for ${responsivePage.title}` })
        expect(menu).toBeVisible()
        expect(screen.getByRole('menuitem', { name: 'Move up' })).toHaveFocus()
        expect(screen.getByRole('menuitem', { name: 'Import as child' })).toBeVisible()
        expect(screen.getByRole('menuitem', { name: 'Delete' })).toBeVisible()

        await user.click(screen.getByRole('menuitem', { name: 'Cut' }))
        expect(onCut).toHaveBeenCalledWith(42)
        expect(menu).not.toBeInTheDocument()
    })
})
