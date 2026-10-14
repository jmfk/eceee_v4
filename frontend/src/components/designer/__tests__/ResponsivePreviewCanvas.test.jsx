import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import ResponsivePreviewCanvas from '../ResponsivePreviewCanvas'

vi.mock('../../../rendering/RenderFrame', () => ({
    default: ({ model, title }) => <div role="document" aria-label={title} data-preview-viewport={model.context.previewViewport} />,
}))

describe('ResponsivePreviewCanvas', () => {
    it('passes the selected viewport to preview-only render widgets', () => {
        render(<ResponsivePreviewCanvas model={{ context: { preview: true } }} title="Layout preview" />)

        expect(screen.getByRole('document', { name: 'Layout preview' })).toHaveAttribute('data-preview-viewport', 'desktop')

        fireEvent.click(screen.getByRole('button', { name: 'Preview at mobile width' }))

        expect(screen.getByRole('document', { name: 'Layout preview' })).toHaveAttribute('data-preview-viewport', 'mobile')
    })
})
