import { useMemo, useState } from "react";
import { Globe2 } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { COUNTRIES, COUNTRY_FLAGS, COUNTRY_NAMES } from "@/lib/countries";
import { formatCompact, formatCurrency, formatPercent } from "@/lib/formatters";
import { convertCurrency, type CurrencyCode, type ExchangeRates } from "@/lib/currency";
import { cn } from "@/lib/utils";
import type { CampaignEntry } from "@/types/campaign";
import europePaths from "@/data/europe-paths.json";

/**
 * Real (simplified) European country geometries projected onto a 1000x600
 * viewBox. Generated from a public-domain Europe GeoJSON via Douglas–Peucker
 * simplification — see /tmp/convert.mjs in the repo history.
 */
type CountryPath = { d: string; cx: number | null; cy: number | null; name: string };
const COUNTRY_PATHS = europePaths as Record<string, CountryPath>;
const ACTIVE_SET = new Set<string>(COUNTRIES);
/** Active markets get an inline label nudged into the country body. */
const LABEL_NUDGE: Partial<Record<string, { x: number; y: number }>> = {
  IT: { x: -10, y: -40 }, // skip Sicily, label the boot
  GR: { x: -30, y: -20 }, // mainland, not islands
  ES: { x: 10, y: -10 },
  RO: { x: 0, y: -5 },
};

interface CountryStat {
  country: string;
  influencers: number;
  campaigns: number;
  views: number;
  spend: number;
  revenue: number;
  roi: number | null;
}

interface Props {
  rows: CampaignEntry[];
  selected: string;
  onSelect: (country: string) => void;
  displayCurrency: CurrencyCode;
  rates: ExchangeRates;
}

