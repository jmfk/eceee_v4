import React, { useEffect, useState } from 'react'
import type { WidgetRenderComponent, WidgetRenderProps } from './types'
import { processNavigationItems } from '../utils/navigationItems'
import { asArray, EmptyRender, imageUrl, ImageView, PreviewLink, RenderFailure, SafeHtml, TextWithBreaks, value } from './primitives'

const ContentRender: WidgetRenderComponent = ({ widget }) => <div className="widget-type-easy-widgets-contentwidget">
    <SafeHtml className={`content-widget${value(widget.config, 'showBorder', 'show_border') ? ' border-enabled' : ''}`} html={value(widget.config, 'content', 'html')} />
</div>

const HeadlineRender: WidgetRenderComponent = ({ widget }) => {
    const requested = String(value(widget.config, 'headerLevel', 'header_level', 'headingLevel', 'level') || 'h1').toLowerCase()
    const Tag = (/^h[1-6]$/.test(requested) ? requested : `h${Math.min(6, Math.max(1, Number(requested) || 1))}`) as keyof JSX.IntrinsicElements
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
    <footer className="footer-widget widget-type-easy-widgets-footerwidget" style={{
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
            {value(widget.config, 'beforeText', 'before_text') && <h5 className="before-text"><TextWithBreaks>{value(widget.config, 'beforeText', 'before_text')}</TextWithBreaks></h5>}
            <div><h1>{value(widget.config, 'header', 'title', 'headline') || ''}</h1></div>
            {value(widget.config, 'afterText', 'after_text') && <h6 className="after-text"><TextWithBreaks>{value(widget.config, 'afterText', 'after_text')}</TextWithBreaks></h6>}
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

const ImageRender: WidgetRenderComponent = ({ widget }) => {
    const config = widget.config
    const displayType = value(config, 'displayType', 'display_type') || 'single'
    const mediaItems = asArray<any>(value(config, 'mediaItems', 'media_items'))
    const items = mediaItems
    if ((displayType === 'gallery' || displayType === 'carousel') && items.length) {
        return <div className="image-widget widget-type-easy-widgets-imagewidget cms-content" data-widget-type={displayType}>
            <div className={displayType === 'gallery' ? 'gallery-container' : 'carousel-container'}>
                <div className={displayType === 'gallery' ? 'gallery-grid' : 'carousel-track'} style={displayType === 'gallery' ? { gridTemplateColumns: `repeat(${value(config, 'galleryColumns', 'gallery_columns') || 3}, 1fr)` } : undefined}>
                    {items.map((item, index) => <div className={displayType === 'gallery' ? 'gallery-item' : 'carousel-slide'} key={item.id || index}>
                        <div className="image-container"><ImageView source={item.thumbnailUrl || item.thumbnail_url || item} alt={item.altText || item.alt_text || item.title || ''} className={displayType === 'gallery' ? 'gallery-image' : 'carousel-image'} /></div>
                        {value(config, 'showCaptions', 'show_captions') && (item.caption || item.title) && <div className={displayType === 'gallery' ? 'image-caption' : 'carousel-caption'}>{item.caption || item.title}</div>}
                    </div>)}
                </div>
            </div>
        </div>
    }
    const source = mediaItems[0] || value(config, 'imageUrl', 'image_url', 'image', 'src', 'url')
    if (!imageUrl(source)) return null
    return <div className={`image-widget widget-type-easy-widgets-imagewidget image-size-${value(config, 'size') || 'medium'} image-align-${value(config, 'alignment') || 'center'} cms-content`}>
        <div className="image-container"><ImageView source={source} alt={value(config, 'altText', 'alt_text', 'alt') || ''} className="widget-image" /></div>
        {value(config, 'caption') && <div className="image-caption">{value(config, 'caption')}</div>}
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
        {header && <div className="content-card-header"><TextWithBreaks>{header}</TextWithBreaks></div>}
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
    value(cell, 'cssClass', 'css_class') || '',
].filter(Boolean).join(' ')

const tableCellStyle = (cell: Record<string, any>): React.CSSProperties => {
    const style: React.CSSProperties = {
        backgroundColor: value(cell, 'backgroundColor', 'background_color') || undefined,
        color: value(cell, 'textColor', 'text_color') || undefined,
    }
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
    return <SafeHtml as="span" html={value(cell, 'content')} />
}

const TableRender: WidgetRenderComponent = ({ widget }) => {
    const config = widget.config
    const rows = asArray<any>(value(config, 'rows', 'data'))
    if (!rows.length) return <EmptyRender>No table data</EmptyRender>
    const className = [
        'widget-type-easy-widgets-tablewidget',
        'cms-content',
        value(config, 'stripedRows', 'striped_rows') ? 'table-striped' : '',
        value(config, 'hoverEffect', 'hover_effect') ? 'table-hover' : '',
        value(config, 'responsive') !== false ? 'table-responsive' : '',
        value(config, 'cssClass', 'css_class') || '',
    ].filter(Boolean).join(' ')
    const columnWidths = asArray<string>(value(config, 'columnWidths', 'column_widths'))
    return <div className={className}>
        {value(config, 'caption') && <div className="table-caption text-sm text-gray-600 mb-2">{value(config, 'caption')}</div>}
        <table className={`${value(config, 'tableWidth', 'table_width') === 'full' ? 'w-full' : ''}${value(config, 'showBorders', 'show_borders') !== false ? ' border' : ''}`}>
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
                >{asArray<any>(normalizedRow.cells).map((cell, cellIndex) => <HeaderOrCell
                    key={cellIndex}
                    colSpan={Number(value(cell, 'colspan', 'colSpan')) > 1 ? Number(value(cell, 'colspan', 'colSpan')) : undefined}
                    rowSpan={Number(value(cell, 'rowspan', 'rowSpan')) > 1 ? Number(value(cell, 'rowspan', 'rowSpan')) : undefined}
                    className={tableCellClassName(cell)}
                    style={tableCellStyle(cell)}
                ><TableCellContent cell={cell} /></HeaderOrCell>)}</tr>
            })}</tbody>
        </table>
    </div>
}

