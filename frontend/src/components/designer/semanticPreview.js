import { renderMustache } from '../../utils/mustacheRenderer'

const copy = {
    en: {
        eyebrow: 'Current topic',
        heading: 'A heading with a realistic length',
        body: 'This longer example text shows typography, line length, rhythm, and spacing with predictable demo content.',
        link: 'Read more',
        list: ['First example item', 'Second example item', 'Third example item'],
        image: 'Demo content image',
        empty: 'This area has no configured demo content yet.',
    },
    sv: {
        eyebrow: 'Aktuellt ämne',
        heading: 'En rubrik med verklig längd',
        body: 'Det här är en längre svensk exempeltext som visar typsnitt, radlängd, rytm och mellanrum med förutsägbart demoinnehåll.',
        link: 'Läs mer',
        list: ['Första exempelraden', 'Andra exempelraden', 'Tredje exempelraden'],
        image: 'Demobild för innehåll',
        empty: 'Den här ytan har ännu inget konfigurerat demoinnehåll.',
    },
}

const escapeHtml = (value) => String(value ?? '').replace(/[&<>'"]/g, (character) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;',
}[character]))

const languageCopy = () => {
    const language = (document.documentElement.lang || navigator.language || 'en').toLowerCase().split('-')[0]
    return copy[language] || copy.en
}

const targetAttributes = (target, editable = '') => [
    `data-designer-target="${escapeHtml(target.id)}"`,
    `data-designer-kind="${escapeHtml(target.kind || 'element')}"`,
    `data-designer-label="${escapeHtml(target.label)}"`,
    editable ? `data-preview-editable="${editable}"` : '',
].filter(Boolean).join(' ')

const defaultText = (tag) => {
    const text = languageCopy()
    if (/^h[1-6]$/.test(tag)) return text.heading
    if (tag === 'a' || tag === 'a:hover') return text.link
    if (tag === 'li') return text.list[0]
    if (tag === 'pre') return 'const example = true'
    if (tag === 'code') return 'exampleValue'
    if (tag === 'strong') return text.heading
    return text.body
}

const elementMarkup = (element, texts) => {
    const target = { ...element, kind: 'element' }
    const attributes = targetAttributes(target, 'text')
    const tag = String(element.element || 'div').toLowerCase()
    const value = texts[element.id] ?? defaultText(tag)
    if (/^h[1-6]$/.test(tag)) return `<${tag} ${attributes} contenteditable="true">${escapeHtml(value)}</${tag}>`
    if (tag === 'a' || tag === 'a:hover') return `<a href="#" ${attributes} contenteditable="true">${escapeHtml(value)}</a>`
    if (tag === 'ul' || tag === 'ol') {
        const items = texts[element.id] ? String(texts[element.id]).split('\n').filter(Boolean) : languageCopy().list
        return `<${tag} ${attributes}>${items.map((item) => `<li contenteditable="true">${escapeHtml(item)}</li>`).join('')}</${tag}>`
    }
    if (tag === 'li') return `<div ${attributes} contenteditable="true"><span class="demo-bullet">•</span> ${escapeHtml(value)}</div>`
    if (tag === 'blockquote') return `<blockquote ${attributes} contenteditable="true">${escapeHtml(value)}</blockquote>`
    if (tag === 'pre') return `<pre ${attributes} contenteditable="true"><code>${escapeHtml(value)}</code></pre>`
    if (tag === 'code') return `<code ${attributes} contenteditable="true">${escapeHtml(value)}</code>`
    if (tag === 'strong') return `<strong ${attributes} contenteditable="true">${escapeHtml(value)}</strong>`
    if (tag === 'em') return `<em ${attributes} contenteditable="true">${escapeHtml(value)}</em>`
    return `<p ${attributes} contenteditable="true">${escapeHtml(value)}</p>`
}

