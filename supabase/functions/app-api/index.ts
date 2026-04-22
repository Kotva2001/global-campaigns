import { createClient } from "https://esm.sh/@supabase/supabase-js@2.104.0";
import { z } from "https://esm.sh/zod@3.25.76";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const tableColumns = {
  alert_rules: ["id", "created_at", "is_active", "applies_to", "threshold", "condition", "metric", "name"],
  alerts: ["campaign_id", "id", "created_at", "is_read", "actual_value", "threshold_value", "message", "title", "alert_type"],
  campaigns: ["conversion_rate", "id", "influencer_id", "campaign_name", "platform", "publish_date", "video_url", "video_id", "collaboration_type", "campaign_cost", "utm_link", "managed_by", "views", "likes", "comments", "sessions", "engagement_rate", "purchase_revenue", "detected_automatically", "detection_source", "brand_mention_type", "last_stats_update", "created_at", "updated_at", "currency"],
  detected_videos: ["status", "published_at", "comments", "likes", "views", "id", "video_url", "video_id", "video_title", "channel_name", "channel_id", "thumbnail_url", "mention_locations", "influencer_id", "platform", "created_at"],
  influencers: ["updated_at", "created_at", "status", "notes", "contact_person", "id", "contact_email", "instagram_handle", "youtube_channel_url", "youtube_channel_id", "platforms", "country", "name"],
  scan_log: ["completed_at", "started_at", "error_message", "stats_updated", "videos_new", "videos_found", "status", "scan_type", "id"],
  scan_settings: ["platforms_to_scan", "auto_add_known_influencers", "stats_refresh_frequency_minutes", "youtube_api_key", "updated_at", "eur_czk_rate", "eur_czk_rate_updated_at", "id", "brand_keywords", "scan_frequency_minutes"],
} as const;

type TableName = keyof typeof tableColumns;

const FilterSchema = z.object({
  column: z.string().min(1),
  operator: z.enum(["eq", "neq", "gt", "gte", "lt", "lte", "in"]),
  value: z.unknown(),
});

const BodySchema = z.object({
  table: z.enum(Object.keys(tableColumns) as [TableName, ...TableName[]]),
  action: z.enum(["list", "get", "create", "update", "delete"]),
  id: z.string().uuid().optional(),
  data: z.record(z.unknown()).optional(),
  filters: z.array(FilterSchema).max(20).optional(),
  orderBy: z.string().optional(),
  ascending: z.boolean().optional(),
  limit: z.number().int().min(1).max(500).optional(),
});

const cleanData = (table: TableName, data: Record<string, unknown> = {}) => {
  const allowed = new Set<string>(tableColumns[table]);
  return Object.fromEntries(Object.entries(data).filter(([key]) => allowed.has(key) && key !== "id" && key !== "created_at" && key !== "updated_at"));
};

const assertColumn = (table: TableName, column?: string) => {
  if (!column || !(tableColumns[table] as readonly string[]).includes(column)) {
    throw new Error(`Column is not allowed: ${column ?? "missing"}`);
  }
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), { status: 405, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }

  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
  if (!supabaseUrl || !anonKey) {
    return new Response(JSON.stringify({ error: "Backend configuration missing" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }

  const supabase = createClient(supabaseUrl, anonKey, { global: { headers: { Authorization: authHeader } } });
  const token = authHeader.replace("Bearer ", "");
  const { data: claimsData, error: claimsError } = await supabase.auth.getClaims(token);
  if (claimsError || !claimsData?.claims?.sub) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }

  const parsed = BodySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return new Response(JSON.stringify({ error: parsed.error.flatten() }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }

  try {
    const { table, action, id, data, filters, orderBy, ascending, limit } = parsed.data;
    if ((action === "get" || action === "update" || action === "delete") && !id) throw new Error("id is required");

    let query = supabase.from(table);

    if (action === "create") {
      const payload = cleanData(table, data);
      const { data: row, error } = await query.insert(payload).select().single();
      if (error) throw error;
      return new Response(JSON.stringify({ data: row }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    if (action === "update") {
      const payload = cleanData(table, data);
      const { data: row, error } = await query.update(payload).eq("id", id).select().single();
      if (error) throw error;
      return new Response(JSON.stringify({ data: row }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    if (action === "delete") {
      const { error } = await query.delete().eq("id", id);
      if (error) throw error;
      return new Response(JSON.stringify({ data: { id } }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    let selectQuery = query.select("*");
    if (action === "get") selectQuery = selectQuery.eq("id", id).limit(1);
    for (const filter of filters ?? []) {
      assertColumn(table, filter.column);
      if (filter.operator === "in") {
        if (!Array.isArray(filter.value)) throw new Error("in filter value must be an array");
        selectQuery = selectQuery.in(filter.column, filter.value as unknown[]);
      } else {
        selectQuery = selectQuery[filter.operator](filter.column, filter.value as never);
      }
    }
    if (orderBy) {
      assertColumn(table, orderBy);
      selectQuery = selectQuery.order(orderBy, { ascending: ascending ?? false });
    }
    selectQuery = selectQuery.limit(limit ?? 100);

    const { data: rows, error } = action === "get" ? await selectQuery.maybeSingle() : await selectQuery;
    if (error) throw error;
    return new Response(JSON.stringify({ data: rows }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return new Response(JSON.stringify({ error: message }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
