# 保存・取得のDB通信削減

対象: 保存時のDB通信数と画面に不要な取得。リージョン、AIモデル、DBスキーマ、認証設定は変更しない。

| 処理 | 変更前のDB HTTP通信 | 変更後 |
| --- | ---: | ---: |
| 基本情報 POST | 4 | 1 |
| 通常 PATCH | 5 | 1 |
| 希望条件9項目 PATCH | 15 | 1 |
| 履歴書全体 GET | 4 | 1 |
| 学歴・職歴 GET / POST | 2 | 1 |
| 写真URL更新 | 2 | 1 |

通知が必要なステップ5完了時は、従来どおりメール送信と通知結果のDB書き込みが別途必要。
「1回」はSQL文数ではなくAPIとNeon間のHTTP通信数。

## 整合性と互換性

- 別HTTPリクエストに分かれていたBEGIN/COMMITを廃止。希望条件の置換はNeonの`queries`バッチ（READ COMMITTED）で親行更新・選択カテゴリ削除・一括追加・結果取得を同一トランザクションにする。親行ロックで同一履歴書の同時置換を直列化する。
- 希望条件は指定されたカテゴリだけ置換し、明示的な空配列はそのカテゴリをクリアする。未指定カテゴリと他ステップの自己PR・要約等を保持する。
- 既定GETは従来の`resume / educations / works`を維持。追加の`view=profile`と`view=selfpr`は必要な列だけ読む。
- ブラウザ内メモリのみ30秒・最大32件キャッシュし、進行中GETを共用する。失敗は保持せず、保存の開始・完了時に破棄する。個人情報の共有キャッシュは使わない。
- 保存操作を順序付きで永続化し、POST完了後にPATCHを実行する。次画面のGETも保存完了を待つ。失敗時は未送信操作をすべて残し、旧単一操作形式も読み取る。
- Runtime Logsには相関ID・時間・ステータス・DB通信数を記録する。SQL本文・入力・例外本文・認証情報は記録しない。

## ローカル検証

- `pnpm test`: 37件成功（認証・AIの既存回帰テストを含む）。
- `pnpm lint`: エラー0、既存警告7。
- `pnpm build`: 成功。
- `scripts/verify-resume-db.mjs`: PostgreSQLエンジンで14種の保存・取得の各1通信、部分更新・空配列・ロールバック・既存取得形式・ID互換性を確認。

SQLの検証は本番DBを使わず、外部の一時ディレクトリにインストールした`@electric-sql/pglite`で実行する。アプリ依存は追加しない。

```powershell
npm install --prefix C:/temp/carrime-db-qa --no-audit --no-fund @electric-sql/pglite
$env:CARRIME_PGLITE_MODULE='file:///C:/temp/carrime-db-qa/node_modules/@electric-sql/pglite/dist/index.js'
node scripts/verify-resume-db.mjs
```

## リリース検証

Previewでの実API・画面検証が完了してからマージする。検証用レコードは専用IDで作成し、検証後にそのIDのレコードだけ削除する。
