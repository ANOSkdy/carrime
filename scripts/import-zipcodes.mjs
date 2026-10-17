// 日本郵便の郵便番号データ(ken_all)を zip_codes テーブルへ投入する。
//
// 使い方 (プロジェクトルートで実行):
//   node --env-file=.env.local scripts/import-zipcodes.mjs [path/to/utf_ken_all.csv]
//
// - 省略時は docs/zipcode/utf_ken_all.csv を読む
//   (https://www.post.japanpost.jp/service/search/zipcode/download/utf-zip.html の「全国一括」を展開したもの)
// - テーブルが無ければ作成し、既存行は重複スキップ(on conflict do nothing)するので再実行しても安全
// - 接続先は lib/db/postgres.ts と同じ環境変数 (DATABASE_URL_UNPOOLED / DATABASE_URL / NEON_DATABASE_URL)
// 列(0始まり): 2=郵便番号, 6=都道府県, 7=市区町村, 8=町域
import { readFileSync } from 'node:fs';

const input = process.argv[2] ?? 'docs/zipcode/utf_ken_all.csv';
const BATCH_SIZE = 1000;

const connectionString = ['DATABASE_URL_UNPOOLED', 'DATABASE_URL', 'NEON_DATABASE_URL']
  .map((key) => process.env[key]?.trim())
  .find(Boolean);
if (!connectionString) {
  console.error('DB接続情報がありません。--env-file=.env.local を付けて実行してください。');
  process.exit(1);
}

const endpoint = process.env.NEON_SQL_HTTP_URL?.trim() || `https://${new URL(connectionString).host}/sql`;

const run = async (text, params = []) => {
  const res = await fetch(endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Neon-Connection-String': connectionString },
    body: JSON.stringify({ query: text, params }),
  });
  if (!res.ok) throw new Error(`SQL failed (${res.status}) ${await res.text()}`);
};

const unquote = (v) => v.replace(/^"|"$/g, '');

// 町域が実際の地名でない場合は空にし、括弧書き(丁目・番地の補足)は取り除く
const normalizeTown = (raw) => {
  if (raw.includes('以下に掲載がない場合') || raw.endsWith('の次に番地がくる場合') || raw.includes('一円')) {
    return '';
  }
  return raw.replace(/（.*$/, '').replace(/」$/, '').trim();
};

const seen = new Set();
const rows = [];
for (const line of readFileSync(input, 'utf8').split(/\r?\n/)) {
  if (!line) continue;
  const cols = line.split(',').map(unquote);
  const postal = cols[2];
  if (!/^\d{7}$/.test(postal)) continue;
  const town = normalizeTown(cols[8] ?? '');
  const key = `${postal}\t${town}`;
  if (seen.has(key)) continue;
  seen.add(key);
  rows.push([postal, cols[6], cols[7], town]);
}
console.log(`parsed ${rows.length} rows from ${input}`);

await run(`create table if not exists zip_codes (
  postal_code char(7) not null,
  prefecture text not null,
  city text not null,
  town text not null default '',
  primary key (postal_code, town)
)`);
await run('create index if not exists idx_zip_codes_postal_code on zip_codes(postal_code)');

for (let i = 0; i < rows.length; i += BATCH_SIZE) {
  const batch = rows.slice(i, i + BATCH_SIZE);
  const placeholders = batch.map((_, j) => `($${j * 4 + 1}, $${j * 4 + 2}, $${j * 4 + 3}, $${j * 4 + 4})`).join(', ');
  await run(
    `insert into zip_codes (postal_code, prefecture, city, town) values ${placeholders} on conflict do nothing`,
    batch.flat()
  );
  process.stdout.write(`\rinserted ${Math.min(i + BATCH_SIZE, rows.length)} / ${rows.length}`);
}
console.log('\ndone');
