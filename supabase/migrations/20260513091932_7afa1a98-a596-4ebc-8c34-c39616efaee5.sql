CREATE OR REPLACE FUNCTION public.claim_user_role()
 RETURNS user_roles
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_user_id uuid := auth.uid();
  v_email text;
  v_display_name text;
  v_row public.user_roles;
BEGIN
  IF v_user_id IS NULL THEN
    RETURN NULL;
  END IF;

  SELECT email,
         COALESCE(raw_user_meta_data->>'full_name', raw_user_meta_data->>'name')
  INTO v_email, v_display_name
  FROM auth.users WHERE id = v_user_id;

  IF v_email IS NULL THEN
    RETURN NULL;
  END IF;

  -- Link existing row by email if not yet linked
  UPDATE public.user_roles
  SET user_id = v_user_id,
      display_name = COALESCE(display_name, v_display_name),
      last_login_at = now()
  WHERE lower(email) = lower(v_email)
    AND (user_id IS NULL OR user_id = v_user_id)
  RETURNING * INTO v_row;

  -- If no row exists for this email, auto-create a viewer
  IF v_row.id IS NULL THEN
    INSERT INTO public.user_roles (user_id, email, display_name, role, last_login_at)
    VALUES (v_user_id, v_email, v_display_name, 'viewer'::app_role, now())
    ON CONFLICT (email) DO UPDATE
      SET user_id = EXCLUDED.user_id,
          display_name = COALESCE(public.user_roles.display_name, EXCLUDED.display_name),
          last_login_at = now()
    RETURNING * INTO v_row;
  END IF;

  RETURN v_row;
END;
$function$;