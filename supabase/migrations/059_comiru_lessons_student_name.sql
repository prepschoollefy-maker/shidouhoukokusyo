-- comiru_lessonsに生徒名カラムを追加
alter table comiru_lessons add column if not exists student_name text;
