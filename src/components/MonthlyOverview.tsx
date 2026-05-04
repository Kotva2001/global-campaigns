import { useEffect, useMemo, useState } from "react";
import { format, startOfMonth, endOfMonth, addMonths, subMonths } from "date-fns";
import { ChevronLeft, ChevronRight, ArrowUp, ArrowDown, Trophy, Youtube, Instagram } from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import { convertCurrency, normalizeCurrency } from "@/lib/currency";
import { formatNumber, formatCurrency, formatPercent, formatCompact } from "@/lib/formatters";
import { cn } from "@/lib/utils";
import { useCurrencySettings } from "@/hooks/useCurrencySettings";
import { toastError } from "@/lib/toast-helpers";

import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Skeleton } from "@/components/ui/skeleton";
import { PerformanceScoreBadge } from "@/components/PerformanceScoreBadge";
import { useCreatorScores } from "@/hooks/useCreatorScores";

interface MonthlyStats {
  totalViews: number;
  avgEngagement: number | null;
  activeCampaigns: number;
  productCost: number;
  ytViews: number;
  igViews: number;
  topCreator: { id: string; name: string; views: number; engagement: number | null } | null;
  topCreators: { id: string; name: string; views: number; engagement: number | null }[];
}

interface CampaignFetchRow {
  id: string;
  influencer_id: string | null;
  platform: string;
  publish_date: string | null;
  views: number | null;
  engagement_rate: number | string | null;
  deal_id: string | null;
}

interface DealFetchRow {
  id: string;
  product_id: string | null;
  total_cost: number | string | null;
  currency: string | null;
}

interface ProductFetchRow {
  id: string;
  cost: number | string | null;
  currency: string | null;
}

const num = (v: unknown): number => {
  if (v == null) return 0;
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? n : 0;
};

const normalizePlatform = (p: string): "YouTube" | "Instagram" | "Other" => {
  const v = (p ?? "").toLowerCase();
  if (v.includes("insta") || v === "story" || v.includes("storie")) return "Instagram";
  if (v.includes("you") || v.includes("short")) return "YouTube";
  return "Other";
};

