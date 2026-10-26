import { markdownHtml, htmlMarkdown, withAttachmentTickets, fileMarkdown } from './markdown'
import { useEffect, useId, useMemo, useRef, useState } from 'react'
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

const fileNode = (file, ticket) => {
    if (file.contentType.startsWith('image/') && file.contentType !== 'image/svg+xml') {
        const image = document.createElement('img')
        image.src = attachmentUrl(file.id, ticket)
        image.alt = file.filename
        return image
    }
    const link = document.createElement('a')
    link.href = attachmentUrl(file.id, ticket)
    link.textContent = file.filename
    return link
}

export function MarkdownView({ value, onImageClick }) {
    const ticket = useKanbanAccess()
    const html = useMemo(() => {
        const content = withAttachmentTickets(markdownHtml(value), ticket)
        if (!onImageClick) return content
        const root = document.createElement('div')
        root.innerHTML = content
        root.querySelectorAll('img').forEach((image) => {
            if (!/^\/api\/v1\/kanban\/attachments\/[a-f0-9-]+\/download\//.test(image.getAttribute('src') || '')) return
            image.tabIndex = 0
            image.setAttribute('role', 'button')
            image.setAttribute('aria-label', `Redigera bild ${image.alt || ''}`.trim())
        })
        return root.innerHTML
    }, [value, ticket, onImageClick])
    const openImage = (event) => {
        const image = event.target.closest?.('img')
        const id = image?.getAttribute('src')?.match(/^\/api\/v1\/kanban\/attachments\/([a-f0-9-]+)\/download\//)?.[1]
        if (id) onImageClick?.(id)
    }
    return (
        <div className="prose prose-sm max-w-none break-words" onClick={onImageClick ? openImage : undefined}
            onKeyDown={onImageClick ? (event) => {
                if (event.target.tagName === 'IMG' && (event.key === 'Enter' || event.key === ' ')) {
                    event.preventDefault()
                    openImage(event)
                }
            } : undefined} dangerouslySetInnerHTML={{ __html: html }} />
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
    onDeleteAttachment,
    canDeleteAttachment,
    initialImageId,
}) {
    const [helpOpen, setHelpOpen] = useState(false)
    const helpId = useId()
    const [mode, setMode] = useState('visual')
    const [localEdit, setLocalEdit] = useState(null)
    const [selectedImage, setSelectedImage] = useState(null)
    const [imageMenuPosition, setImageMenuPosition] = useState({ top: 0, left: 0 })
    const visualRef = useRef(null)
    const latestValue = useRef(value || '')
    latestValue.current = value || ''
    const draggedImage = useRef(null)
    const imagePickerRef = useRef(null)
    const pickerRange = useRef(null)
    const ticket = useKanbanAccess()
    const imageId = selectedImage?.getAttribute('src')?.match(/^\/api\/v1\/kanban\/attachments\/([a-f0-9-]+)\/download\//)?.[1]
    const imageWidth = Number(selectedImage?.getAttribute('data-width')) || 100
    const imageFloat = selectedImage?.getAttribute('data-image-style') || ''
    const imageAlign = selectedImage?.getAttribute('data-align') || ''
    const selectImage = (image) => {
        selectedImage?.classList.remove('kb-image-selected')
        if (!image) {
            setSelectedImage(null)
            return
        }
        image.classList.add('kb-image-selected')
        const bounds = image.getBoundingClientRect()
        const container = visualRef.current.getBoundingClientRect()
        setImageMenuPosition({
            top: bounds.bottom - container.top + 6,
            left: Math.max(8, Math.min(bounds.left - container.left, visualRef.current.clientWidth - 328)),
        })
        setSelectedImage(image)
    }
    useEffect(() => {
        if (!initialImageId || mode !== 'visual') return
        const image = visualRef.current?.querySelector(`img[src^="/api/v1/kanban/attachments/${initialImageId}/download/"]`)
        if (image) selectImage(image)
    // Select only when a read-only image first opens this editor.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [initialImageId, mode])
    useEffect(() => {
        if (!selectedImage) return
        const dismiss = (event) => {
            if (event.key === 'Escape') selectImage(null)
        }
        document.addEventListener('keydown', dismiss)
        return () => document.removeEventListener('keydown', dismiss)
    // Selection is tied to the current DOM image.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [selectedImage])
    // Echo the editor's own HTML unchanged to preserve its DOM, caret and undo
    // history. Canonicalize only external Markdown updates or a mode switch.
    const html = useMemo(
        () =>
            localEdit && localEdit.markdown === value && localEdit.ticket === ticket
                ? localEdit.html
                : withAttachmentTickets(markdownHtml(value), ticket, true),
        [value, ticket, localEdit],
    )
    const editVisual = (content) => {
        const markdown = htmlMarkdown(content)
        setLocalEdit({ markdown, html: content, ticket })
        onChange(markdown)
    }
    const updateImage = (attribute, value) => {
        if (!selectedImage?.isConnected) return
        if (value && attribute === 'data-image-style') selectedImage.removeAttribute('data-align')
        if (value && attribute === 'data-align') selectedImage.removeAttribute('data-image-style')
        if (value) selectedImage.setAttribute(attribute, value)
        else selectedImage.removeAttribute(attribute)
        visualRef.current?.querySelector('[contenteditable="true"]')?.dispatchEvent(new Event('input', { bubbles: true }))
        selectImage(selectedImage)
    }
    const removeImage = async (keepAttachment) => {
        if (!selectedImage?.isConnected) return
        if (!keepAttachment && (!imageId || !await onDeleteAttachment?.(imageId))) return
        const editor = visualRef.current?.querySelector('[contenteditable="true"]')
        selectedImage.remove()
        selectImage(null)
        editor?.dispatchEvent(new Event('input', { bubbles: true }))
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
        const types = Array.from(event.dataTransfer?.types || [])
        if (draggedImage.current || types.includes('application/x-kanban-inline-image') || (onFileDrop && types.includes('Files'))) {
            event.preventDefault()
            event.dataTransfer.dropEffect = draggedImage.current ? 'move' : 'copy'
        }
    }
    const insertFiles = async (files, range, source, start) => {
        const editor = visualRef.current?.querySelector('[contenteditable="true"]')
        const marker = editor && !source ? document.createElement('span') : null
        if (marker) {
            marker.dataset.kanbanUpload = 'pending'
            const insertionRange = range && editor.contains(range.startContainer) ? range : document.createRange()
            if (insertionRange !== range) {
                insertionRange.selectNodeContents(editor)
                insertionRange.collapse(false)
            }
            insertionRange.insertNode(marker)
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
            } else if (source && start != null && uploaded.length) {
                const current = latestValue.current
                const next = `${current.slice(0, start)}${insert}${current.slice(start)}`
                latestValue.current = next
                onChange(next)
            }
        } finally {
            marker?.remove()
            onDropComplete?.()
        }
    }
    const openImagePicker = () => {
        const editor = visualRef.current?.querySelector('[contenteditable="true"]')
        if (!editor) return
        const selection = window.getSelection()
        if (selection?.rangeCount && editor.contains(selection.getRangeAt(0).startContainer)) {
            pickerRange.current = selection.getRangeAt(0).cloneRange()
        } else {
            pickerRange.current = document.createRange()
            pickerRange.current.selectNodeContents(editor)
            pickerRange.current.collapse(false)
        }
        imagePickerRef.current?.click()
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
        let existingImage
        try {
            existingImage = JSON.parse(event.dataTransfer?.getData('application/x-kanban-inline-image') || 'null')
        } catch {
            existingImage = null
        }
        if (/^[a-f0-9-]{36}$/.test(existingImage?.id || '')) {
            event.preventDefault()
            event.stopPropagation()
            const file = { id: existingImage.id, filename: existingImage.name || 'Bild', contentType: 'image/png' }
            const source = event.target.closest?.('textarea')
            if (source) {
                const start = source.selectionStart
                const current = latestValue.current
                const next = `${current.slice(0, start)}${fileMarkdown(file)}${current.slice(start)}`
                latestValue.current = next
                onChange(next)
            } else if (editor) {
                dropRange(event, editor).insertNode(fileNode(file, ticket))
                editor.dispatchEvent(new Event('input', { bubbles: true }))
            }
            return
        }
        const files = Array.from(event.dataTransfer?.files || [])
        if (!files.length || !onFileDrop) return
        event.preventDefault()
        event.stopPropagation()
        const source = event.target.closest?.('textarea')
        const start = source?.selectionStart
        await insertFiles(files, editor && !source ? dropRange(event, editor) : null, source, start)
    }
    return (
        <div className="kb-editor">
            {onFileDrop && <input ref={imagePickerRef} type="file" accept="image/jpeg,image/png,image/gif,image/webp"
                multiple className="sr-only" aria-label={`Ladda upp bild i ${label}`}
                onChange={async (event) => {
                    const files = Array.from(event.target.files || [])
                    event.target.value = ''
                    if (files.length) await insertFiles(files, pickerRange.current)
                }} />}
            <div className="kb-editor-frame">
                {mode === 'source' ? (
                    <textarea
                        className="kb-editor-source"
                        aria-label={label}
                        rows={12}
                        value={value || ''}
                        onChange={(e) => { latestValue.current = e.target.value; onChange(e.target.value) }}
                        onDropCapture={onDrop}
                    />
                ) : (
                    <div className="kb-editor-visual" aria-label={label} ref={visualRef}
                        onClickCapture={(event) => {
                            if (event.target.closest?.('.kb-image-menu')) return
                            const image = event.target.closest?.('img')
                            selectImage(image && visualRef.current.contains(image) ? image : null)
                        }}
                        onContextMenuCapture={(event) => {
                            const image = event.target.closest?.('img')
                            if (!image || !visualRef.current.contains(image)) return
                            event.preventDefault()
                            event.stopPropagation()
                            selectImage(image)
                        }}
                        onDragStartCapture={onDragStart} onDragEndCapture={() => { draggedImage.current = null }}
                        onDragOverCapture={onDragOver} onDropCapture={onDrop}>
                        <RichTextInput value={html} onChange={editVisual} rows={10} fieldName={label}
                            allowMediaInsert={false} onImageUpload={onFileDrop ? openImagePicker : undefined} />
                        {selectedImage?.isConnected && <div className="kb-image-menu" role="toolbar" aria-label={`Bildinställningar för ${selectedImage.alt || 'bild'}`}
                            style={imageMenuPosition}>
                            <div className="kb-image-menu-row">
                                <span id={`${helpId}-image-size`}>Storlek</span>
                                <div className="kb-image-menu-segments" role="group" aria-labelledby={`${helpId}-image-size`}>
                                    <button type="button" aria-label="Minska" disabled={imageWidth <= 25}
                                        onClick={() => updateImage('data-width', String(Math.max(25, imageWidth - 25)))}>−</button>
                                    <output aria-live="polite">{imageWidth} %</output>
                                    <button type="button" aria-label="Öka" disabled={imageWidth >= 100}
                                        onClick={() => updateImage('data-width', String(Math.min(100, imageWidth + 25)))}>+</button>
                                </div>
                            </div>
                            <div className="kb-image-menu-row">
                                <span id={`${helpId}-image-float`}>Textflöde</span>
                                <div className="kb-image-menu-segments" role="group" aria-labelledby={`${helpId}-image-float`}>
                                    {[[ '', 'Inget' ], [ 'float-left', 'Vänster' ], [ 'float-right', 'Höger' ]].map(([value, title]) => (
                                        <button key={title} type="button" aria-pressed={imageFloat === value}
                                            onClick={() => updateImage('data-image-style', value)}>{title}</button>
                                    ))}
                                </div>
                            </div>
                            <div className="kb-image-menu-row">
                                <span id={`${helpId}-image-align`}>Justering</span>
                                <div className="kb-image-menu-segments" role="group" aria-labelledby={`${helpId}-image-align`}>
                                    {[[ '', 'Auto' ], [ 'left', 'Vänster' ], [ 'center', 'Mitten' ], [ 'right', 'Höger' ]].map(([value, title]) => (
                                        <button key={title} type="button" aria-pressed={imageAlign === value}
                                            onClick={() => updateImage('data-align', value)}>{title}</button>
                                    ))}
                                </div>
                            </div>
                            <div className="kb-image-menu-footer">
                                <button type="button" onClick={() => removeImage(true)}>Ta bort ur texten</button>
                                <button type="button" className="kb-image-delete" disabled={!imageId || !onDeleteAttachment || canDeleteAttachment?.(imageId) === false || busy}
                                    onClick={() => removeImage(false)}>Ta bort bilaga</button>
                            </div>
                        </div>}
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
                            selectImage(null)
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
