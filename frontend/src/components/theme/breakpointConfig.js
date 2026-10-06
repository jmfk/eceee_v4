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

export const themeBreakpointDefinition = (key) => THEME_BREAKPOINTS.find((breakpoint) => breakpoint.key === key)
