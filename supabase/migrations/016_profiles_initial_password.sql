-- Add initial_password column to profiles for admin to view teacher passwords
ALTER TABLE public.profiles ADD COLUMN initial_password text;
