import React, { useEffect, useState } from 'react'
import type { RenderWidgetModel, WidgetRenderComponent, WidgetRenderProps } from './types'
import { processNavigationItems } from '../utils/navigationItems'
import { asArray, EmptyRender, formatDisplayDate, formatDisplayDateTime, imageUrl, ImageView, normalizeContentMediaHtml, PreviewLink, RenderFailure, SafeHtml, sanitizeHtml, TextWithBreaks, value } from './primitives'
import { imageWidgetMediaItems, isImageCollectionReference } from '../utils/imageWidgetMedia'

const ContentRender: WidgetRenderComponent = ({ widget }) => <div className="widget-type-easy-widgets-contentwidget">
    <SafeHtml className={`content-widget${value(widget.config, 'variantClasses') ? ` ${value(widget.config, 'variantClasses')}` : ''}${value(widget.config, 'showBorder', 'show_border') ? ' border-enabled' : ''}`} html={normalizeContentMediaHtml(value(widget.config, 'content', 'html'))} />
</div>

const ObjectDataPreviewRender: WidgetRenderComponent = ({ context }) => {
    const data = context.objectData || {}
    const properties = context.objectType?.schema?.properties || {}
    const entries = Object.entries(data)
    if (!entries.length) return null
    const displayValue = (candidate: any, definition: any): React.ReactNode => {
        if (candidate === null || candidate === undefined || candidate === '') return '—'
        const fieldType = definition?.componentType || definition?.component_type || definition?.field_type || definition?.format || definition?.type
        if (fieldType === 'rich_text') return <SafeHtml html={String(candidate)} />
        if (fieldType === 'image') return <ImageView source={candidate} alt={definition?.title || definition?.label || ''} />
        if (['file', 'document', 'audio', 'video'].includes(fieldType)) {
            const label = candidate?.title || candidate?.filename || candidate?.name || 'Open file'
            return <PreviewLink href={candidate}>{label}</PreviewLink>
        }
        if (Array.isArray(candidate)) {
            return <ul>{candidate.map((item, index) => <li key={index}>{displayValue(item, definition?.items || {})}</li>)}</ul>
        }
        if (typeof candidate === 'object') {
            return <dl>{Object.entries(candidate).map(([name, item]) => <div key={name}><dt>{name}</dt><dd>{displayValue(item, {})}</dd></div>)}</dl>
        }
        if (typeof candidate === 'boolean') return candidate ? 'Yes' : 'No'
        return String(candidate)
    }
    return <dl className="object-data-preview">{entries.map(([name, fieldValue]) => <div key={name} className="object-data-preview-field">
        <dt>{properties[name]?.title || properties[name]?.label || name}</dt>
        <dd>{displayValue(fieldValue, properties[name])}</dd>
    </div>)}</dl>
}

const HeadlineRender: WidgetRenderComponent = ({ widget }) => {
    const requested = String(value(widget.config, 'headerLevel', 'header_level', 'headingLevel', 'level') || 'h1').toLowerCase()
    const Tag = (/^h[1-6]$/.test(requested) ? requested : `h${Math.min(6, Math.max(1, Number(requested) || 1))}`) as React.ElementType
    const content = value(widget.config, 'content', 'text', 'headline')
    if (!content) return null
    return <div className={`headline-widget widget-type-easy-widgets-headlinewidget cms-content${value(widget.config, 'showBorder', 'show_border') ? '' : ' border-disabled'}`} id={value(widget.config, 'anchor') || undefined}>
        <Tag className="headline-content"><SafeHtml as="span" html={content} /></Tag>
    </div>
}

const HeaderRender: WidgetRenderComponent = ({ widget }) => (
    <header className="widget-type-header header-widget block w-full" />
)

const FooterRender: WidgetRenderComponent = ({ widget, renderWidgets }) => (
    <footer className="footer-widget widget-type-easy-widgets-footerwidget" data-slot="content" data-widget-slot="content" data-owner-widget-type={widget.type} style={{
        backgroundColor: value(widget.config, 'backgroundColor', 'background_color') || undefined,
        backgroundImage: imageUrl(value(widget.config, 'backgroundImage', 'background_image')) ? `url('${imageUrl(value(widget.config, 'backgroundImage', 'background_image'))}')` : undefined,
        backgroundSize: value(widget.config, 'backgroundSize', 'background_size') || undefined,
        backgroundPosition: value(widget.config, 'backgroundPosition', 'background_position') || undefined,
        color: value(widget.config, 'textColor', 'text_color') || undefined,
    }}>
        {value(widget.config, 'content') && <SafeHtml html={value(widget.config, 'content')} />}
        {!value(widget.config, 'content') && value(widget.config, 'text') && <p>{value(widget.config, 'text')}</p>}
        {renderWidgets(asArray(value(widget.config, 'slots')?.content))}
    </footer>
)

const HeroRender: WidgetRenderComponent = ({ widget }) => {
    const background = value(widget.config, 'backgroundImageUrl', 'background_image_url') || imageUrl(value(widget.config, 'image', 'backgroundImage', 'background_image'))
    const background2x = value(widget.config, 'backgroundImageUrl2x', 'background_image_url_2x')
    return <div className="hero-widget widget-type-easy-widgets-herowidget cms-content" style={{
        '--hero-text-color': value(widget.config, 'textColor', 'text_color') || '#ffffff',
        '--hero-decor-color': value(widget.config, 'decorColor', 'decor_color') || '#cccccc',
        '--hero-bg-color': value(widget.config, 'backgroundColor', 'background_color') || '#000000',
        backgroundImage: background2x ? `image-set(url('${background}') 1x, url('${background2x}') 2x)` : background ? `url('${background}')` : undefined,
    } as React.CSSProperties}>
        <div className="hero-content">
            {value(widget.config, 'beforeText', 'before_text') && <p className="hero-before-text before-text"><TextWithBreaks>{value(widget.config, 'beforeText', 'before_text')}</TextWithBreaks></p>}
            <h1 className="hero-header">{value(widget.config, 'header', 'title', 'headline') || ''}</h1>
            {value(widget.config, 'afterText', 'after_text') && <p className="hero-after-text after-text"><TextWithBreaks>{value(widget.config, 'afterText', 'after_text')}</TextWithBreaks></p>}
        </div>
    </div>
}

const BannerRender: WidgetRenderComponent = ({ widget }) => {
    const config = widget.config
    const mode = value(config, 'bannerMode', 'banner_mode') || 'text'
    const content = mode === 'header' ? value(config, 'headerContent', 'header_content') : value(config, 'textContent', 'text_content')
    if (!content) return null
    const imageSize = value(config, 'imageSize', 'image_size') || 'square'
    const background = value(config, 'backgroundImageUrl', 'background_image_url')
    const background2x = value(config, 'backgroundImageUrl2x', 'background_image_url_2x')
    const image = value(config, 'image1Url', 'image_1_url') || imageUrl(value(config, 'image1', 'image_1'))
    const image2x = value(config, 'image1Url2x', 'image_1_url_2x')
    return <div
        className={`banner-widget widget-type-easy-widgets-bannerwidget cms-content${value(config, 'showBorder', 'show_border') ? ' border-enabled' : ''}`}
        id={value(config, 'anchor') || undefined}
        style={{ backgroundColor: value(config, 'backgroundColor', 'background_color') || '#ffffff', color: value(config, 'textColor', 'text_color') || '#000000' }}
    >
        {background && <div className="banner-background" style={{ backgroundImage: background2x ? `image-set(url('${background}') 1x, url('${background2x}') 2x)` : `url('${background}')` }} />}
        <div className={`banner-body mode-${mode} image-size-${imageSize}`}>
            <SafeHtml className="banner-text" html={content} />
            {mode === 'text' && image && <div className="banner-images"><img className="banner-image" src={image} srcSet={image2x ? `${image} 1x, ${image2x} 2x` : undefined} alt="" /></div>}
        </div>
    </div>
}

