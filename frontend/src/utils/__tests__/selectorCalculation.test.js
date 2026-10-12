import { describe, expect, it } from 'vitest'

import { calculateSelectorsForGroup } from '../selectorCalculation'

describe('calculateSelectorsForGroup', () => {
    it('targets semantic widget surfaces below the outer widget frame', () => {
        const selectors = calculateSelectorsForGroup({
            widgetTypes: ['easy_widgets.ContentWidget'],
            layoutProperties: {
                'content-widget': { xl: { padding: '30px 60px' } },
            },
        })

        expect(selectors.layoutPartSelectors['content-widget']).toEqual([
            '.widget-type-easy-widgets-contentwidget .content-widget',
        ])
    })

    it('keeps variants and modifiers on the semantic surface selector', () => {
        const selectors = calculateSelectorsForGroup({
            widgetTypes: ['easy_widgets.HeroWidget'],
            variants: ['featured'],
            cssModifier: ':hover',
            layoutProperties: {
                'hero-widget': { xl: { padding: '2rem' } },
            },
        })

        expect(selectors.layoutPartSelectors['hero-widget']).toEqual([
            '.widget-type-easy-widgets-herowidget .hero-widget.featured:hover',
        ])
    })
})
