import { useEffect, useMemo, useState } from "react";
import { format, startOfMonth, endOfMonth, addMonths, subMonths } from "date-fns";
import { ChevronLeft, ChevronRight, ArrowUp, ArrowDown, TrendingUp, BarChart3 } from "lucide-react";
import {
  ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip as RTooltip, BarChart, Bar, CartesianGrid,
} from "recharts";

import { supabase } from "@/integrations/supabase/client";
import { convertCurrency, normalizeCurrency } from "@/lib/currency";
import { formatNumber, formatCurrency, formatPercent, formatCompact } from "@/lib/formatters";
import { cn } from "@/lib/utils";
import { useCurrencySettings } from "@/hooks/useCurrencySettings";
import { toastError } from "@/lib/toast-helpers";

import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Skeleton } from "@/components/ui/skeleton";

interface Props {
  creatorId: string;
}

interface CampaignRow {
  id: string;
  publish_date: string | null;
  views: number | null;
  engagement_rate: number | string | null;
  deal_id: string | null;
}

interface DealRow {
  id: string;
  product_id: string | null;
}

interface ProductRow {
  id: string;
  cost: number | string | null;
  currency: string | null;
}

interface MonthAgg {
  views: number;
  posts: number;
  engagements: number[];
  productCost: number;
}

const num = (v: unknown): number => {
  if (v == null) return 0;
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? n : 0;
};

const aggregateMonth = (m: MonthAgg) => ({
  views: m.views,
  posts: m.posts,
  productCost: m.productCost,
  engagement: m.engagements.length ? m.engagements.reduce((a, b) => a + b, 0) / m.engagements.length : null,
});

