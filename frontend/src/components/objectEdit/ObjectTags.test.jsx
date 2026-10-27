import React from 'react'
import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import ObjectTags from './ObjectTags'
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
vi.mock('../classification/ClassificationPicker', () => ({
    default: ({ value, onChange }) => <button type="button" onClick={() => onChange([...value, 'tag-2'])}>Add tag</button>,
}))

describe('Object tags', () => {
    it('publishes a tag edit into the working object', () => {
        render(<ObjectTags objectType={{ id: 9 }} instance={{ id: 15, classificationIds: ['tag-1'] }} />)
        fireEvent.click(screen.getByRole('button', { name: 'Add tag' }))
        expect(data.setIsDirty).toHaveBeenCalledWith(true)
        expect(data.publishUpdate).toHaveBeenCalledWith('object-tags-15', OperationTypes.UPDATE_OBJECT, {
            id: '15', updates: { classificationIds: ['tag-1', 'tag-2'] },
        })
    })
})
