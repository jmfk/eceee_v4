const compareObjectTypes = (a, b) => (a.label || a.name || '').localeCompare(b.label || b.name || '')

export const buildObjectTypeGroups = (objectTypes) => {
    const typesById = new Map(objectTypes.map(type => [String(type.id), type]))
    const groupsById = new Map()

    objectTypes.forEach(type => {
        const requestedGroup = type.browserGroup ? typesById.get(String(type.browserGroup.id)) : null
        const hasValidMainGroup = requestedGroup && !requestedGroup.browserGroup
        const mainType = hasValidMainGroup ? requestedGroup : type
        const groupKey = String(mainType.id)

        if (!groupsById.has(groupKey)) {
            groupsById.set(groupKey, { primary: mainType, supporting: [] })
        }
        if (mainType.id !== type.id) {
            groupsById.get(groupKey).supporting.push(type)
        }
    })

    return Array.from(groupsById.values())
        .map(group => ({ ...group, supporting: group.supporting.sort(compareObjectTypes) }))
        .sort((a, b) => compareObjectTypes(a.primary, b.primary))
}
