import React from 'react'
import { render } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { NewsImage, newsImageDimensions, newsImageFocalPoint } from '../NewsImage'

afterEach(() => vi.restoreAllMocks())
describe('news focal cropping', () => {
    it.each([[0, '0px'], [1, '-140px']])('keeps the horizontal edge nearest focus %i', (x, left) => {
        vi.spyOn(HTMLElement.prototype, 'clientWidth', 'get').mockReturnValue(140)
        vi.spyOn(HTMLElement.prototype, 'clientHeight', 'get').mockReturnValue(140)
        const { container } = render(<div><NewsImage source={{ url: '/wide.jpg', width: 800, height: 400, focalPoint: { x, y: 0.5 } }} /></div>)
        expect(container.querySelector('img')).toHaveStyle({ width: '280px', height: '140px', left, top: '0px' })
    })
    it('preserves the bottom edge of a portrait image with a bottom focus', () => {
        vi.spyOn(HTMLElement.prototype, 'clientWidth', 'get').mockReturnValue(140)
        vi.spyOn(HTMLElement.prototype, 'clientHeight', 'get').mockReturnValue(140)
        const { container } = render(<div><NewsImage source={{ url: '/portrait.jpg', width: 400, height: 800, focal_point: { x: 0.5, y: 1 } }} /></div>)
        expect(container.querySelector('img')).toHaveStyle({ width: '140px', height: '280px', left: '0px', top: '-140px' })
    })
    it('uses unscaled layout measurements inside a scaled preview', () => {
        vi.spyOn(HTMLElement.prototype, 'clientWidth', 'get').mockReturnValue(140)
        vi.spyOn(HTMLElement.prototype, 'clientHeight', 'get').mockReturnValue(140)
        vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockReturnValue({ width: 70, height: 70 } as DOMRect)
        const { container } = render(<div style={{ transform: 'scale(.5)' }}><NewsImage source={{ url: '/wide.jpg', width: 800, height: 400 }} /></div>)
        expect(container.querySelector('img')).toHaveStyle({ width: '280px', height: '140px' })
    })
    it('normalizes source dimensions and invalid/missing focal points', () => {
        expect(newsImageDimensions({ original_width: 400, original_height: 800 })).toEqual({ width: 400, height: 800 })
        expect(newsImageDimensions({ width: -1, height: 800 })).toBeNull()
        expect(newsImageFocalPoint({ metadata: { focal_point: { x: 1, y: 0 } } })).toEqual({ x: 1, y: 0 })
        expect(newsImageFocalPoint({ focalPoint: { x: NaN, y: undefined } })).toEqual({ x: 0.5, y: 0.5 })
    })
})
