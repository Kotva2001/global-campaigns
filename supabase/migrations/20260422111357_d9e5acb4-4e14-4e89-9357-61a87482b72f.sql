CREATE OR REPLACE FUNCTION public.remove_duplicate_import_data()
RETURNS TABLE(removed_campaigns integer, merged_influencers integer)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  campaign_count integer := 0;
  influencer_count integer := 0;
BEGIN
  WITH ranked_influencers AS (
    SELECT
      id,
      first_value(id) OVER (
        PARTITION BY lower(trim(name)), country
        ORDER BY created_at ASC NULLS LAST, id ASC
      ) AS keep_id,
      row_number() OVER (
        PARTITION BY lower(trim(name)), country
        ORDER BY created_at ASC NULLS LAST, id ASC
      ) AS row_num
    FROM public.influencers
  ), moved_campaigns AS (
    UPDATE public.campaigns c
    SET influencer_id = r.keep_id
    FROM ranked_influencers r
    WHERE c.influencer_id = r.id
      AND r.row_num > 1
    RETURNING c.id
  ), deleted_influencers AS (
    DELETE FROM public.influencers i
    USING ranked_influencers r
    WHERE i.id = r.id
      AND r.row_num > 1
    RETURNING i.id
  )
  SELECT count(*) INTO influencer_count FROM deleted_influencers;

  WITH ranked_campaigns AS (
    SELECT
      id,
      row_number() OVER (
        PARTITION BY
          influencer_id,
          platform,
          publish_date,
          CASE WHEN nullif(trim(coalesce(video_url, '')), '') IS NOT NULL THEN lower(trim(video_url)) ELSE '' END,
          CASE WHEN nullif(trim(coalesce(video_url, '')), '') IS NULL THEN lower(trim(coalesce(campaign_name, ''))) ELSE lower(trim(coalesce(campaign_name, ''))) END
        ORDER BY created_at ASC NULLS LAST, id ASC
      ) AS row_num
    FROM public.campaigns
  ), deleted_campaigns AS (
    DELETE FROM public.campaigns c
    USING ranked_campaigns r
    WHERE c.id = r.id
      AND r.row_num > 1
    RETURNING c.id
  )
  SELECT count(*) INTO campaign_count FROM deleted_campaigns;

  removed_campaigns := campaign_count;
  merged_influencers := influencer_count;
  RETURN NEXT;
END;
$$;