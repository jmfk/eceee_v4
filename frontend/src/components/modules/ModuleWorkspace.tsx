import React, { useEffect, useRef, useState } from 'react'
import './modules.css'

type Row = Record<string, unknown>
type Config = { commerce: boolean; support: boolean; faq: boolean; forum: boolean }
type RequestFn = (path: string, data?: Row) => Promise<unknown>
type Props = { admin?: boolean; tenantId?: string }
const emptyConfig: Config = { commerce: false, support: false, faq: false, forum: false }
const asRows = (value: unknown): Row[] => Array.isArray(value) ? value : []
const label = (value: unknown) => value == null ? '' : String(value)
const statusNames: Record<string, string> = { pending: 'Awaiting payment', paid: 'Paid', active: 'Active', past_due: 'Payment overdue', canceled: 'Cancelled', expired: 'Expired', refunded: 'Refunded', disputed: 'Disputed', incomplete: 'Awaiting payment', unpaid: 'Unpaid', failed: 'Failed', trialing: 'Trial' }
const money = (amount: unknown, currency: unknown) => {
    try {
        const formatter = new Intl.NumberFormat(undefined, { style: 'currency', currency: label(currency).toUpperCase() })
        return formatter.format(Number(amount) / 10 ** (formatter.resolvedOptions().maximumFractionDigits ?? 2))
    } catch { return `${amount} ${label(currency).toUpperCase()}` }
}

