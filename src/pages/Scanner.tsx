import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { toastError } from "@/lib/toast-helpers";
import {
  Play, ExternalLink, X, Plus, Youtube, Instagram, AlertCircle, Copy,
  CheckCircle2, Clock, Loader2, Eye, EyeOff, Info, RefreshCw,
} from "lucide-react";
import { formatNumber, formatCompact } from "@/lib/formatters";
import { copyExternalLinkToClipboard, isInstagramUrl } from "@/lib/external-link-copy";
import { notifyScannerChanged, notifyAlertsChanged } from "@/lib/badge-events";
import { Skeleton } from "@/components/ui/skeleton";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { FlagIcon, hasFlag } from "@/components/FlagIcon";

type ScanSettings = {
  id: string;
  brand_keywords: string[] | null;
  youtube_api_key: string | null;
  scan_frequency_minutes: number | null;
  platforms_to_scan: string[] | null;
  auto_add_known_influencers: boolean | null;
  stats_refresh_frequency_minutes: number | null;
};

type DetectedVideo = {
  id: string;
  video_url: string;
  video_id: string;
  platform: string;
  video_title: string | null;
  channel_name: string | null;
  channel_id: string | null;
  thumbnail_url: string | null;
  influencer_id: string | null;
  status: string | null;
  published_at: string | null;
  views: number | null;
  likes: number | null;
  comments: number | null;
  mention_locations: string[] | null;
  created_at: string | null;
};

type ScanLogRow = {
  id: string;
  scan_type: string;
  status: string;
  videos_found: number | null;
  videos_new: number | null;
  stats_updated: number | null;
  started_at: string | null;
  completed_at: string | null;
  error_message: string | null;
};

type Influencer = {
  id: string;
  name: string;
  country: string;
  youtube_channel_id: string | null;
  youtube_channel_url: string | null;
  status: string | null;
};

const YT_SEARCH = "https://www.googleapis.com/youtube/v3/search";
const YT_VIDEOS = "https://www.googleapis.com/youtube/v3/videos";

const extractYouTubeChannelId = (url: string | null): string | null => {
  if (!url) return null;
  const match = url.match(/youtube\.com\/channel\/([A-Za-z0-9_-]+)/i);
  return match?.[1] ?? null;
};

const findMentions = (title: string, description: string, tags: string[], keywords: string[]) => {
  const locs = new Set<string>();
  const lowered = keywords.map((keyword) => keyword.toLowerCase());
  const hasKeyword = (value: string) => lowered.some((keyword) => value.toLowerCase().includes(keyword));
  if (hasKeyword(title)) locs.add("Title");
  if (hasKeyword(description)) locs.add("Description");
  if (tags.some((tag) => hasKeyword(tag))) locs.add("Tags");
  return [...locs];
};

const SCAN_FREQ_OPTIONS = [
  { v: 15, l: "Every 15 min" },
  { v: 30, l: "Every 30 min" },
  { v: 60, l: "Every hour" },
  { v: 360, l: "Every 6 hours" },
  { v: 1440, l: "Daily" },
];
const STATS_FREQ_OPTIONS = [
  { v: 60, l: "Every hour" },
  { v: 360, l: "Every 6 hours" },
  { v: 720, l: "Every 12 hours" },
  { v: 1440, l: "Daily" },
];

