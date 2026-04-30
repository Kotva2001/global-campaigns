import { supabase } from "@/integrations/supabase/client";

/**
 * Recalculate and persist the per-campaign split for a deal.
 * Each linked campaign's `campaign_cost` becomes deal.total_cost / count.
 * Currency is also synced to the deal currency.
 */
export const recalcDealSplit = async (dealId: string): Promise<void> => {
  const { data: deal, error: dealErr } = await supabase
    .from("deals")
    .select("id,total_cost,currency")
    .eq("id", dealId)
    .maybeSingle();
  if (dealErr || !deal) return;

  const { data: linked, error: campErr } = await supabase
    .from("campaigns")
    .select("id")
    .eq("deal_id", dealId);
  if (campErr || !linked) return;

  const count = linked.length;
  if (count === 0) return;
  const split = Number(((Number(deal.total_cost) || 0) / count).toFixed(2));

  await supabase
    .from("campaigns")
    .update({ campaign_cost: split, currency: deal.currency })
    .eq("deal_id", dealId);
};

/**
 * Link a campaign to a deal: set deal_id, then recalc the split.
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
