import { useState } from 'react'
import LinkPicker from './LinkPicker'
import MediaSelectModal from './media/MediaSelectModal'
import './website-settings.css'

type Settings = { language?: string; noIndex?: boolean; shareImageId?: string; translations?: Record<string, string>; analyticsEnabled?: boolean; analyticsRequireConsent?: boolean }
export default function WebsiteSettings({ value = {}, onChange, isRoot, pageId }: { value?: Settings; onChange: (value: Settings) => void; isRoot: boolean; pageId: string | number }) {
    const [mediaOpen, setMediaOpen] = useState(false)
    const [pageOpen, setPageOpen] = useState(false)
    const [translationTitle, setTranslationTitle] = useState('')
    const [language, setLanguage] = useState('')
    const [translationId, setTranslationId] = useState('')
    const update = (patch: Partial<Settings>) => onChange({ ...value, ...patch })
    return <section className="website-settings" aria-labelledby="website-settings-heading">
        <h2 id="website-settings-heading">Language, sharing and privacy</h2>
        <label className="website-field"><input placeholder=" " value={value.language || ''} pattern="[a-z]{2,3}(-[a-zA-Z0-9]{2,8})*" onChange={event => update({ language: event.target.value })} /><span>Page language (en, sv…)</span></label>
        <label className="website-check"><input type="checkbox" checked={value.noIndex === true} onChange={event => update({ noIndex: event.target.checked })} />Hide from search engines and sitemap</label>
        <div className="website-actions"><button type="button" onClick={() => setMediaOpen(true)}>{value.shareImageId ? 'Change sharing image' : 'Choose sharing image'}</button>
            {value.shareImageId && <button type="button" onClick={() => update({ shareImageId: '' })}>Remove sharing image</button>}</div>
        <p>Only public media appears when the page is shared. An empty image inherits the site image.</p>
        <h3>Translated pages</h3>
        {Object.entries(value.translations || {}).map(([code, id]) => <div className="website-actions" key={code}><span>{code}: page {id}</span><button type="button" aria-label={`Remove ${code} translation`} onClick={() => { const translations = { ...value.translations }; delete translations[code]; update({ translations }) }}>Remove</button></div>)}
        <div className="website-actions">
            <label className="website-field"><input placeholder=" " value={language} onChange={event => setLanguage(event.target.value)} /><span>Translation language</span></label>
            <button type="button" onClick={() => setPageOpen(true)}>{translationTitle || 'Choose translated page'}</button>
            <button type="button" disabled={!/^[a-z]{2,3}(?:-[a-zA-Z0-9]{2,8})*$/.test(language) || !/^\d{1,19}$/.test(translationId) || BigInt(translationId) > 9_223_372_036_854_775_807n} onClick={() => { update({ translations: { ...value.translations, [language]: translationId } }); setLanguage(''); setTranslationId(''); setTranslationTitle('') }}>Add translation</button>
        </div>
        <p>Links are shown after the translated page is published on this site.</p>
        {isRoot && <><h3>Visit statistics</h3>
            <label className="website-check"><input type="checkbox" checked={value.analyticsEnabled === true} onChange={event => update({ analyticsEnabled: event.target.checked })} />Enable anonymous page view statistics</label>
            <label className="website-check"><input type="checkbox" checked={value.analyticsRequireConsent !== false} onChange={event => update({ analyticsRequireConsent: event.target.checked })} />Ask for consent before collecting statistics</label>
            <p>No tracking cookies or visitor identifiers are created. Visitors can decline or withdraw statistics through Privacy settings.</p>
        </>}
        <p>Changes take effect when this page version is published. Previous public page addresses redirect automatically after an address change.</p>
        <LinkPicker isOpen={pageOpen} onClose={() => setPageOpen(false)} currentPageId={pageId} allowedTypes={['internal']} onSave={({ link, title }: any) => { if (link?.pageId) { setTranslationId(String(link.pageId)); setTranslationTitle(title || 'Page selected') } }} />
        <MediaSelectModal isOpen={mediaOpen} onClose={() => setMediaOpen(false)} pageId={pageId} allowCollections={false} multiple={false} customTitle="Choose sharing image" onSelect={(items: any) => { update({ shareImageId: String(items?.[0]?.id || '') }); setMediaOpen(false) }} />
    </section>
}
