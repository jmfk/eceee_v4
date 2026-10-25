import Avatar from '../components/Avatar'
import { Fragment } from 'react'
import { Dialog, DialogBackdrop, DialogPanel, DialogTitle, Popover, PopoverButton, PopoverPanel } from '@headlessui/react'
import { CardActions, ColumnActions } from '../components/kanban/KanbanActions'
import { coverColors } from '../components/kanban/cardPresentation'
import useBoardDrag from '../components/kanban/useBoardDrag'
import { useEffect, useRef, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Link, useNavigate, useParams, useLocation } from 'react-router-dom'
import Navbar from '../components/Navbar'
import UserToolsNav from '../components/UserToolsNav'
import StatusBar from '../components/StatusBar'
import { Columns3, Plus, MoreHorizontal, SlidersHorizontal, ArrowLeft, X, Tag, Clock, ListChecks, Paperclip, AlignLeft, MessageSquare } from 'lucide-react'
import { useDocumentTitle } from '../hooks/useDocumentTitle'
import '../components/user-tools.css'
import { useAuth } from '../contexts/AuthContext'
import GlobalWysiwygToolbar from '../components/wysiwyg/GlobalWysiwygToolbar'
import MarkdownEditor, { MarkdownView } from '../components/kanban/MarkdownEditor'
import { kanbanApi, kanbanError, attachmentUrl, kanbanSocketUrl } from '../api/kanban'
import { getCurrentTenantId, subscribeToCurrentTenantId } from '../utils/tenant'
import '../components/kanban/kanban.css'
import { KanbanAccessContext, useKanbanAccess } from '../components/kanban/AccessContext'

const useTenant = () => {
    const [tenant, setTenant] = useState(getCurrentTenantId)
    useEffect(() => subscribeToCurrentTenantId(setTenant), [])
    return tenant
}

function Attachments({ card, workspace, run }) {
    const ticket = useKanbanAccess()
    const [comment, setComment] = useState('')
    const [uploadError, setUploadError] = useState('')
    const [uploading, setUploading] = useState(false)
    const upload = async (e) => {
        const file = e.target.files[0]
        if (!file) return
        setUploading(true)
        setUploadError('')
        try {
            await kanbanApi.upload(card.id, file, card.revision, comment)
            await run(async () => {})
        } catch (error) {
            setUploadError(kanbanError(error))
        } finally {
            setUploading(false)
            e.target.value = ''
        }
    }
    return (
        <section className="mt-8" aria-label="Bilagor">
            <h2 className="text-xl font-semibold mb-3">Bilagor</h2>
            <p className="kb-muted mb-3">
                Bilder högst 50 MB, dokument/ljud 100 MB, MP4/WebM 500 MB. Filerna är interna tills du importerar en
                kopia.
            </p>
            <label>
                Fäst på{' '}
                <select value={comment} onChange={(e) => setComment(e.target.value)}>
                    <option value="">Kortet</option>
                    {card.comments.map((item) => (
                        <option key={item.id} value={item.id}>
                            Kommentar av {item.author.name}: {item.body.slice(0, 45)}
                        </option>
                    ))}
                </select>
            </label>
            <label className="block my-3">
                {uploading ? 'Laddar upp…' : 'Ladda upp fil, bild eller video'}
                <input
                    type="file"
                    disabled={uploading}
                    accept={Object.keys(workspace.fileTypes || {}).join(',')}
                    onChange={upload}
                />
            </label>
            {uploadError && (
                <p role="alert" className="text-red-600">
                    {uploadError}
                </p>
            )}
            <ul className="space-y-6">
                {card.attachments.map((file) => (
                    <li key={file.id}>
                        <a href={attachmentUrl(file.id, ticket)} target="_blank" rel="noreferrer">
                            {file.filename}
                        </a>
                        <span className="kb-muted ml-3">
                            {(file.size / 1024 / 1024).toFixed(1)} MB {file.comment ? '· Kommentarsbilaga' : ''}
                        </span>
                        {file.contentType.startsWith('image/') && file.contentType !== 'image/svg+xml' && (
                            <img
                                src={attachmentUrl(file.id, ticket)}
                                alt={file.filename}
                                loading="lazy"
                                className="max-h-64 max-w-full mt-2"
                            />
                        )}
                        {file.contentType.startsWith('video/') && (
                            <video
                                controls
                                preload="metadata"
                                className="max-h-80 max-w-full mt-2"
                                src={attachmentUrl(file.id, ticket)}
                            >
                                <a href={attachmentUrl(file.id, ticket)}>Hämta videon</a>
                            </video>
                        )}
                        <div>
                            {file.approvedAt ? (
                                <span>Godkänd</span>
                            ) : (
                                <button
                                    onClick={() =>
                                        run(
                                            async () =>
                                                await kanbanApi.post(`attachments/${file.id}/approve/`, {
                                                    revision: card.revision,
                                                }),
                                        )
                                    }
                                >
                                    Godkänn bilaga
                                </button>
                            )}
                        </div>
                        {file.imports.map((record) => (
                            <p key={record.id} className="kb-muted">
                                Importerad till {record.destination}: {record.destinationLabel}
                            </p>
                        ))}
                        {file.approvedAt && (
                            <p className="kb-muted">
                                Importera via Media Library eller Designer → Importera från Kanban.
                            </p>
                        )}
                        {file.contentType.startsWith('image/') && (
                            <button
                                onClick={() =>
                                    navigator.clipboard?.writeText(`![${file.filename}](${attachmentUrl(file.id)})`)
                                }
                            >
                                Kopiera Markdown-bild
                            </button>
                        )}
                    </li>
                ))}
            </ul>
        </section>
    )
}

const editableSignature = (card) =>
    JSON.stringify([
        card.title,
        card.description,
        card.deadline,
        card.assignees,
        card.labels,
        card.checklist,
        card.externalReferences,
    ])

