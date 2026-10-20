import React, { useEffect, useMemo, useRef, useState } from 'react'
import { useMutation, useQueries, useQuery, useQueryClient } from '@tanstack/react-query'
import { AlertCircle, CheckCircle2, Download, Package, Play, RefreshCw } from 'lucide-react'

import { api } from '../../api/client'
import { useGlobalNotifications } from '../../contexts/GlobalNotificationContext'

const endpoint = '/api/v1/content-migration'

const statusStyles = {
    ready: 'border-green-200 bg-green-50 text-green-800',
    checking: 'border-blue-200 bg-blue-50 text-blue-800',
    unavailable: 'border-red-200 bg-red-50 text-red-800',
    missing: 'border-amber-200 bg-amber-50 text-amber-900',
}

const ConnectionStatus = ({ state, onRefresh }) => {
    const status = state?.status || 'missing'
    const labels = {
        ready: 'Legacy server connected',
        checking: 'Checking legacy server…',
        unavailable: 'Legacy server unavailable',
        missing: 'Source connection required',
    }
    return (
        <div className={`flex items-center justify-between gap-3 rounded-md border px-3 py-2 text-sm ${statusStyles[status]}`}>
            <span className="flex items-center gap-2 font-medium">
                {status === 'ready' ? <CheckCircle2 className="h-4 w-4" /> : status === 'checking' ? <RefreshCw className="h-4 w-4 animate-spin" /> : <AlertCircle className="h-4 w-4" />}
                {labels[status]}
            </span>
            {onRefresh && status !== 'checking' && (
                <button type="button" onClick={onRefresh} className="font-semibold underline underline-offset-2">
                    Check again
                </button>
            )}
        </div>
    )
}

