import { useMemo } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { COUNTRY_FLAGS } from "@/lib/countries";
import { FlagIcon, hasFlag } from "@/components/FlagIcon";
import { formatCurrency, formatNumber, formatCompact, formatPercent } from "@/lib/formatters";
import type { CampaignEntry } from "@/types/campaign";
import { convertCurrency, type CurrencyCode, type ExchangeRates } from "@/lib/currency";
import { cn } from "@/lib/utils";

export type KPIMetric =
  | "campaigns"
  | "stories"
  | "totalViews"
  | "totalSpend"
  | "totalRevenue"
  | "roi"
  | "avgEngagement";

interface Props {
  metric: KPIMetric | null;
  rows: CampaignEntry[];
  displayCurrency: CurrencyCode;
  rates?: ExchangeRates;
  onClose: () => void;
  onSelectInfluencer?: (influencer: string, country: string) => void;
}

const METRIC_TITLES: Record<KPIMetric, string> = {
  campaigns: "Campaigns — Ranked by Influencer",
  stories: "Stories — Ranked by Influencer",
  totalViews: "Total Views — Ranked by Influencer",
  totalSpend: "Total Spend — Ranked by Influencer",
  totalRevenue: "Revenue — Ranked by Influencer",
  roi: "Overall ROI — Ranked by Influencer",
  avgEngagement: "Avg Engagement — Ranked by Influencer",
};

interface Agg {
  key: string;
  influencer: string;
  country: string;
  campaigns: number;
  stories: number;
  views: number;
  likes: number;
  comments: number;
  spend: number;
  revenue: number;
  deals: Set<string>;
  byPlatform: Record<string, number>;
  engagementRates: number[];
  earliestStory: number | null;
  latestStory: number | null;
}

const aggregate = (rows: CampaignEntry[], displayCurrency: CurrencyCode, rates?: ExchangeRates): Agg[] => {
  const map = new Map<string, Agg>();
  for (const r of rows) {
    if (!r.influencer) continue;
    const key = `${r.country}|${r.influencer}`;
    if (!map.has(key)) {
      map.set(key, {
        key, influencer: r.influencer, country: r.country,
        campaigns: 0, stories: 0, views: 0, likes: 0, comments: 0,
        spend: 0, revenue: 0, deals: new Set(),
        byPlatform: {}, engagementRates: [],
        earliestStory: null, latestStory: null,
      });
    }
    const a = map.get(key)!;
    a.byPlatform[r.platform] = (a.byPlatform[r.platform] ?? 0) + 1;
    if (r.platform === "Story") {
      a.stories += 1;
      const t = r.publishDateIso ? new Date(r.publishDateIso).getTime() : null;
      if (t != null && Number.isFinite(t)) {
        a.earliestStory = a.earliestStory == null ? t : Math.min(a.earliestStory, t);
        a.latestStory = a.latestStory == null ? t : Math.max(a.latestStory, t);
      }
    } else {
      a.campaigns += 1;
      a.views += r.views ?? 0;
      a.likes += r.likes ?? 0;
      a.comments += r.comments ?? 0;
      if (r.engagementRate != null && Number.isFinite(r.engagementRate)) a.engagementRates.push(r.engagementRate);
    }
    a.spend += convertCurrency(r.campaignCost, r.currency, displayCurrency, rates) ?? 0;
    a.revenue += convertCurrency(r.purchaseRevenue, r.currency, displayCurrency, rates) ?? 0;
    if (r.dealId) a.deals.add(r.dealId);
  }
  return Array.from(map.values());
};

