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
const imageWidths = new Set(['25', '50', '75', '100'])
const imageAlignments = new Set(['left', 'center', 'right'])
const imageFloats = new Set(['float-left', 'float-right'])
converter.addRule('kanbanImageLayout', {
    filter: (node) => node.nodeName === 'IMG' && ['data-width', 'data-align', 'data-image-style']
        .some((attribute) => node.hasAttribute(attribute)),
    replacement: (_content, node) => {
        const image = document.createElement('img')
        image.setAttribute('src', node.getAttribute('src') || '')
        image.setAttribute('alt', node.getAttribute('alt') || '')
        const width = node.getAttribute('data-width')
        const alignment = node.getAttribute('data-align')
        const float = node.getAttribute('data-image-style')
        if (imageWidths.has(width)) image.setAttribute('data-width', width)
        if (imageAlignments.has(alignment)) image.setAttribute('data-align', alignment)
        if (imageFloats.has(float)) image.setAttribute('data-image-style', float)
        return image.outerHTML
    },
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
