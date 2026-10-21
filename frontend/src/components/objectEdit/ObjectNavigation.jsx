import React from 'react'
import { useQuery } from '@tanstack/react-query'
import { objectInstancesApi, objectRelationshipsApi } from '../../api/objectStorage'

const parentId = object => object.parent?.id ?? object.parent

export default function ObjectNavigation({ instanceId, anchorId, onSelect, disabled }) {
    const { data: path, isPending: pathLoading, error: pathError } = useQuery({
        queryKey: ['objectInstance', anchorId, 'pathToRoot'],
        queryFn: () => objectInstancesApi.getPathToRoot(anchorId),
        enabled: !!anchorId,
    })
    // API order is [self, parent, ..., root]. Direct child URLs use the same root.
    const root = path?.data?.at(-1)
    const { data: tree, isPending: treeLoading, error: treeError } = useQuery({
        queryKey: ['objectInstances', 'navigationTree', root?.id],
        queryFn: () => objectInstancesApi.getTree(root.id),
        enabled: !!root?.id,
    })
    // Relations belong to the root context, so a selected supporting object stays visible.
    const relatedId = root?.id
    const { data: related, isPending: relatedLoading, error: relatedError } = useQuery({
        queryKey: ['objectInstances', 'navigationRelations', relatedId],
        queryFn: async () => {
            const [forward, reverse] = await Promise.all([
                objectRelationshipsApi.getRelatedObjects(relatedId),
                objectRelationshipsApi.getRelatedFromObjects(relatedId),
            ])
            const objects = [...(forward.data.relatedObjects || []), ...(reverse.data.relatedFromObjects || [])]
            return [...new Map(objects.filter(item => item.object).map(item => [String(item.object.id), item.object])).values()]
        },
        enabled: !!relatedId,
    })

    const renderButton = (object, depth = 0) => (
        <button type="button" disabled={disabled} onClick={() => onSelect(object.id, root.id)}
            title={object.title}
            aria-current={String(object.id) === String(instanceId) ? 'page' : undefined}
            style={{ paddingLeft: 12 + Math.min(depth, 8) * 16 }}
            className={`block w-full rounded py-2 pr-3 text-left text-sm focus-visible:ring-2 focus-visible:ring-blue-500 disabled:opacity-50 ${String(object.id) === String(instanceId) ? 'bg-blue-100 text-blue-700' : 'text-gray-700 hover:bg-gray-100'}`}>
            <span className="block truncate">{object.title || 'Untitled'}</span>
            <span className="block truncate text-xs text-gray-500">{object.objectTypeLabel || object.objectType?.label}</span>
        </button>
    )
    const objects = tree?.data || []
    const treeIds = new Set(objects.map(object => String(object.id)))
    const relatedObjects = (related || []).filter(object => !treeIds.has(String(object.id)))
    const childrenByParent = new Map()
    objects.forEach(object => {
        const key = String(parentId(object))
        if (!childrenByParent.has(key)) childrenByParent.set(key, [])
        childrenByParent.get(key).push(object)
    })
    const renderBranch = (object, seen = new Set()) => {
        if (seen.has(String(object.id))) return null
        const nextSeen = new Set([...seen, String(object.id)])
        return <li key={object.id}>
            {renderButton(object, seen.size)}
            {childrenByParent.has(String(object.id)) && <ul>
                {childrenByParent.get(String(object.id)).map(child => renderBranch(child, nextSeen))}
            </ul>}
        </li>
    }

    if (!anchorId) return <p className="p-3 text-sm text-gray-500">Save the object to see its relations.</p>
    return <nav aria-label="Object navigation" className="p-2">
        {pathError || treeError ? <p role="alert" className="p-2 text-sm text-red-700">Could not load the object tree. Reopen this object to retry.</p>
            : pathLoading || treeLoading ? <p className="p-2 text-sm text-gray-500">Loading object tree…</p>
                : root && <ul aria-label="Object tree">{renderBranch(objects.find(object => String(object.id) === String(root.id)) || root)}</ul>}
        <h2 className="mb-1 mt-5 px-2 text-xs font-semibold uppercase tracking-wide text-gray-500">Related objects</h2>
        {relatedError ? <p role="alert" className="p-2 text-sm text-red-700">Could not load related objects.</p>
            : relatedLoading ? <p className="p-2 text-sm text-gray-500">Loading relations…</p>
                : relatedObjects.length ? <ul aria-label="Related objects">{relatedObjects.map(object => <li key={object.id}>{root && renderButton(object)}</li>)}</ul>
                    : <p className="p-2 text-sm text-gray-500">No related objects.</p>}
    </nav>
}
