'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { Input } from '@/components/form/Input';
import { YearMonthFields } from '@/components/form/YearMonthFields';
import { Button } from '@/components/ui/Button';
import { BRAND_STORAGE_KEYS, getStorageItemWithLegacyFallback } from '@/lib/storage/branding';

// 学歴データの型
type Education = {
  id?: string;
  school_name: string;
  department?: string;
  degree?: string;
  start_year: number;
  start_month: number;
  end_year?: number;
  end_month?: number;
};

export default function ResumeStep3() {
  const router = useRouter();
  const [educations, setEducations] = useState<Education[]>([]);
  const [loading, setLoading] = useState(true);

  // フォーム管理 (新規追加用)
  const { register, handleSubmit, reset, formState: { errors } } = useForm<Education>({
    defaultValues: { start_year: 2010, start_month: 4, end_year: 2014, end_month: 3 }
  });

  // 初期データ読み込み
  useEffect(() => {
    const resumeId = getStorageItemWithLegacyFallback(BRAND_STORAGE_KEYS.resumeId.current, BRAND_STORAGE_KEYS.resumeId.legacy);
    if (!resumeId) {
      router.push('/resume/1');
      return;
    }
    
    fetch('/api/data/education?resumeId=' + resumeId)
      .then(res => res.json())
      .then(data => {
        if (data.educations) {
          setEducations(data.educations);
        }
      })
      .catch(err => console.error(err))
      .finally(() => setLoading(false));
  }, [router]);

  // 学歴追加処理
  const onAdd = async (data: Education) => {
    const resumeId = getStorageItemWithLegacyFallback(BRAND_STORAGE_KEYS.resumeId.current, BRAND_STORAGE_KEYS.resumeId.legacy);
    if(!resumeId) return;

    try {
      const payload = { ...data, resume_id: resumeId };
      const res = await fetch('/api/data/education', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      
      if (!res.ok) throw new Error('追加失敗');
      
      // リストを再取得するか、簡易的にstateに追加
      // ここでは簡易リロード
      const saved = await res.json();
      setEducations([...educations, { ...data, id: saved.id }]);
      reset(); // フォームクリア

    } catch (error) {
      alert('追加に失敗しました');
    }
  };

  // 削除処理
  const onDelete = async (id: string) => {
    if(!confirm('削除しますか？')) return;
    try {
      await fetch('/api/data/education?id=' + id, { method: 'DELETE' });
      setEducations(educations.filter(e => e.id !== id));
    } catch (error) {
      alert('削除失敗');
    }
  };

  const onNext = () => {
    router.push('/resume/4');
  };

  return (
    <div>
      <h2 className="text-xl font-bold mb-6">学歴の入力</h2>
      
      {/* 登録済みリスト */}
      <div className="mb-8 space-y-3">
        {loading && <p className="text-sm text-gray-400">学歴を読み込み中...</p>}
        {!loading && educations.length === 0 && <p className="text-gray-500">学歴はまだ登録されていません。</p>}
        
        {educations.map((edu) => (
          <div key={edu.id} className="p-4 border rounded bg-gray-50 space-y-3">
            <div className="min-w-0 space-y-1">
              <div className="font-bold text-lg break-words">{edu.school_name}</div>
              <div className="text-sm text-gray-600 leading-tight break-words">
                {edu.department} {edu.degree ? `(${edu.degree})` : ''}
              </div>
              <div className="text-xs text-gray-500">
                {edu.start_year}年{edu.start_month}月 〜 {edu.end_year ? `${edu.end_year}年${edu.end_month}月` : '現在'}
              </div>
            </div>
            <div className="flex justify-end">
              <Button
                variant="outline"
                onClick={() => edu.id && onDelete(edu.id)}
                className="w-auto min-h-[32px] h-auto px-2 py-1 text-xs text-red-600 border-red-200"
              >
                削除
              </Button>
            </div>
          </div>
        ))}
      </div>

      <hr className="my-6" />

      {/* 新規追加フォーム */}
      <div className="bg-blue-50 p-4 rounded-md mb-6">
        <h3 className="font-bold text-sm text-blue-800 mb-1">学歴を追加する</h3>
        <p className="text-xs text-gray-500 mb-4">
          ※最終学歴が〜高卒までは中学から、専門卒〜院卒は高校から記入<br />
          ※中途退学の場合は中途退学した学校まで記入
        </p>
        <form onSubmit={handleSubmit(onAdd)} className="@container space-y-4">
          <div className="grid grid-cols-1 gap-4 @md:grid-cols-2">
            <Input label="学校名" {...register('school_name', { required: true })} error={errors.school_name ? '必須です' : undefined} placeholder="〇〇大学" containerClassName="mb-0" />
            <Input label="学部・学科" {...register('department')} placeholder="経済学部" containerClassName="mb-0" />
          </div>
          
          <div className="grid grid-cols-1 items-end gap-3 @md:grid-cols-[1fr_auto_1fr]">
            <YearMonthFields label="入学" year={register('start_year', { valueAsNumber: true })} month={register('start_month', { valueAsNumber: true })} />
            <span className="text-center @md:mb-3">〜</span>
            <YearMonthFields label="卒業" year={register('end_year', { valueAsNumber: true })} month={register('end_month', { valueAsNumber: true })} />
          </div>
          <div className="flex justify-end">
            <Button type="submit" size="sm" variant="primary">学歴を追加</Button>
          </div>
        </form>
      </div>

      <div className="flex justify-between">
        <Button variant="outline" onClick={() => router.back()}>戻る</Button>
        <Button onClick={onNext} disabled={educations.length === 0}>次へ進む</Button>
      </div>
    </div>
  );
}
