import React, { useEffect, useMemo, useState } from 'react'
import { AlertCircle, Check, Download, X } from 'lucide-react'
import { designerThemesApi } from '../api/designerThemes'
import { objectTransfersApi } from '../api/objectTransfers'

const errorText = error => error?.response?.data?.error || error?.message || 'Could not load remote objects.'

const RemoteObjectImport = ({ onClose, onCompleted }) => {
    const [connections, setConnections] = useState([])
    const [connectionId, setConnectionId] = useState('')
    const [types, setTypes] = useState([])
    const [limits, setLimits] = useState({})
    const [groups, setGroups] = useState([])
    const [selected, setSelected] = useState([])
    const [preflight, setPreflight] = useState(null)
    const [resolutions, setResolutions] = useState({})
    const [namespaceResolutions, setNamespaceResolutions] = useState({})
    const [busy, setBusy] = useState('connections')
    const [error, setError] = useState('')
    const [job, setJob] = useState(null)

    useEffect(() => {
        designerThemesApi.remoteConnections().then(result => {
            const apiConnections = (result.results || []).filter(item => item.credentialScheme === 'api_key')
            setConnections(apiConnections)
            setConnectionId(apiConnections.find(item => item.isDefault)?.id || apiConnections[0]?.id || '')
            setBusy('')
        }).catch(value => { setError(errorText(value)); setBusy('') })
    }, [])

    useEffect(() => {
        if (!job || ['completed', 'failed'].includes(job.status)) return undefined
        const timer = window.setTimeout(async () => {
            try {
                const next = await objectTransfersApi.getImport(job.id)
                setJob(next)
                if (next.status === 'completed') onCompleted?.(next)
            } catch (value) {
                setError(errorText(value))
            }
        }, 1500)
        return () => window.clearTimeout(timer)
    }, [job, onCompleted])

    const selectedTypes = useMemo(() => Object.keys(limits), [limits])

    const loadTypes = async () => {
        setBusy('types'); setError('')
        try {
            const result = await objectTransfersApi.catalog(connectionId)
            setTypes(result.objectTypes || [])
        } catch (value) { setError(errorText(value)) } finally { setBusy('') }
    }

    const loadCandidates = async () => {
        setBusy('candidates'); setError('')
        try {
            const selections = selectedTypes.map(objectType => ({ objectType, limit: limits[objectType] }))
            const result = await objectTransfersApi.catalog(connectionId, selections)
            setGroups(result.results || [])
            setSelected([])
            setPreflight(null)
        } catch (value) { setError(errorText(value)) } finally { setBusy('') }
    }

    const runPreflight = async () => {
        setBusy('preflight'); setError('')
        try {
            const result = await objectTransfersApi.preflight(connectionId, selected)
            setPreflight(result)
            setResolutions(Object.fromEntries((result.typeConflicts || []).map(item => [item.name, item.compatible ? 'keep' : (item.usedByOtherTenants ? 'skip' : 'update')])))
            setNamespaceResolutions(Object.fromEntries((result.namespaceConflicts || []).map(item => [item.slug, result.destinationNamespaces?.[0]?.slug || ''])))
        } catch (value) { setError(errorText(value)) } finally { setBusy('') }
    }

    const startImport = async () => {
        setBusy('import'); setError('')
        try { setJob(await objectTransfersApi.createImport(connectionId, selected, resolutions, namespaceResolutions)) }
        catch (value) { setError(errorText(value)); setBusy('') }
    }

    return (
        <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/40 px-4 py-10" role="dialog" aria-modal="true" aria-labelledby="remote-object-title">
            <div className="w-full max-w-3xl rounded-lg bg-white p-6 shadow-xl">
                <div className="flex items-start justify-between gap-4">
                    <div><h2 id="remote-object-title" className="text-xl font-semibold text-gray-900">Import remote objects</h2><p className="mt-1 text-sm text-gray-600">Limit the candidate list, then choose the root objects to import.</p></div>
                    <button type="button" onClick={onClose} aria-label="Close remote object import" className="rounded-md p-2 text-gray-500 hover:bg-gray-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"><X className="h-5 w-5" /></button>
                </div>

                {error && <div className="mt-5 flex gap-3 rounded-md bg-red-50 p-3 text-sm text-red-800"><AlertCircle className="mt-0.5 h-4 w-4 flex-none" /><span>{error} Check the connection and try again.</span></div>}

                {!job && <div className="mt-6 space-y-6">
                    <div className="flex items-end gap-3"><label className="flex-1 text-sm font-medium text-gray-700">Remote site<select value={connectionId} onChange={event => { setConnectionId(event.target.value); setTypes([]); setLimits({}); setGroups([]); setSelected([]); setPreflight(null) }} className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2"><option value="">Choose a site</option>{connections.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label><button type="button" disabled={!connectionId || busy} onClick={loadTypes} className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-50">Load types</button></div>
                    {!busy && connections.length === 0 && <p className="text-sm text-gray-600">No remote site has a machine API key. Update a saved connection in Designer themes first.</p>}

                    {types.length > 0 && <section><h3 className="text-sm font-semibold text-gray-900">Types and candidate limits</h3><div className="mt-3 grid gap-2 sm:grid-cols-2">{types.map(type => <label key={type.name} className="flex items-center gap-3 py-2 text-sm"><input type="checkbox" checked={limits[type.name] !== undefined} onChange={event => setLimits(current => { const next = { ...current }; if (event.target.checked) next[type.name] = 100; else delete next[type.name]; return next })} /><span className="min-w-0 flex-1 truncate">{type.pluralLabel || type.label}</span>{limits[type.name] !== undefined && <input aria-label={`Candidate limit for ${type.label}`} type="number" min="1" max="500" value={limits[type.name]} onChange={event => setLimits(current => ({ ...current, [type.name]: Math.min(500, Math.max(1, Number(event.target.value))) }))} className="w-20 rounded-md border border-gray-300 px-2 py-1" />}</label>)}</div><button type="button" disabled={!selectedTypes.length || busy} onClick={loadCandidates} className="mt-3 rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-50">Load candidates</button></section>}

                    {groups.length > 0 && <section><h3 className="text-sm font-semibold text-gray-900">Choose root objects</h3><div className="mt-3 max-h-72 overflow-y-auto border-y border-gray-200">{groups.map(group => <div key={group.objectType.name} className="py-3"><p className="text-xs font-semibold uppercase tracking-wide text-gray-500">{group.objectType.pluralLabel}</p>{group.candidates.map(item => <label key={item.id} className="flex items-center gap-3 py-2 text-sm"><input type="checkbox" checked={selected.includes(item.id)} onChange={event => setSelected(current => event.target.checked ? [...current, item.id] : current.filter(id => id !== item.id))} /><span className="min-w-0 flex-1"><span className="block truncate font-medium text-gray-900">{item.title}</span><span className="text-xs text-gray-500">{item.status} · {item.descendantCount} sub-objects</span></span></label>)}</div>)}</div><button type="button" disabled={!selected.length || busy} onClick={runPreflight} className="mt-4 rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-50">Review import</button></section>}

                    {preflight && <section className="border-t border-gray-200 pt-5">
                        <h3 className="text-sm font-semibold text-gray-900">Import summary</h3>
                        <p className="mt-2 text-sm text-gray-700">{preflight.objectCount} objects, {preflight.versionCount} versions and {preflight.mediaCount} media files.</p>
                        {preflight.outcomes && <p className="mt-1 text-sm text-gray-600">{preflight.outcomes.create} new and {preflight.outcomes.update} matching objects.</p>}
                        {preflight.limits && !preflight.limits.withinLimits && <p className="mt-2 text-sm text-red-700">This selection exceeds the 2 GB media limit. Choose fewer roots.</p>}
                        {(preflight.externalUrls || []).length > 0 && <p className="mt-2 text-sm text-amber-700">{preflight.externalUrls.length} external URLs will remain unchanged.</p>}
                        {(preflight.typeConflicts || []).map(conflict => <label key={conflict.name} className="mt-3 block text-sm text-gray-700">
                            Resolve {conflict.name}
                            <select value={resolutions[conflict.name]} onChange={event => setResolutions(current => ({ ...current, [conflict.name]: event.target.value }))} className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2">
                                {conflict.compatible && <option value="keep">Keep compatible local definition</option>}
                                {!conflict.usedByOtherTenants && <option value="update">Use remote definition</option>}
                                <option value="skip">Skip this type</option>
                            </select>
                        </label>)}
                        {(preflight.namespaceConflicts || []).map(conflict => <label key={conflict.slug} className="mt-3 block text-sm text-gray-700">
                            Map namespace “{conflict.name}”
                            <select value={namespaceResolutions[conflict.slug] || ''} onChange={event => setNamespaceResolutions(current => ({ ...current, [conflict.slug]: event.target.value }))} className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2">
                                <option value="">Choose a local namespace</option>
                                {(preflight.destinationNamespaces || []).map(namespace => <option key={namespace.slug} value={namespace.slug}>{namespace.name}</option>)}
                            </select>
                        </label>)}
                        <button type="button" disabled={busy || preflight.limits?.withinLimits === false || Object.values(namespaceResolutions).some(value => !value)} onClick={startImport} className="mt-5 inline-flex items-center gap-2 rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"><Download className="h-4 w-4" />Start import</button>
                    </section>}
                </div>}

                {job && <div className="mt-8 py-8 text-center">{job.status === 'completed' ? <Check className="mx-auto h-8 w-8 text-green-600" /> : job.status === 'failed' ? <AlertCircle className="mx-auto h-8 w-8 text-red-600" /> : <div className="mx-auto h-8 w-8 animate-spin rounded-full border-2 border-gray-300 border-t-blue-600" />}<p className="mt-3 font-medium text-gray-900">{job.status === 'completed' ? 'Import completed' : job.status === 'failed' ? 'Import failed' : `Importing · ${job.progress?.phase || 'queued'}`}</p>{job.errors?.length > 0 && <p className="mt-2 text-sm text-red-700">{job.errors[job.errors.length - 1]}</p>}</div>}
            </div>
        </div>
    )
}

export default RemoteObjectImport
