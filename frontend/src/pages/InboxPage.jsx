import Avatar from '../components/Avatar'
import { MessageFilePicker, MessageFile, uploadMessageFiles } from '../components/support/MessageFiles'
import { reportDiagnostics } from '../utils/reportDiagnostics'
import UserToolsNav from '../components/UserToolsNav'
import { useEffect, useRef, useState } from 'react'
import {
    Link,
    useLocation,
    useNavigate,
    useParams,
} from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Popover, PopoverButton, PopoverPanel } from '@headlessui/react'
import PrivatePlayer from '../components/support/PrivateVideoPlayer'
import HelpGuideSelect from '../components/help/HelpGuideSelect'
import StatusBar from '../components/StatusBar'
import { Inbox, Search, PenLine, Archive, RotateCw, Plus, X } from 'lucide-react'
import '../components/user-tools.css'
import {
    supportError,
    supportRequest,
    safeReportLocation,
    validateBugVideo,
} from '../api/support'
import {
    useSupportContext,
    useSupportTenant,
    useSupportIdentity,
} from '../components/support/useSupportContext'
import { useDocumentTitle } from '../hooks/useDocumentTitle'
import { cmsLegacyText, getCmsCopyLanguage } from '../utils/cmsCopy'
import { helpLanguageFor } from '../utils/cmsLanguage'
import './InboxPage.css'

const deliveryReason = {
    missing_email: 'Mottagaren saknar e-postadress',
    app_url_not_configured: 'Systemets länkadress behöver konfigureras',
    backend_unavailable: 'E-posttjänsten kunde inte nås',
    provider_outcome_unknown: 'Kontrollera e-posttjänstens leveransstatus',
    worker_interrupted: 'Sändningen avbröts; kontrollera leveransstatus',
}

const statusText = {
    open: 'Öppen',
    waiting: 'Väntar på användaren',
    resolved: 'Löst',
}
const dateText = (value) =>
    new Date(value).toLocaleString(getCmsCopyLanguage(), {
        dateStyle: 'short',
        timeStyle: 'short',
    })
const ErrorText = ({ error }) =>
    error ? (
        <p className="support-error" role="alert">
            {typeof error === 'string' ? error : supportError(error)}
        </p>
    ) : null

function Pager({ result, page, setPage }) {
    return result?.previous || result?.next ? (
        <div className="support-actions">
            <button
                disabled={!result.previous}
                onClick={() => setPage(page - 1)}
            >
                Föregående
            </button>
            <span>Sida {page}</span>
            <button disabled={!result.next} onClick={() => setPage(page + 1)}>
                Nästa
            </button>
        </div>
    ) : null
}

