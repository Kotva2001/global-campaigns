import { useEffect, useMemo, useState } from "react";
import { format, parseISO, startOfMonth } from "date-fns";
import { CalendarIcon } from "lucide-react";
import { toast } from "sonner";
import { toastError } from "@/lib/toast-helpers";
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, Legend,
  AreaChart, Area, PieChart, Pie, Cell, LabelList,
} from "recharts";

import { supabase } from "@/integrations/supabase/client";
import { COUNTRIES, COUNTRY_FLAGS, COUNTRY_NAMES } from "@/lib/countries";
import { computeKPIs } from "@/lib/calculations";
import { convertCurrency, normalizeCurrency, type CurrencyCode } from "@/lib/currency";
import { formatCompact, formatCurrency, formatNumber, formatPercent } from "@/lib/formatters";
import { cn } from "@/lib/utils";
import { useCurrencySettings } from "@/hooks/useCurrencySettings";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";

interface CampaignRow {
  id: string;
  influencer_id: string | null;
  campaign_name: string | null;
  platform: string;
  publish_date: string | null;
  campaign_cost: number | string | null;
  currency: string | null;
  views: number | null;
  engagement_rate: number | string | null;
  purchase_revenue: number | string | null;
}

interface InfluencerLookupRow {
  id: string;
  name: string;
  country: string;
}

interface Row {
  id: string;
  campaign: string;
  platform: "YouTube" | "Instagram" | "YB Shorts" | "Story";
  date: Date | null;
  dateIso: string | null;
  cost: number;
  currency: CurrencyCode;
  views: number;
  engagement: number | null;
  revenue: number;
  influencer: string;
  country: string;
}

const PLATFORM_COLOR: Record<Row["platform"], string> = {
  YouTube: "hsl(var(--platform-youtube))",
  Instagram: "hsl(var(--platform-instagram))",
  "YB Shorts": "hsl(var(--platform-shorts))",
  Story: "hsl(var(--platform-story))",
};

const COUNTRY_COLORS = [
  "hsl(160 84% 50%)", "hsl(217 91% 60%)", "hsl(330 81% 60%)", "hsl(0 84% 60%)",
  "hsl(38 92% 50%)", "hsl(280 70% 60%)", "hsl(199 89% 48%)", "hsl(142 71% 45%)",
  "hsl(25 95% 53%)", "hsl(190 60% 50%)", "hsl(60 80% 55%)",
];

const num = (v: unknown): number => {
  if (v == null) return 0;
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? n : 0;
};

const normalizePlatform = (p: string): Row["platform"] => {
  const v = p.toLowerCase();
  if (v === "story" || v.includes("storie")) return "Story";
  if (v.includes("short")) return "YB Shorts";
  if (v.includes("insta")) return "Instagram";
  return "YouTube";
};

