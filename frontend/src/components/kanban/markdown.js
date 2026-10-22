import { marked } from 'marked'
import TurndownService from 'turndown'
import DOMPurify from 'isomorphic-dompurify'

const converter = new TurndownService({
    headingStyle: 'atx',
    codeBlockStyle: 'fenced',
    bulletListMarker: '-',
})
export const markdownHtml = (text) =>
    DOMPurify.sanitize(marked.parse(text || '', { breaks: true }), {
        FORBID_TAGS: ['iframe', 'video', 'audio', 'style', 'form', 'input'],
        FORBID_ATTR: ['style'],
    })
export const htmlMarkdown = (html) => {
    const root = document.createElement('div')
    root.innerHTML = DOMPurify.sanitize(html)
    root.querySelectorAll('[src], [href]').forEach((node) => {
        for (const attr of ['src', 'href']) {
            const value = node.getAttribute(attr) || ''
            if (/^\/api\/v1\/kanban\/attachments\/[a-f0-9-]+\/download\/\?ticket=/.test(value))
                node.setAttribute(attr, value.split('?')[0])
        }
    })
    return converter.turndown(root.innerHTML)
}
export const withAttachmentTickets = (html, ticket) => {
    const root = document.createElement('div')
    root.innerHTML = html
    root.querySelectorAll('img').forEach((image) => {
        const src = image.getAttribute('src') || ''
        if (ticket && /^\/api\/v1\/kanban\/attachments\/[a-f0-9-]+\/download\/$/.test(src))
            image.setAttribute('src', `${src}?ticket=${encodeURIComponent(ticket)}`)
        image.referrerPolicy = 'no-referrer'
    })
    return root.innerHTML
}
