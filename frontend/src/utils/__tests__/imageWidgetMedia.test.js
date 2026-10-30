import { describe, expect, it } from 'vitest'
import { imageWidgetMediaItems, isImageCollectionReference } from '../imageWidgetMedia'

describe('imageWidgetMediaItems', () => {
    it('keeps a library image bound to its stable media identity', () => {
        const id = '168c3331-03e1-41e6-827f-5945112131b6'
        const items = imageWidgetMediaItems({
            mediaItems: [{ id, type: 'image', fileUrl: 'https://storage.test/old.jpg' }],
        })
        expect(items[0].url).toBe(`/api/v1/media/file/${id}/`)
    })

    it('leaves non-library image URLs intact', () => {
        expect(imageWidgetMediaItems({ imageUrl: '/theme/header.jpg' })[0].url).toBe('/theme/header.jpg')
    })

    it('distinguishes a saved collection from an image with a stable UUID route', () => {
        const id = '67d9020f-1d73-47be-bd24-1fe52d2dbef8'
        expect(isImageCollectionReference({ id, slug: 'logos', file_count: 12, sample_images: [] })).toBe(true)
        expect(isImageCollectionReference({ id, slug: 'logo', file_type: 'image' })).toBe(false)
    })
})
