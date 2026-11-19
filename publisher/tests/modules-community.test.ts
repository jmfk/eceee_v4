import { describe, expect, it, vi } from 'vitest';
import { messages, reply, threads, moderate } from '../src/modules/community';
import type { Tx } from '../src/modules/store';
const tenant = '10000000-0000-0000-0000-000000000001';
const id = '20000000-0000-0000-0000-000000000001';
const customer = { tenantId: tenant, actor: { id: 1, name: 'Member' }, admin: false };
function database(thread: Record<string, unknown>) { return { query: vi.fn().mockResolvedValue({ rows: [thread] }) } as unknown as Tx; }
describe('community privacy and moderation', () => {
  it('conceals another customer’s support conversation', async () => {
    const db = database({ id, kind: 'support', owner_id: 2, status: 'open' });
    await expect(messages(db, customer, id)).rejects.toMatchObject({ status: 404 });
    await expect(reply(db, customer, id, { body: 'hello', requestKey: id })).rejects.toMatchObject({ status: 404 });
  });
  it('conceals hidden forum discussions from customers', async () => {
    await expect(messages(database({ id, kind: 'forum', owner_id: 1, status: 'hidden' }), customer, id)).rejects.toMatchObject({ status: 404 });
  });
  it('allows an administrator to read support messages without being their owner', async () => {
    const db = database({ id, kind: 'support', owner_id: 2, status: 'open' });
    const result = await messages(db, { ...customer, admin: true }, id);
    expect(result.thread.ownerId).toBe(2); expect(db.query).toHaveBeenCalledTimes(2);
  });
  it('always filters customer support lists by their authenticated owner', async () => {
    const db = database({}); await threads(db, customer, 'support');
    expect(db.query).toHaveBeenCalledWith(expect.stringContaining("owner_id=$3 AND status<>'hidden'"), [tenant, 'support', 1]);
  });
  it('can close a conversation without deleting its history', async () => {
    const db = database({ id, kind: 'forum', owner_id: 1, status: 'open' });
    await moderate(db, { ...customer, admin: true }, id, { status: 'closed' });
    expect(db.query).toHaveBeenLastCalledWith(expect.stringContaining('UPDATE modules.threads'), [tenant, id, 'closed']);
  });
});
