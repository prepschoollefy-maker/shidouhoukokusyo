ALTER TABLE public.school_settings
  ADD COLUMN mendan_auto_send_enabled boolean NOT NULL DEFAULT false,
  ADD COLUMN mendan_auto_send_day integer NOT NULL DEFAULT 1,
  ADD COLUMN mendan_auto_send_hour integer NOT NULL DEFAULT 9;
