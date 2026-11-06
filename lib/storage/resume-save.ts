import { BRAND_STORAGE_KEYS, getStorageItemWithLegacyFallback } from '@/lib/storage/branding';
import { invalidateResumeCache } from '@/lib/storage/resume-cache';

type PendingSave = {
  id: string;
  resumeId: string;
  method: 'POST' | 'PATCH';
  payload: Record<string, unknown>;
  updatedAt: number;
};
const PENDING_SAVE_KEY = 'carrime_resume_pending_save';
const LEGACY_PENDING_SAVE_KEYS = ['aidesu_resume_pending_save'] as const;
const active = new Map<string, Promise<boolean>>();
const waiters = new Map<string, { resumeId: string; resolve: (value: Response) => void; reject: (error: Error) => void }>();

function readPendingSaves(): PendingSave[] {
  if (typeof window === 'undefined') return [];
  const raw = localStorage.getItem(PENDING_SAVE_KEY)
    ?? LEGACY_PENDING_SAVE_KEYS.map(key => localStorage.getItem(key)).find(Boolean);
  if (!raw) return [];
  const parsed = JSON.parse(raw);
  // Continue to understand the former single-operation format without deleting it.
  const operations = parsed.version === 2 ? parsed.operations : [parsed];
  if (!Array.isArray(operations) || operations.some(item => !item || typeof item.resumeId !== 'string'
    || !['POST', 'PATCH'].includes(item.method) || !item.payload || typeof item.payload !== 'object')) {
    throw new Error('INVALID_PENDING_SAVE');
  }
  return operations.map(item => ({ ...item, id: item.id || `legacy:${item.resumeId}:${item.updatedAt}` }));
}

function writePendingSaves(operations: PendingSave[]) {
  if (operations.length) localStorage.setItem(PENDING_SAVE_KEY, JSON.stringify({ version: 2, operations }));
  else localStorage.removeItem(PENDING_SAVE_KEY);
  for (const key of LEGACY_PENDING_SAVE_KEYS) localStorage.removeItem(key);
}

function generateResumeId() {
  return `res_${crypto.randomUUID()}`;
}

export function ensureResumeId() {
  if (typeof window === 'undefined') return '';
  const existing = getStorageItemWithLegacyFallback(BRAND_STORAGE_KEYS.resumeId.current, BRAND_STORAGE_KEYS.resumeId.legacy);
  if (existing) return existing;
  const nextResumeId = generateResumeId();
  localStorage.setItem(BRAND_STORAGE_KEYS.resumeId.current, nextResumeId);
  return nextResumeId;
}

export function hasPendingResumeSave(resumeId?: string) {
  try { return readPendingSaves().some(item => !resumeId || item.resumeId === resumeId); }
  catch { return true; }
}

function drain(resumeId: string): Promise<boolean> {
  const running = active.get(resumeId);
  if (running) return running;
  const task = (async () => {
    try {
      for (;;) {
        const pending = readPendingSaves().find(item => item.resumeId === resumeId);
        if (!pending) return true;
        invalidateResumeCache(resumeId);
        const response = await fetch('/api/data/resume', {
          method: pending.method, headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(pending.payload),
        });
        if (!response.ok) throw new Error('RESUME_SAVE_FAILED');
        writePendingSaves(readPendingSaves().filter(item => item.id !== pending.id));
        invalidateResumeCache(resumeId);
        waiters.get(pending.id)?.resolve(response);
        waiters.delete(pending.id);
      }
    } catch {
      // Retain every unsent operation, including POST before a subsequent PATCH.
      for (const [id, waiter] of waiters) {
        if (waiter.resumeId !== resumeId) continue;
        waiter.reject(new Error('RESUME_SAVE_FAILED'));
        waiters.delete(id);
      }
      return false;
    }
  })().then(success => {
    active.delete(resumeId);
    // A caller can enqueue another save while the previous promise resolves.
    return success && hasPendingResumeSave(resumeId) ? drain(resumeId) : success;
  });
  active.set(resumeId, task);
  return task;
}

export async function waitForResumeSaves(resumeId: string) {
  while (active.has(resumeId)) await active.get(resumeId);
  if (hasPendingResumeSave(resumeId)) throw new Error('RESUME_SAVE_PENDING');
}

export function saveResume(method: PendingSave['method'], payload: Record<string, unknown>): Promise<Response> {
  const resumeId = typeof payload.resume_id === 'string' ? payload.resume_id : '';
  if (!resumeId) return Promise.reject(new Error('RESUME_ID_MISSING'));
  const pending = { id: crypto.randomUUID(), resumeId, method, payload, updatedAt: Date.now() };
  try { writePendingSaves([...readPendingSaves(), pending]); }
  catch { return Promise.reject(new Error('RESUME_STORAGE_FAILED')); }
  invalidateResumeCache(resumeId);
  const result = new Promise<Response>((resolve, reject) => { waiters.set(pending.id, { resumeId, resolve, reject }); });
  void drain(resumeId);
  return result;
}

export async function retryPendingResumeSave(resumeId: string) {
  if (!hasPendingResumeSave(resumeId)) return false;
  return drain(resumeId);
}

export function saveResumeInBackground(method: PendingSave['method'], payload: Record<string, unknown>) {
  void saveResume(method, payload).catch(() => {});
}

export function saveResumePatchInBackground(payload: Record<string, unknown>) {
  saveResumeInBackground('PATCH', payload);
}