function InboxList({ link }) {
    const tenant = useSupportTenant()
    const identity = useSupportIdentity()
    const queryClient = useQueryClient()
    const [filter, setFilter] = useState('all')
    const [searchText, setSearchText] = useState('')
    const [search, setSearch] = useState('')
    const [page, setPage] = useState(1)
    const [undo, setUndo] = useState(null)
    const query = useQuery({
        queryKey: ['support', tenant, identity, 'inbox', filter, page, search],
        queryFn: () =>
            supportRequest(
                tenant,
                `inbox/?page=${page}&kind=${filter}&archived=${filter === 'archive'}&search=${encodeURIComponent(search)}`,
            ),
        refetchInterval: 60000,
    })
    const archive = useMutation({
        mutationFn: ({ id, archived }) =>
            supportRequest(tenant, `inbox/${id}/`, 'patch', { archived }),
        onSuccess: (_, data) => {
            setUndo(data)
            queryClient.invalidateQueries({ queryKey: ['support', tenant] })
        },
    })
    return (
        <>
            <form className="mail-search" role="search" onSubmit={(e) => { e.preventDefault(); setSearch(searchText); setPage(1) }}>
                <Search size={20} aria-hidden="true" /><input aria-label="Sök i meddelanden" placeholder="Sök i meddelanden" value={searchText} onChange={(e) => setSearchText(e.target.value)} /><button>Sök</button>
            </form>
            <div className="mail-heading"><h2>Din inbox</h2><button aria-label="Uppdatera inbox" onClick={() => query.refetch()}><RotateCw size={16} /></button><span className="support-muted">{query.data?.count ?? query.data?.results?.length ?? 0} meddelanden</span></div>
            <div className="support-actions" aria-label="Filtrera inbox">
                {[
                    ['all', 'Alla'],
                    ['instruction', 'Instruktioner'],
                    ['support', 'Support'],
                    ['archive', 'Arkiv'],
                ].map(([key, title]) => (
                    <button
                        key={key}
                        aria-pressed={filter === key}
                        onClick={() => {
                            setFilter(key)
                            setPage(1)
                        }}
                    >
                        {title}
                    </button>
                ))}
            </div>
            <ErrorText error={query.error || archive.error} />
            {query.isPending && <p role="status">Hämtar meddelanden…</p>}
            <div className="mail-rows">
            {query.data?.results.map((entry) => (
                <article className={`mail-row ${entry.readAt ? '' : 'mail-unread'}`} key={entry.id}>
                    <span className="mail-sender">{entry.senderName || cmsLegacyText(entry.kind === 'instruction' ? 'Instruktion' : 'Meddelande', getCmsCopyLanguage())}</span>
                    <Link className="mail-subject" to={link(entry.instructionId ? `instructions/${entry.instructionId}` : `threads/${entry.threadId}`)}>
                        {!entry.readAt && <span className="sr-only">Oläst · </span>}<span>{entry.title}</span><span className="mail-preview"> — {entry.preview || (entry.status ? cmsLegacyText(statusText[entry.status], getCmsCopyLanguage()) : '')}</span>
                    </Link>
                    <time className="mail-time" dateTime={entry.activityAt}>{dateText(entry.activityAt)}</time>
                    <button title={entry.archived ? 'Återför till inbox' : 'Arkivera'} aria-label={`${entry.archived ? 'Återför till inbox' : 'Arkivera'}: ${entry.title}`} disabled={archive.isPending} onClick={() => archive.mutate({ id: entry.id, archived: !entry.archived })}><Archive size={16} /></button>
                </article>
            ))}
            </div>
            {query.data?.results.length === 0 && (
                <>
                    <p>Inga meddelanden här ännu.</p>
                    <Link to={link('new')}>Ställ en fråga</Link>
                </>
            )}
            {undo && (
                <p role="status">
                    {undo.archived
                        ? 'Arkiverat för dig.'
                        : 'Återfört till inbox.'}{' '}
                    <button
                        onClick={() => {
                            archive.mutate({
                                id: undo.id,
                                archived: !undo.archived,
                            })
                            setUndo(null)
                        }}
                    >
                        Ångra
                    </button>
                </p>
            )}
            <Pager result={query.data} page={page} setPage={setPage} />
        </>
    )
}

function Library({ link }) {
    const tenant = useSupportTenant()
    const identity = useSupportIdentity()
    const [archive, setArchive] = useState(false)
    const [page, setPage] = useState(1)
    const query = useQuery({
        queryKey: ['support', tenant, identity, 'library', archive, page],
        queryFn: () =>
            supportRequest(
                tenant,
                `instructions/?page=${page}&archived=${archive}`,
            ),
    })
    return (
        <>
            <h2>Instruktionsfilmer</h2>
            <p>
                Senaste publiceringen först. Filmerna bevaras även när de inte
                längre är aktuella.
            </p>
            <label>
                <input
                    type="checkbox"
                    checked={archive}
                    onChange={(e) => {
                        setArchive(e.target.checked)
                        setPage(1)
                    }}
                />{' '}
                Visa även arkiverade filmer
            </label>
            <ErrorText error={query.error} />
            {query.isPending && <p role="status">Hämtar instruktioner…</p>}
            {query.data?.results.map((v) => (
                <article className="support-row" key={v.id}>
                    <div>
                        <p className="support-muted">
                            {dateText(v.publishedAt)}
                            {' · '}{v.language === 'en' ? 'English' : 'Svenska'}
                            {v.archived && ' · Arkiverad'}
                            {v.withdrawn && ' · Avpublicerad'}
                        </p>
                        <h3>
                            <Link to={link(`instructions/${v.id}`)}>
                                {v.title}
                            </Link>
                        </h3>
                        <p>{v.description}</p>
                    </div>
                </article>
            ))}
            {query.data?.results.length === 0 && (
                <p>Inga publicerade instruktioner ännu.</p>
            )}
            <Pager result={query.data} page={page} setPage={setPage} />
        </>
    )
}

