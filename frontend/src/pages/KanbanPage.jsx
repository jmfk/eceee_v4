import Avatar from '../components/Avatar'
import { Fragment } from 'react'
import { Dialog, DialogBackdrop, DialogPanel, DialogTitle, Popover, PopoverButton, PopoverPanel } from '@headlessui/react'
import { ActionsMenu, CardActions, ColumnActions } from '../components/kanban/KanbanActions'
import { coverColors } from '../components/kanban/cardPresentation'
import useBoardDrag from '../components/kanban/useBoardDrag'
import { useCallback, useEffect, useRef, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useDropzone } from 'react-dropzone'
import { Link, useBlocker, useNavigate, useParams, useLocation } from 'react-router-dom'
import UserToolsNav from '../components/UserToolsNav'
import StatusBar from '../components/StatusBar'
import { Columns3, Plus, MoreHorizontal, SlidersHorizontal, ArrowLeft, Check, X, Tag, Clock, ListChecks, Paperclip, AlignLeft, MessageSquare, Users, Pencil, Archive } from 'lucide-react'
import { useDocumentTitle } from '../hooks/useDocumentTitle'
import '../components/user-tools.css'
import { useAuth } from '../contexts/AuthContext'
import GlobalWysiwygToolbar from '../components/wysiwyg/GlobalWysiwygToolbar'
import MarkdownEditor, { MarkdownView } from '../components/kanban/MarkdownEditor'
import { fileMarkdown } from '../components/kanban/markdown'
import { kanbanApi, kanbanError, attachmentUrl, kanbanSocketUrl } from '../api/kanban'
import { getCurrentTenantId, subscribeToCurrentTenantId } from '../utils/tenant'
import '../components/kanban/kanban.css'
import { KanbanAccessContext, useKanbanAccess } from '../components/kanban/AccessContext'

const useTenant = () => {
    const [tenant, setTenant] = useState(getCurrentTenantId)
    useEffect(() => subscribeToCurrentTenantId(setTenant), [])
    return tenant
}

