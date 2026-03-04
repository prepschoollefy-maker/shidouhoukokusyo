-- contracts.courses の JSONB 内のキー "name" を "course" にリネーム
-- 契約書作成アプリ（contractgenerator）が "name" で保存していたデータを修正
UPDATE public.contracts
SET courses = (
  SELECT jsonb_agg(
    CASE
      WHEN elem ? 'name' AND NOT (elem ? 'course')
      THEN (elem - 'name') || jsonb_build_object('course', elem->>'name')
      ELSE elem
    END
  )
  FROM jsonb_array_elements(courses) AS elem
)
WHERE courses::text LIKE '%"name"%';
