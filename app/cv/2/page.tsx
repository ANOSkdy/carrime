'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useStepRouter } from '@/lib/navigation/use-step-router';
import { Button } from '@/components/ui/Button';
import { PageIntro } from '@/components/layout/PageIntro';
import { stagger } from '@/lib/ui/stagger';
import { BRAND_STORAGE_KEYS, getStorageItemWithLegacyFallback } from '@/lib/storage/branding';
import { loadAiInputs, type AiInputData } from '@/lib/storage/ai-inputs';
import { useAiGeneration } from '@/lib/ai/use-ai-generation';
import { AiErrorNotice } from '@/components/ui/AiErrorNotice';
import { newCorrelationId } from '@/lib/observability/correlation';
import { reportClientFailure, type ClientFailure } from '@/lib/ai/client';

export default function CVStep2() {
  const router = useStepRouter();
  const [generatedPR, setGeneratedPR] = useState('');
  const { generate, loading, error: aiError } = useAiGeneration('/api/ai/selfpr');
  const [inputs, setInputs] = useState<AiInputData | null>(null);
  const [pageError, setPageError] = useState<ClientFailure | null>(null);
  const edited = useRef(false);

  useEffect(() => {
    // localStorageから最新の入力を取得
    const loaded = loadAiInputs();
    if (loaded.status === 'ready') {
      setInputs(loaded.inputs);
    } else {
      const failure = { code: 'CLIENT_STORAGE_ERROR', correlationId: newCorrelationId(), retryable: false,
        message: loaded.status === 'missing'
          ? 'このURLではヒアリング入力が見つかりません。入力は別のドメインやブラウザから自動では引き継がれません。前の画面で確認してください。'
          : '保存済みの入力を読み取れませんでした。元のデータは削除していません。前の画面で入力内容とブラウザの保存設定を確認してください。' };
      setPageError(failure);
      reportClientFailure('/api/ai/selfpr', failure);
    }

    // 既存の自己PRがあればロード
    const controller = new AbortController();
    try {
      const resumeId = getStorageItemWithLegacyFallback(BRAND_STORAGE_KEYS.resumeId.current, BRAND_STORAGE_KEYS.resumeId.legacy);
      if (resumeId) {
        fetch('/api/data/resume?id=' + encodeURIComponent(resumeId), { signal: controller.signal })
          .then(res => { if (!res.ok) throw new Error('LOAD_FAILED'); return res.json(); })
          .then(data => {
            if (!controller.signal.aborted && !edited.current && typeof data.resume?.self_pr === 'string') setGeneratedPR(data.resume.self_pr);
          })
          .catch(() => {
            if (!controller.signal.aborted) setPageError({ code: 'RESUME_LOAD_FAILED', correlationId: newCorrelationId(), retryable: false,
              message: '保存済みの自己PRを読み込めませんでした。新しく生成する前に接続を確認してください。' });
          });
      }
    } catch {
      // The input loader above already reports disabled/unavailable storage.
    }
    return () => controller.abort();
  }, [router]);

  const generateAI = async () => {
    if (!inputs) {
      return;
    }
    const payload = {
      strengths: [inputs.pr_summary, inputs.occupation ? `希望職種: ${inputs.occupation}` : ''].filter(Boolean),
      experience: inputs.episode,
      keywords: inputs.policy ? `大切にしている価値観: ${inputs.policy}` : '',
    };
    const result = await generate(payload);
    if (result !== null) { edited.current = true; setGeneratedPR(result); }
  };

  const onSave = async () => {
    try {
      const resumeId = getStorageItemWithLegacyFallback(BRAND_STORAGE_KEYS.resumeId.current, BRAND_STORAGE_KEYS.resumeId.legacy);
      if (!resumeId) {
        setPageError({ code: 'RESUME_ID_MISSING', correlationId: newCorrelationId(), retryable: false,
          message: 'このURLでは履歴書の保存先が見つかりません。入力内容を控え、基本情報の画面で保存先を確認してください。' });
        return;
      }
      const payload = {
        resume_id: resumeId,
        self_pr: generatedPR
      };

      const res = await fetch('/api/data/resume', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!res.ok) throw new Error('保存失敗');
      router.push('/cv/3');

    } catch {
      setPageError({ code: 'RESUME_SAVE_FAILED', correlationId: newCorrelationId(), retryable: false,
        message: '自己PRを保存できませんでした。文章は画面に保持されています。接続を確認してもう一度保存してください。' });
    }
  };

  return (
    <div className="lx">
      <PageIntro
        eyebrow="Step 07 — Self PR"
        title="自己PR"
        description="AIが生成した自己PRを確認し、自由に編集できます。"
      />
      
      <div className="bg-blue-50 p-4 rounded mb-6">
        <h3 className="font-bold text-sm mb-2 text-blue-800">AI アシスタント</h3>
        <div className="text-xs mb-2 text-gray-500">
          認識されているエピソード文字数: {inputs?.episode?.length || 0}文字
        </div>
        <Button onClick={generateAI} disabled={!inputs} isLoading={loading} size="sm" className="w-full sm:w-auto">
          ✨ AIで自己PRを生成する
        </Button>
      </div>
      <AiErrorNotice error={pageError} preservesInput={false} />
      <AiErrorNotice error={aiError} onRetry={generateAI} busy={loading} />

      <div className="mb-6">
        <textarea 
          className="w-full p-4 border rounded-md h-64"
          value={generatedPR}
          onChange={(e) => { edited.current = true; setGeneratedPR(e.target.value); }}
          placeholder="AI生成結果がここに表示されます..."
        />
      </div>

      <div className="lx-reveal flex gap-3" style={stagger(3)}>
        <div className="min-w-0 flex-1">
          <Button variant="outline" onClick={() => router.back()}>戻る</Button>
        </div>
        <div className="lx-sheen min-w-0 flex-1">
          <Button onClick={onSave} disabled={!generatedPR || loading}>保存して次へ</Button>
        </div>
      </div>
    </div>
  );
}
