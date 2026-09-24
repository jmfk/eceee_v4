import { beforeEach, describe, expect, it } from 'vitest'
import {
    getPageTreeExpansionStorageKey,
    loadPageTreeExpansionRecords,
    persistPageTreeExpansionRecords,
    reconcilePageTreeExpansionRecords,
    setPageTreeBranchExpanded,
} from '../pageTreeExpansionStorage'

const tenantId = 'tree-test'

describe('page tree expansion storage', () => {
    beforeEach(() => {
        localStorage.clear()
    })

    it('defaults to every branch collapsed', () => {
        expect(loadPageTreeExpansionRecords(tenantId)).toEqual(new Map())
    })

    it('round-trips expanded branches with their parent relationships', () => {
        let records = new Map()
        records = setPageTreeBranchExpanded(records, 1, null, true)
        records = setPageTreeBranchExpanded(records, 2, 1, true)
        persistPageTreeExpansionRecords(records, tenantId)

        expect([...loadPageTreeExpansionRecords(tenantId).values()]).toEqual([
            { id: '1', parentId: null },
            { id: '2', parentId: '1' },
        ])
    })

    it('repairs malformed storage without throwing', () => {
        const storageKey = getPageTreeExpansionStorageKey(tenantId)
        localStorage.setItem(storageKey, '{broken json')

        expect(loadPageTreeExpansionRecords(tenantId)).toEqual(new Map())
        expect(localStorage.getItem(storageKey)).toBeNull()
    })

    it('removes vanished branches and their remembered descendants', () => {
        const records = new Map([
            ['1', { id: '1', parentId: null }],
            ['2', { id: '2', parentId: '1' }],
            ['3', { id: '3', parentId: '2' }],
            ['4', { id: '4', parentId: null }],
        ])

        const reconciled = reconcilePageTreeExpansionRecords(records, null, [
            { id: 4, childrenCount: 1 },
        ])

        expect([...reconciled.keys()]).toEqual(['4'])
    })

    it('forgets a page that externally stops being a branch', () => {
        const records = new Map([
            ['1', { id: '1', parentId: null }],
            ['2', { id: '2', parentId: '1' }],
        ])

        const reconciled = reconcilePageTreeExpansionRecords(records, null, [
            { id: 1, childrenCount: 0 },
        ])

        expect(reconciled.size).toBe(0)
    })
})
