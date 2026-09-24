import { useState } from 'react'
import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import PreviewViewsTab from '../PreviewViewsTab'

const Harness = () => {
    const [preview, setPreview] = useState({ views: [] })
    return <PreviewViewsTab designerPreview={preview} onChange={setPreview} />
}

describe('PreviewViewsTab', () => {
    it('lets a developer add page and object previews with their own demo content', () => {
        render(<Harness />)

        fireEvent.click(screen.getByRole('button', { name: 'Add page preview' }))
        fireEvent.click(screen.getByRole('button', { name: 'Add object preview' }))

        expect(screen.getByDisplayValue('Page preview 1')).toBeInTheDocument()
        expect(screen.getByDisplayValue('Object preview 2')).toBeInTheDocument()
        expect(screen.getAllByLabelText('Preview type')).toHaveLength(2)

        const textEditors = screen.getAllByLabelText('Demo text by element id')
        fireEvent.change(textEditors[1], {
            target: { value: '{"group:0:element:h1":"A saved object headline"}' },
        })
        fireEvent.blur(textEditors[1])

        expect(screen.getByDisplayValue(/A saved object headline/)).toBeInTheDocument()
    })
})
