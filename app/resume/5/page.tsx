'use client';

import React from 'react';
import { useRouter } from 'next/navigation';
import { Controller, useForm } from 'react-hook-form';
import { Button } from '@/components/ui/Button';
import { TagSelector } from '@/components/ui/TagSelector';
import { ensureResumeId, saveResumePatchInBackground } from '@/lib/storage/resume-save';

type FormData = {
  desired_occupations: string[];
  desired_industries: string[];
  desired_locations: string[];
  licenses_qualifications: string[];
};

export default function ResumeStep5() {
  const router = useRouter();
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
    <div>
      <h2 className="text-xl font-bold mb-6">希望条件の入力</h2>
      <p className="text-sm text-gray-500 mb-6">希望する職種や業界を選択してください (最大3つまで)</p>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-8">
        {/* 希望職種 */}
        <div>
          <label className="block text-sm font-bold text-gray-700 mb-2">希望職種</label>
          <div className="bg-gray-50 p-4 rounded border">
            <Controller
              name="desired_occupations"
              control={control}
              render={({ field }) => (
                <TagSelector category="occupation" selected={field.value} onChange={field.onChange} />
              )}
            />
          </div>
        </div>

        {/* 希望業界 */}
        <div>
          <label className="block text-sm font-bold text-gray-700 mb-2">希望業界</label>
          <div className="bg-gray-50 p-4 rounded border">
            <Controller
              name="desired_industries"
              control={control}
              render={({ field }) => <TagSelector category="industry" selected={field.value} onChange={field.onChange} />}
            />
          </div>
        </div>

        {/* 希望勤務地 */}
        <div>
          <label className="block text-sm font-bold text-gray-700 mb-2">希望勤務地</label>
          <div className="bg-gray-50 p-4 rounded border">
            <Controller
              name="desired_locations"
              control={control}
              render={({ field }) => <TagSelector category="location" selected={field.value} onChange={field.onChange} />}
            />
          </div>
        </div>

        {/* 資格・免許 */}
        <div>
          <label className="block text-sm font-bold text-gray-700 mb-2">資格・免許</label>
          <div className="bg-gray-50 p-4 rounded border">
            <Controller
              name="licenses_qualifications"
              control={control}
              render={({ field }) => <TagSelector category="license" selected={field.value} onChange={field.onChange} />}
            />
          </div>
        </div>

        <div className="flex justify-between pt-4">
          <Button type="button" variant="outline" onClick={() => router.back()}>
            戻る
          </Button>
          <Button type="submit" isLoading={isSubmitting}>
            入力を完了してCV作成へ
          </Button>
        </div>
      </form>
    </div>
  );
}
