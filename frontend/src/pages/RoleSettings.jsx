import { useAuth } from '../contexts/AuthContext'
import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import client from '../api/client'
import { supportError } from '../api/support'
import { useSupportTenant } from '../components/support/useSupportContext'
import CompactSelect from '../components/classification/CompactSelect'

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
    const { checkAuthStatus, language, user } = useAuth()
    const queryClient = useQueryClient()
    const [draft, setDraft] = useState(null)
    const [memberDraft, setMemberDraft] = useState(null)
    const [newMember, setNewMember] = useState(null)
    const [status, setStatus] = useState('')
    const query = useQuery({ queryKey: ['roles', tenant], queryFn: async () => (await client.get('/api/v1/utils/roles/')).data })
    const accounts = useQuery({ queryKey: ['system-accounts'], enabled: Boolean(user?.isSuperuser), queryFn: async () => (await client.get('/api/v1/utils/users/')).data.users })
    const save = useMutation({
        mutationFn: async () => client.post('/api/v1/utils/roles/', draft),
        onSuccess: () => { checkAuthStatus?.(); setDraft(null); setStatus(language === 'sv-se' ? 'Rollen har sparats.' : 'Role saved.'); queryClient.invalidateQueries({ queryKey: ['roles', tenant] }); queryClient.invalidateQueries({ queryKey: ['support', tenant] }) },
    })
    const saveMember = useMutation({
        mutationFn: async () => client.patch('/api/v1/utils/roles/', { userId: memberDraft.id, roleIds: memberDraft.roleIds }),
        onSuccess: () => { checkAuthStatus?.(); setMemberDraft(null); setStatus(language === 'sv-se' ? 'Användarens roller har sparats.' : 'Member roles saved.'); queryClient.invalidateQueries({ queryKey: ['roles', tenant] }) },
    })
    const addMember = useMutation({
        mutationFn: async () => client.post('/api/v1/utils/roles/members/', { userId: Number(newMember.userId), roleIds: newMember.roleIds }),
        onSuccess: () => { setNewMember(null); setStatus(language === 'sv-se' ? 'Medlemmen har lagts till.' : 'Member added.'); queryClient.invalidateQueries({ queryKey: ['roles', tenant] }) },
    })
    const toggle = (field, value) => setDraft({ ...draft, [field]: draft[field].includes(value) ? draft[field].filter((item) => item !== value) : [...draft[field], value] })
    return <div className="user-tools-content container mx-auto px-4 py-8">
        <h1 className="text-2xl font-bold mb-2">{language === 'sv-se' ? 'Användare och behörigheter' : 'Users and permissions'}</h1>
        <p className="text-gray-600 mb-6">{language === 'sv-se' ? 'Tilldela roller i den aktuella arbetsytan. Flera roller kombineras. Ägaren och systemägaren behåller administrativ åtkomst.' : 'Assign roles in this workspace. Multiple roles combine. The workspace owner and system owner retain administrative access.'}</p>
        {query.isPending && <p role="status">Läser roller…</p>}
        {(query.error || save.error || saveMember.error || addMember.error || accounts.error) && <p role="alert">{supportError(query.error || save.error || saveMember.error || addMember.error || accounts.error)}</p>}
        {query.data && !query.data.canManage && <p>Du saknar behörighet att hantera roller.</p>}
        {query.data?.canManage && <>
            <section className="user-tools-panel mb-5" aria-labelledby="workspace-members-title">
                <h2 id="workspace-members-title" className="text-lg font-semibold mb-3">{language === 'sv-se' ? 'Medlemmar i arbetsytan' : 'Workspace members'}</h2>
                <div className="divide-y divide-gray-200">{query.data.members.map((member) => {
                    const assigned = query.data.roles.filter((role) => member.roleIds.includes(role.id))
                    return <div key={member.id} className="flex flex-wrap items-center justify-between gap-3 py-3 text-xs">
                        <div><strong className="text-gray-900">{member.name}</strong>
                            <p className="text-gray-500 mt-1">{member.isSystemOwner ? (language === 'sv-se' ? 'Systemägare' : 'System owner') : member.isOwner ? (language === 'sv-se' ? 'Arbetsyteägare' : 'Workspace owner') : assigned.length ? assigned.map((role) => role.name).join(', ') : (language === 'sv-se' ? 'Standardåtkomst' : 'Default access')}</p>
                            <details className="text-gray-500 mt-1"><summary className="cursor-pointer">{member.permissions.length} {language === 'sv-se' ? 'effektiva behörigheter' : 'effective permissions'}</summary><p className="mt-1 max-w-3xl leading-5">{member.permissions.map((permission) => permissionName(permission, language)).join(' · ')}</p></details>
                        </div>
                        <button type="button" disabled={!query.data.canGrantAdmin && assigned.some((role) => role.permissions.includes('tenant.admin'))} title={!query.data.canGrantAdmin && assigned.some((role) => role.permissions.includes('tenant.admin')) ? (language === 'sv-se' ? 'Bara arbetsyteägaren kan ändra administratörsroller.' : 'Only the workspace owner can change administrator roles.') : undefined} onClick={() => { setMemberDraft({ id: member.id, name: member.name, roleIds: [...member.roleIds] }); setDraft(null); setStatus('') }}>{language === 'sv-se' ? 'Redigera roller' : 'Edit roles'}</button>
                    </div>
                })}</div>
            </section>
            {user?.isSuperuser && <div className="mb-5">
                <button type="button" onClick={() => { setNewMember({ userId: '', roleIds: [] }); setMemberDraft(null); setDraft(null) }}>{language === 'sv-se' ? 'Lägg till befintligt konto' : 'Add existing account'}</button>
                {newMember && <form className="user-tools-panel mt-3 space-y-4" onSubmit={(event) => { event.preventDefault(); if (newMember.userId && newMember.roleIds.length) addMember.mutate() }}>
                    <h2 className="text-lg font-semibold">{language === 'sv-se' ? 'Ny medlem i arbetsytan' : 'New workspace member'}</h2>
                    <div className="block max-w-sm text-xs"><span>{language === 'sv-se' ? 'Systemkonto' : 'System account'}</span>
                        <CompactSelect label={language === 'sv-se' ? 'Systemkonto' : 'System account'} required className="block w-full mt-1" value={newMember.userId} onChange={(event) => setNewMember({ ...newMember, userId: event.target.value })}>
                            <option value="">{language === 'sv-se' ? 'Välj konto' : 'Choose account'}</option>
                            {(accounts.data || []).filter((account) => account.isActive && !query.data.members.some((member) => member.id === account.id)).map((account) => <option key={account.id} value={account.id}>{account.username}</option>)}
                        </CompactSelect>
                    </div>
                    <fieldset><legend className="text-xs font-semibold mb-2">{language === 'sv-se' ? 'Roller' : 'Roles'}</legend><div className="grid gap-2 sm:grid-cols-2">{query.data.roles.map((role) => <label key={role.id} className="flex items-center gap-2 text-xs"><input type="checkbox" checked={newMember.roleIds.includes(role.id)} onChange={() => setNewMember({ ...newMember, roleIds: newMember.roleIds.includes(role.id) ? newMember.roleIds.filter((id) => id !== role.id) : [...newMember.roleIds, role.id] })} />{role.name}</label>)}</div></fieldset>
                    <div className="flex gap-2"><button className="user-tools-primary" disabled={!newMember.userId || !newMember.roleIds.length || addMember.isPending}>{language === 'sv-se' ? 'Lägg till medlem' : 'Add member'}</button><button type="button" onClick={() => setNewMember(null)}>{language === 'sv-se' ? 'Avbryt' : 'Cancel'}</button></div>
                </form>}
            </div>}
            {memberDraft && <form className="user-tools-panel mb-5 space-y-4" onSubmit={(event) => { event.preventDefault(); saveMember.mutate() }}>
                <h2 className="text-lg font-semibold">{language === 'sv-se' ? `Roller för ${memberDraft.name}` : `Roles for ${memberDraft.name}`}</h2>
                <div className="grid gap-2 sm:grid-cols-2">{query.data.roles.map((role) => <label key={role.id} className="flex items-center gap-2 text-xs"><input type="checkbox" checked={memberDraft.roleIds.includes(role.id)} disabled={!query.data.canGrantAdmin && role.permissions.includes('tenant.admin')} onChange={() => setMemberDraft({ ...memberDraft, roleIds: memberDraft.roleIds.includes(role.id) ? memberDraft.roleIds.filter((id) => id !== role.id) : [...memberDraft.roleIds, role.id] })} />{role.name}</label>)}</div>
                <p className="text-xs text-gray-500">{language === 'sv-se' ? 'Utan roller gäller standardåtkomst. En tom roll tar bort standardåtkomsten.' : 'Without roles, default access applies. An empty role removes default access.'}</p>
                <div className="flex gap-2"><button className="user-tools-primary" disabled={saveMember.isPending}>{language === 'sv-se' ? 'Spara roller' : 'Save roles'}</button><button type="button" onClick={() => setMemberDraft(null)}>{language === 'sv-se' ? 'Avbryt' : 'Cancel'}</button></div>
            </form>}
            {user?.isSuperuser && <p className="mb-5 text-xs text-gray-600">{language === 'sv-se' ? 'Systemkonton och lösenord hanteras separat av systemägaren.' : 'System accounts and passwords are managed separately by the system owner.'} <Link className="text-blue-700 underline" to="/settings/users">{language === 'sv-se' ? 'Hantera systemkonton' : 'Manage system accounts'}</Link></p>}
            <button className="user-tools-primary mb-4" onClick={() => { setDraft({ name: '', permissions: [], users: [] }); setStatus('') }}>Skapa roll</button>
            <div className="user-tools-panel space-y-3">{query.data.roles.map((role) => <div className="flex flex-wrap items-center justify-between gap-3" key={role.id}><div><strong>{role.name}</strong><p className="text-sm text-gray-500">{role.users.length} användare · {role.permissions.length} behörigheter</p></div><button disabled={!query.data.canGrantAdmin && role.permissions.includes('tenant.admin')} title={!query.data.canGrantAdmin && role.permissions.includes('tenant.admin') ? (language === 'sv-se' ? 'Bara arbetsyteägaren kan ändra administratörsroller.' : 'Only the workspace owner can change administrator roles.') : undefined} onClick={() => { setDraft({ ...role }); setStatus('') }}>Redigera {role.name}</button></div>)}</div>
            {draft && <form className="user-tools-panel mt-6 space-y-5" onSubmit={(e) => { e.preventDefault(); save.mutate() }}>
                <h2 className="text-xl font-semibold">{language === 'sv-se' ? (draft.id ? 'Redigera roll' : 'Ny roll') : (draft.id ? 'Edit role' : 'New role')}</h2>
                <label className="block">Rollnamn<input required maxLength={80} className="block mt-2" value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} /></label>
                <fieldset><legend className="font-semibold mb-2">Behörigheter</legend><div className="grid gap-2 sm:grid-cols-2">{query.data.availablePermissions.map((permission) => <label key={permission} className="flex items-center gap-2"><input type="checkbox" checked={draft.permissions.includes(permission)} disabled={permission === 'tenant.admin' && !query.data.canGrantAdmin} onChange={() => toggle('permissions', permission)} />{permissionName(permission, language)}</label>)}</div></fieldset>
                <fieldset><legend className="font-semibold mb-2">Medlemmar</legend><div className="grid gap-2 sm:grid-cols-2">{query.data.members.map((member) => <label key={member.id} className="flex items-center gap-2"><input type="checkbox" checked={draft.users.includes(member.id)} onChange={() => toggle('users', member.id)} />{member.name}</label>)}</div></fieldset>
                <div className="flex gap-2"><button className="user-tools-primary" disabled={save.isPending}>Spara roll</button><button type="button" onClick={() => setDraft(null)}>Avbryt</button></div>
            </form>}
        </>}
        {status && <p role="status" className="mt-4">{status}</p>}
    </div>
}
