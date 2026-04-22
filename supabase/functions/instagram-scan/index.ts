import { createClient } from "https://esm.sh/@supabase/supabase-js@2.104.0";
import { z } from "https://esm.sh/zod@3.25.76";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const DetectionSchema = z.object({
  influencer_handle: z.string().min(1),
  platform: z.string().default("Instagram"),
  video_id: z.string().min(1),
  video_url: z.string().url(),
  video_title: z.string().nullable().optional(),
  mention_locations: z.array(z.string()).default([]),
  views: z.number().int().nonnegative().nullable().optional(),
  likes: z.number().int().nonnegative().nullable().optional(),
  comments: z.number().int().nonnegative().nullable().optional(),
  published_at: z.string().nullable().optional(),
});

const BodySchema = z.object({
  detections: z.array(DetectionSchema).min(1).max(500),
});

const normalizeHandle = (handle: string) => handle.trim().replace(/^@/, "").toLowerCase();
const externalSupabaseUrl = "https://vnggokmmxkiazkgkrdqs.supabase.co";
const externalSupabaseAnonKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZuZ2dva21teGtpYXprZ2tyZHFzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzY4NTYzMDQsImV4cCI6MjA5MjQzMjMwNH0.Nur-y2ERqUbkO--ZuEJ6McbbjWmB38Z-zYhlQ71VIp4";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const parsed = BodySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return new Response(JSON.stringify({ error: parsed.error.flatten() }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const supabase = createClient(externalSupabaseUrl, externalSupabaseAnonKey);
  const handles = [...new Set(parsed.data.detections.map((d) => normalizeHandle(d.influencer_handle)))];

  const { data: influencers, error: influencerError } = await supabase
    .from("influencers")
    .select("id,name,instagram_handle")
    .not("instagram_handle", "is", null);

  if (influencerError) {
    return new Response(JSON.stringify({ error: influencerError.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const influencerByHandle = new Map(
    (influencers ?? [])
      .filter((influencer) => handles.includes(normalizeHandle(influencer.instagram_handle ?? "")))
      .map((influencer) => [normalizeHandle(influencer.instagram_handle ?? ""), influencer]),
  );

  let saved = 0;

  for (const detection of parsed.data.detections) {
    const influencer = influencerByHandle.get(normalizeHandle(detection.influencer_handle));
    if (!influencer) continue;

    const { error: insertError } = await supabase.from("detected_videos").insert({
      influencer_id: influencer.id,
      platform: detection.platform,
      video_id: detection.video_id,
      video_url: detection.video_url,
      video_title: detection.video_title ?? null,
      channel_name: influencer.name,
      channel_id: normalizeHandle(detection.influencer_handle),
      mention_locations: detection.mention_locations,
      views: detection.views ?? 0,
      likes: detection.likes ?? 0,
      comments: detection.comments ?? 0,
      published_at: detection.published_at ?? null,
      status: "pending",
    });

    if (insertError) continue;

    saved += 1;
    await supabase.from("alerts").insert({
      alert_type: "new_detection",
      title: `New Instagram mention from ${influencer.name}`,
      message: detection.video_title ?? detection.video_url,
      campaign_id: null,
    });
  }

  return new Response(JSON.stringify({ success: true, saved }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