const themeAssetMarkup = (asset) => {
    const target = { id: `asset:${asset.assetKey}`, label: asset.displayName, kind: 'asset' }
    const badge = asset.isPlaceholder ? '<span class="demo-placeholder-badge">Placeholder</span>' : ''
    const assetClass = `demo-theme-asset demo-theme-asset-${escapeHtml(asset.kind || 'image')}`
    if (asset.url) return `<figure class="${assetClass}" ${targetAttributes(target)}><img src="${escapeHtml(asset.url)}" alt=""><figcaption>${escapeHtml(asset.displayName)} ${badge}</figcaption></figure>`
    return `<div class="demo-image-placeholder" ${targetAttributes(target)}><span>${escapeHtml(asset.displayName || languageCopy().image)}</span>${badge}</div>`
}

const previewImageMarkup = (view, slotName, showPlaceholder = false) => {
    const targetId = `preview:${view.id}:image:${slotName}`
    const image = view.images?.[targetId]
    const target = { id: targetId, label: languageCopy().image, kind: 'previewImage' }
    if (image?.url) return `<figure class="demo-content-image" ${targetAttributes(target, 'image')}><img src="${escapeHtml(image.url)}" alt=""><figcaption>${escapeHtml(image.filename || languageCopy().image)}</figcaption></figure>`
    if (!showPlaceholder) return ''
    return `<div class="demo-image-placeholder demo-content-image" ${targetAttributes(target, 'image')}><span>${escapeHtml(languageCopy().image)}</span></div>`
}

const widgetClassNames = (group) => (group.widgetTypes || []).flatMap((widgetType) => {
    const normalized = String(widgetType).toLowerCase().replace(/[^a-z0-9-]/g, '-')
    const shortName = String(widgetType).split('.').pop().replace(/Widget$/i, '').toLowerCase().replace(/[^a-z0-9-]/g, '-')
    return [`widget-type-${normalized}`, `widget-type-${shortName}`]
}).join(' ')

const partClassNames = (part) => {
    return String(part.part || '').replace(/[^a-zA-Z0-9_-]/g, '-')
}

const partDemoContent = (part) => {
    const text = languageCopy()
    const name = String(part.part || '').toLowerCase()
    if (name.includes('nav') || name.includes('menu')) {
        return text.list.map((item, index) => `<li><a href="#demo-${index + 1}">${escapeHtml(item)}</a></li>`).join('')
    }
    if (name.includes('header') || name.includes('hero')) return `<p>${escapeHtml(text.eyebrow)}</p><h2>${escapeHtml(text.heading)}</h2>`
    if (name.includes('footer')) return `<p>${escapeHtml(text.body)}</p><a href="#demo-footer">${escapeHtml(text.link)}</a>`
    return `<p>${escapeHtml(text.body)}</p>`
}

const responsiveAsset = (group, workspace, viewport) => {
    const assets = (group.assetKeys || []).map((assetKey) => workspace.assets.find((asset) => asset.assetKey === assetKey)).filter(Boolean)
    const preference = viewport === 'mobile'
        ? ['xs', 'sm', 'md', 'lg', 'xl']
        : viewport === 'tablet' ? ['md', 'sm', 'lg', 'xs', 'xl'] : ['lg', 'xl', 'md', 'sm', 'xs']
    const rank = (asset) => {
        const index = preference.indexOf(asset.breakpoint)
        return index === -1 ? preference.length : index
    }
    return [...assets].sort((left, right) => rank(left) - rank(right))[0]
}

const groupContent = (group, workspace, texts, { includeRoot = true, viewport = 'desktop' } = {}) => {
    const asset = responsiveAsset(group, workspace, viewport)
    const elements = (group.elements || []).map((element) => elementMarkup(element, texts)).join('')
    const parts = (group.parts || []).map((part, index) => {
        const content = index === 0 && elements ? elements : partDemoContent(part)
        const partName = String(part.part || '').toLowerCase()
        const tag = partName.includes('nav') || partName.includes('menu') ? 'ul' : 'div'
        const target = asset?.part === part.part
            ? { id: `asset:${asset.assetKey}`, label: asset.displayName, kind: 'asset' }
            : { ...part, kind: 'part' }
        const placeholder = asset?.part === part.part && !asset.url ? themeAssetMarkup(asset) : ''
        return `<${tag} class="demo-part ${escapeHtml(partClassNames(part))}" ${targetAttributes(target)}>${placeholder}${content}</${tag}>`
    }).join('')
    const body = parts || elements || (asset ? themeAssetMarkup(asset) : '') || `<p>${escapeHtml(languageCopy().empty)}</p>`
    if (!includeRoot) return body
    const rootTarget = asset && !(group.parts || []).some((part) => part.part === asset.part)
        ? { id: `asset:${asset.assetKey}`, label: asset.displayName, kind: 'asset' }
        : { id: group.id, label: group.label, kind: 'group' }
    return `<section class="demo-group ${escapeHtml(widgetClassNames(group))}" ${targetAttributes(rootTarget)}>${body}</section>`
}

