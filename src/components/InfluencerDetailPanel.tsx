import { useMemo, useState } from "react";
import { Edit3, Pencil, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { toastError } from "@/lib/toast-helpers";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { PlatformLinkIcon } from "@/components/PlatformLinkIcon";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { COUNTRY_FLAGS, COUNTRY_NAMES } from "@/lib/countries";
import { computeKPIs } from "@/lib/calculations";
import { formatCompact, formatCurrency, formatNumber, formatPercent } from "@/lib/formatters";
import type { CurrencyCode, ExchangeRates } from "@/lib/currency";
import { cn } from "@/lib/utils";
import type { CampaignEntry, InfluencerRecord } from "@/types/campaign";

interface Props {
  creator: InfluencerRecord | null;
  campaigns: CampaignEntry[];
  onClose: () => void;
  onEditInfluencer?: () => void;
  onAddCampaign?: () => void;
  onEditCampaign?: (campaign: CampaignEntry) => void;
  onChanged?: () => void;
  displayCurrency?: CurrencyCode;
  rates?: ExchangeRates;
}

const STATUS_META = {
  active: { label: "Active", cls: "bg-success/15 text-success" },
  paused: { label: "Paused", cls: "bg-warning/15 text-warning" },
  ended: { label: "Ended", cls: "bg-muted text-muted-foreground" },
};

const platformBadge = (platform: string) => {
  const cls = platform === "YouTube"
    ? "bg-[hsl(var(--platform-youtube)/0.15)] text-[hsl(var(--platform-youtube))]"
    : platform === "Instagram"
      ? "bg-[hsl(var(--platform-instagram)/0.15)] text-[hsl(var(--platform-instagram))]"
      : "bg-[hsl(var(--platform-shorts)/0.15)] text-[hsl(var(--platform-shorts))]";
  return <span className={cn("rounded-full px-2 py-0.5 text-[10px] font-semibold", cls)}>{platform}</span>;
};

const collabBadge = (collab: string) => {
  const value = collab.toLowerCase();
  const cls = value.includes("paid")
    ? "bg-[hsl(var(--collab-paid)/0.15)] text-[hsl(var(--collab-paid))]"
    : value.includes("barter")
      ? "bg-[hsl(var(--collab-barter)/0.15)] text-[hsl(var(--collab-barter))]"
      : "bg-muted text-muted-foreground";
  return collab ? <span className={cn("rounded-full px-2 py-0.5 text-[10px] font-semibold", cls)}>{collab}</span> : <span className="text-muted-foreground">—</span>;
};

const EditableNumber = ({ value, campaignId, field, onChanged }: { value: number | null; campaignId: string; field: "views" | "likes" | "comments"; onChanged?: () => void }) => {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(String(value ?? 0));

  const save = async () => {
    const next = Number(draft);
    if (!Number.isFinite(next) || next < 0) {
      toast.error("Enter a valid number");
      return;
    }
    const payload = field === "views" ? { views: next } : field === "likes" ? { likes: next } : { comments: next };
    const { error } = await supabase.from("campaigns").update(payload).eq("id", campaignId);
    if (error) return toastError("Action failed", error);
    setEditing(false);
    toast.success("Stat updated");
    onChanged?.();
  };

  if (editing) {
    return (
      <Input
        autoFocus
        type="number"
        min="0"
        value={draft}
        onChange={(event) => setDraft(event.target.value)}
        onBlur={save}
        onKeyDown={(event) => {
          if (event.key === "Enter") void save();
          if (event.key === "Escape") setEditing(false);
        }}
        className="h-8 w-24 text-right"
      />
    );
  }

  return (
    <button onClick={() => setEditing(true)} className="group ml-auto flex items-center gap-1 tabular-nums text-muted-foreground hover:text-foreground">
      {formatNumber(value)} <Pencil className="h-3 w-3 opacity-0 transition-opacity group-hover:opacity-60" />
    </button>
  );
};

export const InfluencerDetailPanel = ({ creator, campaigns, onClose, onEditInfluencer, onAddCampaign, onEditCampaign, onChanged, displayCurrency = "CZK", rates }: Props) => {
  const [deleteCampaign, setDeleteCampaign] = useState<CampaignEntry | null>(null);
  const kpis = useMemo(() => computeKPIs(campaigns, displayCurrency, rates), [campaigns, displayCurrency, rates]);
  const platforms = useMemo(() => {
    const fromCreator = creator?.platforms?.filter(Boolean) ?? [];
    const fromCampaigns = campaigns.map((campaign) => campaign.platform).filter(Boolean);
    return Array.from(new Set([...fromCreator, ...fromCampaigns]));
  }, [campaigns, creator?.platforms]);
  const status = creator ? STATUS_META[creator.status] ?? STATUS_META.active : STATUS_META.active;

  const deleteOne = async () => {
    if (!deleteCampaign) return;
    const { error } = await supabase.from("campaigns").delete().eq("id", deleteCampaign.id);
    if (error) return toast.error(error.message);
    toast.success("Campaign deleted");
    setDeleteCampaign(null);
    onChanged?.();
  };

  return (
    <>
      <Sheet open={!!creator} onOpenChange={(open) => !open && onClose()}>
        <SheetContent side="right" className="flex w-[95vw] flex-col overflow-hidden border-border bg-background p-0 sm:max-w-none md:w-[60vw]">
          {creator && (
            <>
              <SheetHeader className="border-b border-border px-6 py-5">
                <div className="flex items-start justify-between gap-4 pr-8">
                  <div className="min-w-0">
                    <SheetTitle className="truncate text-2xl font-bold">{creator.name}</SheetTitle>
                    <div className="mt-2 flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
                      <span>{COUNTRY_FLAGS[creator.country] ?? "🏳️"} {creator.country}</span>
                      <span className={cn("rounded-full px-2 py-0.5 text-[10px] font-semibold", status.cls)}>{status.label}</span>
                      {platforms.map((platform) => <span key={platform}>{platformBadge(platform)}</span>)}
                    </div>
                  </div>
                  {onEditInfluencer && <Button size="sm" variant="secondary" className="gap-2" onClick={onEditInfluencer}><Edit3 className="h-4 w-4" /> Edit Influencer</Button>}
                </div>
              </SheetHeader>

              <div className="min-h-0 flex-1 overflow-y-auto px-6 py-5">
                <div className="grid grid-cols-2 gap-3 lg:grid-cols-6">
                  <Stat label="Campaigns" value={String(campaigns.length)} />
                  <Stat label="Views" value={formatCompact(kpis.totalViews)} />
                  <Stat label="Spend" value={formatCurrency(kpis.totalSpend, displayCurrency)} />
                  <Stat label="Revenue" value={formatCurrency(kpis.totalRevenue, displayCurrency)} valueClass={kpis.totalRevenue > 0 ? "text-success" : undefined} />
                  <Stat label="ROI" value={formatPercent(kpis.roi)} valueClass={kpis.roi == null ? undefined : kpis.roi >= 0 ? "text-success" : "text-destructive"} />
                  <Stat label="Avg. engagement" value={formatPercent(kpis.avgEngagement)} />
                </div>

                <Card className="mt-5 overflow-hidden border-border bg-card">
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead className="sticky top-0 z-10 bg-muted/60 backdrop-blur">
                        <tr className="border-b border-border">
                          {['Date', 'Campaign', 'Platform', 'Collab', 'Link', 'Views', 'Likes', 'Comments', 'Cost', 'Revenue', 'Engagement', 'Conversion', ''].map((head) => (
                            <th key={head} className="whitespace-nowrap px-3 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{head}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {campaigns.map((campaign) => (
                          <tr key={campaign.id} className="border-b border-border/60 transition-colors hover:bg-card-hover">
                            <td className="whitespace-nowrap px-3 py-2.5 text-muted-foreground">{campaign.publishDate || "—"}</td>
                            <td className="max-w-[220px] truncate px-3 py-2.5 font-medium">{campaign.campaignName || "—"}</td>
                            <td className="whitespace-nowrap px-3 py-2.5">{platformBadge(campaign.platform)}</td>
                            <td className="whitespace-nowrap px-3 py-2.5">{collabBadge(campaign.collaborationType)}</td>
                            <td className="px-3 py-2.5">
                              <PlatformLinkIcon platform={campaign.platform} url={campaign.videoLink} />
                            </td>
                            <td className="whitespace-nowrap px-3 py-2.5 text-right"><EditableNumber value={campaign.views} campaignId={campaign.id} field="views" onChanged={onChanged} /></td>
                            <td className="whitespace-nowrap px-3 py-2.5 text-right"><EditableNumber value={campaign.likes} campaignId={campaign.id} field="likes" onChanged={onChanged} /></td>
                            <td className="whitespace-nowrap px-3 py-2.5 text-right"><EditableNumber value={campaign.comments} campaignId={campaign.id} field="comments" onChanged={onChanged} /></td>
                            <td className="whitespace-nowrap px-3 py-2.5 text-right tabular-nums">{formatCurrency(campaign.campaignCost, campaign.currency)}</td>
                            <td className="whitespace-nowrap px-3 py-2.5 text-right tabular-nums">{formatCurrency(campaign.purchaseRevenue, campaign.currency)}</td>
                            <td className="whitespace-nowrap px-3 py-2.5 text-right tabular-nums text-muted-foreground">{formatPercent(campaign.engagementRate)}</td>
                            <td className="whitespace-nowrap px-3 py-2.5 text-right tabular-nums text-muted-foreground">{formatPercent(campaign.conversionRate)}</td>
                            <td className="whitespace-nowrap px-3 py-2.5">
                              <div className="flex justify-end gap-1">
                                <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => onEditCampaign?.(campaign)}><Edit3 className="h-4 w-4" /></Button>
                                <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive" onClick={() => setDeleteCampaign(campaign)}><Trash2 className="h-4 w-4" /></Button>
                              </div>
                            </td>
                          </tr>
                        ))}
                        {!campaigns.length && <tr><td colSpan={13} className="px-3 py-10 text-center text-muted-foreground">No campaigns yet.</td></tr>}
                      </tbody>
                    </table>
                  </div>
                </Card>
              </div>

              <div className="border-t border-border px-6 py-4">
                <Button className="gap-2" onClick={onAddCampaign}><Plus className="h-4 w-4" /> Add Campaign</Button>
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>

      <AlertDialog open={!!deleteCampaign} onOpenChange={(open) => !open && setDeleteCampaign(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this campaign?</AlertDialogTitle>
            <AlertDialogDescription>Delete this campaign by {deleteCampaign?.influencer} for {deleteCampaign?.campaignName || "—"} on {deleteCampaign?.publishDate || "—"}?</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction className="bg-destructive text-destructive-foreground hover:bg-destructive/90" onClick={deleteOne}>Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};

const Stat = ({ label, value, valueClass }: { label: string; value: string; valueClass?: string }) => (
  <div className="rounded-md bg-muted/40 p-3">
    <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</div>
    <div className={cn("mt-1 text-sm font-bold tabular-nums", valueClass)}>{value}</div>
  </div>
);
