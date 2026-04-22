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
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('DROP POLICY IF EXISTS "Allow all select on %I" ON public.%I', t, t);
    EXECUTE format('DROP POLICY IF EXISTS "Allow all insert on %I" ON public.%I', t, t);
    EXECUTE format('DROP POLICY IF EXISTS "Allow all update on %I" ON public.%I', t, t);
    EXECUTE format('DROP POLICY IF EXISTS "Allow all delete on %I" ON public.%I', t, t);
    EXECUTE format('DROP POLICY IF EXISTS "Authenticated users can view %I" ON public.%I', t, t);
    EXECUTE format('DROP POLICY IF EXISTS "Authenticated users can create %I" ON public.%I', t, t);
    EXECUTE format('DROP POLICY IF EXISTS "Authenticated users can edit %I" ON public.%I', t, t);
    EXECUTE format('DROP POLICY IF EXISTS "Authenticated users can remove %I" ON public.%I', t, t);

    EXECUTE format('CREATE POLICY "Authenticated users can view %I" ON public.%I FOR SELECT TO authenticated USING (true)', t, t);
    EXECUTE format('CREATE POLICY "Authenticated users can create %I" ON public.%I FOR INSERT TO authenticated WITH CHECK (true)', t, t);
    EXECUTE format('CREATE POLICY "Authenticated users can edit %I" ON public.%I FOR UPDATE TO authenticated USING (true) WITH CHECK (true)', t, t);
    EXECUTE format('CREATE POLICY "Authenticated users can remove %I" ON public.%I FOR DELETE TO authenticated USING (true)', t, t);
  END LOOP;
END $$;