const navigationItems = (config: Record<string, any>, secondary = false) => processNavigationItems(value(
    config,
    ...(secondary ? ['secondaryMenuItems', 'secondary_menu_items'] : ['menuItems', 'menu_items', 'items', 'links']),
)).filter((item) => item.isActive && item.isPublished !== false)

const NavigationList = ({ items, className }: { items: any[], className: string }) => (
    <ul className={className}>{items.map((item, index) => <li key={item.id || index}><PreviewLink href={item.resolvedUrl || item.path || item.url || item}>{item.label || item.title || item.text || ''}</PreviewLink>{asArray<any>(item.children).length > 0 && <NavigationList items={processNavigationItems(item.children)} className="navigation-children" />}</li>)}</ul>
)

const NavigationRender: WidgetRenderComponent = ({ widget, context }) => {
    const items = navigationItems(widget.config).filter((item) => {
        if (item.type !== 'internal') return true
        if (context.siteId && item.siteId) return String(item.siteId) === String(context.siteId)
        const itemHostnames = asArray<string>(item.cachedRootHostnames || item.cached_root_hostnames)
        if (context.siteHostnames?.length && itemHostnames.length) return context.siteHostnames.some((hostname) => itemHostnames.includes(hostname))
        return true
    })
    return <nav className="navigation-widget widget-type-navigation widget-type-easy-widgets-navigationwidget">{items.length ? <NavigationList items={items} className="nav-container" /> : null}</nav>
}