const BioRender: WidgetRenderComponent = ({ widget }) => {
    const config = widget.config
    const image = value(config, 'image')
    const caption = value(config, 'caption')
    const textLayout = value(config, 'textLayout', 'text_layout') || 'column'
    return <div
        className={`bio-widget bio-widget--${textLayout} widget-type-easy-widgets-biowidget`}
        id={value(config, 'anchor') || undefined}
    >
        <div className="bio-widget__container">
            {imageUrl(image) && <div className="bio-widget__image">
                <ImageView source={image} alt={image?.altText || image?.alt_text || image?.alt || image?.title || ''} />
                {caption && <div className="bio-widget__caption"><p>{caption}</p></div>}
            </div>}
            <SafeHtml className="bio-widget__text cms-content" html={value(config, 'bioText', 'bio_text')} />
        </div>
    </div>
}

const MediaView = ({ item, className }: { item: any, className: string }) => {
    const isVideo = item?.type === 'video' || String(item?.mimeType || item?.mime_type || '').startsWith('video/')
    if (isVideo) {
        const source = item?.url || item?.fileUrl || item?.file_url
        if (!source) return null
        return <video className={className} controls poster={item.thumbnail || item.thumbnailUrl || item.thumbnail_url}>
            <source src={source} type={item.mimeType || item.mime_type || 'video/mp4'} />
        </video>
    }
    return imageUrl(item)
        ? <ImageView source={item} alt={item?.altText || item?.alt_text || item?.title || ''} className={className} />
        : null
}

const ImageRender: WidgetRenderComponent = ({ widget }) => {
    const config = widget.config
    const configuredMediaItems = asArray<any>(value(config, 'mediaItems', 'media_items'))
    const items = imageWidgetMediaItems(config, configuredMediaItems)
    const canonicalImage = value(config, 'image')
    const isCanonicalSingle = Boolean(canonicalImage)
        && !isImageCollectionReference(canonicalImage)
    const displayType = isCanonicalSingle ? 'single' : value(config, 'displayType', 'display_type') || 'single'
    const [currentIndex, setCurrentIndex] = useState(0)
    const autoPlay = value(config, 'autoPlay', 'auto_play') === true
    const autoPlayInterval = Number(value(config, 'autoPlayInterval', 'auto_play_interval')) || 3
    useEffect(() => {
        if (currentIndex >= items.length) setCurrentIndex(0)
    }, [currentIndex, items.length])
    useEffect(() => {
        if (displayType !== 'carousel' || !autoPlay || items.length < 2) return undefined
        const interval = window.setInterval(() => setCurrentIndex((index) => (index + 1) % items.length), autoPlayInterval * 1000)
        return () => window.clearInterval(interval)
    }, [autoPlay, autoPlayInterval, displayType, items.length])
    if ((displayType === 'gallery' || displayType === 'carousel') && items.length) {
        return <div className="image-widget widget-type-easy-widgets-imagewidget cms-content" data-widget-type={displayType}>
            <div className={displayType === 'gallery' ? 'gallery-container' : 'carousel-container'}>
                <div className={displayType === 'gallery' ? 'gallery-grid' : 'carousel-track'} style={displayType === 'gallery'
                    ? { gridTemplateColumns: `repeat(${value(config, 'galleryColumns', 'gallery_columns') || 3}, 1fr)` }
                    : { display: 'flex', transform: `translateX(-${currentIndex * 100}%)`, transition: 'transform 300ms ease' }}>
                    {items.map((item, index) => <figure className={displayType === 'gallery' ? 'gallery-item' : 'carousel-slide'} key={item.id || index} style={displayType === 'carousel' ? { flex: '0 0 100%' } : undefined}>
                        <div className="image-container"><MediaView item={item} className={displayType === 'gallery' ? 'gallery-image' : 'carousel-image'} /></div>
                        {value(config, 'showCaptions', 'show_captions') && (item.caption || item.title) && <figcaption className={displayType === 'gallery' ? 'image-caption' : 'carousel-caption'}>{item.caption || item.title}</figcaption>}
                    </figure>)}
                </div>
                {displayType === 'carousel' && items.length > 1 && <>
                    <button type="button" className="carousel-prev" aria-label="Previous slide" onClick={() => setCurrentIndex((index) => (index - 1 + items.length) % items.length)}>←</button>
                    <button type="button" className="carousel-next" aria-label="Next slide" onClick={() => setCurrentIndex((index) => (index + 1) % items.length)}>→</button>
                    <div className="carousel-indicators">{items.map((item, index) => <button
                        type="button"
                        key={item.id || index}
                        className={index === currentIndex ? 'active' : ''}
                        aria-label={`Go to slide ${index + 1}`}
                        aria-current={index === currentIndex ? 'true' : undefined}
                        onClick={() => setCurrentIndex(index)}
                    />)}</div>
                </>}
            </div>
        </div>
    }
    const source = items[0] || value(config, 'imageUrl', 'image_url', 'image', 'src', 'url')
    if (!imageUrl(source)) return null
    const alt = source && typeof source === 'object'
        ? source.altText || source.alt_text || source.alt || source.title || value(config, 'altText', 'alt_text', 'alt') || ''
        : value(config, 'altText', 'alt_text', 'alt') || ''
    return <div className={`image-widget widget-type-easy-widgets-imagewidget image-size-${value(config, 'size') || 'medium'} image-align-${value(config, 'alignment') || 'center'} cms-content`}>
        <figure className="image-container">
            <ImageView source={source} alt={alt} className="widget-image" />
            {value(config, 'caption') && <figcaption className="image-caption">{value(config, 'caption')}</figcaption>}
        </figure>
    </div>
}

const ContentCardRender: WidgetRenderComponent = ({ widget }) => {
    const config = widget.config
    const header = value(config, 'header')
    const content = value(config, 'content')
    const image = value(config, 'image1', 'image_1')
    const imageSize = value(config, 'imageSize', 'image_size') || 'square'
    if (!header && !content && !imageUrl(image)) return null
    return <div
        className={`content-card-widget widget-type-easy-widgets-contentcardwidget cms-content${value(config, 'showBorder', 'show_border') === false ? ' border-disabled' : ''}`}
        id={value(config, 'anchor') || undefined}
    >
        {header && <h2 className="content-card-header"><TextWithBreaks>{header}</TextWithBreaks></h2>}
        <div className={`content-card-body image-size-${imageSize}`}>
            <SafeHtml className="content-card-text" html={content} />
            {imageUrl(image) && <div className="content-card-images">
                <ImageView source={image} alt={image?.altText || image?.alt_text || image?.alt || ''} className="content-card-image" />
            </div>}
        </div>
    </div>
}

