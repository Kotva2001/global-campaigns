ALTER TABLE public.campaigns DROP CONSTRAINT IF EXISTS campaigns_platform_check;
ALTER TABLE public.campaigns ADD CONSTRAINT campaigns_platform_check CHECK (platform IN ('YouTube', 'Instagram', 'YB Shorts', 'Story'));
ALTER TABLE public.campaigns ADD COLUMN IF NOT EXISTS notes text;