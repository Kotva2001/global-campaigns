import { useEffect, useMemo, useState } from "react";
import { ArrowRight, ExternalLink, Instagram, Mail, Merge, MoreVertical, PauseCircle, Pencil, PlayCircle, Plus, Trash2, TrendingDown, TrendingUp, Youtube } from "lucide-react";
import { toast } from "sonner";
import { toastError } from "@/lib/toast-helpers";
import { supabase } from "@/integrations/supabase/client";
import { CreatorDialog } from "@/components/CreatorDialog";
import { CampaignDialog } from "@/components/CampaignDialog";
import { InfluencerDetailPanel } from "@/components/InfluencerDetailPanel";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Skeleton } from "@/components/ui/skeleton";
import { COUNTRIES, COUNTRY_FLAGS, COUNTRY_NAMES } from "@/lib/countries";
import { instagramHandlesFromValue } from "@/lib/instagram";
import { computeKPIs } from "@/lib/calculations";
import { formatCompact, formatPercent } from "@/lib/formatters";
import { cn } from "@/lib/utils";
import type { CampaignEntry, InfluencerRecord, Platform } from "@/types/campaign";

interface CampaignRow {
  id: string;
  influencer_id: string | null;
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

const STATUS_META = {
  active: { label: "Active", dot: "hsl(var(--success))", cls: "bg-success/15 text-success border border-success/40" },
  paused: { label: "Paused", dot: "hsl(var(--warning))", cls: "bg-warning/15 text-warning border border-warning/40" },
  ended:  { label: "Ended",  dot: "hsl(var(--destructive))", cls: "bg-destructive/15 text-destructive border border-destructive/40" },
};

/** Resolve the platform color tokens for a creator's "top" platform. */
const platformAccent = (platform: Platform | "Mixed" | null) => {
  switch (platform) {
    case "YouTube":   return { hue: "var(--platform-youtube)",   label: "YouTube"   };
    case "Instagram": return { hue: "var(--platform-instagram)", label: "Instagram" };
    case "YB Shorts": return { hue: "var(--platform-shorts)",    label: "YB Shorts" };
    case "Story":     return { hue: "var(--platform-story)",     label: "Story"     };
    default:          return { hue: "var(--platform-story)",     label: "Mixed"     };
  }
};

/** Pick the platform with the most campaigns; null if none. Returns "Mixed" when 2+ platforms tied/ranked together. */
const topPlatformOf = (campaigns: CampaignEntry[]): Platform | "Mixed" | null => {
  if (!campaigns.length) return null;
  const counts = new Map<Platform, number>();
  for (const c of campaigns) counts.set(c.platform, (counts.get(c.platform) ?? 0) + 1);
  if (counts.size > 1) return "Mixed";
  return [...counts.keys()][0];
};

/** Tiny SVG sparkline of views across last N campaigns (oldest -> newest). */
const Sparkline = ({ values, color }: { values: number[]; color: string }) => {
  if (values.length < 2) return <div className="h-6 w-[72px]" />;
  const w = 72, h = 24;
  const max = Math.max(...values, 1);
  const min = Math.min(...values, 0);
  const range = max - min || 1;
  const step = w / (values.length - 1);
  const pts = values.map((v, i) => {
    const x = i * step;
    const y = h - ((v - min) / range) * (h - 4) - 2;
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  });
  const path = `M ${pts.join(" L ")}`;
  const area = `${path} L ${w},${h} L 0,${h} Z`;
  const id = `spark-${Math.random().toString(36).slice(2, 8)}`;
  return (
    <svg width={w} height={h} className="overflow-visible">
      <defs>
        <linearGradient id={id} x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.45" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={area} fill={`url(#${id})`} />
      <path d={path} fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
};

const num = (value: unknown): number | null => {
  const next = typeof value === "number" ? value : Number(value);
  return Number.isFinite(next) ? next : null;
};

const normalizePlatform = (raw: string): Platform => {
  const value = raw.toLowerCase();
  if (value === "story" || value.includes("storie")) return "Story";
  if (value.includes("insta")) return "Instagram";
  if (value.includes("short")) return "YB Shorts";
  return "YouTube";
};

const formatDate = (iso: string | null) => {
  if (!iso) return "";
  const date = new Date(`${iso}T00:00:00`);
  return Number.isNaN(date.getTime()) ? iso : date.toLocaleDateString("cs-CZ");
};

const mapCampaign = (row: CampaignRow, influencer: InfluencerRecord): CampaignEntry => ({
  id: row.id,
  influencerId: row.influencer_id,
  dealId: null,
  country: influencer.country,
  influencer: influencer.name,
  campaignName: row.campaign_name ?? "",
  platform: normalizePlatform(row.platform),
  publishDate: formatDate(row.publish_date),
  publishDateIso: row.publish_date,
  videoLink: row.video_url ?? "",
  collaborationType: row.collaboration_type ?? "",
  currency: row.currency === "EUR" || row.currency === "HUF" || row.currency === "RON" ? row.currency : "CZK",
  campaignCost: num(row.campaign_cost),
  utmLink: row.utm_link ?? "",
  managedBy: row.managed_by ?? "",
  views: num(row.views),
  likes: num(row.likes),
  comments: num(row.comments),
  sessions: num(row.sessions),
  engagementRate: num(row.engagement_rate),
  purchaseRevenue: num(row.purchase_revenue),
  conversionRate: num(row.conversion_rate),
});

const Creators = () => {
  const [influencers, setInfluencers] = useState<InfluencerRecord[]>([]);
  const [campaigns, setCampaigns] = useState<CampaignEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [country, setCountry] = useState("All");
  const [status, setStatus] = useState("All");
  const [search, setSearch] = useState("");
  const [editing, setEditing] = useState<InfluencerRecord | null>(null);
  const [creatorOpen, setCreatorOpen] = useState(false);
  const [campaignOpen, setCampaignOpen] = useState(false);
  const [campaignInfluencerId, setCampaignInfluencerId] = useState<string | null>(null);
  const [editingCampaign, setEditingCampaign] = useState<CampaignEntry | null>(null);
  const [detailCreator, setDetailCreator] = useState<InfluencerRecord | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<InfluencerRecord | null>(null);
  const [selectedCreators, setSelectedCreators] = useState<string[]>([]);
  const [mergeOpen, setMergeOpen] = useState(false);
  const [keepCreatorId, setKeepCreatorId] = useState<string>("");

  const load = async () => {
    setLoading(true);
    const [{ data: infl, error: inflError }, { data: camps, error: campError }] = await Promise.all([
      supabase.from("influencers").select("*").order("name"),
      supabase.from("campaigns").select("*").order("publish_date", { ascending: false, nullsFirst: false }),
    ]);
    if (inflError) toastError("Could not load creators", inflError);
    if (campError) toastError("Could not load campaigns", campError);
    const creatorRows = (infl ?? []) as InfluencerRecord[];
    const byId = new Map(creatorRows.map((creator) => [creator.id, creator]));
    setInfluencers(creatorRows);
    setSelectedCreators((current) => current.filter((id) => creatorRows.some((creator) => creator.id === id)));
    setCampaigns(((camps ?? []) as CampaignRow[]).flatMap((campaign) => {
      const creator = campaign.influencer_id ? byId.get(campaign.influencer_id) : undefined;
      return creator ? [mapCampaign(campaign, creator)] : [];
    }));
    setLoading(false);
  };

  useEffect(() => { void load(); }, []);

  const campaignGroups = useMemo(() => {
    const map = new Map<string, CampaignEntry[]>();
    campaigns.forEach((campaign) => {
      if (!campaign.influencerId) return;
      map.set(campaign.influencerId, [...(map.get(campaign.influencerId) ?? []), campaign]);
    });
    return map;
  }, [campaigns]);

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();
    return influencers.filter((creator) => {
      if (country !== "All" && creator.country !== country) return false;
      if (status !== "All" && creator.status !== status) return false;
      return !query || creator.name.toLowerCase().includes(query) || (creator.contact_person ?? "").toLowerCase().includes(query);
    });
  }, [country, influencers, search, status]);

