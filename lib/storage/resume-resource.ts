import type { Resume, ResumeBundle, ResumeEducationRow, ResumeWorkRow } from '@/lib/db/resume';
import { cachedResumeResource, invalidateResumeCache } from '@/lib/storage/resume-cache';
import { waitForResumeSaves } from '@/lib/storage/resume-save';

type Resources = {
  profile: { resume: Resume };
  selfpr: { resume: Pick<Resume, 'resume_id' | 'self_pr'> };
  bundle: ResumeBundle;
  education: { educations: ResumeEducationRow[] };
  work: { works: ResumeWorkRow[] };
};

export async function loadResumeResource<K extends keyof Resources>(resumeId: string, resource: K): Promise<Resources[K]> {
  await waitForResumeSaves(resumeId);
  return cachedResumeResource(resumeId, resource, async () => {
    const id = encodeURIComponent(resumeId);
    const url = resource === 'education' || resource === 'work'
      ? `/api/data/${resource}?resumeId=${id}`
      : `/api/data/resume?id=${id}${resource === 'bundle' ? '' : `&view=${resource}`}`;
    const response = await fetch(url, { cache: 'no-store' });
    if (!response.ok) throw new Error('RESUME_LOAD_FAILED');
    return response.json() as Promise<Resources[K]>;
  });
}

export async function mutateResumeResource(resumeId: string, url: string, options: RequestInit) {
  await waitForResumeSaves(resumeId);
  invalidateResumeCache(resumeId);
  try {
    const response = await fetch(url, options);
    if (!response.ok) throw new Error('RESUME_SAVE_FAILED');
    return response;
  } finally { invalidateResumeCache(resumeId); }
}
