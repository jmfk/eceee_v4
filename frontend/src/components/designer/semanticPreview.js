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
    const tag = String(element.element || 'div').toLowerCase()
    const attributes = targetAttributes(target, ['ul', 'ol'].includes(tag) ? '' : 'text')
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

const semanticTargetMap = (workspace, viewport) => (workspace.catalog.designGroups || []).map((group) => {
    const asset = responsiveAsset(group, workspace, viewport)
    return {
        id: group.id,
        label: group.label,
        classes: widgetClassNames(group).split(' ').filter(Boolean),
        elements: group.elements || [],
        parts: (group.parts || []).map((part) => ({
            ...part,
            targetId: asset?.part === part.part ? `asset:${asset.assetKey}` : part.id,
            targetLabel: asset?.part === part.part ? asset.displayName : part.label,
            targetKind: asset?.part === part.part ? 'asset' : 'part',
        })),
    }
})

export const buildSemanticPreviewDocument = ({ workspace, css, fontUrl, viewId, viewport, activeGroupId, activeComponentStyleKey }) => {
    const views = workspace.previewContent?.views || workspace.catalog.previewViews || []
    const view = views.find((item) => item.id === viewId) || views[0]
    const layout = workspace.catalog.layouts.find((item) => item.key === view?.layout) || workspace.catalog.layouts[0]
    const useReference = view?.referenceHtml && !activeGroupId && !activeComponentStyleKey
    const content = useReference
        ? view.referenceHtml
        : view && layout ? layoutMarkup(workspace, layout, view, { viewport, activeGroupId, activeComponentStyleKey }) : `<p>${escapeHtml(languageCopy().empty)}</p>`
    const maxWidth = viewport === 'mobile' ? '390px' : viewport === 'tablet' ? '760px' : '1280px'
    const slotTargets = JSON.stringify((layout?.slots || []).map((slot) => ({
        name: slot.name, id: `layout:${view?.layout}:slot:${slot.name}`, label: slot.label,
    }))).replace(/</g, '\\u003c')
    const semanticTargets = JSON.stringify(semanticTargetMap(workspace, viewport)).replace(/</g, '\\u003c')
    const previewTexts = JSON.stringify(view?.texts || {}).replace(/</g, '\\u003c')
    const previewImages = JSON.stringify(view?.images || {}).replace(/</g, '\\u003c')
    return `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width">${fontUrl ? `<link rel="stylesheet" href="${escapeHtml(fontUrl)}">` : ''}<style>
html,body{margin:0;min-height:100%;background:#e5e7eb;color:#111827}body{font-family:system-ui,sans-serif}.designer-preview{max-width:${maxWidth};margin:auto;background:white;min-height:100vh}.navbar-widget>div:last-child{display:flex!important;position:relative!important;justify-content:space-between!important;align-items:center!important;height:28px!important;width:100%!important}[x-show]{display:none!important}@media(max-width:767px){.navbar-widget>.navbar-hamburger-mode{display:flex!important}.navbar-widget>div:not([x-show]){display:none!important}}.demo-group{position:relative}.demo-group>*+*,.demo-part>*+*{margin-top:14px}.demo-image-placeholder{min-height:130px;display:grid;place-items:center;padding:20px;border:1px dashed #9ca3af;background:linear-gradient(135deg,#e5e7eb 50%,#d1d5db 50%);font:600 13px system-ui,sans-serif}.demo-placeholder-badge{display:inline-block;margin-left:6px;padding:2px 6px;border-radius:999px;background:#fef3c7;color:#92400e;font:600 10px system-ui,sans-serif}figure{margin:0}figure img{display:block;width:100%;max-height:360px;object-fit:contain;background:#f9fafb}figcaption{padding:6px 0;color:#6b7280;font:12px system-ui,sans-serif}.demo-part{min-height:44px}.demo-component-style{position:relative}.demo-bullet{font-weight:700}[contenteditable=true]{outline:none}[data-designer-target]{position:relative;cursor:pointer;outline:1px dashed rgba(100,116,139,.5)!important;outline-offset:-1px;transition:outline-color .1s,background-color .1s}[data-designer-kind=layoutSlot]:empty{display:block;min-height:44px}[data-designer-target]:hover{outline:2px dashed #2563eb!important;outline-offset:-2px}[data-designer-target].designer-selected{outline:3px solid #2563eb!important;outline-offset:-3px!important}.designer-spacing-guide{position:fixed!important;box-sizing:border-box!important;pointer-events:none!important;z-index:2147483646!important}.designer-spacing-margin{border:1px dashed rgba(217,119,6,.65)!important;background:rgba(245,158,11,.035)!important}.designer-spacing-padding{border:1px dashed rgba(8,145,178,.7)!important;background:rgba(6,182,212,.035)!important}.designer-spacing-outer{opacity:.55!important}.designer-spacing-readout{position:fixed!important;display:grid!important;gap:2px!important;max-width:min(420px,calc(100vw - 12px))!important;padding:5px 7px!important;border:1px solid rgba(15,23,42,.18)!important;border-radius:5px!important;background:rgba(255,255,255,.96)!important;box-shadow:0 2px 8px rgba(15,23,42,.15)!important;color:#334155!important;font:600 10px/1.35 system-ui,sans-serif!important;white-space:normal!important;pointer-events:none!important;z-index:2147483647!important}.designer-spacing-margin-label{color:#92400e!important}.designer-spacing-padding-label{color:#0e7490!important}${layout?.layoutCss || ''}${css || ''}</style></head><body><main class="designer-preview cms-content">${content}</main><script>
function readNodeTargets(node){if(node.dataset.designerTargets){try{return JSON.parse(node.dataset.designerTargets)}catch(_error){}}if(node.dataset.designerTarget)return [{id:node.dataset.designerTarget,kind:node.dataset.designerKind,label:node.dataset.designerLabel,editable:node.dataset.previewEditable==='text'}];return []}
function registerTarget(node,target){var targets=readNodeTargets(node);if(!targets.some(function(item){return item.id===target.id}))targets.push(target);node.dataset.designerTargets=JSON.stringify(targets);if(!node.dataset.designerTarget){node.dataset.designerTarget=target.id;node.dataset.designerKind=target.kind;node.dataset.designerLabel=target.label}}
${slotTargets}.forEach(function(slot){Array.from(document.getElementsByClassName('slot-'+slot.name)).forEach(function(node){registerTarget(node,{id:slot.id,kind:'layoutSlot',label:slot.label,editable:false})})});
${semanticTargets}.forEach(function(group){
  var roots=[];group.classes.forEach(function(className){Array.from(document.getElementsByClassName(className)).forEach(function(node){if(!roots.includes(node))roots.push(node)})});
  roots.forEach(function(root){
    registerTarget(root,{id:group.id,kind:'group',label:group.label,editable:false});
    group.parts.forEach(function(part){Array.from(root.getElementsByClassName(String(part.part).replace(/[^a-zA-Z0-9_-]/g,'-'))).forEach(function(node){registerTarget(node,{id:part.targetId,kind:part.targetKind,label:part.targetLabel,editable:false})})});
    group.elements.forEach(function(element){var selector=element.element==='a:hover'?'a':element.element;try{root.querySelectorAll(selector).forEach(function(node){var editableTags=['A','BLOCKQUOTE','CODE','EM','H1','H2','H3','H4','H5','H6','LI','P','PRE','SPAN','STRONG'];var editable=editableTags.includes(node.tagName);registerTarget(node,{id:element.id,kind:'element',label:element.label,editable:editable});if(editable){node.dataset.previewEditable='text';node.contentEditable='true'}})}catch(_error){}});
  });
});
(function(){
  var texts=${previewTexts};var images=${previewImages};var viewId=${JSON.stringify(view?.id || '')};
  var labels={h1:'Heading 1',h2:'Heading 2',h3:'Heading 3',h4:'Heading 4',h5:'Heading 5',h6:'Heading 6',p:'Body text',a:'Link',li:'List item',blockquote:'Quotation'};
  document.querySelectorAll('h1,h2,h3,h4,h5,h6,p,a,li,blockquote').forEach(function(node,index){if(node.dataset.designerTarget)return;var id='preview:'+viewId+':text:'+index;registerTarget(node,{id:id,kind:'element',label:labels[node.tagName.toLowerCase()]||'Text',editable:true});node.dataset.previewEditable='text';node.contentEditable='true';if(Object.prototype.hasOwnProperty.call(texts,id))node.textContent=texts[id]});
  Array.from(document.querySelectorAll('*')).filter(function(node){return !node.dataset.designerTarget&&getComputedStyle(node).backgroundImage!=='none'}).forEach(function(node,index){var id='preview:'+viewId+':image:auto:'+index;registerTarget(node,{id:id,kind:'previewImage',label:'Content image',editable:false});node.dataset.previewEditable='image';if(images[id]&&images[id].url)node.style.backgroundImage='url("'+encodeURI(String(images[id].url)).replace(/"/g,'%22')+'")'});
})();
function nodeOptions(node){return readNodeTargets(node).map(function(target){return {id:target.id,kind:target.kind,label:target.label,text:node.innerText,editable:target.editable===true,tag:node.tagName}})}
function targetAlternatives(target){var seen={};var options=[];for(var node=target;node;node=node.parentElement){nodeOptions(node).forEach(function(option){if(!seen[option.id]){seen[option.id]=true;options.push(option)}})}var hasElements=options.some(function(option){return option.kind==='element'});if(hasElements)return options.filter(function(option){return option.kind==='element'||((option.tag==='UL'||option.tag==='OL')&&option.kind!=='group'&&option.kind!=='layoutSlot')});var specific=options.filter(function(option){return option.kind!=='group'&&option.kind!=='layoutSlot'});return specific.length?specific:options}
var spacingGuideNodes=[];var spacingGuideTarget=null;
function spacingPixels(value){var number=parseFloat(value);return Number.isFinite(number)?number:0}
function spacingSides(style,prefix){return {top:spacingPixels(style[prefix+'Top']),right:spacingPixels(style[prefix+'Right']),bottom:spacingPixels(style[prefix+'Bottom']),left:spacingPixels(style[prefix+'Left'])}}
function hasSpacing(values){return ['top','right','bottom','left'].some(function(side){return Math.abs(values[side])>.25})}
function spacingText(label,values){var names={top:'top',right:'right',bottom:'bottom',left:'left'};var parts=['top','right','bottom','left'].filter(function(side){return Math.abs(values[side])>.25}).map(function(side){var rounded=Math.round(values[side]*10)/10;return names[side]+' '+rounded+' px'});return label+' '+(parts.length?parts.join(' · '):'0 px')}
function removeSpacingGuides(){spacingGuideNodes.forEach(function(node){node.remove()});spacingGuideNodes=[]}
function addSpacingGuide(className,left,top,width,height){var guide=document.createElement('div');guide.className='designer-spacing-guide '+className;guide.style.left=left+'px';guide.style.top=top+'px';guide.style.width=Math.max(0,width)+'px';guide.style.height=Math.max(0,height)+'px';document.body.appendChild(guide);spacingGuideNodes.push(guide)}
function elementSpacing(element){var style=getComputedStyle(element);return {element:element,rect:element.getBoundingClientRect(),margin:spacingSides(style,'margin'),padding:spacingSides(style,'padding'),border:{top:spacingPixels(style.borderTopWidth),right:spacingPixels(style.borderRightWidth),bottom:spacingPixels(style.borderBottomWidth),left:spacingPixels(style.borderLeftWidth)}}}
function outermostSpacing(target){var found=null;for(var node=target.parentElement;node&&node!==document.body&&node!==document.documentElement;node=node.parentElement){var spacing=elementSpacing(node);if(hasSpacing(spacing.margin)||hasSpacing(spacing.padding))found=spacing}return found}
function drawSpacingLayer(spacing,isOuter){var rect=spacing.rect;var suffix=isOuter?' designer-spacing-outer':'';if(hasSpacing(spacing.margin)){var top=Math.max(0,spacing.margin.top);var right=Math.max(0,spacing.margin.right);var bottom=Math.max(0,spacing.margin.bottom);var left=Math.max(0,spacing.margin.left);addSpacingGuide('designer-spacing-margin'+suffix,rect.left-left,rect.top-top,rect.width+left+right,rect.height+top+bottom)}if(hasSpacing(spacing.padding)){addSpacingGuide('designer-spacing-padding'+suffix,rect.left+spacing.border.left+spacing.padding.left,rect.top+spacing.border.top+spacing.padding.top,rect.width-spacing.border.left-spacing.border.right-spacing.padding.left-spacing.padding.right,rect.height-spacing.border.top-spacing.border.bottom-spacing.padding.top-spacing.padding.bottom)}}
function addSpacingLabel(readout,className,label,values){if(!hasSpacing(values))return;var row=document.createElement('div');row.className=className;row.textContent=spacingText(label,values);readout.appendChild(row)}
function showSpacingGuides(target){removeSpacingGuides();if(!target||!target.isConnected)return;var own=elementSpacing(target);var outer=outermostSpacing(target);var hasOwn=hasSpacing(own.margin)||hasSpacing(own.padding);if(!hasOwn&&!outer)return;if(outer)drawSpacingLayer(outer,true);if(hasOwn)drawSpacingLayer(own,false);var readout=document.createElement('div');readout.className='designer-spacing-readout';readout.setAttribute('role','status');addSpacingLabel(readout,'designer-spacing-margin-label','Margin:',own.margin);addSpacingLabel(readout,'designer-spacing-padding-label','Padding:',own.padding);if(outer){addSpacingLabel(readout,'designer-spacing-margin-label','Container margin:',outer.margin);addSpacingLabel(readout,'designer-spacing-padding-label','Container padding:',outer.padding)}document.body.appendChild(readout);spacingGuideNodes.push(readout);var readoutRect=readout.getBoundingClientRect();readout.style.left=Math.max(6,Math.min(own.rect.left,window.innerWidth-readoutRect.width-6))+'px';readout.style.top=(own.rect.top>readoutRect.height+8?own.rect.top-readoutRect.height-6:Math.min(window.innerHeight-readoutRect.height-6,own.rect.bottom+6))+'px'}
document.addEventListener('mouseover',function(event){var target=event.target.closest('[data-designer-target]');if(!target||target===spacingGuideTarget)return;spacingGuideTarget=target;showSpacingGuides(target)});
document.addEventListener('mouseout',function(event){var from=event.target.closest('[data-designer-target]');var to=event.relatedTarget&&event.relatedTarget.closest?event.relatedTarget.closest('[data-designer-target]'):null;if(from&&from!==to){spacingGuideTarget=to;to?showSpacingGuides(to):removeSpacingGuides()}});
document.addEventListener('focusin',function(event){var target=event.target.closest('[data-designer-target]');if(target){spacingGuideTarget=target;showSpacingGuides(target)}});
document.addEventListener('scroll',function(){if(spacingGuideTarget)showSpacingGuides(spacingGuideTarget)},true);window.addEventListener('resize',function(){if(spacingGuideTarget)showSpacingGuides(spacingGuideTarget)});
function send(target,action){var option=nodeOptions(target)[0];if(!option)return;target.dataset.designerLabel=option.label;parent.postMessage({source:'eceee-designer-preview',action:action||'select',targetId:option.id,kind:option.kind,label:option.label,text:option.text,editable:option.editable,alternatives:targetAlternatives(target)},'*')}
document.addEventListener('click',function(event){var target=event.target.closest('[data-designer-target]');if(!target)return;if(event.target.closest('a'))event.preventDefault();event.stopPropagation();document.querySelectorAll('.designer-selected').forEach(function(node){node.classList.remove('designer-selected')});target.classList.add('designer-selected');send(target,'select')});
document.addEventListener('focusout',function(event){var target=event.target.closest('[data-preview-editable="text"]');if(target)send(target,'contentChange')});
window.addEventListener('message',function(event){if(event.data?.source!=='eceee-designer-host'||event.data?.action!=='selectTarget')return;var match;var target=Array.from(document.querySelectorAll('[data-designer-target]')).find(function(node){match=readNodeTargets(node).find(function(option){return option.id===event.data.targetId});return Boolean(match)});if(!target)return;document.querySelectorAll('.designer-selected').forEach(function(node){node.classList.remove('designer-selected')});target.dataset.designerLabel=match.label;target.classList.add('designer-selected')});
</script></body></html>`
}

export default buildSemanticPreviewDocument
