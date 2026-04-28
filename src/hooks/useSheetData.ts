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
  if (v === "story" || v.includes("storie")) return "Story";
  if (v.includes("short")) return "YB Shorts";
  if (v.includes("insta")) return "Instagram";
  return "YouTube";
};

const num = (v: unknown): number | null => {
  if (v == null) return null;
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? n : null;
};

interface CampaignRow {
  id: string;
  influencer_id: string | null;
  deal_id: string | null;
  campaign_name: string | null;
  platform: string;
  publish_date: string | null;
  video_url: string | null;
  collaboration_type: string | null;
  currency: string | null;
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
}

interface InfluencerLookupRow {
  id: string;
  name: string;
  country: string;
}

const formatDate = (iso: string | null): string => {
  if (!iso) return "";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return iso;
  return `${String(d.getDate()).padStart(2, "0")}.${String(d.getMonth() + 1).padStart(2, "0")}.${d.getFullYear()}`;
};

const mapRow = (r: CampaignRow, influencerById: Map<string, InfluencerLookupRow>): CampaignEntry => {
  const influencer = r.influencer_id ? influencerById.get(r.influencer_id) : undefined;
  return {
  id: r.id,
  influencerId: r.influencer_id,
  dealId: r.deal_id,
  country: influencer?.country ?? "",
  influencer: influencer?.name ?? "",
  campaignName: r.campaign_name ?? "",
  platform: normalizePlatform(r.platform),
  publishDate: formatDate(r.publish_date),
  publishDateIso: r.publish_date,
  videoLink: r.video_url ?? "",
  collaborationType: r.collaboration_type ?? "",
  currency: r.currency === "EUR" || r.currency === "HUF" || r.currency === "RON" ? r.currency : "CZK",
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
  };
};

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
          "id, influencer_id, deal_id, campaign_name, platform, publish_date, video_url, collaboration_type, currency, campaign_cost, utm_link, managed_by, views, likes, comments, sessions, engagement_rate, purchase_revenue, conversion_rate",
        )
        .order("publish_date", { ascending: false, nullsFirst: false });
      if (err) throw err;
      const influencerIds = [...new Set(((rows ?? []) as CampaignRow[]).map((row) => row.influencer_id).filter(Boolean))] as string[];
      const { data: influencers, error: influencerErr } = influencerIds.length
        ? await supabase.from("influencers").select("id,name,country").in("id", influencerIds)
        : { data: [], error: null };
      if (influencerErr) throw influencerErr;
      const influencerById = new Map((influencers ?? []).map((influencer) => [influencer.id, influencer]));
      setData(((rows ?? []) as unknown as CampaignRow[]).map((row) => mapRow(row, influencerById)));
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
