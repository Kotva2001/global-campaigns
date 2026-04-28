import type { CurrencyCode } from "@/lib/currency";

export interface DealRecord {
  id: string;
  influencer_id: string;
  product_id: string | null;
  deal_name: string | null;
  total_cost: number;
  currency: CurrencyCode;
  collaboration_type: string | null;
  notes: string | null;
  created_at: string | null;
}

export interface DealWithCampaigns extends DealRecord {
  product_name: string | null;
  campaign_count: number;
  campaign_ids: string[];
}