export const CreatorPerformancePanel = ({ creatorId }: Props) => {
  const { eurCzkRate } = useCurrencySettings();
  const [month, setMonth] = useState<Date>(() => startOfMonth(new Date()));
  const [campaigns, setCampaigns] = useState<CampaignRow[]>([]);
  const [dealCostMap, setDealCostMap] = useState<Map<string, number>>(new Map());
  const [loading, setLoading] = useState(true);

  // Fetch all campaigns for this creator (used for month + 6-month window)
  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      setLoading(true);
      try {
        // Pull last ~14 months of campaign rows for this creator (covers any month picker + 6mo trend)
        const earliest = format(startOfMonth(subMonths(new Date(), 18)), "yyyy-MM-dd");
        const { data: cdata, error: cerr } = await supabase
          .from("campaigns")
          .select("id,publish_date,views,engagement_rate,deal_id")
          .eq("influencer_id", creatorId)
          .gte("publish_date", earliest);
        if (cerr) throw cerr;
        const camps = (cdata ?? []) as unknown as CampaignRow[];
        if (cancelled) return;
        setCampaigns(camps);

        const dealIds = Array.from(new Set(camps.map((c) => c.deal_id).filter(Boolean))) as string[];
        if (dealIds.length === 0) {
          setDealCostMap(new Map());
          return;
        }
        const { data: deals } = await supabase
          .from("deals")
          .select("id,product_id")
          .in("id", dealIds);
        const dealRows = (deals ?? []) as DealRow[];
        const productIds = Array.from(new Set(dealRows.map((d) => d.product_id).filter(Boolean))) as string[];
        const { data: products } = productIds.length
          ? await supabase.from("products").select("id,cost,currency").in("id", productIds)
          : { data: [] as ProductRow[] };
        const productById = new Map((products ?? []).map((p) => [p.id, p as ProductRow]));
        const dCostMap = new Map<string, number>();
        for (const d of dealRows) {
          if (!d.product_id) continue;
          const p = productById.get(d.product_id);
          if (!p) continue;
          dCostMap.set(d.id, convertCurrency(num(p.cost), normalizeCurrency(p.currency), "CZK", { EUR_CZK: eurCzkRate }));
        }
        if (!cancelled) setDealCostMap(dCostMap);
      } catch (e) {
        toastError("Could not load creator performance", e);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    void load();
    return () => { cancelled = true; };
  }, [creatorId, eurCzkRate]);

  // Aggregate by month key
  const monthlyMap = useMemo(() => {
    const map = new Map<string, MonthAgg>();
    const dealsCountedPerMonth = new Map<string, Set<string>>();
    for (const c of campaigns) {
      if (!c.publish_date) continue;
      const key = c.publish_date.slice(0, 7); // yyyy-MM
      const cur = map.get(key) ?? { views: 0, posts: 0, engagements: [], productCost: 0 };
      cur.views += num(c.views);
      cur.posts += 1;
      if (c.engagement_rate != null) {
        const e = num(c.engagement_rate);
        if (Number.isFinite(e)) cur.engagements.push(e);
      }
      if (c.deal_id && dealCostMap.has(c.deal_id)) {
        const seen = dealsCountedPerMonth.get(key) ?? new Set<string>();
        if (!seen.has(c.deal_id)) {
          seen.add(c.deal_id);
          dealsCountedPerMonth.set(key, seen);
          cur.productCost += dealCostMap.get(c.deal_id) ?? 0;
        }
      }
      map.set(key, cur);
    }
    return map;
  }, [campaigns, dealCostMap]);

  const getMonth = (d: Date) => {
    const key = format(d, "yyyy-MM");
    return aggregateMonth(monthlyMap.get(key) ?? { views: 0, posts: 0, engagements: [], productCost: 0 });
  };

  const current = useMemo(() => getMonth(month), [month, monthlyMap]);
  const previous = useMemo(() => getMonth(subMonths(month, 1)), [month, monthlyMap]);

  const isCurrentMonth = format(month, "yyyy-MM") === format(startOfMonth(new Date()), "yyyy-MM");

  const trend = useMemo(() => {
    const out: { month: string; label: string; views: number; posts: number }[] = [];
    for (let i = 5; i >= 0; i--) {
      const d = subMonths(month, i);
      const m = getMonth(d);
      out.push({
        month: format(d, "yyyy-MM"),
        label: format(d, "MMM"),
        views: m.views,
        posts: m.posts,
      });
    }
    return out;
  }, [month, monthlyMap]);

  const pctChange = (cur: number, prev: number): number | null => {
    if (!Number.isFinite(cur) || !Number.isFinite(prev)) return null;
    if (prev === 0) return cur === 0 ? 0 : null;
    return ((cur - prev) / Math.abs(prev)) * 100;
  };

  return (
    <TooltipProvider>
      <Card className="mt-5 relative overflow-hidden border-primary/30 bg-gradient-to-br from-card via-card to-primary/5 p-5 shadow-[0_0_24px_-12px_hsl(var(--primary)/0.4)]">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="bg-gradient-to-r from-primary via-[hsl(var(--platform-instagram))] to-primary bg-clip-text text-sm font-bold uppercase tracking-wider text-transparent">
              Monthly Performance
            </h3>
            <p className="text-xs text-muted-foreground">Stats for this creator in the selected month</p>
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

        {loading ? (
          <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
            {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-20 bg-muted/30" />)}
          </div>
        ) : (
          <>
            <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
              <Metric
                label="Total Views"
                value={formatNumber(current.views)}
                change={pctChange(current.views, previous.views)}
                accent="cyan"
              />
              <Metric
                label="Avg Engagement"
                value={current.engagement == null ? "—" : formatPercent(current.engagement)}
                change={current.engagement != null && previous.engagement != null ? pctChange(current.engagement, previous.engagement) : null}
                accent="pink"
              />
              <Metric
                label="Posts"
                value={formatNumber(current.posts)}
                change={pctChange(current.posts, previous.posts)}
                accent="cyan"
              />
              <Metric
                label="Product Cost"
                value={formatCurrency(current.productCost)}
                change={pctChange(current.productCost, previous.productCost)}
                accent="pink"
                inverse
              />
              <ComingSoon label="Sales Revenue" hint="Coming soon — Shoptet API integration" />
              <ComingSoon label="Traffic Impact" hint="Coming soon — Google Analytics integration" />
            </div>

            <div className="mt-5 grid grid-cols-1 gap-3 lg:grid-cols-2">
              {/* Performance Trend */}
              <Card className="border-primary/30 bg-background/40 p-4 shadow-[0_0_18px_-8px_hsl(var(--primary)/0.5)]">
                <div className="mb-2 flex items-center gap-2 text-[10px] uppercase tracking-wider text-muted-foreground">
                  <TrendingUp className="h-3.5 w-3.5 text-primary" />
                  Performance Trend (last 6 months · views)
                </div>
                <ResponsiveContainer width="100%" height={140}>
                  <LineChart data={trend} margin={{ top: 6, right: 12, left: 0, bottom: 0 }}>
                    <defs>
                      <linearGradient id="creatorViewLine" x1="0" y1="0" x2="1" y2="0">
                        <stop offset="0%" stopColor="hsl(var(--primary))" />
                        <stop offset="100%" stopColor="hsl(var(--platform-instagram))" />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis dataKey="label" tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }} />
                    <YAxis tickFormatter={(v) => formatCompact(Number(v))} tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }} width={40} />
                    <RTooltip
                      contentStyle={{ background: "hsl(var(--popover))", border: "1px solid hsl(var(--border))" }}
                      formatter={(v: number) => [formatNumber(v), "Views"]}
                    />
                    <Line
                      type="monotone"
                      dataKey="views"
                      stroke="url(#creatorViewLine)"
                      strokeWidth={2.5}
                      dot={{ r: 3, fill: "hsl(var(--primary))" }}
                      activeDot={{ r: 5 }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </Card>

              {/* Content Output */}
              <Card className="border-primary/30 bg-background/40 p-4 shadow-[0_0_18px_-8px_hsl(var(--platform-instagram)/0.5)]">
                <div className="mb-2 flex items-center gap-2 text-[10px] uppercase tracking-wider text-muted-foreground">
                  <BarChart3 className="h-3.5 w-3.5" style={{ color: "hsl(var(--platform-instagram))" }} />
                  Content Output (posts per month)
                </div>
                <ResponsiveContainer width="100%" height={140}>
                  <BarChart data={trend} layout="vertical" margin={{ top: 4, right: 12, left: 0, bottom: 0 }}>
                    <XAxis type="number" hide />
                    <YAxis
                      type="category"
                      dataKey="label"
                      tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }}
                      width={40}
                    />
                    <RTooltip
                      contentStyle={{ background: "hsl(var(--popover))", border: "1px solid hsl(var(--border))" }}
                      formatter={(v: number) => [`${v} post${v === 1 ? "" : "s"}`, "Posts"]}
                      cursor={{ fill: "hsl(var(--muted)/0.2)" }}
                    />
                    <Bar
                      dataKey="posts"
                      fill="hsl(var(--platform-instagram))"
                      radius={[0, 4, 4, 0]}
                      style={{ filter: "drop-shadow(0 0 6px hsl(var(--platform-instagram)/0.5))" }}
                    />
                  </BarChart>
                </ResponsiveContainer>
              </Card>
            </div>
          </>
        )}
      </Card>
    </TooltipProvider>
  );
};

const Metric = ({
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
  const cls = inverse
    ? positive ? "text-destructive" : negative ? "text-success" : "text-muted-foreground"
    : positive ? "text-success" : negative ? "text-destructive" : "text-muted-foreground";
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
        <div className={cn("mt-1 flex items-center gap-1 text-[10px] font-semibold", cls)}>
          {positive ? <ArrowUp className="h-3 w-3" /> : negative ? <ArrowDown className="h-3 w-3" /> : null}
          <span>{Math.abs(change).toFixed(1)}% vs last month</span>
        </div>
      )}
    </Card>
  );
};

const ComingSoon = ({ label, hint }: { label: string; hint: string }) => (
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

export default CreatorPerformancePanel;