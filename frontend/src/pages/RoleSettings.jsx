import { useAuth } from '../contexts/AuthContext'
import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import client from '../api/client'
import { supportError } from '../api/support'
import { useSupportTenant } from '../components/support/useSupportContext'

const names = { 'settings.read': 'Läsa inställningar', 'settings.write': 'Ändra inställningar', 'integrations.manage': 'Hantera integrationer', 'statistics.read': 'Läsa statistik', 'ai.use': 'Använda AI-verktyg', 'tenant.admin': 'Administrera hela arbetsytan', 'roles.manage': 'Hantera roller', 'support.read': 'Läsa och svara på supportärenden', 'support.publish': 'Publicera instruktionsfilmer' }
const englishNames = { 'settings.read': 'Read settings', 'settings.write': 'Edit settings', 'integrations.manage': 'Manage integrations', 'statistics.read': 'Read statistics', 'ai.use': 'Use AI tools', 'tenant.admin': 'Administer the entire workspace', 'roles.manage': 'Manage roles', 'support.read': 'Read and reply to support requests', 'support.publish': 'Publish instruction videos' }
const categories = { page: ['Pages', 'Sidor'], theme: ['Themes', 'Teman'], media: ['Media', 'Media'], object: ['Objects', 'Objekt'], content: ['Classification', 'Klassificering'], layout: ['Layouts', 'Layouter'], site: ['Site', 'Webbplats'], kanban: ['Kanban', 'Kanban'] }
const actions = { read: ['read', 'läsa'], write: ['edit', 'redigera'], publish: ['publish', 'publicera'], version: ['version', 'versionera'], transfer: ['transfer', 'överföra'], definition: ['edit definitions', 'ändra definitioner'] }

const permissionName = (permission, language) => {
    if (language === 'sv-se' && names[permission]) return names[permission]
    if (language !== 'sv-se' && englishNames[permission]) return englishNames[permission]
    const [area, action] = permission.split('.')
    const index = language === 'sv-se' ? 1 : 0
    return `${categories[area]?.[index] || area} · ${actions[action]?.[index] || permission.split('.').slice(1).join(' ')}`
}

export default function RoleSettings() {
    const tenant = useSupportTenant()
    const { checkAuthStatus, language } = useAuth()
    const queryClient = useQueryClient()
    const [draft, setDraft] = useState(null)
    const [status, setStatus] = useState('')
    const query = useQuery({ queryKey: ['roles', tenant], queryFn: async () => (await client.get('/api/v1/utils/roles/')).data })
    const save = useMutation({
        mutationFn: async () => client.post('/api/v1/utils/roles/', draft),
        onSuccess: () => { checkAuthStatus?.(); setDraft(null); setStatus(language === 'sv-se' ? 'Rollen har sparats.' : 'Role saved.'); queryClient.invalidateQueries({ queryKey: ['roles', tenant] }); queryClient.invalidateQueries({ queryKey: ['support', tenant] }) },
    })
    const toggle = (field, value) => setDraft({ ...draft, [field]: draft[field].includes(value) ? draft[field].filter((item) => item !== value) : [...draft[field], value] })
    return <div className="user-tools-content container mx-auto px-4 py-8">
        <h1 className="text-3xl font-bold mb-2">Roller och behörigheter</h1>
        <p className="text-gray-600 mb-6">Roller gäller i den aktuella arbetsytan. Flera roller kombineras. Ägaren och systemägaren behåller administrativ åtkomst.</p>
        {query.isPending && <p role="status">Läser roller…</p>}
        {(query.error || save.error) && <p role="alert">{supportError(query.error || save.error)}</p>}
        {query.data && !query.data.canManage && <p>Du saknar behörighet att hantera roller.</p>}
        {query.data?.canManage && <>
            <button className="user-tools-primary mb-4" onClick={() => { setDraft({ name: '', permissions: [], users: [] }); setStatus('') }}>Skapa roll</button>
            <div className="user-tools-panel space-y-3">{query.data.roles.map((role) => <div className="flex flex-wrap items-center justify-between gap-3" key={role.id}><div><strong>{role.name}</strong><p className="text-sm text-gray-500">{role.users.length} användare · {role.permissions.length} behörigheter</p></div><button onClick={() => { setDraft({ ...role }); setStatus('') }}>Redigera {role.name}</button></div>)}</div>
            {draft && <form className="user-tools-panel mt-6 space-y-5" onSubmit={(e) => { e.preventDefault(); save.mutate() }}>
                <h2 className="text-xl font-semibold">{language === 'sv-se' ? (draft.id ? 'Redigera roll' : 'Ny roll') : (draft.id ? 'Edit role' : 'New role')}</h2>
                <label className="block">Rollnamn<input required maxLength={80} className="block mt-2" value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} /></label>
                <fieldset><legend className="font-semibold mb-2">Behörigheter</legend><div className="grid gap-2 sm:grid-cols-2">{query.data.availablePermissions.map((permission) => <label key={permission} className="flex items-center gap-2"><input type="checkbox" checked={draft.permissions.includes(permission)} onChange={() => toggle('permissions', permission)} />{permissionName(permission, language)}</label>)}</div></fieldset>
                <fieldset><legend className="font-semibold mb-2">Medlemmar</legend><div className="grid gap-2 sm:grid-cols-2">{query.data.members.map((member) => <label key={member.id} className="flex items-center gap-2"><input type="checkbox" checked={draft.users.includes(member.id)} onChange={() => toggle('users', member.id)} />{member.name}</label>)}</div></fieldset>
                <div className="flex gap-2"><button className="user-tools-primary" disabled={save.isPending}>Spara roll</button><button type="button" onClick={() => setDraft(null)}>Avbryt</button></div>
            </form>}
        </>}
        {status && <p role="status" className="mt-4">{status}</p>}
    </div>
}
