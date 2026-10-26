import { marked } from 'marked'
import TurndownService from 'turndown'
import DOMPurify from 'isomorphic-dompurify'
import { attachmentUrl } from '../../api/kanban'

export const fileMarkdown = (file) => {
    const name = file.filename.replaceAll('\\', '\\\\').replaceAll('[', '\\[').replaceAll(']', '\\]')
    const url = attachmentUrl(file.id)
    return file.contentType.startsWith('image/') && file.contentType !== 'image/svg+xml'
        ? `![${name}](${url})`
        : `[${name}](${url})`
}

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
export const withAttachmentTickets = (html, ticket, forEditor = false) => {
    const root = document.createElement('div')
    root.innerHTML = html
    root.querySelectorAll('img, a').forEach((node) => {
        const attribute = node.tagName === 'IMG' ? 'src' : 'href'
        const url = node.getAttribute(attribute) || ''
        if (ticket && /^\/api\/v1\/kanban\/attachments\/[a-f0-9-]+\/download\/$/.test(url))
            node.setAttribute(attribute, `${url}?ticket=${encodeURIComponent(ticket)}`)
        if (node.tagName === 'IMG' && !forEditor) node.referrerPolicy = 'no-referrer'
    })
    return root.innerHTML
}
