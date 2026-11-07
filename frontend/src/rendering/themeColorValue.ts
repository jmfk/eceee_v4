/** Palette tokens are CSS variables; literal CSS colours remain valid fallbacks. */
export const themeColorValue = (value: string): string => /^[a-z][a-z0-9_-]*$/i.test(value)
    ? `var(--${value}, ${value})` : value
