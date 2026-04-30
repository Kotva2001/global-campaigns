import { useEffect, useState } from "react";
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
  const [products, setProducts] = useState<ProductRecord[]>([]);
  const [productId, setProductId] = useState<string | null>(null);
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

  useEffect(() => {
    if (!open) return;
    void supabase.from("products").select("*").order("name").then(({ data }) => {
      setProducts((data ?? []) as ProductRecord[]);
    });
  }, [open]);

  useEffect(() => {
    if (!open) return;
    if (editing) {
      setProductId(editing.product_id);
      setDealName(editing.deal_name ?? "");
      setTotalCost(String(editing.total_cost ?? 0));
      setCurrency((editing.currency as CurrencyCode) ?? "EUR");
      setCollab(editing.collaboration_type ?? "Barter");
      setNotes(editing.notes ?? "");
    } else {
      setProductId(null);
      setDealName("");
      setTotalCost("0");
      setCurrency("EUR");
      setCollab("Barter");
      setNotes("");
    }
  }, [editing, open]);

  const onPickProduct = (pid: string) => {
    setProductId(pid === "__none__" ? null : pid);
    const p = products.find((x) => x.id === pid);
    if (p) {
      if (!editing) {
        setTotalCost(String(p.cost ?? 0));
        setCurrency((p.currency as CurrencyCode) ?? "EUR");
      }
      if (!dealName) setDealName(p.name);
    }
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
        const product = products.find((p) => p.id === productId);
        const productName = product?.name ?? dealName;
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
            <Select value={productId ?? "__none__"} onValueChange={onPickProduct}>
              <SelectTrigger><SelectValue placeholder="Select a product" /></SelectTrigger>
              <SelectContent className="max-h-[280px]">
                <SelectItem value="__none__">— None —</SelectItem>
                {products.map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.name} {p.sku ? <span className="text-xs text-muted-foreground">({p.sku})</span> : null}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
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
