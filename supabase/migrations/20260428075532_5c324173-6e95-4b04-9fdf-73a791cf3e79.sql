-- Create deals table to group multiple campaigns under a single product shipment
CREATE TABLE public.deals (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  influencer_id UUID NOT NULL REFERENCES public.influencers(id) ON DELETE CASCADE,
  product_id UUID REFERENCES public.products(id) ON DELETE SET NULL,
  deal_name TEXT,
  total_cost NUMERIC(10,2) NOT NULL DEFAULT 0,
  currency TEXT NOT NULL DEFAULT 'CZK',
  collaboration_type TEXT,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.deals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "public_select" ON public.deals FOR SELECT USING (true);
CREATE POLICY "authenticated_insert" ON public.deals FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "authenticated_update" ON public.deals FOR UPDATE USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "authenticated_delete" ON public.deals FOR DELETE USING (auth.uid() IS NOT NULL);

CREATE TRIGGER deals_set_updated_at BEFORE UPDATE ON public.deals FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE INDEX idx_deals_influencer ON public.deals(influencer_id);

-- Add deal_id to campaigns
ALTER TABLE public.campaigns ADD COLUMN deal_id UUID REFERENCES public.deals(id) ON DELETE SET NULL;
CREATE INDEX idx_campaigns_deal ON public.campaigns(deal_id);