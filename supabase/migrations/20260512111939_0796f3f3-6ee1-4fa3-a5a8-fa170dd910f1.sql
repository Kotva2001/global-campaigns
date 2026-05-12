-- Enum
CREATE TYPE public.app_role AS ENUM ('admin', 'editor', 'viewer');

-- Table
CREATE TABLE public.user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  email text NOT NULL UNIQUE,
  display_name text,
  role public.app_role NOT NULL DEFAULT 'viewer',
  last_login_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX user_roles_user_id_idx ON public.user_roles(user_id);
CREATE INDEX user_roles_email_idx ON public.user_roles(lower(email));

ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- Security definer helper to avoid recursive RLS
CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  )
$$;

CREATE OR REPLACE FUNCTION public.current_user_role()
RETURNS public.app_role
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT role FROM public.user_roles WHERE user_id = auth.uid() LIMIT 1
$$;

-- RLS policies
CREATE POLICY "users can view own role"
ON public.user_roles FOR SELECT
USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'));

CREATE POLICY "admins can insert"
ON public.user_roles FOR INSERT
WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "admins can update"
ON public.user_roles FOR UPDATE
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "admins can delete"
ON public.user_roles FOR DELETE
USING (public.has_role(auth.uid(), 'admin'));

-- updated_at trigger
CREATE TRIGGER trg_user_roles_updated_at
BEFORE UPDATE ON public.user_roles
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Claim function: links a pre-seeded email row to the signed-in user, updates last_login
CREATE OR REPLACE FUNCTION public.claim_user_role()
RETURNS public.user_roles
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_email text;
  v_display_name text;
  v_avatar text;
  v_row public.user_roles;
BEGIN
  IF v_user_id IS NULL THEN
    RETURN NULL;
  END IF;

  SELECT email,
         COALESCE(raw_user_meta_data->>'full_name', raw_user_meta_data->>'name'),
         raw_user_meta_data->>'avatar_url'
  INTO v_email, v_display_name, v_avatar
  FROM auth.users WHERE id = v_user_id;

  IF v_email IS NULL THEN
    RETURN NULL;
  END IF;

  -- Link by email if not yet linked
  UPDATE public.user_roles
  SET user_id = v_user_id,
      display_name = COALESCE(display_name, v_display_name),
      last_login_at = now()
  WHERE lower(email) = lower(v_email)
    AND (user_id IS NULL OR user_id = v_user_id)
  RETURNING * INTO v_row;

  RETURN v_row;
END;
$$;

GRANT EXECUTE ON FUNCTION public.claim_user_role() TO authenticated;

-- Seed initial admin
INSERT INTO public.user_roles (email, display_name, role)
VALUES ('fricdanko@gmail.com', 'Admin', 'admin')
ON CONFLICT (email) DO NOTHING;
