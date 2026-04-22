ALTER TABLE public.campaigns
  DROP CONSTRAINT IF EXISTS campaigns_influencer_id_fkey;

ALTER TABLE public.campaigns
  ADD CONSTRAINT campaigns_influencer_id_fkey
  FOREIGN KEY (influencer_id)
  REFERENCES public.influencers(id)
  ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS idx_campaigns_influencer_id ON public.campaigns(influencer_id);
CREATE INDEX IF NOT EXISTS idx_campaigns_publish_date ON public.campaigns(publish_date);
CREATE INDEX IF NOT EXISTS idx_influencers_country_name ON public.influencers(country, name);