export const KPIBreakdownPanel = ({ metric, rows, displayCurrency, rates, onClose, onSelectInfluencer }: Props) => {
  const open = metric !== null;

  const { items, valueOf, formatValue, extra, platformTotals, empty } = useMemo(() => {
    const aggs = aggregate(rows, displayCurrency, rates);
    const platformTotals: Record<string, number> = {};
    for (const a of aggs) for (const [p, n] of Object.entries(a.byPlatform)) platformTotals[p] = (platformTotals[p] ?? 0) + n;

    if (!metric) return { items: [] as Agg[], valueOf: (_: Agg) => 0, formatValue: (_: number) => "", extra: (_: Agg) => null as React.ReactNode, platformTotals, empty: false };

    let filtered = aggs;
    let valueOf: (a: Agg) => number;
    let formatValue: (v: number) => string;
    let extra: (a: Agg) => React.ReactNode = () => null;
    let empty = false;

    switch (metric) {
      case "campaigns":
        valueOf = (a) => a.campaigns;
        formatValue = (v) => `${formatNumber(v)} campaign${v === 1 ? "" : "s"}`;
        extra = (a) => (
          <div className="mt-1 flex flex-wrap gap-1 text-[10px]">
            {Object.entries(a.byPlatform).filter(([p]) => p !== "Story").map(([p, n]) => (
              <span key={p} className="rounded bg-muted/60 px-1.5 py-0.5 text-muted-foreground">{p}: {n}</span>
            ))}
          </div>
        );
        break;
      case "stories":
        valueOf = (a) => a.stories;
        formatValue = (v) => `${formatNumber(v)} stor${v === 1 ? "y" : "ies"}`;
        extra = (a) => {
          if (a.stories === 0 || a.earliestStory == null || a.latestStory == null) return null;
          const days = Math.max(1, (a.latestStory - a.earliestStory) / (1000 * 60 * 60 * 24));
          const perWeek = (a.stories / days) * 7;
          return <div className="mt-1 text-[10px] text-muted-foreground">{perWeek.toFixed(2)} stories/week</div>;
        };
        if (aggs.every((a) => a.stories === 0)) empty = true;
        break;
      case "totalViews":
        valueOf = (a) => a.views;
        formatValue = (v) => `${formatNumber(v)} views`;
        extra = (a) => (
          <div className="mt-1 text-[10px] text-muted-foreground">
            {a.campaigns} campaigns · {formatCompact(a.campaigns ? a.views / a.campaigns : 0)} avg / campaign
          </div>
        );
        break;
      case "totalSpend":
        valueOf = (a) => a.spend;
        formatValue = (v) => formatCurrency(v, displayCurrency);
        extra = (a) => (
          <div className="mt-1 text-[10px] text-muted-foreground">
            {a.deals.size} deal{a.deals.size === 1 ? "" : "s"} · avg {formatCurrency(a.deals.size ? a.spend / a.deals.size : 0, displayCurrency)} / deal
          </div>
        );
        break;
      case "totalRevenue":
        valueOf = (a) => a.revenue;
        formatValue = (v) => formatCurrency(v, displayCurrency);
        extra = (a) => {
          const profit = a.revenue - a.spend;
          return (
            <div className="mt-1 text-[10px] text-muted-foreground">
              Spend: {formatCurrency(a.spend, displayCurrency)} ·{" "}
              <span className={profit >= 0 ? "text-success" : "text-destructive"}>
                Profit: {profit >= 0 ? "+" : ""}{formatCurrency(profit, displayCurrency)}
              </span>
            </div>
          );
        };
        break;
      case "roi":
        filtered = aggs.filter((a) => a.spend > 0);
        valueOf = (a) => ((a.revenue - a.spend) / a.spend) * 100;
        formatValue = (v) => `${v >= 0 ? "+" : ""}${v.toFixed(1)} %`;
        extra = (a) => (
          <div className="mt-1 text-[10px] text-muted-foreground">
            Spend: {formatCurrency(a.spend, displayCurrency)} · Revenue: {formatCurrency(a.revenue, displayCurrency)}
          </div>
        );
        break;
      case "avgEngagement":
        filtered = aggs.filter((a) => a.engagementRates.length > 0);
        valueOf = (a) => a.engagementRates.reduce((s, x) => s + x, 0) / a.engagementRates.length;
        formatValue = (v) => formatPercent(v);
        extra = (a) => (
          <div className="mt-1 text-[10px] text-muted-foreground">
            {formatNumber(a.views)} views · {formatNumber(a.likes + a.comments)} interactions
          </div>
        );
        break;
    }

    const items = filtered
      .map((a) => ({ a, v: valueOf(a) }))
      .filter(({ v }) => Number.isFinite(v))
      .sort((x, y) => y.v - x.v)
      .map(({ a }) => a);

    return { items, valueOf, formatValue, extra, platformTotals, empty };
  }, [metric, rows, displayCurrency, rates]);

  const maxValue = items.length ? Math.abs(valueOf(items[0])) : 0;

  return (
    <Sheet open={open} onOpenChange={(o) => { if (!o) onClose(); }}>
      <SheetContent side="right" className="w-full overflow-y-auto sm:max-w-xl">
        <SheetHeader>
          <SheetTitle>{metric ? METRIC_TITLES[metric] : ""}</SheetTitle>
          <SheetDescription>
            {items.length} influencer{items.length === 1 ? "" : "s"} · click a row to view details
          </SheetDescription>
        </SheetHeader>

        {metric === "campaigns" && (
          <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
            {(["YouTube", "Instagram", "YB Shorts", "Story"] as const).map((p) => (
              <div key={p} className="rounded-md border border-border bg-muted/30 p-2">
                <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{p}</div>
                <div className="text-sm font-bold text-foreground">{formatNumber(platformTotals[p] ?? 0)}</div>
              </div>
            ))}
          </div>
        )}

        {empty ? (
          <div className="mt-8 rounded-md border border-dashed border-border bg-muted/20 p-8 text-center text-sm text-muted-foreground">
            No stories logged yet. Use the <span className="font-semibold text-foreground">Log Story</span> button on any influencer to start tracking.
          </div>
        ) : items.length === 0 ? (
          <div className="mt-8 rounded-md border border-dashed border-border bg-muted/20 p-8 text-center text-sm text-muted-foreground">
            No data available for this metric.
          </div>
        ) : (
          <div className="mt-4 space-y-2">
            {items.map((a, i) => {
              const v = valueOf(a);
              const pct = maxValue > 0 ? Math.max(2, (Math.abs(v) / maxValue) * 100) : 0;
              const rank = i + 1;
              const isMedal = metric === "totalViews" && rank <= 3;
              const medalColor = rank === 1 ? "text-yellow-400" : rank === 2 ? "text-zinc-300" : "text-amber-600";
              const valueClass =
                metric === "roi" ? (v >= 0 ? "text-success" : "text-destructive") :
                metric === "totalRevenue" && v > 0 ? "text-success" :
                undefined;
              return (
                <button
                  key={a.key}
                  onClick={() => onSelectInfluencer?.(a.influencer, a.country)}
                  className="group block w-full rounded-md border border-border bg-card p-3 text-left transition-colors hover:border-primary/40 hover:bg-card-hover"
                >
                  <div className="flex items-center gap-3">
                    <div className={cn("w-8 shrink-0 text-center text-sm font-bold", isMedal ? medalColor : "text-muted-foreground")}>
                      {isMedal ? (rank === 1 ? "🥇" : rank === 2 ? "🥈" : "🥉") : `#${rank}`}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        {hasFlag(a.country)
                          ? <FlagIcon code={a.country} width={16} height={11} />
                          : <span className="text-base">{COUNTRY_FLAGS[a.country] ?? ""}</span>}
                        <span className="truncate text-sm font-semibold text-foreground">{a.influencer}</span>
                      </div>
                      <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-muted">
                        <div
                          className={cn(
                            "h-full rounded-full transition-all",
                            valueClass === "text-destructive" ? "bg-destructive" : "bg-primary",
                          )}
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                      {extra(a)}
                    </div>
                    <div className={cn("shrink-0 text-right text-sm font-bold tabular-nums text-foreground", valueClass)}>
                      {formatValue(v)}
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
};
