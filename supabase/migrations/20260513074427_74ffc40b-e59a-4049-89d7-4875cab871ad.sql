
-- 1. Add is_owner flag (super-admin)
ALTER TABLE public.user_roles
  ADD COLUMN IF NOT EXISTS is_owner boolean NOT NULL DEFAULT false;

-- Only one owner allowed
CREATE UNIQUE INDEX IF NOT EXISTS user_roles_single_owner_idx
  ON public.user_roles ((is_owner)) WHERE is_owner = true;

-- 2. Helper function
CREATE OR REPLACE FUNCTION public.is_owner(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND is_owner = true
  )
$$;

-- 3. Block non-owners from changing the YouTube API key
CREATE OR REPLACE FUNCTION public.guard_scan_settings_secrets()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF NEW.youtube_api_key IS DISTINCT FROM OLD.youtube_api_key
     AND NOT public.is_owner(auth.uid()) THEN
    RAISE EXCEPTION 'Only the owner can modify API keys';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS scan_settings_secret_guard ON public.scan_settings;
CREATE TRIGGER scan_settings_secret_guard
BEFORE UPDATE ON public.scan_settings
FOR EACH ROW EXECUTE FUNCTION public.guard_scan_settings_secrets();

-- 4. Seed the owner
UPDATE public.user_roles
SET is_owner = true, role = 'admin'
WHERE lower(email) = 'fricdanko@gmail.com';
