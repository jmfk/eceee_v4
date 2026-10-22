import { useEffect, useRef, useState } from 'react'
import {
    Link,
    NavLink,
    useLocation,
    useNavigate,
    useParams,
} from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import Navbar from '../components/Navbar'
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
    new Date(value).toLocaleString('sv-SE', {
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

function PrivatePlayer({ id }) {
    const tenant = useSupportTenant()
    const identity = useSupportIdentity()
    const [attempt, setAttempt] = useState(0)
    const player = useRef(null)
    const resume = useRef({ time: 0, playing: false })
    const renew = () => {
        if (player.current)
            resume.current = {
                time: player.current.currentTime,
                playing: !player.current.paused,
            }
        setAttempt((n) => n + 1)
    }
    const video = useQuery({
        queryKey: ['support', tenant, identity, 'playback', id, attempt],
        queryFn: () => supportRequest(tenant, `videos/${id}/playback/`),
        enabled: !!id,
        staleTime: 0,
        gcTime: 0,
        retry: false,
    })
    if (!id) return null
    return (
        <section aria-label="Video">
            <ErrorText error={video.error} />
            {video.isPending ? (
                <p role="status">Öppnar privat video…</p>
            ) : (
                video.data && (
                    <video
                        ref={player}
                        key={video.data.url}
                        src={video.data.url}
                        onLoadedMetadata={() => {
                            if (!player.current) return
                            player.current.currentTime = resume.current.time
                            if (resume.current.playing)
                                player.current.play().catch(() => {})
                        }}
                        controls
                        preload="metadata"
                        onError={() => {
                            if (attempt < 1) renew()
                        }}
                    />
                )
            )}
            <button onClick={renew}>Förnya uppspelningen</button>
            <p className="support-muted">
                Om länken har löpt ut, förnya uppspelningen. Meddelandet är läst
                när vyn öppnas; det bekräftar inte att filmen är sedd.
            </p>
        </section>
    )
}

function InboxList({ link }) {
    const tenant = useSupportTenant()
    const identity = useSupportIdentity()
    const queryClient = useQueryClient()
    const [filter, setFilter] = useState('all')
    const [page, setPage] = useState(1)
    const [undo, setUndo] = useState(null)
    const query = useQuery({
        queryKey: ['support', tenant, identity, 'inbox', filter, page],
        queryFn: () =>
            supportRequest(
                tenant,
                `inbox/?page=${page}&kind=${filter}&archived=${filter === 'archive'}`,
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
            <h1>Din inbox</h1>
            <p>
                Senaste inkomna aktivitet först. Supporttrådar är privata mellan
                dig och behörig support.
            </p>
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
            {query.data?.results.map((entry) => (
                <article className="support-row" key={entry.id}>
                    <div>
                        <p className="support-muted">
                            {dateText(entry.activityAt)} ·{' '}
                            {entry.kind === 'instruction'
                                ? 'Instruktion'
                                : 'Support'}{' '}
                            {entry.status && `· ${statusText[entry.status]}`}
                        </p>
                        <h2>
                            <Link
                                to={link(
                                    entry.instructionId
                                        ? `instructions/${entry.instructionId}`
                                        : `threads/${entry.threadId}`,
                                )}
                            >
                                {!entry.readAt && <span>Oläst · </span>}
                                {entry.title}
                            </Link>
                        </h2>
                    </div>
                    <button
                        disabled={archive.isPending}
                        onClick={() =>
                            archive.mutate({
                                id: entry.id,
                                archived: !entry.archived,
                            })
                        }
                    >
                        {entry.archived ? 'Återför till inbox' : 'Arkivera'}
                    </button>
                </article>
            ))}
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
            <h1>Instruktionsfilmer</h1>
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
                            {v.archived && ' · Arkiverad'}
                            {v.withdrawn && ' · Avpublicerad'}
                        </p>
                        <h2>
                            <Link to={link(`instructions/${v.id}`)}>
                                {v.title}
                            </Link>
                        </h2>
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
                    <h1>{v.title}</h1>
                    <p>{v.description}</p>
                    <p className="support-muted">
                        {dateText(v.publishedAt)}
                        {v.archived && ' · Arkiverad'}
                        {v.withdrawn && ' · Avpublicerad'}
                    </p>
                    {!v.withdrawn && <PrivatePlayer id={v.videoId} />}
                    {v.transcript && (
                        <section>
                            <h2>Text till filmen</h2>
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

function Compose({ context, link, publish = false }) {
    const tenant = useSupportTenant()
    const navigate = useNavigate()
    const location = useLocation()
    const queryClient = useQueryClient()
    const [kind, setKind] = useState(() =>
        new URLSearchParams(location.search).has('instruction')
            ? 'question'
            : 'bug',
    )
    const [title, setTitle] = useState('')
    const [body, setBody] = useState('')
    const [transcript, setTranscript] = useState('')
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
                publish ? 'Publicerar instruktionen…' : 'Skickar till support…',
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
                          videoId,
                          requestId: requestId.current,
                      }
                    : {
                          title,
                          body,
                          kind,
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
            <h1>
                {publish
                    ? 'Publicera instruktion'
                    : 'Fråga eller rapportera fel'}
            </h1>
            <p>
                {publish
                    ? `Mottagare: ${context.tenant.name} · ${context.recipientCount} andra aktiva medlemmar får en avisering.`
                    : `Privat mellan dig och behörig support i ${context.tenant.name}.`}
            </p>
            {!publish && !context.supportAvailable && (
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
                    }
                    send.mutate()
                }}
                aria-busy={send.isPending}
            >
                <fieldset disabled={send.isPending}>
                    {!publish && (
                        <label>
                            Typ
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
                                required={kind === 'bug'}
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
                    {(publish || kind === 'bug') && (
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
                        className="support-primary"
                        disabled={
                            !valid ||
                            send.isPending ||
                            (publish ? !file : !context.supportAvailable)
                        }
                    >
                        {send.error?.response?.status === 409
                            ? publish
                                ? 'Publicera som ny instruktion'
                                : 'Skicka som nytt ärende'
                            : publish
                              ? `Publicera till ${context.tenant.name}`
                              : 'Skicka till support'}
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
        mutationFn: () =>
            supportRequest(tenant, `threads/${id}/`, 'post', {
                body,
                requestId: requestId.current,
            }),
        onSuccess: () => {
            setBody('')
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
                    <h1>{t.title}</h1>
                    <p>
                        {t.kind === 'bug' ? 'Felrapport' : 'Fråga'} ·{' '}
                        {statusText[t.status]} · Privat supporttråd
                    </p>
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
                            <h2>
                                {message.senderName}{' '}
                                <span className="support-muted">
                                    · {dateText(message.createdAt)}
                                </span>
                            </h2>
                            <p className="support-body">{message.body}</p>
                        </article>
                    ))}
                    <form
                        onSubmit={(e) => {
                            e.preventDefault()
                            if (reply.error?.response?.status === 409)
                                requestId.current = crypto.randomUUID()
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
                        <ErrorText error={reply.error} />
                        <div className="support-actions">
                            <button
                                className="support-primary"
                                disabled={reply.isPending || !body.trim()}
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
            <h1>Supportinställningar</h1>
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
                    <button disabled={!userId || roles.isPending}>
                        Spara behörigheter
                    </button>
                    {roles.isSuccess && (
                        <p role="status">Behörigheterna sparades.</p>
                    )}
                </form>
            )}
            {context.canSupport && (
                <section>
                    <h2>E-post som behöver åtgärdas</h2>
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
                            {deliveryReason[f.errorCode] ||
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
        ['new', 'Fråga eller rapportera fel'],
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
        <div className="support-shell">
            <Navbar />
            <nav className="support-tabs" aria-label="Inboxnavigation">
                {tabs.map(([path, title]) => (
                    <NavLink key={path} to={link(path)} end={path === ''}>
                        {title}
                        {!path && context.data?.unreadCount
                            ? ` (${context.data.unreadCount} olästa)`
                            : ''}
                    </NavLink>
                ))}
                <button
                    aria-expanded={commands}
                    onClick={() => setCommands((v) => !v)}
                >
                    Sök handlingar · ⌘K / Ctrl+K
                </button>
            </nav>
            <main className="support-main" key={`${tenant}:${identity}`}>
                {context.data && (
                    <p className="support-muted">
                        Arbetsyta: {context.data.tenant.name}
                    </p>
                )}
                {commands && (
                    <section aria-label="Sök handlingar">
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
            </main>
        </div>
    )
}