const Analytics = () => {
  const { eurCzkRate } = useCurrencySettings();
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [from, setFrom] = useState<Date | undefined>();
  const [to, setTo] = useState<Date | undefined>();
  const [country, setCountry] = useState<string>("All");
  const [platform, setPlatform] = useState<string>("All");
  const [showAllInfluencers, setShowAllInfluencers] = useState(false);
  const [rankMetric, setRankMetric] = useState<"views" | "roi" | "revenue" | "engagement">("views");
  const [page, setPage] = useState(0);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      const { data, error } = await supabase
        .from("campaigns")
        .select("id, influencer_id, campaign_name, platform, publish_date, campaign_cost, currency, views, engagement_rate, purchase_revenue");
      if (error) {
        toastError("Could not load campaigns", error);
        setLoading(false);
        return;
      }
      const campaignRows = (data ?? []) as unknown as CampaignRow[];
      const influencerIds = [...new Set(campaignRows.map((row) => row.influencer_id).filter(Boolean))] as string[];
      const { data: influencers, error: influencerError } = influencerIds.length
        ? await supabase.from("influencers").select("id,name,country").in("id", influencerIds)
        : { data: [], error: null };
      if (influencerError) {
        toastError("Could not load creators", influencerError);
        setLoading(false);
        return;
      }
      const influencerById = new Map((influencers ?? []).map((influencer: InfluencerLookupRow) => [influencer.id, influencer]));
      const mapped: Row[] = campaignRows.map((r) => {
        const influencer = r.influencer_id ? influencerById.get(r.influencer_id) : undefined;
        const currency = normalizeCurrency(r.currency);
        return {
        id: r.id,
        campaign: r.campaign_name ?? "",
        platform: normalizePlatform(r.platform),
        date: r.publish_date ? parseISO(r.publish_date) : null,
        dateIso: r.publish_date,
        cost: convertCurrency(num(r.campaign_cost), currency, "CZK", { EUR_CZK: eurCzkRate }),
        currency,
        views: num(r.views),
        engagement: r.engagement_rate == null ? null : num(r.engagement_rate),
        revenue: convertCurrency(num(r.purchase_revenue), currency, "CZK", { EUR_CZK: eurCzkRate }),
        influencer: influencer?.name ?? "",
        country: influencer?.country ?? "",
        };
      });
      setRows(mapped);
      const dated = mapped.map((row) => row.date).filter((date): date is Date => !!date).sort((a, b) => a.getTime() - b.getTime());
      if (dated.length) {
        setFrom((current) => current ?? dated[0]);
        setTo((current) => current ?? new Date());
      }
      setLoading(false);
    };
    void load();
  }, [eurCzkRate]);

  const filtered = useMemo(() => {
    return rows.filter((r) => {
      if (country !== "All" && r.country !== country) return false;
      if (platform !== "All" && r.platform !== platform) return false;
      if (from && (!r.date || r.date < from)) return false;
      if (to && (!r.date || r.date > to)) return false;
      return true;
    });
  }, [rows, country, platform, from, to]);

  const kpis = useMemo(() => {
    const summary = computeKPIs(filtered.map((r) => ({
      id: r.id,
      influencerId: r.id,
      dealId: null,
      country: r.country,
      influencer: r.influencer,
      campaignName: r.campaign,
      platform: r.platform,
      publishDate: r.dateIso ?? "",
      publishDateIso: r.dateIso,
      videoLink: "",
      collaborationType: "",
      currency: "CZK",
      campaignCost: r.cost,
      utmLink: "",
      managedBy: "",
      views: r.views,
      likes: null,
      comments: null,
      sessions: null,
      engagementRate: r.engagement,
      purchaseRevenue: r.revenue,
      conversionRate: null,
    })), "CZK", { EUR_CZK: eurCzkRate });
    return { campaigns: summary.campaigns, spend: summary.totalSpend, revenue: summary.totalRevenue, profit: summary.totalRevenue - summary.totalSpend, roi: summary.roi };
  }, [filtered]);

  // Chart 1: Revenue vs Cost by influencer
  const byInfluencer = useMemo(() => {
    const m = new Map<string, { name: string; cost: number; revenue: number }>();
    for (const r of filtered) {
      if (!r.influencer) continue;
      const key = `${r.country}|${r.influencer}`;
      const cur = m.get(key) ?? { name: r.influencer, cost: 0, revenue: 0 };
      cur.cost += r.cost;
      cur.revenue += r.revenue;
      m.set(key, cur);
    }
    return Array.from(m.values()).sort((a, b) => b.cost - a.cost);
  }, [filtered]);

  const influencerData = showAllInfluencers ? byInfluencer : byInfluencer.slice(0, 10);

  // Chart 2: Views over time, stacked by country
  const viewsOverTime = useMemo(() => {
    const months = new Map<string, Record<string, number | string>>();
    const countriesUsed = new Set<string>();
    for (const r of filtered) {
      if (!r.date) continue;
      const key = format(startOfMonth(r.date), "yyyy-MM");
      const bucket = months.get(key) ?? { month: key };
      bucket[r.country] = (bucket[r.country] as number ?? 0) + r.views;
      months.set(key, bucket);
      if (r.country) countriesUsed.add(r.country);
    }
    const sorted = Array.from(months.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([, v]) => v);
    return { data: sorted, countries: Array.from(countriesUsed).sort() };
  }, [filtered]);

  // Chart 3: Platform split
  const platformSplit = useMemo(() => {
    const counts: Record<Row["platform"], number> = { YouTube: 0, Instagram: 0, "YB Shorts": 0, Story: 0 };
    for (const r of filtered) counts[r.platform] += 1;
    return (Object.keys(counts) as Row["platform"][])
      .map((p) => ({ name: p, value: counts[p], color: PLATFORM_COLOR[p] }))
      .filter((d) => d.value > 0);
  }, [filtered]);

  // Chart 4: ROI by market
  const roiByMarket = useMemo(() => {
    const m = new Map<string, { spend: number; revenue: number }>();
    for (const r of filtered) {
      if (r.cost <= 0) continue;
      const cur = m.get(r.country) ?? { spend: 0, revenue: 0 };
      cur.spend += r.cost;
      cur.revenue += r.revenue;
      m.set(r.country, cur);
    }
    return Array.from(m.entries())
      .map(([c, v]) => ({
        country: c,
        label: `${COUNTRY_FLAGS[c] ?? ""} ${c}`,
        roi: ((v.revenue - v.spend) / v.spend) * 100,
      }))
      .sort((a, b) => b.roi - a.roi);
  }, [filtered]);

  // Top campaigns
  const ranked = useMemo(() => {
    const score = (r: Row) => {
      if (rankMetric === "views") return r.views;
      if (rankMetric === "revenue") return r.revenue;
      if (rankMetric === "engagement") return r.engagement ?? -1;
      return r.cost > 0 ? ((r.revenue - r.cost) / r.cost) * 100 : -Infinity;
    };
    return [...filtered].sort((a, b) => score(b) - score(a));
  }, [filtered, rankMetric]);

  const pageSize = 10;
  const pageRows = ranked.slice(page * pageSize, (page + 1) * pageSize);
  const totalPages = Math.max(1, Math.ceil(ranked.length / pageSize));
  useEffect(() => setPage(0), [country, platform, from, to, rankMetric]);

  return (
    <div>
      <header className="sticky top-0 z-20 border-b border-border bg-background/80 px-6 py-4 backdrop-blur">
        <div className="mb-3 flex items-center justify-between">
          <div>
            <h1 className="text-lg font-bold tracking-tight">Analytics</h1>
            <p className="text-xs text-muted-foreground">Campaign performance insights</p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <DateRange from={from} to={to} setFrom={setFrom} setTo={setTo} />
          <Select value={country} onValueChange={setCountry}>
            <SelectTrigger className="w-[180px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="All">🌍 All markets</SelectItem>
              {COUNTRIES.map((c) => (
                <SelectItem key={c} value={c}>{COUNTRY_FLAGS[c]} {COUNTRY_NAMES[c]}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={platform} onValueChange={setPlatform}>
            <SelectTrigger className="w-[150px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="All">All platforms</SelectItem>
              <SelectItem value="YouTube">YouTube</SelectItem>
              <SelectItem value="Instagram">Instagram</SelectItem>
              <SelectItem value="YB Shorts">YB Shorts</SelectItem>
              <SelectItem value="Story">Story</SelectItem>
            </SelectContent>
          </Select>
          {(from || to || country !== "All" || platform !== "All") && (
            <Button variant="ghost" size="sm" onClick={() => { setFrom(undefined); setTo(undefined); setCountry("All"); setPlatform("All"); }}>
              Clear filters
            </Button>
          )}
          <span className="ml-auto text-xs text-muted-foreground">{filtered.length} campaign{filtered.length === 1 ? "" : "s"}</span>
        </div>
      </header>

      <div className="space-y-6 px-6 py-6">
        {/* KPIs */}
        <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-5">
          <KpiCard label="Total Campaigns" value={formatNumber(kpis.campaigns)} />
          <KpiCard label="Total Spend" value={formatCurrency(kpis.spend)} />
          <KpiCard label="Total Revenue" value={formatCurrency(kpis.revenue)} valueClass={kpis.revenue > 0 ? "text-success" : undefined} />
          <KpiCard
            label="Net Profit"
            value={formatCurrency(kpis.profit)}
            valueClass={kpis.profit > 0 ? "text-success" : kpis.profit < 0 ? "text-destructive" : undefined}
          />
          <KpiCard
            label="Avg ROI"
            value={kpis.roi == null ? "—" : `${kpis.roi >= 0 ? "+" : ""}${kpis.roi.toFixed(1)}%`}
            valueClass={kpis.roi == null ? undefined : kpis.roi >= 0 ? "text-success" : "text-destructive"}
          />
        </div>

        {loading ? (
          <div className="space-y-4">
            <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
              {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-80 bg-card" />)}
            </div>
            <Skeleton className="h-96 bg-card" />
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
              {/* Chart 1 */}
              <Card className="border-border bg-card p-4">
                <div className="mb-3 flex items-center justify-between">
                  <div className="text-sm font-bold">Revenue vs Cost by Influencer</div>
                  {byInfluencer.length > 10 && (
                    <Button variant="ghost" size="sm" onClick={() => setShowAllInfluencers((v) => !v)}>
                      {showAllInfluencers ? "Show top 10" : "Show all"}
                    </Button>
                  )}
                </div>
                {influencerData.length === 0 ? (
                  <Empty />
                ) : (
                  <ResponsiveContainer width="100%" height={Math.max(280, influencerData.length * 36)}>
                    <BarChart data={influencerData} layout="vertical" margin={{ left: 12, right: 12 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                      <XAxis type="number" tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }} tickFormatter={(v) => formatCompact(v)} />
                      <YAxis type="category" dataKey="name" width={120} tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }} />
                      <Tooltip contentStyle={{ background: "hsl(var(--popover))", border: "1px solid hsl(var(--border))" }} formatter={(v: number) => formatCurrency(v)} />
                      <Legend wrapperStyle={{ fontSize: 12 }} />
                      <Bar dataKey="cost" name="Cost" fill="hsl(var(--collab-barter))" radius={[0, 4, 4, 0]}>
                        <LabelList dataKey="cost" position="right" formatter={(v: number) => formatCurrency(v)} style={{ fill: "hsl(var(--muted-foreground))", fontSize: 10 }} />
                      </Bar>
                      <Bar dataKey="revenue" name="Revenue" fill="hsl(var(--primary))" radius={[0, 4, 4, 0]}>
                        <LabelList dataKey="revenue" position="right" formatter={(v: number) => formatCurrency(v)} style={{ fill: "hsl(var(--muted-foreground))", fontSize: 10 }} />
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </Card>

              {/* Chart 2 */}
              <Card className="border-border bg-card p-4">
                <div className="mb-3 text-sm font-bold">Views Over Time by Market</div>
                {viewsOverTime.data.length === 0 ? (
                  <Empty />
                ) : (
                  <ResponsiveContainer width="100%" height={320}>
                    <AreaChart data={viewsOverTime.data}>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                      <XAxis dataKey="month" tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }} />
                      <YAxis tickFormatter={(v) => formatCompact(v)} tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }} />
                      <Tooltip
                        contentStyle={{ background: "hsl(var(--popover))", border: "1px solid hsl(var(--border))" }}
                        formatter={(v: number, name) => [formatNumber(v), `${COUNTRY_FLAGS[String(name)] ?? ""} ${name}`]}
                      />
                      <Legend wrapperStyle={{ fontSize: 12 }} />
                      {viewsOverTime.countries.map((c, i) => (
                        <Area
                          key={c}
                          type="monotone"
                          dataKey={c}
                          stackId="1"
                          stroke={COUNTRY_COLORS[i % COUNTRY_COLORS.length]}
                          fill={COUNTRY_COLORS[i % COUNTRY_COLORS.length]}
                          fillOpacity={0.5}
                          name={c}
                        />
                      ))}
                    </AreaChart>
                  </ResponsiveContainer>
                )}
              </Card>

              {/* Chart 3 */}
              <Card className="border-border bg-card p-4">
                <div className="mb-3 text-sm font-bold">Platform Split</div>
                {platformSplit.length === 0 ? (
                  <Empty />
                ) : (
                  <div className="relative">
                    <ResponsiveContainer width="100%" height={320}>
                      <PieChart>
                        <Pie data={platformSplit} dataKey="value" nameKey="name" innerRadius={70} outerRadius={110} paddingAngle={2}>
                          {platformSplit.map((d) => <Cell key={d.name} fill={d.color} />)}
                          <LabelList
                            dataKey="value"
                            position="outside"
                            formatter={(v: number) => `${((v / kpis.campaigns) * 100).toFixed(0)}%`}
                            style={{ fill: "hsl(var(--foreground))", fontSize: 11 }}
                          />
                        </Pie>
                        <Tooltip contentStyle={{ background: "hsl(var(--popover))", border: "1px solid hsl(var(--border))" }} />
                        <Legend wrapperStyle={{ fontSize: 12 }} />
                      </PieChart>
                    </ResponsiveContainer>
                    <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
                      <div className="text-3xl font-bold">{kpis.campaigns}</div>
                      <div className="text-xs text-muted-foreground">campaigns</div>
                    </div>
                  </div>
                )}
              </Card>

              {/* Chart 4 */}
              <Card className="border-border bg-card p-4">
                <div className="mb-3 text-sm font-bold">ROI by Market</div>
                {roiByMarket.length === 0 ? (
                  <Empty />
                ) : (
                  <ResponsiveContainer width="100%" height={320}>
                    <BarChart data={roiByMarket}>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                      <XAxis dataKey="label" tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }} />
                      <YAxis tickFormatter={(v) => `${v.toFixed(0)}%`} tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }} />
                      <Tooltip
                        contentStyle={{ background: "hsl(var(--popover))", border: "1px solid hsl(var(--border))" }}
                        formatter={(v: number) => [`${v.toFixed(1)}%`, "ROI"]}
                      />
                      <Bar dataKey="roi" radius={[4, 4, 0, 0]}>
                        <LabelList dataKey="roi" position="top" formatter={(v: number) => `${v.toFixed(0)}%`} style={{ fill: "hsl(var(--muted-foreground))", fontSize: 10 }} />
                        {roiByMarket.map((d) => (
                          <Cell key={d.country} fill={d.roi >= 0 ? "hsl(var(--primary))" : "hsl(var(--destructive))"} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </Card>
            </div>

            {/* Top Campaigns */}
            <Card className="border-border bg-card">
              <div className="flex items-center justify-between gap-4 border-b border-border p-4">
                <div className="text-sm font-bold">Top Campaigns</div>
                <Select value={rankMetric} onValueChange={(v) => setRankMetric(v as typeof rankMetric)}>
                  <SelectTrigger className="w-[180px]"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="views">Views</SelectItem>
                    <SelectItem value="roi">ROI</SelectItem>
                    <SelectItem value="revenue">Revenue</SelectItem>
                    <SelectItem value="engagement">Engagement Rate</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-12">#</TableHead>
                    <TableHead>Influencer</TableHead>
                    <TableHead>Campaign</TableHead>
                    <TableHead>Country</TableHead>
                    <TableHead>Platform</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead className="text-right">Views</TableHead>
                    <TableHead className="text-right">Cost</TableHead>
                    <TableHead className="text-right">Revenue</TableHead>
                    <TableHead className="text-right">ROI</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {pageRows.length === 0 ? (
                    <TableRow><TableCell colSpan={10} className="py-8 text-center text-sm text-muted-foreground">No campaigns match your filters.</TableCell></TableRow>
                  ) : pageRows.map((r, idx) => {
                    const rank = page * pageSize + idx + 1;
                    const medal = rank === 1 ? "🥇" : rank === 2 ? "🥈" : rank === 3 ? "🥉" : null;
                    const roi = r.cost > 0 ? ((r.revenue - r.cost) / r.cost) * 100 : null;
                    return (
                      <TableRow key={r.id}>
                        <TableCell className="font-bold">{medal ?? rank}</TableCell>
                        <TableCell className="font-medium">{r.influencer}</TableCell>
                        <TableCell className="max-w-[240px] truncate text-muted-foreground">{r.campaign}</TableCell>
                        <TableCell>{COUNTRY_FLAGS[r.country] ?? ""} {r.country}</TableCell>
                        <TableCell>
                          <span
                            className="rounded-full px-2 py-0.5 text-[10px] font-semibold"
                            style={{ background: `${PLATFORM_COLOR[r.platform]}26`, color: PLATFORM_COLOR[r.platform] }}
                          >
                            {r.platform}
                          </span>
                        </TableCell>
                        <TableCell className="text-muted-foreground">{r.date ? format(r.date, "dd.MM.yyyy") : "—"}</TableCell>
                        <TableCell className="text-right font-bold">{formatNumber(r.views)}</TableCell>
                        <TableCell className="text-right">{formatCurrency(r.cost)}</TableCell>
                        <TableCell className={cn("text-right font-bold", r.revenue > 0 && "text-success")}>{formatCurrency(r.revenue)}</TableCell>
                        <TableCell className={cn("text-right font-bold", roi == null ? "" : roi >= 0 ? "text-success" : "text-destructive")}>
                          {roi == null ? "—" : `${roi >= 0 ? "+" : ""}${roi.toFixed(0)}%`}
                          {rankMetric === "engagement" && r.engagement != null && (
                            <div className="text-[10px] font-normal text-muted-foreground">{formatPercent(r.engagement)}</div>
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>

              {ranked.length > pageSize && (
                <div className="flex items-center justify-between border-t border-border p-3 text-xs text-muted-foreground">
                  <span>Page {page + 1} of {totalPages}</span>
                  <div className="flex gap-2">
                    <Button variant="ghost" size="sm" disabled={page === 0} onClick={() => setPage((p) => p - 1)}>Previous</Button>
                    <Button variant="ghost" size="sm" disabled={page >= totalPages - 1} onClick={() => setPage((p) => p + 1)}>Next</Button>
                  </div>
                </div>
              )}
            </Card>
          </>
        )}
      </div>
    </div>
  );
};

const KpiCard = ({ label, value, valueClass }: { label: string; value: string; valueClass?: string }) => (
  <Card className="border-border bg-card p-4">
    <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</div>
    <div className={cn("mt-1 text-xl font-bold", valueClass)}>{value}</div>
  </Card>
);

const Empty = () => (
  <div className="flex h-[280px] items-center justify-center text-sm text-muted-foreground">No data for this selection.</div>
);

const DateRange = ({
  from, to, setFrom, setTo,
}: {
  from?: Date; to?: Date;
  setFrom: (d?: Date) => void; setTo: (d?: Date) => void;
}) => (
  <div className="flex gap-2">
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="outline" className={cn("justify-start gap-2 font-normal", !from && "text-muted-foreground")}>
          <CalendarIcon className="h-4 w-4" />
          {from ? format(from, "dd MMM yyyy") : "From"}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start">
        <Calendar mode="single" selected={from} onSelect={setFrom} initialFocus className={cn("p-3 pointer-events-auto")} />
      </PopoverContent>
    </Popover>
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="outline" className={cn("justify-start gap-2 font-normal", !to && "text-muted-foreground")}>
          <CalendarIcon className="h-4 w-4" />
          {to ? format(to, "dd MMM yyyy") : "To"}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start">
        <Calendar mode="single" selected={to} onSelect={setTo} initialFocus className={cn("p-3 pointer-events-auto")} />
      </PopoverContent>
    </Popover>
  </div>
);

export default Analytics;
