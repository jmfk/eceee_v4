import React from 'react'
import { fireEvent, render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import InlineObjectTitle from './InlineObjectTitle'
import { OperationTypes } from '../../contexts/unified-data/types/operations'

const data = vi.hoisted(() => ({ publishUpdate: vi.fn(), setIsDirty: vi.fn() }))
vi.mock('../../contexts/unified-data/context/UnifiedDataContext', () => ({
    useUnifiedData: () => ({
        getState: () => ({ objects: {} }),
        publishUpdate: data.publishUpdate,
        setIsDirty: data.setIsDirty,
        useExternalChanges: () => {},
    }),
}))

describe('Inline object title', () => {
    beforeEach(() => vi.clearAllMocks())

    it('edits the title in the header and publishes it to the working copy', () => {
        render(<InlineObjectTitle instanceId="42" title="Original" />)
        fireEvent.change(screen.getByRole('textbox', { name: 'Object title' }), { target: { value: 'Revised' } })
        expect(data.setIsDirty).toHaveBeenCalledWith(true)
        expect(data.publishUpdate).toHaveBeenCalledWith('inline-object-title-42', OperationTypes.UPDATE_OBJECT, {
            id: '42', updates: { title: 'Revised' },
        })
    })

    it('restores the last valid title when the field is left empty', () => {
        render(<InlineObjectTitle instanceId="42" title="Original" />)
        const input = screen.getByRole('textbox', { name: 'Object title' })
        fireEvent.change(input, { target: { value: '' } })
        fireEvent.blur(input)
        expect(input).toHaveValue('Original')
        expect(screen.getByRole('alert')).toHaveTextContent('Title is required')
        expect(data.publishUpdate).not.toHaveBeenCalled()
    })
})
