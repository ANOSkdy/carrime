# Carrime

## UI / 高級感レイヤーのルール

コーポレートカラー・レイアウトの大枠・既存コンポーネントは変えず、余白・字間・罫線・モーションの質だけで高級感を出す。

- 色を追加しない（Tailwind gray・既存の blue 系・`styles/tokens.css` のブランド色のみ使用）
- モーションは `styles/luxe.css` の `lx-*` のみを使う。新しい `@keyframes` は作らない
- duration / easing をコンポーネントに直書きしない。`--motion-*` を参照する
- `components/ui` と `components/form` の見た目は変更しない（高級感はページ側で重ねる）
- 画面種別ごとの演出強度を守る
  - `app/resume`・`app/cv` 配下（求職者向け）: `lx-reveal` / `lx-rule` / `lx-sheen` / `lx-expand` / `lx-autofill` / `lx-breath`
  - `app/crm` 配下（業務画面）: `lx-fade` / `lx-row` / `lx-card` / `lx-link` のみ。`lx-reveal` と `lx-sheen` は禁止。操作への反応は 200ms 以下
- 新しい画面では `PageIntro` と `FormSection`（01 から番号）を使う
- stagger（`lib/ui/stagger.ts`）の上限は、求職者向けで 12、業務画面で 10
- `prefers-reduced-motion` の対応（`globals.css` と `luxe.css`）を削除しない
- CRM 一覧は サーバーコンポーネントを維持する（`'use client'` を追加しない）
