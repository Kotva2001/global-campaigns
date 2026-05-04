import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useCurrencySettings } from "@/hooks/useCurrencySettings";
import { computeCreatorScores, type CreatorScoreData, type RawCampaign, type RawDeal, type RawProduct } from "@/lib/performanceScore";

interface State {
  scores: Map<string, CreatorScoreData>;
  loading: boolean;
}

/**
 * Loads all-time campaigns + deals + products and computes performance
 * scores for every creator. Single fetch, cached at hook level per render.
 */
export const useCreatorScores = (): State => {
  const { eurCzkRate } = useCurrencySettings();
  const [scores, setScores] = useState<Map<string, CreatorScoreData>>(new Map());
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      setLoading(true);
      try {
        // Page through campaigns to bypass 1000-row PostgREST cap.
        const PAGE = 1000;
        const allCampaigns: RawCampaign[] = [];
        for (let from = 0; ; from += PAGE) {
          const { data, error } = await supabase
            .from("campaigns")
            .select("id,influencer_id,publish_date,views,engagement_rate,deal_id")
            .order("id")
            .range(from, from + PAGE - 1);
          if (error) throw error;
          const rows = (data ?? []) as unknown as RawCampaign[];
          allCampaigns.push(...rows);
          if (rows.length < PAGE) break;
        }

        const [{ data: deals }, { data: products }] = await Promise.all([
          supabase.from("deals").select("id,product_id"),
          supabase.from("products").select("id,cost,currency"),
        ]);

        if (cancelled) return;
        const map = computeCreatorScores(
          allCampaigns,
          (deals ?? []) as RawDeal[],
          (products ?? []) as RawProduct[],
          eurCzkRate,
        );
        setScores(map);
      } catch {
        // silent — score is non-critical
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    void load();
    return () => { cancelled = true; };
  }, [eurCzkRate]);

  return { scores, loading };
};