  const summary = useMemo(() => {
    let totalCampaigns = 0;
    let totalViews = 0;
    let maxCampaigns = 0;
    for (const c of filtered) {
      const cs = campaignGroups.get(c.id) ?? [];
      totalCampaigns += cs.length;
      maxCampaigns = Math.max(maxCampaigns, cs.length);
      for (const r of cs) totalViews += r.views ?? 0;
    }
    return { totalCreators: filtered.length, totalCampaigns, totalViews, maxCampaigns };
  }, [filtered, campaignGroups]);

  const openCreate = () => { setEditing(null); setCreatorOpen(true); };
  const openCampaign = (creatorId: string) => { setEditingCampaign(null); setCampaignInfluencerId(creatorId); setCampaignOpen(true); };

  const toggleSelectedCreator = (creatorId: string, checked: boolean) => {
    setSelectedCreators((current) => checked ? [...current.filter((id) => id !== creatorId), creatorId].slice(-2) : current.filter((id) => id !== creatorId));
  };

  const openMerge = () => {
    if (selectedCreators.length !== 2) return;
    setKeepCreatorId(selectedCreators[0]);
    setMergeOpen(true);
  };

  const mergeCreators = async () => {
    const [firstId, secondId] = selectedCreators;
    if (!firstId || !secondId || !keepCreatorId) return;
    const deleteId = keepCreatorId === firstId ? secondId : firstId;
    const kept = influencers.find((creator) => creator.id === keepCreatorId);
    const deleted = influencers.find((creator) => creator.id === deleteId);
    const { error: campaignError } = await supabase.from("campaigns").update({ influencer_id: keepCreatorId }).eq("influencer_id", deleteId);
    if (campaignError) return toastError("Could not reassign campaigns", campaignError);
    const { error: deleteError } = await supabase.from("influencers").delete().eq("id", deleteId);
    if (deleteError) return toastError("Could not delete duplicate creator", deleteError);
    toast.success(`Merged ${deleted?.name ?? "creator"} into ${kept?.name ?? "selected creator"}`);
    setMergeOpen(false);
    setSelectedCreators([]);
    setDetailCreator((current) => current?.id === deleteId ? null : current);
    void load();
  };

