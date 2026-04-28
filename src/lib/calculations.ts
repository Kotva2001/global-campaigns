import type { CampaignEntry } from "@/types/campaign";
import { convertCurrency, type CurrencyCode, type ExchangeRates } from "@/lib/currency";

const sum = (xs: (number | null)[]) =>
  xs.reduce<number>((a, b) => a + (b ?? 0), 0);

const avg = (xs: (number | null)[]) => {
  const v = xs.filter((x): x is number => x != null && Number.isFinite(x));
  return v.length ? v.reduce((a, b) => a + b, 0) / v.length : null;
};

export interface KPISet {
  campaigns: number;
  stories: number;
  influencers: number;
  totalViews: number;
  totalLikes: number;
  totalSpend: number;
  totalRevenue: number;
  roi: number | null; // percent
  avgEngagement: number | null;
}

export const computeKPIs = (rows: CampaignEntry[], displayCurrency: CurrencyCode = "CZK", rates?: ExchangeRates): KPISet => {
  const videoRows = rows.filter((r) => r.platform !== "Story");
  const storyRows = rows.filter((r) => r.platform === "Story");
  const totalSpend = sum(rows.map((r) => convertCurrency(r.campaignCost, r.currency, displayCurrency, rates)));
  const totalRevenue = sum(rows.map((r) => convertCurrency(r.purchaseRevenue, r.currency, displayCurrency, rates)));
  return {
    campaigns: videoRows.length,
    stories: storyRows.length,
    influencers: new Set(rows.map((r) => `${r.country}|${r.influencer}`).filter((k) => k.split("|")[1])).size,
    totalViews: sum(videoRows.map((r) => r.views)),
    totalLikes: sum(videoRows.map((r) => r.likes)),
    totalSpend,
    totalRevenue,
    roi: totalSpend > 0 ? ((totalRevenue - totalSpend) / totalSpend) * 100 : null,
    avgEngagement: avg(videoRows.map((r) => r.engagementRate)),
  };
};

export interface InfluencerSummary {
  key: string;
  influencer: string;
  country: string;
  campaigns: number;
  stories: number;
  platforms: string[];
  totalViews: number;
  totalSpend: number;
  totalRevenue: number;
  roi: number | null;
  topCampaign: string;
}

export const summarizeInfluencers = (rows: CampaignEntry[], displayCurrency: CurrencyCode = "CZK", rates?: ExchangeRates): InfluencerSummary[] => {
  const map = new Map<string, CampaignEntry[]>();
  for (const r of rows) {
    if (!r.influencer) continue;
    const key = `${r.country}|${r.influencer}`;
    if (!map.has(key)) map.set(key, []);
    map.get(key)!.push(r);
  }
  const out: InfluencerSummary[] = [];
  for (const [key, entries] of map) {
    const videos = entries.filter((e) => e.platform !== "Story");
    const stories = entries.filter((e) => e.platform === "Story");
    const totalSpend = sum(entries.map((e) => convertCurrency(e.campaignCost, e.currency, displayCurrency, rates)));
    const totalRevenue = sum(entries.map((e) => convertCurrency(e.purchaseRevenue, e.currency, displayCurrency, rates)));
    const totalViews = sum(videos.map((e) => e.views));
    const top = [...videos].sort((a, b) => (b.views ?? 0) - (a.views ?? 0))[0];
    out.push({
      key,
      influencer: entries[0].influencer,
      country: entries[0].country,
      campaigns: videos.length,
      stories: stories.length,
      platforms: Array.from(new Set(entries.map((e) => e.platform))),
      totalViews,
      totalSpend,
      totalRevenue,
      roi: totalSpend > 0 ? ((totalRevenue - totalSpend) / totalSpend) * 100 : null,
      topCampaign: top?.campaignName ?? "",
    });
  }
  return out.sort((a, b) => b.totalViews - a.totalViews);
};

export interface MarketStats {
  country: string;
  influencers: number;
  campaigns: number;
  views: number;
}

export const summarizeMarkets = (rows: CampaignEntry[]): Map<string, MarketStats> => {
  const m = new Map<string, MarketStats>();
  for (const r of rows) {
    if (!m.has(r.country)) {
      m.set(r.country, { country: r.country, influencers: 0, campaigns: 0, views: 0 });
    }
    const s = m.get(r.country)!;
    s.campaigns += 1;
    s.views += r.views ?? 0;
  }
  // unique influencers per country
  const influencerSets = new Map<string, Set<string>>();
  for (const r of rows) {
    if (!r.influencer) continue;
    if (!influencerSets.has(r.country)) influencerSets.set(r.country, new Set());
    influencerSets.get(r.country)!.add(r.influencer);
  }
  for (const [country, set] of influencerSets) {
    if (m.has(country)) m.get(country)!.influencers = set.size;
  }
  return m;
};