export default function Scanner() {
  const [settings, setSettings] = useState<ScanSettings | null>(null);
  const [detections, setDetections] = useState<DetectedVideo[]>([]);
  const [logs, setLogs] = useState<ScanLogRow[]>([]);
  const [influencers, setInfluencers] = useState<Influencer[]>([]);
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [refreshProgress, setRefreshProgress] = useState<{ done: number; total: number } | null>(null);
  const [page, setPage] = useState(1);
  const PAGE = 10;

  const load = async () => {
    setLoading(true);
    const [s, d, l, inf] = await Promise.all([
      supabase.from("scan_settings").select("*").limit(1).maybeSingle(),
      supabase.from("detected_videos").select("*").eq("status", "pending").order("created_at", { ascending: false }),
      supabase.from("scan_log").select("*").order("started_at", { ascending: false }).limit(200),
      supabase.from("influencers").select("id,name,country,youtube_channel_id,youtube_channel_url,status"),
    ]);
    if (s.data) setSettings(s.data as ScanSettings);
    setDetections((d.data ?? []) as DetectedVideo[]);
    setLogs((l.data ?? []) as ScanLogRow[]);
    setInfluencers((inf.data ?? []) as Influencer[]);
    setLoading(false);
  };

  useEffect(() => { void load(); }, []);

  const lastScan = logs[0];
  const status: { color: string; label: string; sub: string } = useMemo(() => {
    if (!lastScan) return { color: "bg-muted-foreground", label: "Idle", sub: "No scans yet" };
    if (lastScan.status === "running" || lastScan.status === "pending") {
      return { color: "bg-warning animate-pulse", label: "Running", sub: "Scan in progress" };
    }
    if (lastScan.status === "failed") {
      return { color: "bg-destructive", label: "Error", sub: lastScan.error_message ?? "Last scan failed" };
    }
    const ageMin = lastScan.completed_at
      ? (Date.now() - new Date(lastScan.completed_at).getTime()) / 60000
      : 9999;
    const freq = settings?.scan_frequency_minutes ?? 60;
    if (ageMin < freq * 1.2) return { color: "bg-success animate-pulse", label: "Active", sub: "Scanner is running" };
    return { color: "bg-muted-foreground", label: "Idle", sub: "Waiting for next scan" };
  }, [lastScan, settings]);

  const nextScanAt = useMemo(() => {
    if (!lastScan?.completed_at || !settings?.scan_frequency_minutes) return null;
    return new Date(new Date(lastScan.completed_at).getTime() + settings.scan_frequency_minutes * 60000);
  }, [lastScan, settings]);

  const totals = useMemo(() => {
    return logs.reduce(
      (a, x) => ({
        scanned: a.scanned + (x.videos_found ?? 0),
        nw: a.nw + (x.videos_new ?? 0),
        stats: a.stats + (x.stats_updated ?? 0),
      }),
      { scanned: 0, nw: 0, stats: 0 },
    );
  }, [logs]);

  const runScanNow = async () => {
    setRunning(true);
    const startedAt = new Date().toISOString();
    const { data: logRow } = await supabase.from("scan_log").insert({ scan_type: "YouTube", status: "running", started_at: startedAt }).select("id").single();
    let videosFound = 0;
    let videosNew = 0;
    try {
      if (logRow?.id) {
        setLogs((current) => [
          { id: logRow.id, scan_type: "YouTube", status: "running", videos_found: 0, videos_new: 0, stats_updated: 0, started_at: startedAt, completed_at: null, error_message: null },
          ...current,
        ]);
      }
      if (!settings) throw new Error("Scan settings not configured");
      if (!settings.youtube_api_key) throw new Error("YouTube API key missing");
      const keywords = settings.brand_keywords ?? [];
      if (!keywords.length) throw new Error("No brand keywords configured");

      const tracked = influencers
        .filter((influencer) => influencer.status !== "inactive")
        .map((influencer) => ({ ...influencer, youtube_channel_id: influencer.youtube_channel_id ?? extractYouTubeChannelId(influencer.youtube_channel_url) }))
        .filter((influencer): influencer is Influencer & { youtube_channel_id: string } => !!influencer.youtube_channel_id);
      const { data: lastSuccess } = await supabase.from("scan_log").select("completed_at").eq("scan_type", "YouTube").eq("status", "completed").order("completed_at", { ascending: false }).limit(1).maybeSingle();
      const cutoff = lastSuccess?.completed_at ? new Date(lastSuccess.completed_at).toISOString() : new Date(Date.now() - 7 * 24 * 3600 * 1000).toISOString();
      const candidates = new Map<string, { influencer: typeof tracked[number] }>();

      for (const influencer of tracked) {
        const url = `${YT_SEARCH}?part=snippet&channelId=${influencer.youtube_channel_id}&order=date&type=video&maxResults=10&publishedAfter=${cutoff}&key=${encodeURIComponent(settings.youtube_api_key)}`;
        const response = await fetch(url);
        if (!response.ok) continue;
        const json = await response.json();
        for (const item of json.items ?? []) if (item?.id?.videoId) candidates.set(item.id.videoId, { influencer });
      }

      videosFound = candidates.size;
      const ids = [...candidates.keys()];
      const [{ data: existingDetections }, { data: existingCampaigns }] = ids.length ? await Promise.all([
        supabase.from("detected_videos").select("video_id").in("video_id", ids),
        supabase.from("campaigns").select("video_id").in("video_id", ids),
      ]) : [{ data: [] }, { data: [] }];
      const known = new Set([...(existingDetections ?? []).map((row) => row.video_id), ...(existingCampaigns ?? []).map((row) => row.video_id).filter(Boolean)]);
      const newIds = ids.filter((id) => !known.has(id));

      for (let i = 0; i < newIds.length; i += 50) {
        const batch = newIds.slice(i, i + 50);
        const response = await fetch(`${YT_VIDEOS}?part=snippet,statistics&id=${batch.join(",")}&key=${encodeURIComponent(settings.youtube_api_key)}`);
        if (!response.ok) continue;
        const json = await response.json();
        for (const video of json.items ?? []) {
          const snippet = video.snippet ?? {};
          const stats = video.statistics ?? {};
          const mentions = findMentions(snippet.title ?? "", snippet.description ?? "", snippet.tags ?? [], keywords);
          const matched = candidates.get(video.id)?.influencer;
          if (!mentions.length || !matched) continue;
          const views = Number(stats.viewCount ?? 0);
          const likes = Number(stats.likeCount ?? 0);
          const comments = Number(stats.commentCount ?? 0);
          const publishedAt = snippet.publishedAt ?? null;
          const { error } = await supabase.from("detected_videos").insert({
            video_id: video.id,
            video_url: `https://www.youtube.com/watch?v=${video.id}`,
            platform: "YouTube",
            video_title: snippet.title ?? "",
            channel_name: snippet.channelTitle ?? "",
            channel_id: snippet.channelId ?? matched.youtube_channel_id,
            thumbnail_url: snippet.thumbnails?.high?.url ?? snippet.thumbnails?.default?.url ?? null,
            influencer_id: matched.id,
            published_at: publishedAt,
            views,
            likes,
            comments,
            mention_locations: mentions,
            status: "pending",
          });
          if (error) throw error;
          videosNew += 1;
          await supabase.from("alerts").insert({ alert_type: "new_detection", title: `New video from ${matched.name}`, message: snippet.title ?? "", campaign_id: null });
        }
      }
      const completedAt = new Date().toISOString();
      if (logRow?.id) await supabase.from("scan_log").update({ status: "completed", completed_at: completedAt, videos_found: videosFound, videos_new: videosNew }).eq("id", logRow.id);
      if (logRow?.id) setLogs((current) => current.map((row) => row.id === logRow.id ? { ...row, status: "completed", completed_at: completedAt, videos_found: videosFound, videos_new: videosNew } : row));
      toast.success(`Scan complete — ${videosNew} new`);
    } catch (error) {
      const message = (error as Error).message;
      const completedAt = new Date().toISOString();
      if (logRow?.id) await supabase.from("scan_log").update({ status: "failed", completed_at: completedAt, error_message: message, videos_found: videosFound, videos_new: videosNew }).eq("id", logRow.id);
      if (logRow?.id) setLogs((current) => current.map((row) => row.id === logRow.id ? { ...row, status: "failed", completed_at: completedAt, error_message: message, videos_found: videosFound, videos_new: videosNew } : row));
      toastError("Scan failed", message);
    }
    await load();
    setRunning(false);
  };

  const refreshYouTubeStats = async () => {
    if (!settings?.youtube_api_key) {
      toastError("YouTube API key missing", "Please configure it in scan settings.");
      return;
    }
    setRefreshing(true);
    const startedAt = new Date().toISOString();
    const apiKey = settings.youtube_api_key;
    const { data: logRow } = await supabase
      .from("scan_log")
      .insert({ scan_type: "YouTube Stats", status: "running", started_at: startedAt })
      .select("id")
      .single();

    let updatedCount = 0;
    try {
      const { data: campaigns, error } = await supabase
        .from("campaigns")
        .select("video_id")
        .in("platform", ["YouTube", "YB Shorts"])
        .not("video_id", "is", null);
      if (error) throw error;

      const videoIds = Array.from(new Set((campaigns ?? []).map((c) => c.video_id).filter(Boolean) as string[]));
      setRefreshProgress({ done: 0, total: videoIds.length });

      if (!videoIds.length) {
        toast.info("No YouTube campaigns with video IDs to refresh");
      } else {
        for (let i = 0; i < videoIds.length; i += 50) {
          const batch = videoIds.slice(i, i + 50);
          const response = await fetch(
            `${YT_VIDEOS}?part=statistics&id=${batch.join(",")}&key=${encodeURIComponent(apiKey)}`,
          );
          if (!response.ok) {
            setRefreshProgress({ done: Math.min(i + batch.length, videoIds.length), total: videoIds.length });
            continue;
          }
          const json = await response.json();
          const nowIso = new Date().toISOString();
          for (const video of json.items ?? []) {
            const stats = video.statistics ?? {};
            const payload = {
              views: Number(stats.viewCount ?? 0),
              likes: Number(stats.likeCount ?? 0),
              comments: Number(stats.commentCount ?? 0),
              last_stats_update: nowIso,
            };
            const [{ error: cErr }] = await Promise.all([
              supabase.from("campaigns").update(payload).eq("video_id", video.id),
              supabase
                .from("detected_videos")
                .update({ views: payload.views, likes: payload.likes, comments: payload.comments })
                .eq("video_id", video.id),
            ]);
            if (!cErr) updatedCount += 1;
          }
          setRefreshProgress({ done: Math.min(i + batch.length, videoIds.length), total: videoIds.length });
        }
        toast.success(`Updated stats for ${updatedCount} campaigns`);
      }

      const completedAt = new Date().toISOString();
      if (logRow?.id) {
        await supabase
          .from("scan_log")
          .update({ status: "completed", completed_at: completedAt, stats_updated: updatedCount, videos_found: videoIds.length })
          .eq("id", logRow.id);
      }
    } catch (err) {
      const message = (err as Error).message;
      const completedAt = new Date().toISOString();
      if (logRow?.id) {
        await supabase
          .from("scan_log")
          .update({ status: "failed", completed_at: completedAt, error_message: message, stats_updated: updatedCount })
          .eq("id", logRow.id);
      }
      toastError("Refresh failed", message);
    }
    await load();
    setRefreshing(false);
    setRefreshProgress(null);
  };

  return (
    <div className="space-y-6 p-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Scanner</h1>
        <p className="text-sm text-muted-foreground">Automatic brand-mention detection</p>
      </div>

      <StatusCard
        status={status}
        lastScan={lastScan}
        nextScanAt={nextScanAt}
        totals={totals}
        running={running}
        onRun={runScanNow}
        refreshing={refreshing}
        refreshProgress={refreshProgress}
        onRefreshStats={refreshYouTubeStats}
      />

      {loading ? <SectionSkeleton rows={3} /> : (
        <DetectionQueue
          detections={detections}
          influencers={influencers}
          onChange={load}
        />
      )}

      {loading ? <SectionSkeleton rows={4} /> : settings && <SettingsForm settings={settings} onSaved={load} />}

      {loading ? <SectionSkeleton rows={5} /> : <ScanHistory logs={logs} page={page} setPage={setPage} pageSize={PAGE} />}
    </div>
  );
}

