-- Add view_token for public access to summaries
ALTER TABLE public.summaries ADD COLUMN view_token uuid DEFAULT gen_random_uuid();
CREATE UNIQUE INDEX summaries_view_token_idx ON public.summaries (view_token);
