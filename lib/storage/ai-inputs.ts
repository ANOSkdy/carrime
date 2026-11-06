import { BRAND_STORAGE_KEYS, getStorageItemWithLegacyFallback } from './branding';

export type AiInputData = {
  pr_summary: string;
  episode: string;
  policy?: string;
  occupation?: string;
};

export type AiInputLoad = { status: 'ready'; inputs: AiInputData } | { status: 'missing' | 'invalid' | 'unavailable' };

export function loadAiInputs(): AiInputLoad {
  try {
    const raw = getStorageItemWithLegacyFallback(BRAND_STORAGE_KEYS.aiInputs.current, BRAND_STORAGE_KEYS.aiInputs.legacy);
    if (raw === null) return { status: 'missing' };
    let data: unknown;
    try { data = JSON.parse(raw); } catch { return { status: 'invalid' }; }
    if (!data || typeof data !== 'object' || Array.isArray(data)) return { status: 'invalid' };
    const row = data as Record<string, unknown>;
    if (typeof row.pr_summary !== 'string' || typeof row.episode !== 'string' ||
      (row.policy !== undefined && typeof row.policy !== 'string') || (row.occupation !== undefined && typeof row.occupation !== 'string')) return { status: 'invalid' };
    return { status: 'ready', inputs: row as AiInputData };
  } catch {
    return { status: 'unavailable' };
  }
}
