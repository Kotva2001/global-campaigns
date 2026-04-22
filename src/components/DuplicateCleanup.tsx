import { useEffect, useMemo, useState } from "react";
import { Loader2, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";

type CampaignRow = { id: string; influencer_id: string | null; platform: string; publish_date: string | null; video_url: string | null; campaign_name: string | null; created_at: string | null };
type InfluencerRow = { id: string; name: string; country: string; created_at: string | null };

const duplicateKey = (row: CampaignRow) => {
  const url = row.video_url?.trim().toLowerCase();
  const campaign = row.campaign_name?.trim().toLowerCase() ?? "";
  return [row.influencer_id ?? "", row.platform, row.publish_date ?? "", url ? `url:${url}` : `campaign:${campaign}`].join("|");
};

const countDuplicateCampaigns = (rows: CampaignRow[]) => {
  const seen = new Set<string>();
  let duplicates = 0;
  [...rows].sort((a, b) => (a.created_at ?? a.id).localeCompare(b.created_at ?? b.id)).forEach((row) => {
    const key = duplicateKey(row);
    if (seen.has(key)) duplicates += 1;
    else seen.add(key);
  });
  return duplicates;
};

const countDuplicateInfluencers = (rows: InfluencerRow[]) => rows.length - new Set(rows.map((row) => `${row.name.trim().toLowerCase()}|${row.country}`)).size;

export const DuplicateCleanup = () => {
  const [loading, setLoading] = useState(false);
  const [cleaning, setCleaning] = useState(false);
  const [duplicateCampaigns, setDuplicateCampaigns] = useState(0);
  const [duplicateInfluencers, setDuplicateInfluencers] = useState(0);

  const label = useMemo(() => duplicateCampaigns + duplicateInfluencers, [duplicateCampaigns, duplicateInfluencers]);

  const refreshCounts = async () => {
    setLoading(true);
    const [{ data: campaigns, error: campaignError }, { data: influencers, error: influencerError }] = await Promise.all([
      supabase.from("campaigns").select("id,influencer_id,platform,publish_date,video_url,campaign_name,created_at"),
      supabase.from("influencers").select("id,name,country,created_at"),
    ]);
    setLoading(false);
    if (campaignError || influencerError) {
      toast.error(campaignError?.message ?? influencerError?.message ?? "Could not check duplicates");
      return;
    }
    setDuplicateCampaigns(countDuplicateCampaigns((campaigns ?? []) as CampaignRow[]));
    setDuplicateInfluencers(countDuplicateInfluencers((influencers ?? []) as InfluencerRow[]));
  };

  const removeDuplicates = async () => {
    setCleaning(true);
    const { data, error } = await (supabase as unknown as { rpc: (fn: string) => Promise<{ data: { removed_campaigns: number; merged_influencers: number }[] | null; error: { message: string } | null }> }).rpc("remove_duplicate_import_data");
    setCleaning(false);
    if (error) return toast.error(error.message);
    const result = data?.[0];
    toast.success(`Removed ${result?.removed_campaigns ?? 0} duplicate campaigns`);
    window.dispatchEvent(new Event("campaign-data-changed"));
    void refreshCounts();
  };

  useEffect(() => { void refreshCounts(); }, []);

  return (
    <div className="space-y-3 rounded-lg border p-4">
      <div>
        <h3 className="text-base font-semibold">Duplicate cleanup</h3>
        <p className="text-xs text-muted-foreground">Found {loading ? "…" : `${duplicateCampaigns} duplicate campaigns and ${duplicateInfluencers} duplicate creators`}.</p>
      </div>
      <Button variant="destructive" size="sm" onClick={removeDuplicates} disabled={cleaning || loading || label === 0} className="gap-2">
        {cleaning ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
        Remove duplicate campaigns
      </Button>
    </div>
  );
};