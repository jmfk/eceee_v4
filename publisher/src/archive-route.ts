import { buildPublishedPageModel, type PublishedPageModel, type PublishedObjectQuery, type ReadDb, type SitePage } from './model';
import { canonicalPath, safePath, archiveTypes, pageDetailWidgets, type ArchiveKind } from './website';

/** Use the same inherited, published detail widget configuration as the actual page resolver. */
export function archiveSelector(model: PublishedPageModel, kind: ArchiveKind): Pick<PublishedObjectQuery, 'objectTypeIds' | 'objectTypeNames'> | null {
  for (const widget of pageDetailWidgets(model)) {
    const config = widget.config;
    if (widget.type === 'easy_widgets.NewsDetailWidget' && kind === 'news'
      && (config.slugVariableName ?? config.slug_variable_name ?? 'news_slug') === 'news_slug') {
      const types = config.objectTypes ?? config.object_types;
      const ids = Array.isArray(types) ? types.map(String).filter(id => /^\d{1,19}$/.test(id)) : [];
      if (ids.length) return { objectTypeIds: ids, objectTypeNames: [] };
    }
    if (widget.type === 'object_storage.ObjectDetailWidget' && !config.objectId && !config.object_id && !config.objectSlug && !config.object_slug) {
      const template = config.displayTemplate ?? config.display_template;
      const name = template === 'events' ? 'event' : template === 'columnists' ? 'columnist' : String(config.objectType ?? config.object_type ?? '');
      if (archiveTypes[kind].includes(name)) return { objectTypeNames: [name], objectTypeIds: [] };
    }
  }
  return null;
}
export async function archiveRoute(db: ReadDb, host: string, pages: SitePage[], kind: ArchiveKind) {
  const variable = { news: 'news_slug', publications: 'library_slug', events: 'event_slug' }[kind];
  for (const page of pages.filter(page => page.pathPattern === variable && safePath(page.path))) {
    const path = canonicalPath(page.path);
    // A probe resolves configuration/inheritance without selecting an arbitrary real object.
    const probe = `__archive_${crypto.randomUUID()}`;
    const model = await buildPublishedPageModel(db, host, `${path === '/' ? '' : path}/${probe}`);
    if (!model || model.context.pageId !== page.id) continue;
    const selector = archiveSelector(model, kind);
    if (selector) return { path, query: { ...selector, routePageId: page.id, routeDetailWinner: true } };
  }
  return null;
}
