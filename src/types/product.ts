export type ProductCurrency = "CZK" | "EUR";

export interface ProductRecord {
  id: string;
  name: string;
  sku: string | null;
  cost: number;
  currency: ProductCurrency;
  category: string | null;
}