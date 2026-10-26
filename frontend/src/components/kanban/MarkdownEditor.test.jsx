import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import MarkdownEditor, { MarkdownView } from './MarkdownEditor'
import { htmlMarkdown, markdownHtml, withAttachmentTickets } from './markdown'
import { setCmsCopyLanguage } from '../../utils/cmsCopy'
import { requiresHtmlSource } from '../../utils/richTextFieldHtml'

beforeEach(() => setCmsCopyLanguage('sv-se'))

vi.mock('../form-fields/RichTextInput', () => ({
    default: ({ value, onChange, allowMediaInsert }) => (
        <textarea aria-label="Visual HTML" data-allow-media-insert={allowMediaInsert} value={value} onChange={(e) => onChange(e.target.value)} />
    ),
}))

describe('Kanban Markdown', () => {
    it('keeps headings, lists, links, images, quotes and code across modes', () => {
        const markdown =
            '# Heading\n\n- One\n- Two\n\n**Bold** *italic* [link](https://example.org)\n\n> Quote\n\n```js\nconst n = 1\n```\n\n![image](/api/v1/kanban/attachments/id/download/)'
        const result = htmlMarkdown(markdownHtml(markdown))
        expect(result).toContain('# Heading')
        expect(result).toContain('**Bold**')
        expect(result).toContain('> Quote')
        expect(result).toContain('const n = 1')
        expect(result).toContain('![image](/api/v1/kanban/attachments/id/download/)')
    })
    it('removes executable HTML and unsafe URLs', () => {
        const html = markdownHtml('<img src=x onerror=alert(1)><script>alert(1)</script>[bad](javascript:alert(1))')
        expect(html).not.toContain('onerror')
        expect(html).not.toContain('<script')
        expect(html).not.toContain('href="javascript:')
    })
    it('preserves canonical member mentions', () => {
        expect(htmlMarkdown(markdownHtml('[@Johan](#member-12)'))).toContain('[@Johan](#member-12)')
    })
    it('supports source editing and visual conversion', () => {
        const onChange = vi.fn()
        render(<MarkdownEditor label="Description" value="**Bold**" onChange={onChange} />)
        expect(screen.getByLabelText('Visual HTML').value).toContain('<strong>Bold</strong>')
        expect(screen.getByLabelText('Visual HTML')).toHaveAttribute('data-allow-media-insert', 'false')
        fireEvent.click(screen.getByRole('button', { name: 'Markdown' }))
        fireEvent.change(screen.getByRole('textbox', { name: 'Description' }), {
            target: { value: '# New' },
        })
        expect(onChange).toHaveBeenCalledWith('# New')
    })
    it('renders sanitized content', () => {
        render(<MarkdownView value="**Safe**" />)
        expect(screen.getByText('Safe').tagName).toBe('STRONG')
    })
})

it('does not persist temporary attachment tickets from the visual editor', () => {
    const id = '11111111-1111-1111-1111-111111111111'
    const text = htmlMarkdown(`<img src="/api/v1/kanban/attachments/${id}/download/?ticket=temporary" alt="Draft">`)
    expect(text).not.toContain('ticket=')
    expect(text).toContain(`/attachments/${id}/download/`)
})

it('keeps uploaded images in the visual editor instead of switching to HTML source', () => {
    const id = '11111111-1111-1111-1111-111111111111'
    const html = withAttachmentTickets(markdownHtml(`![photo](/api/v1/kanban/attachments/${id}/download/)`), 'temporary', true)
    expect(requiresHtmlSource(html)).toBe(false)
})


it('echoes local visual HTML but rehydrates genuine external Markdown changes', () => {
    const onChange = vi.fn()
    const view = render(<MarkdownEditor value="" onChange={onChange} />)
    fireEvent.change(screen.getByLabelText('Visual HTML'), { target: { value: 'A' } })
    expect(onChange).toHaveBeenCalledWith('A')
    view.rerender(<MarkdownEditor value="A" onChange={onChange} />)
    expect(screen.getByLabelText('Visual HTML')).toHaveValue('A')
    view.rerender(<MarkdownEditor value="**External**" onChange={onChange} />)
    expect(screen.getByLabelText('Visual HTML').value).toContain('<strong>External</strong>')
    fireEvent.click(screen.getByRole('button', { name: 'Markdown' }))
    view.rerender(<MarkdownEditor value="# Source" onChange={onChange} />)
    fireEvent.click(screen.getByRole('button', { name: 'Visuellt' }))
    expect(screen.getByLabelText('Visual HTML').value).toContain('<h1>Source</h1>')
})


it('exposes editor save/cancel and toggles formatting help without submitting a form', () => {
    const onSave = vi.fn(), onCancel = vi.fn()
    render(<MarkdownEditor label="Beskrivning" value="Draft" onChange={vi.fn()} onSave={onSave} onCancel={onCancel} />)
    fireEvent.click(screen.getByRole('button', { name: 'Spara', exact: true }))
    expect(onSave).toHaveBeenCalledOnce()
    fireEvent.click(screen.getByRole('button', { name: 'Avbryt', exact: true }))
    expect(onCancel).toHaveBeenCalledOnce()
    const help = screen.getByRole('button', { name: 'Formateringshjälp' })
    fireEvent.click(help)
    expect(help).toHaveAttribute('aria-expanded', 'true')
    expect(screen.getByText(/Markera text/)).toBeVisible()
    fireEvent.click(help)
    expect(screen.queryByText(/Markera text/)).not.toBeInTheDocument()
})

it('inserts a dropped file at the cursor in Markdown mode', async () => {
    const onChange = vi.fn()
    const onFileDrop = vi.fn().mockResolvedValue([{ id: '11111111-1111-1111-1111-111111111111', filename: 'note.txt', contentType: 'text/plain' }])
    render(<MarkdownEditor label="Beskrivning" value="Before After" onChange={onChange} onFileDrop={onFileDrop} />)
    fireEvent.click(screen.getByRole('button', { name: 'Markdown' }))
    const source = screen.getByRole('textbox', { name: 'Beskrivning' })
    source.setSelectionRange(7, 7)
    const file = new File(['note'], 'note.txt', { type: 'text/plain' })
    fireEvent.drop(source, { dataTransfer: { files: [file], types: ['Files'] } })
    await waitFor(() => expect(onChange).toHaveBeenCalledWith('Before [note.txt](/api/v1/kanban/attachments/11111111-1111-1111-1111-111111111111/download/)After'))
})
