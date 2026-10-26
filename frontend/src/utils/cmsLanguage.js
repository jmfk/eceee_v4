export const DEFAULT_CMS_LANGUAGE = 'en-us'

export const resolveCmsLanguage = (preference = '', browserLanguages = []) => {
    if (preference === 'en-us' || preference === 'sv-se') return preference
    const first = browserLanguages[0] || ''
    return first.toLowerCase().split('-')[0] === 'sv' ? 'sv-se' : DEFAULT_CMS_LANGUAGE
}

export const getBrowserLanguages = () => {
    if (typeof navigator === 'undefined') return []
    return navigator.languages?.length ? navigator.languages : [navigator.language]
}

export const helpLanguageFor = (cmsLanguage) => cmsLanguage === 'sv-se' ? 'sv' : 'en'