const safeStyleTemplate = (template) => String(template || '{{{content}}}')
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/\son[a-z]+\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+)/gi, '')
    .replace(/\s(?:href|src)\s*=\s*(["'])\s*javascript:[\s\S]*?\1/gi, '')

const componentStyleContext = (content) => {
    const text = languageCopy()
    const links = text.list.map((title, index) => ({ title, path: `#demo-${index + 1}` }))
    return {
        content, passthru: content, anchor: text.heading, caption: text.body, size: 'large', alignment: 'center',
        items: links, menuItems: links, currentChildren: links, parentChildren: links, ownerChildren: links,
        currentPage: links[0], parentPage: { title: text.eyebrow, path: '#demo-parent' }, ownerPage: links[0],
        hasItems: true, hasCurrentChildren: true, hasParentChildren: true, hasOwnerChildren: true,
        isInherited: true, isLevel1: false, isLevel2: true, isLevel3: false,
        isLevel1AndBelow: true, isLevel2AndBelow: true, isLevel3AndBelow: false,
    }
}

const renderComponentStyle = (componentStyle, content) => {
    const template = safeStyleTemplate(componentStyle?.template).replace(/\{\{\s*passthru\s*\}\}/g, '{{{passthru}}}')
    const rendered = renderMustache(template, componentStyleContext(content))
    return rendered.trim() ? rendered : content
}

const slotMarkup = (workspace, view, slot, primarySlot, options) => {
    const groups = workspace.catalog.designGroups || []
    const matching = groups.filter((group) => (group.slots || []).includes(slot.name))
    const requested = groups.find((group) => group.id === options.activeGroupId)
    const requestedBelongsHere = requested && (
        (requested.slots || []).includes(slot.name)
        || (slot.name === primarySlot && !(requested.slots || []).length)
    )
    const selected = requestedBelongsHere ? requested : matching[0] || null
    const image = previewImageMarkup(view, slot.name)
    let content = selected ? groupContent(selected, workspace, view.texts || {}, { viewport: options.viewport }) : ''
    const activeStyle = slot.name === primarySlot
        ? (workspace.catalog.componentStyles || []).find((style) => style.key === options.activeComponentStyleKey)
        : null
    if (activeStyle) {
        content = `<section class="demo-component-style" ${targetAttributes({ id: `component-style:${activeStyle.key}`, label: activeStyle.label, kind: 'componentStyle' })}>${renderComponentStyle(activeStyle, content || `<p>${escapeHtml(languageCopy().body)}</p>`)}</section>`
    }
    return `${image}${content}`
}

const layoutMarkup = (workspace, layout, view, options) => {
    const slots = layout?.slots || []
    const primarySlot = slots.find((slot) => ['main', 'content', 'body', 'landing_page'].includes(slot.name))?.name || slots[0]?.name
    let markup = layout?.previewTemplate || ''
    slots.forEach((slot) => {
        markup = markup.split(`__DESIGNER_SLOT_${slot.name}__`).join(slotMarkup(workspace, view, slot, primarySlot, options))
    })
    return markup.replace(/__DESIGNER_SLOT_[A-Za-z0-9_-]+__/g, '')
}

export const buildSemanticPreviewDocument = ({ workspace, css, fontUrl, viewId, viewport, activeGroupId, activeComponentStyleKey }) => {
    const views = workspace.previewContent?.views || workspace.catalog.previewViews || []
    const view = views.find((item) => item.id === viewId) || views[0]
    const layout = workspace.catalog.layouts.find((item) => item.key === view?.layout) || workspace.catalog.layouts[0]
    const content = view && layout ? layoutMarkup(workspace, layout, view, { viewport, activeGroupId, activeComponentStyleKey }) : `<p>${escapeHtml(languageCopy().empty)}</p>`
    const maxWidth = viewport === 'mobile' ? '390px' : viewport === 'tablet' ? '760px' : '1280px'
    const slotTargets = JSON.stringify((layout?.slots || []).map((slot) => ({
        name: slot.name, id: `layout:${view?.layout}:slot:${slot.name}`, label: slot.label,
    }))).replace(/</g, '\\u003c')
    return `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width">${fontUrl ? `<link rel="stylesheet" href="${escapeHtml(fontUrl)}">` : ''}<style>
html,body{margin:0;min-height:100%;background:#e5e7eb;color:#111827}body{font-family:system-ui,sans-serif}.designer-preview{max-width:${maxWidth};margin:auto;background:white;min-height:100vh}.demo-group{position:relative}.demo-group>*+*,.demo-part>*+*{margin-top:14px}.demo-image-placeholder{min-height:130px;display:grid;place-items:center;padding:20px;border:1px dashed #9ca3af;background:linear-gradient(135deg,#e5e7eb 50%,#d1d5db 50%);font:600 13px system-ui,sans-serif}.demo-placeholder-badge{display:inline-block;margin-left:6px;padding:2px 6px;border-radius:999px;background:#fef3c7;color:#92400e;font:600 10px system-ui,sans-serif}figure{margin:0}figure img{display:block;width:100%;max-height:360px;object-fit:contain;background:#f9fafb}figcaption{padding:6px 0;color:#6b7280;font:12px system-ui,sans-serif}.demo-part{min-height:44px}.demo-component-style{position:relative}.demo-bullet{font-weight:700}[contenteditable=true]{outline:none}[data-designer-target]{position:relative;cursor:pointer;outline:1px dashed rgba(100,116,139,.5)!important;outline-offset:-1px;transition:outline-color .1s,background-color .1s}[data-designer-kind=layoutSlot]:empty{display:block;min-height:44px}[data-designer-target]:hover{outline:2px dashed #2563eb!important;outline-offset:-2px}[data-designer-target].designer-selected{outline:3px solid #2563eb!important;outline-offset:-3px!important}.designer-selected::after{content:attr(data-designer-label);position:absolute;z-index:20;top:4px;right:4px;box-sizing:border-box;max-width:calc(100% - 8px);overflow:hidden;padding:3px 7px;border-radius:3px;background:#1d4ed8;color:white;font:600 11px system-ui,sans-serif;line-height:1.2;text-overflow:ellipsis;white-space:nowrap;pointer-events:none}${layout?.layoutCss || ''}${css || ''}</style></head><body><main class="designer-preview cms-content">${content}</main><script>
${slotTargets}.forEach(function(slot){Array.from(document.getElementsByClassName('slot-'+slot.name)).forEach(function(node){node.dataset.designerTarget=slot.id;node.dataset.designerKind='layoutSlot';node.dataset.designerLabel=slot.label})});
function send(target,action){parent.postMessage({source:'eceee-designer-preview',action:action||'select',targetId:target.dataset.designerTarget,kind:target.dataset.designerKind,label:target.dataset.designerLabel,text:target.innerText},'*')}
document.addEventListener('click',function(event){var target=event.target.closest('[data-designer-target]');if(!target)return;if(event.target.closest('a'))event.preventDefault();event.stopPropagation();document.querySelectorAll('.designer-selected').forEach(function(node){node.classList.remove('designer-selected')});target.classList.add('designer-selected');send(target,'select')});
document.addEventListener('focusout',function(event){var target=event.target.closest('[data-preview-editable="text"]');if(target)send(target,'contentChange')});
</script></body></html>`
}

export default buildSemanticPreviewDocument
