import { normalizeCurrency, type CurrencyCode } from "@/lib/currency";

export interface DealCostValue {
  amount: number;
  currency: CurrencyCode;
}

export const isBarterCollaboration = (collaborationType: string | null | undefined): boolean =>
  (collaborationType ?? "").toLowerCase().includes("barter");

export const campaignCollaborationCost = (
  amount: number | null | undefined,
  collaborationType: string | null | undefined,
): number | null => {
  if (isBarterCollaboration(collaborationType)) return 0;
  return amount ?? null;
};

export const normalizeDealCostCurrency = (currency: string | null | undefined): CurrencyCode =>
  normalizeCurrency(currency);