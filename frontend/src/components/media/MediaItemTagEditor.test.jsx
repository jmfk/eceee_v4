import React from 'react'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import MediaItemTagEditor from './MediaItemTagEditor'
import { mediaApi } from '../../api'

const { selected, notify } = vi.hoisted(() => ({
    selected: [
        { id: '11111111-1111-4111-8111-111111111111', name: 'Same label' },
        { id: '22222222-2222-4222-8222-222222222222', name: 'Same label' },
    ],
    notify: vi.fn(),
}))
vi.mock('../../api', () => ({ mediaApi: { files: { update: vi.fn(), addTags: vi.fn(), removeTags: vi.fn() } } }))
vi.mock('../../contexts/GlobalNotificationContext', () => ({ useGlobalNotifications: () => ({ addNotification: notify }) }))
vi.mock('./MediaTagWidget', () => ({ default: ({ onChange }) => <button onClick={() => onChange(selected)}>Choose classifications</button> }))

const file = {
    id: 'media-file',
    tags: [{ id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', classificationId: selected[0].id, name: 'Same label' }],
}

beforeEach(() => vi.clearAllMocks())

describe('inline canonical media classification edits', () => {
    it('retains existing selections and sends same-label typed terms by ID in one update', async () => {
        const updated = { ...file, classificationIds: selected.map(term => term.id) }
        mediaApi.files.update.mockReturnValue(async () => updated)
        const changed = vi.fn()
        render(<MediaItemTagEditor mediaFile={file} namespace="content" onTagsChanged={changed} />)
        fireEvent.click(screen.getByTitle('Edit tags'))
        fireEvent.click(screen.getByText('Choose classifications'))
        fireEvent.click(screen.getByText('Save Tags'))
        await waitFor(() => expect(changed).toHaveBeenCalledWith(updated))
        expect(mediaApi.files.update).toHaveBeenCalledWith(file.id, { classification_ids: selected.map(term => term.id) })
        expect(mediaApi.files.addTags).not.toHaveBeenCalled()
        expect(mediaApi.files.removeTags).not.toHaveBeenCalled()
    })

    it('uses an existing legacy projection canonical ID when saving an unchanged selection', async () => {
        mediaApi.files.update.mockReturnValue(async () => file)
        render(<MediaItemTagEditor mediaFile={file} namespace="content" />)
        fireEvent.click(screen.getByTitle('Edit tags'))
        fireEvent.click(screen.getByText('Save Tags'))
        await waitFor(() => expect(mediaApi.files.update).toHaveBeenCalledWith(file.id, { classification_ids: [selected[0].id] }))
    })
})
