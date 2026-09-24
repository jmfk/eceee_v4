import { renderMustache } from '../../utils/mustacheRenderer'

const copy = {
    en: {
        eyebrow: 'Current topic',
        heading: 'A heading with a realistic length',
        body: 'This longer example text shows typography, line length, rhythm, and spacing with predictable demo content.',
        link: 'Read more',
        list: ['First example item', 'Second example item', 'Third example item'],
        image: 'Demo image',
        empty: 'This element has no configured visual values yet.',
    },
    sv: {
        eyebrow: 'Aktuellt ämne',
        heading: 'En rubrik med verklig längd',
        body: 'Det här är en längre svensk exempeltext som visar typsnitt, radlängd, rytm och mellanrum med förutsägbart demoinnehåll.',
        link: 'Läs mer',
        list: ['Första exempelraden', 'Andra exempelraden', 'Tredje exempelraden'],
        image: 'Demobild',
        empty: 'Elementet har ännu inga konfigurerade visuella värden.',
    },
}

const escapeHtml = (value) => String(value ?? '').replace(/[&<>'"]/g, (character) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;',
}[character]))

const languageCopy = () => {
    const language = (document.documentElement.lang || navigator.language || 'en').toLowerCase().split('-')[0]
    return copy[language] || copy.en
}

const targetAttributes = (target) => [
    `data-designer-target="${escapeHtml(target.id)}"`,
    `data-designer-kind="${escapeHtml(target.kind || 'element')}"`,
    `data-designer-label="${escapeHtml(target.label)}"`,
].join(' ')

const elementMarkup = (element) => {
    const text = languageCopy()
    const target = { ...element, kind: 'element' }
    const attributes = targetAttributes(target)
    const tag = String(element.element || 'div').toLowerCase()
    if (/^h[1-6]$/.test(tag)) return `<${tag} ${attributes}>${escapeHtml(text.heading)}</${tag}>`
    if (tag === 'a' || tag === 'a:hover') return `<a href="#" ${attributes}>${escapeHtml(text.link)}</a>`
    if (tag === 'ul' || tag === 'ol') return `<${tag} ${attributes}>${text.list.map((item) => `<li>${escapeHtml(item)}</li>`).join('')}</${tag}>`
    if (tag === 'li') return `<div ${attributes}><span class="demo-bullet">•</span> ${escapeHtml(text.list[0])}</div>`
    if (tag === 'blockquote') return `<blockquote ${attributes}>${escapeHtml(text.body)}</blockquote>`
    if (tag === 'pre') return `<pre ${attributes}><code>const example = true</code></pre>`
    if (tag === 'code') return `<code ${attributes}>exampleValue</code>`
    if (tag === 'strong') return `<strong ${attributes}>${escapeHtml(text.heading)}</strong>`
    if (tag === 'em') return `<em ${attributes}>${escapeHtml(text.body)}</em>`
    return `<p ${attributes}>${escapeHtml(text.body)}</p>`
}

const assetMarkup = (asset) => {
    const target = { id: `asset:${asset.assetKey}`, label: asset.displayName, kind: 'asset' }
    const badge = asset.isPlaceholder ? '<span class="demo-placeholder-badge">Placeholder</span>' : ''
    if (asset.url) {
        return `<figure ${targetAttributes(target)}><img src="${escapeHtml(asset.url)}" alt=""><figcaption>${escapeHtml(asset.displayName)} ${badge}</figcaption></figure>`
    }
    return `<div class="demo-image-placeholder" ${targetAttributes(target)}><span>${escapeHtml(asset.displayName || languageCopy().image)}</span>${badge}</div>`
}

const groupContent = (group, workspace, { includeRoot = true } = {}) => {
    const assets = (group.assetKeys || []).map((assetKey) => workspace.assets.find((asset) => asset.assetKey === assetKey)).filter(Boolean)
    const body = [
        ...assets.map(assetMarkup),
        ...(group.parts || []).map((part) => `<div class="demo-part" ${targetAttributes({ ...part, kind: 'part' })}>${escapeHtml(part.label)}</div>`),
        ...(group.elements || []).map(elementMarkup),
    ].join('') || `<p>${escapeHtml(languageCopy().empty)}</p>`
    if (!includeRoot) return body
    return `<section class="demo-group" ${targetAttributes({ id: group.id, label: group.label, kind: 'group' })}><small class="demo-kicker">${escapeHtml(group.label)}</small>${body}</section>`
}