const tableCellClassName = (cell: Record<string, any>) => [
    value(cell, 'fontStyle', 'font_style') === 'quote' ? 'table-cell-quote' : '',
    value(cell, 'fontStyle', 'font_style') === 'caption' ? 'table-cell-caption' : '',
    `cell-${value(cell, 'alignment') || 'left'}`,
    value(cell, 'verticalAlignment', 'vertical_alignment') ? `cell-v-${value(cell, 'verticalAlignment', 'vertical_alignment')}` : '',
    value(cell, 'contentType', 'content_type') === 'image' ? 'cell-image' : '',
    value(cell, 'hoverBgColor', 'hover_bg_color') ? 'cell-hover-bg' : '',
    value(cell, 'hoverTextColor', 'hover_text_color') ? 'cell-hover-text' : '',
    value(cell, 'cssClass', 'css_class') || '',
].filter(Boolean).join(' ')

const tableCellStyle = (cell: Record<string, any>, showBorders: boolean): React.CSSProperties => {
    const configuredVerticalAlignment = value(cell, 'verticalAlignment', 'vertical_alignment')
    const verticalAlignment = configuredVerticalAlignment === 'middle' || configuredVerticalAlignment === 'bottom'
        ? configuredVerticalAlignment
        : 'top'
    const style = {
        backgroundColor: value(cell, 'backgroundColor', 'background_color') || undefined,
        color: value(cell, 'textColor', 'text_color') || undefined,
        padding: '0.75rem',
        verticalAlign: verticalAlignment,
        border: showBorders ? '1px solid #d1d5db' : undefined,
        '--cell-hover-bg': value(cell, 'hoverBgColor', 'hover_bg_color') || undefined,
        '--cell-hover-text': value(cell, 'hoverTextColor', 'hover_text_color') || undefined,
    } as React.CSSProperties
    const borders = value(cell, 'borders') || {}
    ;(['top', 'right', 'bottom', 'left'] as const).forEach((side) => {
        const border = borders[side]
        if (!border) return
        const width = border.style === 'thick' ? '3px' : '1px'
        const lineStyle = border.style === 'double' ? 'double' : 'solid'
        const borderValue = `${width} ${lineStyle} ${border.color || '#d1d5db'}`
        if (side === 'top') style.borderTop = borderValue
        if (side === 'right') style.borderRight = borderValue
        if (side === 'bottom') style.borderBottom = borderValue
        if (side === 'left') style.borderLeft = borderValue
    })
    return style
}

const TableCellContent = ({ cell }: { cell: Record<string, any> }) => {
    if (value(cell, 'contentType', 'content_type') === 'image') {
        const image = value(cell, 'imageData', 'image_data')
        return <ImageView source={image} alt={image?.alt || image?.altText || image?.alt_text || ''} />
    }
    return <SafeHtml as="span" className="table-cell-content" html={value(cell, 'content')} />
}

const TableRender: WidgetRenderComponent = ({ widget }) => {
    const config = widget.config
    const rows = asArray<any>(value(config, 'rows', 'data'))
    if (!rows.length) return <EmptyRender>No table data</EmptyRender>
    const showBorders = value(config, 'showBorders', 'show_borders') !== false
    const className = [
        'widget-type-easy-widgets-tablewidget',
        'table-widget',
        'cms-content',
        showBorders ? '' : 'table-no-borders',
        value(config, 'stripedRows', 'striped_rows') ? 'table-striped' : '',
        value(config, 'hoverEffect', 'hover_effect') ? 'table-hover' : '',
        value(config, 'responsive') !== false ? 'table-responsive' : '',
        value(config, 'cssClass', 'css_class') || '',
    ].filter(Boolean).join(' ')
    const columnWidths = asArray<string>(value(config, 'columnWidths', 'column_widths'))
    return <div className={className}>
        <table className={`${value(config, 'tableWidth', 'table_width') === 'full' ? 'w-full' : ''}${showBorders ? ' border' : ''}`} style={{ borderCollapse: 'collapse', borderColor: showBorders ? '#d1d5db' : undefined }}>
            {value(config, 'caption') && <caption className="table-caption text-sm text-gray-600 mb-2">{value(config, 'caption')}</caption>}
            {columnWidths.length > 0 && <colgroup>{columnWidths.map((width, index) => <col key={index} style={{ width }} />)}</colgroup>}
            <tbody>{rows.map((row, rowIndex) => {
                const normalizedRow = Array.isArray(row) ? { cells: row.map((content) => ({ content })) } : row
                const HeaderOrCell = value(normalizedRow, 'isHeader', 'is_header') ? 'th' : 'td'
                return <tr
                    key={rowIndex}
                    className={value(normalizedRow, 'cssClass', 'css_class') || undefined}
                    style={{
                        height: value(normalizedRow, 'height') || undefined,
                        backgroundColor: value(normalizedRow, 'backgroundColor', 'background_color') || undefined,
                    }}
                >{asArray<any>(normalizedRow.cells).map((cell, cellIndex) => {
                    const isImage = value(cell, 'contentType', 'content_type') === 'image'
                    const image = value(cell, 'imageData', 'image_data')
                    const html = sanitizeHtml(value(cell, 'content'))
                    return <HeaderOrCell
                        key={cellIndex}
                        colSpan={Number(value(cell, 'colspan', 'colSpan')) > 1 ? Number(value(cell, 'colspan', 'colSpan')) : undefined}
                        rowSpan={Number(value(cell, 'rowspan', 'rowSpan')) > 1 ? Number(value(cell, 'rowspan', 'rowSpan')) : undefined}
                        className={tableCellClassName(cell)}
                        style={tableCellStyle(cell, showBorders)}
                        {...(!isImage ? { dangerouslySetInnerHTML: { __html: html } } : {})}
                    >{isImage ? <ImageView source={image} alt={image?.alt || image?.altText || image?.alt_text || ''} /> : undefined}</HeaderOrCell>
                })}</tr>
            })}</tbody>
        </table>
    </div>
}

const navigationItems = (config: Record<string, any>, secondary = false) => {
    const staticItems = processNavigationItems(value(
        config,
        ...(secondary ? ['secondaryMenuItems', 'secondary_menu_items'] : ['menuItems', 'menu_items', 'items', 'links']),
    ))
    if (secondary) return staticItems
    return [...staticItems, ...processNavigationItems(value(config, 'dynamicItems', 'dynamic_items'))]
}

const filterNavigationItems = (items: any[], context: WidgetRenderProps['context']): any[] => (
    items.filter((item) => {
        if (!item.isActive || item.isPublished === false) return false
        if (item.type !== 'internal') return true
        if (context.siteId && item.siteId) return String(item.siteId) === String(context.siteId)
        const itemHostnames = asArray<string>(item.cachedRootHostnames || item.cached_root_hostnames)
        if (context.siteHostnames?.length && itemHostnames.length) {
            return context.siteHostnames.some((hostname) => itemHostnames.includes(hostname))
        }
        return true
    }).map((item) => ({
        ...item,
        children: filterNavigationItems(processNavigationItems(item.children), context),
    }))
)

const sameSiteNavigationItems = (config: Record<string, any>, context: WidgetRenderProps['context'], secondary = false) => (
    filterNavigationItems(navigationItems(config, secondary), context)
)

const NavigationList = ({ items, className }: { items: any[], className: string }) => (
    <ul className={className}>{items.map((item, index) => <li key={item.id || index}><PreviewLink href={item.resolvedUrl || item.path || item.url || item}>{item.label || item.title || item.text || ''}</PreviewLink>{asArray<any>(item.children).length > 0 && <NavigationList items={item.children} className="navigation-children" />}</li>)}</ul>
)

