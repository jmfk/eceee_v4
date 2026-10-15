import manifest from './generated/render-manifest.json'
import { PUBLIC_RENDER_CSS } from './publicRenderCss'
import { generateDesignGroupsCSS, getBreakpoints } from '../utils/themeUtils'

type JsonObject = Record<string, any>

export interface NormalizedThemeCssConfig {
    fonts: JsonObject
    colors: JsonObject
    cssVariables: JsonObject
    breakpoints: Record<string, number>
    designGroups: JsonObject
    htmlElements: JsonObject
    componentStyles: Record<string, JsonObject>
    imageStyles: Record<string, JsonObject>
    customCss: string
}

export interface EffectivePageCss {
    enabled: boolean
    variables: JsonObject
    customCss: string
}

export interface CompiledRenderStyles {
    css: string
    fontUrl: string
}

export interface CompileRenderStylesInput {
    theme?: JsonObject | null
    page?: JsonObject | null
    version?: JsonObject | null
    pageCss?: EffectivePageCss
    resolveBackgroundImage?: (image: JsonObject) => JsonObject
}

const object = (value: unknown): JsonObject => value && typeof value === 'object' && !Array.isArray(value)
    ? value as JsonObject
    : {}

const nonEmptyObject = (value: unknown): JsonObject => object(value)

const read = (source: JsonObject | null | undefined, camel: string, snake: string): any => (
    source?.[camel] ?? source?.[snake]
)

const enabled = (source: JsonObject | null | undefined): boolean => {
    const value = read(source, 'enableCssInjection', 'enable_css_injection')
    return value === undefined || value === null ? true : value !== false
}

const normalizeBackgroundImages = (
    designGroups: JsonObject,
    resolver?: (image: JsonObject) => JsonObject,
): JsonObject => {
    const normalizeImage = (rawImage: unknown): JsonObject => {
        const source = object(rawImage)
        const resolved = resolver ? object(resolver(source)) : source
        return {
            ...resolved,
            url: resolved.url ?? resolved.fileUrl ?? resolved.file_url ?? resolved.publicUrl
                ?? resolved.public_url ?? resolved.imgproxyBaseUrl ?? resolved.imgproxy_base_url,
            oneX: resolved.oneX ?? resolved.one_x,
            twoX: resolved.twoX ?? resolved.two_x,
            backgroundSize: resolved.backgroundSize ?? resolved.background_size,
            backgroundPosition: resolved.backgroundPosition ?? resolved.background_position,
            backgroundRepeat: resolved.backgroundRepeat ?? resolved.background_repeat,
            useAspectRatio: resolved.useAspectRatio ?? resolved.use_aspect_ratio,
            aspectRatio: resolved.aspectRatio ?? resolved.aspect_ratio,
        }
    }
    const groups = (Array.isArray(designGroups.groups) ? designGroups.groups : []).map((rawGroup: unknown) => {
        const group = object(rawGroup)
        const elements = Object.fromEntries(Object.entries(object(group.elements)).map(([element, rawStyles]) => [
            element,
            Object.fromEntries(Object.entries(object(rawStyles)).map(([property, value]) => (
                property === 'backgroundImage' || property === 'background_image'
                    ? ['backgroundImage', normalizeImage(value)]
                    : [property, value]
            ))),
        ]))
        const layoutProperties = object(group.layoutProperties ?? group.layout_properties)
        const resolvedLayout = Object.fromEntries(Object.entries(layoutProperties).map(([part, rawBreakpoints]) => [
            part,
            Object.fromEntries(Object.entries(object(rawBreakpoints)).map(([breakpoint, rawProperties]) => {
                const properties = object(rawProperties)
                const background = properties.backgroundImage ?? properties.background_image
                if (!background || typeof background !== 'object') return [breakpoint, properties]
                const normalizedProperties = { ...properties }
                delete normalizedProperties.background_image
                return [breakpoint, {
                    ...normalizedProperties,
                    backgroundImage: normalizeImage(background),
                }]
            })),
        ]))
        return { ...group, elements, layoutProperties: resolvedLayout, layout_properties: undefined }
    })
    return { ...designGroups, groups }
}

