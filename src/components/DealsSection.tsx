import { useEffect, useMemo, useState } from "react";
import { ChevronDown, ChevronRight, Edit3, Package, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { toastError } from "@/lib/toast-helpers";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { DealDialog } from "@/components/DealDialog";
import { formatCurrency } from "@/lib/formatters";
import { cn } from "@/lib/utils";
import type { CurrencyCode } from "@/lib/currency";
import type { CampaignEntry } from "@/types/campaign";
import type { DealRecord } from "@/types/deal";

interface Props {
  influencerId: string;
  campaigns: CampaignEntry[];
  onChanged?: () => void;
}

interface DealRow extends DealRecord {
  product_name: string | null;
}

export const DealsSection = ({ influencerId, campaigns, onChanged }: Props) => {
  const [deals, setDeals] = useState<DealRow[]>([]);
  const [open, setOpen] = useState<Record<string, boolean>>({});
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<DealRecord | null>(null);
  const [deletingDeal, setDeletingDeal] = useState<DealRow | null>(null);

  const load = async () => {
    const { data, error } = await supabase
      .from("deals")
      .select("id,influencer_id,product_id,deal_name,total_cost,currency,collaboration_type,notes,created_at,products(name)")
      .eq("influencer_id", influencerId)
      .order("created_at", { ascending: false });
    if (error) { toastError("Could not load deals", error); return; }
    setDeals((data ?? []).map((d: any) => ({
      id: d.id,
      influencer_id: d.influencer_id,
      product_id: d.product_id,
      deal_name: d.deal_name,
      total_cost: Number(d.total_cost) || 0,
      currency: d.currency,
      collaboration_type: d.collaboration_type,
      notes: d.notes,
      created_at: d.created_at,
      product_name: d.products?.name ?? null,
    })));
  };

  useEffect(() => { void load(); }, [influencerId]);

  const campaignsByDeal = useMemo(() => {
    const m = new Map<string, CampaignEntry[]>();
    for (const c of campaigns) {
      if (!c.dealId) continue;
      if (!m.has(c.dealId)) m.set(c.dealId, []);
      m.get(c.dealId)!.push(c);
    }
    return m;
  }, [campaigns]);

  const removeDeal = async () => {
    if (!deletingDeal) return;
    const { error } = await supabase.from("deals").delete().eq("id", deletingDeal.id);
    if (error) return toastError("Could not delete deal", error);
    toast.success("Deal deleted");
    setDeletingDeal(null);
    await load();
    onChanged?.();
  };

  return (
    <>
      <div className="mt-5">
        <div className="mb-2 flex items-center justify-between">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Deals</h3>
          <Button size="sm" variant="secondary" className="gap-2" onClick={() => { setEditing(null); setDialogOpen(true); }}>
            <Plus className="h-4 w-4" /> Add Deal
          </Button>
        </div>
        {deals.length === 0 ? (
          <Card className="border-dashed border-border bg-card/40 p-4 text-center text-xs text-muted-foreground">
            No deals yet. Add one to bundle multiple campaigns under a single product shipment.
          </Card>
        ) : (
          <div className="grid gap-2 sm:grid-cols-2">
            {deals.map((d) => {
              const linked = campaignsByDeal.get(d.id) ?? [];
              const split = linked.length > 0 ? d.total_cost / linked.length : d.total_cost;
              const isOpen = !!open[d.id];
              return (
                <Card key={d.id} className="overflow-hidden border-border bg-card">
                  <button
                    onClick={() => setOpen((prev) => ({ ...prev, [d.id]: !prev[d.id] }))}
                    className="flex w-full items-start gap-2 p-3 text-left hover:bg-card-hover"
                  >
                    {isOpen ? <ChevronDown className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" /> : <ChevronRight className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />}
                    <Package className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm font-semibold">{d.deal_name || d.product_name || "Untitled deal"}</div>
                      <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px] text-muted-foreground">
                        <span className="font-medium tabular-nums text-foreground">{formatCurrency(d.total_cost, d.currency)}</span>
                        <span>·</span>
                        <span>{linked.length} campaign{linked.length === 1 ? "" : "s"}</span>
                        {linked.length > 0 && <><span>·</span><span>{formatCurrency(split, d.currency)} each</span></>}
                        {d.collaboration_type && <><span>·</span><span>{d.collaboration_type}</span></>}
                        {d.created_at && <><span>·</span><span>{new Date(d.created_at).toLocaleDateString("cs-CZ")}</span></>}
                      </div>
                    </div>
                    <div className="flex shrink-0 gap-0.5" onClick={(e) => e.stopPropagation()}>
                      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => { setEditing(d); setDialogOpen(true); }}>
                        <Edit3 className="h-3.5 w-3.5" />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:text-destructive" onClick={() => setDeletingDeal(d)}>
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </button>
                  {isOpen && (
                    <div className="border-t border-border bg-muted/20 px-3 py-2 text-xs">
                      {linked.length === 0 ? (
                        <div className="text-muted-foreground">No campaigns linked yet. Use the “Deal” column in the campaigns table.</div>
                      ) : (
                        <ul className="space-y-1">
                          {linked.map((c) => (
                            <li key={c.id} className="flex items-center justify-between gap-2">
                              <span className="truncate">
                                <span className="text-muted-foreground">{c.publishDate || "—"} ·</span>{" "}
                                <span className="font-medium">{c.campaignName || "Untitled"}</span>{" "}
                                <span className="text-muted-foreground">({c.platform})</span>
                              </span>
                              <span className="shrink-0 tabular-nums text-muted-foreground">{formatCurrency(c.campaignCost, c.currency)}</span>
                            </li>
                          ))}
                        </ul>
                      )}
                      {d.notes && <div className="mt-2 border-t border-border/60 pt-2 text-muted-foreground">{d.notes}</div>}
                    </div>
                  )}
                </Card>
              );
            })}
          </div>
        )}
      </div>

      <DealDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        influencerId={influencerId}
        editing={editing}
        onSaved={() => { void load(); onChanged?.(); }}
      />

      <AlertDialog open={!!deletingDeal} onOpenChange={(o) => !o && setDeletingDeal(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this deal?</AlertDialogTitle>
            <AlertDialogDescription>
              Linked campaigns will be unlinked but not deleted. Their cost values will remain at the last split amount until edited.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction className="bg-destructive text-destructive-foreground hover:bg-destructive/90" onClick={removeDeal}>Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};
