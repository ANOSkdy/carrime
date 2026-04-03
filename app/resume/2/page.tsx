'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { Button } from '@/components/ui/Button';
import { ensureResumeId, hasPendingResumeSave, retryPendingResumeSave, saveResumePatchInBackground } from '@/lib/storage/resume-save';

type FormData = {
  job_change_count: number;
  current_status: string;
  desired_joining_date: string;
};

export default function ResumeStep2() {
  const router = useRouter();
  const { register, handleSubmit } = useForm<FormData>({
    defaultValues: {
      job_change_count: 0,
      current_status: '在職中',
      desired_joining_date: 'すぐにでも'
    }
  });

  const [isRetryingSave, setIsRetryingSave] = useState(false);

  useEffect(() => {
    const resumeId = ensureResumeId();
    if (!resumeId) return;
    if (hasPendingResumeSave(resumeId)) {
      queueMicrotask(() => setIsRetryingSave(true));
      void retryPendingResumeSave(resumeId).finally(() => {
        setIsRetryingSave(false);
      });
    }
  }, []);

  const onSubmit = (data: FormData) => {
    const resumeId = ensureResumeId();
    if (!resumeId) {
      alert('履歴書IDが見つかりません。Step 1からやり直してください。');
      router.push('/resume/1');
      return;
    }

    const payload = {
      resume_id: resumeId,
      ...data,
    };

    saveResumePatchInBackground(payload);
    router.push('/resume/3');
  };

  return (
    <div>
      <h2 className="text-xl font-bold mb-6">現在の状況</h2>
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
        
        {/* 転職回数 */}
        <div>
          <label className="block text-sm font-medium mb-2">これまでの転職回数</label>
          <input 
            type="number" 
            {...register('job_change_count', { valueAsNumber: true })}
            className="w-24 px-3 py-2 border rounded"
            min={0}
          /> 回
        </div>

        {/* 就業状況 */}
        <div>
          <label className="block text-sm font-medium mb-2">現在の就業状況</label>
          <select {...register('current_status')} className="w-full px-3 py-2 border rounded">
            <option value="在職中">在職中 (現職で働いている)</option>
            <option value="離職中">離職中 (仕事はしていない)</option>
            <option value="学生">学生</option>
          </select>
        </div>

        {/* 入社希望時期 */}
        <div>
          <label className="block text-sm font-medium mb-2">入社希望時期</label>
          <select {...register('desired_joining_date')} className="w-full px-3 py-2 border rounded">
            <option value="すぐにでも">すぐにでも</option>
            <option value="3ヶ月以内">3ヶ月以内</option>
            <option value="半年以内">半年以内</option>
            <option value="未定">未定</option>
          </select>
        </div>

        {isRetryingSave && (
          <p className="text-sm text-gray-600 inline-flex items-center gap-2">
            <span className="h-4 w-4 animate-spin rounded-full border-2 border-gray-400 border-t-transparent" />
            保存中です
          </p>
        )}

        <div className="flex justify-between pt-4">
          <Button type="button" variant="outline" onClick={() => router.back()}>戻る</Button>
          <Button type="submit">保存して次へ進む</Button>
        </div>
      </form>
    </div>
  );
}
