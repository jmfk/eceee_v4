import { describe, expect, it } from 'vitest'
import { getWidgetComponent } from './index'
describe('object editor widget registration', () => {
    it('adds object widgets while preserving EASY widgets', () => {
        for (const key of ['object_storage.ObjectListWidget', 'object_storage.ObjectDetailWidget', 'easy_widgets.NewsFlashWidget', 'easy_widgets.BannerWidget']) expect(getWidgetComponent(key)).toBeTypeOf('function')
    })
})
