-- comiru座席データを保存するテーブル
create table if not exists comiru_lessons (
  id uuid primary key default gen_random_uuid(),
  teacher_name text not null,
  lesson_date date not null,
  start_time time not null,
  end_time time not null,
  synced_at timestamptz not null default now()
);

-- 同一講師・日付・時間帯の重複を防ぐ
create unique index if not exists comiru_lessons_unique
  on comiru_lessons (teacher_name, lesson_date, start_time);

-- 検索用インデックス
create index if not exists comiru_lessons_date_idx
  on comiru_lessons (lesson_date);
