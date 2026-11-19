import type { ReactNode } from 'react';
import { headers } from 'next/headers';
import { requestPage } from '@/src/request-page';
import { database } from '@/src/db';
import { siteContext } from '@/src/website';
export default async function RootLayout({ children }: { children: ReactNode }) {
  const requestHeaders = await headers();
  const host = requestHeaders.get('host') || '';
  const path = requestHeaders.get('x-eceee-path') || '/';
  let language = 'en';
  try {
    const page = await requestPage(host, path);
    language = page?.website.language || (await siteContext(database, host, false))?.settings.language || 'en';
  } catch { /* Error pages must remain renderable during a database outage. */ }
  return <html lang={language}><body style={{ margin: 0 }}>{children}</body></html>;
}
