import { describe, expect, it } from 'vitest'
import { deriveTodoItemsFromError } from '../pageEditorValidationErrors'

describe('deriveTodoItemsFromError', () => {
    it('explains how to replace a missing theme and routes to page settings', () => {
        const [item] = deriveTodoItemsFromError('theme: Invalid pk "3" - object does not exist.')

        expect(item).toMatchObject({
            title: 'Selected theme is no longer available',
            hint: 'Open Page Settings → Page Theme, then choose an available theme or Use system default.',
            target: { type: 'settings' },
            checked: false,
        })
    })

    it('keeps the generic fallback for unknown validation errors', () => {
        const [item] = deriveTodoItemsFromError('Unexpected validation failure')

        expect(item).toMatchObject({
            title: 'Validation error',
            hint: 'Review the error and update the related fields.',
            target: { type: 'data', path: null },
        })
    })
})
