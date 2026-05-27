import { useState } from "react";
import { toast } from "sonner";
import { CheckCircle2, AlertTriangle, Trash2, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toastError } from "@/lib/toast-helpers";
import { searchProducts } from "@/lib/product-search";
import { getProductPurchaseCost } from "@/lib/productCost";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import type { CurrencyCode } from "@/lib/currency";
import type { ProductRecord } from "@/types/product";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  influencerId: string;
  onSaved: () => void;
}

interface ParsedRow {
  id: string;
  rawName: string;
  quantity: number;
  unitPrice: number;
  matchedProductId: string | null;
  candidates: ProductRecord[];
}

const CURRENCIES: CurrencyCode[] = ["CZK", "EUR", "HUF", "RON"];
const COLLAB_OPTIONS = ["Barter", "Paid", "Hybrid", "Other"] as const;

const parseLine = (line: string): { name: string; quantity: number } | null => {
  const trimmed = line.trim();
  if (!trimmed) return null;
  // Try "name, qty"
  const commaMatch = trimmed.match(/^(.*),\s*(\d+)\s*$/);
  if (commaMatch) {
    return { name: commaMatch[1].trim(), quantity: Math.max(1, parseInt(commaMatch[2], 10) || 1) };
  }
  // Try "name x2" / "name × 3" (with optional space)
  const xMatch = trimmed.match(/^(.*?)[\s]*[x×X]\s*(\d+)\s*$/);
  if (xMatch && xMatch[1].trim().length > 0) {
    return { name: xMatch[1].trim(), quantity: Math.max(1, parseInt(xMatch[2], 10) || 1) };
  }
  return { name: trimmed, quantity: 1 };
};

