import { useEffect, useState } from 'react'
import '../user-tools.css'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { kanbanApi, kanbanError } from '../../api/kanban'
import { useAuth } from '../../contexts/AuthContext'
import { getCurrentTenantId, subscribeToCurrentTenantId } from '../../utils/tenant'

// Embedded destination panel; a file always stays attached to its source card.
export default function KanbanImport({
    destination,
    namespace,
    themeId,
    draftVersion,
    assets = [],
    onImported,
    disabled = false,
}) {
    const { user } = useAuth()
    const principal = user?.id ?? user?.username
    const [tenant, setTenant] = useState(getCurrentTenantId)
    useEffect(() => subscribeToCurrentTenantId(setTenant), [])
    const [open, setOpen] = useState(false)
    const [query, setQuery] = useState('')
    const [search, setSearch] = useState('')
    const [assetKey, setAssetKey] = useState('')
    const [tags, setTags] = useState('')
    const [error, setError] = useState('')
    const [busy, setBusy] = useState(false)
    const client = useQueryClient()
    const { data = [], isFetching } = useQuery({
        queryKey: ['kanban', tenant, principal, 'import', search],
        queryFn: async () => await kanbanApi.get('attachments/', { q: search }),
        enabled: open && !!(tenant && principal),
    })
    const importFile = async (file) => {
        if (disabled) return
        setBusy(true)
        setError('')
        try {
            const card = await kanbanApi.get(`cards/${file.card}/`)
            await kanbanApi.post(`attachments/${file.id}/import/`, {
                destination,
                revision: card.revision,
                ...(destination === 'media'
                    ? {
                          namespace,
                          tagIds: tags
                              .split(',')
                              .map((tag) => tag.trim())
                              .filter(Boolean),
                      }
                    : { themeId: Number(themeId), draftVersion, assetKey }),
            })
            await client.invalidateQueries({ queryKey: ['kanban'] })
            await onImported?.()
        } catch (err) {
            setError(kanbanError(err))
        } finally {
            setBusy(false)
        }
    }
    return (
        <section className="user-tools-content user-tools-panel">
            <button type="button" onClick={() => setOpen(!open)} aria-expanded={open}>
                Importera från Kanban
            </button>
            {disabled && <p className="text-sm">Spara eller kasta lokala ändringar innan du importerar.</p>}
            {open && (
                <div className="mt-3 space-y-3">
                    <form
                        className="flex gap-2"
                        onSubmit={(e) => {
                            e.preventDefault()
                            setSearch(query)
                        }}
                    >
                        <input
                            aria-label="Sök kort och bilagor"
                            placeholder="Sök kort och bilagor"
                            value={query}
                            onChange={(e) => setQuery(e.target.value)}
                            className="border border-gray-300 rounded-lg px-3 py-2"
                        />
                        <button disabled={isFetching}>Sök</button>
                    </form>
                    {destination === 'media' ? (
                        <label>
                            Medietaggar (kommaseparerade){' '}
                            <input
                                value={tags}
                                onChange={(e) => setTags(e.target.value)}
                                className="border border-gray-300 rounded-lg px-3 py-2"
                            />
                        </label>
                    ) : (
                        <label>
                            Bild i temat{' '}
                            <select
                                value={assetKey}
                                onChange={(e) => setAssetKey(e.target.value)}
                                className="border border-gray-300 rounded-lg px-3 py-2"
                            >
                                <option value="">Välj bildplats</option>
                                {assets.map((asset) => (
                                    <option key={asset.assetKey} value={asset.assetKey}>
                                        {asset.displayName || asset.assetKey}
                                    </option>
                                ))}
                            </select>
                        </label>
                    )}
                    {error && <p role="alert">{error}</p>}
                    {!isFetching && !data.length && <p>Inga bilagor hittades.</p>}
                    <ul className="space-y-3">
                        {data.map((file) => (
                            <li key={file.id} className="flex flex-wrap gap-3 items-center">
                                <Link to={`/kanban/cards/${file.card}`}>
                                    {file.shortId}: {file.cardTitle}
                                </Link>
                                <span>
                                    {file.filename} · {file.approvedAt ? 'Godkänd' : 'Ej godkänd'}
                                </span>
                                {file.imports.map((item) => (
                                    <span key={item.id}>
                                        Importerad till {item.destination}: {item.destinationLabel}
                                    </span>
                                ))}
                                <button
                                    type="button"
                                    disabled={
                                        disabled ||
                                        busy ||
                                        !file.approvedAt ||
                                        (destination === 'designer' ? !assetKey : !namespace || !tags.trim())
                                    }
                                    onClick={() => importFile(file)}
                                >
                                    Importera kopia
                                </button>
                            </li>
                        ))}
                    </ul>
                </div>
            )}
        </section>
    )
}