  const togglePause = async (creator: InfluencerRecord) => {
    const next = creator.status === "active" ? "paused" : "active";
    const { error } = await supabase.from("influencers").update({ status: next }).eq("id", creator.id);
    if (error) return toastError("Could not update creator", error);
    toast.success(next === "paused" ? "Creator paused" : "Creator resumed");
    void load();
  };

  const deleteCreator = async () => {
    if (!confirmDelete) return;
    const { error } = await supabase.from("influencers").delete().eq("id", confirmDelete.id);
    if (error) return toastError("Could not delete creator", error);
    toast.success("Creator deleted");
    setConfirmDelete(null);
    setDetailCreator(null);
    void load();
  };

  return (
    <div>
      <header className="sticky top-0 z-20 border-b border-border bg-background/80 backdrop-blur">
        <div className="flex items-center justify-between gap-4 px-6 py-4">
          <div>
            <h1 className="page-title text-lg">Creators</h1>
            <p className="text-xs text-muted-foreground">Roster of influencers across markets</p>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="secondary" className="btn-neon-pink gap-2" onClick={openMerge} disabled={selectedCreators.length !== 2}><Merge className="h-4 w-4" /> Merge creators</Button>
            <Button className="btn-neon-cyan gap-2" onClick={openCreate}><Plus className="h-4 w-4" /> Add Creator</Button>
          </div>
        </div>
        <div className="flex gap-2 overflow-x-auto px-6 pb-3">
          <CountryTab active={country === "All"} onClick={() => setCountry("All")} flag="🌍" code="All" />
          {COUNTRIES.map((code) => <CountryTab key={code} active={country === code} onClick={() => setCountry(code)} flag={COUNTRY_FLAGS[code]} code={code} />)}
        </div>
        <div className="flex flex-wrap items-center gap-3 px-6 pb-4">
          <Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search by name or contact…" className="input-neon min-w-[280px] flex-1" />
          <Select value={status} onValueChange={setStatus}><SelectTrigger className="w-[140px]"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="All">All statuses</SelectItem><SelectItem value="active">Active</SelectItem><SelectItem value="paused">Paused</SelectItem><SelectItem value="ended">Ended</SelectItem></SelectContent></Select>
        </div>
        <div className="px-6 pb-4">
          <div
            className="flex flex-wrap items-center gap-x-5 gap-y-1 rounded-lg px-4 py-2.5 text-xs"
            style={{ background: "hsl(248 50% 9% / 0.7)", border: "1px solid hsl(var(--glow-cyan) / 0.18)" }}
          >
            <span><span className="neon-number text-sm">{summary.totalCreators}</span> <span className="stat-label ml-1">creators</span></span>
            <span className="text-muted-foreground/40">·</span>
            <span><span className="neon-number text-sm">{summary.totalCampaigns}</span> <span className="stat-label ml-1">campaigns</span></span>
            <span className="text-muted-foreground/40">·</span>
            <span><span className="neon-number text-sm">{formatCompact(summary.totalViews)}</span> <span className="stat-label ml-1">total views</span></span>
          </div>
        </div>
      </header>

      <div className="px-6 py-6">
        {loading ? <CreatorGridSkeleton /> : filtered.length === 0 ? <EmptyState country={country} onAdd={openCreate} /> : (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
            {filtered.map((creator, i) => (
              <CreatorCard
                key={creator.id}
                creator={creator}
                campaigns={campaignGroups.get(creator.id) ?? []}
                maxCampaigns={summary.maxCampaigns || 1}
                index={i}
                selected={selectedCreators.includes(creator.id)}
                onSelect={(checked) => toggleSelectedCreator(creator.id, checked)}
                onOpen={() => setDetailCreator(creator)}
                onAddCampaign={() => openCampaign(creator.id)}
                onEdit={() => { setEditing(creator); setCreatorOpen(true); }}
                onTogglePause={() => togglePause(creator)}
                onDelete={() => setConfirmDelete(creator)}
              />
            ))}
          </div>
        )}
      </div>

      <CreatorDialog open={creatorOpen} onOpenChange={setCreatorOpen} editing={editing} onSaved={() => { setCreatorOpen(false); void load(); }} />
      <CampaignDialog open={campaignOpen} onOpenChange={setCampaignOpen} editing={editingCampaign} initialInfluencerId={campaignInfluencerId} onSaved={() => { setCampaignOpen(false); setEditingCampaign(null); void load(); }} />
      <InfluencerDetailPanel creator={detailCreator} campaigns={detailCreator ? campaignGroups.get(detailCreator.id) ?? [] : []} onClose={() => setDetailCreator(null)} onEditInfluencer={() => { setEditing(detailCreator); setCreatorOpen(true); }} onAddCampaign={() => detailCreator && openCampaign(detailCreator.id)} onEditCampaign={(campaign) => { setEditingCampaign(campaign); setCampaignOpen(true); }} onChanged={load} />

      <AlertDialog open={mergeOpen} onOpenChange={setMergeOpen}>
        <AlertDialogContent><AlertDialogHeader><AlertDialogTitle>Merge selected creators?</AlertDialogTitle><AlertDialogDescription>Choose which profile to keep. Campaigns from the other creator will be reassigned before that duplicate is deleted.</AlertDialogDescription></AlertDialogHeader><div className="space-y-2 py-2"><Select value={keepCreatorId} onValueChange={setKeepCreatorId}><SelectTrigger><SelectValue placeholder="Creator to keep" /></SelectTrigger><SelectContent>{selectedCreators.map((id) => { const creator = influencers.find((row) => row.id === id); return creator ? <SelectItem key={id} value={id}>Keep {creator.name} ({creator.country})</SelectItem> : null; })}</SelectContent></Select></div><AlertDialogFooter><AlertDialogCancel>Cancel</AlertDialogCancel><AlertDialogAction onClick={mergeCreators}>Merge creators</AlertDialogAction></AlertDialogFooter></AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={!!confirmDelete} onOpenChange={(open) => !open && setConfirmDelete(null)}>
        <AlertDialogContent><AlertDialogHeader><AlertDialogTitle>Delete {confirmDelete?.name} and all their campaigns?</AlertDialogTitle><AlertDialogDescription>This permanently removes the creator and every linked campaign.</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel>Cancel</AlertDialogCancel><AlertDialogAction onClick={deleteCreator} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">Delete</AlertDialogAction></AlertDialogFooter></AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

const CountryTab = ({ active, onClick, flag, code }: { active: boolean; onClick: () => void; flag: string; code: string }) => (
  <button
    onClick={onClick}
    className={cn(
      "flex shrink-0 items-center gap-1.5 rounded-md px-3 py-1.5 text-sm transition-all",
      active
        ? "bg-[hsl(var(--glow-cyan))] text-[hsl(var(--background))] shadow-[0_0_12px_hsl(var(--glow-cyan)/0.55)]"
        : "border border-[hsl(var(--glow-purple)/0.20)] text-muted-foreground hover:text-foreground hover:border-[hsl(var(--glow-cyan)/0.40)]",
    )}
  >
    <span className="text-[16px] leading-none">{flag}</span>
    <span className="font-medium">{code}</span>
  </button>
);

const EmptyState = ({ country, onAdd }: { country: string; onAdd: () => void }) => <div className="flex min-h-[40vh] items-center justify-center"><Card className="border-dashed border-border bg-card/40 p-10 text-center"><div className="text-3xl">🌱</div><div className="mt-2 text-sm font-medium">No creators in {country === "All" ? "any market" : COUNTRY_NAMES[country]} yet</div><Button className="mt-4 gap-2" onClick={onAdd}><Plus className="h-4 w-4" /> Add your first creator</Button></Card></div>;

const CreatorGridSkeleton = () => (
  <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
    {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-64 bg-card" />)}
  </div>
);

const CreatorCard = ({
  creator, campaigns, maxCampaigns, index, selected, onSelect, onOpen, onAddCampaign, onEdit, onTogglePause, onDelete,
}: {
  creator: InfluencerRecord; campaigns: CampaignEntry[]; maxCampaigns: number; index: number;
  selected: boolean; onSelect: (checked: boolean) => void; onOpen: () => void;
  onAddCampaign: () => void; onEdit: () => void; onTogglePause: () => void; onDelete: () => void;
}) => {
  const kpis = computeKPIs(campaigns);
  const meta = STATUS_META[creator.status];
  const hasCampaigns = campaigns.length > 0;
  const top = topPlatformOf(campaigns);
  const accent = platformAccent(top);
  const accentVar = `hsl(${accent.hue})`;

  // Sparkline of views across most recent 5 campaigns (chronological).
  const sparkValues = useMemo(() => {
    const sorted = [...campaigns]
      .filter((c) => c.publishDateIso)
      .sort((a, b) => (a.publishDateIso! < b.publishDateIso! ? -1 : 1))
      .slice(-5)
      .map((c) => c.views ?? 0);
    return sorted;
  }, [campaigns]);

  // Trend arrow based on first half vs last half of sparkline values.
  const trend = useMemo(() => {
    if (sparkValues.length < 2) return null;
    const mid = Math.floor(sparkValues.length / 2);
    const a = sparkValues.slice(0, mid).reduce((s, v) => s + v, 0) / Math.max(mid, 1);
    const b = sparkValues.slice(mid).reduce((s, v) => s + v, 0) / (sparkValues.length - mid);
    if (b > a * 1.05) return "up";
    if (b < a * 0.95) return "down";
    return null;
  }, [sparkValues]);

  // "Recently active" — any campaign in the last 30 days.
  const recentlyActive = useMemo(() => {
    const cutoff = Date.now() - 30 * 24 * 60 * 60 * 1000;
    return campaigns.some((c) => c.publishDateIso && new Date(c.publishDateIso).getTime() >= cutoff);
  }, [campaigns]);

  const initial = (creator.name?.trim()?.[0] ?? "?").toUpperCase();

  return (
    <Card
      onClick={onOpen}
      className="group relative cursor-pointer overflow-hidden p-4 pl-5 transition-all duration-200 animate-fade-in-up hover:-translate-y-1"
      style={{
        animationDelay: `${index * 30}ms`,
        background: `linear-gradient(90deg, ${accentVar.replace(")", " / 0.08)").replace("hsl(", "hsla(")}, transparent 60%), hsl(240 45% 9%)`,
        border: "1px solid hsl(var(--glow-purple) / 0.18)",
        boxShadow: `inset 4px 0 0 ${accentVar}`,
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.boxShadow = `inset 4px 0 0 ${accentVar}, 0 0 24px ${accentVar.replace(")", " / 0.30)").replace("hsl(", "hsla(")}`;
        e.currentTarget.style.borderColor = accentVar.replace(")", " / 0.45)").replace("hsl(", "hsla(");
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.boxShadow = `inset 4px 0 0 ${accentVar}`;
        e.currentTarget.style.borderColor = "hsl(var(--glow-purple) / 0.18)";
      }}
    >
      {/* Top row: avatar + identity + actions */}
      <div className="flex items-start gap-3">
        {/* Avatar */}
        <div className="relative shrink-0">
          <div
            className="flex h-10 w-10 items-center justify-center rounded-full text-sm font-bold text-white transition-all group-hover:animate-pulse"
            style={{
              background: `linear-gradient(135deg, ${accentVar}, ${accentVar.replace(")", " / 0.55)").replace("hsl(", "hsla(")})`,
              boxShadow: `0 0 12px ${accentVar.replace(")", " / 0.45)").replace("hsl(", "hsla(")}`,
            }}
          >
            {initial}
          </div>
          {/* Merge selection: subtle, only on hover (or when selected) */}
          <div
            onClick={(e) => e.stopPropagation()}
            className={cn(
              "absolute -left-1 -top-1 transition-opacity",
              selected ? "opacity-100" : "opacity-0 group-hover:opacity-100",
            )}
          >
            <Checkbox
              checked={selected}
              onCheckedChange={(checked) => onSelect(!!checked)}
              aria-label={`Select ${creator.name} for merge`}
              className="h-4 w-4 rounded-full border-[hsl(var(--glow-cyan))] bg-background"
            />
          </div>
        </div>

        {/* Identity */}
        <button className="min-w-0 flex-1 text-left">
          <div className="flex items-center gap-2">
            <span className="text-[24px] leading-none shrink-0" title={creator.country}>
              {COUNTRY_FLAGS[creator.country] ?? "🏳️"}
            </span>
            <div className="truncate text-base font-bold text-white">{creator.name}</div>
            {recentlyActive && (
              <span
                className="inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wider"
                style={{
                  background: "hsl(var(--success) / 0.12)",
                  color: "hsl(var(--success))",
                  border: "1px solid hsl(var(--success) / 0.45)",
                  boxShadow: "0 0 8px hsl(var(--success) / 0.35)",
                }}
                title="Campaign in last 30 days"
              >
                <span className="h-1.5 w-1.5 rounded-full bg-[hsl(var(--success))] shadow-[0_0_6px_hsl(var(--success))]" />
                Recent
              </span>
            )}
          </div>
          <div className="mt-0.5 flex items-center gap-2 text-xs text-muted-foreground">
            <span className="font-medium tracking-wider">{creator.country}</span>
            <span className="text-muted-foreground/40">·</span>
            <span
              className={cn("inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold", meta.cls)}
            >
              <span className="h-1.5 w-1.5 rounded-full" style={{ background: meta.dot, boxShadow: `0 0 6px ${meta.dot}` }} />
              {meta.label}
            </span>
          </div>
        </button>

        {/* Actions */}
        <div className="flex items-center gap-1">
          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="ghost" size="icon" className="h-8 w-8 text-[hsl(var(--glow-cyan))] hover:bg-[hsl(var(--glow-cyan)/0.12)]" onClick={(event) => { event.stopPropagation(); onAddCampaign(); }}>
                <Plus className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Add campaign</TooltipContent>
          </Tooltip>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 opacity-0 transition-opacity group-hover:opacity-100 data-[state=open]:opacity-100"
                onClick={(event) => event.stopPropagation()}
              >
                <MoreVertical className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={(event) => { event.stopPropagation(); onOpen(); }}><ExternalLink className="mr-2 h-4 w-4" /> View campaigns</DropdownMenuItem>
              <DropdownMenuItem onClick={(event) => { event.stopPropagation(); onEdit(); }}><Pencil className="mr-2 h-4 w-4" /> Edit</DropdownMenuItem>
              <DropdownMenuItem onClick={(event) => { event.stopPropagation(); onTogglePause(); }}>{creator.status === "active" ? <><PauseCircle className="mr-2 h-4 w-4" /> Pause</> : <><PlayCircle className="mr-2 h-4 w-4" /> Resume</>}</DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={(event) => { event.stopPropagation(); onDelete(); }} className="text-destructive focus:text-destructive"><Trash2 className="mr-2 h-4 w-4" /> Delete</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* Links (Instagram handles + YouTube channel) */}
      <CreatorLinks creator={creator} />

      {/* Stats */}
      {hasCampaigns ? (
        <div className="mt-4 space-y-3" style={{ borderTop: "1px solid hsl(var(--glow-purple) / 0.18)", paddingTop: "12px" }}>
          {/* Hero: Views + sparkline + trend */}
          <div className="flex items-end justify-between gap-3">
            <div className="min-w-0">
              <div className="stat-label">Views</div>
              <div className="flex items-baseline gap-2">
                <div className="neon-number text-2xl leading-none">{formatCompact(kpis.totalViews)}</div>
                {trend === "up" && <TrendingUp className="h-4 w-4 text-[hsl(var(--success))] drop-shadow-[0_0_6px_hsl(var(--success)/0.6)]" />}
                {trend === "down" && <TrendingDown className="h-4 w-4 text-[hsl(var(--glow-pink))] drop-shadow-[0_0_6px_hsl(var(--glow-pink)/0.6)]" />}
              </div>
            </div>
            <div className="shrink-0">
              <Sparkline values={sparkValues} color={accentVar} />
            </div>
          </div>

          {/* Campaigns bar + ROI pill */}
          <div className="flex items-center gap-3">
            <div className="min-w-0 flex-1">
              <div className="flex items-baseline justify-between">
                <span className="stat-label">Campaigns</span>
                <span className="text-xs font-bold text-foreground tabular-nums">{campaigns.length}</span>
              </div>
              <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-[hsl(var(--glow-purple)/0.15)]">
                <div
                  className="h-full rounded-full transition-all"
                  style={{
                    width: `${Math.min(100, (campaigns.length / maxCampaigns) * 100)}%`,
                    background: "linear-gradient(90deg, hsl(var(--glow-cyan)), hsl(var(--glow-cyan) / 0.6))",
                    boxShadow: "0 0 8px hsl(var(--glow-cyan) / 0.45)",
                  }}
                />
              </div>
            </div>
            <div>
              <div className="stat-label text-right">ROI</div>
              <RoiPill roi={kpis.roi} />
            </div>
          </div>

          {/* Spend → Revenue */}
          <div className="flex items-center justify-between text-xs">
            <div>
              <span className="stat-label">Spend</span>
              <div className="font-bold text-muted-foreground">{formatCompact(kpis.totalSpend)}</div>
            </div>
            <ArrowRight className="h-4 w-4 text-[hsl(var(--glow-cyan)/0.7)]" />
            <div className="text-right">
              <span className="stat-label">Revenue</span>
              <div className={cn("font-bold", kpis.totalRevenue > 0 ? "neon-number-green" : "text-muted-foreground")}>
                {formatCompact(kpis.totalRevenue)}
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div
          className="mt-4 flex flex-col items-center justify-center gap-1 rounded-md py-5 text-center"
          style={{ border: "1px dashed hsl(var(--glow-purple) / 0.30)", background: "hsl(248 50% 8% / 0.5)" }}
        >
          <div
            className="flex h-7 w-7 items-center justify-center rounded-full"
            style={{ background: "hsl(var(--glow-cyan) / 0.10)", border: "1px solid hsl(var(--glow-cyan) / 0.30)" }}
          >
            <Plus className="h-3.5 w-3.5 text-[hsl(var(--glow-cyan))]" />
          </div>
          <div className="text-xs text-muted-foreground">No campaigns yet</div>
        </div>
      )}

      <div className="mt-3 text-xs font-medium text-[hsl(var(--glow-cyan))] opacity-0 transition-opacity group-hover:opacity-100">
        View details →
      </div>
    </Card>
  );
};

const RoiPill = ({ roi }: { roi: number | null | undefined }) => {
  if (roi == null) {
    return (
      <span className="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-bold text-muted-foreground" style={{ background: "hsl(240 30% 14%)", border: "1px solid hsl(var(--glow-purple) / 0.20)" }}>
        —
      </span>
    );
  }
  const positive = roi >= 0;
  return (
    <span
      className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-bold tabular-nums"
      style={{
        background: positive ? "hsl(var(--success) / 0.15)" : "hsl(var(--glow-pink) / 0.15)",
        color: positive ? "hsl(var(--success))" : "hsl(var(--glow-pink))",
        border: `1px solid ${positive ? "hsl(var(--success) / 0.50)" : "hsl(var(--glow-pink) / 0.50)"}`,
        boxShadow: `0 0 8px ${positive ? "hsl(var(--success) / 0.35)" : "hsl(var(--glow-pink) / 0.35)"}`,
      }}
    >
      {positive ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
      {formatPercent(roi)}
    </span>
  );
};

const CreatorLinks = ({ creator }: { creator: InfluencerRecord }) => {
  const handles = instagramHandlesFromValue(creator.instagram_handle);
  const channelSnippet = creator.youtube_channel_url?.replace(/^https?:\/\/(www\.)?/, "").replace(/^youtube\.com\//, "");
  return (
    <div className="mt-3 space-y-2 text-xs">
      <div className="flex flex-wrap gap-1.5">
        {handles.map((handle) => (
          <a
            key={handle}
            href={`https://instagram.com/${handle}`}
            target="_blank"
            rel="noreferrer"
            onClick={(event) => event.stopPropagation()}
            className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[hsl(var(--glow-cyan)/0.85)] transition-all hover:text-[hsl(var(--glow-cyan))]"
            style={{ background: "hsl(var(--glow-cyan) / 0.08)", border: "1px solid hsl(var(--glow-cyan) / 0.25)" }}
          >
            <Instagram className="h-3 w-3" />@{handle}
          </a>
        ))}
        {creator.youtube_channel_url && (
          <a
            href={creator.youtube_channel_url}
            target="_blank"
            rel="noreferrer"
            onClick={(event) => event.stopPropagation()}
            className="inline-flex max-w-full items-center gap-1 rounded-full px-2 py-0.5 text-[hsl(var(--platform-youtube)/0.95)] transition-all hover:text-[hsl(var(--platform-youtube))]"
            style={{ background: "hsl(var(--platform-youtube) / 0.10)", border: "1px solid hsl(var(--platform-youtube) / 0.35)" }}
          >
            <Youtube className="h-3 w-3" /><span className="truncate">{channelSnippet}</span>
          </a>
        )}
      </div>
      {(creator.contact_person || creator.contact_email) && (
        <div className="flex items-center gap-1 text-muted-foreground/80">
          <Mail className="h-3 w-3" />
          <span className="truncate">{creator.contact_person}{creator.contact_person && creator.contact_email ? " · " : ""}{creator.contact_email}</span>
        </div>
      )}
    </div>
  );
};

export default Creators;
