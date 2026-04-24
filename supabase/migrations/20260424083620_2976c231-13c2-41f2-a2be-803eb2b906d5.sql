DO $$
DECLARE
  t text;
  tables text[] := ARRAY['influencers','campaigns','detected_videos','alerts','alert_rules','scan_log','scan_settings'];
BEGIN
  FOREACH t IN ARRAY tables LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('DROP POLICY IF EXISTS anon_all ON public.%I', t);
    EXECUTE format('DROP POLICY IF EXISTS public_select ON public.%I', t);
    EXECUTE format('DROP POLICY IF EXISTS authenticated_insert ON public.%I', t);
    EXECUTE format('DROP POLICY IF EXISTS authenticated_update ON public.%I', t);
    EXECUTE format('DROP POLICY IF EXISTS authenticated_delete ON public.%I', t);

    EXECUTE format('CREATE POLICY public_select ON public.%I FOR SELECT USING (true)', t);
    EXECUTE format('CREATE POLICY authenticated_insert ON public.%I FOR INSERT WITH CHECK (auth.uid() IS NOT NULL)', t);
    EXECUTE format('CREATE POLICY authenticated_update ON public.%I FOR UPDATE USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL)', t);
    EXECUTE format('CREATE POLICY authenticated_delete ON public.%I FOR DELETE USING (auth.uid() IS NOT NULL)', t);
  END LOOP;
END $$;