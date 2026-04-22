export type CurrencyCode = "CZK" | "EUR" | "HUF" | "RON";

export interface ExchangeRates {
  EUR_CZK: number;
}

export const DEFAULT_RATES: ExchangeRates = { EUR_CZK: 25 };

export const defaultCurrencyForCountry = (country?: string): CurrencyCode => {
  if (country === "CZ" || country === "SK") return "CZK";
  if (country === "HU") return "HUF";
  if (country === "RO") return "RON";
  return "EUR";
};

export const normalizeCurrency = (currency?: string | null): CurrencyCode => {
  if (currency === "EUR" || currency === "HUF" || currency === "RON") return currency;
  return "CZK";
};

export const detectCurrency = (value: unknown, fallback: CurrencyCode): CurrencyCode => {
  const text = String(value ?? "").toUpperCase();
  if (text.includes("€") || text.includes("EUR")) return "EUR";
  if (text.includes("KČ") || text.includes("CZK")) return "CZK";
  if (text.includes("HUF") || text.includes("FT")) return "HUF";
  if (text.includes("RON")) return "RON";
  return fallback;
};

export const formatCurrency = (amount: number | null | undefined, currency: string = "CZK"): string => {
  if (amount == null || !Number.isFinite(amount)) return "—";
  const formatted = Math.round(amount).toLocaleString("cs-CZ");
  if (currency === "EUR") return `${formatted} €`;
  if (currency === "HUF") return `${formatted} Ft`;
  if (currency === "RON") return `${formatted} RON`;
  return `${formatted} Kč`;
};

export const convertToCZK = (amount: number | null | undefined, fromCurrency: string, rates: ExchangeRates = DEFAULT_RATES): number => {
  if (amount == null || !Number.isFinite(amount)) return 0;
  const currency = normalizeCurrency(fromCurrency);
  if (currency === "EUR") return amount * rates.EUR_CZK;
  return amount;
};

export const convertCurrency = (amount: number | null | undefined, fromCurrency: string, toCurrency: CurrencyCode, rates: ExchangeRates = DEFAULT_RATES): number => {
  const czk = convertToCZK(amount, fromCurrency, rates);
  if (toCurrency === "EUR") return czk / rates.EUR_CZK;
  return czk;
};
