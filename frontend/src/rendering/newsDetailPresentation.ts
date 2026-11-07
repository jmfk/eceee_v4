import DOMPurify from 'isomorphic-dompurify'
import type { RenderWidgetModel } from './types'

const text = (html: string) => DOMPurify.sanitize(html.replace(/<\/(?:p|div|h[1-6]|li)>/gi, '$& '), { RETURN_DOM: true })
    .textContent?.normalize('NFKC').replace(/\s+/g, ' ').trim() || ''

/** Remove only a repeated leading headline, on a presentation copy of the body. */
export const newsDetailPresentation = (title: string, summary: string, html: string, slots: Record<string, RenderWidgetModel[]>, structured: boolean) => {
    const titleText = text(title)
    const headline = titleText.toLowerCase()
    let showHeadline = true
    const prepareBody = (body: string) => {
        const heading = /^\s*<h1\b([^>]*)>([\s\S]*?)<\/h1>\s*/i.exec(body)
        if (!heading || text(heading[2]).toLowerCase() !== headline) return { html: body, comparisonHtml: body }
        const remainder = body.slice(heading[0].length)
        // Retain rich headings and anchors in place, hiding the plain page title instead.
        const rich = Boolean(heading[1].trim() || /<[a-z][^>]*>/i.test(heading[2]))
        if (rich) showHeadline = false
        return { html: rich ? body : remainder, comparisonHtml: remainder }
    }
    const bodyParts: string[] = []
    let foundContent = false
    const widgets = structured ? Object.fromEntries(Object.entries(slots).map(([slot, entries]) => [slot, entries.map(widget => {
        if (widget.type !== 'easy_widgets.ContentWidget') return widget
        const key = widget.config.content !== undefined ? 'content' : 'html'
        const original = String(widget.config[key] || '')
        const body = foundContent ? { html: original, comparisonHtml: original } : prepareBody(original)
        foundContent = true
        bodyParts.push(text(body.comparisonHtml))
        return body.html === original ? widget : { ...widget, config: { ...widget.config, [key]: body.html } }
    })])) : slots
    const content = structured ? { html, comparisonHtml: '' } : prepareBody(html)
    const bodyText = structured ? bodyParts.filter(Boolean).join(' ') : text(content.comparisonHtml)

    // Legacy summaries sometimes concatenate the title and the first paragraph.
    const lead = text(summary)
    const comparison = lead.toLowerCase().startsWith(`${headline} `) ? lead.slice(titleText.length).trim() : lead
    const repeated = lead.toLowerCase() === headline || (comparison && (bodyText === comparison || bodyText.startsWith(`${comparison} `)))
    return { html: content.html, slots: widgets, summary: repeated ? '' : summary, showHeadline }
}
