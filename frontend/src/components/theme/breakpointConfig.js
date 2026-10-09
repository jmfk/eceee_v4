import { Monitor, Smartphone, Tablet, Tv } from 'lucide-react'

export const THEME_BREAKPOINTS = [
    {
        key: 'sm',
        label: 'Small (Mobile)',
        description: 'Small devices and mobile phones',
        icon: Smartphone,
        defaultValue: 640,
    },
    {
        key: 'md',
        label: 'Medium (Tablet)',
        description: 'Tablets and small laptops',
        icon: Tablet,
        defaultValue: 768,
    },
    {
        key: 'lg',
        label: 'Large (Desktop)',
        description: 'Desktops and large screens',
        icon: Monitor,
        defaultValue: 1024,
    },
    {
        key: 'xl',
        label: 'Extra Large',
        description: 'Large desktops and displays',
        icon: Tv,
        defaultValue: 1280,
    },
]

export const DESIGNER_PREVIEW_BREAKPOINTS = [
    {
        key: 'xs',
        label: 'Base (Mobile)',
        description: 'The base styles used below the Small breakpoint',
        icon: Smartphone,
        defaultValue: 0,
    },
    ...THEME_BREAKPOINTS,
]

export const themeBreakpointDefinition = (key) => DESIGNER_PREVIEW_BREAKPOINTS.find((breakpoint) => breakpoint.key === key)

export const designerPreviewWidth = (key, breakpoints = {}) => {
    if (key === 'xs') {
        const smallWidth = Number(breakpoints.sm ?? THEME_BREAKPOINTS[0].defaultValue)
        return Math.max(1, Math.min(375, smallWidth - 1))
    }
    const definition = themeBreakpointDefinition(key)
    return Number(breakpoints[key] ?? definition?.defaultValue ?? 1280)
}
