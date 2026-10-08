import { fireEvent, render, screen, within } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import ThemeEditorNavigation from '../ThemeEditorNavigation'

const groups = [
    { id: 'general', label: 'General', items: [{ id: 'basic', label: 'Basic Info' }] },
    { id: 'structure', label: 'Structure', items: [{ id: 'layouts', label: 'Layouts' }, { id: 'typography', label: 'Design Groups' }] },
]

describe('ThemeEditorNavigation', () => {
    it('groups desktop sections into accessible submenus', () => {
        const onSelect = vi.fn()
        render(<ThemeEditorNavigation groups={groups} activeTab="layouts" onSelect={onSelect} />)

        fireEvent.click(screen.getByRole('button', { name: /structure layouts/i }))
        const menu = screen.getByRole('menu', { name: 'Structure theme sections' })
        fireEvent.click(within(menu).getByRole('menuitem', { name: 'Design Groups' }))

        expect(onSelect).toHaveBeenCalledWith('typography')
        expect(screen.queryByRole('menu', { name: 'Structure theme sections' })).not.toBeInTheDocument()
    })

    it('provides the same grouped choices in the hamburger menu', () => {
        const onSelect = vi.fn()
        render(<ThemeEditorNavigation groups={groups} activeTab="basic" onSelect={onSelect} />)

        fireEvent.click(screen.getByRole('button', { name: /theme sections.*basic info/i }))
        const mobileMenu = document.getElementById('theme-editor-mobile-menu')
        expect(within(mobileMenu).getByRole('heading', { name: 'General' })).toBeInTheDocument()
        expect(within(mobileMenu).getByRole('heading', { name: 'Structure' })).toBeInTheDocument()

        fireEvent.click(within(mobileMenu).getByRole('button', { name: 'Layouts' }))
        expect(onSelect).toHaveBeenCalledWith('layouts')
    })
})
