import { useEffect, useState } from 'react'
import { Check, Copy, History, KeyRound, Link2, Pencil, Plus, RotateCw, Trash2, Undo2, X } from 'lucide-react'

import { designerThemesApi } from '../api/designerThemes'
import { objectTransfersApi } from '../api/objectTransfers'

const emptyConnection = { name: '', baseUrl: '', remoteWorkspace: '', accessKey: '', credentialScheme: 'theme_key', isDefault: false }
const defaultCapabilities = ['theme.transfer', 'site.transfer']

const formatDate = (value) => value
    ? new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value))
    : 'Never'

export default function RemoteSitesSettings() {
    const [connections, setConnections] = useState([])
    const [accessKeys, setAccessKeys] = useState([])
    const [checkpoints, setCheckpoints] = useState([])
    const [syncEnabled, setSyncEnabled] = useState(true)
    const [connectionForm, setConnectionForm] = useState(emptyConnection)
    const [editingConnectionId, setEditingConnectionId] = useState(null)
    const [showConnectionForm, setShowConnectionForm] = useState(false)
    const [keyName, setKeyName] = useState('')
    const [keyCapabilities, setKeyCapabilities] = useState(defaultCapabilities)
    const [showKeyForm, setShowKeyForm] = useState(false)
    const [issuedSecret, setIssuedSecret] = useState(null)
    const [confirmingConnectionId, setConfirmingConnectionId] = useState(null)
    const [busy, setBusy] = useState('load')
    const [error, setError] = useState('')
    const [copied, setCopied] = useState(false)

    const load = async () => {
        const connectionResult = await designerThemesApi.remoteConnections()
        const keyResult = await designerThemesApi.remoteAccessKeys()
        const checkpointResult = await objectTransfersApi.listCheckpoints()
        setConnections(connectionResult.results || [])
        setAccessKeys(keyResult.results || [])
        setCheckpoints(checkpointResult.results || [])
        setSyncEnabled(keyResult.syncEnabled !== false)
    }

    const refreshAfterMutation = async (successMessage) => {
        try {
            await load()
        } catch {
            setError(`${successMessage} Reload this page to refresh the list.`)
        }
    }

    useEffect(() => {
        load()
            .catch((loadError) => setError(loadError.message || 'Remote site settings could not be loaded.'))
            .finally(() => setBusy(''))
    }, [])

    const saveConnection = async () => {
        setBusy('connection')
        setError('')
        try {
            if (editingConnectionId) {
                await designerThemesApi.updateRemoteConnection(editingConnectionId, connectionForm)
            } else {
                await designerThemesApi.createRemoteConnection(connectionForm)
            }
            setConnectionForm(emptyConnection)
            setEditingConnectionId(null)
            setShowConnectionForm(false)
            await refreshAfterMutation('The connection was saved, but the settings list could not be refreshed.')
        } catch (saveError) {
            setError(saveError.message || 'The remote connection could not be saved.')
        } finally {
            setBusy('')
        }
    }

    const editConnection = (connection) => {
        setConnectionForm({
            name: connection.name,
            baseUrl: connection.baseUrl,
            remoteWorkspace: connection.remoteWorkspace,
            accessKey: '',
            credentialScheme: connection.credentialScheme || 'theme_key',
            isDefault: connection.isDefault,
        })
        setEditingConnectionId(connection.id)
        setShowConnectionForm(true)
        setConfirmingConnectionId(null)
    }

    const removeConnection = async (connectionId) => {
        setBusy(`remove-${connectionId}`)
        setError('')
        try {
            await designerThemesApi.deleteRemoteConnection(connectionId)
            setConfirmingConnectionId(null)
            await refreshAfterMutation('The connection was removed, but the settings list could not be refreshed.')
        } catch (removeError) {
            setError(removeError.message || 'The remote connection could not be removed.')
        } finally {
            setBusy('')
        }
    }

    const toggleCapability = (capability) => {
        setKeyCapabilities((current) => current.includes(capability)
            ? current.filter((item) => item !== capability)
            : [...current, capability])
    }

    const issueKey = async () => {
        setBusy('key')
        setError('')
        try {
            const result = await designerThemesApi.createRemoteAccessKey({ name: keyName.trim(), capabilities: keyCapabilities })
            setIssuedSecret({ name: result.name, secret: result.secret })
            setCopied(false)
            setKeyName('')
            setKeyCapabilities(defaultCapabilities)
            setShowKeyForm(false)
            await refreshAfterMutation('The access key was created, but the settings list could not be refreshed.')
        } catch (keyError) {
            setError(keyError.message || 'The access key could not be created.')
        } finally {
            setBusy('')
        }
    }

    const rotateKey = async (accessKey) => {
        if (!window.confirm(`Rotate “${accessKey.name}”? The current key will stop working immediately.`)) return
        setBusy(`rotate-${accessKey.id}`)
        setError('')
        try {
            const result = await designerThemesApi.rotateRemoteAccessKey(accessKey.id, accessKey.capabilities)
            setIssuedSecret({ name: result.name, secret: result.secret })
            setCopied(false)
            await refreshAfterMutation('The access key was rotated, but the settings list could not be refreshed.')
        } catch (rotateError) {
            setError(rotateError.message || 'The access key could not be rotated.')
        } finally {
            setBusy('')
        }
    }

    const revokeKey = async (accessKeyId) => {
        const accessKey = accessKeys.find((item) => item.id === accessKeyId)
        if (!accessKey || !window.confirm(`Revoke “${accessKey.name}”? Remote connections using it will stop working.`)) return
        setBusy(`revoke-${accessKeyId}`)
        setError('')
        try {
            await designerThemesApi.revokeRemoteAccessKey(accessKeyId)
            await refreshAfterMutation('The access key was revoked, but the settings list could not be refreshed.')
        } catch (revokeError) {
            setError(revokeError.message || 'The access key could not be revoked.')
        } finally {
            setBusy('')
        }
    }

    const copySecret = async () => {
        try {
            await navigator.clipboard.writeText(issuedSecret.secret)
            setCopied(true)
        } catch {
            setError('The key could not be copied. Select it and copy it manually.')
        }
    }

    const restoreCheckpoint = async (checkpoint) => {
        if (!window.confirm('Restore this checkpoint? Current object and media changes in its scope will be replaced.')) return
        setBusy(`restore-${checkpoint.id}`)
        setError('')
        try {
            const result = await objectTransfersApi.restoreCheckpoint(checkpoint.id)
            setCheckpoints((current) => current.map((item) => item.id === checkpoint.id ? result : item))
        } catch (restoreError) {
            setError(restoreError.message || 'The checkpoint restore could not be started.')
        } finally {
            setBusy('')
        }
    }

    if (busy === 'load') return <p className="p-8 text-sm text-gray-600">Loading remote site settings…</p>

    return <div className="p-8">
        <div className="max-w-4xl">
            <h1 className="text-2xl font-semibold text-gray-900">Remote sites</h1>
            <p className="mt-2 max-w-2xl text-sm text-gray-600">Connect this workspace to other ECEEE sites and control which sites can transfer content from this one.</p>

            {error && <div role="alert" className="mt-6 border-l-4 border-red-500 bg-red-50 px-4 py-3 text-sm text-red-800">{error}</div>}
            {!syncEnabled && <div className="mt-6 border-l-4 border-amber-500 bg-amber-50 px-4 py-3 text-sm text-amber-900">Remote sync is disabled on this installation. Saved keys cannot be used until an operator enables it.</div>}

            {issuedSecret && <section aria-label="New access key" className="mt-8 border-l-4 border-green-500 bg-green-50 px-5 py-4">
                <div className="flex items-start justify-between gap-4">
                    <div>
                        <h2 className="font-semibold text-green-950">Copy {issuedSecret.name} now</h2>
                        <p className="mt-1 text-sm text-green-900">This access key is shown once and cannot be recovered later.</p>
                    </div>
                    <button type="button" aria-label="Dismiss access key" onClick={() => { setIssuedSecret(null); setCopied(false) }} className="min-h-8 min-w-8 text-green-900"><X className="h-5 w-5" /></button>
                </div>
                <div className="mt-4 flex flex-col gap-3 sm:flex-row">
                    <code className="min-w-0 flex-1 overflow-x-auto rounded bg-white px-3 py-2 text-sm text-gray-900">{issuedSecret.secret}</code>
                    <button type="button" onClick={copySecret} className="inline-flex min-h-10 items-center justify-center gap-2 rounded bg-green-700 px-4 py-2 text-sm font-medium text-white">
                        {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}{copied ? 'Copied' : 'Copy key'}
                    </button>
                </div>
            </section>}

            <section className="mt-10" aria-labelledby="outgoing-connections-heading">
                <div className="flex flex-wrap items-start justify-between gap-4">
                    <div>
                        <h2 id="outgoing-connections-heading" className="text-lg font-semibold text-gray-900">Connections to other sites</h2>
                        <p className="mt-1 text-sm text-gray-600">Used when importing sites or transferring themes from this workspace.</p>
                    </div>
                    <button type="button" onClick={() => { setConnectionForm(emptyConnection); setEditingConnectionId(null); setShowConnectionForm(true) }} className="inline-flex min-h-10 items-center gap-2 rounded bg-blue-600 px-4 py-2 text-sm font-medium text-white"><Plus className="h-4 w-4" />Add connection</button>
                </div>

                {showConnectionForm && <div className="mt-6 border-y border-gray-200 py-6">
                    <div className="grid gap-4 md:grid-cols-2">
                        <label className="text-sm font-medium text-gray-700">Name<input aria-label="Connection name" value={connectionForm.name} onChange={(event) => setConnectionForm({ ...connectionForm, name: event.target.value })} className="mt-1 w-full rounded border border-gray-300 px-3 py-2 font-normal" /></label>
                        <label className="text-sm font-medium text-gray-700">Site URL<input aria-label="Site URL" type="url" placeholder="https://example.org" value={connectionForm.baseUrl} onChange={(event) => setConnectionForm({ ...connectionForm, baseUrl: event.target.value })} className="mt-1 w-full rounded border border-gray-300 px-3 py-2 font-normal" /></label>
                        <label className="text-sm font-medium text-gray-700">Remote workspace<input aria-label="Remote workspace" value={connectionForm.remoteWorkspace} onChange={(event) => setConnectionForm({ ...connectionForm, remoteWorkspace: event.target.value })} className="mt-1 w-full rounded border border-gray-300 px-3 py-2 font-normal" /></label>
                        <label className="text-sm font-medium text-gray-700">Credential type<select aria-label="Credential type" value={connectionForm.credentialScheme} onChange={(event) => setConnectionForm({ ...connectionForm, credentialScheme: event.target.value })} className="mt-1 w-full rounded border border-gray-300 px-3 py-2 font-normal"><option value="theme_key">Remote access key</option><option value="api_key">Machine API key</option></select></label>
                        <label className="text-sm font-medium text-gray-700">Access key{editingConnectionId && <span className="font-normal text-gray-500"> · leave blank to keep current</span>}<input aria-label="Access key" type="password" autoComplete="new-password" value={connectionForm.accessKey} onChange={(event) => setConnectionForm({ ...connectionForm, accessKey: event.target.value })} className="mt-1 w-full rounded border border-gray-300 px-3 py-2 font-normal" /></label>
                    </div>
                    <label className="mt-4 flex items-center gap-2 text-sm text-gray-700"><input type="checkbox" checked={connectionForm.isDefault} onChange={(event) => setConnectionForm({ ...connectionForm, isDefault: event.target.checked })} />Use as default</label>
                    <div className="mt-5 flex gap-3">
                        <button type="button" disabled={!connectionForm.name || !connectionForm.baseUrl || !connectionForm.remoteWorkspace || (!editingConnectionId && !connectionForm.accessKey) || busy === 'connection'} onClick={saveConnection} className="min-h-10 rounded bg-blue-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-50">Save connection</button>
                        <button type="button" onClick={() => setShowConnectionForm(false)} className="min-h-10 rounded border border-gray-300 px-4 py-2 text-sm text-gray-700">Cancel</button>
                    </div>
                </div>}

                {connections.length === 0 ? <div className="mt-6 py-6 text-sm text-gray-600">No remote connections. <button type="button" onClick={() => setShowConnectionForm(true)} className="font-medium text-blue-700">Add the first connection</button>.</div> : <div className="mt-6 divide-y divide-gray-200 border-y border-gray-200">{connections.map((connection) => <div key={connection.id} className="flex flex-wrap items-center justify-between gap-4 py-4">
                    <div className="min-w-0">
                        <div className="flex items-center gap-2"><Link2 className="h-4 w-4 text-gray-400" /><p className="font-medium text-gray-900">{connection.name}</p>{connection.isDefault && <span className="text-xs text-gray-500">Default</span>}</div>
                        <p className="mt-1 truncate text-sm text-gray-600">{connection.baseUrl} · {connection.remoteWorkspace} · {connection.credentialScheme === 'api_key' ? 'Machine API key' : 'Remote access key'}</p>
                    </div>
                    {confirmingConnectionId === connection.id ? <div className="flex items-center gap-2 text-sm"><span className="text-gray-700">Remove connection?</span><button type="button" onClick={() => removeConnection(connection.id)} className="min-h-9 rounded bg-red-600 px-3 text-white">Remove</button><button type="button" onClick={() => setConfirmingConnectionId(null)} className="min-h-9 rounded border border-gray-300 px-3">Cancel</button></div> : <div className="flex gap-2">
                        <button type="button" onClick={() => editConnection(connection)} className="inline-flex min-h-9 items-center gap-1.5 rounded border border-gray-300 px-3 text-sm text-gray-700"><Pencil className="h-4 w-4" />Edit</button>
                        <button type="button" onClick={() => setConfirmingConnectionId(connection.id)} className="inline-flex min-h-9 items-center gap-1.5 rounded border border-gray-300 px-3 text-sm text-gray-700"><Trash2 className="h-4 w-4" />Remove</button>
                    </div>}
                </div>)}</div>}
            </section>

            <section className="mt-12 border-t border-gray-200 pt-10" aria-labelledby="incoming-access-heading">
                <div className="flex flex-wrap items-start justify-between gap-4">
                    <div>
                        <h2 id="incoming-access-heading" className="text-lg font-semibold text-gray-900">Access to this site</h2>
                        <p className="mt-1 text-sm text-gray-600">Create scoped keys for other ECEEE installations. Keys belong to the current workspace.</p>
                    </div>
                    <button type="button" onClick={() => setShowKeyForm(true)} className="inline-flex min-h-10 items-center gap-2 rounded bg-blue-600 px-4 py-2 text-sm font-medium text-white"><KeyRound className="h-4 w-4" />Create access key</button>
                </div>

                {showKeyForm && <div className="mt-6 border-y border-gray-200 py-6">
                    <label className="block max-w-xl text-sm font-medium text-gray-700">Key name<input aria-label="Key name" value={keyName} onChange={(event) => setKeyName(event.target.value)} placeholder="Local development" className="mt-1 w-full rounded border border-gray-300 px-3 py-2 font-normal" /></label>
                    <fieldset className="mt-4"><legend className="text-sm font-medium text-gray-700">Allowed transfers</legend><div className="mt-2 flex flex-wrap gap-x-6 gap-y-2">
                        <label className="flex items-center gap-2 text-sm text-gray-700"><input type="checkbox" checked={keyCapabilities.includes('theme.transfer')} onChange={() => toggleCapability('theme.transfer')} />Themes</label>
                        <label className="flex items-center gap-2 text-sm text-gray-700"><input type="checkbox" checked={keyCapabilities.includes('site.transfer')} onChange={() => toggleCapability('site.transfer')} />Sites</label>
                    </div></fieldset>
                    <div className="mt-5 flex gap-3">
                        <button type="button" disabled={!keyName.trim() || keyCapabilities.length === 0 || busy === 'key'} onClick={issueKey} className="min-h-10 rounded bg-blue-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-50">Create access key</button>
                        <button type="button" onClick={() => setShowKeyForm(false)} className="min-h-10 rounded border border-gray-300 px-4 py-2 text-sm text-gray-700">Cancel</button>
                    </div>
                </div>}

                {accessKeys.length === 0 ? <div className="mt-6 py-6 text-sm text-gray-600">No access keys. <button type="button" onClick={() => setShowKeyForm(true)} className="font-medium text-blue-700">Create the first key</button>.</div> : <div className="mt-6 divide-y divide-gray-200 border-y border-gray-200">{accessKeys.map((accessKey) => <div key={accessKey.id} className="flex flex-wrap items-center justify-between gap-4 py-4">
                    <div>
                        <div className="flex flex-wrap items-center gap-2"><p className="font-medium text-gray-900">{accessKey.name}</p><span className={`text-xs ${accessKey.isActive ? 'text-green-700' : 'text-gray-500'}`}>{accessKey.isActive ? 'Active' : 'Revoked'}</span></div>
                        <p className="mt-1 text-sm text-gray-600">{accessKey.keyPrefix}… · {accessKey.capabilities.map((capability) => capability === 'theme.transfer' ? 'Themes' : 'Sites').join(', ')}</p>
                        <p className="mt-1 text-xs text-gray-500">Created {formatDate(accessKey.createdAt)} · Last used {formatDate(accessKey.lastUsedAt)}</p>
                    </div>
                    <div className="flex gap-2">
                        <button type="button" disabled={busy === `rotate-${accessKey.id}`} onClick={() => rotateKey(accessKey)} className="inline-flex min-h-9 items-center gap-1.5 rounded border border-gray-300 px-3 text-sm text-gray-700"><RotateCw className="h-4 w-4" />Rotate</button>
                        {accessKey.isActive && <button type="button" disabled={busy === `revoke-${accessKey.id}`} onClick={() => revokeKey(accessKey.id)} className="min-h-9 rounded border border-gray-300 px-3 text-sm text-gray-700">Revoke</button>}
                    </div>
                </div>)}</div>}
            </section>

            <section className="mt-12 border-t border-gray-200 pt-10" aria-labelledby="recovery-checkpoints-heading">
                <div>
                    <h2 id="recovery-checkpoints-heading" className="text-lg font-semibold text-gray-900">Recovery checkpoints</h2>
                    <p className="mt-1 max-w-2xl text-sm text-gray-600">Destination state saved automatically before a remote import changes objects or media.</p>
                </div>
                {checkpoints.length === 0 ? <div className="mt-6 py-6 text-sm text-gray-600">No transfer checkpoints yet.</div> : <div className="mt-6 divide-y divide-gray-200 border-y border-gray-200">{checkpoints.map((checkpoint) => {
                    const restoring = ['restore_pending', 'restoring'].includes(checkpoint.status)
                    const canRestore = checkpoint.status === 'available'
                    return <div key={checkpoint.id} className="flex flex-wrap items-center justify-between gap-4 py-4">
                        <div className="min-w-0">
                            <div className="flex items-center gap-2"><History className="h-4 w-4 text-gray-400" /><p className="font-medium text-gray-900">Object import checkpoint</p><span className="text-xs text-gray-500">{checkpoint.status.replace('_', ' ')}</span></div>
                            <p className="mt-1 text-sm text-gray-600">Saved {formatDate(checkpoint.createdAt)} · {checkpoint.resourceScopes.join(' and ')}</p>
                        </div>
                        <button type="button" disabled={!canRestore || busy === `restore-${checkpoint.id}`} onClick={() => restoreCheckpoint(checkpoint)} className="inline-flex min-h-9 items-center gap-1.5 rounded border border-gray-300 px-3 text-sm text-gray-700 disabled:opacity-50"><Undo2 className="h-4 w-4" />{restoring ? 'Restore queued' : checkpoint.status === 'restored' ? 'Restored' : 'Restore'}</button>
                    </div>
                })}</div>}
            </section>
        </div>
    </div>
}
