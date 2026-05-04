import { useEffect, useMemo, useState } from "react";
import { Check, Edit3, Eye, Pencil, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { toastError } from "@/lib/toast-helpers";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { PlatformLinkIcon } from "@/components/PlatformLinkIcon";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
import type { TablesUpdate } from "@/integrations/supabase/types";
import type { ProductRecord } from "@/types/product";
import { DealsSection } from "@/components/DealsSection";
import { DealCell } from "@/components/DealCell";
import { QuickStoryDialog } from "@/components/QuickStoryDialog";
import { CreatorPerformancePanel } from "@/components/CreatorPerformancePanel";

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
  if (platform === "Story") {
    return (
      <span className={cn("inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold", "bg-[hsl(var(--platform-story)/0.18)] text-[hsl(var(--platform-story))]")}>
        <Eye className="h-3 w-3" /> Story
      </span>
    );
  }
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

type SavedFlash = string;

const PLATFORM_OPTIONS = ["YouTube", "Instagram", "YB Shorts", "Story"] as const;
const COLLAB_OPTIONS = ["Paid", "Barter", "Hybrid", "Other"] as const;

type EditableNumberField = "views" | "likes" | "comments" | "campaignCost" | "purchaseRevenue";

const FIELD_TO_COLUMN: Record<EditableNumberField, "views" | "likes" | "comments" | "campaign_cost" | "purchase_revenue"> = {
  views: "views",
  likes: "likes",
  comments: "comments",
  campaignCost: "campaign_cost",
  purchaseRevenue: "purchase_revenue",
};

const updateCampaign = async (
  campaignId: string,
  payload: TablesUpdate<"campaigns">,
  cellKey: string,
  flash: (key: string) => void,
  onChanged?: () => void,
) => {
  const { error } = await supabase.from("campaigns").update(payload).eq("id", campaignId);
  if (error) return toastError("Could not save change", error);
  flash(cellKey);
  onChanged?.();
};

const SavedCheck = ({ show }: { show: boolean }) => (
  <span
    className={cn(
      "pointer-events-none absolute -right-1 -top-1 flex h-4 w-4 items-center justify-center rounded-full bg-success text-[hsl(var(--success-foreground,0_0%_100%))] transition-opacity",
      show ? "opacity-100" : "opacity-0",
    )}
  >
    <Check className="h-3 w-3" />
  </span>
);

const EditableNumberCell = ({
  value,
  campaignId,
  field,
  currency,
  flashed,
  flash,
  onChanged,
  formatAs,
}: {
  value: number | null;
  campaignId: string;
  field: EditableNumberField;
  currency?: CurrencyCode;
  flashed: boolean;
  flash: (key: string) => void;
  onChanged?: () => void;
  formatAs: "number" | "currency";
}) => {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(String(value ?? 0));
  const cellKey = `${campaignId}:${field}`;

  useEffect(() => { if (!editing) setDraft(String(value ?? 0)); }, [value, editing]);

  const save = async () => {
    const next = Number(draft);
    if (!Number.isFinite(next) || next < 0) {
      toast.error("Enter a valid number");
      setEditing(false);
      setDraft(String(value ?? 0));
      return;
    }
    setEditing(false);
    if (next === (value ?? 0)) return;
    await updateCampaign(campaignId, { [FIELD_TO_COLUMN[field]]: next } as TablesUpdate<"campaigns">, cellKey, flash, onChanged);
  };

  if (editing) {
    return (
      <Input
        autoFocus
        type="number"
        min="0"
        step={formatAs === "currency" ? "0.01" : "1"}
        value={draft}
        onChange={(event) => setDraft(event.target.value)}
        onBlur={save}
        onKeyDown={(event) => {
          if (event.key === "Enter") void save();
          if (event.key === "Escape") { setEditing(false); setDraft(String(value ?? 0)); }
        }}
        className="h-8 w-28 text-right"
      />
    );
  }

  const display = formatAs === "currency"
    ? formatCurrency(value, currency ?? "CZK")
    : formatNumber(value);

  return (
    <button
      onClick={() => setEditing(true)}
      className="group relative ml-auto flex items-center gap-1 tabular-nums text-muted-foreground hover:text-foreground"
    >
      {display}
      <Pencil className="h-3 w-3 opacity-0 transition-opacity group-hover:opacity-60" />
      <SavedCheck show={flashed} />
    </button>
  );
};

const EditableSelectCell = ({
  value,
  options,
  campaignId,
  column,
  flashed,
  flash,
  onChanged,
  renderDisplay,
}: {
  value: string;
  options: readonly string[];
  campaignId: string;
  column: "platform" | "collaboration_type";
  flashed: boolean;
  flash: (key: string) => void;
  onChanged?: () => void;
  renderDisplay: (value: string) => React.ReactNode;
}) => {
  const cellKey = `${campaignId}:${column}`;
  const onChange = async (next: string) => {
    if (next === value) return;
    await updateCampaign(campaignId, { [column]: next } as TablesUpdate<"campaigns">, cellKey, flash, onChanged);
  };
  return (
    <div className="relative inline-block">
      <Select value={value || undefined} onValueChange={onChange}>
        <SelectTrigger className="h-7 w-auto border-none bg-transparent px-2 py-0 text-xs font-semibold shadow-none hover:bg-muted/50 focus:ring-0 focus:ring-offset-0 [&>svg]:hidden">
          <SelectValue>{renderDisplay(value)}</SelectValue>
        </SelectTrigger>
        <SelectContent>
          {options.map((option) => <SelectItem key={option} value={option}>{option}</SelectItem>)}
        </SelectContent>
      </Select>
      <SavedCheck show={flashed} />
    </div>
  );
};

const CampaignNameCell = ({
  value,
  campaignId,
  products,
  flashed,
  flash,
  onChanged,
}: {
  value: string;
  campaignId: string;
  products: ProductRecord[];
  flashed: boolean;
  flash: (key: string) => void;
  onChanged?: () => void;
}) => {
  const [editing, setEditing] = useState(false);
  const [customMode, setCustomMode] = useState(false);
  const [draft, setDraft] = useState(value);
  const cellKey = `${campaignId}:campaign_name`;

  useEffect(() => { if (!editing) setDraft(value); }, [value, editing]);

  const matchingProduct = products.find((p) => p.name.toLowerCase() === value.toLowerCase());

  const pickProduct = async (productId: string) => {
    if (productId === "__custom__") {
      setCustomMode(true);
      setEditing(true);
      setDraft(value);
      return;
    }
    const product = products.find((p) => p.id === productId);
    if (!product) return;
    setEditing(false);
    setCustomMode(false);
    await updateCampaign(
      campaignId,
      { campaign_name: product.name, campaign_cost: product.cost, currency: product.currency },
      cellKey,
      flash,
      onChanged,
    );
  };

  const saveCustom = async () => {
    const next = draft.trim();
    setEditing(false);
    setCustomMode(false);
    if (next === value) return;
    await updateCampaign(campaignId, { campaign_name: next || null }, cellKey, flash, onChanged);
  };

  if (editing && customMode) {
    return (
      <Input
        autoFocus
        value={draft}
        onChange={(event) => setDraft(event.target.value)}
        onBlur={saveCustom}
        onKeyDown={(event) => {
          if (event.key === "Enter") void saveCustom();
          if (event.key === "Escape") { setEditing(false); setCustomMode(false); setDraft(value); }
        }}
        className="h-8 w-full"
        placeholder="Custom campaign name"
      />
    );
  }

  return (
    <div className="relative inline-block max-w-[220px]">
      <Select value={matchingProduct?.id ?? "__custom_current__"} onValueChange={pickProduct}>
        <SelectTrigger className="h-7 w-full max-w-[220px] truncate border-none bg-transparent px-2 py-0 text-sm font-medium shadow-none hover:bg-muted/50 focus:ring-0 focus:ring-offset-0 [&>svg]:hidden">
          <SelectValue>
            <span className="truncate">{value || <span className="text-muted-foreground">— select —</span>}</span>
          </SelectValue>
        </SelectTrigger>
        <SelectContent className="max-h-[280px]">
          {!matchingProduct && value && (
            <SelectItem value="__custom_current__">{value} (custom)</SelectItem>
          )}
          {products.map((product) => (
            <SelectItem key={product.id} value={product.id}>
              {product.name}
              {product.sku ? <span className="ml-2 text-xs text-muted-foreground">({product.sku})</span> : null}
            </SelectItem>
          ))}
          <SelectItem value="__custom__">✏️ Custom…</SelectItem>
        </SelectContent>
      </Select>
      <SavedCheck show={flashed} />
    </div>
  );
};

export const InfluencerDetailPanel = ({ creator, campaigns, onClose, onEditInfluencer, onAddCampaign, onEditCampaign, onChanged, displayCurrency = "CZK", rates }: Props) => {
  const [deleteCampaign, setDeleteCampaign] = useState<CampaignEntry | null>(null);
  const [products, setProducts] = useState<ProductRecord[]>([]);
  const [flashedCells, setFlashedCells] = useState<Record<string, number>>({});
  const [storyOpen, setStoryOpen] = useState(false);

  useEffect(() => {
    if (!creator) return;
    let active = true;
    void supabase
      .from("products")
      .select("*")
      .order("name")
      .then(({ data }) => { if (active) setProducts((data ?? []) as ProductRecord[]); });
    return () => { active = false; };
  }, [creator]);

  const flash = (key: string) => {
    const ts = Date.now();
    setFlashedCells((prev) => ({ ...prev, [key]: ts }));
    setTimeout(() => {
      setFlashedCells((prev) => (prev[key] === ts ? (() => { const next = { ...prev }; delete next[key]; return next; })() : prev));
    }, 1200);
  };

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
                <div className="grid grid-cols-2 gap-3 lg:grid-cols-7">
                  <Stat label="Campaigns" value={String(kpis.campaigns)} />
                  <Stat label="Stories" value={String(kpis.stories)} valueClass="text-[hsl(var(--platform-story))]" />
                  <Stat label="Views" value={formatCompact(kpis.totalViews)} />
                  <Stat label="Spend" value={formatCurrency(kpis.totalSpend, displayCurrency)} />
                  <Stat label="Revenue" value={formatCurrency(kpis.totalRevenue, displayCurrency)} valueClass={kpis.totalRevenue > 0 ? "text-success" : undefined} />
                  <Stat label="ROI" value={formatPercent(kpis.roi)} valueClass={kpis.roi == null ? undefined : kpis.roi >= 0 ? "text-success" : "text-destructive"} />
                  <Stat label="Avg. engagement" value={formatPercent(kpis.avgEngagement)} />
                </div>

                <DealsSection influencerId={creator.id} campaigns={campaigns} onChanged={onChanged} />

                <CreatorPerformancePanel creatorId={creator.id} />

                <Card className="mt-5 overflow-hidden border-border bg-card">
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead className="sticky top-0 z-10 bg-muted/60 backdrop-blur">
                        <tr className="border-b border-border">
                          {['Date', 'Campaign', 'Platform', 'Collab', 'Link', 'Deal', 'Views', 'Likes', 'Comments', 'Cost', 'Revenue', 'Engagement', 'Conversion', ''].map((head) => (
                            <th key={head} className="whitespace-nowrap px-3 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{head}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {campaigns.map((campaign) => (
                          <tr key={campaign.id} className="border-b border-border/60 transition-colors hover:bg-card-hover">
                            <td className="whitespace-nowrap px-3 py-2.5 text-muted-foreground">{campaign.publishDate || "—"}</td>
                            <td className="px-3 py-2.5 font-medium">
                              <CampaignNameCell
                                value={campaign.campaignName}
                                campaignId={campaign.id}
                                products={products}
                                flashed={!!flashedCells[`${campaign.id}:campaign_name`]}
                                flash={flash}
                                onChanged={onChanged}
                              />
                            </td>
                            <td className="whitespace-nowrap px-3 py-2.5">
                              <EditableSelectCell
                                value={campaign.platform}
                                options={PLATFORM_OPTIONS}
                                campaignId={campaign.id}
                                column="platform"
                                flashed={!!flashedCells[`${campaign.id}:platform`]}
                                flash={flash}
                                onChanged={onChanged}
                                renderDisplay={(v) => platformBadge(v)}
                              />
                            </td>
                            <td className="whitespace-nowrap px-3 py-2.5">
                              <EditableSelectCell
                                value={campaign.collaborationType}
                                options={COLLAB_OPTIONS}
                                campaignId={campaign.id}
                                column="collaboration_type"
                                flashed={!!flashedCells[`${campaign.id}:collaboration_type`]}
                                flash={flash}
                                onChanged={onChanged}
                                renderDisplay={(v) => collabBadge(v)}
                              />
                            </td>
                            <td className="px-3 py-2.5">
                              <PlatformLinkIcon platform={campaign.platform} url={campaign.videoLink} />
                            </td>
                            <td className="px-3 py-2.5">
                              <DealCell campaignId={campaign.id} influencerId={creator.id} dealId={campaign.dealId} onChanged={onChanged} />
                            </td>
                            <td className="whitespace-nowrap px-3 py-2.5 text-right"><EditableNumberCell value={campaign.views} campaignId={campaign.id} field="views" formatAs="number" flashed={!!flashedCells[`${campaign.id}:views`]} flash={flash} onChanged={onChanged} /></td>
                            <td className="whitespace-nowrap px-3 py-2.5 text-right"><EditableNumberCell value={campaign.likes} campaignId={campaign.id} field="likes" formatAs="number" flashed={!!flashedCells[`${campaign.id}:likes`]} flash={flash} onChanged={onChanged} /></td>
                            <td className="whitespace-nowrap px-3 py-2.5 text-right"><EditableNumberCell value={campaign.comments} campaignId={campaign.id} field="comments" formatAs="number" flashed={!!flashedCells[`${campaign.id}:comments`]} flash={flash} onChanged={onChanged} /></td>
                            <td className="whitespace-nowrap px-3 py-2.5 text-right"><EditableNumberCell value={campaign.campaignCost} campaignId={campaign.id} field="campaignCost" currency={campaign.currency} formatAs="currency" flashed={!!flashedCells[`${campaign.id}:campaignCost`]} flash={flash} onChanged={onChanged} /></td>
                            <td className="whitespace-nowrap px-3 py-2.5 text-right"><EditableNumberCell value={campaign.purchaseRevenue} campaignId={campaign.id} field="purchaseRevenue" currency={campaign.currency} formatAs="currency" flashed={!!flashedCells[`${campaign.id}:purchaseRevenue`]} flash={flash} onChanged={onChanged} /></td>
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
                        {!campaigns.length && <tr><td colSpan={14} className="px-3 py-10 text-center text-muted-foreground">No campaigns yet.</td></tr>}
                      </tbody>
                    </table>
                  </div>
                </Card>
              </div>

              <div className="border-t border-border px-6 py-4">
                <div className="flex items-center gap-2">
                  <Button className="gap-2" onClick={onAddCampaign}><Plus className="h-4 w-4" /> Add Campaign</Button>
                  <Button variant="secondary" className="gap-2" onClick={() => setStoryOpen(true)}>
                    <Eye className="h-4 w-4 text-[hsl(var(--platform-story))]" /> Log Story
                  </Button>
                </div>
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>

      {creator && (
        <QuickStoryDialog
          open={storyOpen}
          onOpenChange={setStoryOpen}
          influencerId={creator.id}
          influencerName={creator.name}
          onSaved={() => { onChanged?.(); }}
        />
      )}

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
