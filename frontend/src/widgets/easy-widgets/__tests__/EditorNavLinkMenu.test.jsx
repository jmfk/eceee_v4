import React from 'react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import userEvent from '@testing-library/user-event'
import EditorNavLink from '../EditorNavLink'
import NavigationWidget from '../NavigationWidget'
import NavbarWidget from '../NavbarWidget'
import { api } from '../../../api/client'
import { versionsApi } from '../../../api/versions'
import { usePageChildren } from '../../../hooks/usePageStructure'

vi.mock('../../../api/client', () => ({
    api: {
        get: vi.fn(),
    },
}))

vi.mock('../../../api/versions', () => ({
    versionsApi: {
        getLatestVersionForPage: vi.fn(),
    },
}))

vi.mock('../../../hooks/usePageStructure', () => ({
    usePageChildren: vi.fn(),
}))

const openSpy = vi.fn()

const renderWithQueryClient = (ui) => {
    const queryClient = new QueryClient({
        defaultOptions: {
            queries: { retry: false },
        },
    })
    const Wrapper = ({ children }) => (
        <QueryClientProvider client={queryClient}>
            {children}
        </QueryClientProvider>
    )
    return render(ui, { wrapper: Wrapper })
}

beforeEach(() => {
    vi.clearAllMocks()
    window.open = openSpy
    Object.defineProperty(window, 'innerWidth', {
        value: 1200,
        configurable: true,
    })
    usePageChildren.mockReturnValue({ data: [] })
    api.get.mockResolvedValue({
        data: {
            id: 42,
            title: 'Published Page',
            path: '/published-page/',
            isPublished: true,
        },
    })
    versionsApi.getLatestVersionForPage.mockResolvedValue({
        id: 99,
        versionId: 99,
    })
})

describe('EditorNavLink', () => {
    it('shows all internal page actions for a published target page', async () => {
        const user = userEvent.setup()

        render(
            <EditorNavLink
                mode="editor"
                item={{ type: 'internal', pageId: 42, label: 'Published Page' }}
            />
        )

        await user.click(screen.getByRole('link', { name: 'Published Page' }))

        const publicAction = await screen.findByRole('menuitem', {
            name: 'Open public page in new tab',
        })

        expect(publicAction).toBeEnabled()
        expect(screen.getByRole('menuitem', { name: 'Open preview in new tab' })).toBeEnabled()
        expect(screen.getByRole('menuitem', { name: 'Open editor here' })).toBeEnabled()
        expect(screen.getByRole('menuitem', { name: 'Open editor in new tab' })).toBeEnabled()
    })

    it('disables public-page opening for an unpublished internal target page', async () => {
        const user = userEvent.setup()
        api.get.mockResolvedValueOnce({
            data: {
                id: 42,
                title: 'Draft Page',
                path: '/draft-page/',
                isPublished: false,
            },
        })

        render(
            <EditorNavLink
                mode="editor"
                item={{ type: 'internal', pageId: 42, label: 'Draft Page' }}
            />
        )

        await user.click(screen.getByRole('link', { name: 'Draft Page' }))

        expect(await screen.findByRole('menuitem', { name: 'Open public page in new tab' })).toBeDisabled()
        expect(screen.getByRole('menuitem', { name: 'Open preview in new tab' })).toBeEnabled()
    })

    it('shows only external open action for external links', async () => {
        const user = userEvent.setup()

        render(
            <EditorNavLink
                mode="editor"
                item={{ type: 'external', url: 'https://example.com', label: 'External' }}
            />
        )

        await user.click(screen.getByRole('link', { name: 'External' }))

        expect(screen.getByRole('menuitem', { name: 'Open in new tab' })).toBeEnabled()
        expect(screen.queryByRole('menuitem', { name: 'Open preview in new tab' })).not.toBeInTheDocument()
    })

    it('shows config editing actions for editable menu items', async () => {
        const user = userEvent.setup()

        render(
            <EditorNavLink
                mode="editor"
                item={{
                    type: 'external',
                    url: 'https://example.com',
                    label: 'Editable External',
                    _navListKey: 'menuItems',
                    _navIndex: 0,
                }}
                editorActions={{
                    getListLength: () => 2,
                    onEdit: vi.fn(),
                    onAddAfter: vi.fn(),
                    onMove: vi.fn(),
                    onDelete: vi.fn(),
                }}
            />
        )

        await user.click(screen.getByRole('link', { name: 'Editable External' }))

        expect(screen.getByRole('menuitem', { name: 'Edit menu item' })).toBeEnabled()
        expect(screen.getByRole('menuitem', { name: 'Delete menu item' })).toBeEnabled()
        expect(screen.getByRole('menuitem', { name: 'Add new menu item after' })).toBeEnabled()
        expect(screen.getByRole('menuitem', { name: 'Move backward' })).toBeDisabled()
        expect(screen.getByRole('menuitem', { name: 'Move forward' })).toBeEnabled()
    })
})

