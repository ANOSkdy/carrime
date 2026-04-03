import { BRAND_STORAGE_KEYS, getStorageItemWithLegacyFallback } from '@/lib/storage/branding';

type PendingSave = {
  resumeId: string;
  method: 'POST' | 'PATCH';
  payload: Record<string, unknown>;
  updatedAt: number;
};

const PENDING_SAVE_KEY = 'aidesu_resume_pending_save';

function readPendingSave(): PendingSave | null {
  if (typeof window === 'undefined') return null;

  const raw = localStorage.getItem(PENDING_SAVE_KEY);
  if (!raw) return null;

  try {
    return JSON.parse(raw) as PendingSave;
  } catch {
    localStorage.removeItem(PENDING_SAVE_KEY);
    return null;
  }
}

function writePendingSave(value: PendingSave) {
  if (typeof window === 'undefined') return;
  localStorage.setItem(PENDING_SAVE_KEY, JSON.stringify(value));
}

function clearPendingSave(resumeId?: string) {
  if (typeof window === 'undefined') return;

  if (!resumeId) {
    localStorage.removeItem(PENDING_SAVE_KEY);
    return;
  }

  const pending = readPendingSave();
  if (pending?.resumeId === resumeId) {
    localStorage.removeItem(PENDING_SAVE_KEY);
  }
}

function generateResumeId() {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return `res_${crypto.randomUUID()}`;
  }

  return `res_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
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
  const pending = readPendingSave();
  if (!pending) return false;
  if (!resumeId) return true;
  return pending.resumeId === resumeId;
}

async function sendResumeSave(method: PendingSave['method'], payload: Record<string, unknown>) {
  const response = await fetch('/api/data/resume', {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    throw new Error('failed to save resume');
  }

  return response;
}

export async function retryPendingResumeSave(resumeId: string) {
  const pending = readPendingSave();
  if (!pending || pending.resumeId !== resumeId) return false;

  try {
    await sendResumeSave(pending.method, pending.payload);
    clearPendingSave(resumeId);
    return true;
  } catch {
    return false;
  }
}

export function saveResumeInBackground(method: PendingSave['method'], payload: Record<string, unknown>) {
  const resumeId = typeof payload.resume_id === 'string' ? payload.resume_id : '';

  if (!resumeId) {
    return;
  }

  void sendResumeSave(method, payload)
    .then(() => {
      clearPendingSave(resumeId);
    })
    .catch(() => {
      writePendingSave({
        resumeId,
        method,
        payload,
        updatedAt: Date.now(),
      });
    });
}

export function saveResumePatchInBackground(payload: Record<string, unknown>) {
  saveResumeInBackground('PATCH', payload);
}
