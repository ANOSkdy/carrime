'use client';

import React, { useEffect, useState } from 'react';
import { useStepRouter } from '@/lib/navigation/use-step-router';
import { useForm } from 'react-hook-form';
import { Input } from '@/components/form/Input';
import { Select } from '@/components/ui/Select';
import { Button } from '@/components/ui/Button';
import { PageIntro } from '@/components/layout/PageIntro';
import { FormSection } from '@/components/layout/FormSection';
import { stagger } from '@/lib/ui/stagger';
import { ensureResumeId, hasPendingResumeSave, retryPendingResumeSave, saveResumePatchInBackground } from '@/lib/storage/resume-save';

type FormData = {
  job_change_count: number;
  current_status: string;
  desired_joining_date: string;
};

export default function ResumeStep2() {
  const router = useStepRouter();
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
    <div className="lx">
      <PageIntro
        eyebrow="Step 02 — Status"
        title="現在の状況"
        description="現在の就業状況と、入社のご希望時期をお知らせください。"
      />
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-12">
        <FormSection index={0} title="経歴">
          {/* 転職回数 */}
          <Input
            label="これまでの転職回数"
            type="number"
            inputMode="numeric"
            min={0}
            suffix="回"
            containerClassName="max-w-[10rem]"
            {...register('job_change_count', { valueAsNumber: true })}
          />
        </FormSection>

        <FormSection index={1} title="現在の状況と希望">
          {/* 就業状況 */}
          <Select label="現在の就業状況" {...register('current_status')}>
            <option value="在職中">在職中 (現職で働いている)</option>
            <option value="離職中">離職中 (仕事はしていない)</option>
            <option value="学生">学生</option>
          </Select>

          {/* 入社希望時期 */}
          <Select label="入社希望時期" {...register('desired_joining_date')}>
            <option value="すぐにでも">すぐにでも</option>
            <option value="3ヶ月以内">3ヶ月以内</option>
            <option value="半年以内">半年以内</option>
            <option value="未定">未定</option>
          </Select>
        </FormSection>

        {isRetryingSave && (
          <p className="inline-flex items-center gap-2 text-[13px] tracking-[0.04em] text-gray-500">
            <span className="lx-breath h-1.5 w-1.5 rounded-full bg-current" />
            保存中です
          </p>
        )}

        <div className="lx-reveal flex gap-3 pt-4" style={stagger(3)}>
          <div className="min-w-0 flex-1">
            <Button type="button" variant="outline" onClick={() => router.back()}>戻る</Button>
          </div>
          <div className="lx-sheen min-w-0 flex-1">
            <Button type="submit">保存して次へ進む</Button>
          </div>
        </div>
      </form>
    </div>
  );
}
