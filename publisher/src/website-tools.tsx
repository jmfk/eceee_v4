'use client';
import { useEffect, useRef, useState } from 'react';

type Info = { language: string; translations: { language: string; path: string }[]; analyticsEnabled: boolean; analyticsRequireConsent: boolean };
export const consentKey = 'eceee-statistics-consent-v1';
export function analyticsAllowed(info: Pick<Info, 'analyticsEnabled' | 'analyticsRequireConsent'>, choice: string | null, doNotTrack: boolean) {
  return info.analyticsEnabled && !doNotTrack && choice !== 'denied' && (!info.analyticsRequireConsent || choice === 'granted');
}
export function WebsiteTools({ info }: { info: Info }) {
  const [choice, setChoice] = useState<string | null>(null);
  const [ready, setReady] = useState(false);
  const [editing, setEditing] = useState(false);
  const sent = useRef(false);
  useEffect(() => {
    try { const saved = localStorage.getItem(consentKey); setChoice(saved === 'granted' || saved === 'denied' ? saved : null); } catch { /* No storage: require consent each visit. */ }
    setReady(true);
    const sync = (event: StorageEvent) => { if (event.key === consentKey) setChoice(event.newValue === 'granted' || event.newValue === 'denied' ? event.newValue : null); };
    window.addEventListener('storage', sync);
    return () => window.removeEventListener('storage', sync);
  }, []);
  useEffect(() => {
    const privacy = navigator as Navigator & { globalPrivacyControl?: boolean };
    if (!ready || sent.current || !analyticsAllowed(info, choice, navigator.doNotTrack === '1' || privacy.globalPrivacyControl === true)) return;
    sent.current = true;
    const controller = new AbortController();
    void fetch('/api/statistics', { method: 'POST', credentials: 'omit', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ path: window.location.pathname, consent: choice === 'granted' }), signal: controller.signal }).catch(() => {});
    return () => { controller.abort(); sent.current = false; };
  }, [ready, choice, info.analyticsEnabled, info.analyticsRequireConsent]);
  const choose = (next: 'granted' | 'denied') => {
    setChoice(next); setEditing(false);
    try { localStorage.setItem(consentKey, next); } catch { /* The current visit still respects the choice. */ }
  };
  return <div className="eceee-website-tools">
    <nav aria-label="Website tools" style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 16, padding: '12px 20px', fontFamily: 'system-ui, sans-serif', fontSize: 14 }}>
      <a href="/site-tools/search">Search and archives</a>
      {info.translations.map(item => <a key={item.language} href={item.path} hrefLang={item.language} lang={item.language}>{item.language}</a>)}
      {info.analyticsEnabled && <button type="button" aria-expanded={editing} onClick={() => setEditing(previous => !previous)}>Privacy settings</button>}
    </nav>
    {info.analyticsEnabled && ready && (editing || info.analyticsRequireConsent && choice === null) && <section aria-label="Visit statistics" style={{ padding: '12px 20px', fontFamily: 'system-ui, sans-serif', fontSize: 14 }}>
      <p>Allow anonymous page view statistics? No tracking cookies or visitor identifiers are created. You can change this choice in Privacy settings.</p>
      <div style={{ display: 'flex', gap: 16 }}><button type="button" onClick={() => choose('granted')}>Allow statistics</button><button type="button" onClick={() => choose('denied')}>Decline statistics</button></div>
      {choice && <p role="status">Statistics {choice === 'granted' ? 'allowed' : 'declined'}.</p>}
    </section>}
    <style>{`.eceee-website-tools button{font:inherit;min-height:32px;padding:4px 8px}.eceee-website-tools :focus-visible{outline:2px solid #1464c8;outline-offset:3px}`}</style>
  </div>;
}
