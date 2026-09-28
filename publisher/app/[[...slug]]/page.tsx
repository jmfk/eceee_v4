import { headers } from 'next/headers';
import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { cache } from 'react';
import { database } from '@/src/db';
import { buildPublishedPageModel } from '@/src/model';
import { PublishedPage } from '@/src/render';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
type Props = { params: Promise<{ slug?: string[] }> };
const resolve = cache((host: string, path: string) => buildPublishedPageModel(database, host, path));
async function requestTarget({ params }: Props) {
  const [requestHeaders, route] = await Promise.all([headers(), params]);
  return { host: requestHeaders.get('host') || '', path: '/' + (route.slug || []).join('/') };
}
export async function generateMetadata(props: Props): Promise<Metadata> {
  const { host, path } = await requestTarget(props);
  const model = await resolve(host, path);
  return model ? { title: model.title, description: model.description } : {};
}
export default async function Page(props: Props) {
  const { host, path } = await requestTarget(props);
  const model = await resolve(host, path);
  if (!model) notFound();
  return <PublishedPage model={model} />;
}