function InstructionDetail({ id, context, link }) {
    const tenant = useSupportTenant()
    const identity = useSupportIdentity()
    const queryClient = useQueryClient()
    const query = useQuery({
        queryKey: ['support', tenant, identity, 'instruction', id],
        queryFn: async () => {
            const v = await supportRequest(tenant, `instructions/${id}/`)
            queryClient.invalidateQueries({
                queryKey: ['support', tenant, identity, 'context'],
            })
            return v
        },
    })
    const change = useMutation({
        mutationFn: (data) =>
            supportRequest(tenant, `instructions/${id}/`, 'patch', data),
        onSuccess: () =>
            queryClient.invalidateQueries({ queryKey: ['support', tenant] }),
    })
    const v = query.data
    return (
        <>
            <ErrorText error={query.error || change.error} />
            {v ? (
                <>
                    <h2>{v.title}</h2>
                    <p>{v.description}</p>
                    {context.canPublish && (
                        <label>
                            Instruktionens språk
                            <select
                                value={v.language || 'sv'}
                                disabled={change.isPending}
                                onChange={(event) => change.mutate({ language: event.target.value })}
                            >
                                <option value="sv">Svenska</option>
                                <option value="en">English</option>
                            </select>
                        </label>
                    )}
                    {!context.canPublish && <p className="support-muted">{v.language === 'en' ? 'English' : 'Svenska'}</p>}
                    {v.helpGuideId && <Link to={`/help/how-to/${encodeURIComponent(v.helpGuideId)}?lang=${v.language || 'sv'}`}>Öppna hjälpartikeln</Link>}
                    {context.canPublish && (
                        <HelpGuideSelect
                            value={v.helpGuideId || ''}
                            disabled={change.isPending}
                            onChange={(helpGuideId) => change.mutate({ helpGuideId })}
                        />
                    )}
                    <p className="support-muted">
                        {dateText(v.publishedAt)}
                        {v.archived && ' · Arkiverad'}
                        {v.withdrawn && ' · Avpublicerad'}
                    </p>
                    {!v.withdrawn && <PrivatePlayer id={v.videoId} />}
                    {v.transcript && (
                        <section>
                            <h3>Text till filmen</h3>
                            <p className="support-body">{v.transcript}</p>
                        </section>
                    )}
                    <div className="support-actions">
                        <Link to={link(`new?instruction=${id}`)}>
                            Fråga om filmen
                        </Link>
                        {context.canPublish && (
                            <>
                                <button
                                    disabled={change.isPending}
                                    onClick={() =>
                                        change.mutate({ archived: !v.archived })
                                    }
                                >
                                    {v.archived
                                        ? 'Återför film'
                                        : 'Arkivera film'}
                                </button>
                                <button
                                    disabled={change.isPending}
                                    onClick={() =>
                                        change.mutate({
                                            withdrawn: !v.withdrawn,
                                        })
                                    }
                                >
                                    {v.withdrawn
                                        ? 'Publicera igen utan avisering'
                                        : 'Avpublicera film'}
                                </button>
                            </>
                        )}
                    </div>
                    <p className="support-muted">
                        Arkivering behåller åtkomsten. Avpublicering stoppar nya
                        uppspelningslänkar; tidigare länkar gäller i högst 60
                        sekunder.
                    </p>
                </>
            ) : (
                <p role="status">Öppnar instruktionen…</p>
            )}
        </>
    )
}

function VideoField({ purpose, maxBytes, file, setFile, valid, setValid }) {
    const [error, setError] = useState('')
    const [checking, setChecking] = useState(false)
    const [preview, setPreview] = useState('')
    const sequence = useRef(0)
    const inputRef = useRef(null)
    useEffect(() => {
        if (!file) {
            setPreview('')
            return
        }
        const url = URL.createObjectURL(file)
        setPreview(url)
        return () => URL.revokeObjectURL(url)
    }, [file])
    useEffect(
        () => () => {
            sequence.current += 1
        },
        [],
    )
    const select = async (e) => {
        const selected = e.target.files[0]
        const version = ++sequence.current
        setFile(selected || null)
        setValid(false)
        setError('')
        if (!selected) {
            setChecking(false)
            setValid(true)
            return
        }
        setChecking(true)
        try {
            if (selected.size > maxBytes)
                throw new Error(
                    `Välj en video på högst ${Math.floor(maxBytes / 1048576)} MB.`,
                )
            if (purpose === 'bug') await validateBugVideo(selected, maxBytes)
            if (version === sequence.current) setValid(true)
        } catch (err) {
            if (version === sequence.current) setError(err.message)
        } finally {
            if (version === sequence.current) setChecking(false)
        }
    }
    return (
        <section>
            <label>
                Video{' '}
                {purpose === 'bug'
                    ? '· valfri · högst 5 sekunder'
                    : '· obligatorisk'}
                <input
                    ref={inputRef}
                    type="file"
                    accept="video/mp4,video/webm"
                    onChange={select}
                />
            </label>
            <p className="support-muted">
                MP4 (H.264) eller WebM · högst {Math.floor(maxBytes / 1048576)}{' '}
                MB. Exportera MOV/HEVC till MP4 före uppladdning.
            </p>
            {checking && <p role="status">Kontrollerar videons längd…</p>}
            <ErrorText error={error} />
            {preview && valid && (
                <video src={preview} controls preload="metadata" />
            )}
            {file && (
                <button
                    type="button"
                    onClick={() => {
                        sequence.current += 1
                        if (inputRef.current) inputRef.current.value = ''
                        setFile(null)
                        setValid(true)
                        setError('')
                        setChecking(false)
                    }}
                >
                    Ta bort bilaga
                </button>
            )}
        </section>
    )
}

