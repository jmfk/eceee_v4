// Presentation-only contract, mirrored by webpages/text_outline_styles.py.
export const DEFAULT_TEXT_OUTLINE = {
    name: 'Text outline', style: 'outline', colorMode: 'black', color: '#000000',
    thickness: 1, radius: 4, angle: 45, offset: 2, opacity: 100,
}
export const defaultTextOutlineStyles = () => ({
    dark: { ...DEFAULT_TEXT_OUTLINE, name: 'Dark outline', colorMode: 'black' },
    light: { ...DEFAULT_TEXT_OUTLINE, name: 'Light outline', colorMode: 'white' },
})

// No outline is intrinsic; every other choice comes from the effective theme.
export const textOutlineOptions = styles => ({
    none: 'No outline',
    ...Object.fromEntries(Object.entries(styles || {}).filter(([key]) => isTextOutlineKey(key))
        .map(([key, style]) => [key, style.name || key])),
})

export const isTextOutlineKey = key => typeof key === 'string'
    && /^[A-Za-z][A-Za-z0-9_-]{0,63}$/.test(key)
    && !['none', '__proto__', 'constructor', 'prototype'].includes(key)

export const textOutlineShadow = raw => {
    const style = { ...DEFAULT_TEXT_OUTLINE, ...raw }
    if (!['outline', 'gradientBlur', 'dropShadow'].includes(style.style)) return 'none'
    const limits = { thickness: [0, 20], radius: [0, 100], angle: [-360, 360], offset: [-100, 100], opacity: [0, 100] }
    for (const [field, [min, max]] of Object.entries(limits)) {
        if (typeof style[field] !== 'number' || !Number.isFinite(style[field]) || style[field] < min || style[field] > max) return 'none'
    }
    const colors = {
        same: 'currentColor', white: '#ffffff', black: '#000000',
        complement: 'rgb(from currentColor calc(255 - r) calc(255 - g) calc(255 - b))',
        rgb: /^#[0-9a-f]{6}$/i.test(style.color) ? style.color : '#000000',
    }
    if (!Object.hasOwn(colors, style.colorMode)) return 'none'
    let color = colors[style.colorMode]
    if (style.opacity !== 100) color = `color-mix(in srgb, ${color} ${style.opacity}%, transparent)`
    const angle = style.angle * Math.PI / 180
    const distance = style.style === 'dropShadow' ? style.offset : 0
    const x = Math.cos(angle) * distance
    const y = Math.sin(angle) * distance
    const blur = style.style === 'outline' ? 0 : style.radius
    const format = number => String(Number((Math.abs(number) < 0.0005 ? 0 : number).toFixed(3)))
    const layer = (dx, dy) => `${format(dx)}px ${format(dy)}px ${blur}px ${color}`
    if (!style.thickness) return layer(x, y)
    return Array.from({ length: 16 }, (_, i) => layer(
        x + Math.cos(i * Math.PI / 8) * style.thickness,
        y + Math.sin(i * Math.PI / 8) * style.thickness,
    )).join(', ')
}

export const textOutlineCss = styles => ':root {' + Object.entries(styles || {})
    .filter(([key, style]) => isTextOutlineKey(key) && style && typeof style === 'object')
    .map(([key, style]) => `--text-outline-${key}: ${textOutlineShadow(style)};`).join('') + '}'