const fetchMonthStats = async (
  monthStart: Date,
  eurCzkRate: number,
): Promise<MonthlyStats> => {
  const start = format(startOfMonth(monthStart), "yyyy-MM-dd");
  const end = format(endOfMonth(monthStart), "yyyy-MM-dd");

  const { data: campaignData, error: cErr } = await supabase
    .from("campaigns")
    .select("id, influencer_id, platform, publish_date, views, engagement_rate, deal_id")
    .gte("publish_date", start)
    .lte("publish_date", end);
  if (cErr) throw cErr;
  const campaigns = (campaignData ?? []) as unknown as CampaignFetchRow[];

  const influencerIds = Array.from(new Set(campaigns.map((c) => c.influencer_id).filter(Boolean))) as string[];
  const dealIds = Array.from(new Set(campaigns.map((c) => c.deal_id).filter(Boolean))) as string[];

  const [{ data: infs }, { data: deals }] = await Promise.all([
    influencerIds.length
      ? supabase.from("influencers").select("id,name").in("id", influencerIds)
      : Promise.resolve({ data: [] as { id: string; name: string }[] }),
    dealIds.length
      ? supabase.from("deals").select("id,product_id,total_cost,currency").in("id", dealIds)
      : Promise.resolve({ data: [] as DealFetchRow[] }),
  ]);

  const influencerById = new Map((infs ?? []).map((i) => [i.id, i.name]));
  const dealById = new Map((deals ?? []).map((d) => [d.id, d as DealFetchRow]));

  const productIds = Array.from(new Set((deals ?? []).map((d) => d.product_id).filter(Boolean))) as string[];
  const { data: products } = productIds.length
    ? await supabase.from("products").select("id,cost,currency").in("id", productIds)
    : { data: [] as ProductFetchRow[] };
  const productById = new Map((products ?? []).map((p) => [p.id, p as ProductFetchRow]));

  let totalViews = 0;
  let ytViews = 0;
  let igViews = 0;
  const engagements: number[] = [];
  let productCost = 0;
  const dealsCounted = new Set<string>();
  const creatorViews = new Map<string, { name: string; views: number; eng: number[] }>();

  for (const c of campaigns) {
    const v = num(c.views);
    totalViews += v;
    const plat = normalizePlatform(c.platform);
    if (plat === "YouTube") ytViews += v;
    else if (plat === "Instagram") igViews += v;
    if (c.engagement_rate != null) {
      const e = num(c.engagement_rate);
      if (Number.isFinite(e)) engagements.push(e);
    }
    if (c.deal_id && !dealsCounted.has(c.deal_id)) {
      dealsCounted.add(c.deal_id);
      const deal = dealById.get(c.deal_id);
      if (deal?.product_id) {
        const product = productById.get(deal.product_id);
        if (product) {
          productCost += convertCurrency(num(product.cost), normalizeCurrency(product.currency), "CZK", { EUR_CZK: eurCzkRate });
        }
      }
    }
    if (c.influencer_id) {
      const name = influencerById.get(c.influencer_id) ?? "Unknown";
      const cur = creatorViews.get(c.influencer_id) ?? { name, views: 0, eng: [] };
      cur.views += v;
      if (c.engagement_rate != null) {
        const e = num(c.engagement_rate);
        if (Number.isFinite(e)) cur.eng.push(e);
      }
      creatorViews.set(c.influencer_id, cur);
    }
  }

  const creatorList = Array.from(creatorViews.entries()).map(([id, c]) => ({
    id,
    name: c.name,
    views: c.views,
    engagement: c.eng.length ? c.eng.reduce((a, b) => a + b, 0) / c.eng.length : null,
  }));
  creatorList.sort((a, b) => b.views - a.views);
  const topCreator = creatorList[0] ?? null;
  const topCreators = creatorList.slice(0, 5);

  return {
    totalViews,
    avgEngagement: engagements.length ? engagements.reduce((a, b) => a + b, 0) / engagements.length : null,
    activeCampaigns: campaigns.length,
    productCost,
    ytViews,
    igViews,
    topCreator,
    topCreators,
  };
};

