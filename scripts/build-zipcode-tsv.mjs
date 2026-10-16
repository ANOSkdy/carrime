// 日本郵便の郵便番号データ(ken_all)を zip_codes テーブル投入用 TSV に変換する。
//
// 手順:
//   1. https://www.post.japanpost.jp/zipcode/dl/utf-zip.html から
//      「全国一括」(utf_ken_all.zip) をダウンロードして展開し utf_ken_all.csv を得る
//   2. node scripts/build-zipcode-tsv.mjs path/to/utf_ken_all.csv zip_codes.tsv
//   3. db/migrations/20260417_zip_codes.sql を適用した DB に対して psql で投入:
//        \copy zip_codes (postal_code, prefecture, city, town) from 'zip_codes.tsv'
//
// 列(0始まり): 2=郵便番号, 6=都道府県, 7=市区町村, 8=町域
import { readFileSync, writeFileSync } from 'node:fs';

const [input, output = 'zip_codes.tsv'] = process.argv.slice(2);
if (!input) {
  console.error('usage: node scripts/build-zipcode-tsv.mjs <utf_ken_all.csv> [out.tsv]');
  process.exit(1);
}

const unquote = (v) => v.replace(/^"|"$/g, '');

// 町域が実際の地名でない場合は空にし、括弧書き(丁目・番地の補足)は取り除く
const normalizeTown = (raw) => {
  if (raw.includes('以下に掲載がない場合') || raw.endsWith('の次に番地がくる場合') || raw.includes('一円')) {
    return '';
  }
  return raw.replace(/（.*$/, '').replace(/」$/, '').trim();
};

const seen = new Set();
const lines = [];
for (const line of readFileSync(input, 'utf8').split(/\r?\n/)) {
  if (!line) continue;
  const cols = line.split(',').map(unquote);
  const postal = cols[2];
  if (!/^\d{7}$/.test(postal)) continue;
  const town = normalizeTown(cols[8] ?? '');
  const key = `${postal}\t${town}`;
  if (seen.has(key)) continue;
  seen.add(key);
  lines.push([postal, cols[6], cols[7], town].join('\t'));
}

writeFileSync(output, lines.join('\n') + '\n', 'utf8');
console.log(`wrote ${lines.length} rows to ${output}`);
