import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import DesignerMediaLibraryDialog from '../DesignerMediaLibraryDialog'

vi.mock('../../media/MediaBrowser', () => ({
    default: ({ namespace, selectionMode, showUploader, hideActions, previewOpensEditor }) => (
        <div data-testid="media-browser" data-namespace={namespace} data-selection-mode={selectionMode}
            data-show-uploader={String(showUploader)} data-hide-actions={String(hideActions)}
            data-preview-opens-editor={String(Boolean(previewOpensEditor))} />
    ),
}))

describe('DesignerMediaLibraryDialog', () => {
    it('opens the theme namespace for browsing without media mutation controls', () => {
        render(<DesignerMediaLibraryDialog namespace="theme-tenant" onClose={vi.fn()} />)

        const browser = screen.getByTestId('media-browser')
        expect(browser).toHaveAttribute('data-namespace', 'theme-tenant')
        expect(browser).toHaveAttribute('data-selection-mode', 'none')
        expect(browser).toHaveAttribute('data-show-uploader', 'false')
        expect(browser).toHaveAttribute('data-hide-actions', 'true')
        expect(browser).toHaveAttribute('data-preview-opens-editor', 'false')
    })
})
