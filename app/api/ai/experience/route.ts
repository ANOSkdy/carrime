import { handleAiRequest } from '@/lib/ai/handler';

export const runtime = 'nodejs';
export const maxDuration = 60;

export async function POST(request: Request) {
  return handleAiRequest(request, 'experience');
}
