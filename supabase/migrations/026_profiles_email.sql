-- Add email column to profiles
ALTER TABLE public.profiles ADD COLUMN email text;

-- Backfill existing profiles with email from auth.users
UPDATE public.profiles p
SET email = u.email
FROM auth.users u
WHERE p.id = u.id;

-- Update handle_new_user to also copy email
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, role, display_name, email)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'role', 'teacher'),
    COALESCE(NEW.raw_user_meta_data->>'display_name', ''),
    NEW.email
  );
  -- Also sync role to app_metadata
  UPDATE auth.users SET raw_app_meta_data =
    raw_app_meta_data || jsonb_build_object('role', COALESCE(NEW.raw_user_meta_data->>'role', 'teacher'))
  WHERE id = NEW.id;
  RETURN NEW;
END;
$$;