export const normalizeThemeCssConfig = (
    rawTheme: JsonObject | null | undefined,
    options: Pick<CompileRenderStylesInput, 'resolveBackgroundImage'> = {},
): NormalizedThemeCssConfig => {
    const theme = object(rawTheme)
    const rawDesignGroups = object(theme.designGroups ?? theme.design_groups ?? theme.typography)
    const designGroups = normalizeBackgroundImages({
        ...rawDesignGroups,
        groups: (Array.isArray(rawDesignGroups.groups) ? rawDesignGroups.groups : []).map((rawGroup: unknown) => {
            const group = object(rawGroup)
            return {
                ...group,
                widgetTypes: group.widgetTypes ?? group.widget_types,
                widgetType: group.widgetType ?? group.widget_type,
                targetingMode: group.targetingMode ?? group.targeting_mode,
                targetCssClasses: group.targetCssClasses ?? group.target_css_classes,
                cssModifier: group.cssModifier ?? group.css_modifier,
                layoutProperties: group.layoutProperties ?? group.layout_properties,
            }
        }),
        structuralSpacing: rawDesignGroups.structuralSpacing ?? rawDesignGroups.structural_spacing ?? [],
    }, options.resolveBackgroundImage)
    const legacyGallery = object(theme.galleryStyles ?? theme.gallery_styles)
    const legacyCarousel = object(theme.carouselStyles ?? theme.carousel_styles)
    const unifiedImages = object(theme.imageStyles ?? theme.image_styles)
    const rawBreakpoints = object(theme.breakpoints)
    const breakpoints = Object.fromEntries(Object.entries(rawBreakpoints).flatMap(([name, value]) => {
        const pixels = Number(value)
        return Number.isFinite(pixels) && pixels >= 0 ? [[name, pixels]] : []
    }))

    return {
        fonts: object(theme.fonts),
        colors: object(theme.colors),
        cssVariables: object(theme.cssVariables ?? theme.css_variables),
        breakpoints: getBreakpoints({ breakpoints }) as Record<string, number>,
        designGroups,
        htmlElements: object(theme.htmlElements ?? theme.html_elements),
        componentStyles: object(theme.componentStyles ?? theme.component_styles),
        imageStyles: { ...legacyGallery, ...legacyCarousel, ...unifiedImages },
        customCss: String(theme.customCss ?? theme.custom_css ?? ''),
    }
}

export const resolveEffectivePageCss = (
    page?: JsonObject | null,
    version?: JsonObject | null,
): EffectivePageCss => {
    const pageVariables = nonEmptyObject(read(page, 'pageCssVariables', 'page_css_variables'))
    const versionVariables = nonEmptyObject(read(version, 'pageCssVariables', 'page_css_variables'))
    const pageCustomCss = String(read(page, 'pageCustomCss', 'page_custom_css') ?? '')
    const versionCustomCss = String(read(version, 'pageCustomCss', 'page_custom_css') ?? '')
    return {
        enabled: enabled(page) && enabled(version),
        variables: Object.keys(versionVariables).length ? versionVariables : pageVariables,
        customCss: versionCustomCss.trim() ? versionCustomCss : pageCustomCss,
    }
}

export const googleFontsStylesheetUrl = (fonts: JsonObject | null | undefined): string => {
    const source = object(fonts)
    const families = Array.isArray(source.googleFonts)
        ? source.googleFonts
        : Array.isArray(source.google_fonts) ? source.google_fonts : []
    const definitions = families.flatMap((rawFont: unknown) => {
        const font = object(rawFont)
        const family = String(font.family ?? '').trim().replace(/\s+/g, '+')
        if (!family) return []
        const variants = Array.isArray(font.variants)
            ? font.variants.map(String).filter((variant: string) => /^\d+$/.test(variant))
            : []
        const display = /^(auto|block|fallback|optional|swap)$/.test(String(font.display))
            ? String(font.display)
            : 'swap'
        return [{ query: `family=${family}${variants.length ? `:wght@${variants.join(';')}` : ''}`, display }]
    })
    return definitions.length
        ? `https://fonts.googleapis.com/css2?${definitions.map(definition => definition.query).join('&')}&display=${definitions[0].display}`
        : ''
}