function RecipientField({ options, value, onChange, disabled }) {
    const [search, setSearch] = useState('')
    const selected = options.filter((option) => value.includes(option.id))
    const matches = options.filter((option) => option.name.toLocaleLowerCase().includes(search.toLocaleLowerCase()))
    const groups = [
        ['Användare', matches.filter((option) => option.kind === 'user')],
        ['Roller och grupper', matches.filter((option) => option.kind === 'group')],
        ['Övriga', matches.filter((option) => !['user', 'group'].includes(option.kind))],
    ]
    const selectedBoard = value.find((id) => id.startsWith('board:'))

    return <fieldset className="message-recipients">
        <legend>Till</legend>
        <div className="message-recipient-line">
            {selected.map((option) => <span className="message-recipient-chip" key={option.id}>
                <span>{option.name}</span>
                <button type="button" aria-label={`Ta bort ${option.name}`} disabled={disabled}
                    onClick={() => onChange(value.filter((id) => id !== option.id))}><X size={14} /></button>
            </span>)}
            {options.length > 0 && <Popover className="message-recipient-popover">
                <PopoverButton type="button" className="message-recipient-add" disabled={disabled} onClick={() => setSearch('')}><Plus size={15} /> Lägg till</PopoverButton>
                <PopoverPanel anchor="bottom start" className="message-recipient-picker">
                    <strong>Välj mottagare</strong>
                    <input aria-label="Sök mottagare" type="search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Sök användare eller roll" />
                    <div className="message-recipient-options">
                        {groups.map(([title, items]) => items.length > 0 && <section key={title} aria-label={title}>
                            <h3>{title}</h3>
                            {items.map((option) => <label key={option.id}>
                                <input type="checkbox" checked={value.includes(option.id)}
                                    disabled={disabled || (option.kind === 'board' && !!selectedBoard && selectedBoard !== option.id)}
                                    onChange={(event) => onChange(event.target.checked ? [...value, option.id] : value.filter((id) => id !== option.id))} />
                                <span>{option.name}</span>
                            </label>)}
                        </section>)}
                        {!matches.length && <p>Inga mottagare matchar sökningen.</p>}
                    </div>
                </PopoverPanel>
            </Popover>}
            {!options.length && <span className="support-muted">Inga mottagare är tillgängliga i arbetsytan.</span>}
        </div>
    </fieldset>
}

