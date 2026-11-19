import { headers } from 'next/headers';
import { notFound, permanentRedirect } from 'next/navigation';
import type { Metadata } from 'next';
import { requestPage } from '@/src/request-page';
import { siteContext, websiteMetadata, safePath, canonicalPath, unresolvedDynamicDetail } from '@/src/website';
import { WebsiteTools } from '@/src/website-tools';
import { database } from '@/src/db';
import { PublishedPage } from '@/src/render';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
type Query = Record<string, string | string[] | undefined>;
type Props = { params: Promise<{ slug?: string[] }>; searchParams: Promise<Query> };

async function requestTarget({ params }: Props) {
  const [requestHeaders, route] = await Promise.all([headers(), params]);
  return { host: requestHeaders.get('host') || '', path: '/' + (route.slug || []).join('/') };
}
export async function generateMetadata(props: Props): Promise<Metadata> {
  const { host, path } = await requestTarget(props);
  const result = await requestPage(host, path);
  return result ? websiteMetadata(result.model, result.website, host, path) : {};
}
export default async function Page(props: Props) {
  const [{ host, path }, query] = await Promise.all([requestTarget(props), props.searchParams]);
  const resolvedPage = await requestPage(host, path);
  if (!resolvedPage || unresolvedDynamicDetail(resolvedPage.model)) {
    const site = await siteContext(database, host, false);
    const normalized = path === '/' ? path : path.replace(/\/$/, '') + '/';
    const alias = site ? await database.withSnapshot(reader => reader.pageAlias?.(site.root.id, site.root.tenant_id, normalized, new Date()) ?? Promise.resolve(null)) : null;
    if (alias && safePath(alias) && alias.replace(/\/$/, '') !== path.replace(/\/$/, '') && await requestPage(host, alias)) {
      const params = new URLSearchParams();
      for (const [key, value] of Object.entries(query)) for (const item of Array.isArray(value) ? value : value === undefined ? [] : [value]) params.append(key, item);
      permanentRedirect(canonicalPath(alias) + (params.size ? `?${params}` : ''));
    }
  }
  if (!resolvedPage) notFound();
  const { model, website } = resolvedPage;
  const formStatus = query.form_status;
  const formWidget = query.form_widget;
  const result: { widgetId: string; status: 'success' | 'error' } | undefined = (formStatus === 'success' || formStatus === 'error') && typeof formWidget === 'string'
    ? { widgetId: formWidget, status: formStatus }
    : undefined;
  const queryParams = Object.fromEntries(Object.entries(query).filter((entry): entry is [string, string | string[]] => entry[1] !== undefined));
  const renderModel = {
    ...model,
    context: {
      ...model.context,
      currentPath: path,
      queryParams,
      publicForms: { ...model.context.publicForms, ...(result ? { result } : {}) },
    },
  };
  return <>{model.fontUrl && <link data-eceee-render-font rel="stylesheet" href={model.fontUrl} />}<style data-eceee-render-css>{model.themeCss}</style><div lang={website.language}><WebsiteTools info={website} /><PublishedPage model={renderModel} /></div></>;
}
