import React from 'react'
import { fireEvent, render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import DesignGroupsInfoModal from '../DesignGroupsInfoModal'

const routerMocks = vi.hoisted(() => ({
    navigate: vi.fn(),
}))

vi.mock('react-router-dom', async () => {
    const actual = await vi.importActual('react-router-dom')
    return {
        ...actual,
        useNavigate: () => routerMocks.navigate,
    }
})

describe('DesignGroupsInfoModal', () => {
    beforeEach(() => {
        vi.clearAllMocks()
    })

    it('keeps the dialog within the viewport and scrolls its content', () => {
        render(<DesignGroupsInfoModal widgetType="HeaderWidget" themeId={7} onClose={vi.fn()} />)

        const dialog = screen.getByRole('dialog', { name: 'Widget Styling' })
        expect(dialog).toHaveClass('max-h-[calc(100dvh-2rem)]', 'flex', 'flex-col', 'overflow-hidden')

        const content = screen.getByText('This widget is styled entirely through Design Groups in the theme editor.').parentElement.parentElement
        expect(content).toHaveClass('flex-1', 'min-h-0', 'overflow-y-auto')
    })

    it('opens the current theme editor Design Groups tab', () => {
        const onClose = vi.fn()
        render(<DesignGroupsInfoModal widgetType="HeaderWidget" themeId={7} onClose={onClose} />)

        fireEvent.click(screen.getByRole('button', { name: 'Edit Theme' }))

        expect(routerMocks.navigate).toHaveBeenCalledWith('/settings/themes/7/typography')
        expect(onClose).toHaveBeenCalledOnce()
    })

    it('falls back to the current themes list when no theme is resolved', () => {
        render(<DesignGroupsInfoModal widgetType="HeaderWidget" onClose={vi.fn()} />)

        fireEvent.click(screen.getByRole('button', { name: 'Edit Theme' }))

        expect(routerMocks.navigate).toHaveBeenCalledWith('/settings/themes')
    })
})
