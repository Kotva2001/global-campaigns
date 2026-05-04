import { format, startOfMonth, subMonths } from "date-fns";
import { convertCurrency, normalizeCurrency } from "@/lib/currency";

export interface CreatorScoreData {
  creatorId: string;
  score: number; // 0-100
  totalViews: number;
  posts: number;
  postsPerMonth: number;
  avgEngagement: number | null;
  productCost: number; // in CZK
  viewsPerCzk: number | null; // null if no cost data
  monthlyViews: { month: string; label: string; views: number }[]; // last 6 months
}

export interface RawCampaign {
  id: string;
  influencer_id: string | null;
  publish_date: string | null;
  views: number | null;
  engagement_rate: number | string | null;
  deal_id: string | null;
}

export interface RawDeal {
  id: string;
  product_id: string | null;
}

export interface RawProduct {
  id: string;
  cost: number | string | null;
  currency: string | null;
}

const num = (v: unknown): number => {
  if (v == null) return 0;
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? n : 0;
};

/** Compute percentile rank (0..1) of value within sorted ascending array. */
const percentileRank = (sortedAsc: number[], value: number): number => {
  if (sortedAsc.length === 0) return 0;
  if (sortedAsc.length === 1) return 0.5;
  // Count values strictly less + half equal
  let less = 0;
  let equal = 0;
  for (const v of sortedAsc) {
    if (v < value) less++;
    else if (v === value) equal++;
    else break;
  }
  return (less + equal * 0.5) / sortedAsc.length;
};

const median = (arr: number[]): number => {
  if (!arr.length) return 0;
  const sorted = [...arr].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
};

/**
 * Compute Performance Scores for every creator that has at least one campaign.
 */
