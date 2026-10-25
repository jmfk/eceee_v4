import { markdownHtml, htmlMarkdown, withAttachmentTickets } from './markdown'
import { useId, useMemo, useState } from 'react'
import { useKanbanAccess } from './AccessContext'
import RichTextInput from '../form-fields/RichTextInput'

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
}) {
    const [helpOpen, setHelpOpen] = useState(false)
    const helpId = useId()
    const [mode, setMode] = useState('visual')
    const [localEdit, setLocalEdit] = useState(null)
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
                    />
                ) : (
                    <div className="kb-editor-visual" aria-label={label}>
                        <RichTextInput value={html} onChange={editVisual} rows={10} fieldName={label} />
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
