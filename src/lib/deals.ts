import { supabase } from "@/integrations/supabase/client";

/**
 * Recalculate and persist the per-campaign product cost split for a deal.
 * Each linked campaign's `product_cost` becomes deal.total_cost / count.
 * The campaign's `campaign_cost` (collaboration fee paid to the influencer)
 * is NEVER touched here — it is independent of the deal's product cost.
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
    .update({ product_cost: split, currency: deal.currency })
    .eq("deal_id", dealId);
};

/**
 * Link a campaign to a deal: set deal_id, then recalc the split.
 * When unlinked (dealId = null), the campaign's product_cost is reset to 0.
 * Collaboration cost (`campaign_cost`) is never modified by this function.
 */
export const linkCampaignToDeal = async (
  campaignId: string,
  dealId: string | null,
  previousDealId: string | null,
): Promise<void> => {
  const update: { deal_id: string | null; product_cost?: number } =
    dealId === null ? { deal_id: null, product_cost: 0 } : { deal_id: dealId };
  await supabase.from("campaigns").update(update).eq("id", campaignId);
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