const safeStyleTemplate = (template) => String(template || '{{{content}}}')
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/\son[a-z]+\s*=\s*(["']).*?\1/gi, '')

const componentStyleContext = (content) => {
    const text = languageCopy()
    const links = text.list.map((title, index) => ({ title, path: `#demo-${index + 1}` }))
    return {
        content,
        passthru: content,
        anchor: text.heading,
        caption: text.body,
        size: 'large',
        alignment: 'center',
        items: links,
        menuItems: links,
        currentChildren: links,
        parentChildren: links,
        ownerChildren: links,
        currentPage: links[0],
        parentPage: { title: text.eyebrow, path: '#demo-parent' },
        ownerPage: links[0],
        hasItems: true,
        hasCurrentChildren: true,
        hasParentChildren: true,
        hasOwnerChildren: true,
        isInherited: true,
        isLevel1: false,
        isLevel2: true,
        isLevel3: false,
        isLevel1AndBelow: true,
        isLevel2AndBelow: true,
        isLevel3AndBelow: false,
    }
}

const renderComponentStyle = (componentStyle, content) => {
    const template = safeStyleTemplate(componentStyle?.template)
        .replace(/\{\{\s*passthru\s*\}\}/g, '{{{passthru}}}')
    const rendered = renderMustache(template, componentStyleContext(content))
    return rendered.trim() ? rendered : content
}

const isolatedMarkup = (workspace, group, componentStyle) => {
    const content = groupContent(group, workspace)
    if (!componentStyle) return content
    const styled = renderComponentStyle(componentStyle, content)
    return `<div class="demo-component-style" ${targetAttributes({ id: `component-style:${componentStyle.key}`, label: componentStyle.label, kind: 'componentStyle' })}>${styled}</div>`
}

const layoutMarkup = (workspace, layout, selectedStyle) => {
    const groups = workspace.catalog.designGroups || []
    const fallback = groups[0]
    const slots = (layout?.slots || []).map((slot) => {
        const matching = groups.filter((group) => (group.slots || []).includes(slot.name))
        const selectedGroups = matching.length ? matching : (slot.name === 'main' && fallback ? [fallback] : [])
        const content = selectedGroups.map((group) => {
            const markup = groupContent(group, workspace)
            if (!selectedStyle) return markup
            return renderComponentStyle(selectedStyle, markup)
        }).join('') || `<p>${escapeHtml(languageCopy().body)}</p>`
        return `<section class="demo-layout-slot slot-${escapeHtml(slot.name)}" ${targetAttributes({ id: `layout:${layout.key}:slot:${slot.name}`, label: slot.label, kind: 'layoutSlot' })}><span class="demo-slot-label">${escapeHtml(slot.label)}</span>${content}</section>`
    }).join('')
    return `<div class="demo-layout layout-${escapeHtml(layout?.key)}">${slots}</div>`
}

export const buildSemanticPreviewDocument = ({ workspace, css, fontUrl, mode, groupId, layoutKey, componentStyleKey, viewport }) => {
    const group = workspace.catalog.designGroups.find((item) => item.id === groupId) || workspace.catalog.designGroups[0]
    const layout = workspace.catalog.layouts.find((item) => item.key === layoutKey) || workspace.catalog.layouts[0]
    const componentStyle = workspace.catalog.componentStyles.find((item) => item.key === componentStyleKey)
    const content = mode === 'layout'
        ? layoutMarkup(workspace, layout, componentStyle)
        : isolatedMarkup(workspace, group, componentStyle)
    const maxWidth = viewport === 'mobile' ? '390px' : viewport === 'tablet' ? '760px' : '1180px'
    return `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width">${fontUrl ? `<link rel="stylesheet" href="${escapeHtml(fontUrl)}">` : ''}<style>
html,body{margin:0;min-height:100%;background:#f3f4f6;color:#111827}body{padding:24px;font-family:system-ui,sans-serif}.designer-preview{max-width:${maxWidth};margin:auto;background:white}.demo-group{position:relative;padding:24px;border:1px solid #d1d5db;background:#fff}.demo-kicker,.demo-slot-label{display:block;margin-bottom:12px;color:#6b7280;font:600 11px/1.2 system-ui,sans-serif;letter-spacing:.06em;text-transform:uppercase}.demo-group>*+*{margin-top:14px}.demo-layout{display:grid;gap:14px}.demo-layout-slot{position:relative;min-height:90px;padding:20px;border:1px solid #d1d5db;background:#fff}.slot-main{grid-column:1}.slot-sidebar{grid-column:2;grid-row:auto / span 2}.demo-image-placeholder{min-height:130px;display:grid;place-items:center;padding:20px;border:1px dashed #9ca3af;background:linear-gradient(135deg,#e5e7eb 50%,#d1d5db 50%);font:600 13px system-ui,sans-serif}.demo-placeholder-badge{display:inline-block;margin-left:6px;padding:2px 6px;border-radius:999px;background:#fef3c7;color:#92400e;font:600 10px system-ui,sans-serif}figure{margin:0}figure img{display:block;width:100%;max-height:300px;object-fit:contain;background:#f9fafb}figcaption{padding:6px 0;color:#6b7280;font:12px system-ui,sans-serif}.demo-part{min-height:72px;padding:18px;border:1px dashed #9ca3af;background:#f9fafb}.demo-component-style{padding:20px}.demo-bullet{font-weight:700}[data-designer-target]{position:relative;cursor:pointer;transition:outline-color .1s,background-color .1s}[data-designer-target]:hover{outline:2px dashed #2563eb;outline-offset:3px}[data-designer-target].designer-selected{outline:3px solid #2563eb!important;outline-offset:4px!important}.designer-selected::after{content:attr(data-designer-label);position:absolute;z-index:20;top:-24px;left:0;padding:3px 7px;background:#1d4ed8;color:white;font:600 11px system-ui,sans-serif;white-space:nowrap}${css || ''}</style></head><body><main class="designer-preview cms-content">${content}</main><script>
document.addEventListener('click',function(event){var target=event.target.closest('[data-designer-target]');if(!target)return;event.preventDefault();event.stopPropagation();document.querySelectorAll('.designer-selected').forEach(function(node){node.classList.remove('designer-selected')});target.classList.add('designer-selected');parent.postMessage({source:'eceee-designer-preview',targetId:target.dataset.designerTarget,kind:target.dataset.designerKind,label:target.dataset.designerLabel},'*')});
</script></body></html>`
}

export default buildSemanticPreviewDocument
