'use client';

import React, { useEffect, useState } from 'react';
import { useStepRouter } from '@/lib/navigation/use-step-router';
import { useForm } from 'react-hook-form';
import { Input } from '@/components/form/Input';
import { Textarea } from '@/components/form/Textarea';
import { YearMonthFields } from '@/components/form/YearMonthFields';
import { Button } from '@/components/ui/Button';
import { BRAND_STORAGE_KEYS, getStorageItemWithLegacyFallback } from '@/lib/storage/branding';

type Work = {
  id?: string;
  company_name: string;
  department?: string;
  position?: string;
  start_year: number;
  start_month: number;
  end_year?: number;
  end_month?: number;
  is_current?: boolean;
  description?: string;
};

export default function ResumeStep4() {
  const router = useStepRouter();
  const [works, setWorks] = useState<Work[]>([]);
  const [loading, setLoading] = useState(true);
  const [showHint, setShowHint] = useState(false);
  const hintButtonClass =
    'inline-flex h-6 w-6 items-center justify-center rounded-full bg-blue-500 text-xs font-bold text-white shadow transition hover:bg-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-300';

  const { register, handleSubmit, reset, watch, setValue, formState: { errors } } = useForm<Work>({
    defaultValues: {
      start_year: 2015, start_month: 4,
      is_current: false
    }
  });

  const isCurrent = watch('is_current');

  useEffect(() => {
    if (isCurrent) {
      setValue('end_year', undefined);
      setValue('end_month', undefined);
    }
  }, [isCurrent, setValue]);

  useEffect(() => {
    const resumeId = getStorageItemWithLegacyFallback(BRAND_STORAGE_KEYS.resumeId.current, BRAND_STORAGE_KEYS.resumeId.legacy);
    if (!resumeId) {
      router.push('/resume/1');
      return;
    }
    fetch('/api/data/work?resumeId=' + resumeId)
      .then(res => res.json())
      .then(data => {
        if (data.works) setWorks(data.works);
      })
      .finally(() => setLoading(false));
  }, [router]);

  const onAdd = async (data: Work) => {
    const resumeId = getStorageItemWithLegacyFallback(BRAND_STORAGE_KEYS.resumeId.current, BRAND_STORAGE_KEYS.resumeId.legacy);
    if(!resumeId) return;

    try {
      const sanitizedEndYear = data.is_current ? undefined : Number.isFinite(data.end_year) ? data.end_year : undefined;
      const sanitizedEndMonth = data.is_current ? undefined : Number.isFinite(data.end_month) ? data.end_month : undefined;

      const payload = {
        ...data,
        end_year: sanitizedEndYear,
        end_month: sanitizedEndMonth,
        resume_id: resumeId,
      };
      const res = await fetch('/api/data/work', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (!res.ok) throw new Error('追加失敗');

      const saved = await res.json();
      setWorks([...works, { ...data, end_year: sanitizedEndYear, end_month: sanitizedEndMonth, id: saved.id }]);
      reset();

    } catch (error) {
      alert('追加に失敗しました');
    }
  };

  const onDelete = async (id: string) => {
    if(!confirm('削除しますか？')) return;
    try {
      await fetch('/api/data/work?id=' + id, { method: 'DELETE' });
      setWorks(works.filter(w => w.id !== id));
    } catch (error) {
      alert('削除失敗');
    }
  };

  const onNext = () => {
    router.push('/resume/5');
  };

  return (
    <div>
      <h2 className="text-xl font-bold mb-6">職歴の入力</h2>
      
      {/* 登録済みリスト */}
      <div className="mb-8 space-y-4">
        {loading && <p className="text-sm text-gray-400">職歴を読み込み中...</p>}
        {!loading && works.length === 0 && <p className="text-gray-500">職歴はまだ登録されていません。</p>}
        
        {works.map((work) => (
          <div key={work.id} className="p-4 border rounded bg-gray-50 space-y-3">
            <div className="min-w-0 space-y-1">
              <div className="font-bold text-lg break-words">{work.company_name}</div>
              <div className="text-sm text-gray-600 leading-tight break-words">
                {work.department} / {work.position}
              </div>
              <div className="text-xs text-gray-500">
                {work.start_year}年{work.start_month}月 〜 {
                  work.is_current
                    ? '現在'
                    : work.end_year && work.end_month
                      ? `${work.end_year}年${work.end_month}月`
                      : '未設定'
                }
              </div>
            </div>
            {work.description && (
              <p className="text-sm text-gray-700 bg-white p-2 rounded border border-gray-100 whitespace-pre-wrap">
                {work.description}
              </p>
            )}
            <div className="flex justify-end">
              <Button
                variant="outline"
                onClick={() => work.id && onDelete(work.id)}
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
      <div className="bg-blue-50 p-5 rounded-md mb-6">
        <h3 className="font-bold text-sm mb-4 text-blue-800">職歴を追加する</h3>
        <form onSubmit={handleSubmit(onAdd)} className="@container space-y-4">
          <div className="grid grid-cols-1 gap-4 @md:grid-cols-2">
            <Input label="企業名" {...register('company_name', { required: true })} error={errors.company_name ? '必須です' : undefined} placeholder="株式会社〇〇" containerClassName="mb-0" />
            <Input label="部署名" {...register('department')} placeholder="営業部" containerClassName="mb-0" />
          </div>

          <Input label="役職" {...register('position')} placeholder="メンバー" containerClassName="mb-0" />
          
          <div className="grid grid-cols-1 items-end gap-3 @md:grid-cols-[1fr_auto_1fr]">
            <YearMonthFields label="入社" year={register('start_year', { valueAsNumber: true })} month={register('start_month', { valueAsNumber: true })} />
            <span className="text-center @md:mb-3">〜</span>
            <div>
                 {!isCurrent ? (
                   <YearMonthFields label="退社" year={register('end_year', { valueAsNumber: true })} month={register('end_month', { valueAsNumber: true })} />
                 ) : (
                   <span className="text-sm font-bold text-green-600 px-2">現在在籍中</span>
                 )}
            </div>
            <div className="mb-2 @md:col-span-3">
              <label className="flex items-center text-xs cursor-pointer">
                <input type="checkbox" {...register('is_current')} className="mr-1" />
                現在在籍中
              </label>
            </div>
          </div>

          <div>
              <div className="flex items-center gap-2 mb-1">
                <label className="text-xs font-bold text-gray-600">業務内容詳細</label>
                <div className="relative flex-shrink-0">
                  <button
                    type="button"
                    onClick={() => setShowHint((prev) => !prev)}
                    aria-expanded={showHint}
                    className={hintButtonClass}
                  >
                    ?
                  </button>
                {showHint && (
                  <div
                    className="fixed inset-0 z-40 flex items-start justify-center bg-black/30 px-4 py-6"
                    onClick={() => setShowHint(false)}
                  >
                    <div
                      className="relative w-full max-w-[min(24rem,92vw)] max-h-[80vh] overflow-y-auto rounded-lg border border-gray-200 bg-white p-4 text-xs text-gray-800 shadow-xl"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <button
                        type="button"
                        aria-label="ヒントを閉じる"
                        className="absolute right-2 top-2 inline-flex h-6 w-6 items-center justify-center rounded-full bg-gray-100 text-gray-500 shadow-sm transition hover:bg-gray-200"
                        onClick={() => setShowHint(false)}
                      >
                        ×
                      </button>
                      <div className="space-y-4 pr-1">
                        <div>
                          <p className="font-semibold text-gray-700">【営業】</p>
                          <p className="mt-1">前職では法人営業として以下の業務を担当していました。</p>
                          <ul className="list-disc list-inside space-y-1 mt-1">
                            <li>新規開拓（架電・訪問・メール）</li>
                            <li>既存顧客フォロー、追加提案</li>
                            <li>見積・契約業務、請求管理</li>
                            <li>商談準備、提案資料作成</li>
                            <li>売上・KPI分析、営業戦略立案</li>
                            <li>導入後フォロー、トラブル対応</li>
                          </ul>
                          <p className="mt-1">顧客課題を把握し、最適な提案につなげる営業活動を行っていました。</p>
                        </div>
                        <div>
                          <p className="font-semibold text-gray-700">【事務】</p>
                          <p className="mt-1">前職では一般事務として以下の業務を担当していました。</p>
                          <ul className="list-disc list-inside space-y-1 mt-1">
                            <li>データ入力、管理</li>
                            <li>電話・メール対応</li>
                            <li>契約書・請求書作成</li>
                            <li>各種書類のファイリング・管理</li>
                            <li>スケジュール調整、備品管理</li>
                            <li>来客対応</li>
                          </ul>
                          <p className="mt-1">正確性とスピードを意識し、サポート全般を担当していました。</p>
                        </div>
                        <div>
                          <p className="font-semibold text-gray-700">【接客】</p>
                          <p className="mt-1">前職では接客販売として以下の業務を担当していました。</p>
                          <ul className="list-disc list-inside space-y-1 mt-1">
                            <li>お客様への商品案内・販売</li>
                            <li>レジ対応、会計処理</li>
                            <li>売場づくり、商品陳列・補充</li>
                            <li>在庫管理・棚卸し</li>
                            <li>クレーム対応、問い合わせ対応</li>
                            <li>POP作成、SNS投稿補助</li>
                          </ul>
                          <p className="mt-1">常にお客様視点を意識し、満足度の高い接客を心がけていました。</p>
                        </div>
                        <div>
                          <p className="font-semibold text-gray-700">【工場（製造）】</p>
                          <p className="mt-1">前職では製造オペレーターとして以下の業務を担当しました。</p>
                          <ul className="list-disc list-inside space-y-1 mt-1">
                            <li>製造ラインの機械操作</li>
                            <li>製品の検査・品質チェック</li>
                            <li>梱包、出荷業務</li>
                            <li>不良品の仕分け</li>
                            <li>日報記録、在庫管理</li>
                            <li>5S活動、安全管理</li>
                          </ul>
                          <p className="mt-1">安全と品質を徹底して、安定したライン稼働に努めていました。</p>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
            <Textarea {...register('description')} rows={4} placeholder="法人営業を担当。新規開拓を中心に..." containerClassName="mb-0" />
          </div>

          <div className="flex justify-end">
            <Button type="submit" size="sm" variant="primary">職歴を追加</Button>
          </div>
        </form>
      </div>

      <div className="flex justify-between">
        <Button variant="outline" onClick={() => router.back()}>戻る</Button>
        <Button onClick={onNext} disabled={works.length === 0}>次へ進む</Button>
      </div>
    </div>
  );
}
