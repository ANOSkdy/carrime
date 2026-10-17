'use client';

import React from 'react';
import { useStepRouter } from '@/lib/navigation/use-step-router';
import { Controller, useForm } from 'react-hook-form';
import { Button } from '@/components/ui/Button';
import { PageIntro } from '@/components/layout/PageIntro';
import { FormSection } from '@/components/layout/FormSection';
import { stagger } from '@/lib/ui/stagger';
import { TagSelector } from '@/components/ui/TagSelector';
import { ensureResumeId, saveResumePatchInBackground } from '@/lib/storage/resume-save';

type FormData = {
  desired_occupations: string[];
  desired_industries: string[];
  desired_locations: string[];
  licenses_qualifications: string[];
};

export default function ResumeStep5() {
  const router = useStepRouter();
  const {
    control,
    handleSubmit,
    formState: { isSubmitting },
  } = useForm<FormData>({
    defaultValues: {
      desired_occupations: [],
      desired_industries: [],
      desired_locations: [],
      licenses_qualifications: [],
    },
  });

  const onSubmit = async (data: FormData) => {
    const resumeId = ensureResumeId();
    if (!resumeId) return;

    saveResumePatchInBackground({
      resume_id: resumeId,
      ...data,
      step5_complete: true,
    });

    router.push('/cv/1');
  };

  return (
    <div className="lx">
      <PageIntro
        eyebrow="Step 05 — Preferences"
        title="希望条件の入力"
        description="希望する職種や業界を選択してください (最大3つまで)"
      />

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-12">
        {/* 希望職種 */}
        <FormSection index={0} title="希望職種">
          <div className="bg-gray-50 p-4 rounded border">
            <Controller
              name="desired_occupations"
              control={control}
              render={({ field }) => (
                <TagSelector category="occupation" selected={field.value} onChange={field.onChange} />
              )}
            />
          </div>
        </FormSection>

        {/* 希望業界 */}
        <FormSection index={1} title="希望業界">
          <div className="bg-gray-50 p-4 rounded border">
            <Controller
              name="desired_industries"
              control={control}
              render={({ field }) => <TagSelector category="industry" selected={field.value} onChange={field.onChange} />}
            />
          </div>
        </FormSection>

        {/* 希望勤務地 */}
        <FormSection index={2} title="希望勤務地">
          <div className="bg-gray-50 p-4 rounded border">
            <Controller
              name="desired_locations"
              control={control}
              render={({ field }) => <TagSelector category="location" selected={field.value} onChange={field.onChange} />}
            />
          </div>
        </FormSection>

        {/* 資格・免許 */}
        <FormSection index={3} title="資格・免許">
          <div className="bg-gray-50 p-4 rounded border">
            <Controller
              name="licenses_qualifications"
              control={control}
              render={({ field }) => <TagSelector category="license" selected={field.value} onChange={field.onChange} />}
            />
          </div>
        </FormSection>

        <div className="lx-reveal flex gap-3 pt-4" style={stagger(5)}>
          <div className="min-w-0 flex-1">
            <Button type="button" variant="outline" onClick={() => router.back()}>
              戻る
            </Button>
          </div>
          <div className="lx-sheen min-w-0 flex-1">
            <Button type="submit" isLoading={isSubmitting}>
              入力を完了してCV作成へ
            </Button>
          </div>
        </div>
      </form>
    </div>
  );
}
