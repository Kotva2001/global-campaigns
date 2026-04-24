import { useMemo, useState } from "react";
import { Globe2 } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { COUNTRIES, COUNTRY_FLAGS, COUNTRY_NAMES } from "@/lib/countries";
import { formatCompact, formatCurrency, formatPercent } from "@/lib/formatters";
import { convertCurrency, type CurrencyCode, type ExchangeRates } from "@/lib/currency";
import { cn } from "@/lib/utils";
import type { CampaignEntry } from "@/types/campaign";

/**
 * Simplified, stylized country paths for the 11 supported markets.
 * Coordinates live in a 1000x600 viewBox roughly approximating Europe's
 * geographic positions — not geographically accurate, just recognizable.
 */
const COUNTRY_PATHS: Record<string, { d: string; labelX: number; labelY: number }> = {
  ES: {
    d: "M120,420 L260,410 L290,470 L240,520 L150,520 L100,480 Z",
    labelX: 195,
    labelY: 470,
  },
  IT: {
    d: "M470,330 L520,335 L545,400 L555,475 L585,520 L555,540 L530,500 L505,440 L475,400 Z",
    labelX: 520,
    labelY: 420,
  },
  GR: {
    d: "M620,470 L710,475 L735,520 L700,555 L640,545 L615,510 Z",
    labelX: 670,
    labelY: 510,
  },
  DE: {
    d: "M420,200 L500,195 L520,260 L495,300 L430,305 L405,265 Z",
    labelX: 460,
    labelY: 250,
  },
  NL: {
    d: "M380,180 L420,175 L425,210 L395,225 L375,205 Z",
    labelX: 400,
    labelY: 200,
  },
  AT: {
    d: "M495,300 L580,295 L590,330 L505,335 Z",
    labelX: 540,
    labelY: 318,
  },
  CZ: {
    d: "M510,255 L600,250 L605,290 L520,295 Z",
    labelX: 555,
    labelY: 275,
  },
  SK: {
    d: "M605,280 L685,275 L690,310 L610,315 Z",
    labelX: 645,
    labelY: 297,
  },
  HU: {
    d: "M600,320 L700,315 L710,360 L605,365 Z",
    labelX: 655,
    labelY: 342,
  },
  SI: {
    d: "M540,345 L595,342 L600,370 L545,373 Z",
    labelX: 568,
    labelY: 358,
  },
  RO: {
    d: "M710,320 L820,315 L835,375 L780,395 L715,380 Z",
    labelX: 770,
    labelY: 355,
  },
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
          {/* Subtle grid pattern background */}
          <svg
            viewBox="0 0 1000 600"
            preserveAspectRatio="xMidYMid meet"
            className="absolute inset-0 h-full w-full"
          >
            <defs>
              <pattern id="europe-grid" width="40" height="40" patternUnits="userSpaceOnUse">
                <path
                  d="M 40 0 L 0 0 0 40"
                  fill="none"
                  stroke="hsl(var(--border))"
                  strokeWidth="0.5"
                  opacity="0.4"
                />
              </pattern>
              <radialGradient id="europe-bg" cx="50%" cy="50%" r="70%">
                <stop offset="0%" stopColor="hsl(var(--muted))" stopOpacity="0.25" />
                <stop offset="100%" stopColor="hsl(var(--background))" stopOpacity="0" />
              </radialGradient>
              <filter id="country-glow" x="-50%" y="-50%" width="200%" height="200%">
                <feGaussianBlur stdDeviation="6" result="blur" />
                <feMerge>
                  <feMergeNode in="blur" />
                  <feMergeNode in="SourceGraphic" />
                </feMerge>
              </filter>
            </defs>
            <rect width="1000" height="600" fill="url(#europe-bg)" />
            <rect width="1000" height="600" fill="url(#europe-grid)" />

            {/* Countries */}
            {COUNTRIES.map((code) => {
              const path = COUNTRY_PATHS[code];
              if (!path) return null;
              const s = stats.get(code);
              const isActive = (s?.campaigns ?? 0) > 0;
              const isSelected = selected === code;
              const fill = isActive ? getHeatColor(s!.views) : "hsl(var(--muted))";
              return (
                <g key={code}>
                  {isSelected && (
                    <path
                      d={path.d}
                      fill={fill}
                      opacity="0.55"
                      filter="url(#country-glow)"
                      className="animate-pulse"
                    />
                  )}
                  <path
                    d={path.d}
                    fill={fill}
                    stroke={isSelected ? "hsl(var(--primary))" : "hsl(var(--border))"}
                    strokeWidth={isSelected ? 2.5 : 1}
                    opacity={isActive ? 1 : 0.45}
                    className={cn(
                      "cursor-pointer transition-[opacity,stroke-width] duration-200",
                      hovered === code && "opacity-90",
                    )}
                    onMouseEnter={() => setHovered(code)}
                    onClick={() => onSelect(code)}
                  />
                  {/* Inline label for active countries */}
                  {isActive && s && (
                    <g
                      pointerEvents="none"
                      transform={`translate(${path.labelX}, ${path.labelY})`}
                    >
                      <text
                        textAnchor="middle"
                        className="fill-foreground"
                        style={{ fontSize: 13, fontWeight: 700, paintOrder: "stroke" }}
                        stroke="hsl(var(--background))"
                        strokeWidth="3"
                      >
                        {code}
                      </text>
                      <text
                        y="14"
                        textAnchor="middle"
                        className="fill-foreground/85"
                        style={{ fontSize: 9, paintOrder: "stroke" }}
                        stroke="hsl(var(--background))"
                        strokeWidth="2.5"
                      >
                        {s.influencers}i · {s.campaigns}c · {formatCompact(s.views)}
                      </text>
                    </g>
                  )}
                </g>
              );
            })}
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