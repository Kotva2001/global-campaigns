ALTER TABLE public.campaigns ADD COLUMN IF NOT EXISTS product_cost numeric NOT NULL DEFAULT 0;

UPDATE public.campaigns
SET product_cost = COALESCE(campaign_cost, 0),
    campaign_cost = 0
WHERE deal_id IS NOT NULL
  AND product_cost = 0;