export const BulkAddDealsDialog = ({ open, onOpenChange, influencerId, onSaved }: Props) => {
  const [text, setText] = useState("");
  const [rows, setRows] = useState<ParsedRow[]>([]);
  const [parsing, setParsing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [currency, setCurrency] = useState<CurrencyCode>("CZK");
  const [collab, setCollab] = useState<string>("Barter");

  const reset = () => {
    setText("");
    setRows([]);
    setParsing(false);
    setSaving(false);
  };

  const handleOpenChange = (o: boolean) => {
    if (!o) reset();
    onOpenChange(o);
  };

  const parse = async () => {
    const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
    if (lines.length === 0) {
      toast.error("Paste at least one line");
      return;
    }
    setParsing(true);
    try {
      const parsed = await Promise.all(
        lines.map(async (line, idx) => {
          const bits = parseLine(line);
          if (!bits) return null;
          const candidates = await searchProducts(bits.name, 10);
          const best = candidates[0] ?? null;
          const qty = bits.quantity;
          const price = best ? getProductPurchaseCost(best).value : 0;
          return {
            id: `${Date.now()}-${idx}`,
            rawName: bits.name,
            quantity: qty,
            unitPrice: price,
            matchedProductId: best?.id ?? null,
            candidates,
          } as ParsedRow;
        }),
      );
      setRows(parsed.filter((r): r is ParsedRow => r !== null));
    } catch (e) {
      toastError("Could not parse input", e);
    } finally {
      setParsing(false);
    }
  };

  const updateRow = (id: string, patch: Partial<ParsedRow>) => {
    setRows((prev) => prev.map((r) => (r.id === id ? { ...r, ...patch } : r)));
  };

  const removeRow = (id: string) => setRows((prev) => prev.filter((r) => r.id !== id));

  const onMatchedChange = (id: string, productId: string) => {
    const row = rows.find((r) => r.id === id);
    if (!row) return;
    const product = row.candidates.find((c) => c.id === productId) ?? null;
    updateRow(id, {
      matchedProductId: product?.id ?? null,
      unitPrice: product ? getProductPurchaseCost(product).value : row.unitPrice,
    });
  };

  const createAll = async () => {
    if (rows.length === 0) {
      toast.error("Nothing to create");
      return;
    }
    setSaving(true);
    try {
      const payload = rows.map((r) => ({
        influencer_id: influencerId,
        product_id: r.matchedProductId,
        deal_name: r.rawName || null,
        total_cost: Math.max(0, r.unitPrice) * Math.max(1, r.quantity),
        quantity: Math.max(1, Math.floor(r.quantity || 1)),
        currency,
        collaboration_type: collab,
      }));
      const { error } = await supabase.from("deals").insert(payload);
      if (error) throw error;
      toast.success(`${payload.length} deal${payload.length === 1 ? "" : "s"} created`);
      onSaved();
      handleOpenChange(false);
    } catch (e) {
      toastError("Could not create deals", e);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-4xl">
        <DialogHeader>
          <DialogTitle>Bulk add deals</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label>Paste products</Label>
            <Textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              rows={6}
              placeholder={"Paste product names — one per line. Add quantity with comma or x:\n\nPica Dry, 4\nCraftmaker S30\nStrongbold H700 x2"}
              className="font-mono text-xs"
            />
          </div>

          <div className="flex flex-wrap items-end gap-3">
            <div className="space-y-1.5">
              <Label>Currency</Label>
              <Select value={currency} onValueChange={(v) => setCurrency(v as CurrencyCode)}>
                <SelectTrigger className="w-28"><SelectValue /></SelectTrigger>
                <SelectContent>{CURRENCIES.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Collaboration</Label>
              <Select value={collab} onValueChange={setCollab}>
                <SelectTrigger className="w-32"><SelectValue /></SelectTrigger>
                <SelectContent>{COLLAB_OPTIONS.map((o) => <SelectItem key={o} value={o}>{o}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <Button onClick={parse} disabled={parsing || !text.trim()} variant="secondary">
              {parsing ? <><Loader2 className="h-4 w-4 animate-spin" /> Parsing…</> : "Parse"}
            </Button>
          </div>

          {rows.length > 0 && (
            <div className="max-h-[45vh] overflow-auto rounded-md border border-border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-8"></TableHead>
                    <TableHead>Pasted name</TableHead>
                    <TableHead>Matched product</TableHead>
                    <TableHead className="w-20">Qty</TableHead>
                    <TableHead className="w-28">Unit price</TableHead>
                    <TableHead className="w-28 text-right">Total</TableHead>
                    <TableHead className="w-10"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((r) => {
                    const total = Math.max(0, r.unitPrice) * Math.max(1, r.quantity);
                    return (
                      <TableRow key={r.id}>
                        <TableCell>
                          {r.matchedProductId ? (
                            <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                          ) : (
                            <AlertTriangle className="h-4 w-4 text-amber-500" />
                          )}
                        </TableCell>
                        <TableCell className="max-w-[180px] truncate text-xs">{r.rawName}</TableCell>
                        <TableCell>
                          {r.candidates.length === 0 ? (
                            <span className="text-xs text-muted-foreground">No match</span>
                          ) : (
                            <Select
                              value={r.matchedProductId ?? "__none"}
                              onValueChange={(v) => onMatchedChange(r.id, v === "__none" ? "" : v)}
                            >
                              <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="—" /></SelectTrigger>
                              <SelectContent>
                                <SelectItem value="__none">— None —</SelectItem>
                                {r.candidates.map((c) => (
                                  <SelectItem key={c.id} value={c.id}>
                                    {c.name}{c.sku ? ` (${c.sku})` : ""}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          )}
                        </TableCell>
                        <TableCell>
                          <Input
                            type="number"
                            min="1"
                            value={r.quantity}
                            onChange={(e) => updateRow(r.id, { quantity: Math.max(1, Math.floor(Number(e.target.value) || 1)) })}
                            className="h-8 text-xs"
                          />
                        </TableCell>
                        <TableCell>
                          <Input
                            type="number"
                            min="0"
                            step="0.01"
                            value={r.unitPrice}
                            onChange={(e) => updateRow(r.id, { unitPrice: Math.max(0, Number(e.target.value) || 0) })}
                            className="h-8 text-xs"
                          />
                        </TableCell>
                        <TableCell className="text-right text-xs tabular-nums">
                          {total.toLocaleString("cs-CZ", { maximumFractionDigits: 2 })}
                        </TableCell>
                        <TableCell>
                          <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:text-destructive" onClick={() => removeRow(r.id)}>
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => handleOpenChange(false)}>Cancel</Button>
          <Button onClick={createAll} disabled={saving || rows.length === 0}>
            {saving ? "Creating…" : `Create ${rows.length || ""} deal${rows.length === 1 ? "" : "s"}`.trim()}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};