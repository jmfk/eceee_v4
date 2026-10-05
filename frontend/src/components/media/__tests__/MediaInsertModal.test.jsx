import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import MediaInsertModal from '../MediaInsertModal'

vi.mock('../../../hooks/useTheme', () => ({
    useTheme: () => ({
        currentTheme: {
            imageStyles: {
                'partner-logos': {
                    name: 'Partner Logos',
                    styleType: 'gallery',
                    usageType: 'both',
                    imgproxyConfig: { resizeType: 'fit', width: 720 }
                }
            }
        }
    })
}))

vi.mock('../OptimizedImage', () => ({
    default: ({ alt }) => <img alt={alt} />
}))

vi.mock('../MediaBrowser', () => ({
    default: () => <div>Media browser</div>
}))

const media = {
    id: 'image-1',
    title: 'The power of light',
    fileUrl: 'https://example.com/image.jpg',
    width: 720,
    height: 720
}

describe('MediaInsertModal', () => {
    it('keeps lightbox settings in a collapsed accordion with independent style values', async () => {
        const user = userEvent.setup()
        render(
            <MediaInsertModal
                isOpen
                onClose={vi.fn()}
                onSave={vi.fn()}
                pageId={104}
                namespace="default"
                initialMediaData={media}
                initialConfig={{
                    mediaType: 'image',
                    altText: 'The power of light',
                    caption: 'The power of light',
                    galleryStyle: null,
                    enableLightbox: true,
                    lightboxImageStyle: 'partner-logos'
                }}
            />
        )

        const accordion = screen.getByText('Lightbox', { exact: true }).closest('details')

        expect(accordion).not.toHaveAttribute('open')
        expect(screen.getByText('On')).toBeInTheDocument()
        expect(screen.getByLabelText('Image Style')).toHaveValue('')
        expect(screen.getByLabelText('Lightbox Image Style')).toHaveValue('partner-logos')

        await user.click(screen.getByText('Lightbox', { exact: true }))

        expect(accordion).toHaveAttribute('open')
    })
})
