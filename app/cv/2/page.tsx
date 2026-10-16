'use client';

import React, { useState, useEffect } from 'react';
import { useStepRouter } from '@/lib/navigation/use-step-router';
import { Button } from '@/components/ui/Button';
import { BRAND_STORAGE_KEYS, getStorageItemWithLegacyFallback } from '@/lib/storage/branding';

export default function CVStep2() {
  const router = useStepRouter();
  const [generatedPR, setGeneratedPR] = useState('');
  const [loading, setLoading] = useState(false);
  const [inputs, setInputs] = useState<any>(null);

  useEffect(() => {
    // localStorageから最新の入力を取得
    const saved = getStorageItemWithLegacyFallback(BRAND_STORAGE_KEYS.aiInputs.current, BRAND_STORAGE_KEYS.aiInputs.legacy);
    if (saved) {
      setInputs(JSON.parse(saved));
    } else {
      alert("入力データが見つかりません。Step 1に戻ります。");
      router.push('/cv/1');
    }

    // 既存の自己PRがあればロード
    const resumeId = getStorageItemWithLegacyFallback(BRAND_STORAGE_KEYS.resumeId.current, BRAND_STORAGE_KEYS.resumeId.legacy);
    if (resumeId) {
      fetch('/api/data/resume?id=' + resumeId)
        .then(res => res.json())
        .then(data => {
          if (data.resume && data.resume.self_pr) {
            setGeneratedPR(data.resume.self_pr);
          }
        });
    }
  }, [router]);

  const generateAI = async () => {
    if (!inputs) {
      alert("入力データが読み込めませんでした。ページをリロードしてください。");
      return;
    }
    setLoading(true);
    
    try {
      // APIへ送るデータを構築
      const payload = {
        strengths: [
            inputs.pr_summary || "強み未入力", 
            inputs.occupation ? `希望職種: ${inputs.occupation}` : ''
        ].filter(Boolean),
        
        experience: inputs.episode || "エピソード未入力",
        
        keywords: inputs.policy ? `大切にしている価値観: ${inputs.policy}` : ''
      };

      const res = await fetch('/api/ai/selfpr', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      
      const data = await res.json();
      if (data.result) {
        setGeneratedPR(data.result);
      } else {
        alert('AI生成に失敗しました');
      }

    } catch (error) {
      console.error(error);
      alert('エラーが発生しました');
    } finally {
      setLoading(false);
    }
  };

  const onSave = async () => {
    const resumeId = getStorageItemWithLegacyFallback(BRAND_STORAGE_KEYS.resumeId.current, BRAND_STORAGE_KEYS.resumeId.legacy);
    if (!resumeId) return;

    try {
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

    } catch (error) {
      alert('保存に失敗しました');
    }
  };

  return (
    <div>
      <h2 className="text-xl font-bold mb-4">自己PR</h2>
      
      <div className="bg-blue-50 p-4 rounded mb-6">
        <h3 className="font-bold text-sm mb-2 text-blue-800">AI アシスタント</h3>
        <div className="text-xs mb-2 text-gray-500">
          認識されているエピソード文字数: {inputs?.episode?.length || 0}文字
        </div>
        <Button onClick={generateAI} isLoading={loading} size="sm" className="w-full sm:w-auto">
          ✨ AIで自己PRを生成する
        </Button>
      </div>

      <div className="mb-6">
        <textarea 
          className="w-full p-4 border rounded-md h-64"
          value={generatedPR}
          onChange={(e) => setGeneratedPR(e.target.value)}
          placeholder="AI生成結果がここに表示されます..."
        />
      </div>

      <div className="flex justify-between">
        <Button variant="outline" onClick={() => router.back()}>戻る</Button>
        <Button onClick={onSave} disabled={!generatedPR}>保存して次へ</Button>
      </div>
    </div>
  );
}