describe('NavigationWidget admin links', () => {
    it('opens the internal action menu from React-rendered navigation links', async () => {
        const user = userEvent.setup()

        render(
            <NavigationWidget
                mode="editor"
                config={{
                    menuItems: [
                        {
                            linkData: {
                                type: 'internal',
                                pageId: 42,
                                label: 'About',
                            },
                        },
                    ],
                }}
            />
        )

        await user.click(screen.getByRole('link', { name: 'About' }))

        expect(await screen.findByRole('menuitem', { name: 'Open preview in new tab' })).toBeEnabled()
    })

    it('intercepts component-style navigation links and opens the editor menu', async () => {
        const user = userEvent.setup()

        render(
            <NavigationWidget
                mode="editor"
                config={{
                    navigationStyle: 'custom-nav',
                    menuItems: [
                        {
                            linkData: {
                                type: 'internal',
                                pageId: 42,
                                label: 'Styled About',
                            },
                        },
                    ],
                }}
                context={{
                    theme: {
                        componentStyles: {
                            'custom-nav': {
                                template: '<nav><a href="#">{{#items}}{{label}}{{/items}}</a></nav>',
                                css: '',
                            },
                        },
                    },
                }}
            />
        )

        await user.click(screen.getByRole('link', { name: 'Styled About' }))

        expect(await screen.findByRole('menuitem', { name: 'Open editor in new tab' })).toBeEnabled()
    })

    it('opens the editor menu when an editor widget slot is in display preview mode', async () => {
        const user = userEvent.setup()

        render(
            <NavigationWidget
                mode="display"
                config={{
                    menuItems: [
                        {
                            linkData: {
                                type: 'internal',
                                pageId: 42,
                                label: 'Previewed About',
                            },
                        },
                    ],
                }}
                context={{ isEditorContext: true, slotPreviewMode: true }}
            />
        )

        await user.click(screen.getByRole('link', { name: 'Previewed About' }))

        expect(await screen.findByRole('menuitem', { name: 'Open editor here' })).toBeEnabled()
    })

    it('edits a navigation menu item from the action menu modal', async () => {
        const user = userEvent.setup()
        const onConfigChange = vi.fn()

        renderWithQueryClient(
            <NavigationWidget
                mode="editor"
                onConfigChange={onConfigChange}
                config={{
                    menuItems: [
                        { linkData: { type: 'external', url: 'https://old.test', label: 'Old Label' } },
                    ],
                }}
            />
        )

        await user.click(screen.getByRole('link', { name: 'Old Label' }))
        await user.click(screen.getByRole('menuitem', { name: 'Edit menu item' }))

        const labelInput = screen.getByPlaceholderText('Menu item label')
        await user.clear(labelInput)
        await user.type(labelInput, 'New Label')
        await user.click(screen.getByRole('button', { name: 'Save' }))

        expect(onConfigChange).toHaveBeenCalledWith(expect.objectContaining({
            menuItems: [
                expect.objectContaining({
                    linkData: expect.objectContaining({
                        label: 'New Label',
                        url: 'https://old.test',
                    }),
                    order: 0,
                }),
            ],
        }))
    })

    it('deletes, moves, and adds navigation menu items from the action menu', async () => {
        const user = userEvent.setup()
        const onConfigChange = vi.fn()
        const config = {
            menuItems: [
                { linkData: { type: 'external', url: 'https://one.test', label: 'One' } },
                { linkData: { type: 'external', url: 'https://two.test', label: 'Two' } },
            ],
        }

        const { rerender } = renderWithQueryClient(
            <NavigationWidget
                mode="editor"
                onConfigChange={onConfigChange}
                config={config}
            />
        )

        await user.click(screen.getByRole('link', { name: 'One' }))
        await user.click(screen.getByRole('menuitem', { name: 'Move forward' }))
        expect(onConfigChange).toHaveBeenLastCalledWith(expect.objectContaining({
            menuItems: [
                expect.objectContaining({ linkData: expect.objectContaining({ label: 'Two' }) }),
                expect.objectContaining({ linkData: expect.objectContaining({ label: 'One' }) }),
            ],
        }))

        rerender(
            <NavigationWidget
                mode="editor"
                onConfigChange={onConfigChange}
                config={config}
            />
        )
        await user.click(screen.getByRole('link', { name: 'One' }))
        await user.click(screen.getByRole('menuitem', { name: 'Delete menu item' }))
        expect(onConfigChange).toHaveBeenLastCalledWith(expect.objectContaining({
            menuItems: [
                expect.objectContaining({ linkData: expect.objectContaining({ label: 'Two' }) }),
            ],
        }))

        rerender(
            <NavigationWidget
                mode="editor"
                onConfigChange={onConfigChange}
                config={config}
            />
        )
        await user.click(screen.getByRole('link', { name: 'One' }))
        await user.click(screen.getByRole('menuitem', { name: 'Add new menu item after' }))
        await user.type(screen.getByPlaceholderText('Menu item label'), 'Inserted')
        await user.click(screen.getByRole('button', { name: 'Save' }))

        expect(onConfigChange).toHaveBeenLastCalledWith(expect.objectContaining({
            menuItems: [
                expect.objectContaining({ linkData: expect.objectContaining({ label: 'One' }) }),
                expect.objectContaining({ linkData: expect.objectContaining({ label: 'Inserted' }) }),
                expect.objectContaining({ linkData: expect.objectContaining({ label: 'Two' }) }),
            ],
        }))
    })

    it('intercepts component-style links in editor display preview mode', async () => {
        const user = userEvent.setup()

        render(
            <NavigationWidget
                mode="display"
                config={{
                    navigationStyle: 'custom-nav',
                    menuItems: [
                        {
                            linkData: {
                                type: 'external',
                                url: 'https://styled-preview.test',
                                label: 'Styled Preview',
                            },
                        },
                    ],
                }}
                context={{
                    isEditorContext: true,
                    slotPreviewMode: true,
                    theme: {
                        componentStyles: {
                            'custom-nav': {
                                template: '<nav><a href="https://styled-preview.test">{{#items}}{{label}}{{/items}}</a></nav>',
                                css: '',
                            },
                        },
                    },
                }}
            />
        )

        await user.click(screen.getByRole('link', { name: 'Styled Preview' }))

        expect(await screen.findByRole('menuitem', { name: 'Open in new tab' })).toBeEnabled()
    })
})

