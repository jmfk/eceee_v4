import { headers } from 'next/headers';
import { notFound } from 'next/navigation';
import { database } from '@/src/db';
import { contentHostname } from '@/src/hostname';
import { buildThemeErrorPageModel } from '@/src/model';
import { PublishedPage } from '@/src/render';
import { PUBLIC_RENDER_CSS } from '../../../../frontend/src/rendering/publicRenderCss';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export default async function ThemeErrorPage({ params }: { params: Promise<{ status: string }> }) {
  const [{ status }, requestHeaders] = await Promise.all([params, headers()]);
  if (!['403', '500', '503'].includes(status) || requestHeaders.get('x-eceee-theme-error') !== status) notFound();
  const hostname = contentHostname(requestHeaders.get('host') || '');
  const model = await buildThemeErrorPageModel(database, hostname, Number(status)).catch(error => {
    console.error(`[publisher] Could not render theme error page ${status}`, error);
    return null;
  });
  if (!model) return <main><h1>{status} — Error</h1></main>;
  return <>
    <style>{`${model.fontCss}\n${PUBLIC_RENDER_CSS}\n${model.themeCss}`}</style>
    <PublishedPage model={model} />
  </>;
}
