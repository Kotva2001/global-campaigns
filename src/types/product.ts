export type ProductCurrency = "CZK" | "EUR";

export interface ProductRecord {
  id: string;
  name: string;
  sku: string | null;
  cost: number;
  /** Our internal purchase cost (what we pay). Falls back to `cost` when null. */
  purchase_price: number | null;
  currency: ProductCurrency;
  category: string | null;
}