export const computeCreatorScores = (
  campaigns: RawCampaign[],
  deals: RawDeal[],
  products: RawProduct[],
  eurCzkRate: number,
  referenceMonth: Date = new Date(),
): Map<string, CreatorScoreData> => {
  // Build product cost map (CZK)
  const productCostCzk = new Map<string, number>();
  for (const p of products) {
    productCostCzk.set(p.id, convertCurrency(num(p.cost), normalizeCurrency(p.currency), "CZK", { EUR_CZK: eurCzkRate }));
  }
  const dealCost = new Map<string, number>();
  for (const d of deals) {
    dealCost.set(d.id, d.product_id ? productCostCzk.get(d.product_id) ?? 0 : 0);
  }

  // Aggregate per creator
  interface Agg {
    views: number;
    posts: number;
    engagements: number[];
    productCost: number;
    dealsCounted: Set<string>;
    earliest: number | null;
    latest: number | null;
    monthly: Map<string, number>;
  }
  const byCreator = new Map<string, Agg>();
  for (const c of campaigns) {
    if (!c.influencer_id) continue;
    const cur = byCreator.get(c.influencer_id) ?? {
      views: 0,
      posts: 0,
      engagements: [],
      productCost: 0,
      dealsCounted: new Set<string>(),
      earliest: null,
      latest: null,
      monthly: new Map<string, number>(),
    };
    cur.views += num(c.views);
    cur.posts += 1;
    if (c.engagement_rate != null) {
      const e = num(c.engagement_rate);
      if (Number.isFinite(e)) cur.engagements.push(e);
    }
    if (c.deal_id && !cur.dealsCounted.has(c.deal_id) && dealCost.has(c.deal_id)) {
      cur.dealsCounted.add(c.deal_id);
      cur.productCost += dealCost.get(c.deal_id) ?? 0;
    }
    if (c.publish_date) {
      const t = new Date(`${c.publish_date}T00:00:00`).getTime();
      if (Number.isFinite(t)) {
        cur.earliest = cur.earliest == null ? t : Math.min(cur.earliest, t);
        cur.latest = cur.latest == null ? t : Math.max(cur.latest, t);
        const monthKey = c.publish_date.slice(0, 7);
        cur.monthly.set(monthKey, (cur.monthly.get(monthKey) ?? 0) + num(c.views));
      }
    }
    byCreator.set(c.influencer_id, cur);
  }

  // Build per-creator metrics
  interface Metrics {
    totalViews: number;
    avgEngagement: number | null;
    postsPerMonth: number;
    viewsPerCzk: number | null;
    productCost: number;
    posts: number;
    monthlyViews: { month: string; label: string; views: number }[];
  }
  const metricsById = new Map<string, Metrics>();
  const monthsSpan = (a: Agg): number => {
    if (a.earliest == null || a.latest == null) return 1;
    const months = (a.latest - a.earliest) / (1000 * 60 * 60 * 24 * 30.44) + 1;
    return Math.max(1, months);
  };

  for (const [id, a] of byCreator.entries()) {
    const ppm = a.posts / monthsSpan(a);
    const avgEng = a.engagements.length ? a.engagements.reduce((s, x) => s + x, 0) / a.engagements.length : null;
    const viewsPerCzk = a.productCost > 0 ? a.views / a.productCost : null;
    const monthlyViews: { month: string; label: string; views: number }[] = [];
    for (let i = 5; i >= 0; i--) {
      const d = subMonths(startOfMonth(referenceMonth), i);
      const key = format(d, "yyyy-MM");
      monthlyViews.push({ month: key, label: format(d, "MMM"), views: a.monthly.get(key) ?? 0 });
    }
    metricsById.set(id, {
      totalViews: a.views,
      avgEngagement: avgEng,
      postsPerMonth: ppm,
      viewsPerCzk,
      productCost: a.productCost,
      posts: a.posts,
      monthlyViews,
    });
  }

  // Build distributions for percentile ranking
  const viewsDist = [...metricsById.values()].map((m) => m.totalViews).sort((a, b) => a - b);
  const engDist = [...metricsById.values()].map((m) => m.avgEngagement).filter((x): x is number => x != null).sort((a, b) => a - b);
  const ppmDist = [...metricsById.values()].map((m) => m.postsPerMonth).sort((a, b) => a - b);
  const vpcDistRaw = [...metricsById.values()].map((m) => m.viewsPerCzk).filter((x): x is number => x != null && Number.isFinite(x));
  const vpcDist = [...vpcDistRaw].sort((a, b) => a - b);
  const vpcMedian = median(vpcDist);

  const out = new Map<string, CreatorScoreData>();
  for (const [id, m] of metricsById.entries()) {
    const pViews = percentileRank(viewsDist, m.totalViews);
    const pEng = m.avgEngagement == null ? 0.5 : percentileRank(engDist, m.avgEngagement);
    const pPpm = percentileRank(ppmDist, m.postsPerMonth);
    const vpcValue = m.viewsPerCzk ?? vpcMedian;
    const pVpc = vpcDist.length === 0 ? 0.5 : percentileRank(vpcDist, vpcValue);
    const score = Math.round((pViews * 0.4 + pEng * 0.3 + pPpm * 0.2 + pVpc * 0.1) * 100);
    out.set(id, {
      creatorId: id,
      score,
      totalViews: m.totalViews,
      posts: m.posts,
      postsPerMonth: m.postsPerMonth,
      avgEngagement: m.avgEngagement,
      productCost: m.productCost,
      viewsPerCzk: m.viewsPerCzk,
      monthlyViews: m.monthlyViews,
    });
  }
  return out;
};

export const scoreColor = (score: number): { color: string; glow: string; label: string } => {
  if (score >= 70) return { color: "hsl(var(--success))", glow: "hsl(var(--success))", label: "Excellent" };
  if (score >= 40) return { color: "hsl(var(--warning))", glow: "hsl(var(--warning))", label: "Good" };
  return { color: "hsl(var(--destructive))", glow: "hsl(var(--destructive))", label: "Needs work" };
};

export const scoreColorByValue = scoreColor;