describe('NavbarWidget admin links', () => {
    it('opens action menus from primary and secondary navbar links', async () => {
        const user = userEvent.setup()

        render(
            <NavbarWidget
                mode="editor"
                config={{
                    menuItems: [
                        { linkData: { type: 'external', url: 'https://primary.test', label: 'Primary' } },
                    ],
                    secondaryMenuItems: [
                        { linkData: { type: 'external', url: 'https://secondary.test', label: 'Secondary' } },
                    ],
                }}
            />
        )

        await user.click(screen.getByRole('link', { name: 'Primary' }))
        expect(screen.getByRole('menuitem', { name: 'Open in new tab' })).toBeEnabled()

        await user.click(document.body)
        await waitFor(() => {
            expect(screen.queryByRole('menu')).not.toBeInTheDocument()
        })

        await user.click(screen.getByRole('link', { name: 'Secondary' }))
        expect(screen.getByRole('menuitem', { name: 'Open in new tab' })).toBeEnabled()
    })

    it('opens action menus from mobile navbar links', async () => {
        const user = userEvent.setup()
        Object.defineProperty(window, 'innerWidth', {
            value: 500,
            configurable: true,
        })

        render(
            <NavbarWidget
                mode="editor"
                config={{
                    hamburgerBreakpoint: 1000,
                    menuItems: [
                        { linkData: { type: 'external', url: 'https://mobile.test', label: 'Mobile Link' } },
                    ],
                }}
            />
        )

        await user.click(screen.getByRole('button', { name: 'Toggle menu' }))
        await user.click(screen.getByRole('link', { name: 'Mobile Link' }))

        expect(screen.getByRole('menuitem', { name: 'Open in new tab' })).toBeEnabled()
    })

    it('opens action menus from navbar links in editor display preview mode', async () => {
        const user = userEvent.setup()

        render(
            <NavbarWidget
                mode="display"
                context={{ isEditorContext: true, slotPreviewMode: true }}
                config={{
                    menuItems: [
                        { linkData: { type: 'external', url: 'https://preview-navbar.test', label: 'Preview Navbar' } },
                    ],
                }}
            />
        )

        await user.click(screen.getByRole('link', { name: 'Preview Navbar' }))

        expect(screen.getByRole('menuitem', { name: 'Open in new tab' })).toBeEnabled()
    })

    it('updates primary and secondary navbar menu item lists from action menu commands', async () => {
        const user = userEvent.setup()
        const onConfigChange = vi.fn()
        const config = {
            menuItems: [
                { linkData: { type: 'external', url: 'https://primary.test', label: 'Primary' } },
            ],
            secondaryMenuItems: [
                { linkData: { type: 'external', url: 'https://secondary.test', label: 'Secondary' } },
            ],
        }

        const { rerender } = renderWithQueryClient(
            <NavbarWidget
                mode="editor"
                onConfigChange={onConfigChange}
                config={config}
            />
        )

        await user.click(screen.getByRole('link', { name: 'Primary' }))
        await user.click(screen.getByRole('menuitem', { name: 'Add new menu item after' }))
        await user.type(screen.getByPlaceholderText('Menu item label'), 'After Primary')
        await user.click(screen.getByRole('button', { name: 'Save' }))

        expect(onConfigChange).toHaveBeenLastCalledWith(expect.objectContaining({
            menuItems: [
                expect.objectContaining({ linkData: expect.objectContaining({ label: 'Primary' }) }),
                expect.objectContaining({ linkData: expect.objectContaining({ label: 'After Primary' }) }),
            ],
        }))

        rerender(
            <NavbarWidget
                mode="editor"
                onConfigChange={onConfigChange}
                config={config}
            />
        )
        await user.click(screen.getByRole('link', { name: 'Secondary' }))
        await user.click(screen.getByRole('menuitem', { name: 'Delete menu item' }))

        expect(onConfigChange).toHaveBeenLastCalledWith(expect.objectContaining({
            secondaryMenuItems: [],
        }))
    })
})
