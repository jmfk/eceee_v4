import { Pool, type PoolClient } from 'pg';
import { normalizeHostname, type Page, type PageReader, type PublicMediaItem, type PublishedObject, type ReadDb, type Theme, type Version } from './model';
let pool: Pool | undefined;
type PublicMediaRow = PublicMediaItem & { file_path: string };

function mediaBaseUrl(): string {
  const configured = process.env.PUBLISHER_MEDIA_BASE_URL?.trim();
  if (configured) return configured.replace(/\/+$/, '');
  const endpoint = process.env.AWS_S3_ENDPOINT_URL?.trim().replace(/\/+$/, '');
  const bucket = process.env.AWS_STORAGE_BUCKET_NAME?.trim().replace(/^\/+|\/+$/g, '');
  return endpoint && bucket ? `${endpoint}/${bucket}` : '';
}

function publicMediaItem(row: PublicMediaRow): PublicMediaItem {
  const { file_path: filePath, ...item } = row;
  const path = filePath.split('/').filter(Boolean).map(encodeURIComponent).join('/');
  const baseUrl = mediaBaseUrl();
  const url = item.url || (path && baseUrl ? `${baseUrl}/${path}` : '');
  return { ...item, url, thumbnailUrl: item.thumbnailUrl || url };
}

function wildcardAllowed(): boolean {
  return process.env.PUBLISHER_ALLOW_WILDCARD_HOSTNAMES?.trim().toLowerCase() === 'true';
}
function defaultAllowed(hostname: string): boolean {
  return (process.env.PUBLISHER_DEFAULT_HOSTNAMES ?? '').split(',').some(value => {
    const configured = normalizeHostname(value);
    return configured !== null && configured !== '*' && configured !== 'default' && configured === hostname;
  });
}
function scopedWildcardCandidates(hostname: string): string[] {
  if (!/^[a-z0-9-]+(?:\.[a-z0-9-]+)*$/.test(hostname)) return [];
  const labels = hostname.split('.');
  return labels.slice(1, -1).map((_, index) => `*.${labels.slice(index + 1).join('.')}`);
}
function connection(): Pool {
  if (!process.env.PUBLISHER_DATABASE_URL) throw new Error('PUBLISHER_DATABASE_URL is required');
  return pool ??= new Pool({ connectionString: process.env.PUBLISHER_DATABASE_URL, max: 5, options: '-c default_transaction_read_only=on' });
}
function reader(client: PoolClient): PageReader {
  return {
    async root(hostname) {
      const scopedWildcards = scopedWildcardCandidates(hostname);
      const result = await client.query<Page>(`SELECT id, tenant_id, parent_id, slug, title, hostnames, path_pattern,
          enable_css_injection, page_css_variables, page_custom_css
        FROM webpages_webpage
        WHERE parent_id IS NULL AND is_deleted = false
          AND (hostnames @> ARRAY[$1]::varchar[]
            OR hostnames && $2::varchar[]
            OR ($3::boolean AND hostnames @> ARRAY['*']::varchar[])
            OR ($4::boolean AND hostnames @> ARRAY['default']::varchar[]))
        ORDER BY CASE WHEN hostnames @> ARRAY[$1]::varchar[] THEN 0
                      WHEN hostnames && $2::varchar[] THEN 1 ELSE 2 END,
          (SELECT MIN(array_position($2::varchar[], candidate))
             FROM unnest(hostnames) AS matching_host(candidate) WHERE candidate = ANY($2::varchar[])),
          sort_order, id
        LIMIT 1`, [hostname, scopedWildcards, wildcardAllowed(), defaultAllowed(hostname)]);
      return result.rows[0] ?? null;
    },
    async child(parentId, tenantId, slug) {
      const result = await client.query<Page>('SELECT id, tenant_id, parent_id, slug, title, hostnames, path_pattern, enable_css_injection, page_css_variables, page_custom_css FROM webpages_webpage WHERE parent_id = $1 AND tenant_id = $2 AND slug = $3 AND is_deleted = false ORDER BY sort_order, id LIMIT 1', [parentId, tenantId, slug]);
      return result.rows[0] ?? null;
    },
    async version(pageId, at) {
      const result = await client.query<Version>('SELECT id, page_id, meta_title, meta_description, code_layout, widgets, theme_id, enable_css_injection, page_css_variables, page_custom_css FROM webpages_pageversion WHERE page_id = $1 AND effective_date <= $2 AND (expiry_date IS NULL OR expiry_date > $2) ORDER BY effective_date DESC, version_number DESC LIMIT 1', [pageId, at]);
      return result.rows[0] ?? null;
    },
    async theme(themeId, tenantId) {
      const result = await client.query<Theme>('SELECT id, tenant_id, name, fonts, colors, css_variables, design_groups, html_elements, component_styles, image_styles, gallery_styles, carousel_styles, breakpoints, custom_css, sync_version, updated_at FROM webpages_pagetheme WHERE id = $1 AND tenant_id = $2 LIMIT 1', [themeId, tenantId]);
      return result.rows[0] ?? null;
    },
    async defaultTheme(tenantId) {
      const result = await client.query<Theme>('SELECT id, tenant_id, name, fonts, colors, css_variables, design_groups, html_elements, component_styles, image_styles, gallery_styles, carousel_styles, breakpoints, custom_css, sync_version, updated_at FROM webpages_pagetheme WHERE tenant_id = $1 AND is_default = true AND is_active = true ORDER BY created_at, id LIMIT 1', [tenantId]);
      return result.rows[0] ?? null;
    },
    async publishedPageReferences(pageIds, tenantId, rootId, at) {
      if (!pageIds.length) return [];
      const result = await client.query<{ id: string; cached_path: string }>(`
        SELECT page.id::text, CASE WHEN page.id = $3 THEN '/' ELSE page.cached_path END AS cached_path
        FROM webpages_webpage AS page
        JOIN LATERAL (
          SELECT 1
          FROM webpages_pageversion AS version
          WHERE version.page_id = page.id
            AND version.effective_date <= $4
            AND (version.expiry_date IS NULL OR version.expiry_date > $4)
          ORDER BY version.effective_date DESC, version.version_number DESC
          LIMIT 1
        ) AS published ON true
        WHERE page.id = ANY($1::bigint[])
          AND page.tenant_id = $2
          AND (page.id = $3 OR page.cached_root_id = $3)
          AND page.is_deleted = false
          AND (page.id = $3 OR page.cached_path <> '')`, [pageIds, tenantId, rootId, at]);
      return result.rows;
    },
    async publishedNavigationPages(parentIds, tenantId, rootId, at) {
      if (!parentIds.length) return [];
      const result = await client.query<{
        id: string; parent_id: string; title: string; label: string; slug: string; cached_path: string; sort_order: number;
      }>(`
        SELECT page.id::text, page.parent_id::text, page.title, page.slug,
          page.cached_path, page.sort_order,
          COALESCE(
            NULLIF(CASE
              WHEN jsonb_typeof(published.page_data->'shortTitle') = 'string' THEN published.page_data->>'shortTitle'
              WHEN jsonb_typeof(published.page_data->'short_title') = 'string' THEN published.page_data->>'short_title'
            END, ''),
            page.title
          ) AS label
        FROM webpages_webpage AS page
        JOIN LATERAL (
          SELECT version.page_data
          FROM webpages_pageversion AS version
          WHERE version.page_id = page.id
            AND version.effective_date <= $4
            AND (version.expiry_date IS NULL OR version.expiry_date > $4)
          ORDER BY version.effective_date DESC, version.version_number DESC
          LIMIT 1
        ) AS published ON true
        WHERE page.parent_id = ANY($1::bigint[])
          AND page.tenant_id = $2
          AND page.cached_root_id = $3
          AND page.is_deleted = false
          AND page.cached_path <> ''
        ORDER BY page.parent_id, page.sort_order, page.id`, [parentIds, tenantId, rootId, at]);
      return result.rows;
    },
    async publicMedia(mediaIds, collectionIds, tenantId) {
      const mediaFields = `media.id::text, COALESCE(media.file_url, '') AS url, media.file_path,
        CASE WHEN media.file_type = 'video' THEN 'video' ELSE 'image' END AS type,
        COALESCE(media.title, '') AS "altText", COALESCE(media.description, '') AS caption,
        COALESCE(media.metadata->>'annotation', '') AS annotation, COALESCE(media.title, '') AS title,
        media.width, media.height, COALESCE(media.file_url, '') AS "thumbnailUrl"`;
      const files = mediaIds.length ? await client.query<PublicMediaRow>(`
        SELECT ${mediaFields}
        FROM file_manager_mediafile AS media
        WHERE media.id = ANY($1::uuid[]) AND media.tenant_id = $2
          AND media.access_level = 'public' AND media.is_deleted = false
        ORDER BY media.created_at, media.id`, [mediaIds, tenantId]) : { rows: [] as PublicMediaRow[] };
      const collectionRows = collectionIds.length ? await client.query<PublicMediaRow & { collection_id: string }>(`
        SELECT membership.mediacollection_id::text AS collection_id, ${mediaFields}
        FROM file_manager_mediafile_collections AS membership
        JOIN file_manager_mediacollection AS collection ON collection.id = membership.mediacollection_id
        JOIN content_namespace AS namespace ON namespace.id = collection.namespace_id
        JOIN file_manager_mediafile AS media ON media.id = membership.mediafile_id
        WHERE membership.mediacollection_id = ANY($1::uuid[])
          AND media.tenant_id = $2 AND namespace.tenant_id = $2
          AND collection.access_level = 'public'
          AND media.access_level = 'public' AND media.is_deleted = false
        ORDER BY media.created_at, media.id`, [collectionIds, tenantId]) : { rows: [] as Array<PublicMediaRow & { collection_id: string }> };
      const collections: Record<string, PublicMediaItem[]> = {};
      for (const row of collectionRows.rows) {
        const { collection_id, ...item } = row;
        (collections[collection_id] ??= []).push(publicMediaItem(item));
      }
      return { files: files.rows.map(publicMediaItem), collections };
    },
    async publishedObjects(query, tenantId, at) {
      const objectIds = (query.objectIds ?? []).filter(value => /^\d+$/.test(value));
      const typeIds = (query.objectTypeIds ?? []).filter(value => /^\d+$/.test(value));
      const typeNames = (query.objectTypeNames ?? []).filter(value => /^[a-z0-9_-]+$/i.test(value));
      if (!objectIds.length && !typeIds.length && !typeNames.length) return [];
      const sortOrders: Record<string, string> = {
        '-publish_date': 'published.effective_date DESC, object.id DESC',
        publish_date: 'published.effective_date, object.id',
        '-created_at': 'object.created_at DESC, object.id DESC',
        created_at: 'object.created_at, object.id',
        '-updated_at': 'object.updated_at DESC, object.id DESC',
        updated_at: 'object.updated_at, object.id',
        title: 'object.title, object.id',
        '-title': 'object.title DESC, object.id DESC',
      };
      const order = sortOrders[query.sortOrder] ?? sortOrders['-publish_date'];
      const featured = query.featuredFirst ? 'published.is_featured DESC, ' : '';
      const result = await client.query<PublishedObject>(`
        SELECT object.id::text, object.title, object.slug,
          jsonb_build_object('id', type.id::text, 'name', type.name, 'label', type.label, 'pluralLabel', type.plural_label) AS "objectType",
          published.data, published.widgets, object.metadata,
          published.effective_date::text AS "publishDate", published.is_featured AS "isFeatured", object.level,
          CASE WHEN $8::boolean THEN COALESCE((
            SELECT jsonb_agg(jsonb_build_object(
              'id', ancestor.id::text, 'title', ancestor.title, 'slug', ancestor.slug,
              'objectType', jsonb_build_object('id', ancestor_type.id::text, 'name', ancestor_type.name,
                'label', ancestor_type.label, 'pluralLabel', ancestor_type.plural_label)
            ) ORDER BY ancestor.lft)
            FROM object_storage_objectinstance AS ancestor
            JOIN object_storage_objecttypedefinition AS ancestor_type ON ancestor_type.id = ancestor.object_type_id
            JOIN LATERAL (
              SELECT 1
              FROM object_storage_objectversion AS ancestor_version
              WHERE ancestor_version.object_instance_id = ancestor.id
                AND ancestor_version.effective_date <= $4
                AND (ancestor_version.expiry_date IS NULL OR ancestor_version.expiry_date > $4)
              ORDER BY ancestor_version.version_number DESC
              LIMIT 1
            ) AS ancestor_published ON true
            WHERE ancestor.tenant_id = $1 AND ancestor.tree_id = object.tree_id
              AND ancestor.lft < object.lft AND ancestor.rght > object.rght
          ), '[]'::jsonb) ELSE '[]'::jsonb END AS ancestors,
          CASE WHEN $8::boolean THEN COALESCE((
            SELECT jsonb_agg(jsonb_build_object(
              'id', child.id::text, 'title', child.title, 'slug', child.slug,
              'objectType', jsonb_build_object('id', child_type.id::text, 'name', child_type.name,
                'label', child_type.label, 'pluralLabel', child_type.plural_label),
              'publishDate', child_published.effective_date::text
            ) ORDER BY child.tree_id, child.lft)
            FROM object_storage_objectinstance AS child
            JOIN object_storage_objecttypedefinition AS child_type ON child_type.id = child.object_type_id
            JOIN LATERAL (
              SELECT child_version.effective_date
              FROM object_storage_objectversion AS child_version
              WHERE child_version.object_instance_id = child.id
                AND child_version.effective_date <= $4
                AND (child_version.expiry_date IS NULL OR child_version.expiry_date > $4)
              ORDER BY child_version.version_number DESC
              LIMIT 1
            ) AS child_published ON true
            WHERE child.tenant_id = $1 AND child.parent_id = object.id
          ), '[]'::jsonb) ELSE '[]'::jsonb END AS children
        FROM object_storage_objectinstance AS object
        JOIN object_storage_objecttypedefinition AS type ON type.id = object.object_type_id
        JOIN LATERAL (
          SELECT version.data, version.widgets, version.effective_date, version.is_featured
          FROM object_storage_objectversion AS version
          WHERE version.object_instance_id = object.id
            AND version.effective_date <= $4
            AND (version.expiry_date IS NULL OR version.expiry_date > $4)
          ORDER BY version.version_number DESC
          LIMIT 1
        ) AS published ON true
        WHERE object.tenant_id = $1
          AND ($7::bigint[] <> '{}'::bigint[] AND object.id = ANY($7::bigint[])
            OR $2::bigint[] <> '{}'::bigint[] AND type.id = ANY($2::bigint[])
            OR $3::text[] <> '{}'::text[] AND type.name = ANY($3::text[]))
          AND ($5::text IS NULL OR object.slug = $5)
        ORDER BY ${featured}${order}
        LIMIT $6`, [tenantId, typeIds, typeNames, at, query.slug ?? null, Math.min(Math.max(query.limit, 1), 50), objectIds, Boolean(query.includeHierarchy)]);
      return result.rows;
    },
  };
}
export const database: ReadDb = {
  async withSnapshot<T>(read: (db: PageReader) => Promise<T>): Promise<T> {
    const client = await connection().connect();
    try {
      await client.query('BEGIN TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY');
      const result = await read(reader(client));
      await client.query('COMMIT');
      return result;
    } catch (error) {
      await client.query('ROLLBACK').catch(() => undefined);
      throw error;
    } finally {
      client.release();
    }
  },
};