/* ---------- Status Card ---------- */
function StatusCard({
  status, lastScan, nextScanAt, totals, running, onRun,
  refreshing, refreshProgress, onRefreshStats,
}: {
  status: { color: string; label: string; sub: string };
  lastScan?: ScanLogRow;
  nextScanAt: Date | null;
  totals: { scanned: number; nw: number; stats: number };
  running: boolean;
  onRun: () => void;
  refreshing: boolean;
  refreshProgress: { done: number; total: number } | null;
  onRefreshStats: () => void;
}) {
  const fmt = (d?: string | null) => (d ? new Date(d).toLocaleString("cs-CZ") : "—");
  const isActive = status.label === "Active";
  const isIdle = status.label === "Idle";
  const dotStyle: React.CSSProperties = isActive
    ? { background: "hsl(var(--success))", boxShadow: "0 0 14px hsl(var(--success) / 0.85)" }
    : isIdle
      ? { background: "hsl(240 18% 55%)", boxShadow: "0 0 6px hsl(240 18% 55% / 0.5)" }
      : {};
  return (
    <Card>
      <CardContent className="p-6">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div className="flex items-center gap-4">
            {isActive || isIdle ? (
              <span className="inline-block h-4 w-4 animate-pulse rounded-full" style={dotStyle} />
            ) : (
              <span className={`inline-block h-4 w-4 rounded-full ${status.color}`} />
            )}
            <div>
              <div className="text-xl font-semibold" style={isActive ? { color: "hsl(var(--success))", textShadow: "0 0 10px hsl(var(--success) / 0.5)" } : undefined}>
                {status.label}
              </div>
              <div className="text-sm text-muted-foreground">{status.sub}</div>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button onClick={onRun} disabled={running || refreshing} className="btn-neon-cyan gap-2">
              {running ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}
              Run Scan Now
            </Button>
            <Button onClick={onRefreshStats} disabled={running || refreshing} className="btn-neon-purple gap-2">
              {refreshing ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
              {refreshing && refreshProgress
                ? `Refreshing stats… ${refreshProgress.done}/${refreshProgress.total} campaigns`
                : "Refresh YouTube Stats"}
            </Button>
          </div>
        </div>

        <div className="mt-6 grid grid-cols-2 divide-x divide-border md:grid-cols-5">
          <Stat label="Last scan" value={fmt(lastScan?.completed_at ?? lastScan?.started_at)} />
          <Stat label="Next scan" value={nextScanAt ? fmt(nextScanAt.toISOString()) : "—"} />
          <Stat label="Videos scanned" value={formatNumber(totals.scanned)} />
          <Stat label="New detections" value={formatNumber(totals.nw)} />
          <Stat label="Stats updated" value={formatNumber(totals.stats)} />
        </div>
      </CardContent>
    </Card>
  );
}

const Stat = ({ label, value }: { label: string; value: string }) => (
  <div className="px-4 first:pl-0">
    <div className="kpi-label">{label}</div>
    <div
      className="mt-1 text-base font-bold tabular-nums"
      style={{ color: "hsl(var(--glow-cyan))", textShadow: "0 0 8px hsl(var(--glow-cyan) / 0.35)" }}
    >
      {value}
    </div>
  </div>
);

const SectionSkeleton = ({ rows }: { rows: number }) => (
  <Card>
    <CardContent className="space-y-3 p-6">
      {Array.from({ length: rows }).map((_, i) => <Skeleton key={i} className="h-12 bg-card" />)}
    </CardContent>
  </Card>
);

const similarity = (a: string, b: string) => {
  const wordsA = new Set(a.toLowerCase().split(/\W+/).filter(Boolean));
  const wordsB = new Set(b.toLowerCase().split(/\W+/).filter(Boolean));
  const union = new Set([...wordsA, ...wordsB]);
  if (!union.size) return 0;
  return [...wordsA].filter((word) => wordsB.has(word)).length / union.size;
};

const MatchBadge = ({ label }: { label: string }) => {
  const lower = label.toLowerCase();
  if (lower.includes("tag") || lower.includes("hashtag")) {
    return (
      <Badge className="border bg-[hsl(var(--glow-cyan)/0.15)] text-[hsl(var(--glow-cyan))] border-[hsl(var(--glow-cyan)/0.5)] hover:bg-[hsl(var(--glow-cyan)/0.22)]">
        Hashtag: #{label.replace(/^#/, "")}
      </Badge>
    );
  }
  if (lower.includes("description") || lower.includes("caption") || lower.includes("title")) {
    return (
      <Badge className="border bg-[hsl(var(--success)/0.15)] text-[hsl(var(--success))] border-[hsl(var(--success)/0.5)] hover:bg-[hsl(var(--success)/0.22)]">
        Keyword: regals
      </Badge>
    );
  }
  return <Badge variant="outline">{label}</Badge>;
};

/* ---------- Detection Queue ---------- */
function DetectionQueue({
  detections, influencers, onChange,
}: {
  detections: DetectedVideo[];
  influencers: Influencer[];
  onChange: () => void;
}) {
  const [approve, setApprove] = useState<DetectedVideo | null>(null);
  const [platformFilter, setPlatformFilter] = useState<"all" | "youtube" | "instagram">("all");
  const matchInfluencer = (d: DetectedVideo): Influencer | undefined => {
    if (d.influencer_id) return influencers.find((i) => i.id === d.influencer_id);
    if (d.channel_id) return influencers.find((i) => i.youtube_channel_id === d.channel_id);
    return undefined;
  };

  const dismiss = async (id: string) => {
    const { error } = await supabase.from("detected_videos").update({ status: "dismissed" }).eq("id", id);
    if (error) toastError("Could not dismiss detection", error); else { toast.success("Dismissed"); onChange(); }
  };

  const filtered = detections.filter((d) => {
    if (platformFilter === "all") return true;
    const p = d.platform.toLowerCase();
    if (platformFilter === "youtube") return p.includes("you");
    if (platformFilter === "instagram") return p.includes("insta");
    return true;
  });

  const FilterPill = ({ value, label }: { value: typeof platformFilter; label: string }) => (
    <button
      type="button"
      onClick={() => setPlatformFilter(value)}
      className={`rounded-full border px-3 py-1 text-xs font-medium transition-all ${
        platformFilter === value
          ? "border-[hsl(var(--glow-cyan))] bg-[hsl(var(--glow-cyan)/0.15)] text-[hsl(var(--glow-cyan))] shadow-[0_0_10px_hsl(var(--glow-cyan)/0.4)]"
          : "border-border text-muted-foreground hover:text-foreground hover:border-[hsl(var(--glow-cyan)/0.4)]"
      }`}
    >
      {label}
    </button>
  );

  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between space-y-0">
        <div className="flex items-center gap-3">
          <CardTitle className="flex items-center gap-2">
            Pending Detections
            <span
              className="inline-flex h-6 min-w-[24px] items-center justify-center rounded-full bg-[hsl(var(--glow-pink))] px-2 text-xs font-bold text-white"
              style={{ boxShadow: "0 0 12px hsl(var(--glow-pink) / 0.7)" }}
            >
              {detections.length}
            </span>
          </CardTitle>
        </div>
        <div className="flex items-center gap-1.5">
          <FilterPill value="all" label="All" />
          <FilterPill value="instagram" label="Instagram" />
          <FilterPill value="youtube" label="YouTube" />
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {filtered.length === 0 && (
          <div className="py-12 text-center text-sm text-muted-foreground">No pending detections.</div>
        )}
        {filtered.map((d) => {
          const matched = matchInfluencer(d);
          const isYouTube = d.platform.toLowerCase().includes("you");
          const PlatIcon = isYouTube ? Youtube : Instagram;
          const platHsl = isYouTube ? "var(--platform-youtube)" : "var(--platform-instagram)";
          const previous = filtered[filtered.indexOf(d) - 1];
          const similar = previous?.video_title && d.video_title ? similarity(previous.video_title, d.video_title) > 0.8 : false;
          return (
            <div
              key={d.id}
              className="rounded-lg border p-4 transition-all hover:border-[hsl(var(--glow-cyan)/0.4)]"
              style={{
                borderLeft: `4px solid hsl(${platHsl})`,
                background: `linear-gradient(90deg, hsl(${platHsl} / 0.08) 0%, hsl(${platHsl} / 0.02) 30%, transparent 70%)`,
              }}
            >
              <div className="flex flex-col gap-4 md:flex-row">
                <div className="flex items-start gap-3">
                  <div
                    className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full"
                    style={{
                      background: `hsl(${platHsl} / 0.18)`,
                      border: `1px solid hsl(${platHsl} / 0.55)`,
                      boxShadow: `0 0 12px hsl(${platHsl} / 0.4)`,
                    }}
                  >
                    <PlatIcon className="h-5 w-5" style={{ color: `hsl(${platHsl})` }} />
                  </div>
                  {d.thumbnail_url && (
                    <img src={d.thumbnail_url} alt="" className="h-20 w-32 shrink-0 rounded object-cover" />
                  )}
                </div>

                <div className="flex-1 space-y-2">
                  <TooltipProvider delayDuration={300}>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        {isInstagramUrl(d.video_url) ? (
                          <button
                            type="button"
                            onClick={() => copyExternalLinkToClipboard(d.video_url)}
                            className="block text-left font-semibold hover:underline"
                            style={{
                              display: "-webkit-box",
                              WebkitLineClamp: 2,
                              WebkitBoxOrient: "vertical",
                              overflow: "hidden",
                              textOverflow: "ellipsis",
                            }}
                          >
                            {d.video_title ?? d.video_url}
                          </button>
                        ) : (
                          <a
                            href={d.video_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="block font-semibold hover:underline"
                            style={{
                              display: "-webkit-box",
                              WebkitLineClamp: 2,
                              WebkitBoxOrient: "vertical",
                              overflow: "hidden",
                              textOverflow: "ellipsis",
                            }}
                          >
                            {d.video_title ?? d.video_url}
                          </a>
                        )}
                      </TooltipTrigger>
                      <TooltipContent className="max-w-md">
                        {d.video_title ?? d.video_url}
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                  <div className="flex items-center gap-2 text-[15px] text-muted-foreground">
                    {matched && hasFlag(matched.country) && (
                      <FlagIcon code={matched.country} width={18} height={12} />
                    )}
                    <span className="font-medium text-foreground/80">{d.channel_name ?? "Unknown channel"}</span>
                    <span>·</span>
                    <span>{d.published_at ? new Date(d.published_at).toLocaleDateString("cs-CZ") : "—"}</span>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {(d.mention_locations ?? []).map((m) => (
                      <MatchBadge key={m} label={m} />
                    ))}
                    {matched ? (
                      <Badge className="border bg-[hsl(var(--tertiary)/0.15)] text-[hsl(var(--tertiary))] border-[hsl(var(--tertiary)/0.55)] hover:bg-[hsl(var(--tertiary)/0.22)]">
                        Creator: {matched.name}
                      </Badge>
                    ) : (
                      <Badge className="border bg-[hsl(var(--warning)/0.15)] text-[hsl(var(--warning))] border-[hsl(var(--warning)/0.55)] hover:bg-[hsl(var(--warning)/0.22)]">
                        Unknown Creator
                      </Badge>
                    )}
                    {similar && <Badge variant="outline" className="text-muted-foreground">Similar to above</Badge>}
                  </div>
                </div>

                <DetectionStats views={d.views} likes={d.likes} comments={d.comments} />
              </div>

              <div className="mt-4 flex flex-wrap gap-2">
                <Button size="sm" onClick={() => setApprove(d)} className="btn-neon-green">
                  <CheckCircle2 className="h-4 w-4" /> Approve & Add
                </Button>
                <Button
                  size="sm"
                  onClick={() => dismiss(d.id)}
                  className="scanner-dismiss-button btn-neon-red"
                  style={{
                    background: "transparent",
                    border: "1px solid hsl(348 100% 60%)",
                    color: "hsl(348 100% 60%)",
                  }}
                >
                  <X className="h-4 w-4" style={{ color: "hsl(348 100% 60%)", stroke: "hsl(348 100% 60%)" }} />
                  <span style={{ color: "hsl(348 100% 60%)" }}>Dismiss</span>
                </Button>
                {isInstagramUrl(d.video_url) ? (
                  <Button
                    size="sm"
                    className="btn-neon-cyan"
                    onClick={() => copyExternalLinkToClipboard(d.video_url)}
                  >
                    <Copy className="h-4 w-4" /> Copy Link
                  </Button>
                ) : (
                  <Button size="sm" asChild className="btn-neon-cyan">
                    <a href={d.video_url} target="_blank" rel="noopener noreferrer">
                      <ExternalLink className="h-4 w-4" /> View Original
                    </a>
                  </Button>
                )}
                {!matched && (
                  <Button size="sm" asChild className="btn-neon-purple">
                    <a href="/creators"><Plus className="h-4 w-4" /> Add to Roster</a>
                  </Button>
                )}
              </div>
            </div>
          );
        })}
      </CardContent>

      <ApproveDialog
        open={!!approve}
        detection={approve}
        matched={approve ? matchInfluencer(approve) : undefined}
        onClose={() => setApprove(null)}
        onSaved={() => { setApprove(null); onChange(); }}
      />
    </Card>
  );
}

const DetectionStats = ({ views, likes, comments }: { views: number | null; likes: number | null; comments: number | null }) => {
  const v = views ?? 0;
  const l = likes ?? 0;
  const c = comments ?? 0;
  if (v === 0 && l === 0 && c === 0) {
    return <div className="flex items-start text-xs italic text-muted-foreground/60">No stats</div>;
  }
  return (
    <div className="flex flex-col items-end gap-1.5 text-sm font-semibold tabular-nums">
      <div className="flex items-center gap-1.5" style={{ color: "hsl(var(--glow-cyan))" }} title="Views">
        <Eye className="h-4 w-4" />
        <span>{formatCompact(v)}</span>
      </div>
      <div className="flex items-center gap-1.5" style={{ color: "hsl(var(--warning))" }} title="Likes">
        <span className="text-base leading-none">🔥</span>
        <span>{formatCompact(l)}</span>
      </div>
      <div className="flex items-center gap-1.5" style={{ color: "hsl(var(--glow-pink))" }} title="Comments">
        <span className="text-base leading-none">💬</span>
        <span>{formatCompact(c)}</span>
      </div>
    </div>
  );
};

function ApproveDialog({
  open, detection, matched, onClose, onSaved,
}: {
  open: boolean;
  detection: DetectedVideo | null;
  matched?: Influencer;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [name, setName] = useState("");
  const [collab, setCollab] = useState("paid");
  const [cost, setCost] = useState("0");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (detection) {
      setName(detection.video_title ?? "");
      setCollab("paid");
      setCost("0");
    }
  }, [detection]);

  const save = async () => {
    if (!detection) return;
    setSaving(true);
    const views = detection.views ?? 0;
    const likes = detection.likes ?? 0;
    const comments = detection.comments ?? 0;
    const engagementRate = views > 0 ? ((likes + comments) / views) * 100 : null;
    const influencerId = detection.influencer_id ?? matched?.id ?? null;
    const { error: campaignError } = await supabase.from("campaigns").insert({
      campaign_name: name || detection.video_title || null,
      platform: detection.platform,
      publish_date: detection.published_at ? detection.published_at.slice(0, 10) : null,
      video_url: detection.video_url,
      video_id: detection.video_id,
      collaboration_type: collab,
      campaign_cost: Number(cost) || 0,
      views,
      likes,
      comments,
      engagement_rate: engagementRate,
      influencer_id: influencerId,
      detected_automatically: true,
      detection_source: "scanner",
      last_stats_update: new Date().toISOString(),
    });
    if (campaignError) {
      toastError("Could not create campaign", campaignError);
      setSaving(false);
      return;
    }
    const { error: updateError } = await supabase.from("detected_videos").update({ status: "approved" }).eq("id", detection.id);
    if (updateError) {
      toastError("Could not update detection", updateError);
      setSaving(false);
      return;
    }
    toast.success("Campaign created");
    setSaving(false);
    onSaved();
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader><DialogTitle>Approve Detection</DialogTitle></DialogHeader>
        <div className="space-y-4">
          <div>
            <Label>Campaign name</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} maxLength={200} />
          </div>
          <div>
            <Label>Collaboration type</Label>
            <Select value={collab} onValueChange={setCollab}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="paid">Paid</SelectItem>
                <SelectItem value="barter">Barter</SelectItem>
                <SelectItem value="organic">Organic</SelectItem>
                <SelectItem value="affiliate">Affiliate</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Campaign cost (Kč)</Label>
            <Input type="number" min="0" value={cost} onChange={(e) => setCost(e.target.value)} />
          </div>
          {!matched && (
            <div className="flex items-start gap-2 rounded border border-warning/40 bg-warning/10 p-3 text-sm">
              <AlertCircle className="h-4 w-4 shrink-0 text-warning" />
              <span>No matching creator. Campaign will be created without an influencer link.</span>
            </div>
          )}
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button onClick={save} disabled={saving}>
            {saving && <Loader2 className="h-4 w-4 animate-spin" />} Create campaign
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* ---------- Settings ---------- */
function SettingsForm({ settings, onSaved }: { settings: ScanSettings; onSaved: () => void }) {
  const [keywords, setKeywords] = useState<string[]>(settings.brand_keywords ?? []);
  const [kwInput, setKwInput] = useState("");
  const [apiKey, setApiKey] = useState(settings.youtube_api_key ?? "");
  const [freq, setFreq] = useState(settings.scan_frequency_minutes ?? 60);
  const [statsFreq, setStatsFreq] = useState(settings.stats_refresh_frequency_minutes ?? 360);
  const [platforms, setPlatforms] = useState<string[]>(settings.platforms_to_scan ?? []);
  const [autoApprove, setAutoApprove] = useState(!!settings.auto_add_known_influencers);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [showKey, setShowKey] = useState(false);

  const addKw = () => {
    const v = kwInput.trim();
    if (!v || keywords.includes(v)) return;
    setKeywords([...keywords, v]);
    setKwInput("");
  };
  const togglePlatform = (p: string) => {
    setPlatforms(platforms.includes(p) ? platforms.filter((x) => x !== p) : [...platforms, p]);
  };

  const save = async () => {
    setSaving(true);
    const { error } = await supabase.from("scan_settings").update({
      brand_keywords: keywords,
      youtube_api_key: apiKey || null,
      scan_frequency_minutes: freq,
      stats_refresh_frequency_minutes: statsFreq,
      platforms_to_scan: platforms,
      auto_add_known_influencers: autoApprove,
    }).eq("id", settings.id);
    setSaving(false);
    if (error) toastError("Could not save settings", error);
    else { toast.success("Settings saved"); onSaved(); }
  };

  const testKey = async () => {
    if (!apiKey) { toast.error("Enter an API key first"); return; }
    setTesting(true);
    try {
      const r = await fetch(
        `https://www.googleapis.com/youtube/v3/search?part=snippet&q=test&maxResults=1&key=${encodeURIComponent(apiKey)}`,
      );
      const j = await r.json();
      if (r.ok) toast.success("API key is valid");
      else toastError("Invalid API key", j.error?.message ?? "");
    } catch (e) {
      toastError("Could not test API key", e);
    }
    setTesting(false);
  };

  return (
    <Card>
      <CardHeader><CardTitle className="section-heading text-base">Scan Settings</CardTitle></CardHeader>
      <CardContent className="space-y-6">
        <div>
          <Label className="section-heading">Brand keywords</Label>
          <div className="mt-2 flex flex-wrap gap-2">
            {keywords.map((k) => (
              <Badge
                key={k}
                className="gap-1 border bg-[hsl(var(--success)/0.15)] text-[hsl(var(--success))] border-[hsl(var(--success)/0.5)] hover:bg-[hsl(var(--success)/0.22)]"
              >
                {k}
                <button type="button" onClick={() => setKeywords(keywords.filter((x) => x !== k))}>
                  <X className="h-3 w-3" />
                </button>
              </Badge>
            ))}
          </div>
          <div className="mt-2 flex gap-2">
            <Input
              className="input-neon"
              value={kwInput}
              onChange={(e) => setKwInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), addKw())}
              placeholder="Add keyword and press Enter"
              maxLength={100}
            />
            <Button type="button" variant="secondary" onClick={addKw}>Add</Button>
          </div>
        </div>

        <div>
          <Label className="section-heading">YouTube API key</Label>
          <div className="mt-2 flex gap-2">
            <Input
              className="input-neon"
              type={showKey ? "text" : "password"}
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              placeholder="AIza…"
              maxLength={200}
            />
            <Button type="button" variant="secondary" size="icon" onClick={() => setShowKey((v) => !v)} aria-label={showKey ? "Hide API key" : "Show API key"}>
              {showKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </Button>
            <Button type="button" variant="secondary" onClick={testKey} disabled={testing}>
              {testing && <Loader2 className="h-4 w-4 animate-spin" />} Test
            </Button>
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <Label className="section-heading">Scan frequency</Label>
            <Select value={String(freq)} onValueChange={(v) => setFreq(Number(v))}>
              <SelectTrigger className="mt-2"><SelectValue /></SelectTrigger>
              <SelectContent>
                {SCAN_FREQ_OPTIONS.map((o) => (
                  <SelectItem key={o.v} value={String(o.v)}>{o.l}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="section-heading">Stats refresh frequency</Label>
            <Select value={String(statsFreq)} onValueChange={(v) => setStatsFreq(Number(v))}>
              <SelectTrigger className="mt-2"><SelectValue /></SelectTrigger>
              <SelectContent>
                {STATS_FREQ_OPTIONS.map((o) => (
                  <SelectItem key={o.v} value={String(o.v)}>{o.l}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div>
          <Label className="section-heading">Platforms to scan</Label>
          <div className="mt-2 flex gap-6">
            {["YouTube", "Instagram"].map((p) => (
              <label key={p} className="flex items-center gap-2 text-sm">
                <Checkbox checked={platforms.includes(p)} onCheckedChange={() => togglePlatform(p)} />
                {p}
              </label>
            ))}
          </div>
          {platforms.includes("Instagram") && (
            <div className="mt-2 flex items-start gap-2 text-xs text-muted-foreground">
              <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" /> Instagram scanning runs via external Python script. The in-app scanner handles YouTube only.
            </div>
          )}
        </div>

        <div className="flex items-center justify-between rounded-lg border p-4">
          <div>
            <div className="font-medium">Auto-approve known creators</div>
            <div className="text-sm text-muted-foreground">
              Auto-create campaigns when a video matches a known influencer's channel.
            </div>
          </div>
          <Switch checked={autoApprove} onCheckedChange={setAutoApprove} />
        </div>

        <div className="flex justify-end">
          <Button onClick={save} disabled={saving} className="btn-neon-cyan gap-2">
            {saving && <Loader2 className="h-4 w-4 animate-spin" />} Save Settings
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

/* ---------- Scan History ---------- */
function ScanHistory({
  logs, page, setPage, pageSize,
}: {
  logs: ScanLogRow[];
  page: number;
  setPage: (n: number) => void;
  pageSize: number;
}) {
  const [expanded, setExpanded] = useState<string | null>(null);
  const totalPages = Math.max(1, Math.ceil(logs.length / pageSize));
  const slice = logs.slice((page - 1) * pageSize, page * pageSize);

  const duration = (a?: string | null, b?: string | null) => {
    if (!a || !b) return "—";
    const ms = new Date(b).getTime() - new Date(a).getTime();
    if (ms < 0) return "—";
    if (ms < 60000) return `${Math.round(ms / 1000)}s`;
    return `${Math.round(ms / 60000)}m`;
  };

  const statusBadge = (s: string) => {
    if (s === "completed") return <Badge className="bg-success/15 text-success hover:bg-success/20">Completed</Badge>;
    if (s === "failed") return <Badge className="bg-destructive/15 text-destructive hover:bg-destructive/20">Failed</Badge>;
    return <Badge className="bg-warning/15 text-warning hover:bg-warning/20"><Clock className="h-3 w-3" />Running</Badge>;
  };

  return (
    <Card>
      <CardHeader><CardTitle>Scan History</CardTitle></CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Date/time</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Found</TableHead>
              <TableHead className="text-right">New</TableHead>
              <TableHead className="text-right">Stats</TableHead>
              <TableHead>Duration</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {slice.length === 0 && (
              <TableRow><TableCell colSpan={7} className="py-8 text-center text-muted-foreground">No scans yet. Click 'Run Scan Now' to start.</TableCell></TableRow>
            )}
            {slice.map((l) => (
              <>
                <TableRow
                  key={l.id}
                  className={l.error_message ? "cursor-pointer" : ""}
                  onClick={() => l.error_message && setExpanded(expanded === l.id ? null : l.id)}
                >
                  <TableCell>{l.started_at ? new Date(l.started_at).toLocaleString("cs-CZ") : "—"}</TableCell>
                  <TableCell><Badge variant="outline">{l.scan_type}</Badge></TableCell>
                  <TableCell>{statusBadge(l.status)}</TableCell>
                  <TableCell className="text-right">{formatNumber(l.videos_found)}</TableCell>
                  <TableCell className="text-right">{formatNumber(l.videos_new)}</TableCell>
                  <TableCell className="text-right">{formatNumber(l.stats_updated)}</TableCell>
                  <TableCell>{duration(l.started_at, l.completed_at)}</TableCell>
                </TableRow>
                {expanded === l.id && l.error_message && (
                  <TableRow key={`${l.id}-err`}>
                    <TableCell colSpan={7} className="bg-destructive/10 text-sm text-destructive">
                      {l.error_message}
                    </TableCell>
                  </TableRow>
                )}
              </>
            ))}
          </TableBody>
        </Table>

        {logs.length > pageSize && (
          <div className="mt-4 flex items-center justify-between">
            <div className="text-sm text-muted-foreground">Page {page} of {totalPages}</div>
            <div className="flex gap-2">
              <Button size="sm" variant="outline" onClick={() => setPage(Math.max(1, page - 1))} disabled={page === 1}>Prev</Button>
              <Button size="sm" variant="outline" onClick={() => setPage(Math.min(totalPages, page + 1))} disabled={page === totalPages}>Next</Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
