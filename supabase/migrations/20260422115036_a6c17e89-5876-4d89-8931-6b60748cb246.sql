ALTER TABLE public.campaigns
ADD COLUMN IF NOT EXISTS currency text DEFAULT 'CZK';

ALTER TABLE public.scan_settings
ADD COLUMN IF NOT EXISTS eur_czk_rate numeric DEFAULT 25.00,
ADD COLUMN IF NOT EXISTS eur_czk_rate_updated_at timestamp with time zone DEFAULT now();

UPDATE public.campaigns c
SET currency = 'EUR'
FROM public.influencers i
WHERE c.influencer_id = i.id
  AND i.country IN ('DE', 'AT', 'NL', 'IT', 'GR', 'ES', 'SI', 'RO', 'HU');

UPDATE public.campaigns c
SET currency = 'CZK'
FROM public.influencers i
WHERE c.influencer_id = i.id
  AND i.country IN ('CZ', 'SK');

UPDATE public.campaigns
SET currency = 'CZK'
WHERE currency IS NULL;

UPDATE public.scan_settings
SET eur_czk_rate = COALESCE(eur_czk_rate, 25.00),
    eur_czk_rate_updated_at = COALESCE(eur_czk_rate_updated_at, now());