export const compileResponsiveCss = (css: unknown, breakpoints: Record<string, number>): string => {
    if (typeof css === 'string') return css
    const responsive = object(css)
    const parts = [responsive.default, responsive.xs]
        .filter((value): value is string => typeof value === 'string' && Boolean(value))
    const responsiveKeys = Object.keys(responsive)
        .filter(key => key !== 'default' && key !== 'xs' && typeof responsive[key] === 'string' && responsive[key])
        .map(key => ({ key, pixels: /^\d+$/.test(key) ? Number(key) : breakpoints[key] }))
        .filter(({ pixels }) => Number.isFinite(pixels) && pixels > 0)
        .sort((left, right) => left.pixels - right.pixels)
    for (const { key, pixels } of responsiveKeys) {
        parts.push(`@media (min-width: ${pixels}px) {\n${responsive[key]}\n}`)
    }
    return parts.join('\n')
}

const styleCollectionCss = (styles: Record<string, JsonObject>, breakpoints: Record<string, number>): string => (
    Object.values(styles).map(style => compileResponsiveCss(style?.css, breakpoints)).filter(Boolean).join('\n')
)

const legacyElementsCss = (elements: JsonObject): string => Object.entries(elements).map(([selector, properties]) => {
    const declarations = Object.entries(object(properties)).flatMap(([property, value]) => {
        if (!['string', 'number'].includes(typeof value)) return []
        const cssProperty = property.replace(/_/g, '-').replace(/([a-z0-9])([A-Z])/g, '$1-$2').toLowerCase()
        return [`  ${cssProperty}: ${String(value)};`]
    })
    return declarations.length ? `${selector} {\n${declarations.join('\n')}\n}` : ''
}).filter(Boolean).join('\n')

const variablesCss = (variables: JsonObject): string => {
    const declarations = Object.entries(variables).flatMap(([name, value]) => (
        ['string', 'number'].includes(typeof value) && /^[a-zA-Z0-9_-]+$/.test(name)
            ? [`  --${name.replace(/^--/, '')}: ${String(value)};`]
            : []
    ))
    return declarations.length ? `:root {\n${declarations.join('\n')}\n}` : ''
}

const widgetCss = (): string => {
    const widgets = manifest.widgets as Record<string, { css?: string, cssVariables?: Record<string, string> }>
    const variables: Record<string, string> = {}
    const rules: string[] = []
    for (const [type, widget] of Object.entries(widgets)) {
        Object.assign(variables, widget.cssVariables || {})
        if (widget.css) rules.push(`/* Widget: ${type} */\n${widget.css}`)
    }
    return [variablesCss(variables), ...rules].filter(Boolean).join('\n\n')
}

export const compileRenderStyles = ({
    theme: rawTheme,
    page,
    version,
    pageCss,
    resolveBackgroundImage,
}: CompileRenderStylesInput): CompiledRenderStyles => {
    const theme = normalizeThemeCssConfig(rawTheme, { resolveBackgroundImage })
    const effectivePageCss = pageCss || resolveEffectivePageCss(page, version)
    const colors = Object.keys(theme.colors).length ? theme.colors : theme.cssVariables
    const structuralSpacing = theme.designGroups.structuralSpacing || []
    const designCss = theme.designGroups.groups?.length
        ? generateDesignGroupsCSS(theme.designGroups, colors, '', undefined, undefined, false, theme.breakpoints)
        : [
            legacyElementsCss(theme.htmlElements),
            structuralSpacing.length
                ? generateDesignGroupsCSS(theme.designGroups, colors, '', undefined, undefined, false, theme.breakpoints)
                : '',
        ].filter(Boolean).join('\n\n')
    const variables = effectivePageCss.enabled
        ? { ...colors, ...effectivePageCss.variables }
        : colors
    return {
        css: [
            manifest.baseCss,
            PUBLIC_RENDER_CSS,
            widgetCss(),
            variablesCss(variables),
            designCss,
            styleCollectionCss(theme.componentStyles, theme.breakpoints),
            styleCollectionCss(theme.imageStyles, theme.breakpoints),
            theme.customCss,
            effectivePageCss.enabled ? effectivePageCss.customCss : '',
        ].filter(Boolean).join('\n\n'),
        fontUrl: googleFontsStylesheetUrl(theme.fonts),
    }
}
