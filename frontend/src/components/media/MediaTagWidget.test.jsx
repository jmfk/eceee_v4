import React from 'react'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import MediaTagWidget from './MediaTagWidget'
import { taxonomyApi } from '../../api/taxonomy'

vi.mock('../classification/ClassificationPicker', () => ({ default: ({ onChange }) => <button onClick={() => onChange(['11111111-1111-4111-8111-111111111111'])}>Choose taxonomy</button> }))
vi.mock('../../api/taxonomy', () => ({ taxonomyApi: { term: vi.fn() } }))

describe('required taxonomy media tagging', () => {
    it('does not count AI suggestion strings as approved tags', async () => {
        const onChange = vi.fn()
        render(<MediaTagWidget tags={['AI guessed subject']} onChange={onChange} />)
        expect(screen.getByText('At least one approved taxonomy term is required.')).toBeTruthy()
        await waitFor(() => expect(onChange).toHaveBeenCalledWith([]))
    })
    it('returns the selected canonical identity to legacy upload consumers', async () => {
        const id = '11111111-1111-4111-8111-111111111111'
        taxonomyApi.term.mockResolvedValue({ id, name: 'Approved', status: 'approved' })
        const onChange = vi.fn()
        render(<MediaTagWidget tags={[]} onChange={onChange} />)
        fireEvent.click(screen.getByText('Choose taxonomy'))
        await waitFor(() => expect(onChange).toHaveBeenCalledWith([{ id, name: 'Approved', status: 'approved', classificationId: id }]))
    })
})
