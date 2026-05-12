-- Helper: editor-or-admin check
CREATE OR REPLACE FUNCTION public.can_edit(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role IN ('admin','editor')
  )
$$;

DO $$
DECLARE
  t text;
  tables text[] := ARRAY[
    'campaigns','influencers','products','deals',
    'detected_videos','alerts','alert_rules','scan_log','scan_settings'
  ];
BEGIN
  FOREACH t IN ARRAY tables LOOP
    EXECUTE format('DROP POLICY IF EXISTS authenticated_insert ON public.%I', t);
    EXECUTE format('DROP POLICY IF EXISTS authenticated_update ON public.%I', t);
    EXECUTE format('DROP POLICY IF EXISTS authenticated_delete ON public.%I', t);

    EXECUTE format($f$
      CREATE POLICY editors_insert ON public.%I FOR INSERT
      WITH CHECK (public.can_edit(auth.uid()))
    $f$, t);
    EXECUTE format($f$
      CREATE POLICY editors_update ON public.%I FOR UPDATE
      USING (public.can_edit(auth.uid()))
      WITH CHECK (public.can_edit(auth.uid()))
    $f$, t);
    EXECUTE format($f$
      CREATE POLICY editors_delete ON public.%I FOR DELETE
      USING (public.can_edit(auth.uid()))
    $f$, t);
  END LOOP;
END $$;
