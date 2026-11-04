import { getCrmAuth } from '@/lib/crm/auth';
import { toNextJsHandler } from 'better-auth/next-js';

export const runtime = 'nodejs';

export async function GET(request: Request) {
  return toNextJsHandler(getCrmAuth()).GET(request);
}

export async function POST(request: Request) {
  return toNextJsHandler(getCrmAuth()).POST(request);
}
