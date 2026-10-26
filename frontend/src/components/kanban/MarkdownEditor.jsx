import { markdownHtml, htmlMarkdown, withAttachmentTickets } from './markdown'
import { useId, useMemo, useRef, useState } from 'react'
import { useKanbanAccess } from './AccessContext'
import RichTextInput from '../form-fields/RichTextInput'
import { attachmentUrl } from '../../api/kanban'

const dropRange = (event, editor) => {
    const range = document.caretRangeFromPoint?.(event.clientX, event.clientY)
    if (range && editor.contains(range.startContainer)) return range
    const position = document.caretPositionFromPoint?.(event.clientX, event.clientY)
    if (position && editor.contains(position.offsetNode)) {
        const fallback = document.createRange()
        fallback.setStart(position.offsetNode, position.offset)
        fallback.collapse(true)
        return fallback
    }
    const fallback = document.createRange()
    fallback.selectNodeContents(editor)
    fallback.collapse(false)
    return fallback
}

const fileMarkdown = (file) => {
    const name = file.filename.replaceAll('\\', '\\\\').replaceAll('[', '\\[').replaceAll(']', '\\]')
    const url = attachmentUrl(file.id)
    return file.contentType.startsWith('image/') && file.contentType !== 'image/svg+xml'
        ? `![${name}](${url})`
        : `[${name}](${url})`
}

const fileNode = (file, ticket) => {
    if (file.contentType.startsWith('image/') && file.contentType !== 'image/svg+xml') {
        const image = document.createElement('img')
        image.src = attachmentUrl(file.id, ticket)
        image.alt = file.filename
        image.referrerPolicy = 'no-referrer'
        return image
    }
    const link = document.createElement('a')
    link.href = attachmentUrl(file.id)
    link.textContent = file.filename
    return link
}

export function MarkdownView({ value }) {
    const ticket = useKanbanAccess()
    const html = useMemo(() => withAttachmentTickets(markdownHtml(value), ticket), [value, ticket])
    return (
        <div className="prose prose-sm max-w-none break-words" dangerouslySetInnerHTML={{ __html: html }} />
    )
}

