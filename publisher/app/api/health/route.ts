import { checkFormSubmissionStore } from '@/src/form-db';
import { schedulePublisherError } from '../../../src/slack-errors';

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
  } catch (error) {
    schedulePublisherError(error, 'health');
    return Response.json({ status: 'unavailable' }, { status: 503, headers });
  }
}
