-- enrollment_fee が 0 または NULL の契約にキャンペーンに応じた入塾金を設定
-- デフォルト: 33,000円、入塾金無料/講習キャンペーン/入塾金支払い済み: 0円、入塾金半額: 16,500円
UPDATE public.contracts
SET enrollment_fee = CASE
  WHEN campaign IN ('入塾金無料', '講習キャンペーン', '入塾金支払い済み') THEN 0
  WHEN campaign = '入塾金半額' THEN 16500
  ELSE 33000
END
WHERE type = 'initial'
  AND (enrollment_fee IS NULL OR enrollment_fee = 0)
  AND (campaign IS NULL OR campaign NOT IN ('入塾金無料', '講習キャンペーン', '入塾金支払い済み'));
