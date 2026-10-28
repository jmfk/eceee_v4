import { describe, expect, it } from 'vitest'
import { imageWidgetMediaItems } from '../imageWidgetMedia'

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
})
