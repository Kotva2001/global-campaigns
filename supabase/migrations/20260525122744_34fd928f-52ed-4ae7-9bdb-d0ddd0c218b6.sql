
-- 1. Tighten SELECT policies: authenticated-only
DROP POLICY IF EXISTS public_select ON public.influencers;
CREATE POLICY "authenticated_select" ON public.influencers
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS public_select ON public.campaigns;
CREATE POLICY "authenticated_select" ON public.campaigns
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS public_select ON public.deals;
CREATE POLICY "authenticated_select" ON public.deals
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS public_select ON public.scan_log;
CREATE POLICY "authenticated_select" ON public.scan_log
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS public_select ON public.detected_videos;
CREATE POLICY "authenticated_select" ON public.detected_videos
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS public_select ON public.alerts;
CREATE POLICY "authenticated_select" ON public.alerts
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS public_select ON public.alert_rules;
CREATE POLICY "authenticated_select" ON public.alert_rules
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS public_select ON public.products;
CREATE POLICY "authenticated_select" ON public.products
  FOR SELECT TO authenticated USING (true);

-- 2. scan_settings: restrict full SELECT (incl. youtube_api_key) to owners only
DROP POLICY IF EXISTS public_select ON public.scan_settings;
CREATE POLICY "owners_select" ON public.scan_settings
  FOR SELECT TO authenticated USING (public.is_owner(auth.uid()));

-- 3. Safe view for non-owners (excludes youtube_api_key and other secrets)
CREATE OR REPLACE VIEW public.scan_settings_public
WITH (security_invoker = on) AS
  SELECT
    id,
    eur_czk_rate,
    eur_czk_rate_updated_at,
    stats_refresh_frequency_minutes,
    auto_add_known_influencers,
    platforms_to_scan,
    scan_frequency_minutes,
    brand_keywords,
    updated_at
  FROM public.scan_settings;

GRANT SELECT ON public.scan_settings_public TO authenticated;
REVOKE SELECT ON public.scan_settings_public FROM anon;

-- 4. Revoke EXECUTE from anon on internal helper functions
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, app_role) FROM anon;
REVOKE EXECUTE ON FUNCTION public.can_edit(uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.is_owner(uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.current_user_role() FROM anon;
REVOKE EXECUTE ON FUNCTION public.claim_user_role() FROM anon;
REVOKE EXECUTE ON FUNCTION public.search_products(text, integer) FROM anon;
REVOKE EXECUTE ON FUNCTION public.remove_duplicate_import_data() FROM anon, authenticated;
