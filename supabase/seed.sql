-- Seed subjects
INSERT INTO public.subjects (name, sort_order) VALUES
  ('数学', 1),
  ('英語', 2),
  ('国語', 3),
  ('理科', 4),
  ('社会', 5);

-- Seed attitude options (positive)
INSERT INTO public.attitude_options (label, category, sort_order) VALUES
  ('集中できていた', 'positive', 1),
  ('自分から質問した', 'positive', 2),
  ('前回より改善が見られた', 'positive', 3),
  ('意欲的だった', 'positive', 4),
  ('ノートを丁寧に書いていた', 'positive', 5);

-- Seed attitude options (negative)
INSERT INTO public.attitude_options (label, category, sort_order) VALUES
  ('集中が切れやすかった', 'negative', 1),
  ('眠そうだった', 'negative', 2),
  ('問題を解くのを嫌がった', 'negative', 3),
  ('同じミスを繰り返した', 'negative', 4);

-- Seed school settings (singleton)
INSERT INTO public.school_settings (school_name, email_signature, default_summary_frequency, auto_send_wait_hours)
VALUES ('レフィー', E'---\n個別指導塾レフィー\nお問い合わせはお気軽にどうぞ。', 4, 24);
