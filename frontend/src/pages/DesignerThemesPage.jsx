import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowDownToLine, ArrowRight, ArrowUpFromLine, GitCompareArrows, History, Palette, Plus, RefreshCw, Settings, Trash2 } from 'lucide-react'
import DesignerNavbar from '../components/DesignerNavbar'
import StatusBar from '../components/StatusBar'
import { designerThemesApi } from '../api/designerThemes'

const formatDate = (value) => value
    ? new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value))
    : 'Unknown'

const DesignerThemesPage = () => {
    const [themes, setThemes] = useState([])
    const [canManageRemotes, setCanManageRemotes] = useState(false)
    const [connections, setConnections] = useState([])
    const [selectedConnectionId, setSelectedConnectionId] = useState('')
    const [selected, setSelected] = useState([])
    const [comparison, setComparison] = useState(null)
    const [versions, setVersions] = useState({})
    const [openHistory, setOpenHistory] = useState(null)
    const [checkpointNames, setCheckpointNames] = useState({})
    const [editingVersionId, setEditingVersionId] = useState(null)
    const [versionNameDraft, setVersionNameDraft] = useState('')
    const [remoteOpen, setRemoteOpen] = useState(false)
    const [connectionForm, setConnectionForm] = useState({ name: '', baseUrl: '', remoteWorkspace: '', accessKey: '', isDefault: false })
    const [editingConnectionId, setEditingConnectionId] = useState(null)
    const [showConnectionForm, setShowConnectionForm] = useState(false)
    const [remoteThemes, setRemoteThemes] = useState([])
    const [loading, setLoading] = useState(true)
    const [busy, setBusy] = useState('')
    const [error, setError] = useState('')

    const loadThemes = async () => {
        const result = await designerThemesApi.list()
        const remoteResult = await designerThemesApi.remoteConnections()
        const remoteConnections = remoteResult.results || []
        setThemes(result.results || [])
        setConnections(remoteConnections)
        setCanManageRemotes(Boolean(remoteResult.canManage))
        setSelectedConnectionId((current) => current || remoteConnections.find((item) => item.isDefault)?.id || remoteConnections[0]?.id || '')
    }

    useEffect(() => {
        loadThemes()
            .catch((err) => setError(err.message || 'Unable to load Designer themes.'))
            .finally(() => setLoading(false))
    }, [])

    const selectedThemes = useMemo(
        () => selected.map((id) => themes.find((theme) => theme.id === id)).filter(Boolean),
        [selected, themes],
    )

    const toggleSelected = (id) => {
        setComparison(null)
        setSelected((current) => current.includes(id) ? current.filter((item) => item !== id) : [...current.slice(-1), id])
    }

    const compare = async () => {
        setBusy('compare')
        setError('')
        try { setComparison(await designerThemesApi.compare(selected[0], selected[1])) }
        catch (err) { setError(err.message || 'Unable to compare themes.') }
        finally { setBusy('') }
    }

    const showVersions = async (themeId) => {
        setOpenHistory(openHistory === themeId ? null : themeId)
        if (!versions[themeId]) {
            const result = await designerThemesApi.versions(themeId)
            setVersions((current) => ({ ...current, [themeId]: result.results || [] }))
        }
    }

    const restore = async (themeId, versionId) => {
        if (!window.confirm('Restore this design as a new current version? Existing history will be kept.')) return
        setBusy(`restore-${versionId}`)
        try {
            await designerThemesApi.restoreVersion(themeId, versionId)
            const list = await designerThemesApi.list()
            const history = await designerThemesApi.versions(themeId)
            setThemes(list.results || [])
            setVersions((current) => ({ ...current, [themeId]: history.results || [] }))
        } catch (err) { setError(err.message || 'Unable to restore the version.') }
        finally { setBusy('') }
    }

    const createCheckpoint = async (themeId) => {
        const name = (checkpointNames[themeId] || '').trim()
        if (!name) return
        setBusy(`checkpoint-${themeId}`)
        setError('')
        try {
            await designerThemesApi.createVersion(themeId, name)
            const list = await designerThemesApi.list()
            const history = await designerThemesApi.versions(themeId)
            setThemes(list.results || [])
            setVersions((current) => ({ ...current, [themeId]: history.results || [] }))
            setCheckpointNames((current) => ({ ...current, [themeId]: '' }))
        } catch (err) { setError(err.message || 'Unable to create the named version.') }
        finally { setBusy('') }
    }

    const saveVersionName = async (themeId, versionId) => {
        setBusy(`name-${versionId}`)
        setError('')
        try {
            await designerThemesApi.nameVersion(themeId, versionId, versionNameDraft.trim())
            const history = await designerThemesApi.versions(themeId)
            setVersions((current) => ({ ...current, [themeId]: history.results || [] }))
            setEditingVersionId(null)
            setVersionNameDraft('')
        } catch (err) { setError(err.message || 'Unable to update the version name.') }
        finally { setBusy('') }
    }

    const connectRemote = async () => {
        setBusy('remote-list')
        setError('')
        try { setRemoteThemes((await designerThemesApi.remoteThemes(selectedConnectionId)).results || []) }
        catch (err) { setError(err.message || 'Unable to connect to the remote site.') }
        finally { setBusy('') }
    }

    const pull = async (stableKey) => {
        setBusy(`pull-${stableKey}`)
        try {
            const result = await designerThemesApi.pullRemoteTheme(selectedConnectionId, stableKey)
            await loadThemes()
            setVersions((current) => { const next = { ...current }; delete next[result.themeId]; return next })
        }
        catch (err) { setError(err.message || 'Unable to download the theme.') }
        finally { setBusy('') }
    }

    const push = async (themeId) => {
        setBusy(`push-${themeId}`)
        try { await designerThemesApi.pushRemoteTheme(selectedConnectionId, themeId); await connectRemote() }
        catch (err) { setError(err.message || 'Unable to upload the theme.') }
        finally { setBusy('') }
    }

    const saveConnection = async () => {
        setBusy('save-connection')
        setError('')
        try {
            if (editingConnectionId) await designerThemesApi.updateRemoteConnection(editingConnectionId, connectionForm)
            else await designerThemesApi.createRemoteConnection(connectionForm)
            setConnectionForm({ name: '', baseUrl: '', remoteWorkspace: '', accessKey: '', isDefault: false })
            setEditingConnectionId(null)
            setShowConnectionForm(false)
            await loadThemes()
        } catch (err) { setError(err.message || 'Unable to save the remote site.') }
        finally { setBusy('') }
    }

    const editConnection = (connection) => {
        setConnectionForm({ name: connection.name, baseUrl: connection.baseUrl, remoteWorkspace: connection.remoteWorkspace, accessKey: '', isDefault: connection.isDefault })
        setEditingConnectionId(connection.id)
        setShowConnectionForm(true)
    }

    const removeConnection = async (connection) => {
        if (!window.confirm(`Remove the saved remote site “${connection.name}”?`)) return
        setBusy(`delete-${connection.id}`)
        try { await designerThemesApi.deleteRemoteConnection(connection.id); setRemoteThemes([]); setSelectedConnectionId(''); await loadThemes() }
        catch (err) { setError(err.message || 'Unable to remove the remote site.') }
        finally { setBusy('') }
    }

    return <div className="fixed inset-0 flex flex-col bg-gray-50">
        <DesignerNavbar />
        <main className="flex-1 overflow-y-auto"><div className="mx-auto max-w-6xl px-6 py-10">
            <div className="mb-8 flex flex-wrap items-start justify-between gap-4">
                <div><h1 className="text-2xl font-bold text-gray-900">Designer themes</h1><p className="mt-1 text-sm text-gray-600">Compare designs, inspect version history, or open a theme for editing.</p></div>
                {(connections.length > 0 || canManageRemotes) && <button type="button" onClick={() => setRemoteOpen((value) => !value)} className="inline-flex items-center gap-2 rounded-md border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"><RefreshCw className="h-4 w-4" />Remote sites</button>}
            </div>
            {error && <div role="alert" className="mb-5 rounded-lg border border-red-200 bg-red-50 p-4 text-red-800">{error}</div>}
            {remoteOpen && <section className="mb-6 rounded-lg border border-gray-200 bg-white p-5" aria-label="Remote sites panel">
                <div className="flex flex-wrap items-start justify-between gap-3"><div><h2 className="font-semibold text-gray-900">Remote sites</h2><p className="mt-1 text-sm text-gray-600">Choose a saved connection. Access keys remain protected on the server.</p></div>{canManageRemotes && <button type="button" onClick={() => { setEditingConnectionId(null); setConnectionForm({ name: '', baseUrl: '', remoteWorkspace: '', accessKey: '', isDefault: false }); setShowConnectionForm((value) => !value) }} className="inline-flex items-center gap-2 rounded-md border border-gray-300 px-3 py-2 text-sm"><Plus className="h-4 w-4" />Add remote site</button>}</div>
                {showConnectionForm && <div className="mt-4 rounded-md border border-gray-200 bg-gray-50 p-4"><div className="grid gap-3 md:grid-cols-2"><label className="text-sm text-gray-700">Name<input aria-label="Connection name" value={connectionForm.name} onChange={(event) => setConnectionForm({ ...connectionForm, name: event.target.value })} className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2" /></label><label className="text-sm text-gray-700">Site URL<input aria-label="Site URL" value={connectionForm.baseUrl} onChange={(event) => setConnectionForm({ ...connectionForm, baseUrl: event.target.value })} placeholder="https://example.org" className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2" /></label><label className="text-sm text-gray-700">Remote workspace<input aria-label="Remote workspace" value={connectionForm.remoteWorkspace} onChange={(event) => setConnectionForm({ ...connectionForm, remoteWorkspace: event.target.value })} className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2" /></label><label className="text-sm text-gray-700">Access key{editingConnectionId && ' (leave blank to keep current)'}<input aria-label="Access key" type="password" autoComplete="new-password" value={connectionForm.accessKey} onChange={(event) => setConnectionForm({ ...connectionForm, accessKey: event.target.value })} className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2" /></label></div><label className="mt-3 flex items-center gap-2 text-sm"><input type="checkbox" checked={connectionForm.isDefault} onChange={(event) => setConnectionForm({ ...connectionForm, isDefault: event.target.checked })} />Use as default</label><div className="mt-4 flex gap-2"><button type="button" disabled={!connectionForm.name || !connectionForm.baseUrl || !connectionForm.remoteWorkspace || (!editingConnectionId && !connectionForm.accessKey) || busy === 'save-connection'} onClick={saveConnection} className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-50">Save connection</button><button type="button" onClick={() => setShowConnectionForm(false)} className="rounded-md border border-gray-300 px-4 py-2 text-sm">Cancel</button></div></div>}
                {connections.length > 0 ? <div className="mt-4 flex flex-wrap items-end gap-3"><label className="min-w-72 flex-1 text-sm text-gray-700">Remote site<select aria-label="Remote site" value={selectedConnectionId} onChange={(event) => { setSelectedConnectionId(event.target.value); setRemoteThemes([]) }} className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2">{connections.map((item) => <option key={item.id} value={item.id}>{item.name}{item.isDefault ? ' · Default' : ''}</option>)}</select></label><button type="button" disabled={!selectedConnectionId || busy === 'remote-list'} onClick={connectRemote} className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-50">Refresh themes</button></div> : <p className="mt-4 text-sm text-gray-600">No remote sites have been configured for this workspace.</p>}
                {canManageRemotes && connections.length > 0 && <div className="mt-4 divide-y divide-gray-200 border-y border-gray-200">{connections.map((item) => <div key={item.id} className="flex items-center justify-between gap-3 py-3 text-sm"><div><span className="font-medium text-gray-900">{item.name}</span>{item.isDefault && <span className="ml-2 text-xs text-gray-500">Default</span>}<p className="text-xs text-gray-500">{item.baseUrl} · {item.remoteWorkspace}</p></div><div className="flex gap-2"><button type="button" onClick={() => editConnection(item)} className="inline-flex items-center gap-1 rounded border border-gray-300 px-2 py-1"><Settings className="h-3.5 w-3.5" />Edit</button><button type="button" onClick={() => removeConnection(item)} className="inline-flex items-center gap-1 rounded border border-gray-300 px-2 py-1"><Trash2 className="h-3.5 w-3.5" />Remove</button></div></div>)}</div>}
                {remoteThemes.length > 0 && <div className="mt-5 divide-y divide-gray-200 border-t border-gray-200">{remoteThemes.map((theme) => <div key={theme.stableKey || theme.name} className="flex items-center justify-between gap-4 py-3"><div><p className="font-medium text-gray-900">{theme.name}</p><p className="text-xs text-gray-500">Remote version {theme.syncVersion}</p></div><button type="button" onClick={() => pull(theme.stableKey)} disabled={busy === `pull-${theme.stableKey}`} className="inline-flex items-center gap-2 rounded-md border border-gray-300 px-3 py-2 text-sm"><ArrowDownToLine className="h-4 w-4" />Download as version</button></div>)}</div>}
            </section>}
            {selected.length === 2 && <section className="mb-6 rounded-lg border border-blue-200 bg-blue-50 p-4">
                <div className="flex flex-wrap items-center justify-between gap-3"><p className="text-sm font-medium text-blue-950">Compare {selectedThemes[0]?.name} with {selectedThemes[1]?.name}</p><button type="button" onClick={compare} disabled={busy === 'compare'} className="inline-flex items-center gap-2 rounded-md bg-blue-600 px-3 py-2 text-sm font-medium text-white"><GitCompareArrows className="h-4 w-4" />Compare</button></div>
                {comparison && <div className="mt-4 border-t border-blue-200 pt-4 text-sm text-blue-950"><p className="font-semibold">{comparison.identical ? 'The themes are identical.' : `${comparison.changedPaths.length} differences found.`}</p><p className="mt-1">{comparison.newerThemeId ? `${themes.find((theme) => theme.id === comparison.newerThemeId)?.name} is newer.` : 'Both were updated at the same time.'}</p>{comparison.changedAreas?.length > 0 && <p className="mt-2">Changed areas: {comparison.changedAreas.join(', ')}</p>}{comparison.changedPaths?.length > 0 && <details className="mt-2"><summary className="cursor-pointer">Show exact fields</summary><ul className="mt-2 list-disc pl-5">{comparison.changedPaths.map((path) => <li key={path}>{path}</li>)}</ul></details>}</div>}
            </section>}
            {loading && <p className="text-gray-600">Loading themes…</p>}
            {!loading && themes.length === 0 && <div className="rounded-lg border border-dashed border-gray-300 bg-white p-10 text-center"><Palette className="mx-auto h-10 w-10 text-gray-400" /><h2 className="mt-3 font-semibold text-gray-900">No assigned themes</h2></div>}
            <div className="grid gap-4 sm:grid-cols-2">{themes.map((theme) => <article key={theme.id} className={`rounded-lg border bg-white p-5 ${selected.includes(theme.id) ? 'border-blue-500 ring-1 ring-blue-500' : 'border-gray-200'}`}>
                <div className="flex items-start gap-3"><input type="checkbox" aria-label={`Select ${theme.name} for comparison`} checked={selected.includes(theme.id)} onChange={() => toggleSelected(theme.id)} className="mt-1 h-4 w-4 rounded border-gray-300" /><div className="min-w-0 flex-1"><h2 className="font-semibold text-gray-900">{theme.name}</h2><p className="mt-1 line-clamp-2 text-sm text-gray-600">{theme.description || 'No description'}</p></div><Link to={`/designer/themes/${theme.id}`} aria-label={`Open ${theme.name}`}><ArrowRight className="h-5 w-5 text-gray-400 hover:text-blue-600" /></Link></div>
                <div className="mt-4 flex items-center justify-between gap-3 text-xs text-gray-500"><span>Updated {formatDate(theme.updatedAt)}</span><button type="button" onClick={() => showVersions(theme.id)} className="inline-flex items-center gap-1 font-medium text-blue-700"><History className="h-4 w-4" />{theme.versionCount} {theme.versionCount === 1 ? 'version' : 'versions'}</button></div>
                {remoteThemes.length > 0 && <button type="button" onClick={() => push(theme.id)} disabled={busy === `push-${theme.id}`} className="mt-3 inline-flex items-center gap-2 rounded-md border border-gray-300 px-3 py-2 text-sm"><ArrowUpFromLine className="h-4 w-4" />Upload new remote version</button>}
                {openHistory === theme.id && <div className="mt-4 border-t border-gray-200 pt-3">
                    <h3 className="text-sm font-semibold text-gray-900">Version history</h3>
                    <div className="mt-3 flex gap-2">
                        <input aria-label={`New version name for ${theme.name}`} value={checkpointNames[theme.id] || ''} onChange={(event) => setCheckpointNames((current) => ({ ...current, [theme.id]: event.target.value }))} placeholder="Name this checkpoint…" maxLength={160} className="min-w-0 flex-1 rounded-md border border-gray-300 px-3 py-2 text-sm" />
                        <button type="button" disabled={!(checkpointNames[theme.id] || '').trim() || busy === `checkpoint-${theme.id}`} onClick={() => createCheckpoint(theme.id)} className="rounded-md bg-blue-600 px-3 py-2 text-sm font-medium text-white disabled:opacity-50">Save version</button>
                    </div>
                    <ol className="mt-3 divide-y divide-gray-100">{(versions[theme.id] || []).map((version) => <li key={version.id} className="py-3 text-sm">
                        {editingVersionId === version.id ? <div className="flex gap-2">
                            <input aria-label={`Name for version ${version.versionNumber}`} value={versionNameDraft} onChange={(event) => setVersionNameDraft(event.target.value)} maxLength={160} placeholder="Optional version name" className="min-w-0 flex-1 rounded border border-gray-300 px-2 py-1.5 text-sm" />
                            <button type="button" disabled={busy === `name-${version.id}`} onClick={() => saveVersionName(theme.id, version.id)} className="rounded bg-blue-600 px-2 py-1 text-xs font-medium text-white">Save</button>
                            <button type="button" onClick={() => { setEditingVersionId(null); setVersionNameDraft('') }} className="rounded border border-gray-300 px-2 py-1 text-xs">Cancel</button>
                        </div> : <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0"><div className="flex flex-wrap items-center gap-x-2"><span className="font-mono text-xs text-gray-500">v{version.versionNumber}</span><span className="font-medium text-gray-900">{version.name || 'Unnamed version'}</span>{version.isCurrent && <span className="rounded bg-green-50 px-1.5 py-0.5 text-[11px] font-medium text-green-700">Current</span>}</div><p className="mt-1 text-xs text-gray-500">{formatDate(version.createdAt)} · {version.sourceLabel || version.source}</p></div>
                            <div className="flex shrink-0 gap-2"><button type="button" onClick={() => { setEditingVersionId(version.id); setVersionNameDraft(version.name || '') }} className="rounded border border-gray-300 px-2 py-1 text-xs">{version.name ? 'Rename' : 'Name'}</button>{!version.isCurrent && <button type="button" disabled={busy === `restore-${version.id}`} onClick={() => restore(theme.id, version.id)} className="rounded border border-gray-300 px-2 py-1 text-xs">Restore</button>}</div>
                        </div>}
                    </li>)}</ol>
                </div>}
            </article>)}</div>
        </div></main>
        <StatusBar customStatusContent={<span>Designer themes</span>} />
    </div>
}

export default DesignerThemesPage
