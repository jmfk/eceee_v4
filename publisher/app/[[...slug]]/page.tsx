import { headers } from 'next/headers';
import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { database } from '@/src/db';
import { buildPublishedPageModel } from '@/src/model';
import { PublishedPage } from '@/src/render';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
type Props = { params: Promise<{ slug?: string[] }> };
async function resolve({ params }: Props) {
  const host = (await headers()).get('host') || '';
  return buildPublishedPageModel(database, host, '/' + ((await params).slug || []).join('/'));
}
export async function generateMetadata(props: Props): Promise<Metadata> {
  const model = await resolve(props);
  return model ? { title: model.title, description: model.description } : {};
}
export default async function Page(props: Props) {
  const model = await resolve(props);
  if (!model) notFound();
  return <PublishedPage model={model} />;
}