function CardDetail({ card, workspace, run, busy, reload, error }) {
    const ticket = useKanbanAccess()
    const [draft, setDraft] = useState(card)
    const navigate = useNavigate()
    const baselineRef = useRef(editableSignature(card))
    const draftRef = useRef(draft)
    draftRef.current = draft
    const [section, setSection] = useState('')
    const [editingDescription, setEditingDescription] = useState(false)
    const [commentOpen, setCommentOpen] = useState(false)
    const [pendingClose, setPendingClose] = useState(false)
    const dirty = editableSignature(draft) !== baselineRef.current
    const leave = () => navigate(`/kanban/boards/${card.board}`, { state: { focusCard: card.id } })
    const close = () => {
        if (dirty || body.trim()) setPendingClose(true)
        else leave()
    }
    const reveal = (name) => setSection((previous) => (previous === name ? '' : name))
    useEffect(() => {
        // Apply remote edits only when no local form changes would be lost.
        if (editableSignature(draftRef.current) === baselineRef.current) {
            baselineRef.current = editableSignature(card)
            setDraft(card)
        } else if (editableSignature(card) === baselineRef.current) {
            setDraft((previous) => ({ ...previous, revision: card.revision }))
        }
    }, [card])
    const [body, setBody] = useState('')
    const [editingComment, setEditingComment] = useState(null)
    const [activityFilter, setActivityFilter] = useState('all')
    const [checkText, setCheckText] = useState('')
    const [reference, setReference] = useState({
        system: '',
        issueId: '',
        url: '',
    })
    const [labelName, setLabelName] = useState('')
    const save = async (e) => {
        e.preventDefault()
        await run(async () => {
            const result = await kanbanApi.patch(`cards/${card.id}/`, {
                revision: draft.revision,
                title: draft.title,
                description: draft.description,
                checklist: draft.checklist,
                externalReferences: draft.externalReferences,
                assignees: draft.assignees,
                labels: draft.labels,
                deadline: draft.deadline || null,
            })
            baselineRef.current = editableSignature(result)
            setDraft(result)
            setEditingDescription(false)
            setSection('')
        })
    }
    const toggle = (field, id) =>
        setDraft({
            ...draft,
            [field]: draft[field].includes(id)
                ? draft[field].filter((value) => value !== id)
                : [...draft[field], id],
        })
    const sendComment = async (e) => {
        e.preventDefault()
        await run(async () => {
            if (editingComment)
                await kanbanApi.patch(`comments/${editingComment.id}/`, {
                    body,
                    revision: editingComment.revision,
                })
            else
                await kanbanApi.post(`cards/${card.id}/comments/`, {
                    body,
                    revision: card.revision,
                })
            setBody('')
            setEditingComment(null)
            setCommentOpen(false)
        })
    }
    const timeline = [
        ...card.comments.map((item) => ({ ...item, entryType: 'comment' })),
        ...(activityFilter === 'all'
            ? card.activity.map((item) => ({ ...item, entryType: 'activity' }))
            : []),
    ].sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    return (
        <Dialog open onClose={close} className="kb-detail-dialog">
            <DialogBackdrop className="kb-detail-backdrop" />
            <div className="kb-detail-position">
                <DialogPanel className="kb kb-detail user-tools-content">
                    <DialogTitle className="sr-only">{card.title}</DialogTitle>
                    {card.coverColor && (
                        <div
                            className="kb-detail-cover"
                            style={{ background: coverColors[card.coverColor] }}
                        />
                    )}
                    <header className="kb-detail-header">
                        <label className="kb-detail-destination">
                            <span className="sr-only">Flytta till</span>
                            <select
                                aria-label="Flytta till"
                                value={card.column}
                                disabled={busy}
                                onChange={(e) =>
                                    run(
                                        async () =>
                                            await kanbanApi.patch(`cards/${card.id}/`, {
                                                revision: card.revision,
                                                column: e.target.value,
                                                position: 0,
                                            }),
                                    )
                                }
                            >
                                {workspace.columns
                                    .filter(
                                        (column) =>
                                            !column.archived &&
                                            !workspace.boards.find((board) => board.id === column.board)
                                                ?.archived,
                                    )
                                    .map((column) => (
                                        <option key={column.id} value={column.id}>
                                            {
                                                workspace.boards.find((board) => board.id === column.board)
                                                    ?.title
                                            }{' '}
                                            / {column.title}
                                        </option>
                                    ))}
                            </select>
                        </label>
                        <span className="kb-muted">
                            {card.shortId}
                            {card.archived ? ' · Arkiverat' : ''}
                        </span>
                        <div className="kb-detail-header-actions">
                            <CardActions
                                inDetail
                                card={card}
                                columnCards={[card]}
                                position={0}
                                workspace={workspace}
                                busy={busy}
                                run={run}
                                move={(item, column, position) =>
                                    run(
                                        async () =>
                                            await kanbanApi.patch(`cards/${item.id}/`, {
                                                revision: item.revision,
                                                column,
                                                position,
                                            }),
                                    )
                                }
                            />
                            <button aria-label="Stäng kort" onClick={close}>
                                <X size={18} />
                            </button>
                        </div>
                    </header>
                    {error && (
                        <p role="alert" className="kb-error">
                            {error}
                        </p>
                    )}
                    {pendingClose && (
                        <div className="kb-unsaved" role="status">
                            <span>
                                Du har osparade ändringar. Spara dem i kortet eller kommentaren innan du
                                stänger.
                            </span>
                            <button onClick={() => setPendingClose(false)}>Fortsätt redigera</button>
                            <button onClick={leave}>Stäng utan att spara</button>
                        </div>
                    )}
                    <div className="kb-detail-grid">
                        <div className="kb-detail-main">
                            {card.revision !== draft.revision && (
                                <div className="mb-4" role="status">
                                    Kortet har uppdaterats. Din text är kvar i formuläret.{' '}
                                    <button
                                        onClick={() => {
                                            baselineRef.current = editableSignature(card)
                                            setDraft(card)
                                            reload()
                                        }}
                                    >
                                        Läs in senaste kortet i formuläret
                                    </button>
                                </div>
                            )}
                            <form onSubmit={save} className="kb-detail-form">
                                <label className="kb-detail-title">
                                    <span className="sr-only">Rubrik</span>
                                    <textarea
                                        rows={1}
                                        aria-label="Rubrik"
                                        required
                                        maxLength={250}
                                        value={draft.title}
                                        onChange={(e) => setDraft({ ...draft, title: e.target.value })}
                                    />
                                </label>
                                <div className="kb-detail-tools">
                                    <Popover className="kb-detail-add">
                                        <PopoverButton>
                                            <Plus size={15} />
                                            Lägg till
                                        </PopoverButton>
                                        <PopoverPanel anchor="bottom start" className="kb-action-popup">
                                            {({ close }) => (
                                                <>
                                                    {[
                                                        ['members', 'Medlemmar'],
                                                        ['labels', 'Etiketter'],
                                                        ['dates', 'Datum'],
                                                        ['checklist', 'Checklista'],
                                                        ['attachments', 'Bilaga'],
                                                        ['references', 'Extern koppling'],
                                                    ].map(([name, title]) => (
                                                        <button
                                                            key={name}
                                                            type="button"
                                                            onClick={() => {
                                                                reveal(name)
                                                                close()
                                                            }}
                                                        >
                                                            {title}
                                                        </button>
                                                    ))}
                                                </>
                                            )}
                                        </PopoverPanel>
                                    </Popover>
                                    <button
                                        type="button"
                                        aria-expanded={section === 'labels'}
                                        onClick={() => reveal('labels')}
                                    >
                                        <Tag size={15} />
                                        Etiketter
                                    </button>
                                    <button
                                        type="button"
                                        aria-expanded={section === 'dates'}
                                        onClick={() => reveal('dates')}
                                    >
                                        <Clock size={15} />
                                        Datum
                                    </button>
                                    <button
                                        type="button"
                                        aria-expanded={section === 'checklist'}
                                        onClick={() => reveal('checklist')}
                                    >
                                        <ListChecks size={15} />
                                        Checklista
                                    </button>
                                    <button
                                        type="button"
                                        aria-expanded={section === 'attachments'}
                                        onClick={() => reveal('attachments')}
                                    >
                                        <Paperclip size={15} />
                                        Bilaga
                                    </button>
                                </div>
                                <div className="kb-detail-metadata">
                                    <div>
                                        <h3>Medlemmar</h3>
                                        <div className="kb-detail-members">
                                            {workspace.members
                                                .filter((member) => draft.assignees.includes(member.id))
                                                .map((member) => (
                                                    <Avatar
                                                        key={member.id}
                                                        userId={member.id}
                                                        name={member.name}
                                                    />
                                                ))}
                                            <button
                                                type="button"
                                                aria-label="Ändra medlemmar"
                                                aria-expanded={section === 'members'}
                                                onClick={() => reveal('members')}
                                            >
                                                <Plus size={16} />
                                            </button>
                                        </div>
                                    </div>
                                    {!!draft.labels.length && (
                                        <div>
                                            <h3>Etiketter</h3>
                                            <div className="kb-card-labels">
                                                {workspace.labels
                                                    .filter((label) => draft.labels.includes(label.id))
                                                    .map((label) => (
                                                        <span key={label.id}>{label.name}</span>
                                                    ))}
                                            </div>
                                        </div>
                                    )}
                                    {draft.deadline && (
                                        <div>
                                            <h3>Deadline</h3>
                                            <button type="button" onClick={() => reveal('dates')}>
                                                {new Date(draft.deadline).toLocaleString()}
                                            </button>
                                        </div>
                                    )}
                                </div>
                                {section === 'dates' && (
                                    <div className="kb-detail-field-group">
                                        <label className="block">
                                            Deadline{' '}
                                            <input
                                                type="datetime-local"
                                                value={draft.deadline ? localDate(draft.deadline) : ''}
                                                onChange={(e) =>
                                                    setDraft({
                                                        ...draft,
                                                        deadline: e.target.value
                                                            ? new Date(e.target.value).toISOString()
                                                            : null,
                                                    })
                                                }
                                            />
                                        </label>
                                    </div>
                                )}
                                {section === 'members' && (
                                    <fieldset className="kb-detail-field-group">
                                        <legend className="font-medium mb-2">Ansvariga</legend>
                                        <div className="flex flex-wrap gap-4">
                                            {workspace.members.map((member) => (
                                                <label key={member.id}>
                                                    <input
                                                        type="checkbox"
                                                        checked={draft.assignees.includes(member.id)}
                                                        onChange={() => toggle('assignees', member.id)}
                                                    />{' '}
                                                    {member.name}
                                                </label>
                                            ))}
                                        </div>
                                    </fieldset>
                                )}
                                {section === 'labels' && (
                                    <div className="kb-detail-field-group">
                                        <fieldset>
                                            <legend className="font-medium mb-2">Etiketter</legend>
                                            <div className="flex flex-wrap gap-4">
                                                {workspace.labels.map((label) => (
                                                    <label key={label.id}>
                                                        <input
                                                            type="checkbox"
                                                            checked={draft.labels.includes(label.id)}
                                                            onChange={() => toggle('labels', label.id)}
                                                        />{' '}
                                                        {label.name}
                                                    </label>
                                                ))}
                                            </div>
                                        </fieldset>
                                        <div className="flex gap-2">
                                            <input
                                                aria-label="Ny etikett"
                                                placeholder="Ny etikett"
                                                value={labelName}
                                                onChange={(e) => setLabelName(e.target.value)}
                                            />
                                            <button
                                                type="button"
                                                disabled={!labelName.trim() || busy}
                                                onClick={() =>
                                                    run(async () => {
                                                        await kanbanApi.post('workspace/labels/', {
                                                            name: labelName,
                                                        })
                                                        setLabelName('')
                                                    })
                                                }
                                            >
                                                Skapa etikett
                                            </button>
                                        </div>
                                    </div>
                                )}
                                <section className="kb-detail-description">
                                    <div className="kb-detail-section-heading">
                                        <h2>
                                            <AlignLeft size={18} />
                                            Beskrivning
                                        </h2>
                                        {!editingDescription && <button
                                            type="button"
                                            aria-label="Redigera beskrivning"
                                            onClick={() => setEditingDescription(!editingDescription)}
                                        >
                                            Redigera
                                        </button>}
                                    </div>
                                    {editingDescription ? (
                                        <MarkdownEditor
                                            label="Beskrivning"
                                            value={draft.description}
                                            onChange={(description) => setDraft({ ...draft, description })}
                                            members={workspace.members}
                                            onSave={save}
                                            busy={busy}
                                            onCancel={() => { setDraft((previous) => ({ ...previous, description: card.description })); setEditingDescription(false) }}
                                        />
                                    ) : draft.description ? (
                                        <MarkdownView value={draft.description} />
                                    ) : (
                                        <button
                                            type="button"
                                            className="kb-description-empty"
                                            onClick={() => setEditingDescription(true)}
                                        >
                                            Lägg till en beskrivning…
                                        </button>
                                    )}
                                </section>
                                {(section === 'checklist' || draft.checklist.length > 0) && (
                                    <section>
                                        <h2 className="kb-detail-section-heading">
                                            <ListChecks size={18} />
                                            Checklista
                                        </h2>
                                        {draft.checklist.map((item) => (
                                            <div key={item.id} className="flex gap-3 items-center mb-2">
                                                <input
                                                    aria-label={item.text}
                                                    type="checkbox"
                                                    checked={item.done}
                                                    onChange={() =>
                                                        setDraft({
                                                            ...draft,
                                                            checklist: draft.checklist.map((row) =>
                                                                row.id === item.id
                                                                    ? { ...row, done: !row.done }
                                                                    : row,
                                                            ),
                                                        })
                                                    }
                                                />
                                                <input
                                                    aria-label="Checklisttext"
                                                    value={item.text}
                                                    onChange={(e) =>
                                                        setDraft({
                                                            ...draft,
                                                            checklist: draft.checklist.map((row) =>
                                                                row.id === item.id
                                                                    ? { ...row, text: e.target.value }
                                                                    : row,
                                                            ),
                                                        })
                                                    }
                                                />
                                                <button
                                                    type="button"
                                                    onClick={() =>
                                                        setDraft({
                                                            ...draft,
                                                            checklist: draft.checklist.filter(
                                                                (row) => row.id !== item.id,
                                                            ),
                                                        })
                                                    }
                                                >
                                                    Ta bort punkt
                                                </button>
                                            </div>
                                        ))}
                                        <div className="flex gap-2">
                                            <input
                                                aria-label="Ny checklistpunkt"
                                                value={checkText}
                                                onChange={(e) => setCheckText(e.target.value)}
                                            />
                                            <button
                                                type="button"
                                                disabled={!checkText.trim()}
                                                onClick={() => {
                                                    setDraft({
                                                        ...draft,
                                                        checklist: [
                                                            ...draft.checklist,
                                                            {
                                                                id: crypto.randomUUID(),
                                                                text: checkText,
                                                                done: false,
                                                            },
                                                        ],
                                                    })
                                                    setCheckText('')
                                                }}
                                            >
                                                Lägg till punkt
                                            </button>
                                        </div>
                                    </section>
                                )}
                                {(section === 'references' || draft.externalReferences.length > 0) && (
                                    <section>
                                        <h2 className="font-medium mb-2">Externa kopplingar</h2>
                                        {draft.externalReferences.map((item, index) => (
                                            <div key={`${item.system}-${item.issueId}`}>
                                                <a href={item.url} target="_blank" rel="noreferrer">
                                                    {item.system}: {item.issueId}
                                                </a>{' '}
                                                <button
                                                    type="button"
                                                    onClick={() =>
                                                        setDraft({
                                                            ...draft,
                                                            externalReferences:
                                                                draft.externalReferences.filter(
                                                                    (_, i) => i !== index,
                                                                ),
                                                        })
                                                    }
                                                >
                                                    Ta bort koppling
                                                </button>
                                            </div>
                                        ))}
                                        <div className="flex flex-wrap gap-2">
                                            {[
                                                ['system', 'System'],
                                                ['issueId', 'Issue-ID'],
                                                ['url', 'URL'],
                                            ].map(([key, label]) => (
                                                <input
                                                    key={key}
                                                    type={key === 'url' ? 'url' : 'text'}
                                                    aria-label={label}
                                                    placeholder={label}
                                                    value={reference[key]}
                                                    onChange={(e) =>
                                                        setReference({ ...reference, [key]: e.target.value })
                                                    }
                                                />
                                            ))}
                                            <button
                                                type="button"
                                                disabled={
                                                    !reference.system ||
                                                    !reference.issueId ||
                                                    !/^https?:\/\//.test(reference.url)
                                                }
                                                onClick={() => {
                                                    setDraft({
                                                        ...draft,
                                                        externalReferences: [
                                                            ...draft.externalReferences,
                                                            reference,
                                                        ],
                                                    })
                                                    setReference({ system: '', issueId: '', url: '' })
                                                }}
                                            >
                                                Lägg till koppling
                                            </button>
                                        </div>
                                    </section>
                                )}
                                {!editingDescription && (dirty || (section && section !== 'attachments')) && (
                                    <div className="kb-detail-save">
                                        <button className="user-tools-primary" disabled={busy}>
                                            Spara kort
                                        </button>
                                        {dirty && <span className="kb-muted">Osparade ändringar</span>}
                                    </div>
                                )}
                            </form>
                            {(section === 'attachments' || card.attachments.length > 0) && (
                                <Attachments card={card} workspace={workspace} run={run} />
                            )}
                        </div>
                        <aside aria-label="Kommentarer och aktivitet" className="kb-detail-activity">
                            <h2 className="kb-detail-section-heading">
                                <MessageSquare size={18} />
                                Kommentarer och aktivitet
                            </h2>
                            <div className="flex gap-2 mb-4">
                                <button
                                    aria-pressed={activityFilter === 'comments'}
                                    onClick={() => setActivityFilter('comments')}
                                >
                                    Kommentarer
                                </button>
                                <button
                                    aria-pressed={activityFilter === 'all'}
                                    onClick={() => setActivityFilter('all')}
                                >
                                    All aktivitet
                                </button>
                            </div>
                            {!commentOpen && !editingComment ? (
                                <button className="kb-comment-prompt" onClick={() => setCommentOpen(true)}>
                                    Skriv en kommentar…
                                </button>
                            ) : (
                                <>
                                    <form onSubmit={sendComment} className="kb-detail-comment">
                                        <MarkdownEditor
                                            label={editingComment ? 'Redigera kommentar' : 'Ny kommentar'}
                                            value={body}
                                            onChange={setBody}
                                            members={workspace.members}
                                        />
                                        <button
                                            className="user-tools-primary mt-2"
                                            disabled={busy || !body.trim()}
                                        >
                                            {editingComment ? 'Spara kommentar' : 'Kommentera'}
                                        </button>
                                        {editingComment && (
                                            <button
                                                type="button"
                                                onClick={() => {
                                                    setEditingComment(null)
                                                    setBody('')
                                                }}
                                            >
                                                Avbryt redigering
                                            </button>
                                        )}
                                    </form>{' '}
                                </>
                            )}
                            <ol className="space-y-5 mb-6">
                                {timeline.map((item) => (
                                    <li className="kb-activity-entry" key={`${item.entryType}-${item.id}`}>
                                        <Avatar
                                            userId={
                                                item.entryType === 'comment' ? item.author.id : item.actor.id
                                            }
                                            name={
                                                item.entryType === 'comment'
                                                    ? item.author.name
                                                    : item.actor.name
                                            }
                                        />
                                        <div>
                                            <p className="text-sm kb-muted">
                                                {item.entryType === 'comment'
                                                    ? item.author.name
                                                    : item.actor.name}{' '}
                                                · {new Date(item.createdAt).toLocaleString()}
                                                {item.editedAt && ' · Redigerad'}
                                            </p>
                                            {item.entryType === 'comment' ? (
                                                <>
                                                    <MarkdownView value={item.body} />
                                                    <button
                                                        onClick={() => {
                                                            setEditingComment(item)
                                                            setCommentOpen(true)
                                                            setBody(item.body)
                                                        }}
                                                    >
                                                        Redigera kommentar
                                                    </button>
                                                    {card.attachments
                                                        .filter((file) => file.comment === item.id)
                                                        .map((file) => (
                                                            <p key={file.id}>
                                                                <a href={attachmentUrl(file.id, ticket)}>
                                                                    {file.filename}
                                                                </a>
                                                            </p>
                                                        ))}
                                                </>
                                            ) : (
                                                <>
                                                    <p>{item.message}</p>
                                                    {item.canUndo && (
                                                        <button
                                                            disabled={busy}
                                                            onClick={() =>
                                                                run(
                                                                    async () =>
                                                                        await kanbanApi.post(
                                                                            'workspace/undo/',
                                                                            {
                                                                                activityId: item.id,
                                                                            },
                                                                        ),
                                                                )
                                                            }
                                                        >
                                                            Ångra
                                                        </button>
                                                    )}
                                                </>
                                            )}
                                        </div>
                                    </li>
                                ))}
                            </ol>
                        </aside>
                    </div>
                </DialogPanel>
            </div>
        </Dialog>
    )
}