const initials = (name: string) =>
  name
    .split(/\s+/)
    .map((s) => s[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();

export const MonthlyOverview = () => {
  const { eurCzkRate } = useCurrencySettings();
  const { scores } = useCreatorScores();
  const [month, setMonth] = useState<Date>(() => startOfMonth(new Date()));
  const [current, setCurrent] = useState<MonthlyStats | null>(null);
  const [previous, setPrevious] = useState<MonthlyStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      setLoading(true);
      try {
        const [cur, prev] = await Promise.all([
          fetchMonthStats(month, eurCzkRate),
          fetchMonthStats(subMonths(month, 1), eurCzkRate),
        ]);
        if (cancelled) return;
        setCurrent(cur);
        setPrevious(prev);
      } catch (e) {
        toastError("Could not load monthly overview", e);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    void load();
    return () => { cancelled = true; };
  }, [month, eurCzkRate]);

  const isCurrentMonth = useMemo(
    () => format(month, "yyyy-MM") === format(startOfMonth(new Date()), "yyyy-MM"),
    [month],
  );

  const pctChange = (cur: number, prev: number): number | null => {
    if (!Number.isFinite(cur) || !Number.isFinite(prev)) return null;
    if (prev === 0) return cur === 0 ? 0 : null;
    return ((cur - prev) / Math.abs(prev)) * 100;
  };

  const ytPct = current && current.totalViews > 0 ? (current.ytViews / current.totalViews) * 100 : 0;
  const igPct = current && current.totalViews > 0 ? (current.igViews / current.totalViews) * 100 : 0;

  return (
    <TooltipProvider>
      <Card className="relative overflow-hidden border-primary/30 bg-gradient-to-br from-card via-card to-primary/5 p-5 shadow-[0_0_30px_-12px_hsl(var(--primary)/0.4)]">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="bg-gradient-to-r from-primary via-[hsl(var(--platform-instagram))] to-primary bg-clip-text text-base font-bold uppercase tracking-wider text-transparent">
              Monthly Performance Overview
            </h2>
            <p className="text-xs text-muted-foreground">Snapshot for the selected month</p>
          </div>
          <div className="flex items-center gap-2 rounded-md border border-primary/40 bg-background/40 px-2 py-1 shadow-[0_0_12px_-4px_hsl(var(--primary)/0.6)]">
            <Button
              variant="ghost"
              size="sm"
              className="h-7 w-7 p-0 text-primary hover:bg-primary/10 hover:text-primary"
              onClick={() => setMonth((m) => startOfMonth(subMonths(m, 1)))}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <div className="min-w-[120px] text-center text-sm font-semibold">{format(month, "MMMM yyyy")}</div>
            <Button
              variant="ghost"
              size="sm"
              className="h-7 w-7 p-0 text-primary hover:bg-primary/10 hover:text-primary disabled:opacity-30"
              onClick={() => setMonth((m) => startOfMonth(addMonths(m, 1)))}
              disabled={isCurrentMonth}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {loading || !current ? (
          <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
            {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-24 bg-muted/30" />)}
          </div>
        ) : (
          <>
            <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
              <MetricCard
                label="Total Views"
                value={formatNumber(current.totalViews)}
                change={previous ? pctChange(current.totalViews, previous.totalViews) : null}
                accent="cyan"
              />
              <MetricCard
                label="Avg Engagement"
                value={current.avgEngagement == null ? "—" : formatPercent(current.avgEngagement)}
                change={previous && current.avgEngagement != null && previous.avgEngagement != null
                  ? pctChange(current.avgEngagement, previous.avgEngagement)
                  : null}
                accent="pink"
              />
              <MetricCard
                label="Active Campaigns"
                value={formatNumber(current.activeCampaigns)}
                change={previous ? pctChange(current.activeCampaigns, previous.activeCampaigns) : null}
                accent="cyan"
              />
              <MetricCard
                label="Product Cost"
                value={formatCurrency(current.productCost)}
                change={previous ? pctChange(current.productCost, previous.productCost) : null}
                accent="pink"
                inverse
              />
              <ComingSoonCard label="Sales Revenue" hint="Coming soon — Shoptet API integration" />
              <ComingSoonCard label="Traffic Impact" hint="Coming soon — Google Analytics integration" />
            </div>

            <div className="mt-5 grid grid-cols-1 gap-3 lg:grid-cols-3">
              {/* Top creator */}
              <Card className="border-primary/30 bg-background/40 p-4 shadow-[0_0_18px_-8px_hsl(var(--primary)/0.5)]">
                <div className="mb-2 flex items-center gap-2 text-[10px] uppercase tracking-wider text-muted-foreground">
                  <Trophy className="h-3.5 w-3.5 text-primary" />
                  Top Creator
                </div>
                {current.topCreator ? (
                  <div className="flex items-center gap-3">
                    <Avatar className="h-12 w-12 border border-primary/40 shadow-[0_0_10px_-2px_hsl(var(--primary)/0.6)]">
                      <AvatarFallback className="bg-primary/10 text-sm font-bold text-primary">
                        {initials(current.topCreator.name)}
                      </AvatarFallback>
                    </Avatar>
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm font-bold">{current.topCreator.name}</div>
                      <div className="text-xs text-muted-foreground">
                        {formatNumber(current.topCreator.views)} views ·{" "}
                        {current.topCreator.engagement == null ? "—" : formatPercent(current.topCreator.engagement)} engagement
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="text-sm text-muted-foreground">No creator data this month.</div>
                )}
              </Card>

              {/* Platform split */}
              <Card className="border-primary/30 bg-background/40 p-4 lg:col-span-2 shadow-[0_0_18px_-8px_hsl(var(--platform-instagram)/0.5)]">
                <div className="mb-2 flex items-center justify-between text-[10px] uppercase tracking-wider text-muted-foreground">
                  <span>Platform Split (views)</span>
                  <span className="text-muted-foreground/70">{formatCompact(current.totalViews)} total</span>
                </div>
                {current.totalViews === 0 ? (
                  <div className="text-sm text-muted-foreground">No views this month.</div>
                ) : (
                  <>
                    <div className="mt-2 flex h-6 w-full overflow-hidden rounded-full border border-border bg-muted/20">
                      {ytPct > 0 && (
                        <div
                          className="h-full transition-all"
                          style={{
                            width: `${ytPct}%`,
                            background: "linear-gradient(90deg, hsl(var(--platform-youtube)), hsl(var(--platform-youtube)/0.7))",
                            boxShadow: "0 0 12px hsl(var(--platform-youtube)/0.6) inset",
                          }}
                        />
                      )}
                      {igPct > 0 && (
                        <div
                          className="h-full transition-all"
                          style={{
                            width: `${igPct}%`,
                            background: "linear-gradient(90deg, hsl(var(--platform-instagram)), hsl(var(--platform-instagram)/0.7))",
                            boxShadow: "0 0 12px hsl(var(--platform-instagram)/0.6) inset",
                          }}
                        />
                      )}
                    </div>
                    <div className="mt-3 flex flex-wrap gap-4 text-xs">
                      <div className="flex items-center gap-2">
                        <Youtube className="h-3.5 w-3.5" style={{ color: "hsl(var(--platform-youtube))" }} />
                        <span className="font-semibold" style={{ color: "hsl(var(--platform-youtube))" }}>
                          YouTube
                        </span>
                        <span className="text-muted-foreground">
                          {formatNumber(current.ytViews)} ({ytPct.toFixed(1)}%)
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Instagram className="h-3.5 w-3.5" style={{ color: "hsl(var(--platform-instagram))" }} />
                        <span className="font-semibold" style={{ color: "hsl(var(--platform-instagram))" }}>
                          Instagram
                        </span>
                        <span className="text-muted-foreground">
                          {formatNumber(current.igViews)} ({igPct.toFixed(1)}%)
                        </span>
                      </div>
                    </div>
                  </>
                )}
              </Card>
            </div>
          </>
        )}
      </Card>
    </TooltipProvider>
  );
};

const MetricCard = ({
  label,
  value,
  change,
  accent = "cyan",
  inverse = false,
}: {
  label: string;
  value: string;
  change: number | null;
  accent?: "cyan" | "pink";
  inverse?: boolean;
}) => {
  const accentColor = accent === "pink" ? "hsl(var(--platform-instagram))" : "hsl(var(--primary))";
  const positive = change != null && change > 0.05;
  const negative = change != null && change < -0.05;
  // For "inverse" metrics (cost), up is bad, down is good
  const goodUp = inverse ? negative : positive;
  const goodDown = inverse ? positive : negative;
  return (
    <Card
      className="relative overflow-hidden border-border/60 bg-background/40 p-3 transition-all hover:border-primary/40"
      style={{ boxShadow: `0 0 14px -8px ${accentColor}` }}
    >
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className="mt-1 text-lg font-bold" style={{ color: accentColor }}>{value}</div>
      {change == null ? (
        <div className="mt-1 text-[10px] text-muted-foreground/60">vs last month: —</div>
      ) : (
        <div className={cn(
          "mt-1 flex items-center gap-1 text-[10px] font-semibold",
          goodUp || (positive && !inverse) ? "text-success" : "",
          goodDown || (negative && !inverse) ? "text-destructive" : "",
        )}>
          {positive ? <ArrowUp className="h-3 w-3" /> : negative ? <ArrowDown className="h-3 w-3" /> : null}
          <span>{Math.abs(change).toFixed(1)}% vs last month</span>
        </div>
      )}
    </Card>
  );
};

const ComingSoonCard = ({ label, hint }: { label: string; hint: string }) => (
  <Tooltip>
    <TooltipTrigger asChild>
      <Card className="relative overflow-hidden border-dashed border-border/40 bg-background/20 p-3 opacity-60 transition-opacity hover:opacity-90">
        <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</div>
        <div className="mt-1 text-lg font-bold text-muted-foreground/60">—</div>
        <div className="mt-1 text-[10px] italic text-muted-foreground/50">Coming soon</div>
      </Card>
    </TooltipTrigger>
    <TooltipContent>{hint}</TooltipContent>
  </Tooltip>
);

export default MonthlyOverview;