function Compose({ context, link, publish = false }) {
    const tenant = useSupportTenant()
    const navigate = useNavigate()
    const location = useLocation()
    const queryClient = useQueryClient()
    const [kind, setKind] = useState('question')
    const [recipients, setRecipients] = useState(context.supportAvailable ? ['support'] : [])
    const [files, setFiles] = useState([])
    const [checkingFiles, setCheckingFiles] = useState(false)
    const fileCache = useRef(new Map())
    const [includeDiagnostics, setIncludeDiagnostics] = useState(() => new URLSearchParams(location.search).has('from'))
    const [title, setTitle] = useState('')
    const [body, setBody] = useState('')
    const [transcript, setTranscript] = useState('')
    const [language, setLanguage] = useState(() => {
        const requested = new URLSearchParams(location.search).get('lang')
        return ['sv', 'en'].includes(requested) ? requested : helpLanguageFor(getCmsCopyLanguage())
    })
    const [helpGuideId, setHelpGuideId] = useState(() => new URLSearchParams(location.search).get('guide') || '')
    const [place, setPlace] = useState(() =>
        safeReportLocation(
            new URLSearchParams(location.search).get('from') || '',
        ),
    )
    const [file, setFile] = useState(null)
    const [valid, setValid] = useState(true)
    const [stage, setStage] = useState('')
    const requestId = useRef(crypto.randomUUID())
    const mounted = useRef(true)
    useEffect(() => {
        mounted.current = true
        return () => {
            mounted.current = false
        }
    }, [])
    const attachment = useRef(null)
    const instruction = new URLSearchParams(location.search).get('instruction')
    const send = useMutation({
        mutationFn: async () => {
            let videoId = null
            if (file) {
                if (attachment.current?.file === file)
                    videoId = attachment.current.id
                else {
                    setStage('Laddar upp och kontrollerar videon på servern…')
                    const form = new FormData()
                    form.append('file', file)
                    form.append('purpose', publish ? 'instruction' : 'bug')
                    const saved = await supportRequest(
                        tenant,
                        'videos/',
                        'post',
                        form,
                    )
                    videoId = saved.id
                    attachment.current = { file, id: videoId }
                }
            }
            setStage(
                publish ? 'Publicerar instruktionen…' : 'Skickar meddelandet…',
            )
            return supportRequest(
                tenant,
                publish ? 'instructions/' : 'threads/',
                'post',
                publish
                    ? {
                          title,
                          description: body,
                          transcript,
                          language,
                          helpGuideId,
                          videoId,
                          requestId: requestId.current,
                      }
                    : {
                          title,
                          body,
                          kind,
                          recipients,
                          attachmentIds: await uploadMessageFiles(tenant, files, fileCache.current),
                          ...(includeDiagnostics ? { diagnostics: reportDiagnostics() } : {}),
                          location: place,
                          instructionId: instruction,
                          videoId,
                          requestId: requestId.current,
                      },
            )
        },
        onSuccess: (result) => {
            queryClient.invalidateQueries({ queryKey: ['support', tenant] })
            if (mounted.current)
                navigate(
                    link(
                        `${publish ? 'instructions' : 'threads'}/${result.id}`,
                    ),
                )
        },
        onSettled: () => setStage(''),
    })
    return (
        <>
            <h2>
                {publish
                    ? 'Publicera instruktion'
                    : 'Nytt meddelande'}
            </h2>
            <p>
                {publish
                    ? `Mottagare: ${context.tenant.name} · ${context.recipientCount} andra aktiva medlemmar får en avisering.`
                    : `Till mottagare i ${context.tenant.name}. Välj Support för frågor till supporten.`}
            </p>
            {publish && context.storageConfigured === false && (
                <p className="support-error" role="alert">
                    Videolagring är inte konfigurerad för miljön. Lagringen behöver aktiveras innan du kan ladda upp filmer.
                </p>
            )}
            {!publish && recipients.includes('support') && !context.supportAvailable && (
                <p className="support-error">
                    Support är inte konfigurerad för arbetsytan. Kontakta
                    systemägaren.
                </p>
            )}
            <form
                onSubmit={(e) => {
                    e.preventDefault()
                    if (send.error?.response?.status === 409) {
                        requestId.current = crypto.randomUUID()
                        attachment.current = null
                        fileCache.current.clear()
                    }
                    send.mutate()
                }}
                aria-busy={send.isPending}
            >
                <fieldset disabled={send.isPending}>
                    {!publish && <RecipientField
                        options={context.recipients || (context.supportAvailable ? [{ id: 'support', name: 'Support', kind: 'support' }] : [])}
                        value={recipients} onChange={setRecipients} disabled={send.isPending}
                    />}
                    {!publish && (
                        <label>
                            Typ (valfri)
                            <select
                                value={kind}
                                onChange={(e) => {
                                    setKind(e.target.value)
                                    setFile(null)
                                    setValid(true)
                                }}
                            >
                                <option value="bug">Felrapport</option>
                                <option value="question">Fråga</option>
                            </select>
                        </label>
                    )}
                    {publish && (
                        <label>
                            Instruktionens språk
                            <select value={language} onChange={(event) => setLanguage(event.target.value)}>
                                <option value="sv">Svenska</option>
                                <option value="en">English</option>
                            </select>
                        </label>
                    )}
                    <label>
                        Titel
                        <input
                            required
                            maxLength={150}
                            value={title}
                            onChange={(e) => setTitle(e.target.value)}
                        />
                    </label>
                    <label>
                        {publish ? 'Kort beskrivning' : 'Beskrivning'}
                        <textarea
                            required
                            maxLength={4000}
                            value={body}
                            onChange={(e) => setBody(e.target.value)}
                        />
                    </label>
                    {!publish && (
                        <label>
                            Länk till platsen
                            <input
                                aria-label="Länk till platsen"
                                aria-describedby="support-location-hint"
                                type="url"
                                maxLength={2000}
                                value={place}
                                onChange={(e) => setPlace(e.target.value)}
                                placeholder="https://…"
                            />
                            <span
                                id="support-location-hint"
                                className="support-muted"
                            >
                                Granska länken och undvik känsliga uppgifter.
                                Inget innehåll hämtas från länken.
                            </span>
                        </label>
                    )}
                    {publish && (
                        <VideoField
                            key={kind}
                            purpose={publish ? 'instruction' : 'bug'}
                            maxBytes={
                                context.videoLimits[
                                    publish ? 'instruction' : 'bug'
                                ]
                            }
                            file={file}
                            setFile={setFile}
                            valid={valid}
                            setValid={setValid}
                        />
                    )}
                    {!publish && <MessageFilePicker files={files} setFiles={setFiles} disabled={send.isPending} onCheckingChange={setCheckingFiles} />}
                    {!publish && new URLSearchParams(location.search).has('from') && <label><input type="checkbox" checked={includeDiagnostics} onChange={(e) => setIncludeDiagnostics(e.target.checked)} /> Bifoga filtrerad diagnostik (senaste webbläsarfel och metadata för sändningen)</label>}
                    {publish && (
                        <HelpGuideSelect value={helpGuideId} onChange={setHelpGuideId} />
                    )}
                    {publish && (
                        <label>
                            Text till filmen
                            <textarea
                                maxLength={30000}
                                value={transcript}
                                onChange={(e) => setTranscript(e.target.value)}
                            />
                            <span className="support-muted">
                                Gör instruktionen tillgänglig även utan ljud och
                                video.
                            </span>
                        </label>
                    )}
                    <ErrorText error={send.error} />
                    {send.error?.response?.data?.existingId && (
                        <Link
                            to={link(
                                `${publish ? 'instructions' : 'threads'}/${send.error.response.data.existingId}`,
                            )}
                        >
                            Öppna den sparade versionen
                        </Link>
                    )}
                    <p role="status">{stage}</p>
                    <button
                        className="user-tools-primary"
                        disabled={
                            !valid ||
                            checkingFiles ||
                            send.isPending ||
                            (publish ? !file || context.storageConfigured === false : !recipients.length || (recipients.includes('support') && !context.supportAvailable))
                        }
                    >
                        {send.error?.response?.status === 409
                            ? publish
                                ? 'Publicera som ny instruktion'
                                : 'Skicka som nytt ärende'
                            : publish
                              ? `Publicera till ${context.tenant.name}`
                              : 'Skicka meddelande'}
                    </button>
                </fieldset>
            </form>
        </>
    )
}

