import { beforeEach, describe, expect, it, vi } from 'vitest'
import { compileBrowserRenderStyles, resolveBrowserThemeBackgrounds } from '../browserThemeStyles'

const imgproxy = vi.hoisted(() => ({ batch: vi.fn() }))
vi.mock('../../utils/imgproxySecure', () => ({ getBatchImgproxyUrls: imgproxy.batch }))

describe('browser theme media preparation', () => {
    beforeEach(() => {
        imgproxy.batch.mockReset()
        imgproxy.batch.mockResolvedValue(['/signed/header-1x', '/signed/header-2x'])
    })

    it('resolves the same one- and two-density background inputs expected by the compiler', async () => {
        const theme = {
            designGroups: {
                groups: [{
                    elements: {
                        body: {
                            backgroundImage: {
                                imgproxyBaseUrl: 'https://media.example/header.jpg',
                                width: 2400,
                                height: 800,
                                dpr: 2,
                            },
                        },
                    },
                }],
            },
        }

        const resolved = await resolveBrowserThemeBackgrounds(theme)
        expect(imgproxy.batch).toHaveBeenCalledWith([
            expect.objectContaining({ sourceUrl: 'https://media.example/header.jpg', width: 1200, height: 400 }),
            expect.objectContaining({ sourceUrl: 'https://media.example/header.jpg', width: 2400, height: 800 }),
        ])
        expect(resolved?.designGroups.groups[0].elements.body.backgroundImage).toMatchObject({
            oneX: '/signed/header-1x',
            twoX: '/signed/header-2x',
        })

        const compiled = await compileBrowserRenderStyles({ theme })
        expect(compiled.css).toContain("image-set(url('/signed/header-1x') 1x, url('/signed/header-2x') 2x)")
    })

    it('keeps already normalized responsive sources without signing them again', async () => {
        const resolved = await resolveBrowserThemeBackgrounds({
            designGroups: { groups: [{ elements: { body: { background_image: {
                url: '/source', one_x: '/one', two_x: '/two', width: 100, height: 50,
            } } } }] },
        })

        expect(imgproxy.batch).not.toHaveBeenCalled()
        expect(resolved?.designGroups.groups[0].elements.body.background_image.one_x).toBe('/one')
    })

    it('signs only a missing density when legacy data contains a partial pair', async () => {
        imgproxy.batch.mockResolvedValue(['/signed/missing-2x'])
        const resolved = await resolveBrowserThemeBackgrounds({
            designGroups: { groups: [{ elements: { body: { backgroundImage: {
                url: '/source', oneX: '/existing-1x', width: 100, height: 50,
            } } } }] },
        })

        expect(imgproxy.batch).toHaveBeenCalledWith([
            expect.objectContaining({ sourceUrl: '/source', width: 100, height: 50 }),
        ])
        expect(resolved?.designGroups.groups[0].elements.body.backgroundImage).toMatchObject({
            oneX: '/existing-1x',
            twoX: '/signed/missing-2x',
        })
    })
})
