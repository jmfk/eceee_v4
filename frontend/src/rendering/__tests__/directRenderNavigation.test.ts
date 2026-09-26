import { describe, expect, it } from 'vitest'
import { rewriteDirectRenderHref } from '../directRenderNavigation'

const context = {
    routePrefix: '/_render/85',
    currentPath: '/for-authors/review-process/',
    siteHostnames: ['summerstudy.localhost'],
}

describe('direct render navigation links', () => {
    it.each([
        ['/for-authors/publication-ethics/', '/_render/85/for-authors/publication-ethics/'],
        ['../important-dates/', '/_render/85/for-authors/important-dates/'],
        ['/', '/_render/85/'],
        ['https://summerstudy.localhost/venue-travel/', '/_render/85/venue-travel/'],
    ])('rewrites site page link %s', (href, expected) => {
        expect(rewriteDirectRenderHref(href, context)).toBe(expected)
    })

    it.each([
        '#details',
        'mailto:papers@eceee.org',
        'tel:+46701234567',
        'https://www.eceee.org/',
        '/static/documents/programme.pdf',
        '/media/uploads/photo.jpg',
        '/_render/85/already-rewritten/',
    ])('leaves non-page link %s unchanged', (href) => {
        expect(rewriteDirectRenderHref(href, context)).toBe(href)
    })
})
