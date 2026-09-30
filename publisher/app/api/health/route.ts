import { checkFormSubmissionStore } from '@/src/form-db';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const headers = {
  'cache-control': 'no-store',
  'x-eceee-publisher': 'nextjs',
};

export async function GET() {
  try {
    await checkFormSubmissionStore();
    return Response.json({ status: 'ok' }, { headers });
  } catch {
    return Response.json({ status: 'unavailable' }, { status: 503, headers });
  }
}