function ThreadDetail({ id, context }) {
    const tenant = useSupportTenant()
    const identity = useSupportIdentity()
    const queryClient = useQueryClient()
    const [body, setBody] = useState('')
    const [files, setFiles] = useState([])
    const [checkingFiles, setCheckingFiles] = useState(false)
    const fileCache = useRef(new Map())
    const requestId = useRef(crypto.randomUUID())
    const query = useQuery({
        queryKey: ['support', tenant, identity, 'thread', id],
        queryFn: async () => {
            const value = await supportRequest(tenant, `threads/${id}/`)
            queryClient.invalidateQueries({
                queryKey: ['support', tenant, identity, 'context'],
            })
            return value
        },
        refetchInterval: 60000,
    })
    const reply = useMutation({
        mutationFn: async () =>
            supportRequest(tenant, `threads/${id}/`, 'post', {
                attachmentIds: await uploadMessageFiles(tenant, files, fileCache.current),
                body,
                requestId: requestId.current,
            }),
        onSuccess: () => {
            setBody('')
            setFiles([])
            fileCache.current.clear()
            requestId.current = crypto.randomUUID()
            queryClient.invalidateQueries({ queryKey: ['support', tenant] })
        },
    })
    const state = useMutation({
        mutationFn: (status) =>
            supportRequest(tenant, `threads/${id}/`, 'patch', { status }),
        onSuccess: () =>
            queryClient.invalidateQueries({ queryKey: ['support', tenant] }),
    })
    const t = query.data
    return (
        <>
            <ErrorText error={query.error || state.error} />
            {t ? (
                <>
                    <h2>{t.title}</h2>
                    <p>
                        {t.kind === 'bug' ? 'Felrapport' : 'Fråga'} ·{' '}
                        {cmsLegacyText(statusText[t.status], getCmsCopyLanguage())} · {t.supportTarget !== false ? 'Supporttråd' : 'Privat meddelande'}
                    </p>
                    {t.boardCardId && <Link to={`/kanban/cards/${t.boardCardId}`}>Öppna kortet i tavlans Inbox</Link>}
                    {t.location && (
                        <p>
                            Plats:{' '}
                            <a
                                href={t.location}
                                target="_blank"
                                rel="noreferrer"
                            >
                                {t.location}
                            </a>
                        </p>
                    )}
                    {t.videoId && <PrivatePlayer id={t.videoId} />}
                    {t.messages.map((message) => (
                        <article className="support-message" key={message.id}>
                            <h3>
                                <Avatar userId={message.senderId} name={message.senderName} /> {message.senderName}{' '}
                                <span className="support-muted">
                                    · {dateText(message.createdAt)}
                                </span>
                            </h3>
                            <p className="support-body">{message.body}</p>
                            {message.attachments?.map((file) => <MessageFile key={file.id} file={file} />)}
                        </article>
                    ))}
                    <form
                        onSubmit={(e) => {
                            e.preventDefault()
                            if (reply.error?.response?.status === 409) {
                                requestId.current = crypto.randomUUID()
                                fileCache.current.clear()
                            }
                            reply.mutate()
                        }}
                    >
                        <label>
                            Ditt svar
                            <textarea
                                required
                                maxLength={4000}
                                value={body}
                                disabled={reply.isPending}
                                onChange={(e) => setBody(e.target.value)}
                            />
                        </label>
                        <MessageFilePicker files={files} setFiles={setFiles} disabled={reply.isPending} onCheckingChange={setCheckingFiles} />
                        <ErrorText error={reply.error} />
                        <div className="support-actions">
                            <button
                                className="user-tools-primary"
                                disabled={reply.isPending || checkingFiles || !body.trim()}
                            >
                                {reply.error?.response?.status === 409
                                    ? 'Skicka som nytt svar'
                                    : 'Skicka svar'}
                            </button>
                            {context.canSupport && (
                                <button
                                    type="button"
                                    disabled={state.isPending}
                                    onClick={() =>
                                        state.mutate(
                                            t.status === 'resolved'
                                                ? 'open'
                                                : 'resolved',
                                        )
                                    }
                                >
                                    {t.status === 'resolved'
                                        ? 'Återöppna'
                                        : 'Markera löst'}
                                </button>
                            )}
                        </div>
                    </form>
                </>
            ) : (
                <p role="status">Öppnar supporttråden…</p>
            )}
        </>
    )
}

