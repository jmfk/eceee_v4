import React from 'react'
import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import NewsFlashWidget from '../NewsFlashWidget'
import { newsHomeEditorSchema } from '../newsHomeSchema'

describe('News Flash editor contract', () => {
    it('shows the configured layout directly in the slot editor', () => {
        expect(NewsFlashWidget.widgetType).toBe('easy_widgets.NewsFlashWidget')
        render(<NewsFlashWidget config={{ fullWidthCount: 2, halfWidthCount: 0, thirdWidthCount: 3 }} />)
        expect(screen.getAllByRole('article')).toHaveLength(5)
        expect(screen.getAllByText('Published story')).toHaveLength(5)
    })
    it('uses the selected shape for editor placeholders, including saved snake-case config', () => {
        const { container } = render(<NewsFlashWidget config={{ image_shape: 'square' }} />)
        expect(container.querySelectorAll('.news-flash-image-square')).toHaveLength(3)
    })

    it('exposes all three nonnegative layout counts instead of a fixed limit', () => {
        const schema = newsHomeEditorSchema('easy_widgets.NewsFlashWidget', { properties: { limit: { const: 3 } } })
        expect(schema?.properties.limit).toBeUndefined()
        expect(schema?.properties.imageShape.options.map(option => option.value)).toEqual(['square', 'landscape'])
        expect(schema?.properties.fullWidthCount).toMatchObject({ minimum: 0, default: 1 })
        expect(schema?.properties.halfWidthCount).toMatchObject({ minimum: 0, default: 2 })
        expect(schema?.properties.thirdWidthCount).toMatchObject({ minimum: 0, default: 0 })
    })
})
