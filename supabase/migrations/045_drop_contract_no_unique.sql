-- contract_no のユニーク制約を削除（同じ番号で複数契約を許可）
ALTER TABLE public.contracts DROP CONSTRAINT IF EXISTS contracts_contract_no_key;
DROP INDEX IF EXISTS contracts_contract_no_key;
