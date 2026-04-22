CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $function$
begin new.updated_at = now(); return new; end;
$function$;

DO $$
DECLARE
  t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'alert_rules',
    'alerts',
    'campaigns',
    'detected_videos',
    'influencers',
    'scan_log',
    'scan_settings'
  ] LOOP
    EXECUTE format('DROP POLICY IF EXISTS "Authenticated users can view %I" ON public.%I', t, t);
    EXECUTE format('DROP POLICY IF EXISTS "Authenticated users can create %I" ON public.%I', t, t);
    EXECUTE format('DROP POLICY IF EXISTS "Authenticated users can edit %I" ON public.%I', t, t);
    EXECUTE format('DROP POLICY IF EXISTS "Authenticated users can remove %I" ON public.%I', t, t);

    EXECUTE format('CREATE POLICY "Authenticated users can view %I" ON public.%I FOR SELECT TO authenticated USING (auth.uid() IS NOT NULL)', t, t);
    EXECUTE format('CREATE POLICY "Authenticated users can create %I" ON public.%I FOR INSERT TO authenticated WITH CHECK (auth.uid() IS NOT NULL)', t, t);
    EXECUTE format('CREATE POLICY "Authenticated users can edit %I" ON public.%I FOR UPDATE TO authenticated USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL)', t, t);
    EXECUTE format('CREATE POLICY "Authenticated users can remove %I" ON public.%I FOR DELETE TO authenticated USING (auth.uid() IS NOT NULL)', t, t);
  END LOOP;
END $$;