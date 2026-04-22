import type { CampaignEntry, Platform } from "@/types/campaign";

const cleanCell = (v: unknown): string => (v == null ? "" : String(v).trim());

const detectColumnOffset = (row: unknown[]): 0 | 1 => {
  const first = cleanCell(row[0]).toLowerCase();
  if (!first) return row.length >= 17 ? 1 : 0;
  if (first === "tr" || /^\d+$/.test(first)) return 1;
  if (first.includes("influencer")) return 0;
  return row.length >= 17 ? 1 : 0;
};

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
  const offset = detectColumnOffset(row);
  const c = (i: number) => cleanCell(row[i + offset]);
  return {
    id: `${country}-${rowIndex}`,
    influencerId: null,
    country,
    influencer: c(0),
    campaignName: c(1),
    platform: normalizePlatform(c(2)),
    publishDate: c(3),
    publishDateIso: null,
    videoLink: c(4),
    collaborationType: c(5),
    campaignCost: parseCzechNumber(c(6)),
    utmLink: c(7),
    managedBy: c(8),
    views: parseCzechNumber(c(9)),
    likes: parseCzechNumber(c(10)),
    comments: parseCzechNumber(c(11)),
    sessions: parseCzechNumber(c(12)),
    engagementRate: parsePercentage(c(13)),
    purchaseRevenue: parseCzechNumber(c(14)),
    conversionRate: parsePercentage(c(15)),
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
