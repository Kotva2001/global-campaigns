import { createClient } from "https://esm.sh/@supabase/supabase-js@2.104.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
};

const externalSupabaseUrl = "https://vnggokmmxkiazkgkrdqs.supabase.co";
const externalSupabaseAnonKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZuZ2dva21teGtpYXprZ2tyZHFzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzY4NTYzMDQsImV4cCI6MjA5MjQzMjMwNH0.Nur-y2ERqUbkO--ZuEJ6McbbjWmB38Z-zYhlQ71VIp4";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "GET") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const supabase = createClient(externalSupabaseUrl, externalSupabaseAnonKey);
  const { data, error } = await supabase
    .from("influencers")
    .select("id,name,country,status,instagram_handle")
    .eq("status", "active")
    .not("instagram_handle", "is", null)
    .order("name", { ascending: true });

  if (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  return new Response(JSON.stringify({ influencers: data ?? [] }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