export function Attachments({ card, onDelete, busy = false }) {
    const ticket = useKanbanAccess()
    return (
        <section className="kb-attachments mt-8" aria-label="Bilagor">
            <h2 className="text-xl font-semibold mb-3">Bilagor</h2>
            <ul className="kb-attachment-grid">
                {card.attachments.map((file) => (
                    <li key={file.id} className="kb-attachment-card">
                        <a className="kb-attachment-open" href={attachmentUrl(file.id, ticket)} target="_blank" rel="noreferrer"
                            aria-label={file.filename} aria-describedby={`kb-attachment-meta-${file.id}`}>
                            <span className="kb-attachment-thumb" aria-hidden="true">
                                {file.contentType.startsWith('image/') && file.contentType !== 'image/svg+xml'
                                    ? <img src={attachmentUrl(file.id, ticket)} alt={file.filename} loading="lazy" />
                                    : <Paperclip size={22} />}
                            </span>
                            <span className="kb-attachment-info">
                                <span className="kb-attachment-name" title={file.filename}>{file.filename}</span>
                                <span className="kb-attachment-meta" id={`kb-attachment-meta-${file.id}`}>
                                    {(file.size / 1024 / 1024).toFixed(1)} MB{file.comment ? ' · Kommentarsbilaga' : ''}
                                </span>
                            </span>
                        </a>
                        {(file.contentType.startsWith('image/') || onDelete) && (
                            <div className="kb-attachment-toolbar" role="toolbar" aria-label={`Åtgärder för ${file.filename}`}>
                                {file.contentType.startsWith('image/') && (
                                    <button
                                        type="button"
                                        onClick={() =>
                                            navigator.clipboard?.writeText(`![${file.filename}](${attachmentUrl(file.id)})`)
                                        }
                                    >
                                        Kopiera Markdown-bild
                                    </button>
                                )}
                                {onDelete && (
                                    <button
                                        type="button"
                                        className="kb-attachment-delete"
                                        disabled={busy || file.imports?.length > 0}
                                        title={file.imports?.length ? 'Importerade bilagor kan inte tas bort' : undefined}
                                        onClick={() => onDelete(file)}
                                    >
                                        Ta bort bilaga
                                    </button>
                                )}
                            </div>
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

const matchingImageAttachment = async (file, attachments) => {
    if (!file.type.startsWith('image/') || typeof file.arrayBuffer !== 'function') return null
    const candidates = attachments.filter((attachment) =>
        attachment.contentType?.startsWith('image/') && attachment.size === file.size)
    if (!candidates.length) return null
    const bytes = new Uint8Array(await file.arrayBuffer())
    for (const attachment of candidates) {
        try {
            const existing = new Uint8Array(await (await kanbanApi.blob(attachment.id)).arrayBuffer())
            if (existing.length !== bytes.length) continue
            let same = true
            for (let index = 0; index < bytes.length; index += 1) {
                if (bytes[index] !== existing[index]) {
                    same = false
                    break
                }
            }
            if (same) return attachment
        } catch {
            // A failed comparison must not block an otherwise valid upload.
        }
    }
    return null
}

function CardDetail({ card, workspace, run, busy, reload, error }) {
    const ticket = useKanbanAccess()
    const [draft, setDraft] = useState(card)
    const boardMemberIds = workspace.boards.find((board) => board.id === card.board)?.members
    const navigate = useNavigate()
    const baselineRef = useRef(editableSignature(card))
    const draftRef = useRef(draft)
    draftRef.current = draft
    const [section, setSection] = useState('')
    const [memberSearch, setMemberSearch] = useState('')
    const memberButtonRef = useRef(null)
    const [editingDescription, setEditingDescription] = useState(false)
    const [descriptionImageId, setDescriptionImageId] = useState(null)
    const [commentOpen, setCommentOpen] = useState(false)
    const [pendingClose, setPendingClose] = useState(false)
    const [uploadError, setUploadError] = useState('')
    const [uploadNotice, setUploadNotice] = useState('')
    const [uploading, setUploading] = useState(false)
    const upload = async (files, rejected = [], commentId, initialRevision = card.revision) => {
        if (rejected.length) setUploadError('Filformatet stöds inte. Välj en filtyp som är tillåten för bilagor.')
        if (!files.length) return []
        setUploading(true)
        if (!rejected.length) setUploadError('')
        setUploadNotice('')
        let revision = initialRevision
        const uploaded = []
        try {
            for (const [index, file] of files.entries()) {
                const existing = await matchingImageAttachment(file, [...card.attachments, ...uploaded])
                const attachment = existing || (commentId
                    ? await kanbanApi.upload(card.id, file, revision, commentId)
                    : await kanbanApi.upload(card.id, file, revision))
                if (existing || attachment.duplicate) setUploadNotice('En identisk bilaga finns redan på kortet. Ingen ny kopia lades till.')
                uploaded.push(attachment)
                if (index < files.length - 1) revision = (await kanbanApi.get(`cards/${card.id}/`)).revision
            }
        } catch (uploadFailure) {
            setUploadError(kanbanError(uploadFailure))
        } finally {
            setUploading(false)
        }
        return uploaded
    }
    const { getRootProps, getInputProps, open } = useDropzone({
        onDrop: async (files, rejected) => {
            await upload(files, rejected)
            if (files.length) await run(async () => {})
        },
        accept: workspace.fileTypes || undefined,
        disabled: uploading,
        noClick: true,
        noKeyboard: true,
    })
    const dirty = editableSignature(draft) !== baselineRef.current
    const deleteAttachment = (file) => {
        if (!file || !window.confirm(`Ta bort bilagan ”${file.filename}”? Det går inte att ångra. Omslagsbilden kan försvinna och länkar till filen i kortet och kommentarer kan sluta fungera.`)) return false
        return run(async () => {
            await kanbanApi.delete(`attachments/${file.id}/`, { revision: card.revision })
            return true
        })
    }
    const deleteInlineAttachment = (id) => deleteAttachment(card.attachments.find((file) => file.id === id))
    const canDeleteInlineAttachment = (id) => card.attachments.some((file) => file.id === id && !file.imports?.length)
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
    const [commentImageId, setCommentImageId] = useState(null)
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
    const dropCommentFiles = async (event) => {
        const files = Array.from(event.dataTransfer?.files || [])
        let inlineImage = null
        try {
            inlineImage = JSON.parse(event.dataTransfer?.getData('application/x-kanban-inline-image') || 'null')
        } catch {
            inlineImage = null
        }
        if (!/^[a-f0-9-]{36}$/.test(inlineImage?.id || '')) inlineImage = null
        if (!inlineImage && !files.length) return
        event.preventDefault()
        event.stopPropagation()
        const uploaded = inlineImage ? [] : await upload(files)
        if (!inlineImage && !uploaded.length) return
        await run(async () => {
            const current = await kanbanApi.get(`cards/${card.id}/`)
            await kanbanApi.post(`cards/${card.id}/comments/`, {
                body: inlineImage
                    ? fileMarkdown({ id: inlineImage.id, filename: inlineImage.name || 'Bild', contentType: 'image/png' })
                    : uploaded.map(fileMarkdown).join('\n\n'),
                revision: current.revision,
            })
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
                <DialogPanel {...getRootProps({ className: 'kb kb-detail user-tools-content',
                    onDragStartCapture: (event) => {
                        const image = event.target.closest?.('img')
                        const id = image?.getAttribute('src')?.match(/^\/api\/v1\/kanban\/attachments\/([a-f0-9-]+)\/download\//)?.[1]
                        if (id) event.dataTransfer.setData('application/x-kanban-inline-image', JSON.stringify({ id, name: image.alt }))
                    },
                })}>
                    <DialogTitle className="sr-only">{card.title}</DialogTitle>
                    <input {...getInputProps({ 'aria-label': 'Välj bilagor' })} />
                    {card.coverAttachment ? <img className="kb-detail-cover kb-detail-cover-image" src={attachmentUrl(card.coverAttachment, ticket)} alt="" /> : card.coverColor && (
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
                    {uploadError && <p role="alert" className="kb-error">{uploadError}</p>}
                    {uploadNotice && <p role="status" className="kb-upload-notice">{uploadNotice}</p>}
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
                                <div className="kb-detail-heading">
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
                                        <Popover className="kb-member-anchor">
                                            <PopoverButton ref={memberButtonRef} type="button" aria-label="Ändra medlemmar"
                                                onClick={() => setMemberSearch('')}>
                                                <Users size={15} />
                                                Medlemmar
                                            </PopoverButton>
                                            <PopoverPanel anchor="bottom start" className="kb-member-picker">
                                                {({ close }) => {
                                                    const query = memberSearch.trim().toLocaleLowerCase()
                                                    const matches = (member) => `${member.name} ${member.username || ''}`.toLocaleLowerCase().includes(query)
                                                    const selected = workspace.members.filter((member) => draft.assignees.includes(member.id) && matches(member))
                                                    const available = workspace.members.filter((member) =>
                                                        (!boardMemberIds || boardMemberIds.includes(member.id)) &&
                                                        !draft.assignees.includes(member.id) && matches(member))
                                                    return <>
                                                        <div className="kb-member-picker-header">
                                                            <strong>Ändra medlemmar</strong>
                                                            <button type="button" aria-label="Stäng medlemsväljaren" onClick={() => close()}><X size={15} /></button>
                                                        </div>
                                                        <input autoFocus type="search" aria-label="Sök medlem" placeholder="Sök medlem"
                                                            value={memberSearch} onChange={(event) => setMemberSearch(event.target.value)} />
                                                        <div className="kb-member-picker-list">
                                                            <h4>Kortmedlemmar</h4>
                                                            {selected.length ? selected.map((member) => <button type="button" key={member.id}
                                                                aria-label={`Ta bort ${member.name} från kortet`} onClick={() => toggle('assignees', member.id)}>
                                                                <Avatar userId={member.id} name={member.name} size={28} />
                                                                <span>{member.name}</span><X size={15} aria-hidden="true" />
                                                            </button>) : <p>Inga kortmedlemmar</p>}
                                                            <h4>Tavlemedlemmar</h4>
                                                            {available.length ? available.map((member) => <button type="button" key={member.id}
                                                                aria-label={`Lägg till ${member.name} på kortet`} onClick={() => toggle('assignees', member.id)}>
                                                                <Avatar userId={member.id} name={member.name} size={28} />
                                                                <span>{member.name}</span>
                                                            </button>) : <p>Inga fler medlemmar</p>}
                                                        </div>
                                                    </>
                                                }}
                                            </PopoverPanel>
                                        </Popover>
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
                                                            ['references', 'Extern koppling'],
                                                        ].map(([name, title]) => (
                                                            <button
                                                                key={name}
                                                                type="button"
                                                                onClick={() => {
                                                                    if (name === 'members') memberButtonRef.current?.click()
                                                                    else reveal(name)
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
                                        <button type="button" disabled={uploading} onClick={open}>
                                            <Paperclip size={15} />
                                            {uploading ? 'Laddar upp…' : 'Bilaga'}
                                        </button>
                                    </div>
                                </div>
                                {(draft.assignees.length > 0 || draft.labels.length > 0 || draft.deadline) && <div className="kb-detail-metadata">
                                    {draft.assignees.length > 0 && <div>
                                        <h3>Medlemmar</h3>
                                        <div className="kb-detail-members">
                                            {workspace.members
                                                .filter((member) => draft.assignees.includes(member.id))
                                                .map((member) => (
                                                    <Avatar key={member.id} userId={member.id} name={member.name} />
                                                ))}
                                        </div>
                                    </div>}
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
                                </div>}
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
                                            onClick={() => { setDescriptionImageId(null); setEditingDescription(true) }}
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
                                            onFileDrop={(files) => upload(files)}
                                            onDropComplete={() => run(async () => {})}
                                            onDeleteAttachment={deleteInlineAttachment}
                                            canDeleteAttachment={canDeleteInlineAttachment}
                                            initialImageId={descriptionImageId}
                                            onCancel={() => { setDraft((previous) => ({ ...previous, description: card.description })); setEditingDescription(false) }}
                                        />
                                    ) : draft.description ? (
                                        <MarkdownView value={draft.description} onImageClick={(id) => {
                                            setDescriptionImageId(id)
                                            setEditingDescription(true)
                                        }} />
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
                                {!editingDescription && (dirty || section) && (
                                    <div className="kb-detail-save">
                                        <button className="user-tools-primary" disabled={busy}>
                                            Spara kort
                                        </button>
                                        {dirty && <span className="kb-muted">Osparade ändringar</span>}
                                    </div>
                                )}
                            </form>
                            {card.attachments.length > 0 && <Attachments card={card} onDelete={deleteAttachment} busy={busy} />}
                        </div>
                        <aside aria-label="Kommentarer och aktivitet" className="kb-detail-activity"
                            onDragOverCapture={(event) => {
                                const types = Array.from(event.dataTransfer?.types || [])
                                if (types.includes('Files') || types.includes('application/x-kanban-inline-image')) {
                                    event.preventDefault()
                                    event.dataTransfer.dropEffect = 'copy'
                                }
                            }}
                            onDropCapture={dropCommentFiles}>
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
                                <button className="kb-comment-prompt" onClick={() => { setCommentImageId(null); setCommentOpen(true) }}>
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
                                            onDeleteAttachment={deleteInlineAttachment}
                                            canDeleteAttachment={canDeleteInlineAttachment}
                                            initialImageId={commentImageId}
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
                                        <div className="kb-activity-content">
                                            <p className="text-sm kb-muted">
                                                {item.entryType === 'comment'
                                                    ? item.author.name
                                                    : item.actor.name}{' '}
                                                · {new Date(item.createdAt).toLocaleString()}
                                                {item.editedAt && ' · Redigerad'}
                                            </p>
                                            {item.entryType === 'comment' ? (
                                                <>
                                                    <MarkdownView value={item.body} onImageClick={(id) => {
                                                        setEditingComment(item)
                                                        setCommentOpen(true)
                                                        setBody(item.body)
                                                        setCommentImageId(id)
                                                    }} />
                                                    {card.attachments
                                                        .filter((file) => file.comment === item.id)
                                                        .map((file) => (
                                                            <p key={file.id}>
                                                                <a href={attachmentUrl(file.id, ticket)}>
                                                                    {file.filename}
                                                                </a>
                                                            </p>
                                                        ))}
                                                    <div className="kb-activity-actions">
                                                        <button
                                                            type="button"
                                                            onClick={() => {
                                                                setEditingComment(item)
                                                                setCommentOpen(true)
                                                                setBody(item.body)
                                                                setCommentImageId(null)
                                                            }}
                                                        >
                                                            Redigera kommentar
                                                        </button>
                                                    </div>
                                                </>
                                            ) : (
                                                <>
                                                    <p>{item.message}</p>
                                                    {item.canUndo && (
                                                        <div className="kb-activity-actions">
                                                            <button
                                                                type="button"
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
                                                        </div>
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
    const [activityMember, setActivityMember] = useState(null)
    const [rename, setRename] = useState(null)
    const [boardDialog, setBoardDialog] = useState('')
    const [boardTitle, setBoardTitle] = useState('')
    const [backgroundPrompt, setBackgroundPrompt] = useState('')
    const [generatingBackground, setGeneratingBackground] = useState(false)
    const generationAbortRef = useRef(null)
    const handledNavigationRef = useRef(false)
    const navigationBlocker = useBlocker(generatingBackground)
    const [memberSearch, setMemberSearch] = useState('')
    const [boardBackground, setBoardBackground] = useState('')
    const searchRef = useRef(null)
    const filterRef = useRef(null)
    const filterButtonRef = useRef(null)
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
    const availableMembers = useQuery({
        queryKey: ['kanban', tenant, principal, 'available-members', boardId],
        queryFn: async () => await kanbanApi.get(`boards/${boardId}/available-members/`),
        enabled: canLoad && !!boardId && boardDialog === 'members',
    })
    const boardDrag = useBoardDrag(`${tenant}:${boardId}`)
    useEffect(() => {
        if (addingList && boardDrag.boardRef.current) {
            boardDrag.boardRef.current.scrollLeft = boardDrag.boardRef.current.scrollWidth
        }
    }, [addingList, boardDrag.boardRef])
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
            const result = await action()
            await client.invalidateQueries({ queryKey: ['kanban', tenant] })
            return result
        } catch (err) {
            setError(kanbanError(err))
        } finally {
            setBusy(false)
        }
    }
    const cancelBackgroundGeneration = useCallback(() => {
        generationAbortRef.current?.abort()
        generationAbortRef.current = null
        setGeneratingBackground(false)
        setBusy(false)
    }, [])
    const confirmLeaveGeneration = useCallback(() => {
        if (!generatingBackground) return true
        if (!window.confirm('En bakgrundsbild genereras. Om du lämnar nu avbryts väntan på resultatet. Servern kan ändå slutföra bilden. Vill du lämna?')) return false
        cancelBackgroundGeneration()
        return true
    }, [generatingBackground, cancelBackgroundGeneration])
    const closeBoardDialog = () => {
        if (confirmLeaveGeneration()) setBoardDialog('')
    }
    useEffect(() => {
        if (navigationBlocker.state !== 'blocked') {
            handledNavigationRef.current = false
            return
        }
        if (handledNavigationRef.current) return
        handledNavigationRef.current = true
        if (confirmLeaveGeneration()) navigationBlocker.proceed()
        else navigationBlocker.reset()
    }, [navigationBlocker, confirmLeaveGeneration])
    const generateBackground = async (data) => {
        if (busy || generatingBackground) return
        const controller = new AbortController()
        generationAbortRef.current = controller
        setGeneratingBackground(true)
        setBusy(true)
        setError('')
        try {
            await kanbanApi.post(`boards/${boardId}/generate-background/`, data, { signal: controller.signal })
            if (!controller.signal.aborted) await client.invalidateQueries({ queryKey: ['kanban', tenant] })
        } catch (err) {
            if (!controller.signal.aborted) setError(kanbanError(err))
        } finally {
            if (generationAbortRef.current === controller) {
                generationAbortRef.current = null
                setGeneratingBackground(false)
                setBusy(false)
            }
        }
    }
    useEffect(() => {
        if (!generatingBackground) return
        const warn = (e) => {
            e.preventDefault()
            e.returnValue = ''
        }
        window.addEventListener('beforeunload', warn)
        return () => window.removeEventListener('beforeunload', warn)
    }, [generatingBackground])
    useEffect(() => () => {
        generationAbortRef.current?.abort()
        generationAbortRef.current = null
    }, [])
    useEffect(() => {
        const focusSearch = (e) => {
            if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
                e.preventDefault()
                setShowFilters(true)
                requestAnimationFrame(() => searchRef.current?.focus())
            }
        }
        window.addEventListener('keydown', focusSearch)
        return () => window.removeEventListener('keydown', focusSearch)
    }, [])
    useEffect(() => {
        if (!showFilters) return
        searchRef.current?.focus()
        const closeOnOutside = (e) => {
            if (!filterRef.current?.contains(e.target)) setShowFilters(false)
        }
        const closeOnEscape = (e) => {
            if (e.key === 'Escape') {
                setShowFilters(false)
                filterButtonRef.current?.focus()
            }
        }
        document.addEventListener('pointerdown', closeOnOutside)
        document.addEventListener('keydown', closeOnEscape)
        return () => {
            document.removeEventListener('pointerdown', closeOnOutside)
            document.removeEventListener('keydown', closeOnEscape)
        }
    }, [showFilters])
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
        setBoardDialog('')
        setMemberSearch('')
    }, [boardId, tenant, principal])
    const board = workspace?.boards.find((item) => item.id === boardId)
    useEffect(() => {
        if (!board?.hasBackground) return undefined
        let active = true
        let objectUrl = ''
        kanbanApi.background(board.id).then((blob) => {
            if (!active) return
            objectUrl = URL.createObjectURL(blob)
            setBoardBackground(objectUrl)
        }).catch(() => { if (active) setBoardBackground('') })
        return () => {
            active = false
            if (objectUrl) URL.revokeObjectURL(objectUrl)
            setBoardBackground('')
        }
    }, [board?.id, board?.hasBackground, board?.revision])
    const columns = (workspace?.columns || []).filter((item) => item.board === boardId)
    const cards = cardsQuery.data?.results || []
    const activeFilterCount = [search, mine, assignee, label, deadline, archived !== 'false'].filter(Boolean).length
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
    const dropFilesOnCard = (event, card) => {
        const files = Array.from(event.dataTransfer?.files || [])
        if (!files.length) return
        event.preventDefault()
        event.stopPropagation()
        run(async () => {
            const cardId = card.mirrorOf || card.id
            let current = await kanbanApi.get(`cards/${cardId}/`)
            for (const [index, file] of files.entries()) {
                if (!await matchingImageAttachment(file, current.attachments || []))
                    await kanbanApi.upload(cardId, file, current.revision)
                if (index < files.length - 1) current = await kanbanApi.get(`cards/${cardId}/`)
            }
        })
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
                <UserToolsNav tenant={tenant} />
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
            <div className={`user-tools-shell ${boardBackground && board ? 'kb-board-background' : ''}`}
                onClickCapture={(event) => {
                    if (generatingBackground && event.target.closest('.user-tools-logout') && !confirmLeaveGeneration()) {
                        event.preventDefault()
                        event.stopPropagation()
                    }
                }}
                style={boardBackground && board ? { backgroundImage: `linear-gradient(rgb(15 23 42 / 0.1), rgb(15 23 42 / 0.1)), url("${boardBackground}")` } : undefined}>
                <UserToolsNav tenant={tenant} />
                <GlobalWysiwygToolbar />
                <main className={`kb user-tools-main user-tools-content ${boardId ? 'kb-board-view' : ''}`}>
                    <div className={`kb-content ${boardId ? 'kb-board-content' : 'container mx-auto px-4 py-8'}`}>
                    <header className={`user-tools-header ${board ? 'kb-board-header' : ''}`}>
                        <div className={board ? 'kb-board-heading' : undefined}>
                            <div className="user-tools-title"><Columns3 aria-hidden="true" /><h1>{board?.title || (boardId ? 'Tavla' : 'Dina tavlor')}</h1></div>
                            {board && <span className="kb-muted kb-board-summary">{visibleColumns.length} listor · {cards.length} kort{board.archived ? ' · Arkiverad tavla' : ''}</span>}
                            {!boardId && <p className="user-tools-description">Välj en tavla eller skapa en ny för ditt team.</p>}
                        </div>
                        <div className="kb-board-header-controls flex flex-wrap items-center gap-2">
                        {board && !!board.members?.length && <div className="kb-board-members" aria-label="Tavelmedlemmar">
                            {workspace.members.filter((member) => board.members?.includes(member.id)).map((member) => (
                                <Popover key={member.id} className="kb-board-member">
                                    <PopoverButton aria-label={`Visa medlem ${member.name}`} title={member.name}>
                                        <Avatar userId={member.id} name={member.name} size={28} />
                                    </PopoverButton>
                                    <PopoverPanel anchor="bottom end" className="kb-board-member-popup">
                                        {({ close }) => <div className="kb-board-member-content">
                                            <button type="button" className="kb-board-member-close" aria-label="Stäng medlem" onClick={close}><X size={16} /></button>
                                            <div className="kb-board-member-identity">
                                                <Avatar userId={member.id} name={member.name} size={44} />
                                                <div><strong>{member.name}</strong><span>@{member.username}</span></div>
                                            </div>
                                            <p>Medlem på den här tavlan</p>
                                            {member.id === user?.id && <Link to="/profile" onClick={close}>Visa min profil</Link>}
                                            <button type="button" onClick={() => { setActivityMember(member.id); setShowActivity(true); close() }}>Visa aktivitet på tavlan</button>
                                            {workspace.canManageMembers && <button type="button" onClick={() => { setMemberSearch(member.name); setBoardDialog('members'); close() }}>Hantera medlemmar</button>}
                                        </div>}
                                    </PopoverPanel>
                                </Popover>
                            ))}
                        </div>}
                        {boardId && <div className="kb-filter-anchor" ref={filterRef}>
                            <button ref={filterButtonRef} aria-label="Filter" aria-controls="kb-filter-popup" aria-expanded={showFilters} onClick={() => setShowFilters(!showFilters)}>
                                <SlidersHorizontal size={16} />Filter{activeFilterCount > 0 && <span className="kb-filter-count" aria-hidden="true">{activeFilterCount}</span>}
                            </button>
                            {showFilters && <div id="kb-filter-popup" role="dialog" aria-label="Filtrera kort" className="kb-filter-popup">
                                <div className="kb-filter-header"><strong>Filtrera</strong><button type="button" aria-label="Stäng filter" onClick={() => { setShowFilters(false); filterButtonRef.current?.focus() }}><X size={16} /></button></div>
                                <form onSubmit={(e) => { e.preventDefault(); setSearch(query.trim()) }}>
                                    <label className="kb-filter-search-label" htmlFor="kb-filter-search">Sökord</label>
                                    <div className="kb-filter-search"><input id="kb-filter-search" ref={searchRef} aria-label="Sök kort" placeholder="Skriv ett nyckelord…" value={query} onChange={(e) => setQuery(e.target.value)} /><button>Sök</button></div>
                                    <p className="kb-filter-help">Sök efter kortens titel och innehåll.</p>
                                </form>
                                <fieldset className="kb-filter-section">
                                    <legend>Medlemmar</legend>
                                    <label className="kb-filter-choice"><input type="checkbox" checked={mine} onChange={(e) => setMine(e.target.checked)} /><Avatar userId={user?.id} name={user?.name || user?.username || ''} size={22} /> Mina uppgifter</label>
                                    <label className="kb-filter-choice"><input type="radio" name="kb-assignee" checked={!assignee} onChange={() => setAssignee('')} /> Alla medlemmar</label>
                                    {workspace.members.map((member) => <label className="kb-filter-choice" key={member.id}><input type="radio" name="kb-assignee" checked={String(assignee) === String(member.id)} onChange={() => setAssignee(member.id)} /><Avatar userId={member.id} name={member.name} size={22} /> {member.name}</label>)}
                                </fieldset>
                                <fieldset className="kb-filter-section">
                                    <legend>Etiketter</legend>
                                    <label className="kb-filter-choice"><input type="radio" name="kb-label" checked={!label} onChange={() => setLabel('')} /> Alla etiketter</label>
                                    {workspace.labels.map((item) => <label className="kb-filter-choice" key={item.id}><input type="radio" name="kb-label" checked={label === item.id} onChange={() => setLabel(item.id)} /> {item.name}</label>)}
                                </fieldset>
                                <fieldset className="kb-filter-section">
                                    <legend>Förfallodatum</legend>
                                    {[["", "Alla datum"], ["overdue", "Försenade"], ["upcoming", "Inom sju dagar"], ["none", "Utan deadline"]].map(([value, title]) => <label className="kb-filter-choice" key={title}><input type="radio" name="kb-deadline" checked={deadline === value} onChange={() => setDeadline(value)} /> {title}</label>)}
                                </fieldset>
                                <fieldset className="kb-filter-section">
                                    <legend>Kort</legend>
                                    {[["false", "Aktiva"], ["true", "Arkiverade kort"], ["all", "Inklusive arkiv"]].map(([value, title]) => <label className="kb-filter-choice" key={title}><input type="radio" name="kb-archived" checked={archived === value} onChange={() => setArchived(value)} /> {title}</label>)}
                                </fieldset>
                                {activeFilterCount > 0 && <button type="button" className="kb-filter-clear" onClick={() => { setQuery(''); setSearch(''); setMine(false); setAssignee(''); setLabel(''); setDeadline(''); setArchived('false') }}>Rensa filter</button>}
                            </div>}
                        </div>}
                        <button onClick={() => setShowNotices(!showNotices)} aria-expanded={showNotices}>
                            Aviseringar ({workspace.notifications.filter((item) => !item.read).length})
                        </button>
                        <button onClick={() => { setActivityMember(null); setShowActivity(!showActivity) }} aria-expanded={showActivity}>
                            Aktivitet / Ångra
                        </button>
                        {board && <ActionsMenu label="Tavelåtgärder">
                            {(close) => <>
                                <Link to="/kanban" className="kb-menu-link" onClick={close}><ArrowLeft size={15} />Byt tavla</Link>
                                {!board.archived && <button onClick={() => { close(); setAddingList(true) }}><Plus size={15} />Lägg till lista</button>}
                                <button onClick={() => { close(); setBoardDialog('members') }}><Users size={15} />Medlemmar</button>
                                <button onClick={() => { close(); setBoardTitle(board.title); setBoardDialog('edit') }}><Pencil size={15} />Redigera tavlan</button>
                                <button disabled={busy} onClick={() => { close(); run(async () => await kanbanApi.patch(`boards/${board.id}/`, { revision: board.revision, archived: !board.archived })) }}><Archive size={15} />{board.archived ? 'Återställ tavla' : 'Arkivera tavla'}</button>
                            </>}
                        </ActionsMenu>}
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
                            {activityMember && <div className="kb-activity-filter">
                                <span>Aktivitet: {workspace.members.find((member) => member.id === activityMember)?.name}</span>
                                <button type="button" onClick={() => setActivityMember(null)}>Visa alla</button>
                            </div>}
                            {activities.data?.filter((item) => !activityMember || item.actor?.id === activityMember).map((item) => (
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
                            {cardsQuery.error && <p role="alert">{kanbanError(cardsQuery.error)}</p>}
                            {boardId && !board && <p>Boardet finns inte i den här tenanten.</p>}
                            {board && <Dialog open={!!boardDialog} onClose={closeBoardDialog} className="kb-board-dialog">
                                <DialogBackdrop className="kb-board-dialog-backdrop" />
                                <DialogPanel className="kb-board-dialog-panel">
                                    <header><DialogTitle>{boardDialog === 'members' ? 'Medlemmar' : 'Redigera tavlan'}</DialogTitle><button type="button" aria-label="Stäng dialog" onClick={closeBoardDialog}><X size={18} /></button></header>
                                    {boardDialog === 'members' ? <>
                                        <p className="kb-muted">En administratör kan lägga till alla aktiva användare. Inbjudna användare får åtkomst bara till den här tavlan inom Kanban. När de tas bort från sin sista tavla upphör Kanban-åtkomsten. Andra arbetsytemedlemmars åtkomst påverkas inte.</p>
                                        <input aria-label="Sök användare" placeholder="Sök användare" value={memberSearch} onChange={(e) => setMemberSearch(e.target.value)} />
                                        {availableMembers.isPending && <p role="status">Läser användare…</p>}
                                        {availableMembers.error && <p role="alert">{kanbanError(availableMembers.error)}</p>}
                                        <div className="kb-board-member-list">
                                            {(availableMembers.data || []).filter((member) => `${member.name} ${member.username}`.toLocaleLowerCase().includes(memberSearch.toLocaleLowerCase())).map((member) => <label key={member.id}>
                                                <input type="checkbox" disabled={busy || !workspace.canManageMembers} checked={board.members?.includes(member.id) || false} onChange={(e) => run(async () => await kanbanApi.post(`boards/${board.id}/members/`, { revision: board.revision, members: e.target.checked ? [...(board.members || []), member.id] : board.members.filter((id) => id !== member.id) }))} />
                                                <Avatar userId={member.id} name={member.name} /><span>{member.name}</span>
                                            </label>)}
                                        </div>
                                    </> : <form onSubmit={(e) => { e.preventDefault(); run(async () => { await kanbanApi.patch(`boards/${board.id}/`, { revision: board.revision, title: boardTitle.trim() }); setBoardDialog('') }) }}>
                                        <label htmlFor="kb-board-title">Tavelnamn</label>
                                        <input id="kb-board-title" autoFocus value={boardTitle} onChange={(e) => setBoardTitle(e.target.value)} maxLength={200} required />
                                        <div className="kb-board-upload">
                                            <label htmlFor="kb-board-background">Ladda upp bakgrundsbild</label>
                                            {boardBackground && <img className="kb-board-background-preview" src={boardBackground} alt="Aktuell bakgrundsbild" />}
                                            <input id="kb-board-background" type="file" accept="image/jpeg,image/png,image/gif,image/webp" aria-describedby="kb-board-upload-help" disabled={busy} onChange={(e) => {
                                                const file = e.target.files?.[0]
                                                if (file) run(async () => await kanbanApi.uploadBackground(board.id, file, board.revision))
                                                e.target.value = ''
                                            }} />
                                            <p id="kb-board-upload-help">JPG, PNG, GIF eller WebP · bilden laddas upp direkt.</p>
                                        </div>
                                        {workspace.canGenerateImages && <div className="kb-image-generator">
                                            <label htmlFor="kb-background-prompt">Beskriv bakgrundsbilden</label>
                                            <textarea id="kb-background-prompt" value={backgroundPrompt} onChange={(e) => setBackgroundPrompt(e.target.value)} maxLength={4000} disabled={generatingBackground} placeholder="Till exempel kustlandskap med starka färger" />
                                            <button type="button" disabled={busy || !backgroundPrompt.trim()} onClick={() => generateBackground({ revision: board.revision, prompt: backgroundPrompt })}>Generera från beskrivning</button>
                                            <button type="button" disabled={busy} onClick={() => generateBackground({ revision: board.revision, fromContent: true })}>Generera från tavlans innehåll</button>
                                            {generatingBackground && <div className="kb-generation-status" role="status" aria-live="polite">
                                                <span>Genererar bakgrundsbild… Det kan ta någon minut.</span>
                                                <div className="kb-generation-track" aria-hidden="true"><span /></div>
                                                <small>Stanna kvar i den här vyn tills bilden är klar.</small>
                                            </div>}
                                        </div>}
                                        {board.hasBackground && <button type="button" disabled={busy} onClick={() => run(async () => await kanbanApi.delete(`boards/${board.id}/background/`, { revision: board.revision }))}>Ta bort bakgrundsbild</button>}
                                        {error && <p role="alert">{error}</p>}
                                        <div className="kb-board-dialog-actions"><button type="button" onClick={closeBoardDialog}>Avbryt</button><button className="user-tools-primary" disabled={busy || !boardTitle.trim()}>Spara</button></div>
                                    </form>}
                                </DialogPanel>
                            </Dialog>}
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
                                                draggable={rename?.id !== column.id}
                                                onDragStart={(e) => boardDrag.start(e, { type: 'column', id: column.id })}
                                            >
                                                {rename?.id === column.id ? (
                                                    <form className="kb-column-rename" onSubmit={(e) => {
                                                        e.preventDefault()
                                                        run(async () => {
                                                            await kanbanApi.patch(`columns/${column.id}/`, {
                                                                revision: rename.revision,
                                                                title: rename.title.trim(),
                                                            })
                                                            setRename(null)
                                                        })
                                                    }}>
                                                        <input
                                                            aria-label={`Listnamn för ${column.title}`}
                                                            autoFocus
                                                            required
                                                            maxLength={200}
                                                            value={rename.title}
                                                            onFocus={(e) => e.target.select()}
                                                            onChange={(e) => setRename({ ...rename, title: e.target.value })}
                                                            onKeyDown={(e) => {
                                                                if (e.key === 'Escape') {
                                                                    e.stopPropagation()
                                                                    setRename(null)
                                                                }
                                                            }}
                                                        />
                                                        <button type="submit" aria-label="Spara listnamn" title="Spara" disabled={busy || !rename.title.trim()}><Check size={16} /></button>
                                                        <button type="button" aria-label="Avbryt namnändring" title="Avbryt" onClick={() => setRename(null)}><X size={16} /></button>
                                                    </form>
                                                ) : <>
                                                    <h3 className="text-sm font-semibold">
                                                        {column.title}
                                                        {column.archived ? ' (arkiverad)' : ''}
                                                    </h3>
                                                    <span className="kb-column-count">{cards.filter((card) => card.column === column.id).length}</span>
                                                    <ColumnActions column={column} index={index} columns={visibleColumns} board={board} busy={busy} run={run} reorder={reorder} rename={setRename} addCard={setCreateColumn} />
                                                </>}
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
                                                        onDragOver={(e) => {
                                                            if (Array.from(e.dataTransfer?.types || []).includes('Files')) {
                                                                e.preventDefault()
                                                                e.stopPropagation()
                                                                e.dataTransfer.dropEffect = 'copy'
                                                            }
                                                        }}
                                                        onDrop={(e) => dropFilesOnCard(e, card)}
                                                    >
                                                        {card.coverAttachment ? <img className="kb-card-cover kb-card-cover-image" src={attachmentUrl(card.coverAttachment, ticket)} alt="" loading="lazy" /> : card.coverColor && <div className="kb-card-cover" style={{ background: coverColors[card.coverColor] }} />}
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
                                                        className="kb-card-composer"
                                                        onSubmit={(e) => {
                                                            e.preventDefault()
                                                            if (!newCard.trim()) return
                                                            run(async () => {
                                                                await kanbanApi.post('cards/', {
                                                                    title: newCard.trim(),
                                                                    column: column.id,
                                                                })
                                                                setNewCard('')
                                                                setCreateColumn('')
                                                            })
                                                        }}
                                                    >
                                                        <textarea
                                                            aria-label="Kortrubrik"
                                                            placeholder="Ange en titel eller klistra in en länk"
                                                            required
                                                            autoFocus
                                                            rows={2}
                                                            value={newCard}
                                                            onChange={(e) => setNewCard(e.target.value)}
                                                            onKeyDown={(e) => {
                                                                if (e.key === 'Escape') {
                                                                    setNewCard('')
                                                                    setCreateColumn('')
                                                                } else if (e.key === 'Enter' && !e.shiftKey) {
                                                                    e.preventDefault()
                                                                    e.currentTarget.form?.requestSubmit()
                                                                }
                                                            }}
                                                        />
                                                        <div className="kb-card-composer-actions">
                                                            <button className="user-tools-primary" disabled={busy || !newCard.trim()}>Lägg till kort</button>
                                                            <button type="button" className="kb-card-composer-close" aria-label="Avbryt nytt kort" onClick={() => { setNewCard(''); setCreateColumn('') }}>
                                                                <X size={16} />
                                                            </button>
                                                        </div>
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
                                    {!board.archived && addingList && <div className="kb-add-list">
                                        <form onSubmit={(e) => {
                                            e.preventDefault()
                                            run(async () => {
                                                await kanbanApi.post(`boards/${board.id}/columns/`, { revision: board.revision, title: newColumn })
                                                setNewColumn('')
                                                setAddingList(false)
                                            })
                                        }}>
                                            <input aria-label="Listnamn" placeholder="Ange listnamn" required autoFocus value={newColumn} onChange={(e) => setNewColumn(e.target.value)} />
                                            <div className="flex gap-2 mt-2"><button className="user-tools-primary" disabled={busy || !newColumn.trim()}>Lägg till lista</button><button type="button" aria-label="Avbryt ny lista" onClick={() => setAddingList(false)}><X size={16} /></button></div>
                                        </form>
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
                            {boardId && !cardsQuery.isFetching && !cards.length && activeFilterCount > 0 && (
                                <p className="kb-empty user-tools-panel mt-3">
                                    Inga kort i den här vyn. Skapa ett kort i ett board eller ändra filtren.
                                </p>
                            )}
                    </>
                    {cardId && (cardQuery.data ? <CardDetail key={`${tenant}:${principal}:${cardId}`} card={cardQuery.data} workspace={workspace} run={run} busy={busy} reload={() => cardQuery.refetch()} error={error} /> : <p role={cardQuery.error ? 'alert' : 'status'}>{cardQuery.error ? kanbanError(cardQuery.error) : 'Läser kortet…'}</p>)}
                    </div>
                </main>
                <StatusBar className={boardBackground && board ? 'kb-board-status' : ''} customStatusContent={<span>Kanban</span>} />
            </div>
        </KanbanAccessContext.Provider>
    )
}