export const EuropeMap = ({ rows, selected, onSelect, displayCurrency, rates }: Props) => {
  const [hovered, setHovered] = useState<string | null>(null);
  const [tooltip, setTooltip] = useState<{ x: number; y: number } | null>(null);

  const stats = useMemo(() => {
    const map = new Map<string, CountryStat>();
    const inflSets = new Map<string, Set<string>>();
    for (const r of rows) {
      let s = map.get(r.country);
      if (!s) {
        s = { country: r.country, influencers: 0, campaigns: 0, views: 0, spend: 0, revenue: 0, roi: null };
        map.set(r.country, s);
      }
      s.campaigns += 1;
      s.views += r.views ?? 0;
      s.spend += convertCurrency(r.campaignCost, r.currency, displayCurrency, rates) ?? 0;
      s.revenue += convertCurrency(r.purchaseRevenue, r.currency, displayCurrency, rates) ?? 0;
      if (r.influencer) {
        if (!inflSets.has(r.country)) inflSets.set(r.country, new Set());
        inflSets.get(r.country)!.add(r.influencer);
      }
    }
    for (const [country, set] of inflSets) {
      const s = map.get(country);
      if (s) s.influencers = set.size;
    }
    for (const s of map.values()) {
      s.roi = s.spend > 0 ? ((s.revenue - s.spend) / s.spend) * 100 : null;
    }
    return map;
  }, [rows, displayCurrency, rates]);

  const maxViews = useMemo(() => {
    let m = 0;
    for (const s of stats.values()) if (s.views > m) m = s.views;
    return m;
  }, [stats]);

  const getHeatColor = (views: number): string => {
    if (!views || maxViews === 0) return "hsl(var(--muted))";
    // 0..1 normalized intensity (sqrt for better mid-range spread)
    const t = Math.sqrt(views / maxViews);
    // hue: 210 (cool blue) -> 18 (warm orange/red)
    const hue = 210 - t * 192;
    const sat = 70 + t * 20;
    const light = 45 + (1 - t) * 8;
    return `hsl(${hue}, ${sat}%, ${light}%)`;
  };

  const totals = useMemo(() => {
    let influencers = 0;
    let campaigns = 0;
    let views = 0;
    const inflKeys = new Set<string>();
    for (const r of rows) {
      campaigns += 1;
      views += r.views ?? 0;
      if (r.influencer) inflKeys.add(`${r.country}|${r.influencer}`);
    }
    influencers = inflKeys.size;
    return { influencers, campaigns, views };
  }, [rows]);

  const hoveredStat = hovered ? stats.get(hovered) : null;

  const allCodes = useMemo(() => Object.keys(COUNTRY_PATHS), []);

  return (
    <div className="px-6 pt-6">
      <Card className="relative overflow-hidden border-border bg-card">
        {/* Header */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border/60 px-5 py-3">
          <div>
            <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Markets
            </div>
            <div className="text-sm text-foreground">
              {selected === "All"
                ? `🌍 All markets · ${totals.influencers} influencers · ${totals.campaigns} campaigns · ${formatCompact(totals.views)} views`
                : `${COUNTRY_FLAGS[selected] ?? ""} ${COUNTRY_NAMES[selected] ?? selected}`}
            </div>
          </div>
          <Button
            size="sm"
            variant={selected === "All" ? "default" : "secondary"}
            onClick={() => onSelect("All")}
            className="gap-2"
          >
            <Globe2 className="h-4 w-4" />
            All markets
          </Button>
        </div>

        {/* Map */}
        <div
          className="relative h-[400px] w-full"
          onMouseLeave={() => {
            setHovered(null);
            setTooltip(null);
          }}
          onMouseMove={(e) => {
            const rect = e.currentTarget.getBoundingClientRect();
            setTooltip({ x: e.clientX - rect.left, y: e.clientY - rect.top });
          }}
        >
          <svg
            viewBox="0 0 1000 600"
            preserveAspectRatio="xMidYMid meet"
            className="absolute inset-0 h-full w-full"
          >
            <defs>
              <pattern id="europe-grid" width="50" height="50" patternUnits="userSpaceOnUse">
                <path
                  d="M 50 0 L 0 0 0 50"
                  fill="none"
                  stroke="hsl(var(--border))"
                  strokeWidth="0.5"
                  opacity="0.18"
                />
              </pattern>
              <radialGradient id="europe-sea" cx="50%" cy="50%" r="75%">
                <stop offset="0%" stopColor="hsl(220, 35%, 10%)" stopOpacity="1" />
                <stop offset="100%" stopColor="hsl(225, 40%, 6%)" stopOpacity="1" />
              </radialGradient>
              <filter id="country-glow" x="-50%" y="-50%" width="200%" height="200%">
                <feGaussianBlur stdDeviation="6" result="blur" />
                <feMerge>
                  <feMergeNode in="blur" />
                  <feMergeNode in="SourceGraphic" />
                </feMerge>
              </filter>
            </defs>
            {/* Sea background */}
            <rect width="1000" height="600" fill="url(#europe-sea)" />
            <rect width="1000" height="600" fill="url(#europe-grid)" />

            {/* Render every country path: inactive first (background), active on top. */}
            <g>
              {allCodes
                .filter((code) => !ACTIVE_SET.has(code))
                .map((code) => {
                  const path = COUNTRY_PATHS[code];
                  return (
                    <path
                      key={code}
                      d={path.d}
                      fill="hsl(225, 18%, 16%)"
                      stroke="hsl(225, 20%, 22%)"
                      strokeWidth={0.6}
                      strokeLinejoin="round"
                    />
                  );
                })}
            </g>
            <g>
              {COUNTRIES.map((code) => {
                const path = COUNTRY_PATHS[code];
                if (!path) return null;
                const s = stats.get(code);
                const isActive = (s?.campaigns ?? 0) > 0;
                const isSelected = selected === code;
                const fill = isActive ? getHeatColor(s!.views) : "hsl(225, 16%, 22%)";
                const stroke = isSelected
                  ? "hsl(var(--primary))"
                  : isActive
                  ? "hsl(0, 0%, 100%)"
                  : "hsl(225, 20%, 28%)";
                const strokeOpacity = isSelected ? 1 : isActive ? 0.35 : 1;
                return (
                  <g key={code}>
                    {isSelected && (
                      <path
                        d={path.d}
                        fill={fill}
                        opacity="0.55"
                        filter="url(#country-glow)"
                        className="animate-pulse"
                        pointerEvents="none"
                      />
                    )}
                    <path
                      d={path.d}
                      fill={fill}
                      stroke={stroke}
                      strokeOpacity={strokeOpacity}
                      strokeWidth={isSelected ? 2 : 0.8}
                      strokeLinejoin="round"
                      className={cn(
                        "cursor-pointer transition-[opacity] duration-200",
                        hovered === code && "opacity-90",
                      )}
                      onMouseEnter={() => setHovered(code)}
                      onClick={() => onSelect(code)}
                    />
                  </g>
                );
              })}
            </g>
            {/* Labels last so they sit above all countries. */}
            <g pointerEvents="none">
              {COUNTRIES.map((code) => {
                const path = COUNTRY_PATHS[code];
                const s = stats.get(code);
                if (!path || !path.cx || !path.cy || !s || s.campaigns === 0) return null;
                const nudge = LABEL_NUDGE[code] ?? { x: 0, y: 0 };
                return (
                  <g key={code} transform={`translate(${path.cx + nudge.x}, ${path.cy + nudge.y})`}>
                    <text
                      textAnchor="middle"
                      style={{ fontSize: 12, fontWeight: 700, paintOrder: "stroke" }}
                      stroke="hsl(225, 40%, 6%)"
                      strokeWidth="3"
                      className="fill-foreground"
                    >
                      {code}
                    </text>
                    <text
                      y="13"
                      textAnchor="middle"
                      style={{ fontSize: 9, paintOrder: "stroke" }}
                      stroke="hsl(225, 40%, 6%)"
                      strokeWidth="2.5"
                      className="fill-foreground/85"
                    >
                      {s.influencers}i · {s.campaigns}c · {formatCompact(s.views)}
                    </text>
                  </g>
                );
              })}
            </g>
          </svg>

          {/* Hover tooltip */}
          {hovered && hoveredStat && tooltip && (
            <div
              className="pointer-events-none absolute z-10 min-w-[220px] rounded-lg border border-border bg-popover/95 p-3 text-xs shadow-xl backdrop-blur"
              style={{
                left: Math.min(tooltip.x + 14, 1000),
                top: Math.max(tooltip.y - 10, 0),
              }}
            >
              <div className="mb-2 flex items-center gap-2 text-sm font-semibold text-foreground">
                <span className="text-lg leading-none">{COUNTRY_FLAGS[hovered]}</span>
                {COUNTRY_NAMES[hovered] ?? hovered}
              </div>
              <div className="grid grid-cols-2 gap-x-4 gap-y-1">
                <span className="text-muted-foreground">Influencers</span>
                <span className="text-right font-medium text-foreground">{hoveredStat.influencers}</span>
                <span className="text-muted-foreground">Campaigns</span>
                <span className="text-right font-medium text-foreground">{hoveredStat.campaigns}</span>
                <span className="text-muted-foreground">Views</span>
                <span className="text-right font-medium text-foreground">{formatCompact(hoveredStat.views)}</span>
                <span className="text-muted-foreground">Spend</span>
                <span className="text-right font-medium text-foreground">
                  {formatCurrency(hoveredStat.spend, displayCurrency)}
                </span>
                <span className="text-muted-foreground">Revenue</span>
                <span className="text-right font-medium text-foreground">
                  {formatCurrency(hoveredStat.revenue, displayCurrency)}
                </span>
                <span className="text-muted-foreground">ROI</span>
                <span
                  className={cn(
                    "text-right font-semibold",
                    hoveredStat.roi == null
                      ? "text-muted-foreground"
                      : hoveredStat.roi >= 0
                      ? "text-emerald-500"
                      : "text-destructive",
                  )}
                >
                  {formatPercent(hoveredStat.roi)}
                </span>
              </div>
            </div>
          )}

          {/* Legend */}
          <div className="absolute bottom-3 left-4 flex items-center gap-2 rounded-md border border-border/60 bg-background/70 px-2.5 py-1.5 text-[10px] text-muted-foreground backdrop-blur">
            <span>Low</span>
            <span
              className="h-2 w-24 rounded-full"
              style={{
                background:
                  "linear-gradient(to right, hsl(210,70%,50%), hsl(150,75%,48%), hsl(60,85%,50%), hsl(18,90%,52%))",
              }}
            />
            <span>High views</span>
          </div>
        </div>
      </Card>
    </div>
  );
};