/**
 * HTML Cleanup Utility
 * 
 * Provides strict HTML cleanup functionality for sanitizing pasted content
 */

/**
 * Clean HTML strictly - only allow specific tags and attributes
 * Converts b → strong and i → em
 * Only allows h1-h6, strong, em, p, li, ul, ol, a, br
 * For links, only allows href, target, and name attributes
 * 
 * @param {string} html - The HTML string to clean
 * @returns {string} - The cleaned HTML string
 */
export function cleanHTMLStrict(html) {
    const tempDiv = document.createElement('div')
    tempDiv.innerHTML = html

    // Process all elements bottom-up (from innermost to outermost)
    const allElements = Array.from(tempDiv.querySelectorAll('*')).reverse()

    allElements.forEach(el => {
        const tagName = el.tagName.toLowerCase()

        // Convert b → strong, i → em
        if (tagName === 'b') {
            const strong = document.createElement('strong')
            strong.innerHTML = el.innerHTML
            el.parentNode.replaceChild(strong, el)
        } else if (tagName === 'i') {
            const em = document.createElement('em')
            em.innerHTML = el.innerHTML
            el.parentNode.replaceChild(em, el)
        } else if (!['h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'strong', 'em', 'p', 'li', 'ul', 'ol', 'a', 'br'].includes(tagName)) {
            // Remove disallowed tags, keep content
            while (el.firstChild) {
                el.parentNode.insertBefore(el.firstChild, el)
            }
            el.remove()
        } else if (tagName === 'a') {
            // Clean attributes on links - only allow href, target, and name
            const allowedAttrs = ['href', 'target', 'name']
            Array.from(el.attributes).forEach(attr => {
                if (!allowedAttrs.includes(attr.name)) {
                    el.removeAttribute(attr.name)
                }
            })
        } else {
            // For all other allowed tags, remove all attributes
            Array.from(el.attributes).forEach(attr => {
                el.removeAttribute(attr.name)
            })
        }
    })

    return tempDiv.innerHTML
}

