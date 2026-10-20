import DOMPurify from 'isomorphic-dompurify'

const inlineSanitizeOptions = {
    ALLOWED_TAGS: ['strong', 'b', 'em', 'i', 'a', 'br', 'code', 'sup', 'sub', 'span', 's', 'u'],
    ALLOWED_ATTR: ['href', 'title', 'target', 'rel']
}

export const requiresHtmlSource = (html, inlineOnly = false) => {
    const template = document.createElement('template')
    template.innerHTML = html || ''
    // Check the same allowed markup as the editor that will emit the next value.
    return DOMPurify.sanitize(html || '', inlineOnly ? inlineSanitizeOptions : {}) !== template.innerHTML
}

export const inlineFieldHtml = html => {
    const template = document.createElement('template')
    template.innerHTML = html || ''
    template.content.querySelectorAll('p, div, h1, h2, h3, h4, h5, h6, li, blockquote, pre').forEach(block => {
        block.after(document.createElement('br'))
    })
    return DOMPurify.sanitize(template.innerHTML, inlineSanitizeOptions).replace(/(?:<br>)+$/, '')
}
