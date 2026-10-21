import React from 'react'
import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { ImageSizeButton } from '../WidgetEditorControls'

function ShapeControl() {
    const [size, setSize] = React.useState('square')
    return <ImageSizeButton value={size} onChange={setSize} />
}

describe('cycling value feedback', () => {
    it('announces the newly selected value, restarts on repeated clicks and removes it after fading', () => {
        render(<ShapeControl />)
        fireEvent.click(screen.getByRole('button', { name: 'Image size: Square' }))
        const first = screen.getByRole('status')
        expect(first).toHaveTextContent('Image shape: Rectangle')
        fireEvent.click(screen.getByRole('button', { name: 'Image size: Rectangle' }))
        const second = screen.getByRole('status')
        expect(second).not.toBe(first)
        expect(second).toHaveTextContent('Image shape: Square')
        fireEvent.animationEnd(second)
        expect(screen.queryByRole('status')).not.toBeInTheDocument()
    })

    it('removes the portal when its widget is unmounted', () => {
        const onChange = vi.fn()
        const { unmount } = render(<ImageSizeButton onChange={onChange} />)
        fireEvent.click(screen.getByRole('button', { name: 'Image size: Square' }))
        expect(onChange).toHaveBeenCalledWith('rectangle')
        expect(screen.getByRole('status')).toBeInTheDocument()
        unmount()
        expect(screen.queryByRole('status')).not.toBeInTheDocument()
    })
})
