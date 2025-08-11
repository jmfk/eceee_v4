import { describe, it, expect, vi } from 'vitest'
import { render, fireEvent, screen } from '@testing-library/react'
import VisualSchemaEditor from '../../components/VisualSchemaEditor'

describe('VisualSchemaEditor', () => {
    it('prevents invalid JSON and shows error', () => {
        const onChange = vi.fn()
        render(<VisualSchemaEditor schema={{ type: 'object', properties: {} }} onChange={onChange} />)
        fireEvent.click(screen.getByText('JSON'))
        const textarea = screen.getByPlaceholderText('Enter JSON Schema...')
        fireEvent.change(textarea, { target: { value: '{ invalid json' } })
        expect(screen.getByText('Invalid JSON')).toBeInTheDocument()
        expect(onChange).not.toHaveBeenCalled()
    })

    it('blocks invalid shape and shows error', () => {
        const onChange = vi.fn()
        render(<VisualSchemaEditor schema={{ type: 'object', properties: {} }} onChange={onChange} />)
        fireEvent.click(screen.getByText('JSON'))
        const textarea = screen.getByPlaceholderText('Enter JSON Schema...')
        fireEvent.change(textarea, { target: { value: JSON.stringify({ type: 'array' }) } })
        expect(screen.getByText(/Schema 'type' must be 'object'/)).toBeInTheDocument()
        expect(onChange).not.toHaveBeenCalled()
    })
})


