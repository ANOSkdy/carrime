import { AiError } from './errors';
import type { AiKind } from './contracts';

function invalid(message: string): never {
  throw new AiError('INVALID_INPUT', message, 400, false, 'validation');
}

export function buildAiPrompt(kind: AiKind, value: unknown): string {
  if (!value || typeof value !== 'object' || Array.isArray(value)) invalid('入力データの形式を確認してください。');
  const body = value as Record<string, unknown>;
  if (kind === 'selfpr') {
    const { strengths, experience, keywords } = body;
    if (typeof experience !== 'string' || !experience.trim()) invalid('エピソードを入力してから生成してください。');
    if (strengths !== undefined && typeof strengths !== 'string' && !(Array.isArray(strengths) && strengths.every((s) => typeof s === 'string'))) invalid('強みの入力形式を確認してください。');
    if (keywords !== undefined && typeof keywords !== 'string') invalid('キーワードの入力形式を確認してください。');
    return `
あなたはプロのキャリアコンサルタントです。
求職者が入力した以下の「強み」と「経験」を元に、
企業の採用担当者に響く、魅力的で説得力のある自己PR文を作成してください。

【制約事項】
- 文字数は400文字〜600文字程度
- 具体的なエピソードを交えて論理的に構成する
- 丁寧語（です・ます調）を使用する
- 入力された情報が少ない場合は、適宜補完せず、入力内容に忠実に作成する

【入力情報】
■アピールしたい強み:
${Array.isArray(strengths) ? strengths.join(', ') : strengths || ''}

■キーワード/価値観:
${keywords || '特になし'}

■これまでの経験詳細:
${experience}

【出力】
自己PR文のみを出力してください。挨拶や装飾は不要です。
`;
  }

  const text = body[kind === 'summary' ? 'career_text' : 'experience_text'];
  if (typeof text !== 'string' || text.trim().length < 5) invalid('生成に必要な職歴データが不足しています。職歴の入力を確認してください。');
  if (kind === 'summary') return `
以下の職務経歴情報を、履歴書の冒頭に記載する「職務要約」としてまとめてください。

【制約事項】
- 文字数は200文字〜300文字程度
- どのような業界・職種で、どのような実績を上げたかを簡潔にまとめる
- 客観的かつプロフェッショナルな文体（「だ・である」調または「です・ます」調で統一）

【職務経歴データ】
${text}

【出力】
職務要約のテキストのみを出力してください。
`;

  return `
あなたはキャリアコンサルタントです。以下の職務経歴（cv/4で入力された内容）を元に、
応募先で活かせる経験・知識を3〜5項目の箇条書きでまとめてください。

【職務経歴データ】
${text}

【出力形式】
- 箇条書きで具体的かつ簡潔に
- 200〜300文字程度
- 過度に抽象化せず、実務で再現可能なスキル・知見に言及
`;
}
