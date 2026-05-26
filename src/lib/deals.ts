import { supabase } from "@/integrations/supabase/client";

/**
 * Kept for API compatibility with existing call sites.
 * Product cost is calculated dynamically from linked deals when campaigns load,
 * so linking or editing a deal must not write campaign cost fields.
 */
export const recalcDealSplit = async (dealId: string): Promise<void> => {
  void dealId;
};

/**
 * Link a campaign to a deal by setting only `deal_id`.
 * Collaboration cost (`campaign_cost`) and stored product cost are never modified here.
 */
export const linkCampaignToDeal = async (
  campaignId: string,
  dealId: string | null,
  previousDealId: string | null,
): Promise<void> => {
  await supabase.from("campaigns").update({ deal_id: dealId }).eq("id", campaignId);
  if (dealId) await recalcDealSplit(dealId);
  if (previousDealId && previousDealId !== dealId) await recalcDealSplit(previousDealId);
};

/**
 * Bulk-link multiple campaigns to a deal, then recalc the split once.
 */
export const linkCampaignsToDeal = async (
  campaignIds: string[],
  dealId: string,
): Promise<void> => {
  if (campaignIds.length === 0) return;
  await supabase.from("campaigns").update({ deal_id: dealId }).in("id", campaignIds);
  await recalcDealSplit(dealId);
};
