const equal = (left, right) => JSON.stringify(left) === JSON.stringify(right)
const isObject = value => value !== null && typeof value === 'object' && !Array.isArray(value)
const clone = value => value === undefined ? undefined : JSON.parse(JSON.stringify(value))
const identity = value => isObject(value) ? (value.id ?? value._id ?? null) : null

const ignoredKeys = new Set([
    'createdAt', 'updatedAt', 'createdBy', 'lastEditedBy', 'editRevision',
    'publicationStatus', 'isPublished', 'isCurrentPublished', 'effectiveTheme',
    'themeInheritanceInfo', 'absoluteUrl', 'breadcrumbs', 'childrenCount', '__typename'
])

function diff(path, original, local, server, hasConflict) {
    return {
        path,
        pathString: path.join('.'),
        pathDisplay: path.map(value => String(value).replace(/([A-Z])/g, ' $1')).join(' → '),
        original: clone(original),
        local: clone(local),
        server: clone(server),
        localChanged: !equal(local, original),
        serverChanged: !equal(server, original),
        hasConflict,
    }
}

function keyed(array) {
    if (!Array.isArray(array)) return false
    const ids = array.map(identity)
    return ids.every(id => id !== null && id !== undefined && id !== '') && new Set(ids.map(String)).size === ids.length
}

function orderOf(array, allowed = null) {
    return array.map(item => String(identity(item))).filter(id => !allowed || allowed.has(id))
}

function mergeAdditions(baseOrder, originalIds, localOrder, serverOrder, values) {
    const base = baseOrder.filter(id => values.has(id) && originalIds.has(id))
    const additions = [...values.keys()].filter(id => !originalIds.has(id))
    const buckets = new Map()

    for (const id of additions) {
        const source = localOrder.includes(id) ? localOrder : serverOrder
        const position = source.indexOf(id)
        const previous = [...source.slice(0, position)].reverse().find(candidate => base.includes(candidate))
        const next = source.slice(position + 1).find(candidate => base.includes(candidate))
        const insertionIndex = next ? base.indexOf(next) : previous ? base.indexOf(previous) + 1 : base.length
        const bucket = buckets.get(insertionIndex) || []
        bucket.push(id)
        buckets.set(insertionIndex, bucket)
    }

    const result = []
    for (let index = 0; index <= base.length; index += 1) {
        result.push(...(buckets.get(index) || []).sort())
        if (index < base.length) result.push(base[index])
    }
    return result
}

function mergeKeyedArray(original, local, server, path) {
    const originalMap = new Map(original.map(item => [String(identity(item)), item]))
    const localMap = new Map(local.map(item => [String(identity(item)), item]))
    const serverMap = new Map(server.map(item => [String(identity(item)), item]))
    const originalIds = new Set(originalMap.keys())

    for (const id of originalIds) {
        const localMissing = !localMap.has(id)
        const serverMissing = !serverMap.has(id)
        if (localMissing !== serverMissing) {
            const retained = localMissing ? serverMap.get(id) : localMap.get(id)
            const retainedArray = localMissing ? server : local
            const retainedIds = new Set(orderOf(retainedArray))
            const retainedOrder = orderOf(retainedArray, originalIds)
            const originalRetainedOrder = orderOf(original).filter(candidate => retainedIds.has(candidate))
            const retainedWasMoved = !equal(retainedOrder, originalRetainedOrder)
            if (!equal(retained, originalMap.get(id)) || retainedWasMoved) {
                return { value: clone(server), diffs: [diff(path, original, local, server, true)] }
            }
        }
    }

    const localBaseOrder = orderOf(local, originalIds)
    const serverBaseOrder = orderOf(server, originalIds)
    const originalOrder = orderOf(original)
    const localReordered = !equal(localBaseOrder, originalOrder.filter(id => localMap.has(id)))
    const serverReordered = !equal(serverBaseOrder, originalOrder.filter(id => serverMap.has(id)))
    if (localReordered && serverReordered && !equal(localBaseOrder, serverBaseOrder)) {
        return { value: clone(server), diffs: [diff(path, original, local, server, true)] }
    }

    const allIds = new Set([...localMap.keys(), ...serverMap.keys()])
    const values = new Map()
    const diffs = []
    for (const id of allIds) {
        const result = mergeValue(originalMap.get(id), localMap.get(id), serverMap.get(id), [...path, id])
        diffs.push(...result.diffs)
        if (result.value !== undefined) values.set(id, result.value)
    }

    const baseOrder = localReordered ? localBaseOrder : serverReordered ? serverBaseOrder : originalOrder
    const mergedOrder = mergeAdditions(baseOrder, originalIds, orderOf(local), orderOf(server), values)
    return { value: mergedOrder.map(id => values.get(id)), diffs }
}

export function mergeValue(original, local, server, path = []) {
    if (equal(local, server)) return { value: clone(local), diffs: [] }
    const localChanged = !equal(local, original)
    const serverChanged = !equal(server, original)
    if (!localChanged) return { value: clone(server), diffs: [diff(path, original, local, server, false)] }
    if (!serverChanged) return { value: clone(local), diffs: [diff(path, original, local, server, false)] }

    if (isObject(original) || isObject(local) || isObject(server)) {
        const source = { ...(server || {}) }
        const diffs = []
        const keys = new Set([
            ...Object.keys(original || {}), ...Object.keys(local || {}), ...Object.keys(server || {})
        ])
        for (const key of keys) {
            if (ignoredKeys.has(key)) continue
            const result = mergeValue(original?.[key], local?.[key], server?.[key], [...path, key])
            diffs.push(...result.diffs)
            if (result.value === undefined) delete source[key]
            else source[key] = result.value
        }
        return { value: source, diffs }
    }

    if (Array.isArray(original) || Array.isArray(local) || Array.isArray(server)) {
        const originalArray = Array.isArray(original) ? original : []
        const localArray = Array.isArray(local) ? local : []
        const serverArray = Array.isArray(server) ? server : []
        if (keyed(originalArray) && keyed(localArray) && keyed(serverArray)) {
            return mergeKeyedArray(originalArray, localArray, serverArray, path)
        }
        return { value: clone(server), diffs: [diff(path, original, local, server, true)] }
    }

    return { value: clone(server), diffs: [diff(path, original, local, server, true)] }
}

export function mergePageState(originalWebpage, localWebpage, serverWebpage, originalVersion, localVersion, serverVersion) {
    const webpage = mergeValue(originalWebpage, localWebpage, serverWebpage, ['webpage'])
    const version = mergeValue(originalVersion, localVersion, serverVersion, ['version'])
    const allDiffs = [...webpage.diffs, ...version.diffs]
    return {
        mergedWebpage: webpage.value,
        mergedVersion: version.value,
        allDiffs,
        conflicts: allDiffs.filter(item => item.hasConflict),
    }
}
