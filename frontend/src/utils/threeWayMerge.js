const equal = (left, right) => JSON.stringify(left) === JSON.stringify(right)
const isObject = value => value !== null && typeof value === 'object' && !Array.isArray(value)
const clone = value => value === undefined ? undefined : JSON.parse(JSON.stringify(value))
const identity = value => isObject(value) ? (value.id ?? value._id ?? null) : null
const valueKind = value => Array.isArray(value) ? 'array' : isObject(value) ? 'object' : 'scalar'

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

function changedOrderPairs(originalOrder, nextOrder) {
    const nextPositions = new Map(nextOrder.map((id, index) => [id, index]))
    const changed = new Map()
    for (let leftIndex = 0; leftIndex < originalOrder.length; leftIndex += 1) {
        for (let rightIndex = leftIndex + 1; rightIndex < originalOrder.length; rightIndex += 1) {
            const left = originalOrder[leftIndex]
            const right = originalOrder[rightIndex]
            if (nextPositions.get(left) > nextPositions.get(right)) {
                changed.set(JSON.stringify([left, right]), [right, left])
            }
        }
    }
    return changed
}

function mergeIndependentOrders(originalOrder, localOrder, serverOrder) {
    const localChanges = changedOrderPairs(originalOrder, localOrder)
    const serverChanges = changedOrderPairs(originalOrder, serverOrder)
    const localAffected = new Set([...localChanges.values()].flat())
    const serverAffected = new Set([...serverChanges.values()].flat())
    if ([...localAffected].some(id => serverAffected.has(id))) return null

    const edges = new Map(originalOrder.map(id => [id, new Set()]))
    const indegree = new Map(originalOrder.map(id => [id, 0]))
    for (let leftIndex = 0; leftIndex < originalOrder.length; leftIndex += 1) {
        for (let rightIndex = leftIndex + 1; rightIndex < originalOrder.length; rightIndex += 1) {
            const originalPair = [originalOrder[leftIndex], originalOrder[rightIndex]]
            const key = JSON.stringify(originalPair)
            const [before, after] = localChanges.get(key) || serverChanges.get(key) || originalPair
            if (!edges.get(before).has(after)) {
                edges.get(before).add(after)
                indegree.set(after, indegree.get(after) + 1)
            }
        }
    }

    const originalPosition = new Map(originalOrder.map((id, index) => [id, index]))
    const ready = originalOrder.filter(id => indegree.get(id) === 0)
    const merged = []
    while (ready.length > 0) {
        ready.sort((left, right) => originalPosition.get(left) - originalPosition.get(right) || left.localeCompare(right))
        const id = ready.shift()
        merged.push(id)
        for (const next of edges.get(id)) {
            indegree.set(next, indegree.get(next) - 1)
            if (indegree.get(next) === 0) ready.push(next)
        }
    }
    return merged.length === originalOrder.length ? merged : null
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
        const bucket = buckets.get(index) || []
        const bucketIds = new Set(bucket)
        const edges = new Map(bucket.map(id => [id, new Set()]))
        const indegree = new Map(bucket.map(id => [id, 0]))
        for (const sourceOrder of [localOrder, serverOrder]) {
            const sequence = sourceOrder.filter(id => bucketIds.has(id))
            for (let position = 1; position < sequence.length; position += 1) {
                const before = sequence[position - 1]
                const after = sequence[position]
                if (!edges.get(before).has(after)) {
                    edges.get(before).add(after)
                    indegree.set(after, indegree.get(after) + 1)
                }
            }
        }

        const ready = bucket.filter(id => indegree.get(id) === 0).sort()
        const orderedBucket = []
        while (ready.length > 0) {
            const id = ready.shift()
            orderedBucket.push(id)
            for (const next of edges.get(id)) {
                indegree.set(next, indegree.get(next) - 1)
                if (indegree.get(next) === 0) {
                    ready.push(next)
                    ready.sort()
                }
            }
        }
        if (orderedBucket.length !== bucket.length) return null
        result.push(...orderedBucket)
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
    let concurrentBaseOrder = null
    if (localReordered && serverReordered && !equal(localBaseOrder, serverBaseOrder)) {
        const sharedIds = new Set(originalOrder.filter(id => localMap.has(id) && serverMap.has(id)))
        const sharedOriginalOrder = originalOrder.filter(id => sharedIds.has(id))
        concurrentBaseOrder = mergeIndependentOrders(
            sharedOriginalOrder,
            localBaseOrder.filter(id => sharedIds.has(id)),
            serverBaseOrder.filter(id => sharedIds.has(id)),
        )
        if (!concurrentBaseOrder) {
            return { value: clone(server), diffs: [diff(path, original, local, server, true)] }
        }
    }

    const allIds = new Set([...localMap.keys(), ...serverMap.keys()])
    const values = new Map()
    const diffs = []
    for (const id of allIds) {
        const result = mergeValue(originalMap.get(id), localMap.get(id), serverMap.get(id), [...path, id])
        diffs.push(...result.diffs)
        if (result.value !== undefined) values.set(id, result.value)
    }

    const baseOrder = concurrentBaseOrder || (localReordered ? localBaseOrder : serverReordered ? serverBaseOrder : originalOrder)
    const mergedOrder = mergeAdditions(baseOrder, originalIds, orderOf(local), orderOf(server), values)
    if (!mergedOrder) {
        return { value: clone(server), diffs: [diff(path, original, local, server, true)] }
    }
    return { value: mergedOrder.map(id => values.get(id)), diffs }
}

export function mergeValue(original, local, server, path = []) {
    if (equal(local, server)) return { value: clone(local), diffs: [] }
    const localChanged = !equal(local, original)
    const serverChanged = !equal(server, original)
    if (!localChanged) return { value: clone(server), diffs: [diff(path, original, local, server, false)] }
    if (!serverChanged) return { value: clone(local), diffs: [diff(path, original, local, server, false)] }

    const kinds = new Set([original, local, server].filter(value => value !== undefined).map(valueKind))
    if (kinds.size > 1) {
        return { value: clone(server), diffs: [diff(path, original, local, server, true)] }
    }

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