const CurrentNavigationList = ({ items }: { items: any[] }) => (
    <ul className="current-menu-list">{items.map((item, index) => <li className="current-menu-item" key={item.id || index}><PreviewLink href={item.resolvedUrl || item.path || item.url}>{item.label || item.title || ''}</PreviewLink></li>)}</ul>
)

const NavigationRender: WidgetRenderComponent = ({ widget, context }) => {
    const style = String(value(widget.config, 'navigationStyle', 'navigation_style') || '')
    const publisherNavigation = value(widget.config, 'publisherNavigation') as Record<string, any> | undefined
    if (style === 'sub-page-navigation' && publisherNavigation?.isInherited) {
        const children = processNavigationItems(publisherNavigation.currentChildren)
        const parent = publisherNavigation.parentPage
        if (children.length) return <nav className="current-page-menu widget-type-navigation widget-type-easy-widgets-navigationwidget"><CurrentNavigationList items={children} /></nav>
        if (Number(publisherNavigation.depth) >= 2 && parent?.path) return <nav className="current-page-menu widget-type-navigation widget-type-easy-widgets-navigationwidget"><ul className="current-menu-list"><li className="current-menu-item"><PreviewLink href={parent.path}>← Back to {parent.title}</PreviewLink></li></ul></nav>
        return null
    }
    const items = sameSiteNavigationItems(widget.config, context)
    return <nav className="navigation-widget widget-type-navigation widget-type-easy-widgets-navigationwidget">{items.length ? <NavigationList items={items} className="nav-container" /> : null}</nav>
}

const NavbarRender: WidgetRenderComponent = ({ widget, context }) => {
    const [open, setOpen] = useState(false)
    const items = sameSiteNavigationItems(widget.config, context)
    const secondaryItems = sameSiteNavigationItems(widget.config, context, true)
    const breakpoint = Number(value(widget.config, 'hamburgerBreakpoint', 'hamburger_breakpoint') || 768)
    const [mobile, setMobile] = useState(false)
    useEffect(() => {
        const update = () => setMobile(window.innerWidth < breakpoint)
        update()
        window.addEventListener('resize', update)
        return () => window.removeEventListener('resize', update)
    }, [breakpoint])
    const renderLink = (item: any, secondary = false) => <PreviewLink
        href={item.resolvedUrl || item.url || item}
        className={`navbar-link${secondary ? ' navbar-secondary-link' : ''}`}
        target={item.targetBlank ? '_blank' : undefined}
        rel={item.targetBlank ? 'noopener noreferrer' : undefined}
        title={item.pageTitle || undefined}
    >{item.label}</PreviewLink>
    return <nav className="widget-type-navbar navbar-widget" style={{ position: 'relative' }}>
        {mobile && <div className="navbar-hamburger-mode" style={{ display: 'flex', alignItems: 'center', height: '100%', padding: '0 20px', justifyContent: 'space-between' }}>
            <button type="button" aria-label="Toggle menu" aria-expanded={open} onClick={() => setOpen((current) => !current)} style={{ color: 'white', background: 'none', border: 'none', cursor: 'pointer', padding: 4, display: 'flex', alignItems: 'center' }}>
                <svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">{open ? <><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></> : <><line x1="3" y1="12" x2="21" y2="12" /><line x1="3" y1="6" x2="21" y2="6" /><line x1="3" y1="18" x2="21" y2="18" /></>}</svg>
            </button>
        </div>}
        {mobile && <div className="navbar-mobile-menu" hidden={!open}>{items.map((item, index) => <div key={index}>{renderLink(item)}</div>)}{secondaryItems.map((item, index) => <div key={`secondary-${index}`}>{renderLink(item, true)}</div>)}</div>}
        {!mobile && <div className="navbar-desktop-menu">
            <ul className="navbar-menu-list navbar-primary-menu">{items.map((item, index) => <li className="navbar-menu-item" key={index}>{renderLink(item)}</li>)}</ul>
            {secondaryItems.length > 0 && <ul className="navbar-menu-list navbar-secondary-menu">{secondaryItems.map((item, index) => <li className="navbar-menu-item" key={index} style={{ backgroundColor: item.backgroundColor || item.background_color || undefined, color: item.textColor || item.text_color || undefined }}>{renderLink(item, true)}</li>)}</ul>}
        </div>}
    </nav>
}

const SidebarRender: WidgetRenderComponent = ({ widget }) => {
    const config = widget.config
    const [collapsed, setCollapsed] = useState(false)
    const sections = asArray<any>(value(config, 'widgets'))
    const background = imageUrl(value(config, 'backgroundImage', 'background_image'))
    return <aside
        className={`widget-type-easy-widgets-sidebarwidget position-${value(config, 'position') || 'right'}${value(config, 'collapsible') ? ' collapsible' : ''}${value(config, 'cssClass', 'css_class') ? ` ${value(config, 'cssClass', 'css_class')}` : ''}`}
        style={{
            backgroundColor: value(config, 'backgroundColor', 'background_color') || undefined,
            backgroundImage: background ? `url('${background}')` : undefined,
            backgroundSize: value(config, 'backgroundSize', 'background_size') || undefined,
            backgroundPosition: value(config, 'backgroundPosition', 'background_position') || undefined,
            color: value(config, 'textColor', 'text_color') || undefined,
            padding: value(config, 'padding') || undefined,
            margin: value(config, 'margin') || undefined,
            width: value(config, 'width') || undefined,
            textAlign: value(config, 'textAlign', 'text_align') || undefined,
        }}
    >
        {value(config, 'collapsible') && <button
            type="button"
            className="sidebar-toggle"
            aria-label="Toggle sidebar"
            aria-expanded={!collapsed}
            onClick={() => setCollapsed((current) => !current)}
        ><span className="sidebar-toggle-icon">☰</span></button>}
        <div className="sidebar-content" hidden={collapsed}>
            {sections.length > 0 ? sections.map((section, index) => <div className="sidebar-section" key={section.id || index}>
                {section.title && <h3 className="sidebar-section-title">{section.title}</h3>}
                {section.content && <SafeHtml className="sidebar-section-content" html={section.content} />}
                {section.type === 'list' && asArray<any>(section.items).length > 0 && <div className="sidebar-widget-list"><ul>
                    {asArray<any>(section.items).map((item, itemIndex) => <li key={item.id || itemIndex}>
                        {item.url ? <PreviewLink href={item.url}>{item.title}</PreviewLink> : item.title}
                        {item.description && <small>{item.description}</small>}
                    </li>)}
                </ul></div>}
            </div>) : <SafeHtml html={value(config, 'content')} />}
        </div>
        {value(config, 'customCss', 'custom_css') && <style>{value(config, 'customCss', 'custom_css')}</style>}
    </aside>
}

