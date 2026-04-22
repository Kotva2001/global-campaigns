import { useEffect, useMemo, useState } from "react";
import { ExternalLink, Instagram, Mail, MoreVertical, PauseCircle, Pencil, PlayCircle, Plus, Trash2, Youtube } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { CreatorDialog } from "@/components/CreatorDialog";
import { CampaignDialog } from "@/components/CampaignDialog";
import { InfluencerDetailPanel } from "@/components/InfluencerDetailPanel";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { COUNTRIES, COUNTRY_FLAGS, COUNTRY_NAMES } from "@/lib/countries";
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
  active: { label: "Active", cls: "bg-success/15 text-success" },
  paused: { label: "Paused", cls: "bg-warning/15 text-warning" },
  ended: { label: "Ended", cls: "bg-muted text-muted-foreground" },
};

const num = (value: unknown): number | null => {
  const next = typeof value === "number" ? value : Number(value);
  return Number.isFinite(next) ? next : null;
};

const normalizePlatform = (raw: string): Platform => {
  const value = raw.toLowerCase();
  if (value.includes("insta")) return "Instagram";
  if (value.includes("short")) return "YB Shorts";
  if (value.includes("tik")) return "TikTok";
  if (value.includes("you") || value.includes("yt")) return "YouTube";
  return "Other";
};

const formatDate = (iso: string | null) => {
  if (!iso) return "";
  const date = new Date(`${iso}T00:00:00`);
  return Number.isNaN(date.getTime()) ? iso : date.toLocaleDateString("cs-CZ");
};

