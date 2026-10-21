import { beforeEach, describe, expect, it, vi } from 'vitest'
import { api } from '../client'
import { validateWidgetConfiguration } from '../widgetSchemas'

vi.mock('../client', () => ({ api: { post: vi.fn() } }))

describe('widget validation context', () => {
    beforeEach(() => api.post.mockResolvedValue({ data: { isValid: true } }))

    it('preserves the existing URL when no theme context is supplied', async () => {
        await validateWidgetConfiguration('easy_widgets.ContentWidget', { content: 'Text' })
        expect(api.post).toHaveBeenCalledWith('/api/v1/webpages/widget-types/easy_widgets.ContentWidget/validate/', {
            widgetData: { content: 'Text' },
        })
    })

    it('passes the theme and pinned revision explicitly', async () => {
        await validateWidgetConfiguration('theme_widgets.test', {}, { themeId: 12, typeVersion: 2 })
        expect(api.post).toHaveBeenCalledWith('/api/v1/webpages/widget-types/theme_widgets.test/validate/?theme_id=12&type_version=2', {
            widgetData: {},
        })
    })
})
