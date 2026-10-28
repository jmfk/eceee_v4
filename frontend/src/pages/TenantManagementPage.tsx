import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Globe2, Plus } from 'lucide-react'
import client from '../api/client'
import { useAuth } from '../contexts/AuthContext'
import { useDocumentTitle } from '../hooks/useDocumentTitle'

type HostnamePolicy = { mode: 'unrestricted' | 'exact' | 'domains'; values: string[] }
type Tenant = {
  id: string
  name: string
  identifier: string
  isActive: boolean
  hostnamePolicy: HostnamePolicy
  hostnames: string[]
  pageCount: number
}

const field = 'h-8 rounded-sm border border-gray-300 bg-white px-3 text-xs text-gray-900 focus:border-blue-600 focus:outline-none'

function errorText(error: unknown): string {
  const response = (error as { response?: { data?: Record<string, unknown> } })?.response?.data
  if (response) return Object.values(response).map(String).join(' ')
  return error instanceof Error ? error.message : 'Operation failed.'
}

export default function TenantManagementPage() {
  useDocumentTitle('Workspaces')
  const { user } = useAuth()
  const queryClient = useQueryClient()
  const [name, setName] = useState('')
  const [identifier, setIdentifier] = useState('')
  const [editing, setEditing] = useState<string | null>(null)
  const [mode, setMode] = useState<HostnamePolicy['mode']>('exact')
  const [values, setValues] = useState('')
  const [message, setMessage] = useState('')
  const [search, setSearch] = useState('')
  const { data: tenants = [], isLoading, error } = useQuery<Tenant[]>({
    queryKey: ['system-tenants'],
    enabled: Boolean(user?.isSuperuser),
    queryFn: async () => (await client.get('/api/v1/utils/tenants/')).data,
  })
  const refresh = () => queryClient.invalidateQueries({ queryKey: ['system-tenants'] })
  const create = useMutation({
    mutationFn: async () => client.post('/api/v1/utils/tenants/', { name, identifier }),
    onSuccess: () => { setName(''); setIdentifier(''); setMessage('Workspace created. Assign hostname access before publishing.'); refresh() },
    onError: (failure) => setMessage(errorText(failure)),
  })
  const update = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Record<string, unknown> }) => client.patch(`/api/v1/utils/tenants/${id}/`, data),
    onSuccess: () => { setEditing(null); setMessage('Workspace updated.'); refresh() },
    onError: (failure) => setMessage(errorText(failure)),
  })

  if (!user?.isSuperuser) return <div className="p-6 text-sm text-red-700">Only system owners may manage workspaces.</div>

  return <div className="container mx-auto px-4 py-6">
    <div className="mb-4 flex items-center gap-3"><Globe2 className="h-6 w-6 text-blue-600" /><h1 className="text-2xl font-bold text-gray-900">Workspaces</h1></div>
    <p className="mb-4 text-sm text-gray-600">Create workspaces, control hostname access, and deactivate workspaces without deleting their content.</p>
    {message && <p role="status" className="mb-3 text-xs text-gray-700">{message}</p>}
    <form className="mb-5 rounded-sm border border-gray-200 bg-white p-4 shadow-sm" onSubmit={(event) => { event.preventDefault(); setMessage(''); create.mutate() }}>
      <h2 className="mb-3 text-sm font-semibold text-gray-900">Add workspace</h2>
      <div className="flex flex-wrap items-end gap-2">
        <label className="flex flex-col gap-1 text-xs text-gray-600">Name<input className={field} required maxLength={255} value={name} onChange={(event) => setName(event.target.value)} /></label>
        <label className="flex flex-col gap-1 text-xs text-gray-600">Identifier<input className={field} required maxLength={100} pattern="[a-zA-Z0-9_-]+" value={identifier} onChange={(event) => setIdentifier(event.target.value)} /></label>
        <button type="submit" disabled={create.isPending} className="inline-flex h-8 items-center gap-1 rounded-sm bg-blue-600 px-3 text-xs font-medium text-white hover:bg-blue-700 disabled:opacity-50"><Plus className="h-3.5 w-3.5" />Create</button>
      </div>
    </form>
    <section className="rounded-sm border border-gray-200 bg-white shadow-sm" aria-label="Workspaces">
      <div className="border-b border-gray-100 p-4"><label className="flex max-w-sm flex-col gap-1 text-xs text-gray-600">Search workspaces<input className={field} type="search" value={search} onChange={(event) => setSearch(event.target.value)} /></label></div>
      {isLoading && <p className="p-4 text-xs text-gray-600">Loading workspaces…</p>}
      {error && <p role="alert" className="p-4 text-xs text-red-700">{errorText(error)}</p>}
      {tenants.filter((tenant) => `${tenant.name} ${tenant.identifier} ${tenant.hostnames.join(' ')}`.toLowerCase().includes(search.toLowerCase())).map((tenant) => <div key={tenant.id} className="border-b border-gray-100 p-4 last:border-b-0">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div><h2 className="text-sm font-semibold text-gray-900">{tenant.name} <span className="font-normal text-gray-500">({tenant.identifier})</span></h2>
            <p className="mt-1 text-xs text-gray-500">{tenant.isActive ? 'Active' : 'Inactive'} · {tenant.pageCount} pages · {tenant.hostnames.length} hostnames · {tenant.hostnamePolicy.mode}</p>
          </div>
          <div className="flex gap-2">
            <button type="button" className="h-8 rounded-sm border border-gray-300 px-3 text-xs text-gray-700 hover:bg-gray-50" onClick={() => { setEditing(editing === tenant.id ? null : tenant.id); setMode(tenant.hostnamePolicy.mode); setValues(tenant.hostnamePolicy.values.join('\n')); setMessage('') }}>Hostname access</button>
            <button type="button" disabled={update.isPending} className="h-8 rounded-sm border border-gray-300 px-3 text-xs text-gray-700 hover:bg-gray-50 disabled:opacity-50" onClick={() => { if (tenant.isActive && !window.confirm(`Deactivate ${tenant.name}? Its public sites will stop serving until reactivated.`)) return; update.mutate({ id: tenant.id, data: { is_active: !tenant.isActive } }) }}>{tenant.isActive ? 'Deactivate' : 'Reactivate'}</button>
          </div>
        </div>
        {editing === tenant.id && <form className="mt-4 border-t border-gray-100 pt-4" onSubmit={(event) => { event.preventDefault(); update.mutate({ id: tenant.id, data: { hostname_policy: { mode, values: values.split(/[\n,]+/).map((item) => item.trim()).filter(Boolean) } } }) }}>
          <label className="flex flex-col gap-1 text-xs text-gray-600">Hostname rule
            <select className={`${field} max-w-xs`} value={mode} onChange={(event) => setMode(event.target.value as HostnamePolicy['mode'])}>
              <option value="exact">Only approved hostnames</option><option value="domains">Only approved domains</option><option value="unrestricted">Any hostname</option>
            </select>
          </label>
          {mode !== 'unrestricted' && <label className="mt-3 flex max-w-md flex-col gap-1 text-xs text-gray-600">{mode === 'exact' ? 'Approved hostnames' : 'Approved domains'} (one per line)
            <textarea className="min-h-20 rounded-sm border border-gray-300 p-2 text-xs focus:border-blue-600 focus:outline-none" value={values} onChange={(event) => setValues(event.target.value)} />
          </label>}
          {tenant.hostnames.length > 0 && <p className="mt-2 text-xs text-gray-500">In use: {tenant.hostnames.join(', ')}</p>}
          <button type="submit" disabled={update.isPending} className="mt-3 h-8 rounded-sm bg-blue-600 px-3 text-xs font-medium text-white hover:bg-blue-700 disabled:opacity-50">Save rule</button>
        </form>}
      </div>)}
    </section>
  </div>
}
