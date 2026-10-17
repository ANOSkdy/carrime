'use client';

import React, { useEffect, useState } from 'react';
import { useStepRouter } from '@/lib/navigation/use-step-router';
import { useForm } from 'react-hook-form';
import { Button } from '@/components/ui/Button';
import { PageIntro } from '@/components/layout/PageIntro';
import { stagger } from '@/lib/ui/stagger';
import { BRAND_STORAGE_KEYS, getStorageItemWithLegacyFallback } from '@/lib/storage/branding';

// 新しい4つの質問に対応するデータ型
type AiInputData = {
  pr_summary: string; // 1. 強み・PR
  episode: string;    // 2. 具体的なエピソード
  policy: string;     // 3. 大切にしていること(価値観)
  occupation: string; // 4. 希望職種
};

export default function CVStep1() {
  const router = useStepRouter();
  const [openHint, setOpenHint] = useState<'pr_summary' | 'episode' | 'policy' | null>(null);
  const { register, handleSubmit, setValue } = useForm<AiInputData>();
  const hintButtonClass =
    'inline-flex h-6 w-6 items-center justify-center rounded-full bg-blue-500 text-xs font-bold text-white shadow transition hover:bg-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-300';

  useEffect(() => {
    // 以前の入力があればロード
    const saved = getStorageItemWithLegacyFallback(BRAND_STORAGE_KEYS.aiInputs.current, BRAND_STORAGE_KEYS.aiInputs.legacy);
    if (saved) {
      const parsed = JSON.parse(saved);
      // 旧データ形式との互換性チェック（念のため）
      if (parsed.pr_summary) {
        setValue('pr_summary', parsed.pr_summary);
        setValue('episode', parsed.episode);
        setValue('policy', parsed.policy);
        setValue('occupation', parsed.occupation);
      }
    }
  }, [setValue]);

  const onSubmit = (data: AiInputData) => {
    localStorage.setItem(BRAND_STORAGE_KEYS.aiInputs.current, JSON.stringify(data));
    router.push('/cv/2');
  };

  return (
    <div className="lx">
      <PageIntro
        eyebrow="Step 06 — Interview"
        title="自己PR作成のためのヒアリング"
        description="以下の質問にお答えください。AIが回答内容を分析し、あなたの魅力が伝わる自己PRを作成します。"
      />
      
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-8">
        
        {/* Q1 */}
        <div>
          <div className="flex items-center gap-2 mb-2">
            <label className="block text-sm font-bold text-gray-700">
              1. 自己の強みやPRしたいことを教えてください
            </label>
            <button
              type="button"
              onClick={() => setOpenHint('pr_summary')}
              aria-expanded={openHint === 'pr_summary'}
              className={hintButtonClass}
            >
              ?
            </button>
          </div>
          <textarea
            {...register('pr_summary', { required: true })}
            className="w-full px-3 py-2 border rounded h-24"
            placeholder="例: 私の強みは「粘り強さ」と「チームワーク」です。困難な課題でも諦めず..."
          />
        </div>

        {/* Q2 */}
        <div>
          <div className="flex items-center gap-2 mb-2">
            <label className="block text-sm font-bold text-gray-700">
              2. 強みが生かされた具体的なエピソードを教えてください
            </label>
            <button
              type="button"
              onClick={() => setOpenHint('episode')}
              aria-expanded={openHint === 'episode'}
              className={hintButtonClass}
            >
              ?
            </button>
          </div>
          <textarea
            {...register('episode', { required: true })}
            className="w-full px-3 py-2 border rounded h-32"
            placeholder="例: 前職のプロジェクトでトラブルが発生した際、関係各所と調整を行い..."
          />
        </div>

        {/* Q3 */}
        <div>
          <div className="flex items-center gap-2 mb-2">
            <label className="block text-sm font-bold text-gray-700">
              3. 仕事をする上で大切にしていることを、理由を含めて教えてください
            </label>
            <button
              type="button"
              onClick={() => setOpenHint('policy')}
              aria-expanded={openHint === 'policy'}
              className={hintButtonClass}
            >
              ?
            </button>
          </div>
          <textarea
            {...register('policy')}
            className="w-full px-3 py-2 border rounded h-24"
            placeholder="例: 「相手の期待を少し超えること」を大切にしています。なぜなら..."
          />
        </div>

        {/* Q4 */}
        <div>
          <label className="block text-sm font-bold text-gray-700 mb-2">
            4. 希望している職種を教えてください
          </label>
          <input 
            {...register('occupation')} 
            className="w-full px-3 py-2 border rounded" 
            placeholder="例: 法人営業、Webエンジニア"
          />
        </div>

      <div className="lx-reveal flex justify-end pt-4" style={stagger(4)}>
        <div className="lx-sheen">
          <Button type="submit">次へ進みAI生成する</Button>
        </div>
      </div>
      {openHint && (
        <div
          className="fixed inset-0 z-40 flex items-start justify-center bg-black/30 px-4 py-6"
          onClick={() => setOpenHint(null)}
        >
          <div
            className="relative w-full max-w-[min(28rem,92vw)] max-h-[80vh] overflow-y-auto rounded-lg border border-gray-200 bg-white p-4 text-xs text-gray-800 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              aria-label="ヒントを閉じる"
              className="absolute right-2 top-2 inline-flex h-6 w-6 items-center justify-center rounded-full bg-gray-100 text-gray-500 shadow-sm transition hover:bg-gray-200"
              onClick={() => setOpenHint(null)}
            >
              ×
            </button>
            <div className="space-y-4 pr-1">
              {openHint === 'pr_summary' && (
                <>
                  <div>
                    <p className="font-semibold text-gray-700">【営業】</p>
                    <p className="mt-1">私の強みは「ヒアリング力と課題解決型の提案力」です。顧客の本質的な課題をつかみ、最適な解決策に導けます。</p>
                  </div>
                  <div>
                    <p className="font-semibold text-gray-700">【事務】</p>
                    <p className="mt-1">私の強みは「正確でミスの少ない事務処理能力」と「サポート力」です。周囲を支えながら効率的に業務を進められます。</p>
                  </div>
                  <div>
                    <p className="font-semibold text-gray-700">【接客】</p>
                    <p className="mt-1">私の強みは「相手の気持ちをくみ取るコミュニケーション能力」です。お客様に信頼される接客ができます。</p>
                  </div>
                  <div>
                    <p className="font-semibold text-gray-700">【工場（製造）】</p>
                    <p className="mt-1">私の強みは「集中力と丁寧さ」です。ミスを防ぎながらコツコツ作業を続けることが得意です。</p>
                  </div>
                </>
              )}
              {openHint === 'episode' && (
                <>
                  <div>
                    <p className="font-semibold text-gray-700">【営業職】</p>
                    <p className="mt-1">私は、顧客の課題を深く理解した上で最適な提案ができる点に強みがあります。課題を正しく捉えた提案は、顧客満足と売上の双方に直結すると考えているためです。</p>
                    <p className="mt-1">実際に、既存顧客の売上が伸び悩んでいた際、業務フローを詳細にヒアリングし「非効率な作業工程」が課題であることを発見しました。そこで、既存プランの改善と新しいサービスの組み合わせを提案したところ、年間売上が〇〇万円増加し、部署表彰をいただきました。</p>
                    <p className="mt-1">この経験から、顧客の状況を的確に捉え提案につなげる力が私の強みだと自信を持っています。</p>
                  </div>
                  <div>
                    <p className="font-semibold text-gray-700">【事務職】</p>
                    <p className="mt-1">私は、正確性を保ちながら業務改善につなげる力が強みです。事務は正確な処理だけでなく、全体の効率を上げる工夫が求められると考えているからです。</p>
                    <p className="mt-1">繁忙期に大量のデータ入力が発生した際、入力ルールがバラバラなことでミスや時間ロスが多い状況でした。そこで私は、入力ルールを統一したフォーマットを作成しチームに共有。結果、処理速度が20％向上し、ミスも大幅に減少しました。</p>
                    <p className="mt-1">業務の正確性を守りながら改善を進められる点が、私の強みであり価値だと考えています。</p>
                  </div>
                  <div>
                    <p className="font-semibold text-gray-700">【接客職】</p>
                    <p className="mt-1">私は、お客様のニーズを正確に把握し、満足度の高い接客につなげる力があります。接客において、お客様が本当に求めていることを理解することが、信頼につながるためです。</p>
                    <p className="mt-1">購入を迷っていたお客様に対し、使用シーンを丁寧にヒアリングした上で複数の商品を比較しながら説明したところ、「丁寧で安心できた」と評価いただき、その場で購入につながりました。その後、指名をいただくことも増えました。</p>
                    <p className="mt-1">お客様の気持ちを汲み取った接客ができることが私の大きな強みです。</p>
                  </div>
                  <div>
                    <p className="font-semibold text-gray-700">【工場（製造職）】</p>
                    <p className="mt-1">私は、正確な作業と改善提案により品質向上に貢献できる点が強みです。製造現場では、小さな改善が大きな生産性向上につながると理解しているためです。</p>
                    <p className="mt-1">不良品が増えていたラインで、作業工程ごとの手順を洗い出し、問題箇所を可視化しました。そこで改善案を提案し実施した結果、不良率が〇〇％削減され、班長から表彰をいただきました。</p>
                    <p className="mt-1">確実な作業に加えて改善に取り組める点が、現場で発揮できる私の強みです。</p>
                  </div>
                </>
              )}
              {openHint === 'policy' && (
                <>
                  <div>
                    <p className="font-semibold text-gray-700">【営業職】</p>
                    <p className="mt-1">私が最も大切にしているのは「信頼関係の構築」です。営業は単なる商品説明ではなく、信頼があるからこそ価値で選ばれる仕事だと考えているためです。</p>
                    <p className="mt-1">実際に、顧客と定期的にコミュニケーションを取りながら課題を聞き出し、丁寧に改善提案を行ったことで「あなたから買いたい」という言葉をいただき、継続契約にもつながりました。</p>
                    <p className="mt-1">だからこそ、私は信頼を積み重ねる営業スタイルを最も大切にしています。</p>
                  </div>
                  <div>
                    <p className="font-semibold text-gray-700">【事務職】</p>
                    <p className="mt-1">私は「正確性と期日遵守」を最も大切にしています。事務のミスは会社全体の信用や業務に影響するため、最も重要だと考えているからです。</p>
                    <p className="mt-1">提出期限が重なった繁忙期でも、優先順位を整理し、全業務を期限内にミスなく完了させたことで部署全体の進行がスムーズになり、上司から評価をいただきました。</p>
                    <p className="mt-1">この経験から、正確で期限を守る姿勢を今後も徹底していきます。</p>
                  </div>
                  <div>
                    <p className="font-semibold text-gray-700">【接客職】</p>
                    <p className="mt-1">私が大切にしているのは「相手目線で行動すること」です。お客様が快適に過ごせるかどうかは、相手の立場を理解できるかに左右されるためです。</p>
                    <p className="mt-1">混雑時にもお客様一人ひとりの状況を確認し、声がけや案内を工夫したことで、クレームが減少し、店舗評価が向上しました。</p>
                    <p className="mt-1">相手目線で考え続ける姿勢が、質の高い接客につながると確信しています。</p>
                  </div>
                  <div>
                    <p className="font-semibold text-gray-700">【工場（製造職）】</p>
                    <p className="mt-1">私は「安全第一」を最も大切にしています。安全が守られてこそ、高品質な製品づくりや効率向上につながるためです。</p>
                    <p className="mt-1">作業手順が複雑な工程で危険が潜んでいたため、危険箇所の見える化や手順改善を提案し、事故ゼロを維持できました。上司からも「現場の安全意識が高まった」と評価されました。</p>
                    <p className="mt-1">安全意識を高く持ち続けることが、安定した生産に欠かせないと考えています。</p>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}
      </form>
    </div>
  );
}