const FormFieldRender = ({ field, index, idPrefix, disabled }: { field: Record<string, any>, index: number, idPrefix: string, disabled?: boolean }) => {
    const fieldId = `${idPrefix}_field_${field.name || index}`
    const fieldType = field.type || 'text'
    const options = asArray<string>(field.options)
    const common = {
        id: fieldId,
        name: field.name || `field-${index}`,
        required: Boolean(field.required),
        disabled,
    }
    let control: React.ReactNode
    if (fieldType === 'textarea') {
        control = <textarea {...common} className="form-textarea" placeholder={field.placeholder || ''} defaultValue={value(field, 'defaultValue', 'default_value') || ''} rows={4} />
    } else if (fieldType === 'select') {
        control = <select {...common} className="form-select" defaultValue={value(field, 'defaultValue', 'default_value') || ''}>
            <option value="">Please select...</option>
            {options.map((option) => <option key={option} value={option}>{option}</option>)}
        </select>
    } else if (fieldType === 'checkbox' && options.length) {
        control = <div className="checkbox-options">{options.map((option, optionIndex) => <label className="checkbox-label" key={option}>
            <input id={optionIndex === 0 ? fieldId : `${fieldId}_${optionIndex}`} type="checkbox" name={`${common.name}[]`} value={option} className="form-checkbox" defaultChecked={value(field, 'defaultValue', 'default_value') === option} disabled={disabled} />
            <span className="checkbox-text">{option}</span>
        </label>)}</div>
    } else if (fieldType === 'checkbox') {
        control = <input {...common} type="checkbox" className="form-checkbox" defaultChecked={Boolean(value(field, 'defaultValue', 'default_value'))} />
    } else if (fieldType === 'radio') {
        control = <div className="radio-options">{options.map((option, optionIndex) => <label className="radio-label" key={option}>
            <input type="radio" id={`${fieldId}_${optionIndex}`} name={common.name} value={option} required={common.required && optionIndex === 0} className="form-radio" defaultChecked={value(field, 'defaultValue', 'default_value') === option} disabled={disabled} />
            <span className="radio-text">{option}</span>
        </label>)}</div>
    } else {
        const type = fieldType === 'phone' ? 'tel' : fieldType
        control = <input
            {...common}
            type={type}
            className="form-input"
            placeholder={field.placeholder || ''}
            defaultValue={type === 'file' ? undefined : value(field, 'defaultValue', 'default_value') || ''}
            minLength={field.validation?.min_length}
            maxLength={field.validation?.max_length}
            pattern={field.validation?.pattern}
        />
    }
    return <div className={`form-field${value(field, 'cssClass', 'css_class') ? ` ${value(field, 'cssClass', 'css_class')}` : ''}`} data-field-type={fieldType}>
        <label htmlFor={fieldId} className="field-label">{field.label || field.name}{field.required && <span className="required-indicator" aria-label="Required">*</span>}</label>
        {value(field, 'helpText', 'help_text') && <div className="form-help">{value(field, 'helpText', 'help_text')}</div>}
        {control}
        <div className="field-error" id={`${idPrefix}_error_${index + 1}`} hidden />
    </div>
}

const FormRender: WidgetRenderComponent = ({ widget, context }) => {
    const fields = asArray<any>(value(widget.config, 'fields'))
    const config = widget.config
    const publicForms = context.publicForms
    const hasUnsupportedFile = fields.some((field) => String(field?.type || '').toLowerCase() === 'file')
    const publicSubmissionEnabled = context.mode === 'public'
        && Boolean(publicForms?.endpointBase && publicForms.pagePath)
        && value(config, 'storeSubmissions', 'store_submissions') !== false
        && fields.length > 0
        && !hasUnsupportedFile
    const publicWithoutHandler = context.mode === 'public' && !publicSubmissionEnabled
    const result = publicForms?.result?.widgetId === widget.id ? publicForms.result.status : undefined
    const contents = <>
        {publicSubmissionEnabled && <>
            <input type="hidden" name="__page_path" value={publicForms?.pagePath || ''} />
            {value(config, 'honeypotProtection', 'honeypot_protection') !== false && <div className="form-honeypot" aria-hidden="true" hidden>
                <label htmlFor={`form_${widget.id}_website`}>Leave this field empty</label>
                <input id={`form_${widget.id}_website`} type="text" name="__website" tabIndex={-1} autoComplete="off" />
            </div>}
        </>}
        <div className="form-fields">{fields.map((field, index) => <FormFieldRender field={field} index={index} idPrefix={`form_${widget.id}`} disabled={publicWithoutHandler} key={field.name || index} />)}</div>
        <div className="form-actions">
            <button type={publicWithoutHandler ? 'button' : 'submit'} className="submit-btn" disabled={publicWithoutHandler}>{value(config, 'submitButtonText', 'submit_button_text') || 'Submit'}</button>
            {value(config, 'resetButton', 'reset_button') && <button type={publicWithoutHandler ? 'button' : 'reset'} className="reset-btn" disabled={publicWithoutHandler}>Reset</button>}
        </div>
        {result === 'success' && <div className="form-success" role="status">{value(config, 'successMessage', 'success_message') || 'Thank you for your submission!'}</div>}
        {result === 'error' && <div className="form-error" role="alert">{value(config, 'errorMessage', 'error_message') || 'There was an error submitting the form. Please try again.'}</div>}
        {publicWithoutHandler && <div className="form-error" role="alert">Form submission is currently unavailable.</div>}
    </>
    return <div className="widget-type-easy-widgets-formswidget" data-widget-type="forms">
        {value(config, 'title', 'formTitle', 'form_title') && <header className="form-header">
            <h2 className="form-title">{value(config, 'title', 'formTitle', 'form_title')}</h2>
            {value(config, 'description', 'formDescription', 'form_description') && <p className="form-description">{value(config, 'description', 'formDescription', 'form_description')}</p>}
        </header>}
        {publicWithoutHandler
            ? <div className="dynamic-form forms-widget" data-form-status="submission-unavailable">{contents}</div>
            : publicSubmissionEnabled
                ? <form className="dynamic-form forms-widget" action={`${publicForms!.endpointBase}/${encodeURIComponent(widget.id)}`} method="post" encType="application/x-www-form-urlencoded">{contents}</form>
                : <form className="dynamic-form forms-widget" action={value(config, 'submitUrl', 'submit_url') || '#'} method={String(value(config, 'submitMethod', 'submit_method') || 'POST').toLowerCase()} onSubmit={(event) => event.preventDefault()}>{contents}</form>}
    </div>
}

const ColumnRender = ({ widget, renderWidgets, count }: WidgetRenderProps & { count: number }) => {
    const slots = value(widget.config, 'slots') || {}
    const names = count === 2 ? ['left', 'right'] : ['left', 'center', 'right']
    const base = count === 2 ? 'two-columns-widget' : 'three-columns-widget'
    const slotBase = count === 2 ? 'two-col' : 'three-col'
    const layoutStyle = value(widget.config, 'layoutStyle', 'layout_style')
    const ratio = value(widget.config, 'ratioClass', 'ratio_class')
        || (layoutStyle ? `${count === 2 ? 'two' : 'three'}-col-ratio-${layoutStyle.replaceAll(':', '-')}` : '')
    return <div className={`${base} widget-type-easy-widgets-${count === 2 ? 'twocolumnswidget' : 'threecolumnswidget'} ${ratio}`} data-widget-type={count === 2 ? 'two-columns' : 'three-columns'}>
        {names.map((name) => <div key={name} className={`${slotBase}-slot ${name}`} data-slot={name} data-widget-slot={name} data-owner-widget-type={widget.type}>{asArray<RenderWidgetModel>(slots[name]).map((nested, index) => <div className={`${slotBase}-widget-wrapper`} key={nested.id || index}>{renderWidgets([nested])}</div>)}</div>)}
    </div>
}

const TwoColumnsRender: WidgetRenderComponent = (props) => <ColumnRender {...props} count={2} />
const ThreeColumnsRender: WidgetRenderComponent = (props) => <ColumnRender {...props} count={3} />

