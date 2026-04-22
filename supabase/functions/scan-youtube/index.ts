import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

type Influencer = {
  id: string;
  name: string;
  youtube_channel_id: string | null;
  youtube_channel_url: string | null;
  status: string | null;
};

type AlertRule = {
  id: string;
  name: string;
  metric: string;
  condition: string;
  threshold: number;
  applies_to: string | null;
  is_active: boolean | null;
};

const YT_SEARCH = "https://www.googleapis.com/youtube/v3/search";
const YT_VIDEOS = "https://www.googleapis.com/youtube/v3/videos";

const extractYouTubeChannelId = (url: string | null): string | null => {
  if (!url) return null;
  const match = url.match(/youtube\.com\/channel\/([A-Za-z0-9_-]+)/i);
  return match?.[1] ?? null;
};

const findMentions = (
  title: string,
  description: string,
  tags: string[],
  keywords: string[],
): string[] => {
  const locs = new Set<string>();
  const kw = keywords.map((k) => k.toLowerCase());
  const hay = (s: string) => kw.some((k) => s.toLowerCase().includes(k));
  if (hay(title)) locs.add("Title");
  if (hay(description)) locs.add("Description");
  if (tags.some((t) => hay(t))) locs.add("Tags");
  return [...locs];
};

const checkAlerts = async (
  supabase: ReturnType<typeof createClient>,
  rules: AlertRule[],
  campaign: { id: string; influencer_id: string | null; views: number; likes: number; comments: number; engagement_rate: number | null; purchase_revenue: number | null; conversion_rate: number | null },
  influencerCountry: string | null,
) => {
  const valFor = (m: string): number | null => {
    switch (m.toLowerCase()) {
      case "views": return campaign.views;
      case "likes": return campaign.likes;
      case "comments": return campaign.comments;
      case "engagement_rate":
      case "engagement rate": return campaign.engagement_rate;
      case "revenue":
      case "purchase_revenue": return campaign.purchase_revenue;
      case "conversion_rate":
      case "conversion rate": return campaign.conversion_rate;
      default: return null;
    }
  };
  for (const r of rules) {
    if (!r.is_active) continue;
    const applies = r.applies_to;
    if (applies && applies !== "all") {
      if (applies !== campaign.influencer_id && applies !== influencerCountry) continue;
    }
    const v = valFor(r.metric);
    if (v == null) continue;
    const cond = r.condition.toLowerCase();
    const cross = cond.startsWith("greater") ? v > r.threshold : v < r.threshold;
    if (!cross) continue;
    // Avoid duplicates per (rule, campaign)
    const { data: existing } = await supabase
      .from("alerts")
      .select("id")
      .eq("campaign_id", campaign.id)
      .eq("title", r.name)
      .limit(1);
    if (existing && existing.length) continue;
    await supabase.from("alerts").insert({
      campaign_id: campaign.id,
      alert_type: r.metric,
      title: r.name,
      message: `${r.metric} ${r.condition} ${r.threshold} (now ${v})`,
      threshold_value: r.threshold,
      actual_value: v,
    });
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
    .insert({ scan_type: "YouTube", status: "running" })
    .select()
    .single();
  const logId = logRow?.id as string | undefined;

  let videosFound = 0;
  let videosNew = 0;

  try {
    const { data: settings } = await supabase.from("scan_settings").select("*").limit(1).maybeSingle();
    if (!settings) throw new Error("scan_settings not configured");
    const apiKey = settings.youtube_api_key;
    if (!apiKey) throw new Error("YouTube API key missing");
    const keywords: string[] = settings.brand_keywords ?? [];
    if (!keywords.length) throw new Error("No brand keywords configured");
    const autoApprove: boolean = !!settings.auto_add_known_influencers;

    const { data: influencers } = await supabase
      .from("influencers")
      .select("id,name,youtube_channel_id,youtube_channel_url,status,country")
      .eq("status", "active");
    const tracked = (influencers ?? [])
      .map((i: Influencer & { country: string | null }) => ({
        ...i,
        youtube_channel_id: i.youtube_channel_id ?? extractYouTubeChannelId(i.youtube_channel_url),
      }))
      .filter((i): i is Influencer & { country: string | null; youtube_channel_id: string } => !!i.youtube_channel_id);

    const { data: rulesData } = await supabase.from("alert_rules").select("*").eq("is_active", true);
    const rules = (rulesData ?? []) as AlertRule[];

    // Determine cutoff: last successful YouTube scan (fallback: 7 days ago)
    const { data: lastSuccess } = await supabase
      .from("scan_log")
      .select("completed_at")
      .eq("scan_type", "YouTube")
      .eq("status", "completed")
      .order("completed_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    const cutoff = lastSuccess?.completed_at
      ? new Date(lastSuccess.completed_at).toISOString()
      : new Date(Date.now() - 7 * 24 * 3600 * 1000).toISOString();

    // Collect candidate video IDs with optional channel/influencer hints
    const candidates = new Map<string, { influencer?: typeof tracked[number] }>();

    // 1. Per-channel recent uploads
    for (const inf of tracked) {
      const url = `${YT_SEARCH}?part=snippet&channelId=${inf.youtube_channel_id}&order=date&type=video&maxResults=10&publishedAfter=${cutoff}&key=${apiKey}`;
      const r = await fetch(url);
      if (!r.ok) continue;
      const j = await r.json();
      for (const item of j.items ?? []) {
        const vid = item?.id?.videoId;
        if (vid) candidates.set(vid, { influencer: inf });
      }
    }

    // Global keyword search intentionally disabled: only scan known active influencer channels.


    videosFound = candidates.size;
    if (videosFound === 0) {
      await supabase.from("scan_log").update({
        status: "completed",
        completed_at: new Date().toISOString(),
        videos_found: 0,
        videos_new: 0,
      }).eq("id", logId!);
      return new Response(JSON.stringify({ ok: true, found: 0, new: 0 }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Pre-filter: exclude video_ids we already know
    const ids = [...candidates.keys()];
    const [{ data: existDetected }, { data: existCampaigns }] = await Promise.all([
      supabase.from("detected_videos").select("video_id").in("video_id", ids),
      supabase.from("campaigns").select("video_id").in("video_id", ids),
    ]);
    const known = new Set<string>([
      ...(existDetected ?? []).map((r: { video_id: string }) => r.video_id),
      ...(existCampaigns ?? []).map((r: { video_id: string | null }) => r.video_id).filter(Boolean) as string[],
    ]);
    const newIds = ids.filter((id) => !known.has(id));

    // Fetch full details in batches of 50
    for (let i = 0; i < newIds.length; i += 50) {
      const batch = newIds.slice(i, i + 50);
      const url = `${YT_VIDEOS}?part=snippet,statistics&id=${batch.join(",")}&key=${apiKey}`;
      const r = await fetch(url);
      if (!r.ok) continue;
      const j = await r.json();
      for (const v of j.items ?? []) {
        const snippet = v.snippet ?? {};
        const stats = v.statistics ?? {};
        const title: string = snippet.title ?? "";
        const description: string = snippet.description ?? "";
        const tags: string[] = snippet.tags ?? [];
        const channelId: string = snippet.channelId ?? "";
        const channelTitle: string = snippet.channelTitle ?? "";
        const publishedAt: string | null = snippet.publishedAt ?? null;
        const thumb = snippet.thumbnails?.high?.url ?? snippet.thumbnails?.default?.url ?? null;

        const cand = candidates.get(v.id);
        const matchedInf = cand?.influencer ?? tracked.find((t) => t.youtube_channel_id === channelId);
        const mentions = findMentions(title, description, tags, keywords);

        // Only keep videos from tracked creators that explicitly mention the brand.
        if (mentions.length === 0 || !matchedInf) continue;

        const views = Number(stats.viewCount ?? 0);
        const likes = Number(stats.likeCount ?? 0);
        const comments = Number(stats.commentCount ?? 0);
        const engagementRate = views > 0 ? ((likes + comments) / views) * 100 : null;

        const shouldAutoApprove = autoApprove && !!matchedInf;
        const status = shouldAutoApprove ? "approved" : "pending";

        const { data: detRow } = await supabase.from("detected_videos").insert({
          video_id: v.id,
          video_url: `https://www.youtube.com/watch?v=${v.id}`,
          platform: "YouTube",
          video_title: title,
          channel_name: channelTitle,
          channel_id: channelId,
          thumbnail_url: thumb,
          influencer_id: matchedInf?.id ?? null,
          published_at: publishedAt,
          views, likes, comments,
          mention_locations: mentions,
          status,
        }).select().single();

        videosNew += 1;

        if (shouldAutoApprove && matchedInf) {
          const { data: camp } = await supabase.from("campaigns").insert({
            campaign_name: title,
            platform: "YouTube",
            publish_date: publishedAt ? publishedAt.slice(0, 10) : null,
            video_url: `https://www.youtube.com/watch?v=${v.id}`,
            video_id: v.id,
            collaboration_type: "organic",
            campaign_cost: 0,
            views, likes, comments,
            engagement_rate: engagementRate,
            influencer_id: matchedInf.id,
            detected_automatically: true,
            detection_source: "scan-youtube",
            last_stats_update: new Date().toISOString(),
          }).select().single();

          if (camp) {
            await checkAlerts(supabase, rules, {
              id: camp.id, influencer_id: camp.influencer_id, views, likes, comments,
              engagement_rate: engagementRate, purchase_revenue: camp.purchase_revenue ?? 0,
              conversion_rate: camp.conversion_rate ?? null,
            }, matchedInf.country ?? null);
          }
        }

        // New-detection alert
        await supabase.from("alerts").insert({
          alert_type: "new_detection",
          title: matchedInf ? `New video from ${matchedInf.name}` : "New brand mention detected",
          message: title,
          campaign_id: null,
        });

        // Suppress unused warning
        void detRow;
      }
    }

    await supabase.from("scan_log").update({
      status: "completed",
      completed_at: new Date().toISOString(),
      videos_found: videosFound,
      videos_new: videosNew,
    }).eq("id", logId!);

    return new Response(JSON.stringify({ ok: true, found: videosFound, new: videosNew }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    const msg = (e as Error).message;
    if (logId) {
      await supabase.from("scan_log").update({
        status: "failed",
        completed_at: new Date().toISOString(),
        error_message: msg,
        videos_found: videosFound,
        videos_new: videosNew,
      }).eq("id", logId);
    }
    return new Response(JSON.stringify({ ok: false, error: msg }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
