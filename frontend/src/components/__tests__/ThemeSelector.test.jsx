import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { fireEvent, render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import ThemeSelector from '../ThemeSelector'

const mocks = vi.hoisted(() => ({
    listThemes: vi.fn(),
}))

vi.mock('../../api', () => ({
    themesApi: {
        list: mocks.listThemes,
    },
}))

const themes = [
    { id: 1, name: 'System Default', image: null },
    { id: 2, name: 'Industry', image: null },
]

const renderSelector = (props = {}) => {
    const queryClient = new QueryClient({
        defaultOptions: { queries: { retry: false } },
    })

    return render(
        <QueryClientProvider client={queryClient}>
            <ThemeSelector
                selectedThemeId={2}
                effectiveThemeId={2}
                themeInheritanceInfo={{ source: 'explicit', inheritedFrom: null }}
                hasParent
                onThemeChange={vi.fn()}
                {...props}
            />
        </QueryClientProvider>,
    )
}

describe('ThemeSelector', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        mocks.listThemes.mockResolvedValue(themes)
    })

    it('offers parent inheritance when a child page overrides its theme', async () => {
        const onThemeChange = vi.fn()
        renderSelector({ onThemeChange })

        const inheritOption = await screen.findByRole('button', { name: /inherit from parent/i })
        expect(inheritOption).toHaveAttribute('aria-pressed', 'false')
        expect(screen.getByText(/this page overrides the theme inherited from parent/i)).toBeInTheDocument()

        fireEvent.click(inheritOption)

        expect(onThemeChange).toHaveBeenCalledWith(null)
    })

    it('shows the inherited source and selects the automatic option', async () => {
        renderSelector({
            selectedThemeId: null,
            effectiveThemeId: 1,
            themeInheritanceInfo: {
                source: 'inherited',
                inheritedFrom: { title: 'Home' },
            },
        })

        const inheritOption = await screen.findByRole('button', { name: /inherit from parent/i })
        expect(inheritOption).toHaveAttribute('aria-pressed', 'true')
        expect(screen.getByText('Inherited from Home')).toBeInTheDocument()
        expect(screen.getByText('Follow the parent page (Home)')).toBeInTheDocument()
    })

    it('allows a root page to follow the system default instead of pinning a theme', async () => {
        const onThemeChange = vi.fn()
        renderSelector({ hasParent: false, onThemeChange })

        const defaultOption = await screen.findByRole('button', { name: /use system default/i })
        fireEvent.click(defaultOption)

        expect(onThemeChange).toHaveBeenCalledWith(null)
        expect(screen.queryByText(/this page overrides the theme inherited/i)).not.toBeInTheDocument()
    })

    it('uses the Settings card treatment when embedded', async () => {
        const { container } = renderSelector({ embedded: true })

        await screen.findByRole('button', { name: /inherit from parent/i })

        expect(container.firstChild).toHaveClass('rounded-lg', 'shadow', 'overflow-hidden')
        expect(container.firstChild).not.toHaveClass('h-full')
    })
})