const SectionRender: WidgetRenderComponent = ({ widget, renderWidgets }) => {
    const content = asArray<any>(value(widget.config, 'widgets') || value(widget.config, 'slots')?.content || value(widget.config, 'slots')?.main)
    const collapsible = Boolean(value(widget.config, 'enableCollapse', 'enable_collapse'))
    const accordion = Boolean(value(widget.config, 'accordionMode', 'accordion_mode'))
    const bordered = Boolean(value(widget.config, 'showBorder', 'show_border'))
    const [expanded, setExpanded] = useState(value(widget.config, 'startExpanded', 'start_expanded') !== false)
    useEffect(() => {
        if (!collapsible || !accordion) return undefined
        const collapseOther = (event: Event) => {
            if ((event as CustomEvent).detail !== widget.id) setExpanded(false)
        }
        window.addEventListener('eceee-section-expand', collapseOther)
        return () => window.removeEventListener('eceee-section-expand', collapseOther)
    }, [accordion, collapsible, widget.id])
    if (!content.length) return null
    const variants = value(widget.config, 'variantClasses') ? ` ${value(widget.config, 'variantClasses')}` : ''
    if (!collapsible) return <div className="widget-type-easy-widgets-sectionwidget"><div id={value(widget.config, 'anchor') || undefined} data-slot="content" data-widget-slot="content" data-owner-widget-type={widget.type} className={`section-content-only-widget${variants}${bordered ? ' border-enabled' : ''}`}>{renderWidgets(content)}</div></div>
    const toggleExpanded = () => setExpanded((current) => {
        if (!current && accordion) window.dispatchEvent(new CustomEvent('eceee-section-expand', { detail: widget.id }))
        return !current
    })
    return <div className="widget-type-easy-widgets-sectionwidget"><div id={value(widget.config, 'anchor') || undefined} data-accordion-mode={accordion || undefined} className={`section-widget${variants}${bordered ? ' border-enabled' : ''}${expanded ? '' : ' section-collapsed'}`}>
        <div className="slot-section-content" data-slot="content" data-widget-slot="content" data-owner-widget-type={widget.type}>
            {renderWidgets(content.slice(0, 1))}
            {expanded && <div className="section-remaining-content">{renderWidgets(content.slice(1))}</div>}
            <button type="button" className={expanded ? 'section-banner contract-banner' : 'section-banner expand-banner'} aria-expanded={expanded} onClick={toggleExpanded}>{expanded ? value(widget.config, 'contractText', 'contract_text') || 'Show less' : value(widget.config, 'expandText', 'expand_text') || 'Expand to read more'}</button>
        </div>
    </div></div>
}

const PathDebugRender: WidgetRenderComponent = ({ widget, context }) => (
    <pre className="path-debug-widget">{JSON.stringify({ path: context.simulatedPath || '/', variables: context.pathVariables || {}, config: widget.config }, null, 2)}</pre>
)

const newsState = (widget: WidgetRenderProps['widget']) => {
    if (widget.data?.status === 'loading') return <EmptyRender>Loading news…</EmptyRender>
    if (widget.data?.status === 'error') return <RenderFailure message={widget.data.error} />
    const items = asArray<any>(widget.data?.items || value(widget.config, 'items'))
    return items.length ? items : <EmptyRender>No news articles available.</EmptyRender>
}

const newsFields = (item: any) => {
    const data = item.data || {}
    const metadata = item.metadata || {}
    const objectType = item.objectType || item.object_type || {}
    return {
        objectType,
        path: item.path || (objectType.name && item.slug ? `/${objectType.name}/${item.slug}/` : '#'),
        image: data.featuredImage || data.featured_image || item.featuredImage || item.featured_image || item.image,
        thumbnail: item.thumbnailUrl || item.thumbnail_url || data.thumbnailUrl || data.thumbnail_url || data.featuredImage || data.featured_image || item.image,
        excerpt: data.summary || item.summary || data.excerpt || item.excerptText || item.excerpt_text || item.excerpt || '',
        publishDate: data.presentationalPublishingDate || data.presentational_publishing_date || item.publishDate || item.publish_date || metadata.publishDate || metadata.publish_date,
        pinned: Boolean(item.isPinned || item.is_pinned || item.isFeatured || item.is_featured || metadata.pinned || metadata.featured),
        metadata,
    }
}

const configEnabled = (config: Record<string, any>, defaultValue: boolean, ...names: string[]) => {
    const configured = value(config, ...names)
    return configured === undefined ? defaultValue : configured !== false
}

const truncateExcerpt = (source: unknown, configuredLength: unknown, stripHtml = false) => {
    if (source === undefined || source === null) return ''
    const text = stripHtml ? String(source).replace(/<[^>]+>/g, '') : String(source)
    const requestedLength = Number(configuredLength)
    const length = Number.isInteger(requestedLength) && requestedLength > 0 ? requestedLength : 150
    if (text.length <= length) return text
    const shortened = text.slice(0, length)
    const lastSpace = shortened.lastIndexOf(' ')
    return `${lastSpace > 0 ? shortened.slice(0, lastSpace) : shortened}...`
}

const objectListExcerpt = (item: any, config: Record<string, any>) => {
    const data = item.data || {}
    const configuredField = value(config, 'excerptField', 'excerpt_field')
    const source = configuredField && Object.prototype.hasOwnProperty.call(data, configuredField)
        ? data[configuredField]
        : ['content', 'description', 'summary', 'text', 'body'].map((field) => data[field]).find(Boolean)
    return truncateExcerpt(source, value(config, 'excerptLength', 'excerpt_length'))
}

const newsListExcerpt = (item: any, config: Record<string, any>) => {
    const data = item.data || {}
    const source = data.summary || data.excerpt || data.description || data.content || newsFields(item).excerpt
    return truncateExcerpt(source, value(config, 'excerptLength', 'excerpt_length'), true)
}

