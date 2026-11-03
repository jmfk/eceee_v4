const legacyLayoutKeys: Record<string, string> = {
    main_layout: 'mainLayout',
    landing_page: 'landingPage',
    error_layout: 'errorLayout',
}

export const canonicalLayoutKey = (key: string): string => legacyLayoutKeys[key] || key