function Manage({ context }) {
    const tenant = useSupportTenant()
    const identity = useSupportIdentity()
    const queryClient = useQueryClient()
    const [userId, setUserId] = useState('')
    const [canSupport, setCanSupport] = useState(false)
    const [canPublish, setCanPublish] = useState(false)
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
                Arbetsyta: {context.tenant.name}. Roller gäller bara den här
                tenanten.
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
                        Får läsa och svara på tenantens supportärenden
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

export default function InboxPage() {
    useDocumentTitle('Inbox')
    const tenant = useSupportTenant()
    const identity = useSupportIdentity()
    const context = useSupportContext()
    const location = useLocation()
    const { '*': path = '' } = useParams()
    const [section, id] = path.split('/')
    const [commands, setCommands] = useState(false)
    const link = (path) =>
        `/inbox/${path}${path.includes('?') ? '&' : '?'}tenant=${encodeURIComponent(tenant || '')}`
    useEffect(() => {
        const listener = (e) => {
            if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
                e.preventDefault()
                setCommands((v) => !v)
            }
            if (e.key === 'Escape') setCommands(false)
        }
        window.addEventListener('keydown', listener)
        return () => window.removeEventListener('keydown', listener)
    }, [])
    const tabs = [
        ['', 'Inbox'],
        ['library', 'Instruktionsfilmer'],
        ['new', 'Skriv meddelande'],
        ...(context.data?.canPublish
            ? [['publish', 'Publicera instruktion']]
            : []),
        ...(context.data?.canManage || context.data?.canSupport
            ? [['manage', 'Supportinställningar']]
            : []),
    ]
    const [commandSearch, setCommandSearch] = useState('')
    const commandResults = useQuery({
        queryKey: ['support', tenant, identity, 'search', commandSearch],
        enabled: commands && commandSearch.trim().length >= 2 && !!context.data,
        queryFn: async () => {
            const search = encodeURIComponent(commandSearch.trim())
            const [inbox, library] = await Promise.all([
                supportRequest(tenant, `inbox/?search=${search}`),
                supportRequest(
                    tenant,
                    `instructions/?search=${search}&archived=true`,
                ),
            ])
            return [
                ...inbox.results
                    .filter((r) => r.threadId)
                    .slice(0, 5)
                    .map((r) => ({
                        id: r.id,
                        title: r.title,
                        path: `threads/${r.threadId}`,
                    })),
                ...library.results.slice(0, 5).map((r) => ({
                    id: r.id,
                    title: r.title,
                    path: `instructions/${r.id}`,
                })),
            ]
        },
    })
    let content
    if (context.data) {
        if (section === 'instructions' && id)
            content = (
                <InstructionDetail id={id} context={context.data} link={link} />
            )
        else if (section === 'threads' && id)
            content = <ThreadDetail key={id} id={id} context={context.data} />
        else if (section === 'library') content = <Library link={link} />
        else if (
            section === 'new' ||
            (section === 'publish' && context.data.canPublish)
        )
            content = (
                <Compose
                    key={`${section}:${location.search}`}
                    context={context.data}
                    link={link}
                    publish={section === 'publish'}
                />
            )
        else if (
            section === 'manage' &&
            (context.data.canManage || context.data.canSupport)
        )
            content = <Manage context={context.data} />
        else content = <InboxList link={link} />
    }
    return (
        <div className="user-tools-shell">
            <UserToolsNav tenant={tenant} unreadCount={context.data?.unreadCount || 0} />
            <main className="user-tools-main user-tools-content" key={`${tenant}:${identity}`}>
                <div className="support-container container mx-auto px-4 py-8">
                    <header className="user-tools-header">
                        <div>
                            <div className="user-tools-title">
                                <Inbox aria-hidden="true" />
                                <h1>Inbox</h1>
                            </div>
                            <p className="user-tools-description">Meddelanden, instruktioner och support för din arbetsyta.</p>
                            {context.data && <p className="support-workspace">Arbetsyta: {context.data.tenant.name}</p>}
                        </div>
                    </header>
                    <div className="user-tools-panel support-panel mail-layout">
                        <nav className="support-tabs" aria-label="Inboxnavigation">
                            {tabs.map(([path, title]) => (
                                <Link
                                    key={path}
                                    to={link(path)}
                                    aria-current={(path === section || (!path && (!section || section === 'threads')) || (path === 'library' && section === 'instructions')) ? 'page' : undefined}
                                >
                                    {path === 'new' && <PenLine size={18} aria-hidden="true" />} {title}
                                    {!path && context.data?.unreadCount
                                        ? ` (${context.data.unreadCount} olästa)`
                                        : ''}
                                </Link>
                            ))}
                            <button
                                aria-expanded={commands}
                                onClick={() => setCommands((v) => !v)}
                            >
                                <Search aria-hidden="true" className="h-4 w-4" />
                                Sök handlingar · ⌘K / Ctrl+K
                            </button>
                        </nav>
                        <div className="support-content">
                            {commands && (
                                <section className="support-command-search" aria-label="Sök handlingar">
                                    <label>
                                        Sök innehåll och handlingar
                                        <input
                                            autoFocus
                                            value={commandSearch}
                                            onChange={(e) =>
                                                setCommandSearch(e.target.value)
                                            }
                                            placeholder="Inbox, instruktionsfilmer, rapportera fel…"
                                        />
                                    </label>
                                    <div className="support-actions">
                                        {tabs
                                            .filter(([, title]) =>
                                                title
                                                    .toLowerCase()
                                                    .includes(commandSearch.toLowerCase()),
                                            )
                                            .map(([path, title]) => (
                                                <Link
                                                    key={path}
                                                    to={link(path)}
                                                    onClick={() => setCommands(false)}
                                                >
                                                    {title}
                                                </Link>
                                            ))}
                                    </div>
                                    <ErrorText error={commandResults.error} />
                                    {commandResults.data?.map((result) => (
                                        <p key={result.id}>
                                            <Link
                                                to={link(result.path)}
                                                onClick={() => setCommands(false)}
                                            >
                                                {result.title}
                                            </Link>
                                        </p>
                                    ))}
                                </section>
                            )}
                            <ErrorText error={context.error} />
                            {context.isPending && <p role="status">Hämtar din inbox…</p>}
                            {content}
                        </div>
                    </div>
                </div>
            </main>
            <StatusBar customStatusContent={<span>Inbox</span>} />
        </div>
    )
}
