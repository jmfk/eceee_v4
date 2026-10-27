import { beforeEach, describe, expect, it, vi } from 'vitest'

const postMock = vi.hoisted(() => vi.fn())
const deleteMock = vi.hoisted(() => vi.fn())

vi.mock('../client.js', () => ({
    default: {
        post: postMock,
        delete: deleteMock,
    },
}))

import { valueListsApi } from '../valueLists.js'

describe('valueListsApi camelCase contract', () => {
    beforeEach(() => {
        postMock.mockReset()
        postMock.mockResolvedValue({ data: {} })
        deleteMock.mockReset()
        deleteMock.mockResolvedValue({ status: 204 })
    })

    it('removes an item with a camelCase request field', async () => {
        await valueListsApi.removeItem(7, 11)

        expect(deleteMock).toHaveBeenCalledWith(
            '/api/v1/utils/value-lists/7/remove_item/',
            { data: { itemId: 11 } },
        )
    })

    it('reorders items with a camelCase request field', async () => {
        const itemOrders = [{ id: 11, order: 1 }]

        await valueListsApi.reorderItems(7, itemOrders)

        expect(postMock).toHaveBeenCalledWith(
            '/api/v1/utils/value-lists/7/reorder_items/',
            { itemOrders },
        )
    })
})
