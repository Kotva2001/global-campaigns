import type { CampaignEntry, Platform } from "@/types/campaign";

const cleanCell = (v: unknown): string => (v == null ? "" : String(v).trim());

/** Parse Czech-formatted number: "1 354 Kč", "12,5 %", "3 280" → number | null
 *  Strips currency symbols, percent signs, all unicode whitespace,
 *  and converts comma decimal separator to dot. */
export const parseCzechNumber = (raw: unknown): number | null => {
  if (raw == null) return null;
  if (typeof raw === "number") return Number.isFinite(raw) ? raw : null;
  const s = String(raw).trim();
  if (!s) return null;
  const cleaned = s
    .replace(/Kč|kč|CZK|EUR|USD|€|\$|%/gi, "")
    // strip all whitespace incl. NBSP (\u00A0), narrow NBSP (\u202F), thin space (\u2009)
    .replace(/[\s\u00A0\u202F\u2009]/g, "")
    .replace(",", ".")
    .trim();
  if (!cleaned || cleaned === "-" || cleaned === ".") return null;
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : null;
};

/** Parse percentage: "52,38%" → 52.38, "0,81 %" → 0.81 */
export const parsePercentage = (raw: unknown): number | null => parseCzechNumber(raw);

const normalizePlatform = (raw: string): Platform => {
  const v = raw.toLowerCase().trim();
  if (v.includes("short")) return "YB Shorts";
  if (v.includes("insta")) return "Instagram";
  if (v.includes("you") || v.includes("yt")) return "YouTube";
  return "YouTube";
};

export const parseRow = (
  row: unknown[],
  country: string,
  rowIndex: number,
): CampaignEntry => {
  const c = (i: number) => cleanCell(row[i]);
  return {
    id: `${country}-${rowIndex}`,
    country,
    influencer: c(1),
    campaignName: c(2),
    platform: normalizePlatform(c(3)),
    publishDate: c(4),
    videoLink: c(5),
    collaborationType: c(6),
    campaignCost: parseCzechNumber(row[7]),
    utmLink: c(8),
    managedBy: c(9),
    views: parseCzechNumber(row[10]),
    likes: parseCzechNumber(row[11]),
    comments: parseCzechNumber(row[12]),
    sessions: parseCzechNumber(row[13]),
    engagementRate: parseCzechNumber(row[14]),
    purchaseRevenue: parseCzechNumber(row[15]),
    conversionRate: parseCzechNumber(row[16]),
  };
};

/** Parse "DD.MM.YYYY" to Date or null */
export const parseCzechDate = (s: string): Date | null => {
  const m = s.match(/^(\d{1,2})\.(\d{1,2})\.(\d{4})$/);
  if (!m) return null;
  const [, d, mo, y] = m;
  const dt = new Date(Number(y), Number(mo) - 1, Number(d));
  return isNaN(dt.getTime()) ? null : dt;
};
