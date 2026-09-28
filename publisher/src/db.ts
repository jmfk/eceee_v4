import { Pool } from 'pg';
import type { Page, ReadDb, Version } from './model';
let pool: Pool | undefined;
function connection(): Pool {
  if (!process.env.PUBLISHER_DATABASE_URL) throw new Error('PUBLISHER_DATABASE_URL is required');
  return pool ??= new Pool({ connectionString: process.env.PUBLISHER_DATABASE_URL, max: 5, options: '-c default_transaction_read_only=on' });
}
export const database: ReadDb = {
  async roots() {
    const result = await connection().query<Page>('SELECT id, tenant_id, parent_id, slug, title, hostnames, path_pattern FROM webpages_webpage WHERE parent_id IS NULL AND is_deleted = false AND cardinality(hostnames) > 0');
    return result.rows;
  },
  async child(parentId, tenantId, slug) {
    const result = await connection().query<Page>('SELECT id, tenant_id, parent_id, slug, title, hostnames, path_pattern FROM webpages_webpage WHERE parent_id = $1 AND tenant_id = $2 AND slug = $3 AND is_deleted = false LIMIT 2', [parentId, tenantId, slug]);
    return result.rows.length === 1 ? result.rows[0] : null;
  },
  async version(pageId, at) {
    const result = await connection().query<Version>('SELECT id, page_id, meta_title, meta_description, code_layout, widgets FROM webpages_pageversion WHERE page_id = $1 AND effective_date <= $2 AND (expiry_date IS NULL OR expiry_date > $2) ORDER BY effective_date DESC, version_number DESC LIMIT 1', [pageId, at]);
    return result.rows[0] ?? null;
  },
};
