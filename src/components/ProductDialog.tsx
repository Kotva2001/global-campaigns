import { useEffect, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { toastError } from "@/lib/toast-helpers";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { ProductRecord, ProductCurrency } from "@/types/product";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editing: ProductRecord | null;
  onSaved: () => void;
}

export const ProductDialog = ({ open, onOpenChange, editing, onSaved }: Props) => {
  const [name, setName] = useState("");
  const [sku, setSku] = useState("");
  const [cost, setCost] = useState("");
  const [currency, setCurrency] = useState<ProductCurrency>("CZK");
  const [category, setCategory] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setName(editing?.name ?? "");
    setSku(editing?.sku ?? "");
    setCost(editing ? String(editing.cost) : "");
    setCurrency((editing?.currency as ProductCurrency) ?? "CZK");
    setCategory(editing?.category ?? "");
  }, [editing, open]);

  const save = async () => {
    const trimmedName = name.trim();
    if (!trimmedName) {
      toast.error("Product name is required");
      return;
    }
    const costNumber = Number(cost);
    if (!Number.isFinite(costNumber) || costNumber < 0) {
      toast.error("Enter a valid cost");
      return;
    }
    setSaving(true);
    const payload = {
      name: trimmedName,
      sku: sku.trim() || null,
      cost: costNumber,
      currency,
      category: category.trim() || null,
    };
    const { error } = editing
      ? await supabase.from("products").update(payload).eq("id", editing.id)
      : await supabase.from("products").insert(payload);
    setSaving(false);
    if (error) return toastError(editing ? "Could not update product" : "Could not add product", error);
    toast.success(editing ? "Product updated" : "Product added");
    onSaved();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[480px]">
        <DialogHeader>
          <DialogTitle>{editing ? "Edit product" : "Add product"}</DialogTitle>
        </DialogHeader>
        <div className="grid gap-4 py-2">
          <div className="grid gap-1.5">
            <Label htmlFor="product-name">Name *</Label>
            <Input id="product-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Garden Shed Premium" />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="product-sku">SKU</Label>
            <Input id="product-sku" value={sku} onChange={(e) => setSku(e.target.value)} placeholder="Optional" />
          </div>
          <div className="grid grid-cols-[1fr_120px] gap-3">
            <div className="grid gap-1.5">
              <Label htmlFor="product-cost">Cost *</Label>
              <Input id="product-cost" type="number" min="0" step="0.01" value={cost} onChange={(e) => setCost(e.target.value)} placeholder="0" />
            </div>
            <div className="grid gap-1.5">
              <Label>Currency</Label>
              <Select value={currency} onValueChange={(v) => setCurrency(v as ProductCurrency)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="CZK">CZK</SelectItem>
                  <SelectItem value="EUR">EUR</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="product-category">Category</Label>
            <Input id="product-category" value={category} onChange={(e) => setCategory(e.target.value)} placeholder="Optional" />
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={saving}>Cancel</Button>
          <Button onClick={save} disabled={saving}>{saving ? "Saving…" : editing ? "Save changes" : "Add product"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};