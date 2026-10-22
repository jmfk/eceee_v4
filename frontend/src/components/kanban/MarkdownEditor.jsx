import { markdownHtml, htmlMarkdown, withAttachmentTickets } from './markdown'
import { useMemo, useState } from 'react'
import { useKanbanAccess } from './AccessContext'
import RichTextInput from '../form-fields/RichTextInput'

export function MarkdownView({ value }) {
    const ticket = useKanbanAccess()
    const html = useMemo(() => withAttachmentTickets(markdownHtml(value), ticket), [value, ticket])
    return (
        <div
            className="prose prose-sm max-w-none break-words"
            dangerouslySetInnerHTML={{ __html: html }}
        />
    )
}

export default function MarkdownEditor({ value, onChange, label = 'Text', members = [] }) {
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
            <div className="flex flex-wrap items-center gap-2 mb-2">
                <span className="font-medium">{label}</span>
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
                    <select aria-label={`Omnämn i ${label}`} value="" onChange={(e) => mention(e.target.value)}>
                        <option value="">@ Omnämn</option>
                        {members.map((member) => (
                            <option key={member.id} value={member.id}>
                                {member.name}
                            </option>
                        ))}
                    </select>
                )}
            </div>
            {mode === 'source' ? (
                <textarea aria-label={label} rows={8} value={value || ''} onChange={(e) => onChange(e.target.value)} />
            ) : (
                <div aria-label={label}>
                    <RichTextInput value={html} onChange={editVisual} />
                </div>
            )}
        </div>
    )
}
