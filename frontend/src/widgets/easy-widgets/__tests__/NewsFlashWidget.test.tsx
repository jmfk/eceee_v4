import React from 'react'
import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import NewsFlashWidget from '../NewsFlashWidget'
import { newsHomeEditorSchema } from '../newsHomeSchema'

describe('News Flash editor contract', () => {
    it('is a distinct selectable widget with three stories by default', () => {
        expect(NewsFlashWidget.widgetType).toBe('easy_widgets.NewsFlashWidget')
        expect(NewsFlashWidget.defaultConfig.limit).toBe(3)
        render(<NewsFlashWidget mode="editor" />)
        expect(screen.getByText('News Flash')).toBeInTheDocument()
    })

    it('keeps three fixed stories without exposing other widgets’ layout controls', () => {
        const schema = newsHomeEditorSchema('easy_widgets.NewsFlashWidget', { properties: { limit: { const: 3 }, objectTypes: { type: 'array' } } })
        expect(schema?.properties.limit).toBeUndefined()
        expect(schema?.properties.displayVariant).toBeUndefined()
        expect(schema?.properties.layout).toBeUndefined()
        expect(schema?.properties.newsPagePath).toBeDefined()
        expect(schema?.properties.objectTypes).toBeDefined()
    })
})