export function ModuleWorkspace({ admin = false, tenantId }: Props) {
    const [config, setConfig] = useState<Config>(emptyConfig)
    const [loaded, setLoaded] = useState(false)
    const [tab, setTab] = useState(admin ? 'modules' : 'products')
    const [error, setError] = useState('')
    const [notice, setNotice] = useState('')
    const [busy, setBusy] = useState(false)
    const [items, setItems] = useState<Row[]>([])
    const [prices, setPrices] = useState<Row[]>([])
    const [grants, setGrants] = useState<Row[]>([])
    const [mode, setMode] = useState('')
    const [selected, setSelected] = useState<Row | null>(null)
    const [messages, setMessages] = useState<Row[]>([])
    const [olderCursor, setOlderCursor] = useState<string | null>(null)
    const [documents, setDocuments] = useState<Record<string, Row[]>>({})
    const [search, setSearch] = useState('')
    const [editing, setEditing] = useState<Row | null>(null)
    const requestKeys = useRef<Record<string, string>>({})
    const generation = useRef(0)
    const readingHistory = useRef(false)
    const prefix = `/api/modules/${admin ? 'admin/' : ''}`
    const api: RequestFn = async (path, data) => {
        const response = await fetch(`${prefix}${path}`, {
            credentials: 'same-origin', cache: 'no-store', method: data ? 'POST' : 'GET',
            headers: { 'Content-Type': 'application/json', ...(admin && tenantId ? { 'X-Tenant-ID': tenantId } : {}) },
            ...(data ? { body: JSON.stringify(data) } : {}),
        })
        const result = await response.json().catch(() => ({}))
        if (!response.ok) throw new Error(result.error || 'Could not load this module. Please retry.')
        return result
    }
    const key = (name: string) => requestKeys.current[name] ||= crypto.randomUUID()
    const load = async () => {
        const version = ++generation.current
        try {
            const next = await api('config') as Config
            if (version !== generation.current) return
            setConfig(next); setLoaded(true)
            if (tab === 'products' && !next.commerce) { setTab(next.faq ? 'faqs' : next.support ? 'support' : next.forum ? 'forum' : 'account'); return }
            let result: unknown = []
            if (tab === 'products' && next.commerce) {
                const catalog = await api('products') as { products: Row[]; prices: Row[]; mode: string }
                if (version !== generation.current) return
                setPrices(catalog.prices); setMode(catalog.mode); result = catalog.products
            } else if (tab === 'account' || tab === 'purchases') {
                if (tab === 'account') {
                    const account = await api('account') as { purchases: Row[]; grants: Row[] }
                    if (version !== generation.current) return
                    setGrants(account.grants); result = account.purchases
                } else result = await api('purchases')
            } else if (tab === 'faqs' && next.faq) result = await api('faqs')
            else if ((tab === 'support' && next.support) || (tab === 'forum' && next.forum)) result = await api(`threads?kind=${tab}`)
            else if (admin && ['grants', 'organizations', 'memberships'].includes(tab) && next.commerce) result = await api(tab)
            if (version === generation.current) { setItems(asRows(result)); setError('') }
        } catch (error) { if (version === generation.current) { setLoaded(true); setError((error as Error).message) } }
    }
    useEffect(() => { readingHistory.current = false; requestKeys.current = {}; setItems([]); setSelected(null); setEditing(null); setSearch(''); setDocuments({}); setError(''); void load(); return () => { generation.current++ } }, [tab, tenantId]) // eslint-disable-line react-hooks/exhaustive-deps
    useEffect(() => {
        if (!selected || !['support', 'forum'].includes(tab)) return
        let active = true
        const poll = async () => {
            try {
                const result = await api(`threads/${selected.id}`) as { thread: Row; messages: Row[]; olderCursor: string | null }
                if (active) { setMessages(result.messages); setSelected(result.thread); setOlderCursor(result.olderCursor) }
            } catch (error) { if (active) setError((error as Error).message) }
        }
        void poll()
        const timer = setInterval(() => { if (!document.hidden && !readingHistory.current) void poll() }, 5000)
        return () => { active = false; clearInterval(timer) }
    }, [selected?.id, tab, tenantId]) // eslint-disable-line react-hooks/exhaustive-deps
    const act = async (action: () => Promise<void>) => {
        setBusy(true); setError(''); setNotice('')
        try { await action(); return true } catch (error) { setError((error as Error).message); return false } finally { setBusy(false) }
    }
    const save = (path: string, data: Row, success = 'Saved.') => act(async () => { await api(path, data); setEditing(null); setNotice(success); await load() })
    const go = async (path: string, data: Row) => {
        const result = await api(path, data) as { url?: string }
        if (!result.url || !/^https:\/\/(checkout|billing)\.stripe\.com\//.test(result.url)) throw new Error('Checkout is no longer open. Start a new purchase from the product list.')
        window.location.assign(result.url)
    }
    const tabs = [
        ...(admin ? [['modules', 'Modules']] : []),
        ...(config.commerce ? [['products', 'Products']] : []),
        ...(admin ? (config.commerce ? [['purchases', 'Purchases'], ['grants', 'Access'], ['organizations', 'Organizations'], ['memberships', 'Members']] : []) : [['account', 'My purchases']]),
        ...(config.support ? [['support', 'Support']] : []), ...(config.faq ? [['faqs', 'FAQ']] : []), ...(config.forum ? [['forum', 'Forum']] : []),
    ]
    const filtered = items.filter(item => Object.values(item).some(value => typeof value === 'string' && value.toLowerCase().includes(search.toLowerCase())))
    const changeTab = (next: string) => { setTab(next); setNotice('') }
    return <div className="eceee-modules">
        <div className="module-tabs" role="navigation" aria-label="Service modules">
            {tabs.map(([id, name]) => <button type="button" key={id} aria-current={tab === id ? 'page' : undefined} onClick={() => changeTab(id)}>{name}</button>)}
        </div>
        {error && <p role="alert" className="module-error">{error} <button type="button" onClick={() => void load()}>Retry</button></p>}
        {notice && <p role="status">{notice}</p>}
        {!loaded && <p role="status">Loading modules…</p>}
        {loaded && !error && tabs.length === (admin ? 1 : 1) && !Object.values(config).some(Boolean) && <p>No service modules have been enabled for this site.</p>}
        {tab === 'modules' && admin && <form onSubmit={event => { event.preventDefault(); void save('config', config) }}>
            <p>Enable the services this tenant uses. Configure Stripe before enabling commerce.</p>
            {(['commerce', 'support', 'faq', 'forum'] as const).map(name => <label className="module-check" key={name}><input type="checkbox" checked={config[name]} onChange={event => setConfig({ ...config, [name]: event.target.checked })} />{name === 'faq' ? 'FAQ' : name[0].toUpperCase() + name.slice(1)}</label>)}
            <button className="module-primary" disabled={busy}>Save modules</button>
        </form>}
        {tab !== 'modules' && !selected && <>
            {!editing && <div className="module-toolbar">
                <Field label="Search" value={search} onChange={setSearch} />
                {(admin && ['products', 'faqs', 'grants', 'organizations', 'memberships'].includes(tab) || ['support', 'forum'].includes(tab)) && <button disabled={busy} className="module-primary" onClick={() => setEditing({ id: crypto.randomUUID() })}>{tab === 'support' ? 'Contact support' : tab === 'forum' ? 'New discussion' : ({ products: 'Add product', faqs: 'Add FAQ', grants: 'Grant access', organizations: 'Add organization', memberships: 'Add membership' }[tab])}</button>}
                {!admin && tab === 'account' && <button disabled={busy} onClick={() => void act(() => go('portal', {}))}>Manage billing</button>}
            </div>}
            {!editing && admin && tab === 'products' && <button disabled={busy} onClick={() => void save('portal-configuration', {}, 'Customer billing portal configured.')}>Configure customer portal</button>}
            {mode && tab === 'products' && (admin || mode === 'test') && <p className="module-meta">{admin ? `Stripe ${mode}` : 'Test checkout'}</p>}
            {editing && <ModuleForm key={label(editing.id)} tab={tab} value={editing} busy={busy} onCancel={() => setEditing(null)} onSubmit={async data => {
                if (['support', 'forum'].includes(tab)) await save('threads', { ...data, kind: tab }, 'Conversation created.')
                else await save(tab, data)
            }} />}
            {!editing && filtered.length === 0 && <p>No {tab === 'account' ? 'purchases' : tab} to show.</p>}
            {!editing && <ul className="module-list">
                {filtered.map(item => <li key={label(item.id || `${item.organizationId}:${item.userId}`)}>
                    {tab === 'products' ? <>
                        <h2>{label(item.name)} {!item.active && <span className="module-meta">Archived</span>}</h2><p className="module-prose">{label(item.description)}</p>
                        {prices.filter(price => price.productId === item.id).map(price => <div className="module-row" key={label(price.id)}>
                            <span>{money(price.amount, price.currency)}{price.interval !== 'once' ? ` / ${price.interval}` : ''}{!price.active ? ' · Archived' : ''}</span>
                            {admin ? <button disabled={busy} onClick={() => void save(`prices/${price.id}`, { active: !price.active })}>{price.active ? 'Archive price' : 'Restore price'}</button> : <button disabled={busy || !price.active} className="module-primary" onClick={() => void act(() => go('checkout', { priceId: price.id, requestKey: key(`checkout:${price.id}`) }))}>Buy</button>}
                        </div>)}
                        {admin && <div className="module-actions"><button onClick={() => setEditing(item)}>Edit product</button><button onClick={() => setSelected({ ...item, form: 'price' })}>Add price</button></div>}
                    </> : tab === 'faqs' ? <><details><summary>{label(item.question)} {admin && !item.published ? '(Draft)' : ''}</summary><p className="module-prose">{label(item.answer)}</p></details>{admin && <button onClick={() => setEditing(item)}>Edit FAQ</button>}</>
                        : ['support', 'forum'].includes(tab) ? <button className="module-thread" onClick={() => { readingHistory.current = false; setMessages([]); setSelected(item) }}><span>{label(item.title)}</span><small>{label(item.status)}</small></button>
                            : ['purchases', 'account'].includes(tab) ? <>
                                <div className="module-row"><h2>{label(item.name)}</h2><span>{statusNames[label(item.status)] || label(item.status)}</span></div>
                                <p>{money(item.amount, item.currency)}{item.paidUntil ? ` · Access until ${new Date(label(item.paidUntil)).toLocaleDateString()}` : ''}{admin ? ` · User ${item.userId}` : ''}</p>
                                <div className="module-actions"><button disabled={busy} onClick={() => void act(async () => setDocuments({ ...documents, [label(item.id)]: asRows(await api(`purchases/${item.id}/documents`)) }))}>Receipts and invoices</button>
                                    {admin && Boolean(item.subscriptionId) && <button disabled={busy} onClick={() => void act(async () => { const catalog = await api('products') as { prices: Row[] }; setPrices(catalog.prices); setSelected({ ...item, form: 'subscription' }) })}>Change price…</button>}
                                    {Boolean(item.subscriptionId) && <button disabled={busy} onClick={() => void save(`purchases/${item.id}/subscription`, { cancelAtPeriodEnd: !item.cancelAtPeriodEnd }, item.cancelAtPeriodEnd ? 'Renewal restored.' : 'Subscription will end at the end of the paid period.')}>{item.cancelAtPeriodEnd ? 'Resume renewal' : 'End at period end'}</button>}
                                    {admin && <button disabled={busy} onClick={() => void save(`purchases/${item.id}/reconcile`, {})}>Refresh payment</button>}
                                    {admin && ['paid', 'active'].includes(label(item.status)) && <button disabled={busy} onClick={() => setSelected({ ...item, form: 'refund' })}>Refund…</button>}
                                </div>
                                {documents[label(item.id)] && <ul>{documents[label(item.id)].length === 0 && <li>No documents are available yet.</li>}{documents[label(item.id)].map((doc, index) => <li key={index}><a href={label(doc.url)} target="_blank" rel="noreferrer">{label(doc.kind)} · {label(doc.status)}</a></li>)}</ul>}
                            </> : tab === 'grants' ? <><p>{label(item.accessKey)} · {item.organizationId ? `Organization ${item.organizationId}` : `User ${item.userId}`} · {label(item.source)}{item.revoked ? ' · Revoked' : ''}</p><p>{label(item.reason)}</p>{item.source !== 'purchase' && <button disabled={busy} onClick={() => void save(`grants/${item.id}`, { revoked: !item.revoked })}>{item.revoked ? 'Restore access' : 'Revoke access'}</button>}</>
                                : tab === 'organizations' ? <><h2>{label(item.name)}</h2><p className="module-meta">{label(item.id)}</p><button onClick={() => setEditing(item)}>Edit organization</button></>
                                    : <><p>Organization {label(item.organizationId)} · User {label(item.userId)} · {item.active ? 'Active' : 'Inactive'}</p><button onClick={() => setEditing({ ...item, id: `${item.organizationId}:${item.userId}` })}>Edit membership</button></>}
                </li>)}
            </ul>}
            {tab === 'account' && <><h2>Access rights</h2>{grants.length === 0 && <p>No access rights yet.</p>}<ul>{grants.map(grant => <li key={label(grant.id)}>{label(grant.accessKey)} · {grant.revoked ? 'Revoked' : grant.endsAt && new Date(label(grant.endsAt)) <= new Date() ? 'Expired' : 'Available'}{grant.endsAt ? ` · ${new Date(label(grant.endsAt)).toLocaleDateString()}` : ''}</li>)}</ul></>}
        </>}
        {selected?.form === 'price' && <><button onClick={() => setSelected(null)}>Back to products</button><ModuleForm tab="prices" value={{ id: crypto.randomUUID(), productId: selected.id }} busy={busy} onCancel={() => setSelected(null)} onSubmit={data => act(async () => { await api('prices', data); setSelected(null); await load() })} /></>}
        {selected?.form === 'subscription' && <><button onClick={() => setSelected(null)}>Back to purchases</button><p>Choose another recurring price for this product. Stripe invoices the price change immediately; it takes effect after payment succeeds.</p><ModuleForm tab="subscription" choices={prices.filter(price => price.productId === selected.productId && price.active && price.interval !== 'once')} value={{ id: selected.id, priceId: selected.priceId }} busy={busy} onCancel={() => setSelected(null)} onSubmit={data => act(async () => { await api(`purchases/${selected.id}/subscription`, { priceId: data.priceId, requestKey: key(`plan:${selected.id}:${data.priceId}`) }); setSelected(null); await load() })} /></>}
        {selected?.form === 'refund' && <div><h2>Refund {label(selected.name)}</h2><p>Issue a full refund of the latest payment and revoke access for the refunded purchase or period. Future subscription renewals continue unless renewal is ended. This sends the refund to Stripe.</p><div className="module-actions"><button disabled={busy} onClick={() => void act(async () => { await api(`purchases/${selected.id}/refund`, { requestKey: key(`refund:${selected.id}`) }); setSelected(null); await load() })}>Issue full refund</button><button disabled={busy} onClick={() => setSelected(null)}>Back to purchases</button></div></div>}
        {selected && ['support', 'forum'].includes(tab) && <>
            <button onClick={() => setSelected(null)}>Back to {tab === 'support' ? 'support' : 'forum'}</button><h2>{label(selected.title)}</h2><p className="module-meta">{label(selected.status)}</p>
            {admin && <div className="module-actions">{['open', 'closed', 'hidden'].filter(status => status !== selected.status).map(status => <button disabled={busy} key={status} onClick={() => void act(async () => { await api(`threads/${selected.id}`, { status }); setSelected({ ...selected, status }) })}>{status === 'open' ? 'Reopen' : status === 'closed' ? 'Close' : 'Hide'} conversation</button>)}</div>}
            {olderCursor && <button onClick={() => void act(async () => { readingHistory.current = true; const previous = await api(`threads/${selected.id}?before=${olderCursor}`) as { messages: Row[]; olderCursor: string | null }; setMessages([...previous.messages, ...messages]); setOlderCursor(previous.olderCursor) })}>Load older messages</button>}
            <ol className="module-list" aria-live="polite">{messages.map(message => <li key={label(message.id)}><div className="module-row"><strong>{label(message.authorName)}</strong><time>{new Date(label(message.createdAt)).toLocaleString()}</time></div><p className="module-prose">{label(message.body)}{message.hidden ? ' (Hidden)' : ''}</p>{admin && <button disabled={busy} onClick={() => void act(async () => { await api(`threads/${selected.id}`, { messageId: message.id, hidden: !message.hidden }); setMessages(messages.map(value => value.id === message.id ? { ...value, hidden: !value.hidden } : value)) })}>{message.hidden ? 'Restore message' : 'Hide message'}</button>}</li>)}</ol>
            {selected.status === 'open' && <Reply busy={busy} onSubmit={message => act(async () => { await api(`threads/${selected.id}`, { body: message, requestKey: key(`reply:${selected.id}:${message}`) }); const updated = await api(`threads/${selected.id}`) as { messages: Row[] }; setMessages(updated.messages); delete requestKeys.current[`reply:${selected.id}:${message}`] })} />}
        </>}
    </div>
}

function Field({ label: name, value, onChange, type = 'text', required = false, multiline = false }: { label: string; value: string; onChange: (value: string) => void; type?: string; required?: boolean; multiline?: boolean }) {
    const id = React.useId()
    return <div className={`module-field ${value ? 'has-value' : ''}`}>
        {multiline ? <textarea id={id} value={value} onChange={event => onChange(event.target.value)} required={required} rows={4} maxLength={20000} /> : <input id={id} type={type} value={value} onChange={event => onChange(event.target.value)} required={required} maxLength={10000} />}
        <label htmlFor={id}>{name}</label>
    </div>
}
function Reply({ busy, onSubmit }: { busy: boolean; onSubmit: (body: string) => Promise<boolean> }) {
    const [body, setBody] = useState('')
    return <form onSubmit={event => { event.preventDefault(); void onSubmit(body).then(success => { if (success) setBody('') }) }}><Field label="Message" multiline value={body} onChange={setBody} required /><button disabled={busy || !body.trim()} className="module-primary">Send message</button></form>
}
function ModuleForm({ tab, value, busy, onCancel, onSubmit, choices = [] }: { tab: string; value: Row; choices?: Row[]; busy: boolean; onCancel: () => void; onSubmit: (data: Row) => Promise<unknown> }) {
    const [data, setData] = useState<Row>({ active: true, published: false, interval: 'once', currency: 'eur', accessDays: null, description: '', ...value })
    const field = (name: string, title: string, type = 'text', required = true, multiline = false) => <Field key={name} label={title} type={type} multiline={multiline} required={required} value={type === 'datetime-local' && data[name] ? new Date(new Date(label(data[name])).getTime() - new Date(label(data[name])).getTimezoneOffset() * 60000).toISOString().slice(0, 16) : label(data[name])} onChange={next => setData({ ...data, [name]: type === 'datetime-local' ? next ? new Date(next).toISOString() : null : ['amount', 'accessDays', 'userId'].includes(name) ? next === '' ? null : Number(next) : next })} />
    const check = (name: string, title: string) => <label className="module-check"><input type="checkbox" checked={Boolean(data[name])} onChange={event => setData({ ...data, [name]: event.target.checked })} />{title}</label>
    return <form className="module-form" onSubmit={event => { event.preventDefault(); void onSubmit(data) }}>
        {tab === 'products' && <>{field('name', 'Product name')}{field('description', 'What the customer receives', 'text', false, true)}{field('accessKey', 'Access key')}{field('accessDays', 'Access days (empty means no expiry)', 'number', false)}{check('active', 'Available for purchase')}</>}
        {tab === 'prices' && <>{field('amount', 'Amount in minor currency units', 'number')}{field('currency', 'Currency (ISO code)')}<fieldset><legend>Billing interval</legend>{['once', 'month', 'year'].map(interval => <label className="module-check" key={interval}><input type="radio" name="interval" value={interval} checked={data.interval === interval} onChange={() => setData({ ...data, interval })} />{interval === 'once' ? 'One-time payment' : `Every ${interval}`}</label>)}</fieldset><p>Prices cannot be changed after creation. Create a new price and archive the old one.</p></>}
        {tab === 'faqs' && <>{field('question', 'Question')}{field('answer', 'Answer', 'text', true, true)}{check('published', 'Published')}</>}
        {['support', 'forum'].includes(tab) && <>{field('title', 'Subject')}{field('body', 'Message', 'text', true, true)}</>}
        {tab === 'grants' && <>{field('userId', 'User ID (or specify an organization)', 'number', false)}{field('organizationId', 'Organization ID', 'text', false)}{field('accessKey', 'Access key')}{field('endsAt', 'Expires at', 'datetime-local', false)}{field('reason', 'Reason')}</>}
        {tab === 'subscription' && <fieldset><legend>Subscription price</legend>{choices.length === 0 && <p>Create an active recurring price for this product first.</p>}{choices.map(price => <label className="module-check" key={label(price.id)}><input type="radio" name="subscriptionPrice" required value={label(price.id)} checked={data.priceId === price.id} onChange={() => setData({ ...data, priceId: price.id })} />{money(price.amount, price.currency)} / {label(price.interval)}</label>)}</fieldset>}
        {tab === 'organizations' && field('name', 'Organization name')}
        {tab === 'memberships' && <>{field('organizationId', 'Organization ID')}{field('userId', 'User ID', 'number')}{field('validUntil', 'Membership expires at', 'datetime-local', false)}{check('active', 'Active membership')}</>}
        <div className="module-actions"><button className="module-primary" disabled={busy || (tab === 'subscription' && choices.length === 0)}>{['support', 'forum'].includes(tab) ? 'Start conversation' : 'Save'}</button><button type="button" disabled={busy} onClick={onCancel}>Cancel</button></div>
    </form>
}