const NewsListRender: WidgetRenderComponent = ({ widget, context }) => {
    if (configEnabled(widget.config, false, 'hideOnDetailView', 'hide_on_detail_view') && Object.keys(context.pathVariables || {}).length) return null
    const state = newsState(widget)
    if (!Array.isArray(state)) return <section className="news-list-widget" data-widget-type="news-list">{state}</section>
    const showImage = configEnabled(widget.config, true, 'showFeaturedImage', 'show_featured_image')
    const showExcerpt = configEnabled(widget.config, true, 'showExcerpts', 'show_excerpts')
    const showDate = configEnabled(widget.config, true, 'showPublishDate', 'show_publish_date')
    return <section className="news-list-widget" data-widget-type="news-list"><div className="news-items-container">{state.map((item, index) => {
        const fields = newsFields(item)
        const excerpt = newsListExcerpt(item, widget.config)
        return <article className={`news-item${fields.pinned ? ' pinned' : ''}`} data-object-id={item.id} key={item.id || index}>
            {showImage && <div className="news-featured-image"><ImageView source={fields.image} alt={item.title || ''} /></div>}
            <div className="news-content"><div className="news-meta"><span className="news-type">{fields.objectType.label || fields.objectType.name}</span>{fields.pinned && <span className="pinned-badge">Pinned</span>}{showDate && fields.publishDate && <time className="news-date" dateTime={fields.publishDate}>{formatDisplayDate(fields.publishDate)}</time>}</div>
                <h3 className="news-title"><PreviewLink href={fields.path}>{item.title || `Article ${index + 1}`}</PreviewLink></h3>
                {showExcerpt && excerpt && <p className="news-excerpt">{excerpt}</p>}
                <div className="news-footer"><PreviewLink className="read-more" href={fields.path}>Read more →</PreviewLink></div>
            </div>
        </article>
    })}</div></section>
}
const NewsDetailRender: WidgetRenderComponent = ({ widget, context, renderWidgets }) => {
    if (widget.data?.status === 'error') return <RenderFailure message={widget.data.error} />
    const item: any = widget.data?.item || value(widget.config, 'item')
    if (!item && Object.keys(context.pathVariables || {}).length) return null
    if (!item) return <EmptyRender>{value(widget.config, 'emptyMessage', 'empty_message') || 'No news article selected.'}</EmptyRender>
    const fields = newsFields(item)
    const data = item.data || {}
    const slots: Record<string, unknown> = item.widgets && typeof item.widgets === 'object' ? item.widgets : {}
    const renderObjectWidgets = configEnabled(widget.config, true, 'renderObjectWidgets', 'render_object_widgets')
    const hasStructuredWidgets = renderObjectWidgets && Object.keys(slots).length > 0
    const summary = data.summary || item.summary || ''
    const externalUrl = data.externalUrl || data.external_url || ''
    return <article className="news-detail-widget" data-widget-type="news-detail" data-object-id={item.id}>
        <header className="news-header">
            {configEnabled(widget.config, true, 'showObjectType', 'show_object_type') && <div className="news-type-badge">{fields.objectType.label || fields.objectType.name}</div>}
            <h1 className="news-title">{item.title}</h1>
            {configEnabled(widget.config, true, 'showMetadata', 'show_metadata') && <div className="news-metadata">
                {fields.publishDate && <div className="news-metadata-item"><span className="news-metadata-label">Published:</span> <time dateTime={fields.publishDate}>{formatDisplayDate(fields.publishDate)}</time></div>}
                {fields.metadata.author && <div className="news-metadata-item"><span className="news-metadata-label">Author:</span> <span>{fields.metadata.author}</span></div>}
            </div>}
        </header>
        {configEnabled(widget.config, true, 'showFeaturedImage', 'show_featured_image') && <div className="news-featured-image"><ImageView source={fields.image} alt={item.title || ''} /></div>}
        {summary && <p className="news-summary">{summary}</p>}
        {!hasStructuredWidgets && <SafeHtml className="news-content" html={data.content || data.body || data.text || item.content} />}
        {hasStructuredWidgets && <div className="news-object-widgets">{Object.entries(slots).map(([slotName, widgets]) => <div className={`news-widget-slot news-widget-slot-${slotName}`} data-slot={slotName} data-widget-slot={slotName} data-owner-widget-type={widget.type} key={slotName}>{renderWidgets(asArray<any>(widgets).map((nested, index) => ({ ...nested, id: String(nested.id || `${slotName}-${index}`), type: nested.type || nested.widget_type, config: nested.config || {} })))}</div>)}</div>}
        {externalUrl && <div className="news-external-source"><PreviewLink href={externalUrl} rel="noopener noreferrer">Read the original source</PreviewLink></div>}
    </article>
}
const ObjectListRender: WidgetRenderComponent = ({ widget }) => {
    const state = newsState(widget)
    if (!Array.isArray(state)) return <section className="object-list-widget" data-widget-type="object-list">{state}</section>
    const showExcerpt = configEnabled(widget.config, true, 'showExcerpt', 'show_excerpt')
    const showHierarchy = configEnabled(widget.config, false, 'showHierarchy', 'show_hierarchy')
    const template = value(widget.config, 'displayTemplate', 'display_template') || 'card'
    return <section className={`object-list-widget template-${template}`} data-widget-type="object-list"><div className="objects-container">{state.map((item, index) => {
        const fields = newsFields(item)
        const excerpt = objectListExcerpt(item, widget.config)
        const parent = item.parent
        const level = Number(item.level) || 0
        return <article className={`object-item${showHierarchy ? ` level-${level}` : ''}`} key={item.id || index}>
            {showHierarchy && level > 0 && <div className="hierarchy-indicator" style={{ marginLeft: `${level * 20}px` }}><span className="hierarchy-line">└─</span></div>}
            <div className="object-content"><h3 className="object-title"><PreviewLink href={fields.path}>{item.title}</PreviewLink></h3>
                {showExcerpt && excerpt && <div className="object-excerpt">{excerpt}</div>}
                <div className="object-meta"><span className="object-type">{fields.objectType.label || fields.objectType.name}</span>{fields.publishDate && <time className="object-date" dateTime={fields.publishDate}> • {formatDisplayDate(fields.publishDate, 'short')}</time>}{showHierarchy && parent && <span className="object-parent"> • Child of: {parent.title}</span>}</div>
            </div>
        </article>
    })}</div></section>
}
const ObjectDetailRender: WidgetRenderComponent = ({ widget, renderWidgets }) => {
    const item: any = widget.data?.item
    if (!item) return <div className="object-detail-widget" data-widget-type="object-detail"><div className="widget-empty"><p>Object not found.</p></div></div>
    const fields = newsFields(item)
    const slots: Record<string, unknown> = item.widgets && typeof item.widgets === 'object' ? item.widgets : {}
    const showWidgets = configEnabled(widget.config, true, 'showWidgets', 'show_widgets')
    const showMetadata = configEnabled(widget.config, false, 'showMetadata', 'show_metadata')
    const hasWidgetSlots = Object.keys(slots).length > 0
    const dataEntries = Object.entries(item.data || {}).filter(([, fieldValue]) => Boolean(fieldValue))
    const showHierarchy = configEnabled(widget.config, true, 'showHierarchy', 'show_hierarchy')
    const ancestors = asArray<any>(item.ancestors)
    const children = asArray<any>(item.children)
    return <article className={`object-detail-widget template-${value(widget.config, 'displayTemplate', 'display_template') || 'full'}`} data-widget-type="object-detail" data-object-id={item.id}>
        <header className="object-header"><h1 className="object-title">{item.title}</h1><div className="object-meta"><span className="object-type">{fields.objectType.label || fields.objectType.name}</span>{fields.publishDate && <time className="object-date" dateTime={fields.publishDate}> • Published {formatDisplayDate(fields.publishDate)}</time>}</div>
            {showHierarchy && ancestors.length > 0 && <div className="object-hierarchy"><h4>Location in hierarchy:</h4><div className="breadcrumb">{ancestors.map((ancestor, index) => <React.Fragment key={ancestor.id || index}><PreviewLink href={ancestor.path}>{ancestor.title}</PreviewLink><span>→</span></React.Fragment>)}<span>{item.title}</span></div></div>}
        </header>
        <div className="object-content">{showWidgets && hasWidgetSlots
            ? Object.entries(slots).map(([slotName, widgets]) => <div className="widget-slot" data-slot={slotName} data-widget-slot={slotName} data-owner-widget-type={widget.type} key={slotName}>{renderWidgets(asArray<any>(widgets).map((nested, index) => ({ ...nested, id: String(nested.id || `${slotName}-${index}`), type: nested.type || nested.widget_type, config: nested.config || {} })))}</div>)
            : dataEntries.map(([fieldName, fieldValue]) => <div className="object-field" key={fieldName}><h4 className="field-label">{fieldName.replaceAll('_', ' ')}</h4><div className="field-value">{typeof fieldValue === 'object' ? JSON.stringify(fieldValue) : String(fieldValue)}</div></div>)}</div>
        {showHierarchy && children.length > 0 && <section className="object-children"><h3>Related Content</h3><div className="children-grid">{children.map((child, index) => {
            const childFields = newsFields(child)
            return <div className="child-item" key={child.id || index}><h4 className="child-title"><PreviewLink href={child.path}>{child.title}</PreviewLink></h4><p className="child-meta">{childFields.objectType.label || childFields.objectType.name}{childFields.publishDate && <> • {formatDisplayDate(childFields.publishDate, 'short')}</>}</p></div>
        })}</div></section>}
        {showMetadata && <footer className="object-metadata"><details><summary>Technical Details</summary><div>
            <p><strong>Object ID:</strong> {item.id}</p>
            <p><strong>Slug:</strong> {item.slug}</p>
            <p><strong>Tree Level:</strong> {item.level}</p>
            {item.createdAt && <p><strong>Created:</strong> <time dateTime={item.createdAt}>{formatDisplayDateTime(item.createdAt)}</time></p>}
            {item.updatedAt && <p><strong>Last Updated:</strong> <time dateTime={item.updatedAt}>{formatDisplayDateTime(item.updatedAt)}</time></p>}
            {item.metadata && Object.keys(item.metadata).length > 0 && <p><strong>Metadata:</strong> {JSON.stringify(item.metadata)}</p>}
        </div></details></footer>}
    </article>
}
const TopNewsPlugRender: WidgetRenderComponent = ({ widget }) => {
    const state = newsState(widget)
    if (!Array.isArray(state)) return <section className="top-news-plug-widget" data-widget-type="top-news-plug">{state}</section>
    const showExcerpt = configEnabled(widget.config, true, 'showExcerpts', 'show_excerpts')
    const showDate = configEnabled(widget.config, true, 'showPublishDate', 'show_publish_date')
    const showType = configEnabled(widget.config, true, 'showObjectType', 'show_object_type')
    return <section className={`top-news-plug-widget layout-${value(widget.config, 'layout') || '1x3'}`} data-widget-type="top-news-plug"><div className="news-grid">{state.map((item, index) => {
        const fields = newsFields(item)
        const data = item.data || {}
        const excerptSource = data.summary || data.excerpt || data.description || data.content || fields.excerpt
        const excerpt = truncateExcerpt(excerptSource, value(widget.config, 'excerptLength', 'excerpt_length') ?? 100, true)
        const pinned = Boolean(fields.metadata.pinned || fields.metadata.featured)
        return <article className={`news-card${pinned ? ' pinned' : ''}`} data-object-id={item.id} key={item.id || index}>
            {fields.image && <div className="news-image"><ImageView source={fields.image} alt={item.title || ''} /></div>}
            <div className="news-body"><div className="news-meta">{showType && <span className="news-type-badge">{fields.objectType.label || fields.objectType.name}</span>}{showDate && fields.publishDate && <time className="news-date" dateTime={fields.publishDate}>{formatDisplayDate(fields.publishDate, 'short')}</time>}</div>
                <h3 className="news-title"><PreviewLink href={fields.path}>{item.title || `Article ${index + 1}`}</PreviewLink></h3>
                {showExcerpt && excerpt && <p className="news-excerpt">{excerpt}</p>}
                <div className="news-footer"><PreviewLink className="read-more" href={fields.path}>Read more</PreviewLink></div>
            </div>
        </article>
    })}</div></section>
}
const SidebarTopNewsRender: WidgetRenderComponent = ({ widget }) => {
    const state = newsState(widget)
    const showThumbnails = configEnabled(widget.config, true, 'showThumbnails', 'show_thumbnails')
    const showDates = configEnabled(widget.config, true, 'showDates', 'show_dates')
    const showType = configEnabled(widget.config, false, 'showObjectType', 'show_object_type')
    const showExcerpt = configEnabled(widget.config, false, 'showExcerpts', 'show_excerpts')
    return <aside className="sidebar-top-news-widget" data-widget-type="sidebar-top-news">
        {value(widget.config, 'widgetTitle', 'widget_title') && <h3 className="widget-title">{value(widget.config, 'widgetTitle', 'widget_title')}</h3>}
        {Array.isArray(state) ? <ul className="news-list">{state.map((item, index) => {
            const fields = newsFields(item)
            const data = item.data || {}
            const excerptSource = data.summary || data.excerpt || data.description || fields.excerpt
            const excerpt = truncateExcerpt(excerptSource, value(widget.config, 'excerptLength', 'excerpt_length') ?? 120, true)
            const pinned = Boolean(fields.metadata.pinned || fields.metadata.featured)
            return <li className={`news-item${pinned ? ' pinned' : ''}`} data-object-id={item.id} key={item.id || index}>
                {showThumbnails && fields.thumbnail && <div className="news-thumbnail"><ImageView source={fields.thumbnail} alt={item.title || ''} /></div>}
                <div className="news-content"><div className="news-meta">{showType && <span className="news-type-badge">{fields.objectType.label || fields.objectType.name}</span>}{showDates && fields.publishDate && <time className="news-date" dateTime={fields.publishDate}>{formatDisplayDate(fields.publishDate, 'short')}</time>}</div>
                    <h4 className="news-title"><PreviewLink href={fields.path}>{item.title || `Article ${index + 1}`}</PreviewLink></h4>
                    {showExcerpt && excerpt && <p className="news-excerpt">{excerpt}</p>}
                </div>
            </li>
        })}</ul> : state}
    </aside>
}

