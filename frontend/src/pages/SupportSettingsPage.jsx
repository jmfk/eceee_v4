import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supportError, supportRequest } from '../api/support'
import { useSupportContext, useSupportIdentity, useSupportTenant } from '../components/support/useSupportContext'
import { useDocumentTitle } from '../hooks/useDocumentTitle'
import { cmsLegacyText, getCmsCopyLanguage } from '../utils/cmsCopy'
import '../components/user-tools.css'
import './InboxPage.css'
import './SupportSettingsPage.css'

const deliveryReason = {
    missing_email: 'Mottagaren saknar e-postadress',
    app_url_not_configured: 'Systemets länkadress behöver konfigureras',
    backend_unavailable: 'E-posttjänsten kunde inte nås',
    provider_outcome_unknown: 'Kontrollera e-posttjänstens leveransstatus',
    worker_interrupted: 'Sändningen avbröts; kontrollera leveransstatus',
}

const ErrorText = ({ error }) => error ? <p className="support-error" role="alert">{supportError(error)}</p> : null

function Manage({ context }) {
    const tenant = useSupportTenant()
    const identity = useSupportIdentity()
    const queryClient = useQueryClient()
    const [userId, setUserId] = useState('')
    const [canSupport, setCanSupport] = useState(false)
    const [canPublish, setCanPublish] = useState(false)
    const [newLabel, setNewLabel] = useState('')
    const [editingLabel, setEditingLabel] = useState(null)
    const [labelName, setLabelName] = useState('')
    const labels = useMutation({
        mutationFn: ({ id, name }) => supportRequest(tenant, id ? `labels/${id}/` : 'labels/', id ? 'patch' : 'post', { name }),
        onSuccess: () => {
            setNewLabel('')
            setEditingLabel(null)
            queryClient.invalidateQueries({ queryKey: ['support', tenant] })
        },
    })
    const removeLabel = useMutation({
        mutationFn: (id) => supportRequest(tenant, `labels/${id}/`, 'delete'),
        onSuccess: () => queryClient.invalidateQueries({ queryKey: ['support', tenant] }),
    })
    const roles = useMutation({
        mutationFn: () =>
            supportRequest(tenant, 'context/', 'post', {
                userId: Number(userId),
                canSupport,
                canPublish,
            }),
        onSuccess: () =>
            queryClient.invalidateQueries({ queryKey: ['support', tenant] }),
    })
    const failures = useQuery({
        queryKey: ['support', tenant, identity, 'deliveries'],
        queryFn: () => supportRequest(tenant, 'deliveries/'),
        enabled: context.canSupport,
        refetchInterval: 60000,
    })
    return (
        <>
            <h2>Supportinställningar</h2>
            <p>
                Arbetsyta: {context.tenant.name}. Roller och etiketter gäller bara den här arbetsytan.
            </p>
            <p>
                Privat lagring:{' '}
                {context.storageConfigured
                    ? 'konfigurerad'
                    : 'behöver konfigureras'}
                . E-post:{' '}
                {context.emailEnabled
                    ? 'aktiverad'
                    : 'inte aktiverad; aviseringar väntar i kön'}
                .
            </p>
            {context.canManage && <p><Link to="/settings/roles">Hantera arbetsytans roller och behörigheter</Link>. Formuläret nedan hanterar direkta supporttilldelningar. Behörigheter från andra roller gäller också.</p>}
            {context.canManage && <section className="message-label-settings" aria-label="Meddelandeetiketter">
                <h3>Meddelandeetiketter</h3>
                <p>Etiketterna kan användas på nya meddelanden i den här arbetsytan.</p>
                <ul>{context.messageLabels?.map((label) => <li key={label.id}>
                    {editingLabel === label.id ? <form onSubmit={(event) => { event.preventDefault(); labels.mutate({ id: label.id, name: labelName.trim() }) }}>
                        <input aria-label={`Nytt namn för ${label.name}`} autoFocus maxLength={40} required value={labelName} onChange={(event) => setLabelName(event.target.value)} />
                        <button className="user-tools-primary" disabled={labels.isPending || !labelName.trim()}>Spara</button>
                        <button type="button" onClick={() => setEditingLabel(null)}>Avbryt</button>
                    </form> : <><span>{label.name}</span><button type="button" onClick={() => { setEditingLabel(label.id); setLabelName(label.name) }}>Byt namn</button><button type="button" disabled={removeLabel.isPending} onClick={() => { if (window.confirm(`Ta bort etiketten ${label.name} från valbara etiketter? Befintliga meddelanden behåller den.`)) removeLabel.mutate(label.id) }}>Ta bort</button></>}
                </li>)}</ul>
                <form onSubmit={(event) => { event.preventDefault(); labels.mutate({ name: newLabel.trim() }) }}>
                    <label htmlFor="message-label-name">Ny etikett
                        <input id="message-label-name" maxLength={40} required value={newLabel} onChange={(event) => setNewLabel(event.target.value)} />
                    </label>
                    <button className="user-tools-primary" disabled={labels.isPending || !newLabel.trim()}>Lägg till etikett</button>
                </form>
                <ErrorText error={labels.error || removeLabel.error} />
            </section>}
            {context.canManage && (
                <form
                    onSubmit={(e) => {
                        e.preventDefault()
                        roles.mutate()
                    }}
                >
                    <label>
                        Person
                        <select
                            required
                            value={userId}
                            onChange={(e) => {
                                const id = e.target.value
                                const role = context.roles.find(
                                    (r) => r.userId === Number(id),
                                )
                                setUserId(id)
                                setCanSupport(role?.canSupport || false)
                                setCanPublish(role?.canPublish || false)
                            }}
                        >
                            <option value="">Välj person</option>
                            {context.members.map((m) => (
                                <option key={m.id} value={m.id}>
                                    {m.name}
                                </option>
                            ))}
                        </select>
                    </label>
                    <label>
                        <input
                            type="checkbox"
                            checked={canSupport}
                            onChange={(e) => setCanSupport(e.target.checked)}
                        />{' '}
                        Får läsa och svara på arbetsytans supportärenden
                    </label>
                    <label>
                        <input
                            type="checkbox"
                            checked={canPublish}
                            onChange={(e) => setCanPublish(e.target.checked)}
                        />{' '}
                        Får publicera och hantera instruktioner
                    </label>
                    <ErrorText error={roles.error} />
                    <button className="user-tools-primary" disabled={!userId || roles.isPending}>
                        Spara behörigheter
                    </button>
                    {roles.isSuccess && (
                        <p role="status">Behörigheterna sparades.</p>
                    )}
                </form>
            )}
            {context.canSupport && (
                <section>
                    <h3>E-post som behöver åtgärdas</h3>
                    <ErrorText error={failures.error} />
                    {failures.data?.results.length === 0 && (
                        <p>Inga kända leveransproblem.</p>
                    )}
                    {failures.data?.results.map((f) => (
                        <p key={f.id}>
                            {f.state === 'uncertain'
                                ? 'Okänt leveransutfall; kontrollera leverantören före nytt försök'
                                : 'Leverans misslyckades'}{' '}
                            ·{' '}
                            {cmsLegacyText(deliveryReason[f.errorCode], getCmsCopyLanguage()) ||
                                'Leveransen behöver kontrolleras'}{' '}
                            · Referens {f.id}
                        </p>
                    ))}
                </section>
            )}
        </>
    )
}

export default function SupportSettingsPage() {
    useDocumentTitle('Supportinställningar')
    const context = useSupportContext()
    return <div className="support-settings max-w-4xl">
        {context.isPending && <p role="status">Läser supportinställningar…</p>}
        <ErrorText error={context.error} />
        {context.data && (context.data.canManage || context.data.canSupport)
            ? <div className="user-tools-panel support-content"><Manage context={context.data} /></div>
            : context.data && <p>Du har inte behörighet att hantera supportinställningar.</p>}
    </div>
}
