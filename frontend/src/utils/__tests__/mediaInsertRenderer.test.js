import { beforeEach, expect, it, vi } from 'vitest'
import { renderMediaImage } from '../mediaInsertRenderer'
import { getImgproxyUrl } from '../imgproxySecure'

vi.mock('../imgproxySecure', () => ({ getImgproxyUrl: vi.fn(async () => '/processed.webp') }))

beforeEach(() => getImgproxyUrl.mockClear())

it('keeps the default image at its natural size when the slot is wider', async () => {
    const html = await renderMediaImage(
        { fileUrl: '/small.jpg', width: 120, height: 80, title: 'Small image' },
        { width: 'full' },
        { desktop: { width: 896 } },
    )

    expect(getImgproxyUrl).toHaveBeenCalledWith('/small.jpg', expect.objectContaining({ width: 120, height: 80 }))
    expect(html).toContain('width="120"')
    expect(html).toContain('height="80"')
})

it('shrinks a wide image to the available slot width', async () => {
    const html = await renderMediaImage(
        { fileUrl: '/wide.jpg', width: 1800, height: 900 },
        { width: 'full' },
        { desktop: { width: 600 } },
    )

    expect(getImgproxyUrl).toHaveBeenCalledWith('/wide.jpg', expect.objectContaining({ width: 600, height: 300 }))
    expect(html).toContain('width="600"')
})
