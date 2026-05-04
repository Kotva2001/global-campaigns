import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { toastError } from "@/lib/toast-helpers";
import { recalcDealSplit, linkCampaignsToDeal } from "@/lib/deals";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { X, Search } from "lucide-react";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import type { CurrencyCode } from "@/lib/currency";
import type { ProductRecord } from "@/types/product";
import type { DealRecord } from "@/types/deal";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  influencerId: string;
  editing: DealRecord | null;
  onSaved: () => void;
}

const COLLAB_OPTIONS = ["Barter", "Paid", "Hybrid", "Other"] as const;
const CURRENCIES: CurrencyCode[] = ["CZK", "EUR", "HUF", "RON"];

export const DealDialog = ({ open, onOpenChange, influencerId, editing, onSaved }: Props) => {
  const [productId, setProductId] = useState<string | null>(null);
  const [selectedProduct, setSelectedProduct] = useState<ProductRecord | null>(null);
  const [productSearch, setProductSearch] = useState("");
  const [productResults, setProductResults] = useState<ProductRecord[]>([]);
  const [searching, setSearching] = useState(false);
  const [showResults, setShowResults] = useState(false);
  const [dealName, setDealName] = useState("");
  const [totalCost, setTotalCost] = useState("0");
  const [currency, setCurrency] = useState<CurrencyCode>("EUR");
  const [collab, setCollab] = useState<string>("Barter");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [linkPrompt, setLinkPrompt] = useState<{
    dealId: string;
    productLabel: string;
    candidateIds: string[];
  } | null>(null);
  const searchWrapRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) return;
    if (editing) {
      setProductId(editing.product_id);
      setDealName(editing.deal_name ?? "");
      setTotalCost(String(editing.total_cost ?? 0));
      setCurrency((editing.currency as CurrencyCode) ?? "EUR");
      setCollab(editing.collaboration_type ?? "Barter");
      setNotes(editing.notes ?? "");
      // Hydrate selected product chip
      if (editing.product_id) {
        void supabase.from("products").select("*").eq("id", editing.product_id).maybeSingle().then(({ data }) => {
          if (data) setSelectedProduct(data as ProductRecord);
        });
      } else {
        setSelectedProduct(null);
      }
    } else {
      setProductId(null);
      setSelectedProduct(null);
      setDealName("");
      setTotalCost("0");
      setCurrency("EUR");
      setCollab("Barter");
      setNotes("");
    }
    setProductSearch("");
    setProductResults([]);
    setShowResults(false);
  }, [editing, open]);

  // Debounced server-side search (name or SKU, diacritics-insensitive via unaccent-style fallback using ilike on both fields)
  useEffect(() => {
    if (!open) return;
    const q = productSearch.trim();
    if (q.length < 2) {
      setProductResults([]);
      setSearching(false);
      return;
    }
    setSearching(true);
    const handle = setTimeout(async () => {
      // Strip diacritics from query for a looser match against stored values.
      const stripped = q.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
      const patterns = Array.from(new Set([q, stripped])).map((s) => `%${s}%`);
      const orFilter = patterns
        .flatMap((p) => [`name.ilike.${p}`, `sku.ilike.${p}`])
        .join(",");
      const { data, error } = await supabase
        .from("products")
        .select("*")
        .or(orFilter)
        .order("name")
        .limit(20);
      if (!error) setProductResults((data ?? []) as ProductRecord[]);
      setSearching(false);
    }, 250);
    return () => clearTimeout(handle);
  }, [productSearch, open]);

  const pickProduct = (p: ProductRecord) => {
    setProductId(p.id);
    setSelectedProduct(p);
    setProductSearch("");
    setProductResults([]);
    setShowResults(false);
    if (!editing) {
      setTotalCost(String(p.cost ?? 0));
      setCurrency((p.currency as CurrencyCode) ?? "EUR");
    }
    if (!dealName) setDealName(p.name);
  };

  const clearProduct = () => {
    setProductId(null);
    setSelectedProduct(null);
  };

  const save = async () => {
    const cost = Number(totalCost);
    if (!Number.isFinite(cost) || cost < 0) {
      toast.error("Enter a valid total cost");
      return;
    }
    setSaving(true);
    try {
      const payload = {
        influencer_id: influencerId,
        product_id: productId,
        deal_name: dealName || null,
        total_cost: cost,
        currency,
        collaboration_type: collab,
        notes: notes || null,
      };
      if (editing) {
        const { error } = await supabase.from("deals").update(payload).eq("id", editing.id);
        if (error) throw error;
        await recalcDealSplit(editing.id);
        toast.success("Deal updated");
        onSaved();
        onOpenChange(false);
      } else {
        const { data: inserted, error } = await supabase
          .from("deals")
          .insert(payload)
          .select("id")
          .single();
        if (error) throw error;
        toast.success("Deal created");
        onOpenChange(false);
        // Look for unlinked campaigns matching this product (by product_id or by name).
        const productName = selectedProduct?.name ?? dealName;
        const { data: candidates } = await supabase
          .from("campaigns")
          .select("id,campaign_name")
          .eq("influencer_id", influencerId)
          .is("deal_id", null);
        const matches = (candidates ?? []).filter((c) => {
          const name = (c.campaign_name ?? "").trim().toLowerCase();
          return productName ? name === productName.trim().toLowerCase() : false;
        });
        if (matches.length > 0 && inserted?.id) {
          setLinkPrompt({
            dealId: inserted.id,
            productLabel: productName || "this deal",
            candidateIds: matches.map((m) => m.id),
          });
        } else {
          onSaved();
        }
      }
    } catch (e) {
      toastError("Could not save deal", e);
    } finally {
      setSaving(false);
    }
  };

  const confirmLink = async () => {
    if (!linkPrompt) return;
    try {
      await linkCampaignsToDeal(linkPrompt.candidateIds, linkPrompt.dealId);
      toast.success(`Linked ${linkPrompt.candidateIds.length} campaign${linkPrompt.candidateIds.length === 1 ? "" : "s"}`);
    } catch (e) {
      toastError("Could not link campaigns", e);
    } finally {
      setLinkPrompt(null);
      onSaved();
    }
  };

  const skipLink = () => {
    setLinkPrompt(null);
    onSaved();
  };

  return (
    <>
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{editing ? "Edit deal" : "Add deal"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label>Product</Label>
            {selectedProduct ? (
              <div className="flex items-center justify-between gap-2 rounded-md border border-primary/40 bg-primary/10 px-3 py-2 shadow-[0_0_12px_-4px_hsl(var(--primary)/0.6)]">
                <div className="min-w-0">
                  <div className="truncate text-sm font-medium">{selectedProduct.name}</div>
                  {selectedProduct.sku && (
                    <div className="truncate text-xs text-muted-foreground">SKU: {selectedProduct.sku}</div>
                  )}
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 shrink-0"
                  onClick={clearProduct}
                  aria-label="Clear product"
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            ) : (
              <div ref={searchWrapRef} className="relative">
                <div className="relative">
                  <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    value={productSearch}
                    onChange={(e) => { setProductSearch(e.target.value); setShowResults(true); }}
                    onFocus={() => setShowResults(true)}
                    onBlur={() => setTimeout(() => setShowResults(false), 150)}
                    placeholder="Search by name or SKU..."
                    className="pl-8 border-primary/30 focus-visible:ring-primary/50"
                  />
                </div>
                {showResults && productSearch.trim().length >= 2 && (
                  <div className="absolute left-0 right-0 top-full z-50 mt-1 max-h-[280px] overflow-y-auto rounded-md border border-primary/40 bg-popover shadow-[0_0_24px_-8px_hsl(var(--primary)/0.6)]">
                    {searching && productResults.length === 0 ? (
                      <div className="px-3 py-2 text-xs text-muted-foreground">Searching…</div>
                    ) : productResults.length === 0 ? (
                      <div className="px-3 py-2 text-xs text-muted-foreground">No products match.</div>
                    ) : (
                      productResults.map((p) => (
                        <button
                          key={p.id}
                          type="button"
                          onMouseDown={(e) => { e.preventDefault(); pickProduct(p); }}
                          className="flex w-full items-center justify-between gap-2 px-3 py-2 text-left text-sm hover:bg-primary/10"
                        >
                          <span className="truncate">{p.name}</span>
                          {p.sku && <span className="shrink-0 text-xs text-muted-foreground">{p.sku}</span>}
                        </button>
                      ))
                    )}
                  </div>
                )}
                {productSearch.trim().length > 0 && productSearch.trim().length < 2 && (
                  <div className="mt-1 text-[11px] text-muted-foreground">Type at least 2 characters…</div>
                )}
              </div>
            )}
          </div>
          <div className="space-y-1.5">
            <Label>Deal name</Label>
            <Input value={dealName} onChange={(e) => setDealName(e.target.value)} placeholder="e.g. Craftmaker S30 shipment" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Total cost</Label>
              <Input type="number" min="0" step="0.01" value={totalCost} onChange={(e) => setTotalCost(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>Currency</Label>
              <Select value={currency} onValueChange={(v) => setCurrency(v as CurrencyCode)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{CURRENCIES.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>Collaboration type</Label>
            <Select value={collab} onValueChange={setCollab}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{COLLAB_OPTIONS.map((o) => <SelectItem key={o} value={o}>{o}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Notes</Label>
            <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={save} disabled={saving}>{saving ? "Saving…" : editing ? "Save" : "Create deal"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>

    <AlertDialog open={!!linkPrompt} onOpenChange={(o) => { if (!o) skipLink(); }}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Link existing campaigns to this deal?</AlertDialogTitle>
          <AlertDialogDescription>
            Found {linkPrompt?.candidateIds.length ?? 0} unlinked campaign{(linkPrompt?.candidateIds.length ?? 0) === 1 ? "" : "s"} for {linkPrompt?.productLabel}. Link them to this deal?
            Linking will split the deal cost evenly across all linked campaigns.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel onClick={skipLink}>Skip</AlertDialogCancel>
          <AlertDialogAction onClick={confirmLink}>Link campaigns</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
    </>
  );
};
