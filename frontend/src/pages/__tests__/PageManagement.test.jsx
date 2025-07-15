import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import PageManagement from '../PageManagement'

// Mock the child components
vi.mock('@components/LayoutEditor', () => ({
    default: () => <div data-testid="layout-editor">Layout Editor Component</div>
}))

vi.mock('@components/ThemeEditor', () => ({
    default: () => <div data-testid="theme-editor">Theme Editor Component</div>
}))

vi.mock('@components/PagePreview', () => ({
    default: ({ pageId, layoutId, themeId }) => (
        <div data-testid="page-preview">
            Page Preview Component
            {pageId && <span data-testid="preview-page-id">{pageId}</span>}
            {layoutId && <span data-testid="preview-layout-id">{layoutId}</span>}
            {themeId && <span data-testid="preview-theme-id">{themeId}</span>}
        </div>
    )
}))

const createTestQueryClient = () => {
    return new QueryClient({
        defaultOptions: {
            queries: {
                retry: false,
            },
        },
    })
}

const renderWithQueryClient = (component) => {
    const queryClient = createTestQueryClient()
    return render(
        <QueryClientProvider client={queryClient}>
            {component}
        </QueryClientProvider>
    )
}

describe('PageManagement', () => {
    beforeEach(() => {
        vi.clearAllMocks()
    })

    it('renders the page management interface', () => {
        renderWithQueryClient(<PageManagement />)

        expect(screen.getByText('Page Management System')).toBeInTheDocument()
        expect(screen.getByText('Phase 3: Layout and Theme System')).toBeInTheDocument()
    })

    it('displays all navigation tabs', () => {
        renderWithQueryClient(<PageManagement />)

        expect(screen.getByText('Layouts')).toBeInTheDocument()
        expect(screen.getByText('Themes')).toBeInTheDocument()
        expect(screen.getByText('Preview')).toBeInTheDocument()
        expect(screen.getByText('Inheritance')).toBeInTheDocument()
    })

    it('shows tab descriptions', () => {
        renderWithQueryClient(<PageManagement />)

        // Default tab should be layouts
        expect(screen.getByText('Create and manage page layout templates')).toBeInTheDocument()
    })

    it('switches between tabs correctly', async () => {
        const user = userEvent.setup()
        renderWithQueryClient(<PageManagement />)

        // Should start with layouts tab
        expect(screen.getByTestId('layout-editor')).toBeInTheDocument()

        // Switch to themes tab
        const themesTab = screen.getByText('Themes')
        await user.click(themesTab)

        expect(screen.getByTestId('theme-editor')).toBeInTheDocument()
        expect(screen.getByText('Design color schemes and styling')).toBeInTheDocument()

        // Switch to preview tab
        const previewTab = screen.getByText('Preview')
        await user.click(previewTab)

        expect(screen.getByTestId('page-preview')).toBeInTheDocument()
        expect(screen.getByText('Preview layout and theme combinations')).toBeInTheDocument()

        // Switch to inheritance tab
        const inheritanceTab = screen.getByText('Inheritance')
        await user.click(inheritanceTab)

        expect(screen.getByText('Inheritance Management')).toBeInTheDocument()
        expect(screen.getByText('Manage inheritance hierarchy')).toBeInTheDocument()
    })

    it('renders layout editor in layouts tab', async () => {
        const user = userEvent.setup()
        renderWithQueryClient(<PageManagement />)

        // Should start with layouts tab
        expect(screen.getByTestId('layout-editor')).toBeInTheDocument()
    })

    it('renders theme editor in themes tab', async () => {
        const user = userEvent.setup()
        renderWithQueryClient(<PageManagement />)

        const themesTab = screen.getByText('Themes')
        await user.click(themesTab)

        expect(screen.getByTestId('theme-editor')).toBeInTheDocument()
    })

    it('renders preview interface in preview tab', async () => {
        const user = userEvent.setup()
        renderWithQueryClient(<PageManagement />)

        const previewTab = screen.getByText('Preview')
        await user.click(previewTab)

        expect(screen.getByText('Layout & Theme Preview')).toBeInTheDocument()
        expect(screen.getByText('Test how different layout and theme combinations will look together.')).toBeInTheDocument()
        expect(screen.getByTestId('page-preview')).toBeInTheDocument()
    })

    it('handles preview form interactions', async () => {
        const user = userEvent.setup()
        renderWithQueryClient(<PageManagement />)

        // Switch to preview tab
        const previewTab = screen.getByText('Preview')
        await user.click(previewTab)

        // Select a sample page using the proper ID
        const pageSelect = screen.getByDisplayValue('Select a page to preview...')
        await user.selectOptions(pageSelect, '1')

        // Preview component should receive the pageId
        expect(screen.getByTestId('preview-page-id')).toHaveTextContent('1')

        // Select layout override
        const layoutSelect = screen.getByDisplayValue('Use inherited layout')
        await user.selectOptions(layoutSelect, '2')

        expect(screen.getByTestId('preview-layout-id')).toHaveTextContent('2')

        // Select theme override
        const themeSelect = screen.getByDisplayValue('Use inherited theme')
        await user.selectOptions(themeSelect, '3')

        expect(screen.getByTestId('preview-theme-id')).toHaveTextContent('3')
    })

    it('renders inheritance management interface', async () => {
        const user = userEvent.setup()
        renderWithQueryClient(<PageManagement />)

        const inheritanceTab = screen.getByText('Inheritance')
        await user.click(inheritanceTab)

        expect(screen.getByText('Inheritance Management')).toBeInTheDocument()
        expect(screen.getByText('Visualize and manage how layouts, themes, and widgets inherit through the page hierarchy.')).toBeInTheDocument()
        expect(screen.getByDisplayValue('Choose a page...')).toBeInTheDocument()
        expect(screen.getByText('Quick Actions')).toBeInTheDocument()
    })

    it('handles inheritance page selection', async () => {
        const user = userEvent.setup()
        renderWithQueryClient(<PageManagement />)

        const inheritanceTab = screen.getByText('Inheritance')
        await user.click(inheritanceTab)

        const pageSelect = screen.getByDisplayValue('Choose a page...')
        await user.selectOptions(pageSelect, '1')

        // Should show inheritance visualization
        expect(screen.getByText('Inheritance Chain')).toBeInTheDocument()
        expect(screen.getByText('Layout Inheritance')).toBeInTheDocument()
        expect(screen.getByText('Theme Inheritance')).toBeInTheDocument()
    })

    it('enables quick action buttons when page is selected', async () => {
        const user = userEvent.setup()
        renderWithQueryClient(<PageManagement />)

        const inheritanceTab = screen.getByText('Inheritance')
        await user.click(inheritanceTab)

        // Buttons should be disabled initially
        expect(screen.getByText('View Inheritance')).toBeDisabled()
        expect(screen.getByText('Override Layout')).toBeDisabled()
        expect(screen.getByText('Override Theme')).toBeDisabled()

        // Select a page
        const pageSelect = screen.getByDisplayValue('Choose a page...')
        await user.selectOptions(pageSelect, '1')

        // Buttons should now be enabled
        expect(screen.getByText('View Inheritance')).toBeEnabled()
        expect(screen.getByText('Override Layout')).toBeEnabled()
        expect(screen.getByText('Override Theme')).toBeEnabled()
    })

    it('displays inheritance visualization with mock data', async () => {
        const user = userEvent.setup()
        renderWithQueryClient(<PageManagement />)

        const inheritanceTab = screen.getByText('Inheritance')
        await user.click(inheritanceTab)

        const pageSelect = screen.getByDisplayValue('Choose a page...')
        await user.selectOptions(pageSelect, '1')

        // Check that the inheritance section appears after selecting a page
        expect(screen.getByText('Inheritance Chain')).toBeInTheDocument()
        expect(screen.getByText('Layout Inheritance')).toBeInTheDocument()
        expect(screen.getByText('Theme Inheritance')).toBeInTheDocument()

        // Check that conflicts section is visible
        expect(screen.getByText('✓ No Inheritance Conflicts')).toBeInTheDocument()
        expect(screen.getByText('All inheritance relationships are properly configured.')).toBeInTheDocument()
    })

    it('shows tab icons correctly', () => {
        renderWithQueryClient(<PageManagement />)

        // Check that icons are rendered (they should be in the DOM)
        const tabs = screen.getAllByRole('button')
        expect(tabs).toHaveLength(4) // 4 tabs
    })

    it('updates tab description when switching tabs', async () => {
        const user = userEvent.setup()
        renderWithQueryClient(<PageManagement />)

        // Default description
        expect(screen.getByText('Create and manage page layout templates')).toBeInTheDocument()

        // Switch to themes
        const themesTab = screen.getByText('Themes')
        await user.click(themesTab)

        expect(screen.getByText('Design color schemes and styling')).toBeInTheDocument()

        // Switch to preview
        const previewTab = screen.getByText('Preview')
        await user.click(previewTab)

        expect(screen.getByText('Preview layout and theme combinations')).toBeInTheDocument()

        // Switch to inheritance
        const inheritanceTab = screen.getByText('Inheritance')
        await user.click(inheritanceTab)

        expect(screen.getByText('Manage inheritance hierarchy')).toBeInTheDocument()
    })

    it('maintains state when switching between tabs', async () => {
        const user = userEvent.setup()
        renderWithQueryClient(<PageManagement />)

        // Switch to preview and set some values
        const previewTab = screen.getByText('Preview')
        await user.click(previewTab)

        const pageSelect = screen.getByDisplayValue('Select a page to preview...')
        await user.selectOptions(pageSelect, '2')

        // Switch to another tab and back
        const layoutsTab = screen.getByText('Layouts')
        await user.click(layoutsTab)

        await user.click(previewTab)

        // Values should be maintained
        expect(pageSelect.value).toBe('2')
    })

    it('clears preview selections when option is deselected', async () => {
        const user = userEvent.setup()
        renderWithQueryClient(<PageManagement />)

        const previewTab = screen.getByText('Preview')
        await user.click(previewTab)

        const pageSelect = screen.getByDisplayValue('Select a page to preview...')
        await user.selectOptions(pageSelect, '1')

        // Clear selection
        await user.selectOptions(pageSelect, '')

        // Should not show page ID in preview
        expect(screen.queryByTestId('preview-page-id')).not.toBeInTheDocument()
    })
}) 