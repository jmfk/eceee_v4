import { Pool, type PoolClient } from 'pg';
import { normalizeHostname, type Page, type PageReader, type ReadDb, type Theme, type Version } from './model';
let pool: Pool | undefined;
function wildcardAllowed(): boolean {
  return process.env.PUBLISHER_ALLOW_WILDCARD_HOSTNAMES?.trim().toLowerCase() === 'true';
}
function defaultAllowed(hostname: string): boolean {
  return (process.env.PUBLISHER_DEFAULT_HOSTNAMES ?? '').split(',').some(value => {
    const configured = normalizeHostname(value);
    return configured !== null && configured !== '*' && configured !== 'default' && configured === hostname;
  });
}
function connection(): Pool {
  if (!process.env.PUBLISHER_DATABASE_URL) throw new Error('PUBLISHER_DATABASE_URL is required');
  return pool ??= new Pool({ connectionString: process.env.PUBLISHER_DATABASE_URL, max: 5, options: '-c default_transaction_read_only=on' });
}
function reader(client: PoolClient): PageReader {
  return {
    async root(hostname) {
      const result = await client.query<Page>(`SELECT id, tenant_id, parent_id, slug, title, hostnames, path_pattern,
          enable_css_injection, page_css_variables, page_custom_css
        FROM webpages_webpage
        WHERE parent_id IS NULL AND is_deleted = false
          AND (hostnames @> ARRAY[$1]::varchar[]
            OR ($2::boolean AND hostnames @> ARRAY['*']::varchar[])
            OR ($3::boolean AND hostnames @> ARRAY['default']::varchar[]))
        ORDER BY CASE WHEN hostnames @> ARRAY[$1]::varchar[] THEN 0 ELSE 1 END, sort_order, id
        LIMIT 1`, [hostname, wildcardAllowed(), defaultAllowed(hostname)]);
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
      const result = await client.query<Theme>('SELECT id, tenant_id, name, fonts, colors, css_variables, component_styles, image_styles, gallery_styles, carousel_styles, breakpoints, custom_css FROM webpages_pagetheme WHERE id = $1 AND tenant_id = $2 LIMIT 1', [themeId, tenantId]);
      return result.rows[0] ?? null;
    },
    async defaultTheme(tenantId) {
      const result = await client.query<Theme>('SELECT id, tenant_id, name, fonts, colors, css_variables, component_styles, image_styles, gallery_styles, carousel_styles, breakpoints, custom_css FROM webpages_pagetheme WHERE tenant_id = $1 AND is_default = true AND is_active = true ORDER BY created_at, id LIMIT 1', [tenantId]);
      return result.rows[0] ?? null;
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
