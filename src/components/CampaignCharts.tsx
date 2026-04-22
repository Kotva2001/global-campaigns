import { useMemo } from "react";
import {
  Bar, BarChart, CartesianGrid, Legend, Line, LineChart,
  ResponsiveContainer, Tooltip, XAxis, YAxis,
} from "recharts";
import { Card } from "@/components/ui/card";
import { COUNTRIES, COUNTRY_FLAGS } from "@/lib/countries";
import type { CampaignEntry } from "@/types/campaign";
import { parseCzechDate } from "@/lib/parsers";
import { formatCompact, formatCurrency } from "@/lib/formatters";
import { convertCurrency, type CurrencyCode, type ExchangeRates } from "@/lib/currency";

interface Props {
  rows: CampaignEntry[];
  selectedCountry: string;
  displayCurrency?: CurrencyCode;
  rates?: ExchangeRates;
}

const COUNTRY_COLORS = [
  "#10b981", "#3b82f6", "#f59e0b", "#ec4899", "#8b5cf6",
  "#ef4444", "#06b6d4", "#84cc16", "#f97316", "#a855f7", "#14b8a6",
];

export const CampaignCharts = ({ rows, selectedCountry, displayCurrency = "CZK", rates }: Props) => {
  const perInfluencer = useMemo(() => {
    const m = new Map<string, { name: string; cost: number; revenue: number }>();
    for (const r of rows) {
      if (!r.influencer) continue;
      const key = r.influencer;
      if (!m.has(key)) m.set(key, { name: key, cost: 0, revenue: 0 });
      const x = m.get(key)!;
      x.cost += convertCurrency(r.campaignCost, r.currency, displayCurrency, rates);
      x.revenue += convertCurrency(r.purchaseRevenue, r.currency, displayCurrency, rates);
    }
    return Array.from(m.values())
      .sort((a, b) => b.revenue + b.cost - (a.revenue + a.cost))
      .slice(0, 10);
  }, [displayCurrency, rates, rows]);

  const viewsOverTime = useMemo(() => {
    // group by month, by country
    const buckets = new Map<string, Record<string, number | string>>();
    for (const r of rows) {
      const d = parseCzechDate(r.publishDate);
      if (!d) continue;
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      if (!buckets.has(key)) buckets.set(key, { month: key });
      const b = buckets.get(key)!;
      b[r.country] = ((b[r.country] as number) ?? 0) + (r.views ?? 0);
    }
    return Array.from(buckets.values()).sort((a, b) =>
      String(a.month).localeCompare(String(b.month)),
    );
  }, [rows]);

  const visibleCountries =
    selectedCountry === "All"
      ? COUNTRIES.filter((c) => viewsOverTime.some((b) => b[c] != null))
      : [selectedCountry];

  return (
    <div className="grid gap-3 px-6 pt-6 lg:grid-cols-2">
      <Card className="border-border bg-card p-4">
        <div className="mb-3 flex items-baseline justify-between">
          <h3 className="text-sm font-semibold text-foreground">Revenue vs. Cost · Top 10 influencers</h3>
          <span className="text-xs text-muted-foreground">{displayCurrency}</span>
        </div>
        <div className="h-72">
          <ResponsiveContainer>
            <BarChart data={perInfluencer} margin={{ top: 8, right: 8, bottom: 40, left: 8 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis
                dataKey="name"
                tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }}
                interval={0}
                angle={-30}
                textAnchor="end"
              />
              <YAxis
                tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }}
                tickFormatter={(v) => formatCompact(Number(v))}
              />
              <Tooltip
                contentStyle={{
                  background: "hsl(var(--popover))",
                  border: "1px solid hsl(var(--border))",
                  borderRadius: 8,
                  color: "hsl(var(--foreground))",
                }}
                formatter={(v: number) => formatCurrency(v, displayCurrency)}
              />
              <Legend wrapperStyle={{ fontSize: 12, color: "hsl(var(--muted-foreground))" }} />
              <Bar dataKey="cost" name="Cost" fill="hsl(var(--platform-instagram))" radius={[4, 4, 0, 0]} />
              <Bar dataKey="revenue" name="Revenue" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </Card>

      <Card className="border-border bg-card p-4">
        <div className="mb-3 flex items-baseline justify-between">
          <h3 className="text-sm font-semibold text-foreground">Views over time by country</h3>
          <span className="text-xs text-muted-foreground">monthly</span>
        </div>
        <div className="h-72">
          <ResponsiveContainer>
            <LineChart data={viewsOverTime} margin={{ top: 8, right: 8, bottom: 8, left: 8 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis dataKey="month" tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }} />
              <YAxis
                tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }}
                tickFormatter={(v) => formatCompact(Number(v))}
              />
              <Tooltip
                contentStyle={{
                  background: "hsl(var(--popover))",
                  border: "1px solid hsl(var(--border))",
                  borderRadius: 8,
                  color: "hsl(var(--foreground))",
                }}
              />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              {visibleCountries.map((c, i) => (
                <Line
                  key={c}
                  type="monotone"
                  dataKey={c}
                  name={`${COUNTRY_FLAGS[c]} ${c}`}
                  stroke={COUNTRY_COLORS[i % COUNTRY_COLORS.length]}
                  strokeWidth={2}
                  dot={false}
                />
              ))}
            </LineChart>
          </ResponsiveContainer>
        </div>
      </Card>
    </div>
  );
};
