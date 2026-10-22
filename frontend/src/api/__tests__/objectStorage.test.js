import { beforeEach, describe, expect, it, vi } from 'vitest'

const postMock = vi.hoisted(() => vi.fn())

vi.mock('../client.js', () => ({ api: { post: postMock } }))

import { objectInstancesApi } from '../objectStorage.js'

describe('objectInstancesApi.saveWorkingCopy', () => {
    const version = { id: 7, editRevision: 2 }
    const baseline = { parent: { id: 3 }, metadata: { nested: { a: 1, b: 2 } } }
    const content = { title: 'Edited', data: {}, widgets: {}, parentId: 3,
        metadata: { nested: { b: 2, a: 1 } } }

    beforeEach(() => {
        postMock.mockReset()
        postMock.mockResolvedValue({ data: {} })
    })

    it('omits unchanged structural fields from a content save', async () => {
        await objectInstancesApi.saveWorkingCopy(5, content, version, baseline)
        expect(postMock.mock.calls[0][1]).toEqual({
            title: 'Edited', data: {}, widgets: {}, is_featured: false,
            expected_version_id: 7, expected_revision: 2,
        })
    })

    it('sends original baselines with deliberate structural edits', async () => {
        await objectInstancesApi.saveWorkingCopy(5, {
            ...content, parentId: null, metadata: { nested: { a: 2 } },
        }, version, baseline)
        expect(postMock.mock.calls[0][1]).toMatchObject({
            parent: null, expected_parent_id: 3,
            metadata: { nested: { a: 2 } }, expected_metadata: baseline.metadata,
        })
    })

    it.each([{ classificationIds: ['term-id'] }, { classificationIds: [] }])('sends an explicit classification selection $classificationIds', async ({ classificationIds }) => {
        await objectInstancesApi.saveWorkingCopy(5, { ...content, classificationIds }, version, baseline)
        expect(postMock.mock.calls[0][1].classification_ids).toEqual(classificationIds)
    })
})
