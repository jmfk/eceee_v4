import { getCurrentTenantId } from './tenant'

const STORAGE_VERSION = 1
const MAX_STORED_BRANCHES = 1000
const STORAGE_KEY_PREFIX = 'eceee.pageTree.expansion'

const normalizeId = (value) => {
    if (typeof value === 'number' && Number.isFinite(value)) return String(value)
    if (typeof value !== 'string') return null

    const normalized = value.trim()
    return normalized && normalized.length <= 128 ? normalized : null
}

const normalizeParentId = (value) => value === null ? null : normalizeId(value)

export const getPageTreeExpansionStorageKey = (tenantId = getCurrentTenantId()) => {
    const normalizedTenantId = normalizeId(tenantId) || 'default'
    return `${STORAGE_KEY_PREFIX}.v${STORAGE_VERSION}.${normalizedTenantId}`
}

const removeStoredState = (storageKey) => {
    try {
        localStorage.removeItem(storageKey)
    } catch {
        // Storage may be unavailable. Expansion state should remain usable in memory.
    }
}

export const persistPageTreeExpansionRecords = (records, tenantId = getCurrentTenantId()) => {
    const storageKey = getPageTreeExpansionStorageKey(tenantId)

    try {
        const normalizedRecords = [...records.values()]
            .slice(0, MAX_STORED_BRANCHES)
            .map(record => ({ id: record.id, parentId: record.parentId }))

        localStorage.setItem(storageKey, JSON.stringify({
            version: STORAGE_VERSION,
            records: normalizedRecords,
        }))
    } catch {
        // A full or disabled storage area must not break the page tree.
    }
}

export const loadPageTreeExpansionRecords = (tenantId = getCurrentTenantId()) => {
    const storageKey = getPageTreeExpansionStorageKey(tenantId)
    let parsed

    try {
        const storedValue = localStorage.getItem(storageKey)
        if (!storedValue) return new Map()
        parsed = JSON.parse(storedValue)
    } catch {
        removeStoredState(storageKey)
        return new Map()
    }

    if (parsed?.version !== STORAGE_VERSION || !Array.isArray(parsed.records)) {
        removeStoredState(storageKey)
        return new Map()
    }

    const records = new Map()
    let repaired = parsed.records.length > MAX_STORED_BRANCHES

    for (const candidate of parsed.records.slice(0, MAX_STORED_BRANCHES)) {
        const id = normalizeId(candidate?.id)
        const parentId = normalizeParentId(candidate?.parentId)

        if (!id || (candidate?.parentId !== null && !parentId) || records.has(id)) {
            repaired = true
            continue
        }

        records.set(id, { id, parentId })
    }

    if (repaired) {
        persistPageTreeExpansionRecords(records, tenantId)
    }

    return records
}

export const setPageTreeBranchExpanded = (records, pageId, parentId, isExpanded) => {
    const id = normalizeId(pageId)
    const normalizedParentId = normalizeParentId(parentId)
    if (!id || (parentId !== null && !normalizedParentId)) return records

    const nextRecords = new Map(records)
    if (isExpanded) {
        nextRecords.set(id, { id, parentId: normalizedParentId })
    } else {
        nextRecords.delete(id)
    }
    return nextRecords
}

export const reconcilePageTreeExpansionRecords = (records, parentId, pages) => {
    const normalizedParentId = normalizeParentId(parentId)
    const currentPages = (Array.isArray(pages) ? pages : [])
        .map(page => ({
            id: normalizeId(page?.id),
            isBranch: (Number(page?.childrenCount) || 0) > 0 || (Array.isArray(page?.children) && page.children.length > 0),
        }))
        .filter(page => page.id)
    let nextRecords = records
    const removedIds = new Set()

    for (const currentPage of currentPages) {
        const record = records.get(currentPage.id)
        if (!record) continue

        if (!currentPage.isBranch) {
            removedIds.add(currentPage.id)
        } else if (record.parentId !== normalizedParentId) {
            if (nextRecords === records) nextRecords = new Map(records)
            nextRecords.set(currentPage.id, { id: currentPage.id, parentId: normalizedParentId })
        }
    }

    // Missing pages are not necessarily deleted: sibling responses may be filtered or
    // paginated, and a page may have moved to another parent. Only prune pages that
    // were observed and are confirmed to no longer be branches. Keep their unobserved
    // descendants so a moved branch can be reparented when its destination is loaded.
    if (removedIds.size === 0) return nextRecords

    if (nextRecords === records) nextRecords = new Map(records)
    removedIds.forEach(id => nextRecords.delete(id))
    return nextRecords
}
