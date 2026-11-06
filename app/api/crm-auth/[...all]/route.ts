import { getCrmAuth } from '@/lib/crm/auth';
import { toNextJsHandler } from 'better-auth/next-js';
import { handleCrmAuthRequest } from '@/lib/crm/auth-handler';

export const runtime = 'nodejs';

export async function GET(request: Request) {
  return handleCrmAuthRequest(request, () => toNextJsHandler(getCrmAuth()).GET(request));
}

export async function POST(request: Request) {
  return handleCrmAuthRequest(request, () => toNextJsHandler(getCrmAuth()).POST(request));
}
