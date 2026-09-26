import { describe, expect, it } from 'vitest'
import { EASY_WIDGET_REGISTRY } from '../../widgets/easy-widgets'
import { RENDER_WIDGET_FIXTURES } from '../fixtures'
import { getRenderLayoutTypes, getRenderWidgetTypes } from '../registry'

describe('render registry parity', () => {
    it('covers every editable widget with a renderer and deterministic fixture', () => {
        const editable = Object.keys(EASY_WIDGET_REGISTRY).sort()
        expect(getRenderWidgetTypes().sort()).toEqual(editable)
        expect(Object.keys(RENDER_WIDGET_FIXTURES).sort()).toEqual(editable)
    })

    it('covers both production layouts', () => {
        expect(getRenderLayoutTypes().sort()).toEqual(['landing_page', 'main_layout'])
    })
})
