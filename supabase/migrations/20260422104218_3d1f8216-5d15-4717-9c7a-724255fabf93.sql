ALTER TABLE public.campaigns DROP CONSTRAINT IF EXISTS campaigns_collaboration_type_check;
ALTER TABLE public.campaigns DROP CONSTRAINT IF EXISTS campaigns_platform_check;
ALTER TABLE public.campaigns DROP CONSTRAINT IF EXISTS campaigns_video_id_key;
ALTER TABLE public.campaigns DROP CONSTRAINT IF EXISTS campaigns_video_url_key;