export const RENDER_WIDGET_COMPONENTS: Record<string, WidgetRenderComponent> = {
    'easy_widgets.FooterWidget': FooterRender,
    'easy_widgets.ContentWidget': ContentRender,
    'easy_widgets.ContentCardWidget': ContentCardRender,
    'easy_widgets.BannerWidget': BannerRender,
    'easy_widgets.BioWidget': BioRender,
    'easy_widgets.ImageWidget': ImageRender,
    'easy_widgets.TableWidget': TableRender,
    'easy_widgets.HeaderWidget': HeaderRender,
    'easy_widgets.HeadlineWidget': HeadlineRender,
    'easy_widgets.HeroWidget': HeroRender,
    'easy_widgets.NavbarWidget': NavbarRender,
    'easy_widgets.NavigationWidget': NavigationRender,
    'easy_widgets.SidebarWidget': SidebarRender,
    'easy_widgets.FormsWidget': FormRender,
    'easy_widgets.TwoColumnsWidget': TwoColumnsRender,
    'easy_widgets.ThreeColumnsWidget': ThreeColumnsRender,
    'easy_widgets.PathDebugWidget': PathDebugRender,
    'easy_widgets.NewsListWidget': NewsListRender,
    'easy_widgets.NewsDetailWidget': NewsDetailRender,
    'easy_widgets.TopNewsPlugWidget': TopNewsPlugRender,
    'easy_widgets.SidebarTopNewsWidget': SidebarTopNewsRender,
    'easy_widgets.SectionWidget': SectionRender,
}

export const PUBLIC_DATA_WIDGET_COMPONENTS: Record<string, WidgetRenderComponent> = {
    'object_storage.ObjectListWidget': ObjectListRender,
    'object_storage.ObjectDetailWidget': ObjectDetailRender,
}

export const DESIGNER_RENDER_WIDGET_COMPONENTS: Record<string, WidgetRenderComponent> = {
    'designer.ObjectDataPreview': ObjectDataPreviewRender,
}