const localDate = (value) => {
    const date = new Date(value)
    return new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().slice(0, 16)
}

export default function KanbanPage() {
    useDocumentTitle('Kanban')
    const { boardId: routeBoardId, cardId } = useParams()
    const tenant = useTenant()
    const { user } = useAuth()
    const principal = user?.id ?? user?.username
    const canLoad = !!(tenant && principal)
    const navigate = useNavigate()
    const client = useQueryClient()
    const location = useLocation()
    const focusedLocation = useRef(null)
    const [error, setError] = useState('')
    const [busy, setBusy] = useState(false)
    const [query, setQuery] = useState('')
    const [search, setSearch] = useState('')
    const [mine, setMine] = useState(false)
    const [archived, setArchived] = useState('false')
    const [assignee, setAssignee] = useState('')
    const [label, setLabel] = useState('')
    const [deadline, setDeadline] = useState('')
    const [showFilters, setShowFilters] = useState(false)
    const [addingList, setAddingList] = useState(false)
    const [showCreateBoard, setShowCreateBoard] = useState(false)
    const [newBoard, setNewBoard] = useState('')
    const [newColumn, setNewColumn] = useState('')
    const [newCard, setNewCard] = useState('')
    const [createColumn, setCreateColumn] = useState('')
    const [showNotices, setShowNotices] = useState(false)
    const [showActivity, setShowActivity] = useState(false)
    const [rename, setRename] = useState(null)
    const searchRef = useRef(null)
    const workspaceQuery = useQuery({
        queryKey: ['kanban', tenant, principal, 'workspace'],
        queryFn: async () => await kanbanApi.get('workspace/'),
        refetchInterval: 30000,
        enabled: canLoad,
    })
    const workspace = workspaceQuery.data
    const accessQuery = useQuery({
        queryKey: ['kanban-access', tenant, principal],
        queryFn: async () => await kanbanApi.get('workspace/access/'),
        refetchInterval: 300000,
        enabled: canLoad,
    })
    const ticket = accessQuery.data?.ticket || ''
    const cardQuery = useQuery({
        queryKey: ['kanban', tenant, principal, 'card', cardId],
        queryFn: async () => await kanbanApi.get(`cards/${cardId}/`),
        enabled: canLoad && !!cardId,
    })
    const boardId = routeBoardId || cardQuery.data?.board
    const boardDrag = useBoardDrag(`${tenant}:${boardId}`)
    const params = {
        board: boardId || '',
        q: search,
        mine,
        archived,
        assignee,
        label,
        deadline,
    }
    const cardsQuery = useQuery({
        queryKey: ['kanban', tenant, principal, 'cards', params],
        queryFn: async () => await kanbanApi.cards(params),
        enabled: canLoad && !!boardId,
    })
    useEffect(() => {
        if (cardId || !location.state?.focusCard || !cardsQuery.isSuccess || focusedLocation.current === location.key) return
        const frame = requestAnimationFrame(() => {
            const target = document.querySelector(`[data-card-id="${CSS.escape(location.state.focusCard)}"] .kb-card-title`) || document.querySelector('.kb-board-content h1')
            if (target) {
                focusedLocation.current = location.key
                if (target.tagName === 'H1') target.tabIndex = -1
                target.focus()
            }
        })
        return () => cancelAnimationFrame(frame)
    }, [cardId, location.key, location.state, cardsQuery.isSuccess])
    useEffect(() => {
        if (cardId && cardQuery.data?.mirrorOf) navigate(`/kanban/cards/${cardQuery.data.mirrorOf}`, { replace: true })
    }, [cardId, cardQuery.data?.mirrorOf, navigate])
    const activities = useQuery({
        queryKey: ['kanban', tenant, principal, 'activity', boardId],
        queryFn: async () => await kanbanApi.get('workspace/activity/', { board: boardId }),
        enabled: canLoad && showActivity,
    })
    const run = async (action) => {
        if (busy) return
        setBusy(true)
        setError('')
        try {
            await action()
            await client.invalidateQueries({ queryKey: ['kanban', tenant] })
        } catch (err) {
            setError(kanbanError(err))
        } finally {
            setBusy(false)
        }
    }
    useEffect(() => {
        const focusSearch = (e) => {
            if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
                e.preventDefault()
                searchRef.current?.focus()
            }
        }
        window.addEventListener('keydown', focusSearch)
        return () => window.removeEventListener('keydown', focusSearch)
    }, [])
    useEffect(() => {
        if (!workspace?.tenantId || !ticket) return
        let socket,
            timer,
            disposed = false
        const connect = () => {
            socket = new WebSocket(kanbanSocketUrl(workspace.tenantId), ['kanban', ticket])
            socket.onmessage = () => client.invalidateQueries({ queryKey: ['kanban', tenant] })
            socket.onopen = () => client.invalidateQueries({ queryKey: ['kanban', tenant] })
            socket.onclose = (event) => {
                if (!disposed && event.code !== 4403) timer = setTimeout(connect, 5000)
            }
        }
        connect()
        return () => {
            disposed = true
            clearTimeout(timer)
            socket?.close()
        }
    }, [workspace?.tenantId, tenant, client, ticket])
    useEffect(() => {
        setCreateColumn('')
        setNewCard('')
        setNewColumn('')
        setAddingList(false)
        setRename(null)
    }, [boardId, tenant, principal])
    const board = workspace?.boards.find((item) => item.id === boardId)
    const columns = (workspace?.columns || []).filter((item) => item.board === boardId)
    const cards = cardsQuery.data?.results || []
    const visibleColumns = columns.filter((column) => archived === 'all' || archived === 'true' || !column.archived)
    const move = (card, column, position = 0) =>
        run(
            async () =>
                await kanbanApi.patch(`cards/${card.id}/`, {
                    revision: card.revision,
                    column,
                    position,
                }),
        )
    const drop = (e, column, position, beforeCard = false) => {
        try {
            const payload = JSON.parse(e.dataTransfer.getData('application/kanban'))
            if (payload.type !== 'card') return
            e.preventDefault()
            e.stopPropagation()
            const source = cards.find((card) => card.id === payload.id)
            const destination =
                beforeCard && source?.column === column && source.position < position ? position - 1 : position
            move(payload, column, destination)
        } catch {
            /* unrelated drag */
        }
    }
    const reorder = (columnId, targetIndex) =>
        run(async () => {
            const visibleIds = visibleColumns.map((item) => item.id).filter((id) => id !== columnId)
            visibleIds.splice(targetIndex, 0, columnId)
            const ids = columns.map((item) =>
                visibleColumns.some((visible) => visible.id === item.id) ? visibleIds.shift() : item.id,
            )
            return await kanbanApi.post(`boards/${boardId}/reorder-columns/`, {
                revision: board.revision,
                columnIds: ids,
            })
        })
    if (workspaceQuery.isPending || workspaceQuery.error) {
        return (
            <div className="user-tools-shell">
                <Navbar />
                <main className="user-tools-main user-tools-content container mx-auto px-4 py-8">
                    <header className="user-tools-header">
                        <div className="user-tools-title"><Columns3 aria-hidden="true" /><h1>Kanban</h1></div>
                    </header>
                    <div className="user-tools-panel" role={workspaceQuery.error ? 'alert' : 'status'}>
                        {workspaceQuery.error ? (
                            <>
                                <p className="mb-4">{kanbanError(workspaceQuery.error)}</p>
                                <button onClick={() => workspaceQuery.refetch()}>Försök igen</button>
                            </>
                        ) : 'Läser arbetsytan…'}
                    </div>
                </main>
                <StatusBar customStatusContent={<span>Kanban</span>} />
            </div>
        )
    }
    return (
        <KanbanAccessContext.Provider value={ticket}>
            <div className="user-tools-shell">
                <Navbar />
                <GlobalWysiwygToolbar />
                <main className={`kb user-tools-main user-tools-content ${boardId ? 'kb-board-view' : ''}`}>
                    <div className={`kb-content ${boardId ? 'kb-board-content' : 'container mx-auto px-4 py-8'}`}>
                    <UserToolsNav tenant={tenant} />
                    <header className="user-tools-header">
                        <div>
                            <div className="user-tools-title"><Columns3 aria-hidden="true" /><h1>{board?.title || (boardId ? 'Tavla' : 'Dina tavlor')}</h1></div>
                            {!boardId && <p className="user-tools-description">Välj en tavla eller skapa en ny för ditt team.</p>}
                        </div>
                        <div className="flex flex-wrap items-center gap-2">
                        {boardId && <Link to="/kanban" className="user-tools-button"><ArrowLeft size={16} />Byt tavla</Link>}
                        {boardId && <button onClick={() => setShowFilters(!showFilters)} aria-expanded={showFilters}><SlidersHorizontal size={16} />Filter</button>}
                        <button onClick={() => setShowNotices(!showNotices)} aria-expanded={showNotices}>
                            Aviseringar ({workspace.notifications.filter((item) => !item.read).length})
                        </button>
                        <button onClick={() => setShowActivity(!showActivity)} aria-expanded={showActivity}>
                            Aktivitet / Ångra
                        </button>
                        </div>
                    </header>
                    {error && !cardId && (
                        <p role="alert" className="kb-error mb-4">
                            {error}
                        </p>
                    )}
                    {showNotices && (
                        <section aria-label="Aviseringar" className="user-tools-panel mb-6">
                            {!workspace.notifications.length && <p>Inga aviseringar.</p>}
                            {workspace.notifications.map((item) => (
                                <div key={item.id} className="flex flex-wrap gap-3 mb-2">
                                    <Link to={`/kanban/cards/${item.card}`}>{item.message}</Link>
                                    {!item.read && (
                                        <button
                                            onClick={() =>
                                                run(
                                                    async () =>
                                                        await kanbanApi.post('workspace/read-notification/', {
                                                            id: item.id,
                                                        }),
                                                )
                                            }
                                        >
                                            Markera läst
                                        </button>
                                    )}
                                </div>
                            ))}
                        </section>
                    )}
                    {showActivity && (
                        <section aria-label="Aktivitet" className="user-tools-panel mb-6 max-h-64 overflow-auto">
                            {activities.data?.map((item) => (
                                <div key={item.id} className="flex flex-wrap gap-2 mb-2">
                                    <span>
                                        {item.actor.name}: {item.message}
                                    </span>
                                    {item.canUndo && (
                                        <button
                                            onClick={() =>
                                                run(
                                                    async () =>
                                                        await kanbanApi.post('workspace/undo/', {
                                                            activityId: item.id,
                                                        }),
                                                )
                                            }
                                        >
                                            Ångra
                                        </button>
                                    )}
                                </div>
                            ))}
                        </section>
                    )}
                    <>
                            {!boardId && <>
                            <div className="flex items-center justify-between mb-4">
                                <h2 className="text-xl font-semibold">Tavlor</h2>
                                <button className="user-tools-primary" onClick={() => setShowCreateBoard(true)}><Plus size={16} />Skapa tavla</button>
                            </div>
                            <nav aria-label="Tavlor" className="kb-boards">
                                {workspace.boards
                                    .filter((item) => archived !== 'false' || !item.archived)
                                    .map((item) => (
                                        <Link
                                            key={item.id}
                                            aria-current={item.id === boardId ? 'page' : undefined}
                                            to={`/kanban/boards/${item.id}`}
                                            onDragOver={(e) => e.preventDefault()}
                                            onDrop={(e) => {
                                                const column = workspace.columns.find(
                                                    (column) => column.board === item.id && !column.archived,
                                                )
                                                if (column && !item.archived) drop(e, column.id, 0)
                                            }}
                                        >
                                            {item.title}
                                            {item.archived ? ' (arkiverat)' : ''}
                                        </Link>
                                    ))}
                            </nav>
                            {!workspace.boards.some((item) => !item.archived) && <p className="kb-muted mb-4">Här finns inga aktiva tavlor ännu. Skapa din första tavla.</p>}
                            <label className="flex items-center gap-2 mb-4"><input type="checkbox" checked={archived === 'all'} onChange={(e) => setArchived(e.target.checked ? 'all' : 'false')} />Visa arkiverade tavlor</label>
                            {showCreateBoard && <form
                                onSubmit={(e) => {
                                    e.preventDefault()
                                    run(async () => {
                                        const created = await kanbanApi.post('boards/', {
                                            title: newBoard,
                                        })
                                        setNewBoard('')
                                        navigate(`/kanban/boards/${created.id}`)
                                    })
                                }}
                                className="kb-toolbar user-tools-panel"
                            >
                                <input
                                    aria-label="Tavelnamn"
                                    placeholder="Tavelnamn"
                                    value={newBoard}
                                    onChange={(e) => setNewBoard(e.target.value)}
                                    required
                                    maxLength={200}
                                />
                                <button className="user-tools-primary" disabled={busy || !newBoard.trim()}>Skapa tavla</button>
                                <button type="button" onClick={() => setShowCreateBoard(false)}>Avbryt</button>
                            </form>}
                            </>}
                            <form
                                className="kb-toolbar user-tools-panel"
                                hidden={!boardId || !showFilters}
                                onSubmit={(e) => {
                                    e.preventDefault()
                                    setSearch(query)
                                }}
                            >
                                <input
                                    ref={searchRef}
                                    aria-label="Sök kort"
                                    placeholder="Sök kort · ⌘K / Ctrl+K"
                                    value={query}
                                    onChange={(e) => setQuery(e.target.value)}
                                />
                                <button>Sök</button>
                                <label>
                                    <input type="checkbox" checked={mine} onChange={(e) => setMine(e.target.checked)} />{' '}
                                    Mina uppgifter
                                </label>
                                <select
                                    aria-label="Ansvarig"
                                    value={assignee}
                                    onChange={(e) => setAssignee(e.target.value)}
                                >
                                    <option value="">Alla ansvariga</option>
                                    {workspace.members.map((member) => (
                                        <option key={member.id} value={member.id}>
                                            {member.name}
                                        </option>
                                    ))}
                                </select>
                                <select aria-label="Etikett" value={label} onChange={(e) => setLabel(e.target.value)}>
                                    <option value="">Alla etiketter</option>
                                    {workspace.labels.map((item) => (
                                        <option key={item.id} value={item.id}>
                                            {item.name}
                                        </option>
                                    ))}
                                </select>
                                <select
                                    aria-label="Deadlinefilter"
                                    value={deadline}
                                    onChange={(e) => setDeadline(e.target.value)}
                                >
                                    <option value="">Alla deadlines</option>
                                    <option value="overdue">Försenade</option>
                                    <option value="upcoming">Inom sju dagar</option>
                                    <option value="none">Utan deadline</option>
                                </select>
                                <select
                                    aria-label="Arkivfilter"
                                    value={archived}
                                    onChange={(e) => setArchived(e.target.value)}
                                >
                                    <option value="false">Aktiva</option>
                                    <option value="true">Arkiverade kort</option>
                                    <option value="all">Inklusive arkiv</option>
                                </select>
                            </form>
                            {search && (
                                <p className="kb-muted mb-3">
                                    {cardsQuery.data?.semanticAvailable
                                        ? 'Text och semantisk sökning'
                                        : 'Textsökning · semantisk sökning är inte tillgänglig just nu'}
                                </p>
                            )}
                            {cardsQuery.error && <p role="alert">{kanbanError(cardsQuery.error)}</p>}
                            {boardId && !board && <p>Boardet finns inte i den här tenanten.</p>}
                            {board && <div className="kb-board-actions">
                                <span className="kb-muted">{visibleColumns.length} listor · {cards.length} kort{board.archived ? ' · Arkiverad tavla' : ''}</span>
                                <details className="kb-menu"><summary>Medlemmar</summary><div className="kb-menu-items">
                                    {workspace.members.map((member) => <label key={member.id} className="flex items-center gap-2"><input type="checkbox" disabled={busy} checked={board.members?.includes(member.id) || false} onChange={(e) => run(async () => await kanbanApi.post(`boards/${board.id}/members/`, { revision: board.revision, members: e.target.checked ? [...(board.members || []), member.id] : board.members.filter((id) => id !== member.id) }))} /><Avatar userId={member.id} name={member.name} />{member.name}</label>)}
                                </div></details>
                                <details className="kb-menu"><summary aria-label="Tavelåtgärder"><MoreHorizontal size={18} /></summary><div className="kb-menu-items">
                                    <button onClick={() => setRename({ type: 'boards', ...board })}>Byt namn</button>
                                    <button disabled={busy} onClick={() => run(async () => await kanbanApi.patch(`boards/${board.id}/`, { revision: board.revision, archived: !board.archived }))}>{board.archived ? 'Återställ tavla' : 'Arkivera tavla'}</button>
                                </div></details>
                            </div>}
                            {rename && (
                                <form
                                    className="flex gap-2 mb-4"
                                    onSubmit={(e) => {
                                        e.preventDefault()
                                        run(async () => {
                                            await kanbanApi.patch(`${rename.type}/${rename.id}/`, {
                                                revision: rename.revision,
                                                title: rename.title,
                                            })
                                            setRename(null)
                                        })
                                    }}
                                >
                                    <input
                                        aria-label="Nytt namn"
                                        required
                                        value={rename.title}
                                        onChange={(e) => setRename({ ...rename, title: e.target.value })}
                                    />
                                    <button>Spara namn</button>
                                    <button type="button" onClick={() => setRename(null)}>
                                        Avbryt
                                    </button>
                                </form>
                            )}
                            {board ? (
                                <div className="kb-lists" aria-label="Kanban-kolumner" ref={boardDrag.boardRef}
                                    onDrop={(e) => {
                                        const target = boardDrag.targetRef.current
                                        if (!boardDrag.drag || !target) return
                                        e.preventDefault()
                                        e.stopPropagation()
                                        if (boardDrag.drag.type === 'column') {
                                            const sourceIndex = visibleColumns.findIndex((column) => column.id === boardDrag.drag.id)
                                            reorder(boardDrag.drag.id, target.index > sourceIndex ? target.index - 1 : target.index)
                                        } else drop(e, target.column, target.position, !!target.before)
                                        boardDrag.clear()
                                    }}>
                                    {visibleColumns.map((column, index) => (
                                        <Fragment key={column.id}>
                                        {boardDrag.drag?.type === 'column' && boardDrag.target?.index === index && <div className="kb-column-landing" aria-label="Placera lista här" />}
                                        <section
                                            data-column-id={column.id}
                                            className={`kb-column ${boardDrag.drag?.id === column.id ? 'kb-drag-source' : ''}`}
                                        >
                                            <header
                                                draggable
                                                onDragStart={(e) => boardDrag.start(e, { type: 'column', id: column.id })}
                                            >
                                                <h3 className="text-sm font-semibold">
                                                    {column.title}
                                                    {column.archived ? ' (arkiverad)' : ''}
                                                </h3>
                                                <span className="kb-column-count">{cards.filter((card) => card.column === column.id).length}</span>
                                                <ColumnActions column={column} index={index} columns={visibleColumns} board={board} busy={busy} run={run} reorder={reorder} rename={setRename} addCard={setCreateColumn} />
                                            </header>
                                            {cards
                                                .filter((item) => item.column === column.id)
                                                .sort((left, right) => left.position - right.position)
                                                .map((card, position, columnCards) => (
                                                    <Fragment key={card.id}>
                                                    {boardDrag.drag?.type === 'card' && boardDrag.target?.column === column.id && boardDrag.target.before === card.id && <div className="kb-card-landing" style={{ height: boardDrag.drag.height }} aria-label="Placera kort här" />}
                                                    <article
                                                        data-card-id={card.id}
                                                        data-position={card.position}
                                                        className={`kb-card ${boardDrag.drag?.id === card.id ? 'kb-drag-source' : ''}`}
                                                        draggable={!busy}
                                                        onDragStart={(e) => boardDrag.start(e, { type: 'card', id: card.id, revision: card.revision })}
                                                    >
                                                        {card.coverColor && <div className="kb-card-cover" style={{ background: coverColors[card.coverColor] }} />}
                                                        {!!card.labels?.length && <div className="kb-card-labels">{workspace.labels.filter((label) => card.labels.includes(label.id)).map((label) => <span key={label.id}>{label.name}</span>)}</div>}
                                                        <p className="kb-card-id">
                                                            {card.shortId}{card.mirrorOf ? ' · Spegling' : ''}
                                                            {card.archived ? ' · Arkiverat' : ''}
                                                        </p>
                                                        <Link
                                                            className="kb-card-title"
                                                            to={`/kanban/cards/${card.mirrorOf || card.id}`}
                                                        >
                                                            {card.title}
                                                        </Link>
                                                        {card.deadline && (
                                                            <p className="text-sm mt-2">
                                                                {new Date(card.deadline).toLocaleString()}
                                                            </p>
                                                        )}
                                                        <div className="kb-assignees flex justify-end gap-1">{workspace.members.filter((member) => card.assignees.includes(member.id)).map((member) => <Avatar key={member.id} userId={member.id} name={member.name} />)}</div>
                                                        <p className="sr-only">
                                                            {workspace.members
                                                                .filter((member) => card.assignees.includes(member.id))
                                                                .map((member) => member.name)
                                                                .join(', ')}
                                                        </p>
                                                        {card.checklist.length > 0 && (
                                                            <p className="text-sm kb-muted">
                                                                {card.checklist.filter((item) => item.done).length}/
                                                                {card.checklist.length} punkter
                                                            </p>
                                                        )}
                                                        <CardActions card={card} columnCards={columnCards} position={position} workspace={workspace} busy={busy} run={run} move={move} />
                                                    </article>
                                                    </Fragment>
                                                ))}
                                            {boardDrag.drag?.type === 'card' && boardDrag.target?.column === column.id && !boardDrag.target.before && <div className="kb-card-landing" style={{ height: boardDrag.drag.height }} aria-label="Placera kort här" />}
                                            {!board.archived &&
                                                !column.archived &&
                                                (createColumn === column.id ? (
                                                    <form
                                                        onSubmit={(e) => {
                                                            e.preventDefault()
                                                            run(async () => {
                                                                await kanbanApi.post('cards/', {
                                                                    title: newCard,
                                                                    column: column.id,
                                                                })
                                                                setNewCard('')
                                                                setCreateColumn('')
                                                            })
                                                        }}
                                                    >
                                                        <input
                                                            aria-label="Kortrubrik"
                                                            required
                                                            autoFocus
                                                            value={newCard}
                                                            onChange={(e) => setNewCard(e.target.value)}
                                                        />
                                                        <button disabled={busy}>Skapa kort</button>
                                                        <button type="button" onClick={() => setCreateColumn('')}>
                                                            Avbryt
                                                        </button>
                                                    </form>
                                                ) : (
                                                    <button className="kb-add-card" onClick={() => setCreateColumn(column.id)}>
                                                        <Plus size={16} /> Lägg till kort
                                                    </button>
                                                ))}
                                        </section>
                                        </Fragment>
                                    ))}
                                    {boardDrag.drag?.type === 'column' && boardDrag.target?.index === visibleColumns.length && <div className="kb-column-landing" aria-label="Placera lista här" />}
                                    {!board.archived && <div className="kb-add-list">
                                        {addingList ? <form onSubmit={(e) => {
                                            e.preventDefault()
                                            run(async () => {
                                                await kanbanApi.post(`boards/${board.id}/columns/`, { revision: board.revision, title: newColumn })
                                                setNewColumn('')
                                                setAddingList(false)
                                            })
                                        }}>
                                            <input aria-label="Listnamn" placeholder="Ange listnamn" required autoFocus value={newColumn} onChange={(e) => setNewColumn(e.target.value)} />
                                            <div className="flex gap-2 mt-2"><button className="user-tools-primary" disabled={busy || !newColumn.trim()}>Lägg till lista</button><button type="button" aria-label="Avbryt ny lista" onClick={() => setAddingList(false)}><X size={16} /></button></div>
                                        </form> : <button onClick={() => setAddingList(true)}><Plus size={16} />Lägg till lista</button>}
                                    </div>}
                                </div>
                            ) : boardId && cards.length > 0 ? (
                                <ul className="kb-list user-tools-panel">
                                    {cards.map((card) => (
                                        <li key={card.id}>
                                            <Link to={`/kanban/cards/${card.id}`}>
                                                {card.shortId}: {card.title}
                                            </Link>
                                        </li>
                                    ))}
                                </ul>
                            ) : null}
                            {boardId && !cardsQuery.isFetching && !cards.length && showFilters && (
                                <p className="kb-empty user-tools-panel mt-3">
                                    Inga kort i den här vyn. Skapa ett kort i ett board eller ändra filtren.
                                </p>
                            )}
                    </>
                    {cardId && (cardQuery.data ? <CardDetail key={`${tenant}:${principal}:${cardId}`} card={cardQuery.data} workspace={workspace} run={run} busy={busy} reload={() => cardQuery.refetch()} error={error} /> : <p role={cardQuery.error ? 'alert' : 'status'}>{cardQuery.error ? kanbanError(cardQuery.error) : 'Läser kortet…'}</p>)}
                    </div>
                </main>
                <StatusBar customStatusContent={<span>Kanban</span>} />
            </div>
        </KanbanAccessContext.Provider>
    )
}
