import { describe, expect, it } from 'vitest'
import { convertSlotWidgets, slotConversionFromWarning } from '../slotConversion'

describe('slot conversion', () => {
    it('only offers conversion when the server identifies an existing destination slot', () => {
        const warning = "Slot 'landing_page' is not used by layout 'landingPage' and its widgets will not appear publicly. Convert this slot to 'landingPage' to show its widgets."
        expect(slotConversionFromWarning(warning)).toEqual({ from: 'landing_page', to: 'landingPage' })
        expect(slotConversionFromWarning("Slot 'unused' is not used by layout 'landingPage' and its widgets will not appear publicly.")).toBeNull()
    })

    it('moves widgets without changing their content and refuses to overwrite occupied destinations', () => {
        const oldWidgets = [{ id: 'one', type: 'easy_widgets.ContentWidget', config: { text: 'Keep me' } }]
        const widgets = { landing_page: oldWidgets, sidebar: [] }
        expect(convertSlotWidgets(widgets, 'landing_page', 'landingPage')).toEqual({ landingPage: oldWidgets, sidebar: [] })
        expect(widgets).toHaveProperty('landing_page')
        expect(convertSlotWidgets({ ...widgets, landingPage: [{ id: 'two' }] }, 'landing_page', 'landingPage')).toBeNull()
    })
})
