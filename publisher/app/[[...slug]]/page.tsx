import { headers } from 'next/headers';
import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { cache } from 'react';
import { database } from '@/src/db';
import { contentHostname } from '@/src/hostname';
import { buildPublishedPageModel } from '@/src/model';
import { PublishedPage } from '@/src/render';
import { RENDER_LAYOUT_CSS } from '../../../frontend/src/rendering/layoutRenderers';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
type Query = Record<string, string | string[] | undefined>;
type Props = { params: Promise<{ slug?: string[] }>; searchParams: Promise<Query> };
const resolve = cache((host: string, path: string) => buildPublishedPageModel(database, host, path));
async function requestTarget({ params }: Props) {
  const [requestHeaders, route] = await Promise.all([headers(), params]);
  return { host: contentHostname(requestHeaders.get('host') || ''), path: '/' + (route.slug || []).join('/') };
}
export async function generateMetadata(props: Props): Promise<Metadata> {
  const { host, path } = await requestTarget(props);
  const model = await resolve(host, path);
  return model ? { title: model.title, description: model.description } : {};
}
export default async function Page(props: Props) {
  const [{ host, path }, query] = await Promise.all([requestTarget(props), props.searchParams]);
  const model = await resolve(host, path);
  if (!model) notFound();
  const formStatus = query.form_status;
  const formWidget = query.form_widget;
  const result: { widgetId: string; status: 'success' | 'error' } | undefined = (formStatus === 'success' || formStatus === 'error') && typeof formWidget === 'string'
    ? { widgetId: formWidget, status: formStatus }
    : undefined;
  const renderModel = result ? {
    ...model,
    context: {
      ...model.context,
      publicForms: { ...model.context.publicForms, result },
    },
  } : model;
  return <><style>{`${model.fontCss}\n${RENDER_LAYOUT_CSS}\n${model.themeCss}`}</style><PublishedPage model={renderModel} /></>;
}