export default function MarkdownEditor({
    value,
    onChange,
    label = 'Text',
    members = [],
    onSave,
    onCancel,
    busy = false,
    onFileDrop,
    onDropComplete,
}) {
    const [helpOpen, setHelpOpen] = useState(false)
    const helpId = useId()
    const [mode, setMode] = useState('visual')
    const [localEdit, setLocalEdit] = useState(null)
    const visualRef = useRef(null)
    const draggedImage = useRef(null)
    const ticket = useKanbanAccess()
    // Echo the editor's own HTML unchanged to preserve its DOM, caret and undo
    // history. Canonicalize only external Markdown updates or a mode switch.
    const html = useMemo(
        () =>
            localEdit && localEdit.markdown === value && localEdit.ticket === ticket
                ? localEdit.html
                : withAttachmentTickets(markdownHtml(value), ticket),
        [value, ticket, localEdit],
    )
    const editVisual = (content) => {
        const markdown = htmlMarkdown(content)
        setLocalEdit({ markdown, html: content, ticket })
        onChange(markdown)
    }
    const mention = (id) => {
        const member = members.find((item) => String(item.id) === id)
        if (member) onChange(`${value || ''} [@${member.name}](#member-${member.id}) `)
    }
    const onDragStart = (event) => {
        const image = event.target.closest?.('img')
        if (!image || !visualRef.current?.contains(image)) return
        draggedImage.current = image
        const id = image.getAttribute('src')?.match(/^\/api\/v1\/kanban\/attachments\/([a-f0-9-]+)\/download\//)?.[1]
        event.dataTransfer.setData('application/x-kanban-inline-image', JSON.stringify({ id, name: image.alt }))
        event.dataTransfer.effectAllowed = 'copyMove'
    }
    const onDragOver = (event) => {
        if (draggedImage.current || (onFileDrop && Array.from(event.dataTransfer?.types || []).includes('Files'))) {
            event.preventDefault()
            event.dataTransfer.dropEffect = draggedImage.current ? 'move' : 'copy'
        }
    }
    const onDrop = async (event) => {
        const editor = visualRef.current?.querySelector('[contenteditable="true"]')
        if (draggedImage.current) {
            event.preventDefault()
            event.stopPropagation()
            const image = draggedImage.current
            draggedImage.current = null
            if (!editor || !editor.contains(image)) return
            const range = dropRange(event, editor)
            if (image.contains(range.startContainer) || range.startContainer === image) return
            range.insertNode(image)
            editor.dispatchEvent(new Event('input', { bubbles: true }))
            return
        }
        const files = Array.from(event.dataTransfer?.files || [])
        if (!files.length || !onFileDrop) return
        event.preventDefault()
        event.stopPropagation()
        const source = event.target.closest?.('textarea')
        const start = source?.selectionStart
        const marker = editor && !source ? document.createElement('span') : null
        if (marker) {
            marker.dataset.kanbanUpload = 'pending'
            dropRange(event, editor).insertNode(marker)
        }
        try {
            const uploaded = await onFileDrop(files)
            const insert = uploaded.map(fileMarkdown).join('\n\n')
            if (marker?.isConnected && editor) {
                const fragment = document.createDocumentFragment()
                uploaded.forEach((file, index) => {
                    if (index) fragment.append(document.createElement('br'))
                    fragment.append(fileNode(file, ticket))
                })
                marker.replaceWith(fragment)
                editor.dispatchEvent(new Event('input', { bubbles: true }))
            } else if (source && start != null) {
                onChange(`${(value || '').slice(0, start)}${insert}${(value || '').slice(start)}`)
            }
        } finally {
            marker?.remove()
            onDropComplete?.()
        }
    }
    return (
        <div className="kb-editor">
            <div className="kb-editor-frame">
                {mode === 'source' ? (
                    <textarea
                        className="kb-editor-source"
                        aria-label={label}
                        rows={12}
                        value={value || ''}
                        onChange={(e) => onChange(e.target.value)}
                        onDropCapture={onDrop}
                    />
                ) : (
                    <div className="kb-editor-visual" aria-label={label} ref={visualRef}
                        onDragStartCapture={onDragStart} onDragEndCapture={() => { draggedImage.current = null }}
                        onDragOverCapture={onDragOver} onDropCapture={onDrop}>
                        <RichTextInput value={html} onChange={editVisual} rows={10} fieldName={label} allowMediaInsert={false} />
                    </div>
                )}
                <div className="kb-editor-modebar" aria-label={`${label}: redigeringsläge`}>
                    <button type="button" aria-pressed={mode === 'visual'} onClick={() => setMode('visual')}>
                        Visuellt
                    </button>
                    <button
                        type="button"
                        aria-pressed={mode === 'source'}
                        onClick={() => {
                            setLocalEdit(null)
                            setMode('source')
                        }}
                    >
                        Markdown
                    </button>
                    {members.length > 0 && (
                        <select
                            aria-label={`Omnämn i ${label}`}
                            value=""
                            onChange={(e) => mention(e.target.value)}
                        >
                            <option value="">@ Omnämn</option>
                            {members.map((member) => (
                                <option key={member.id} value={member.id}>
                                    {member.name}
                                </option>
                            ))}
                        </select>
                    )}
                </div>
            </div>
            <div className="kb-editor-actions">
                {onSave && (
                    <button type="button" className="user-tools-primary" disabled={busy} onClick={onSave}>
                        Spara
                    </button>
                )}
                {onCancel && (
                    <button type="button" className="kb-editor-cancel" disabled={busy} onClick={onCancel}>
                        Avbryt
                    </button>
                )}
                <button
                    type="button"
                    className="kb-editor-help-button"
                    aria-expanded={helpOpen}
                    aria-controls={helpId}
                    onClick={() => setHelpOpen(!helpOpen)}
                >
                    Formateringshjälp
                </button>
            </div>
            {helpOpen && (
                <div id={helpId} className="kb-editor-help">
                    <strong>Formatering</strong>
                    <p>
                        Markera text och välj format i verktygsraden. Använd ⌘/Ctrl+B för fetstil och ⌘/Ctrl+I
                        för kursiv.
                    </p>
                    <p>
                        I Markdown: <code>**fetstil**</code>, <code>*kursiv*</code>, <code># Rubrik</code>,{' '}
                        <code>- listpunkt</code> och <code>[länktext](https://exempel.se)</code>.
                    </p>
                </div>
            )}
        </div>
    )
}
