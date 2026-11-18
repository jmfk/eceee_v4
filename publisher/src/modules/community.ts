import { randomUUID } from 'node:crypto';
import type { Scope } from './auth';
import { one, rows, type Tx } from './store';
import { boolean, fail, text, uuid } from './validation';

type Input = Record<string, unknown>;
type Thread = { id: string; kind: 'support' | 'forum'; ownerId: number; title: string; status: string };
export async function faqs(tx: Tx, scope: Scope) {
  return rows(tx, `SELECT id,question,answer,published,position FROM modules.faqs WHERE tenant_id=$1 ${scope.admin ? '' : 'AND published'} ORDER BY position,question,id LIMIT 100`, [scope.tenantId]);
}
export async function saveFaq(tx: Tx, scope: Scope, input: Input) {
  const id = uuid(input.id); const question = text(input.question, 'question', 300); const answer = text(input.answer, 'answer', 20000);
  const published = boolean(input.published);
  await tx.query(`INSERT INTO modules.faqs(tenant_id,id,question,answer,published) VALUES($1,$2,$3,$4,$5)
    ON CONFLICT(tenant_id,id) DO UPDATE SET question=$3,answer=$4,published=$5`, [scope.tenantId, id, question, answer, published]);
  return { id };
}
export async function threads(tx: Tx, scope: Scope, kind: string) {
  if (!['forum', 'support'].includes(kind)) return fail(400, 'Invalid conversation type.');
  return rows(tx, `SELECT id,kind,owner_id,title,status,created_at,updated_at FROM modules.threads WHERE tenant_id=$1 AND kind=$2
    ${scope.admin ? '' : kind === 'support' ? "AND owner_id=$3 AND status<>'hidden'" : "AND status<>'hidden'"}
    ORDER BY updated_at DESC,id LIMIT 100`, !scope.admin && kind === 'support' ? [scope.tenantId, kind, scope.actor!.id] : [scope.tenantId, kind]);
}
export async function visibleThread(tx: Tx, scope: Scope, id: string, lock = false) {
  const thread = await one<Thread>(tx, `SELECT * FROM modules.threads WHERE tenant_id=$1 AND id=$2 ${lock ? 'FOR UPDATE' : ''}`, [scope.tenantId, uuid(id)]);
  if (!thread || (!scope.admin && (thread.status === 'hidden' || (thread.kind === 'support' && thread.ownerId !== scope.actor?.id)))) return fail(404, 'Conversation not found.');
  return thread;
}
export async function messages(tx: Tx, scope: Scope, id: string, before?: string | null) {
  const thread = await visibleThread(tx, scope, id);
  // A cursor is the last message's UUID; keep the ordering stable when timestamps coincide.
  const data = await rows(tx, `SELECT id,author_id,author_name,body,hidden,created_at FROM modules.messages
    WHERE tenant_id=$1 AND thread_id=$2 ${scope.admin ? '' : 'AND NOT hidden'}
    ${before ? 'AND (created_at,id)<(SELECT created_at,id FROM modules.messages WHERE tenant_id=$1 AND thread_id=$2 AND id=$3)' : ''}
    ORDER BY created_at DESC,id DESC LIMIT 100`, before ? [scope.tenantId, id, uuid(before)] : [scope.tenantId, id]);
  return { thread, messages: data.reverse(), olderCursor: data.length === 100 ? data[0].id : null };
}
async function rateLimit(tx: Tx, scope: Scope) {
  await tx.query('SELECT pg_advisory_xact_lock(hashtextextended($1,0))', [`messages:${scope.tenantId}:${scope.actor!.id}`]);
  const result = await one<{ count: string }>(tx, "SELECT count(*) FROM modules.messages WHERE tenant_id=$1 AND author_id=$2 AND created_at>now()-interval '1 minute'", [scope.tenantId, scope.actor!.id]);
  if (Number(result?.count) >= 20) fail(429, 'Too many messages. Wait a minute before sending again.');
}
export async function createThread(tx: Tx, scope: Scope, input: Input) {
  const id = uuid(input.id); const kind = text(input.kind, 'type'); const title = text(input.title, 'title');
  if (!['support', 'forum'].includes(kind)) return fail(400, 'Invalid conversation type.');
  const existing = await one<Thread>(tx, 'SELECT * FROM modules.threads WHERE tenant_id=$1 AND id=$2', [scope.tenantId, id]);
  if (existing) {
    if (existing.ownerId !== scope.actor!.id || existing.kind !== kind) return fail(409, 'Conversation identifier is already in use.');
    return { id };
  }
  const message = text(input.body, 'message', 20000);
  await rateLimit(tx, scope);
  await tx.query('INSERT INTO modules.threads(tenant_id,id,kind,owner_id,title) VALUES($1,$2,$3,$4,$5)', [scope.tenantId, id, kind, scope.actor!.id, title]);
  await tx.query('INSERT INTO modules.messages(tenant_id,id,thread_id,author_id,author_name,body,request_key) VALUES($1,$2,$3,$4,$5,$6,$3)', [scope.tenantId, randomUUID(), id, scope.actor!.id, scope.actor!.name, message]);
  return { id };
}
export async function reply(tx: Tx, scope: Scope, id: string, input: Input) {
  const thread = await visibleThread(tx, scope, id, true); const requestKey = uuid(input.requestKey);
  const body = text(input.body, 'message', 20000);
  const existing = await one<{ id: string; threadId: string; body: string }>(tx, 'SELECT id,thread_id,body FROM modules.messages WHERE tenant_id=$1 AND author_id=$2 AND request_key=$3', [scope.tenantId, scope.actor!.id, requestKey]);
  if (existing) {
    if (existing.threadId !== id || existing.body !== body) return fail(409, 'Message retry does not match.');
    return { id: existing.id };
  }
  if (thread.status !== 'open') return fail(409, 'This conversation is closed.');
  await rateLimit(tx, scope);
  const messageId = randomUUID();
  await tx.query('INSERT INTO modules.messages(tenant_id,id,thread_id,author_id,author_name,body,request_key) VALUES($1,$2,$3,$4,$5,$6,$7)', [scope.tenantId, messageId, id, scope.actor!.id, scope.actor!.name, body, requestKey]);
  await tx.query('UPDATE modules.threads SET updated_at=now() WHERE tenant_id=$1 AND id=$2', [scope.tenantId, id]);
  return { id: messageId };
}
export async function moderate(tx: Tx, scope: Scope, id: string, input: Input) {
  await visibleThread(tx, scope, id, true);
  if (input.messageId) {
    const message = await one(tx, 'UPDATE modules.messages SET hidden=$4 WHERE tenant_id=$1 AND thread_id=$2 AND id=$3 RETURNING id', [scope.tenantId, id, uuid(input.messageId), boolean(input.hidden)]);
    if (!message) return fail(404, 'Message not found.');
  } else {
    if (!['open', 'closed', 'hidden'].includes(String(input.status))) return fail(400, 'Invalid status.');
    await tx.query('UPDATE modules.threads SET status=$3,updated_at=now() WHERE tenant_id=$1 AND id=$2', [scope.tenantId, id, input.status]);
  }
  return { id };
}