const mapCampaign = (row: CampaignRow, influencer: InfluencerRecord): CampaignEntry => ({
  id: row.id,
  influencerId: row.influencer_id,
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

  const load = async () => {
    setLoading(true);
    const [{ data: infl, error: inflError }, { data: camps, error: campError }] = await Promise.all([
      supabase.from("influencers").select("*").order("name"),
      supabase.from("campaigns").select("*").order("publish_date", { ascending: false, nullsFirst: false }),
    ]);
    if (inflError) toast.error(inflError.message);
    if (campError) toast.error(campError.message);
    const creatorRows = (infl ?? []) as InfluencerRecord[];
    const byId = new Map(creatorRows.map((creator) => [creator.id, creator]));
    setInfluencers(creatorRows);
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

  const openCreate = () => { setEditing(null); setCreatorOpen(true); };
  const openCampaign = (creatorId: string) => { setEditingCampaign(null); setCampaignInfluencerId(creatorId); setCampaignOpen(true); };

  const togglePause = async (creator: InfluencerRecord) => {
    const next = creator.status === "active" ? "paused" : "active";
    const { error } = await supabase.from("influencers").update({ status: next }).eq("id", creator.id);
    if (error) return toast.error(error.message);
    toast.success(next === "paused" ? "Creator paused" : "Creator resumed");
    void load();
  };

  const deleteCreator = async () => {
    if (!confirmDelete) return;
    const { error } = await supabase.from("influencers").delete().eq("id", confirmDelete.id);
    if (error) return toast.error(error.message);
    toast.success("Creator deleted");
    setConfirmDelete(null);
    setDetailCreator(null);
    void load();
  };

  return (
    <div>
      <header className="sticky top-0 z-20 border-b border-border bg-background/80 backdrop-blur">
        <div className="flex items-center justify-between gap-4 px-6 py-4">
          <div><h1 className="text-lg font-bold tracking-tight">Creators</h1><p className="text-xs text-muted-foreground">Roster of influencers across markets</p></div>
          <Button className="gap-2" onClick={openCreate}><Plus className="h-4 w-4" /> Add Creator</Button>
        </div>
        <div className="flex gap-2 overflow-x-auto px-6 pb-3">
          <CountryTab active={country === "All"} onClick={() => setCountry("All")} flag="🌍" code="All" />
          {COUNTRIES.map((code) => <CountryTab key={code} active={country === code} onClick={() => setCountry(code)} flag={COUNTRY_FLAGS[code]} code={code} />)}
        </div>
        <div className="flex flex-wrap items-center gap-3 px-6 pb-4">
          <Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search by name or contact…" className="min-w-[220px] flex-1" />
          <Select value={status} onValueChange={setStatus}><SelectTrigger className="w-[140px]"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="All">All statuses</SelectItem><SelectItem value="active">Active</SelectItem><SelectItem value="paused">Paused</SelectItem><SelectItem value="ended">Ended</SelectItem></SelectContent></Select>
          <span className="text-xs text-muted-foreground">{filtered.length} creator{filtered.length === 1 ? "" : "s"}</span>
        </div>
      </header>

      <div className="px-6 py-6">
        {loading ? <div className="text-sm text-muted-foreground">Loading…</div> : filtered.length === 0 ? <EmptyState country={country} onAdd={openCreate} /> : (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
            {filtered.map((creator) => <CreatorCard key={creator.id} creator={creator} campaigns={campaignGroups.get(creator.id) ?? []} onOpen={() => setDetailCreator(creator)} onAddCampaign={() => openCampaign(creator.id)} onEdit={() => { setEditing(creator); setCreatorOpen(true); }} onTogglePause={() => togglePause(creator)} onDelete={() => setConfirmDelete(creator)} />)}
          </div>
        )}
      </div>

      <CreatorDialog open={creatorOpen} onOpenChange={setCreatorOpen} editing={editing} onSaved={() => { setCreatorOpen(false); void load(); }} />
      <CampaignDialog open={campaignOpen} onOpenChange={setCampaignOpen} editing={editingCampaign} initialInfluencerId={campaignInfluencerId} onSaved={() => { setCampaignOpen(false); setEditingCampaign(null); void load(); }} />
      <InfluencerDetailPanel creator={detailCreator} campaigns={detailCreator ? campaignGroups.get(detailCreator.id) ?? [] : []} onClose={() => setDetailCreator(null)} onEditInfluencer={() => { setEditing(detailCreator); setCreatorOpen(true); }} onAddCampaign={() => detailCreator && openCampaign(detailCreator.id)} onEditCampaign={(campaign) => { setEditingCampaign(campaign); setCampaignOpen(true); }} onChanged={load} />

      <AlertDialog open={!!confirmDelete} onOpenChange={(open) => !open && setConfirmDelete(null)}>
        <AlertDialogContent><AlertDialogHeader><AlertDialogTitle>Delete {confirmDelete?.name} and all their campaigns?</AlertDialogTitle><AlertDialogDescription>This permanently removes the creator and every linked campaign.</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel>Cancel</AlertDialogCancel><AlertDialogAction onClick={deleteCreator} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">Delete</AlertDialogAction></AlertDialogFooter></AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

const CountryTab = ({ active, onClick, flag, code }: { active: boolean; onClick: () => void; flag: string; code: string }) => <button onClick={onClick} className={cn("flex shrink-0 items-center gap-1.5 rounded-md border px-3 py-1.5 text-sm transition-colors", active ? "border-primary bg-primary/10 text-foreground" : "border-border text-muted-foreground hover:text-foreground")}><span>{flag}</span><span className="font-medium">{code}</span></button>;

const EmptyState = ({ country, onAdd }: { country: string; onAdd: () => void }) => <div className="flex min-h-[40vh] items-center justify-center"><Card className="border-dashed border-border bg-card/40 p-10 text-center"><div className="text-3xl">🌱</div><div className="mt-2 text-sm font-medium">No creators in {country === "All" ? "any market" : COUNTRY_NAMES[country]} yet</div><Button className="mt-4 gap-2" onClick={onAdd}><Plus className="h-4 w-4" /> Add your first creator</Button></Card></div>;

const CreatorCard = ({ creator, campaigns, onOpen, onAddCampaign, onEdit, onTogglePause, onDelete }: { creator: InfluencerRecord; campaigns: CampaignEntry[]; onOpen: () => void; onAddCampaign: () => void; onEdit: () => void; onTogglePause: () => void; onDelete: () => void }) => {
  const kpis = computeKPIs(campaigns);
  const meta = STATUS_META[creator.status];
  return <Card onClick={onOpen} className="group cursor-pointer border-border bg-card p-4 transition-all hover:-translate-y-0.5 hover:border-primary/40 hover:bg-card-hover hover:shadow-lg"><div className="flex items-start justify-between gap-2"><button className="min-w-0 flex-1 text-left"><div className="truncate text-base font-bold">{creator.name}</div><div className="mt-0.5 flex items-center gap-1.5 text-xs text-muted-foreground"><span>{COUNTRY_FLAGS[creator.country] ?? "🏳️"}</span><span>{creator.country}</span><span>·</span><span className={cn("rounded-full px-2 py-0.5 text-[10px] font-semibold", meta.cls)}>{meta.label}</span></div></button><Button variant="secondary" size="icon" className="h-8 w-8" onClick={(event) => { event.stopPropagation(); onAddCampaign(); }}><Plus className="h-4 w-4" /></Button><DropdownMenu><DropdownMenuTrigger asChild><Button variant="ghost" size="icon" className="h-8 w-8" onClick={(event) => event.stopPropagation()}><MoreVertical className="h-4 w-4" /></Button></DropdownMenuTrigger><DropdownMenuContent align="end"><DropdownMenuItem onClick={(event) => { event.stopPropagation(); onEdit(); }}><Pencil className="mr-2 h-4 w-4" /> Edit</DropdownMenuItem><DropdownMenuItem onClick={(event) => { event.stopPropagation(); onTogglePause(); }}>{creator.status === "active" ? <><PauseCircle className="mr-2 h-4 w-4" /> Pause</> : <><PlayCircle className="mr-2 h-4 w-4" /> Resume</>}</DropdownMenuItem><DropdownMenuSeparator /><DropdownMenuItem onClick={(event) => { event.stopPropagation(); onDelete(); }} className="text-destructive focus:text-destructive"><Trash2 className="mr-2 h-4 w-4" /> Delete</DropdownMenuItem></DropdownMenuContent></DropdownMenu></div><CreatorLinks creator={creator} /><div className="mt-4 grid grid-cols-3 gap-2 border-t border-border pt-3 text-xs"><Stat label="Campaigns" value={String(campaigns.length)} /><Stat label="Views" value={formatCompact(kpis.totalViews)} /><Stat label="ROI" value={formatPercent(kpis.roi)} valueClass={kpis.roi && kpis.roi > 0 ? "text-success" : undefined} /></div><div className="mt-3 text-xs font-medium text-primary opacity-0 transition-opacity group-hover:opacity-100">View details →</div></Card>;
};

const CreatorLinks = ({ creator }: { creator: InfluencerRecord }) => <div className="mt-3 space-y-1 text-xs">{creator.youtube_channel_url && <a href={creator.youtube_channel_url} target="_blank" rel="noreferrer" className="flex items-center gap-1 truncate text-muted-foreground hover:text-foreground"><Youtube className="h-3 w-3" /><ExternalLink className="h-3 w-3" /><span className="truncate">{creator.youtube_channel_url.replace(/^https?:\/\//, "")}</span></a>}{creator.instagram_handle && <a href={`https://instagram.com/${creator.instagram_handle.replace(/^@/, "")}`} target="_blank" rel="noreferrer" className="flex items-center gap-1 text-muted-foreground hover:text-foreground"><Instagram className="h-3 w-3" /><span>@{creator.instagram_handle.replace(/^@/, "")}</span></a>}{(creator.contact_person || creator.contact_email) && <div className="flex items-center gap-1 text-muted-foreground"><Mail className="h-3 w-3" /><span className="truncate">{creator.contact_person}{creator.contact_person && creator.contact_email ? " · " : ""}{creator.contact_email}</span></div>}</div>;

const Stat = ({ label, value, valueClass }: { label: string; value: string; valueClass?: string }) => <div className="rounded-md bg-muted/40 p-2"><div className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</div><div className={cn("text-sm font-bold", valueClass)}>{value}</div></div>;

export default Creators;
