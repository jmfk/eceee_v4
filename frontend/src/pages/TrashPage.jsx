import { useEffect, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { RotateCcw, Search, Trash2 } from 'lucide-react'
import { trashApi } from '../api/trash'
import { useGlobalNotifications } from '../contexts/GlobalNotificationContext'
import { useDocumentTitle } from '../hooks/useDocumentTitle'

const types = [
    { value: 'all', label: 'All' },
    { value: 'page', label: 'Pages' },
    { value: 'media', label: 'Media' },
    { value: 'collection', label: 'Collections' },
    { value: 'object', label: 'Objects' },
    { value: 'object_type', label: 'Object types' },
]

const itemKey = (item) => `${item.type}:${item.id}`

export default function TrashPage() {
    useDocumentTitle('Trash')
    const queryClient = useQueryClient()
    const { addNotification } = useGlobalNotifications()
    const [type, setType] = useState('all')
    const [input, setInput] = useState('')
    const [search, setSearch] = useState('')
    const [page, setPage] = useState(1)
    const [selected, setSelected] = useState({})

    useEffect(() => {
        const timer = window.setTimeout(() => setSearch(input.trim()), 250)
        return () => window.clearTimeout(timer)
    }, [input])

    const { data, isLoading, isError, error } = useQuery({
        queryKey: ['global-trash', type, search, page],
        queryFn: () => trashApi.list({ type, search, page, page_size: 25 }),
    })
    const items = data?.results || []
    const selectedItems = Object.values(selected)
    const restore = useMutation({
        mutationFn: (itemsToRestore) => trashApi.restore(itemsToRestore.map(({ type: itemType, id }) => ({ type: itemType, id }))),
        onSuccess: (result) => {
            setSelected({})
            setPage(1)
            queryClient.invalidateQueries({ queryKey: ['global-trash'] })
            queryClient.invalidateQueries({ queryKey: ['deleted-pages'] })
            queryClient.invalidateQueries({ queryKey: ['pages'] })
            addNotification(`Restored ${result.restoredCount} item(s)`, 'success')
            result.warnings?.forEach(warning => addNotification(warning, 'warning'))
        },
        onError: (failure) => addNotification(failure.response?.data?.items || failure.message || 'Could not restore items', 'error'),
    })

    const changeType = (nextType) => {
        setType(nextType)
        setPage(1)
        setSelected({})
    }
    const handleTypeKeyDown = (event) => {
        if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return
        event.preventDefault()
        const current = types.findIndex(option => option.value === type)
        const next = event.key === 'Home' ? 0 : event.key === 'End' ? types.length - 1
            : (current + (event.key === 'ArrowRight' ? 1 : -1) + types.length) % types.length
        changeType(types[next].value)
        event.currentTarget.parentElement.querySelectorAll('[role="tab"]')[next].focus()
    }
    const changeSearch = (value) => {
        setInput(value)
        setPage(1)
        setSelected({})
    }
    const toggle = (item) => {
        const key = itemKey(item)
        setSelected(previous => {
            const next = { ...previous }
            if (next[key]) delete next[key]
            else if (Object.keys(next).length < 100) next[key] = item
            return next
        })
    }
    const visibleUnselected = items.filter(item => !selected[itemKey(item)])
    const selectPage = () => {
        setSelected(previous => {
            const next = { ...previous }
            for (const item of items) {
                if (Object.keys(next).length >= 100) break
                next[itemKey(item)] = item
            }
            return next
        })
    }

    return (
        <div className="container mx-auto px-4 py-6">
            <div className="mb-5 flex items-start gap-3">
                <Trash2 className="mt-1 h-6 w-6 text-blue-600" aria-hidden="true" />
                <div>
                    <h1 className="text-2xl font-bold text-gray-900">Trash</h1>
                    <p className="text-sm text-gray-600">Search and restore deleted CMS items.</p>
                </div>
            </div>
            <div className="border border-gray-200 bg-white">
                <div role="tablist" aria-label="Trash item type" className="flex gap-5 border-b border-gray-200 px-5">
                    {types.map(option => (
                        <button key={option.value} id={`trash-tab-${option.value}`} type="button" role="tab"
                            aria-controls="trash-results" aria-selected={type === option.value} tabIndex={type === option.value ? 0 : -1}
                            onKeyDown={handleTypeKeyDown}
                            onClick={() => changeType(option.value)}
                            className={`border-b-2 px-1 py-3 text-sm ${type === option.value ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-600'}`}>
                            {option.label}{data?.counts && option.value !== 'all' ? ` (${data.counts[option.value]})` : ''}
                        </button>
                    ))}
                </div>
                <div className="flex flex-wrap items-center gap-3 border-b border-gray-200 px-5 py-4">
                    <label className="relative min-w-[15rem] flex-1">
                        <Search className="absolute left-3 top-2.5 h-4 w-4 text-gray-500" aria-hidden="true" />
                        <span className="sr-only">Search Trash</span>
                        <input value={input} onChange={event => changeSearch(event.target.value)} placeholder="Search Trash"
                            className="w-full rounded border border-gray-300 py-2 pl-9 pr-3 text-xs focus:border-blue-600 focus:outline-none" />
                    </label>
                    <span className="text-xs text-gray-600">{data?.count ?? 0} results</span>
                </div>
                {selectedItems.length > 0 && (
                    <div className="flex flex-wrap items-center gap-3 border-b border-gray-200 bg-blue-50 px-5 py-2 text-xs">
                        <span>{selectedItems.length} selected</span>
                        <button type="button" onClick={() => setSelected({})} className="text-blue-700 underline">Clear selection</button>
                        <button type="button" disabled={restore.isPending} onClick={() => restore.mutate(selectedItems)}
                            className="rounded bg-blue-600 px-3 py-1.5 text-white disabled:opacity-50">Restore selected</button>
                    </div>
                )}
                {items.length > 0 && visibleUnselected.length > 0 && (
                    <div className="border-b border-gray-100 px-5 py-2 text-xs">
                        <button type="button" onClick={selectPage} className="text-blue-700 underline">Select this page</button>
                        <span className="ml-3 text-gray-500">Up to 100 items per restore</span>
                    </div>
                )}
                {isLoading && <p className="px-5 py-10 text-sm text-gray-600">Loading Trash…</p>}
                {isError && <p role="alert" className="px-5 py-10 text-sm text-red-700">{error?.message || 'Could not load Trash'}</p>}
                {!isLoading && !isError && items.length === 0 && <p className="px-5 py-10 text-sm text-gray-600">No deleted items match this view.</p>}
                <div id="trash-results" role="tabpanel" aria-labelledby={`trash-tab-${type}`}>
                    {items.map(item => (
                        <div key={itemKey(item)} className="flex items-center gap-3 border-b border-gray-100 px-5 py-3 last:border-b-0">
                            <input type="checkbox" aria-label={`Select ${item.title}`} checked={Boolean(selected[itemKey(item)])}
                                disabled={selectedItems.length >= 100 && !selected[itemKey(item)]} onChange={() => toggle(item)}
                                className="h-4 w-4 accent-blue-600" />
                            <div className="min-w-0 flex-1">
                                <div className="truncate text-sm font-medium text-gray-900">{item.title || item.id}</div>
                                <div className="text-xs text-gray-600">{types.find(option => option.value === item.type)?.label} · Deleted {item.deletedAt ? new Date(item.deletedAt).toLocaleDateString() : 'recently'}</div>
                            </div>
                            <button type="button" disabled={restore.isPending} onClick={() => restore.mutate([item])}
                                className="inline-flex items-center gap-1 rounded border border-gray-300 px-3 py-1.5 text-xs text-blue-700 disabled:opacity-50">
                                <RotateCcw className="h-3.5 w-3.5" aria-hidden="true" /> Restore
                            </button>
                        </div>
                    ))}
                </div>
                {(data?.totalPages || 0) > 1 && (
                    <div className="flex items-center justify-between border-t border-gray-200 px-5 py-3 text-xs">
                        <button type="button" disabled={page <= 1} onClick={() => setPage(page - 1)} className="text-blue-700 disabled:text-gray-400">Previous</button>
                        <span>Page {page} of {data.totalPages}</span>
                        <button type="button" disabled={page >= data.totalPages} onClick={() => setPage(page + 1)} className="text-blue-700 disabled:text-gray-400">Next</button>
                    </div>
                )}
            </div>
        </div>
    )
}
