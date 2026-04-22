import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import type { CampaignEntry, Platform } from "@/types/campaign";

// Kept for API compatibility with existing components — no longer used.
export interface SheetConfig {
  sheetId: string;
  apiKey: string;
}

const normalizePlatform = (raw: string | null | undefined): Platform => {
  const v = (raw ?? "").toLowerCase().trim();
  if (v.includes("short")) return "YB Shorts";
  if (v.includes("insta")) return "Instagram";
  if (v.includes("tik")) return "TikTok";
  if (v.includes("you") || v.includes("yt")) return "YouTube";
  return "Other";
};

const num = (v: unknown): number | null => {
  if (v == null) return null;
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? n : null;
};

interface CampaignRow {
  id: string;
  influencer_id: string | null;
  campaign_name: string | null;
  platform: string;
  publish_date: string | null;
  video_url: string | null;
  collaboration_type: string | null;
  campaign_cost: number | string | null;
  utm_link: string | null;
  managed_by: string | null;
  views: number | null;
  likes: number | null;
  comments: number | null;
  sessions: number | null;
  engagement_rate: number | string | null;
  purchase_revenue: number | string | null;
  conversion_rate: number | string | null;
  influencers: { name: string; country: string } | null;
}

const formatDate = (iso: string | null): string => {
  if (!iso) return "";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return iso;
  return `${String(d.getDate()).padStart(2, "0")}.${String(d.getMonth() + 1).padStart(2, "0")}.${d.getFullYear()}`;
};

const mapRow = (r: CampaignRow): CampaignEntry => ({
  id: r.id,
  influencerId: r.influencer_id,
  country: r.influencers?.country ?? "",
  influencer: r.influencers?.name ?? "",
  campaignName: r.campaign_name ?? "",
  platform: normalizePlatform(r.platform),
  publishDate: formatDate(r.publish_date),
  publishDateIso: r.publish_date,
  videoLink: r.video_url ?? "",
  collaborationType: r.collaboration_type ?? "",
  campaignCost: num(r.campaign_cost),
  utmLink: r.utm_link ?? "",
  managedBy: r.managed_by ?? "",
  views: num(r.views),
  likes: num(r.likes),
  comments: num(r.comments),
  sessions: num(r.sessions),
  engagementRate: num(r.engagement_rate),
  purchaseRevenue: num(r.purchase_revenue),
  conversionRate: num(r.conversion_rate),
});

export const useSheetData = () => {
  const [data, setData] = useState<CampaignEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastFetched, setLastFetched] = useState<Date | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { data: rows, error: err } = await supabase
        .from("campaigns")
        .select(
          "id, influencer_id, campaign_name, platform, publish_date, video_url, collaboration_type, campaign_cost, utm_link, managed_by, views, likes, comments, sessions, engagement_rate, purchase_revenue, conversion_rate, influencers!inner(name, country)",
        )
        .order("publish_date", { ascending: false, nullsFirst: false });
      if (err) throw err;
      setData(((rows ?? []) as unknown as CampaignRow[]).map(mapRow));
      setLastFetched(new Date());
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Unknown error";
      setError(msg);
      toast.error(`Failed to load campaigns: ${msg}`);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useEffect(() => {
    const handleChange = () => { void refresh(); };
    window.addEventListener("campaign-data-changed", handleChange);
    return () => window.removeEventListener("campaign-data-changed", handleChange);
  }, [refresh]);

  return {
    config: { sheetId: "", apiKey: "" } as SheetConfig,
    updateConfig: (_cfg: SheetConfig) => {
      void refresh();
    },
    data,
    loading,
    error,
    lastFetched,
    refresh,
    configured: true,
  };
};
