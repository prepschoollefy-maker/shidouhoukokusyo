-- mendan_tokens.token を uuid から text に変更し、短いトークンを使えるようにする
ALTER TABLE public.mendan_tokens ALTER COLUMN token DROP DEFAULT;
ALTER TABLE public.mendan_tokens ALTER COLUMN token TYPE text USING token::text;
