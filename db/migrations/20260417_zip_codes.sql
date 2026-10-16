-- 日本郵便 ken_all (utf_ken_all.csv) から作成した郵便番号 → 住所の参照テーブル
-- データ投入手順は scripts/build-zipcode-tsv.mjs の冒頭コメントを参照
create table if not exists zip_codes (
  postal_code char(7) not null,
  prefecture text not null,
  city text not null,
  town text not null default '',
  primary key (postal_code, town)
);

create index if not exists idx_zip_codes_postal_code on zip_codes(postal_code);
