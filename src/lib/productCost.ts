import type { ProductRecord } from "@/types/product";

/**
 * Returns the effective "our cost" for a product:
 * - `purchase_price` when set (what we actually pay)
 * - falls back to `cost` (retail price) when missing
 * Also returns a flag indicating the fallback so the UI can warn the user.
 */
export const getProductPurchaseCost = (
  product: Pick<ProductRecord, "purchase_price" | "cost"> | {
    purchase_price?: number | string | null;
    cost?: number | string | null;
  },
): { value: number; usedFallback: boolean } => {
  const raw = (product as { purchase_price?: number | string | null }).purchase_price;
  if (raw != null && raw !== "") {
    const n = typeof raw === "number" ? raw : Number(raw);
    if (Number.isFinite(n)) return { value: n, usedFallback: false };
  }
  const c = (product as { cost?: number | string | null }).cost;
  const n = typeof c === "number" ? c : Number(c ?? 0);
  return { value: Number.isFinite(n) ? n : 0, usedFallback: true };
};
