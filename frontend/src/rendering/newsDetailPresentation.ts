import DOMPurify from 'isomorphic-dompurify'
import type { RenderWidgetModel } from './types'

const text = (html: string) => DOMPurify.sanitize(html.replace(/<\/(?:p|div|h[1-6]|li)>/gi, '$& '), { RETURN_DOM: true })
    .textContent?.normalize('NFKC').replace(/\s+/g, ' ').trim() || ''

/** Remove only a repeated leading headline, on a presentation copy of the body. */
export const newsDetailPresentation = (title: string, summary: string, html: string, slots: Record<string, RenderWidgetModel[]>, structured: boolean) => {
    const headline = text(title).toLowerCase()
    const withoutHeadline = (body: string) => {
        const heading = /^\s*<h1\b[^>]*>([\s\S]*?)<\/h1>\s*/i.exec(body)
        return heading && text(heading[1]).toLowerCase() === headline ? body.slice(heading[0].length) : body
    }
    let bodyText = ''
    let foundContent = false
    const widgets = structured ? Object.fromEntries(Object.entries(slots).map(([slot, entries]) => [slot, entries.map(widget => {
        if (foundContent || widget.type !== 'easy_widgets.ContentWidget') return widget
        foundContent = true
        const key = widget.config.content !== undefined ? 'content' : 'html'
        const content = withoutHeadline(String(widget.config[key] || ''))
        bodyText = text(content)
        return { ...widget, config: { ...widget.config, [key]: content } }
    })])) : slots
    const content = structured ? html : withoutHeadline(html)
    if (!structured) bodyText = text(content)

    // Legacy summaries sometimes concatenate the title and the first paragraph.
    const lead = text(summary)
    const comparison = lead.toLowerCase().startsWith(`${headline} `) ? lead.slice(text(title).length).trim() : lead
    const repeated = lead.toLowerCase() === headline || (comparison && (bodyText === comparison || bodyText.startsWith(`${comparison} `)))
    return { html: content, slots: widgets, summary: repeated ? '' : summary }
}
