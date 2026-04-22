DO $$
DECLARE
  t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'influencers',
    'campaigns',
    'detected_videos',
    'alerts',
    'scan_log',
    'scan_settings',
    'alert_rules'
  ] LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('DROP POLICY IF EXISTS "anon_all" ON public.%I', t);
    EXECUTE format('DROP POLICY IF EXISTS "Authenticated users can view %I" ON public.%I', t, t);
    EXECUTE format('DROP POLICY IF EXISTS "Authenticated users can create %I" ON public.%I', t, t);
    EXECUTE format('DROP POLICY IF EXISTS "Authenticated users can edit %I" ON public.%I', t, t);
    EXECUTE format('DROP POLICY IF EXISTS "Authenticated users can remove %I" ON public.%I', t, t);
    EXECUTE format('CREATE POLICY "anon_all" ON public.%I FOR ALL TO anon USING (true) WITH CHECK (true)', t);
  END LOOP;
END $$;