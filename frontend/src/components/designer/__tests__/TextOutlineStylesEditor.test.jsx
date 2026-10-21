import { useState } from 'react'
import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import TextOutlineStylesEditor from '../TextOutlineStylesEditor'

function Editor() {
    const [styles, setStyles] = useState({})
    return <><TextOutlineStylesEditor styles={styles} onChange={setStyles} /><output data-testid="styles">{JSON.stringify(styles)}</output></>
}

describe('Designer text outline styles', () => {
    it.each([
        ['Thickness (px)', 'thickness', '0.5'],
        ['Opacity (%)', 'opacity', '35'],
        ['Gradient / blur radius (px)', 'radius', '2.5'],
        ['Angle (°)', 'angle', '-45'],
        ['Offset (px)', 'offset', '-3.5'],
    ])('allows clearing and replacing %s without saving an invalid value', (label, field, replacement) => {
        render(<Editor />)
        fireEvent.click(screen.getByRole('button', { name: 'Add text outline style' }))
        fireEvent.change(screen.getByLabelText('Effect'), { target: { value: 'dropShadow' } })
        const input = screen.getByLabelText(label)
        const previous = Object.values(JSON.parse(screen.getByTestId('styles').textContent))[0][field]
        fireEvent.change(input, { target: { value: '' } })
        expect(input).toHaveValue(null)
        expect(Object.values(JSON.parse(screen.getByTestId('styles').textContent))[0][field]).toBe(previous)
        fireEvent.change(input, { target: { value: replacement } })
        expect(input).toHaveValue(Number(replacement))
        expect(Object.values(JSON.parse(screen.getByTestId('styles').textContent))[0][field]).toBe(Number(replacement))
        fireEvent.change(input, { target: { value: '' } })
        fireEvent.blur(input)
        expect(input).toHaveValue(Number(replacement))
    })

    it('waits until blur to clamp numbers and resets field drafts when switching styles', () => {
        render(<Editor />)
        fireEvent.click(screen.getByRole('button', { name: 'Add text outline style' }))
        const input = screen.getByLabelText('Thickness (px)')
        fireEvent.change(input, { target: { value: '250' } })
        expect(input).toHaveValue(250)
        expect(Object.values(JSON.parse(screen.getByTestId('styles').textContent))[0].thickness).toBe(1)
        fireEvent.blur(input)
        expect(input).toHaveValue(20)
        fireEvent.change(input, { target: { value: '' } })
        fireEvent.click(screen.getByRole('button', { name: 'Add text outline style' }))
        expect(screen.getByLabelText('Thickness (px)')).toHaveValue(1)
    })

    it('creates, edits, previews and restores a removed preset without changing its key', () => {
        render(<Editor />)
        fireEvent.click(screen.getByRole('button', { name: 'Add text outline style' }))
        fireEvent.change(screen.getByLabelText('Style name'), { target: { value: 'Soft glow' } })
        fireEvent.change(screen.getByLabelText('Effect'), { target: { value: 'dropShadow' } })
        fireEvent.change(screen.getByLabelText('Angle (°)'), { target: { value: '90' } })
        fireEvent.change(screen.getByLabelText('Color', { exact: true }), { target: { value: 'rgb' } })
        fireEvent.change(screen.getByLabelText('RGB color'), { target: { value: '#abcdef' } })
        expect(Object.values(JSON.parse(screen.getByTestId('styles').textContent))[0]).toMatchObject({ name: 'Soft glow', angle: 90, color: '#abcdef' })
        expect(screen.getByLabelText('Text outline preview')).toBeInTheDocument()
        fireEvent.click(screen.getByRole('button', { name: 'Remove style' }))
        expect(screen.getByTestId('styles').textContent).toBe('{}')
        fireEvent.click(screen.getByRole('button', { name: 'Undo' }))
        expect(screen.getByLabelText('Style name')).toHaveValue('Soft glow')
    })
})
