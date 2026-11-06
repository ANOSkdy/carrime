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

- `pnpm test`: 40件成功（認証・AIの既存回帰テストを含む）。
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

- PR: https://github.com/ANOSkdy/carrime/pull/23
- Previewで保存・取得・部分更新・空配列クリア・同時置換・400/404応答・PDF2種を実APIで確認。
- Runtime Logsで成功した保存・取得が各`dbRequests: 1`、不正入力が`dbRequests: 0`であることを相関IDで照合。
- 自己PR画面用の応答は検証データで103バイト、従来の全履歴取得は約9.2KB。実データ量により変わる。
- 実ブラウザで、戻る操作時のGET省略、職歴追加・削除後のキャッシュ破棄、503失敗時の文章保持と再保存、素早く次へ進んだ場合のPOST→PATCH→GETの順序を確認。ページの未処理例外なし。
- APIの入力エラーと、DB側のJSON解析・保存済みデータ形式エラーを区別する回帰テストを追加。ログと500応答には例外・個人情報が含まれない。

画面の往復時は30秒以内かつ保存がなければGET自体を省略する。キャッシュはページ再読み込みで消える。他の端末・タブによる変更は次の取得で反映する。
通信時間にはネットワーク・起動時間の変動も含まれるため、DB通信数の削減率を、そのまま画面表示時間の削減率とはしない。
本番マージ後も同じ検証専用レコードで保存・取得・PDFと画面の確認を行い、そのIDのレコードだけ削除する。
