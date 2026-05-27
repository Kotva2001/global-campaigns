import { normalizeCurrency, type CurrencyCode } from "@/lib/currency";

export interface DealCostValue {
  amount: number;
  currency: CurrencyCode;
}

export const isBarterCollaboration = (collaborationType: string | null | undefined): boolean =>
  (collaborationType ?? "").toLowerCase().includes("barter");

export const isPaidCollaboration = (collaborationType: string | null | undefined): boolean =>
  (collaborationType ?? "").toLowerCase() === "paid";

export const campaignCollaborationCost = (
  amount: number | null | undefined,
  collaborationType: string | null | undefined,
): number | null => {
  // Collaboration fee only applies to Paid collaborations. Everything else (Barter,
  // Gifted, Affiliate, …) has no fee and should render as "—" in the UI.
  if (!isPaidCollaboration(collaborationType)) return null;
  return amount ?? null;
};

export const normalizeDealCostCurrency = (currency: string | null | undefined): CurrencyCode =>
  normalizeCurrency(currency);