import { describe, expect, it } from 'vitest'
import { generateDesignGroupsCSS } from '../themeUtils'

describe('generateDesignGroupsCSS', () => {
    it('targets layout parts on either the widget root or a descendant', () => {
        const css = generateDesignGroupsCSS({
            groups: [{
                widgetTypes: ['easy_widgets.FormsWidget'],
                layoutProperties: {
                    'forms-widget': {
                        xs: { padding: '2rem' },
                    },
                },
            }],
        })

        expect(css).toContain('.widget-type-easy-widgets-formswidget.forms-widget')
        expect(css).toContain('.widget-type-easy-widgets-formswidget .forms-widget')
    })
})
