export { formatCurrency } from "@/lib/currency";

/** Czech number formatting: 1234567 → "1 234 567" */
export const formatNumber = (n: number | null | undefined, fractionDigits = 0): string => {
  if (n == null || !Number.isFinite(n)) return "—";
  return n.toLocaleString("cs-CZ", {
    minimumFractionDigits: fractionDigits,
    maximumFractionDigits: fractionDigits,
  });
};

export const formatPercent = (n: number | null | undefined): string => {
  if (n == null || !Number.isFinite(n)) return "—";
  return `${n.toLocaleString("cs-CZ", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} %`;
};

/** Compact: 45000 → "45k", 1200000 → "1.2M" */
export const formatCompact = (n: number | null | undefined): string => {
  if (n == null || !Number.isFinite(n)) return "0";
  if (n < 1000) return String(Math.round(n));
  if (n < 1_000_000) return `${(n / 1000).toFixed(n < 10_000 ? 1 : 0).replace(/\.0$/, "")}k`;
  return `${(n / 1_000_000).toFixed(1).replace(/\.0$/, "")}M`;
};
