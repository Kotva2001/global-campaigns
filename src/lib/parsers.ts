import type { CampaignEntry, Platform } from "@/types/campaign";

const cleanCell = (v: unknown): string => (v == null ? "" : String(v).trim());

/** Parse Czech-formatted number: "1 354 Kč", "12,5 %", "3 280" → number | null */
export const parseCzechNumber = (raw: unknown): number | null => {
  const s = cleanCell(raw);
  if (!s) return null;
  // strip currency, percent, NBSP, regular spaces
  const cleaned = s
    .replace(/Kč|kč|€|\$|%/g, "")
    .replace(/\u00A0/g, "")
    .replace(/\s+/g, "")
    .replace(",", ".")
    .trim();
  if (!cleaned) return null;
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : null;
};

const normalizePlatform = (raw: string): Platform => {
  const v = raw.toLowerCase();
  if (v.includes("short")) return "YB Shorts";
  if (v.includes("insta")) return "Instagram";
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
