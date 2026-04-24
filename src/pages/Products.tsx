import { useEffect, useMemo, useState } from "react";
import { MoreVertical, Package, Pencil, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { toastError } from "@/lib/toast-helpers";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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
import { ProductDialog } from "@/components/ProductDialog";
import { formatCurrency } from "@/lib/formatters";
import type { ProductRecord } from "@/types/product";

const Products = () => {
  const [products, setProducts] = useState<ProductRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<ProductRecord | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<ProductRecord | null>(null);

  const load = async () => {
    setLoading(true);
    const { data, error } = await supabase.from("products").select("*").order("name");
    if (error) toastError("Could not load products", error);
    setProducts((data ?? []) as ProductRecord[]);
    setLoading(false);
  };

  useEffect(() => { void load(); }, []);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return products;
    return products.filter((p) =>
      p.name.toLowerCase().includes(q) ||
      (p.sku ?? "").toLowerCase().includes(q) ||
      (p.category ?? "").toLowerCase().includes(q),
    );
  }, [products, search]);

  const removeProduct = async () => {
    if (!confirmDelete) return;
    const { error } = await supabase.from("products").delete().eq("id", confirmDelete.id);
    if (error) return toastError("Could not delete product", error);
    toast.success("Product deleted");
    setConfirmDelete(null);
    void load();
  };

  return (
    <div>
      <header className="sticky top-0 z-20 border-b border-border bg-background/80 backdrop-blur">
        <div className="flex items-center justify-between gap-4 px-6 py-4">
          <div>
            <h1 className="text-lg font-bold tracking-tight">Products</h1>
            <p className="text-xs text-muted-foreground">Catalog of products promoted in campaigns</p>
          </div>
          <Button className="gap-2" onClick={() => { setEditing(null); setDialogOpen(true); }}>
            <Plus className="h-4 w-4" /> Add Product
          </Button>
        </div>
        <div className="flex items-center gap-3 px-6 pb-4">
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by name, SKU or category…"
            className="min-w-[220px] flex-1"
          />
          <span className="text-xs text-muted-foreground">{filtered.length} product{filtered.length === 1 ? "" : "s"}</span>
        </div>
      </header>

      <div className="px-6 py-6">
        {loading ? (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {Array.from({ length: 8 }).map((_, i) => <Skeleton key={i} className="h-36 bg-card" />)}
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex min-h-[40vh] items-center justify-center">
            <Card className="border-dashed border-border bg-card/40 p-10 text-center">
              <Package className="mx-auto h-8 w-8 text-muted-foreground" />
              <div className="mt-2 text-sm font-medium">No products yet</div>
              <Button className="mt-4 gap-2" onClick={() => { setEditing(null); setDialogOpen(true); }}>
                <Plus className="h-4 w-4" /> Add your first product
              </Button>
            </Card>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {filtered.map((product) => (
              <Card key={product.id} className="border-border bg-card p-4 transition-colors hover:border-primary/40 hover:bg-card-hover">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-base font-bold">{product.name}</div>
                    <div className="mt-0.5 truncate text-xs text-muted-foreground">
                      {product.sku ? `SKU ${product.sku}` : "No SKU"}
                    </div>
                  </div>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon" className="h-8 w-8">
                        <MoreVertical className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => { setEditing(product); setDialogOpen(true); }}>
                        <Pencil className="mr-2 h-4 w-4" /> Edit
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem
                        onClick={() => setConfirmDelete(product)}
                        className="text-destructive focus:text-destructive"
                      >
                        <Trash2 className="mr-2 h-4 w-4" /> Delete
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
                <div className="mt-4 flex items-end justify-between gap-3">
                  <div>
                    <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Cost</div>
                    <div className="mt-0.5 text-lg font-bold tabular-nums">
                      {formatCurrency(product.cost, product.currency)}
                    </div>
                  </div>
                  {product.category && (
                    <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-semibold text-muted-foreground">
                      {product.category}
                    </span>
                  )}
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>

      <ProductDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        editing={editing}
        onSaved={() => { setDialogOpen(false); setEditing(null); void load(); }}
      />

      <AlertDialog open={!!confirmDelete} onOpenChange={(open) => !open && setConfirmDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete {confirmDelete?.name}?</AlertDialogTitle>
            <AlertDialogDescription>This permanently removes the product from your catalog.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={removeProduct}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default Products;