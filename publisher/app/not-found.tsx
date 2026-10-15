import { headers } from 'next/headers';
import { database } from '@/src/db';
import { contentHostname } from '@/src/hostname';
import { buildThemeErrorPageModel } from '@/src/model';
import { PublishedPage } from '@/src/render';

export default async function NotFound() {
  const requestHeaders = await headers();
  const host = contentHostname(requestHeaders.get('host') || '');
  const model = await buildThemeErrorPageModel(database, host, 404);
  if (!model) return <main><h1>Page not found</h1></main>;
  return <>
    {model.fontUrl && <link rel="stylesheet" href={model.fontUrl} />}
    <style>{model.themeCss}</style>
    <PublishedPage model={model} />
  </>;
}
