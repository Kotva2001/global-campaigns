import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const YT_VIDEOS = "https://www.googleapis.com/youtube/v3/videos";

type AlertRule = {
  id: string; name: string; metric: string; condition: string;
  threshold: number; applies_to: string | null; is_active: boolean | null;
};

type Campaign = {
  id: string;
  influencer_id: string | null;
  video_id: string | null;
  views: number | null;
  likes: number | null;
  comments: number | null;
  engagement_rate: number | null;
  purchase_revenue: number | null;
  conversion_rate: number | null;
};

const valForMetric = (c: Campaign, metric: string): number | null => {
  switch (metric.toLowerCase()) {
    case "views": return c.views;
    case "likes": return c.likes;
    case "comments": return c.comments;
    case "engagement_rate":
    case "engagement rate": return c.engagement_rate;
    case "revenue":
    case "purchase_revenue": return c.purchase_revenue;
    case "conversion_rate":
    case "conversion rate": return c.conversion_rate;
    default: return null;
  }
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  const { data: logRow } = await supabase
    .from("scan_log")
    .insert({ scan_type: "Stats Update", status: "running" })
    .select()
    .single();
  const logId = logRow?.id as string | undefined;

  let updated = 0;

  try {
    const { data: settings } = await supabase.from("scan_settings").select("youtube_api_key").limit(1).maybeSingle();
    const apiKey = settings?.youtube_api_key;
    if (!apiKey) throw new Error("YouTube API key missing");

    const { data: campaignsData } = await supabase
      .from("campaigns")
      .select("id,influencer_id,video_id,views,likes,comments,engagement_rate,purchase_revenue,conversion_rate")
      .not("video_id", "is", null)
      .eq("platform", "YouTube");
    const campaigns = (campaignsData ?? []) as Campaign[];

    const { data: rulesData } = await supabase.from("alert_rules").select("*").eq("is_active", true);
    const rules = (rulesData ?? []) as AlertRule[];

    const { data: infData } = await supabase.from("influencers").select("id,country");
    const infCountry = new Map<string, string | null>(
      (infData ?? []).map((i: { id: string; country: string | null }) => [i.id, i.country]),
    );

    const byVideoId = new Map(campaigns.map((c) => [c.video_id!, c]));
    const ids = [...byVideoId.keys()];

    for (let i = 0; i < ids.length; i += 50) {
      const batch = ids.slice(i, i + 50);
      const url = `${YT_VIDEOS}?part=statistics&id=${batch.join(",")}&key=${apiKey}`;
      const r = await fetch(url);
      if (!r.ok) continue;
      const j = await r.json();
      for (const v of j.items ?? []) {
        const camp = byVideoId.get(v.id);
        if (!camp) continue;
        const stats = v.statistics ?? {};
        const newViews = Number(stats.viewCount ?? 0);
        const newLikes = Number(stats.likeCount ?? 0);
        const newComments = Number(stats.commentCount ?? 0);
        const newEng = newViews > 0 ? ((newLikes + newComments) / newViews) * 100 : null;

        await supabase.from("campaigns").update({
          views: newViews,
          likes: newLikes,
          comments: newComments,
          engagement_rate: newEng,
          last_stats_update: new Date().toISOString(),
        }).eq("id", camp.id);
        updated += 1;

        // Alert evaluation: compare old vs new to detect threshold crossings
        const newSnap: Campaign = {
          ...camp, views: newViews, likes: newLikes, comments: newComments, engagement_rate: newEng,
        };
        for (const rule of rules) {
          const applies = rule.applies_to;
          if (applies && applies !== "all") {
            const country = camp.influencer_id ? infCountry.get(camp.influencer_id) : null;
            if (applies !== camp.influencer_id && applies !== country) continue;
          }
          const oldV = valForMetric(camp, rule.metric);
          const newV = valForMetric(newSnap, rule.metric);
          if (newV == null) continue;
          const cond = rule.condition.toLowerCase();
          const newCross = cond.startsWith("greater") ? newV > rule.threshold : newV < rule.threshold;
          const oldCross = oldV != null && (cond.startsWith("greater") ? oldV > rule.threshold : oldV < rule.threshold);
          if (newCross && !oldCross) {
            await supabase.from("alerts").insert({
              campaign_id: camp.id,
              alert_type: rule.metric,
              title: rule.name,
              message: `${rule.metric} ${rule.condition} ${rule.threshold} (now ${newV})`,
              threshold_value: rule.threshold,
              actual_value: newV,
            });
          }
        }
      }
    }

    await supabase.from("scan_log").update({
      status: "completed",
      completed_at: new Date().toISOString(),
      stats_updated: updated,
    }).eq("id", logId!);

    return new Response(JSON.stringify({ ok: true, updated }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    const msg = (e as Error).message;
    if (logId) {
      await supabase.from("scan_log").update({
        status: "failed",
        completed_at: new Date().toISOString(),
        error_message: msg,
        stats_updated: updated,
      }).eq("id", logId);
    }
    return new Response(JSON.stringify({ ok: false, error: msg }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
