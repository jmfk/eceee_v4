import { describe, expect, it } from 'vitest'
import { applySlotWarningChoices, convertSlotWidgets, slotConversionFromWarning } from '../slotConversion'

describe('slot conversion', () => {
    it('only offers conversion when the server identifies an existing destination slot', () => {
        const warning = "Slot 'landing_page' is not used by layout 'landingPage' and its widgets will not appear publicly. Convert this slot to 'landingPage' to show its widgets."
        expect(slotConversionFromWarning(warning)).toEqual({ from: 'landing_page', layout: 'landingPage', to: 'landingPage' })
        expect(slotConversionFromWarning("Slot 'unused' is not used by layout 'landingPage' and its widgets will not appear publicly.")).toBeNull()
    })

    it('moves widgets to an empty slot and discards the hidden slot when the destination has content', () => {
        const oldWidgets = [{ id: 'one', type: 'easy_widgets.ContentWidget', config: { text: 'Keep me' } }]
        const widgets = { landing_page: oldWidgets, sidebar: [] }
        expect(convertSlotWidgets(widgets, 'landing_page', 'landingPage')).toEqual({ landingPage: oldWidgets, sidebar: [] })
        expect(widgets).toHaveProperty('landing_page')
        expect(convertSlotWidgets({ ...widgets, landingPage: [{ id: 'two' }] }, 'landing_page', 'landingPage')).toEqual({ sidebar: [], landingPage: [{ id: 'two' }] })
    })

    it('persists an ignored warning or resolves a conversion without overwriting destination widgets', () => {
        const item = { id: 'warning', slotConversion: { from: 'landing_page', layout: 'landingPage', to: 'landingPage' } }
        const widgets = { landing_page: [{ id: 'legacy' }], landingPage: [{ id: 'current' }] }
        expect(applySlotWarningChoices(widgets, [], [item], { warning: 'ignore' })).toEqual({
            widgets,
            ignoredSlotWarnings: ['landingPage:landing_page'],
        })
        expect(applySlotWarningChoices(widgets, ['landingPage:landing_page'], [item], { warning: 'convert' })).toEqual({
            widgets: { landingPage: [{ id: 'current' }] },
            ignoredSlotWarnings: [],
        })
        expect(widgets).toHaveProperty('landing_page')
    })
})