const MigrationManager = () => {
    const queryClient = useQueryClient()
    const { addNotification } = useGlobalNotifications()
    const [selectedImporterId, setSelectedImporterId] = useState('')
    const [connectionId, setConnectionId] = useState('')
    const [options, setOptions] = useState({})
    const [preflightResult, setPreflight] = useState(null)
    const initializedImporterId = useRef(null)

    const { data: pluginData, isLoading: pluginsLoading } = useQuery({
        queryKey: ['tenant-plugins'],
        queryFn: async () => (await api.get(`${endpoint}/plugins/`)).data,
    })
    const { data: importerData } = useQuery({
        queryKey: ['tenant-importers'],
        queryFn: async () => (await api.get(`${endpoint}/importers/`)).data,
    })
    const { data: connections = [] } = useQuery({
        queryKey: ['data-connections'],
        queryFn: async () => {
            const response = await api.get('/api/v1/data-connections/connections/')
            return response.data.results || response.data
        },
    })
    const { data: jobs = [] } = useQuery({
        queryKey: ['plugin-import-jobs'],
        queryFn: async () => (await api.get(`${endpoint}/plugin-jobs/`)).data.results,
        refetchInterval: (query) => {
            const current = query.state.data || []
            return current.some((job) => ['pending', 'running'].includes(job.status)) ? 2000 : false
        },
    })

    const plugins = useMemo(
        () => (pluginData?.results || []).filter((plugin) => plugin.kind === 'import'),
        [pluginData],
    )
    const importers = useMemo(() => importerData?.results || [], [importerData])
    const selectedImporter = importers.find((item) => item.id === selectedImporterId) || null
    const importRequest = { importerId: selectedImporterId, connectionId, options }
    const requestKey = JSON.stringify(importRequest)
    const preflight = preflightResult?.requestKey === requestKey ? preflightResult.result : null
    const compatibleConnections = useMemo(
        () => connections.filter((item) => selectedImporter?.connectionKinds.includes(item.connectionType) && item.isActive),
        [connections, selectedImporter],
    )
    const healthConnections = useMemo(() => {
        const supportedKinds = new Set(importers.flatMap((importer) => importer.connectionKinds || []))
        return connections.filter((connection) => (
            connection.isActive
            && connection.connectionType === 'LEGACY_API'
            && supportedKinds.has(connection.connectionType)
        ))
    }, [connections, importers])
    const healthQueries = useQueries({
        queries: healthConnections.map((connection) => ({
            queryKey: ['data-connection-health', connection.id, connection.updatedAt],
            queryFn: async () => (await api.post(`/api/v1/data-connections/connections/${connection.id}/test/`)).data,
            retry: false,
            staleTime: 60_000,
        })),
    })
    const connectionHealth = useMemo(() => Object.fromEntries(
        healthConnections.map((connection, index) => {
            const query = healthQueries[index]
            const status = query?.isPending || query?.isFetching
                ? 'checking'
                : query?.isError || query?.data?.status !== 'ready'
                    ? 'unavailable'
                    : 'ready'
            return [connection.id, { status, refetch: query?.refetch }]
        }),
    ), [healthConnections, healthQueries])

    const importerConnectionState = (importer) => {
        const compatible = connections.filter((connection) => (
            connection.isActive && importer.connectionKinds.includes(connection.connectionType)
        ))
        if (!compatible.length) return { status: 'missing' }
        const states = compatible.map((connection) => connectionHealth[connection.id]).filter(Boolean)
        if (states.some((state) => state.status === 'ready')) return states.find((state) => state.status === 'ready')
        if (states.some((state) => state.status === 'checking')) return states.find((state) => state.status === 'checking')
        return states[0] || { status: 'unavailable' }
    }

    useEffect(() => {
        if (!selectedImporter && importers.length) setSelectedImporterId(importers[0].id)
    }, [importers, selectedImporter])

    useEffect(() => {
        if (!selectedImporter) {
            initializedImporterId.current = null
            setPreflight(null)
            return
        }
        if (initializedImporterId.current === selectedImporter.id) return
        initializedImporterId.current = selectedImporter.id
        setOptions(Object.fromEntries(selectedImporter.fields.map((field) => [field.name, field.default ?? ''])))
        setPreflight(null)
    }, [selectedImporter])

    useEffect(() => {
        if (!selectedImporter) return
        const currentIsCompatible = compatibleConnections.some((connection) => connection.id === connectionId)
        if (!currentIsCompatible) {
            setConnectionId(compatibleConnections[0]?.id || '')
            setPreflight(null)
        }
    }, [compatibleConnections, connectionId, selectedImporter])

    const activationMutation = useMutation({
        mutationFn: async ({ plugin, active }) => active
            ? await api.delete(`${endpoint}/plugins/${plugin.id}/activation/`)
            : await api.post(`${endpoint}/plugins/${plugin.id}/activation/`),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['tenant-plugins'] })
            queryClient.invalidateQueries({ queryKey: ['tenant-importers'] })
        },
        onError: (error) => addNotification(error.response?.data?.pluginId || 'Could not update plugin', 'error'),
    })

    const preflightMutation = useMutation({
        mutationFn: async (request) => (await api.post(
            `${endpoint}/importers/${request.importerId}/preflight/`,
            { connectionId: request.connectionId, options: request.options },
        )).data,
        onSuccess: (result, request) => setPreflight({ requestKey: JSON.stringify(request), result }),
        onError: (error, request) => setPreflight({
            requestKey: JSON.stringify(request),
            result: {
                status: 'blocked',
                error: error.response?.data?.error || 'Preflight failed',
            },
        }),
    })

    const runMutation = useMutation({
        mutationFn: async () => (await api.post(`${endpoint}/plugin-jobs/`, {
            importerId: selectedImporter.id,
            connectionId,
            options,
            idempotencyKey: crypto.randomUUID(),
        })).data,
        onSuccess: () => {
            addNotification('Import job queued', 'success')
            setPreflight(null)
            queryClient.invalidateQueries({ queryKey: ['plugin-import-jobs'] })
        },
        onError: (error) => addNotification(error.response?.data?.error || 'Could not start import', 'error'),
    })

    if (pluginsLoading) {
        return <div className="flex h-64 items-center justify-center"><RefreshCw className="h-8 w-8 animate-spin text-blue-600" /></div>
    }

    return (
        <div className="mx-auto max-w-7xl space-y-8 p-6">
            <div>
                <h1 className="text-2xl font-bold text-gray-900">Imports</h1>
                <p className="text-gray-600">Review installed import scripts, verify their source connections, and run tenant-specific imports.</p>
            </div>

            <section>
                <div className="mb-3 flex items-center gap-2">
                    <Package className="h-5 w-5 text-gray-500" />
                    <h2 className="text-lg font-semibold text-gray-900">Installed import plugins</h2>
                </div>
                <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                    {plugins.map((plugin) => (
                        <div key={plugin.id} className="rounded-lg border border-gray-200 bg-white p-5 shadow-sm">
                            <div className="flex items-start justify-between gap-4">
                                <div>
                                    <div className="flex items-center gap-2">
                                        <h3 className="font-semibold text-gray-900">{plugin.label}</h3>
                                        <span className="rounded bg-gray-100 px-2 py-0.5 text-xs uppercase text-gray-600">{plugin.kind}</span>
                                    </div>
                                    <p className="mt-1 text-sm text-gray-600">{plugin.description}</p>
                                    <div className="mt-2 flex flex-wrap items-center gap-2 text-xs">
                                        <span className="text-gray-400">{plugin.id} · version {plugin.version}</span>
                                        <span className={`rounded-full px-2 py-0.5 font-medium ${plugin.active ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-600'}`}>
                                            {plugin.active ? 'Active' : 'Inactive'}
                                        </span>
                                        {plugin.importerCount > 0 && <span className="text-gray-500">{plugin.importerCount} import script{plugin.importerCount === 1 ? '' : 's'}</span>}
                                    </div>
                                </div>
                                <button
                                    type="button"
                                    disabled={!plugin.compatible || activationMutation.isPending}
                                    onClick={() => activationMutation.mutate({ plugin, active: plugin.active })}
                                    className={`rounded-md px-3 py-2 text-sm font-medium disabled:opacity-50 ${plugin.active ? 'border border-gray-300 text-gray-700 hover:bg-gray-50' : 'bg-blue-600 text-white hover:bg-blue-700'}`}
                                >
                                    {plugin.active ? 'Deactivate' : 'Activate'}
                                </button>
                            </div>
                        </div>
                    ))}
                </div>
            </section>

            <section>
                <div className="mb-3 flex items-center gap-2">
                    <Download className="h-5 w-5 text-gray-500" />
                    <h2 className="text-lg font-semibold text-gray-900">Import scripts</h2>
                </div>
                {!importers.length ? (
                    <div className="rounded-lg border border-amber-200 bg-amber-50 p-5 text-sm text-amber-900">
                        Activate an import plugin above to make its scripts available.
                    </div>
                ) : (
                    <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                        {importers.map((importer) => {
                            const state = importerConnectionState(importer)
                            const selected = importer.id === selectedImporterId
                            return (
                                <button
                                    key={importer.id}
                                    type="button"
                                    aria-pressed={selected}
                                    onClick={() => setSelectedImporterId(importer.id)}
                                    className={`rounded-lg border bg-white p-5 text-left shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 ${selected ? 'border-blue-500 ring-1 ring-blue-500' : 'border-gray-200 hover:border-gray-300'}`}
                                >
                                    <div className="flex items-start justify-between gap-4">
                                        <div>
                                            <h3 className="font-semibold text-gray-900">{importer.label}</h3>
                                            <p className="mt-1 text-xs font-medium text-gray-500">{importer.pluginLabel} · version {importer.version}</p>
                                        </div>
                                        {selected && <span className="rounded-full bg-blue-100 px-2 py-0.5 text-xs font-medium text-blue-800">Selected</span>}
                                    </div>
                                    <p className="mt-3 text-sm text-gray-600">{importer.description}</p>
                                    <div className="mt-3 flex flex-wrap gap-2">
                                        {(importer.capabilities || []).map((capability) => (
                                            <span key={capability} className="rounded-full bg-gray-100 px-2 py-1 text-xs text-gray-600">
                                                {capability.replaceAll('_', ' ')}
                                            </span>
                                        ))}
                                    </div>
                                    <div className="mt-4"><ConnectionStatus state={state} /></div>
                                </button>
                            )
                        })}
                    </div>
                )}
            </section>

            <section className="grid grid-cols-1 gap-8 xl:grid-cols-3">
                <div className="space-y-5 xl:col-span-2">
                    <div className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
                        <div className="mb-5 flex items-center gap-2">
                            <Download className="h-5 w-5 text-blue-600" />
                            <h2 className="text-lg font-semibold text-gray-900">Configure import</h2>
                        </div>
                        {!importers.length ? (
                            <div className="rounded-md bg-amber-50 p-4 text-sm text-amber-900">
                                Activate an import plugin above to make its import scripts available.
                            </div>
                        ) : (
                            <div className="space-y-5">
                                <FormField label="Import script">
                                    <select value={selectedImporterId} onChange={(event) => setSelectedImporterId(event.target.value)} className="w-full rounded-md border-gray-300">
                                        {importers.map((importer) => <option key={importer.id} value={importer.id}>{importer.label}</option>)}
                                    </select>
                                </FormField>
                                {selectedImporter && <p className="text-sm text-gray-600">{selectedImporter.description}</p>}

                                <FormField label="Source connection">
                                    <select value={connectionId} onChange={(event) => { setConnectionId(event.target.value); setPreflight(null) }} className="w-full rounded-md border-gray-300">
                                        <option value="">Choose a connection</option>
                                        {compatibleConnections.map((connection) => <option key={connection.id} value={connection.id}>{connection.name}</option>)}
                                    </select>
                                </FormField>
                                {connectionId && (
                                    <ConnectionStatus
                                        state={connectionHealth[connectionId] || { status: 'unavailable' }}
                                        onRefresh={connectionHealth[connectionId]?.refetch}
                                    />
                                )}
                                {selectedImporter && compatibleConnections.length === 0 && (
                                    <div className="rounded-md border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
                                        A compatible connection is required before this import can run.{' '}
                                        <a className="font-semibold underline" href={`/settings/data-connections/new?type=${selectedImporter.connectionKinds[0]}&plugin=${selectedImporter.pluginId}`}>Create connection</a>
                                    </div>
                                )}

                                <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
                                    {(selectedImporter?.fields || []).map((field) => (
                                        <DynamicField key={field.name} field={field} value={options[field.name]} onChange={(value) => {
                                            setOptions((current) => ({ ...current, [field.name]: value }))
                                            setPreflight(null)
                                        }} />
                                    ))}
                                </div>

                                <div className="flex flex-wrap gap-2 border-t border-gray-200 pt-5">
                                    <button
                                        type="button"
                                        disabled={!connectionId || preflightMutation.isPending}
                                        onClick={() => preflightMutation.mutate(importRequest)}
                                        className="rounded-md border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
                                    >
                                        {preflightMutation.isPending ? 'Checking…' : 'Run preflight'}
                                    </button>
                                    <button
                                        type="button"
                                        disabled={preflight?.status !== 'ready' || runMutation.isPending}
                                        onClick={() => runMutation.mutate()}
                                        className="flex items-center gap-2 rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
                                    >
                                        <Play className="h-4 w-4" /> Start import
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>

                    {preflight && <PreflightResult result={preflight} />}
                </div>

                <div>
                    <h2 className="mb-3 text-lg font-semibold text-gray-900">Recent import jobs</h2>
                    <div className="divide-y divide-gray-200 overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm">
                        {!jobs.length && <div className="p-6 text-sm text-gray-500">No import jobs yet.</div>}
                        {jobs.map((job) => <JobCard key={job.id} job={job} />)}
                    </div>
                </div>
            </section>
        </div>
    )
}

const FormField = ({ label, children }) => (
    <label className="block">
        <span className="mb-1 block text-sm font-medium text-gray-700">{label}</span>
        {children}
    </label>
)

const DynamicField = ({ field, value, onChange }) => {
    if (field.type === 'boolean') {
        return (
            <label className="flex items-center gap-2 pt-7 text-sm font-medium text-gray-700">
                <input type="checkbox" checked={Boolean(value)} onChange={(event) => onChange(event.target.checked)} className="rounded border-gray-300 text-blue-600" />
                {field.label}
            </label>
        )
    }
    if (field.type === 'namespace') {
        return (
            <FormField label={field.label}>
                <select value={value || ''} onChange={(event) => onChange(event.target.value)} className="w-full rounded-md border-gray-300">
                    <option value="">Choose a namespace</option>
                    {(field.options || []).map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                </select>
            </FormField>
        )
    }
    return (
        <FormField label={field.label}>
            <input
                type={field.type === 'integer' ? 'number' : 'text'}
                min={field.minimum}
                max={field.maximum}
                value={value ?? ''}
                onChange={(event) => onChange(field.type === 'integer' ? Number(event.target.value) : event.target.value)}
                className="w-full rounded-md border-gray-300"
            />
        </FormField>
    )
}

const PreflightResult = ({ result }) => {
    const ready = result.status === 'ready'
    return (
        <div className={`rounded-lg border p-5 ${ready ? 'border-green-200 bg-green-50' : 'border-red-200 bg-red-50'}`}>
            <div className="flex items-center gap-2 font-semibold">
                {ready ? <CheckCircle2 className="h-5 w-5 text-green-700" /> : <AlertCircle className="h-5 w-5 text-red-700" />}
                {ready ? 'Ready to import' : 'Import is blocked'}
            </div>
            {result.error && <p className="mt-2 text-sm text-red-800">{result.error}</p>}
            {ready && (
                <>
                    <div className="mt-3 grid grid-cols-2 gap-3 text-sm text-green-900 md:grid-cols-4">
                        <span>Published at source: {result.sourceSummary?.published ?? '—'}</span>
                        <span>Selected limit: {result.selection?.limit}</span>
                        <span>Source items with images: {result.sourceSummary?.withImages ?? '—'}</span>
                        <span>Target: {result.target?.namespace}</span>
                    </div>
                    <div className="mt-3 text-sm text-green-900">Media is included, links are reconciled, and the import is restartable.</div>
                </>
            )}
        </div>
    )
}

const JobCard = ({ job }) => {
    const running = ['pending', 'running'].includes(job.status)
    const completed = job.status === 'completed'
    return (
        <div className="p-4">
            <div className="flex items-start justify-between gap-3">
                <div>
                    <div className="text-sm font-semibold text-gray-900">{job.importerId.split('.').pop()}</div>
                    <div className="mt-1 text-xs text-gray-500">{job.connectionName} · {job.phase || job.status}</div>
                </div>
                {running ? <RefreshCw className="h-4 w-4 animate-spin text-blue-600" /> : completed ? <CheckCircle2 className="h-4 w-4 text-green-600" /> : <AlertCircle className="h-4 w-4 text-red-600" />}
            </div>
            {job.errors?.length > 0 && <p className="mt-2 text-xs text-red-700">{job.errors[job.errors.length - 1]}</p>}
            <div className="mt-2 text-xs text-gray-400">{new Date(job.createdAt).toLocaleString()}</div>
        </div>
    )
}

export default MigrationManager