const NavbarRender: WidgetRenderComponent = ({ widget }) => {
    const [open, setOpen] = useState(false)
    const items = navigationItems(widget.config)
    const secondaryItems = navigationItems(widget.config, true)
    const breakpoint = Number(value(widget.config, 'hamburgerBreakpoint', 'hamburger_breakpoint') || 768)
    const [mobile, setMobile] = useState(() => typeof window !== 'undefined' && window.innerWidth < breakpoint)
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
            <button type="button" aria-label="Toggle menu" aria-expanded={open} onClick={() => setOpen((current) => !current)}>☰</button>
        </div>}
        {mobile && open && <div className="navbar-mobile-menu">{items.map((item, index) => <div key={index}>{renderLink(item)}</div>)}{secondaryItems.map((item, index) => <div key={`secondary-${index}`}>{renderLink(item, true)}</div>)}</div>}
        {!mobile && <div className="navbar-desktop-menu">
            <ul className="navbar-menu-list">{items.map((item, index) => <li className="navbar-menu-item" key={index}>{renderLink(item)}</li>)}</ul>
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

const FormFieldRender = ({ field, index }: { field: Record<string, any>, index: number }) => {
    const fieldId = `field_${field.name || index}`
    const fieldType = field.type || 'text'
    const options = asArray<string>(field.options)
    const common = {
        id: fieldId,
        name: field.name || `field-${index}`,
        required: Boolean(field.required),
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
            <input id={optionIndex === 0 ? fieldId : `${fieldId}_${optionIndex}`} type="checkbox" name={`${common.name}[]`} value={option} className="form-checkbox" defaultChecked={value(field, 'defaultValue', 'default_value') === option} />
            <span className="checkbox-text">{option}</span>
        </label>)}</div>
    } else if (fieldType === 'checkbox') {
        control = <input {...common} type="checkbox" className="form-checkbox" defaultChecked={Boolean(value(field, 'defaultValue', 'default_value'))} />
    } else if (fieldType === 'radio') {
        control = <div className="radio-options">{options.map((option, optionIndex) => <label className="radio-label" key={option}>
            <input type="radio" id={`${fieldId}_${optionIndex}`} name={common.name} value={option} required={common.required && optionIndex === 0} className="form-radio" defaultChecked={value(field, 'defaultValue', 'default_value') === option} />
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
        <div className="field-error" id={`error_${index + 1}`} hidden />
    </div>
}

const FormRender: WidgetRenderComponent = ({ widget }) => {
    const fields = asArray<any>(value(widget.config, 'fields'))
    const config = widget.config
    return <div className="widget-type-easy-widgets-formswidget" data-widget-type="forms">
        {value(config, 'title', 'formTitle', 'form_title') && <header className="form-header">
            <h2 className="form-title">{value(config, 'title', 'formTitle', 'form_title')}</h2>
            {value(config, 'description', 'formDescription', 'form_description') && <div className="form-description">{value(config, 'description', 'formDescription', 'form_description')}</div>}
        </header>}
        <form className="dynamic-form forms-widget" action={value(config, 'submitUrl', 'submit_url') || '#'} method={String(value(config, 'submitMethod', 'submit_method') || 'POST').toLowerCase()} onSubmit={(event) => event.preventDefault()}>
            <div className="form-fields">{fields.map((field, index) => <FormFieldRender field={field} index={index} key={field.name || index} />)}</div>
            <div className="form-actions">
                <button type="submit" className="submit-btn">{value(config, 'submitButtonText', 'submit_button_text') || 'Submit'}</button>
                {value(config, 'resetButton', 'reset_button') && <button type="reset" className="reset-btn">Reset</button>}
            </div>
        </form>
    </div>
}

const ColumnRender = ({ widget, renderWidgets, count }: WidgetRenderProps & { count: number }) => {
    const slots = value(widget.config, 'slots') || {}
    const names = count === 2 ? ['left', 'right'] : ['left', 'center', 'right']
    const base = count === 2 ? 'two-columns-widget' : 'three-columns-widget'
    const slotBase = count === 2 ? 'two-col' : 'three-col'
    const ratio = value(widget.config, 'ratioClass', 'ratio_class') || (count === 3 && value(widget.config, 'layoutStyle', 'layout_style') ? `three-col-ratio-${value(widget.config, 'layoutStyle', 'layout_style').replaceAll(':', '-')}` : '')
    return <div className={`${base} widget-type-easy-widgets-${count === 2 ? 'twocolumnswidget' : 'threecolumnswidget'} ${ratio}`} data-widget-type={count === 2 ? 'two-columns' : 'three-columns'}>
        {names.map((name) => <div key={name} className={`${slotBase}-slot ${name}`} data-slot={name}>{asArray(slots[name]).map((nested, index) => <div className={`${slotBase}-widget-wrapper`} key={nested.id || index}>{renderWidgets([nested])}</div>)}</div>)}
    </div>
}

const TwoColumnsRender: WidgetRenderComponent = (props) => <ColumnRender {...props} count={2} />
const ThreeColumnsRender: WidgetRenderComponent = (props) => <ColumnRender {...props} count={3} />

const SectionRender: WidgetRenderComponent = ({ widget, renderWidgets }) => {
    const content = asArray<any>(value(widget.config, 'widgets') || value(widget.config, 'slots')?.content || value(widget.config, 'slots')?.main)
    const collapsible = Boolean(value(widget.config, 'enableCollapse', 'enable_collapse'))
    const [expanded, setExpanded] = useState(value(widget.config, 'startExpanded', 'start_expanded') !== false)
    if (!content.length) return null
    if (!collapsible) return <div className="widget-type-easy-widgets-sectionwidget"><div id={value(widget.config, 'anchor') || undefined} className="section-content-only-widget">{renderWidgets(content)}</div></div>
    return <div className="widget-type-easy-widgets-sectionwidget"><div id={value(widget.config, 'anchor') || undefined} className={`section-widget${expanded ? '' : ' section-collapsed'}`}>
        <div className="slot-section-content">
            {renderWidgets(content.slice(0, 1))}
            {expanded && <div className="section-remaining-content">{renderWidgets(content.slice(1))}</div>}
            <button type="button" className={expanded ? 'section-banner contract-banner' : 'section-banner expand-banner'} onClick={() => setExpanded((current) => !current)}>{expanded ? value(widget.config, 'contractText', 'contract_text') || 'Show less' : value(widget.config, 'expandText', 'expand_text') || 'Expand to read more'}</button>
        </div>
    </div></div>
}

const PathDebugRender: WidgetRenderComponent = ({ widget, context }) => (
    <pre className="path-debug-widget">{JSON.stringify({ path: context.simulatedPath || '/', variables: context.pathVariables || {}, config: widget.config }, null, 2)}</pre>
)

const NewsItems = ({ widget, compact = false }: { widget: WidgetRenderProps['widget'], compact?: boolean }) => {
    if (widget.data?.status === 'loading') return <EmptyRender>Loading news…</EmptyRender>
    if (widget.data?.status === 'error') return <RenderFailure message={widget.data.error} />
    const items = asArray<any>(widget.data?.items || value(widget.config, 'items'))
    if (!items.length) return <EmptyRender>No news articles available.</EmptyRender>
    return <div className={compact ? 'news-items compact' : 'news-items'}>{items.map((item, index) => <article className="news-item" key={item.id || index}><ImageView source={item.data?.featured_image || item.image} alt="" /><div className="news-content"><h3><PreviewLink href={item.path || '#'}>{item.title || `Article ${index + 1}`}</PreviewLink></h3>{!compact && <p>{item.data?.excerpt || item.excerpt || item.summary || ''}</p>}</div></article>)}</div>
}

const NewsListRender: WidgetRenderComponent = ({ widget }) => <section className="news-list-widget"><NewsItems widget={widget} /></section>
const NewsDetailRender: WidgetRenderComponent = ({ widget }) => {
    if (widget.data?.status === 'error') return <RenderFailure message={widget.data.error} />
    const item: any = widget.data?.item || value(widget.config, 'item')
    return <article className="news-detail-widget">{item ? <><h1>{item.title}</h1><ImageView source={item.data?.featured_image || item.image} alt="" /><SafeHtml html={item.data?.content || item.content} /></> : <EmptyRender>No news article selected.</EmptyRender>}</article>
}
const TopNewsPlugRender: WidgetRenderComponent = ({ widget }) => <section className="top-news-plug-widget"><NewsItems widget={widget} /></section>
const SidebarTopNewsRender: WidgetRenderComponent = ({ widget }) => <section className="sidebar-top-news-widget"><h2>{value(widget.config, 'widget_title', 'widgetTitle') || 'Top news'}</h2><NewsItems widget={widget} compact /></section>

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
