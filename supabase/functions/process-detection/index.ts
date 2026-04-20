import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { z } from "https://esm.sh/zod@3.23.8";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const Body = z.object({
  detected_video_id: z.string().uuid(),
  campaign_name: z.string().min(1).max(255),
  collaboration_type: z.string().min(1).max(50),
  campaign_cost: z.number().min(0).default(0),
});

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  try {
    const parsed = Body.safeParse(await req.json());
    if (!parsed.success) {
      return new Response(JSON.stringify({ error: parsed.error.flatten().fieldErrors }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const { detected_video_id, campaign_name, collaboration_type, campaign_cost } = parsed.data;

    const { data: dv, error: dvErr } = await supabase
      .from("detected_videos").select("*").eq("id", detected_video_id).single();
    if (dvErr || !dv) throw new Error("Detected video not found");

    let influencerId = dv.influencer_id as string | null;
    if (!influencerId && dv.channel_id) {
      const { data: match } = await supabase
        .from("influencers").select("id").eq("youtube_channel_id", dv.channel_id).maybeSingle();
      if (match) influencerId = match.id;
    }

    const views = dv.views ?? 0;
    const likes = dv.likes ?? 0;
    const comments = dv.comments ?? 0;
    const engagement_rate = views > 0 ? ((likes + comments) / views) * 100 : null;

    const { data: campaign, error: cErr } = await supabase.from("campaigns").insert({
      campaign_name,
      platform: dv.platform,
      publish_date: dv.published_at ? String(dv.published_at).slice(0, 10) : null,
      video_url: dv.video_url,
      video_id: dv.video_id,
      collaboration_type,
      campaign_cost,
      views, likes, comments,
      engagement_rate,
      influencer_id: influencerId,
      detected_automatically: true,
      detection_source: "scanner",
      last_stats_update: new Date().toISOString(),
    }).select().single();
    if (cErr) throw cErr;

    await supabase.from("detected_videos").update({ status: "approved" }).eq("id", detected_video_id);

    return new Response(JSON.stringify({ ok: true, campaign }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ ok: false, error: (e as Error).message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
