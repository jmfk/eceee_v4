import { headers } from 'next/headers';
import { database } from '@/src/db';
import { contentHostname } from '@/src/hostname';
import { buildPublishedPageModel } from '@/src/model';
import { PublishedPage } from '@/src/render';
import { RENDER_LAYOUT_CSS } from '../../frontend/src/rendering/layoutRenderers';
import { PUBLIC_RENDER_CSS } from '../../frontend/src/rendering/publicRenderCss';

export default async function NotFound() {
  const requestHeaders = await headers();
  const host = contentHostname(requestHeaders.get('host') || '');
  const model = await buildPublishedPageModel(database, host, '/404');
  if (!model) return <main><h1>Page not found</h1></main>;
  return <>
    <style>{`${model.fontCss}\n${PUBLIC_RENDER_CSS}\n${RENDER_LAYOUT_CSS}\n${model.themeCss}`}</style>
    <PublishedPage model={model} />
  </>;
}
