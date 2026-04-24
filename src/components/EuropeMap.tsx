import { useEffect, useMemo, useRef, useState } from "react";
import * as d3 from "d3";
import type { Feature, FeatureCollection, Geometry } from "geojson";
import { Globe2, Plus, Minus } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { COUNTRIES, COUNTRY_FLAGS, COUNTRY_NAMES } from "@/lib/countries";
import { formatCompact, formatCurrency, formatPercent } from "@/lib/formatters";
import { convertCurrency, type CurrencyCode, type ExchangeRates } from "@/lib/currency";
import { cn } from "@/lib/utils";
import type { CampaignEntry } from "@/types/campaign";
import europeGeoRaw from "@/data/europe.geo.json";

type CountryProps = { iso: string; name: string };
const europeGeo = europeGeoRaw as unknown as FeatureCollection<Geometry, CountryProps>;
const ACTIVE_SET = new Set<string>(COUNTRIES);

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

const WIDTH = 1000;
const HEIGHT = 450;

export const EuropeMap = ({ rows, selected, onSelect, displayCurrency, rates }: Props) => {
  const svgRef = useRef<SVGSVGElement | null>(null);
  const gRef = useRef<SVGGElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const zoomRef = useRef<d3.ZoomBehavior<SVGSVGElement, unknown> | null>(null);

  const [hovered, setHovered] = useState<string | null>(null);
  const [tooltip, setTooltip] = useState<{ x: number; y: number } | null>(null);
  const [zoomK, setZoomK] = useState(1);

  // ----- Stats per country -----
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

  const totals = useMemo(() => {
    let campaigns = 0;
    let views = 0;
    const inflKeys = new Set<string>();
    for (const r of rows) {
      campaigns += 1;
      views += r.views ?? 0;
      if (r.influencer) inflKeys.add(`${r.country}|${r.influencer}`);
    }
    return { influencers: inflKeys.size, campaigns, views };
  }, [rows]);

  // ----- Heat color scale -----
  const heatScale = useMemo(() => {
    let max = 0;
    for (const s of stats.values()) if (s.views > max) max = s.views;
    return d3.scaleSequential((t) => d3.interpolateRgbBasis([
      "hsl(210, 75%, 48%)", // blue
      "hsl(165, 70%, 45%)", // teal
      "hsl(58, 90%, 52%)",  // yellow
      "hsl(28, 92%, 54%)",  // orange
      "hsl(0, 80%, 52%)",   // red
    ])(t)).domain([0, Math.sqrt(Math.max(max, 1))]);
  }, [stats]);

  const heatColor = (views: number) =>
    views > 0 ? heatScale(Math.sqrt(views)) : "hsl(225, 16%, 22%)";

  // ----- Mercator projection fitted to active countries -----
  const { projection, pathGen, activeBounds } = useMemo(() => {
    const proj = d3.geoMercator();
    const activeFeatures = europeGeo.features.filter((f) => ACTIVE_SET.has(f.properties.iso));
    const initialFC: FeatureCollection<Geometry, CountryProps> = {
      type: "FeatureCollection",
      features: activeFeatures,
    };
    proj.fitExtent([[20, 20], [WIDTH - 20, HEIGHT - 20]], initialFC);
    const path = d3.geoPath(proj);
    // Bounds of active countries (in projected px) for "All markets" reset
    const bounds = path.bounds(initialFC);
    return { projection: proj, pathGen: path, activeBounds: bounds };
  }, []);

  // ----- D3 zoom wiring -----
  useEffect(() => {
    if (!svgRef.current || !gRef.current) return;
    const svg = d3.select(svgRef.current);
    const g = d3.select(gRef.current);
    const zoom = d3
      .zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.6, 12])
      .translateExtent([[-200, -200], [WIDTH + 200, HEIGHT + 200]])
      .on("zoom", (event) => {
        g.attr("transform", event.transform.toString());
        setZoomK(event.transform.k);
      });
    zoomRef.current = zoom;
    svg.call(zoom);
    // Disable D3 default double-click zoom (we use dblclick for country focus)
    svg.on("dblclick.zoom", null);
    return () => {
      svg.on(".zoom", null);
    };
  }, []);

  const zoomTo = (transform: d3.ZoomTransform, duration = 700) => {
    if (!svgRef.current || !zoomRef.current) return;
    d3.select(svgRef.current)
      .transition()
      .duration(duration)
      .call(zoomRef.current.transform, transform);
  };

  const resetView = () => {
    const [[x0, y0], [x1, y1]] = activeBounds;
    const dx = x1 - x0;
    const dy = y1 - y0;
    const cx = (x0 + x1) / 2;
    const cy = (y0 + y1) / 2;
    const scale = Math.min(8, 0.9 / Math.max(dx / WIDTH, dy / HEIGHT));
    const t = d3.zoomIdentity.translate(WIDTH / 2 - scale * cx, HEIGHT / 2 - scale * cy).scale(scale);
    zoomTo(t);
  };

  const focusCountry = (feature: Feature<Geometry, CountryProps>) => {
    const [[x0, y0], [x1, y1]] = pathGen.bounds(feature);
    const dx = x1 - x0;
    const dy = y1 - y0;
    const cx = (x0 + x1) / 2;
    const cy = (y0 + y1) / 2;
    const scale = Math.min(8, 0.7 / Math.max(dx / WIDTH, dy / HEIGHT));
    const t = d3.zoomIdentity.translate(WIDTH / 2 - scale * cx, HEIGHT / 2 - scale * cy).scale(scale);
    zoomTo(t);
  };

  const zoomBy = (factor: number) => {
    if (!svgRef.current || !zoomRef.current) return;
    d3.select(svgRef.current).transition().duration(250).call(zoomRef.current.scaleBy, factor);
  };

  // ----- Tooltip positioning (clamped to container) -----
  const handleMove = (e: React.MouseEvent) => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const clampedX = Math.min(rect.width - 250, Math.max(8, x + 14));
    const clampedY = Math.min(rect.height - 200, Math.max(8, y - 10));
    setTooltip({ x: clampedX, y: clampedY });
  };

  const hoveredStat = hovered ? stats.get(hovered) : null;

  // Initial fit-to-active on mount and when bounds change
  useEffect(() => {
    // Defer one tick so the svg is mounted
    const id = requestAnimationFrame(() => resetView());
    return () => cancelAnimationFrame(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeBounds]);

  return (
    <div className="px-6 pt-6">
      <Card className="relative overflow-hidden border-border bg-card">
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
            onClick={() => {
              onSelect("All");
              resetView();
            }}
            className="gap-2"
          >
            <Globe2 className="h-4 w-4" />
            All markets
          </Button>
        </div>

        <div
          ref={containerRef}
          className="relative h-[450px] w-full"
          style={{ background: "#0a1628" }}
          onMouseLeave={() => {
            setHovered(null);
            setTooltip(null);
          }}
          onMouseMove={handleMove}
        >
          <svg
            ref={svgRef}
            viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
            preserveAspectRatio="xMidYMid meet"
            className="absolute inset-0 h-full w-full cursor-grab active:cursor-grabbing"
          >
            <defs>
              <pattern id="europe-grid" width="50" height="50" patternUnits="userSpaceOnUse">
                <path
                  d="M 50 0 L 0 0 0 50"
                  fill="none"
                  stroke="hsl(var(--border))"
                  strokeWidth="0.5"
                  opacity="0.15"
                />
              </pattern>
              <filter id="country-glow" x="-50%" y="-50%" width="200%" height="200%">
                <feGaussianBlur stdDeviation="5" result="blur" />
                <feMerge>
                  <feMergeNode in="blur" />
                  <feMergeNode in="SourceGraphic" />
                </feMerge>
              </filter>
            </defs>

            <rect width={WIDTH} height={HEIGHT} fill="#0a1628" />
            <rect width={WIDTH} height={HEIGHT} fill="url(#europe-grid)" />

            <g ref={gRef}>
              {/* Inactive countries */}
              <g>
                {europeGeo.features
                  .filter((f) => !ACTIVE_SET.has(f.properties.iso))
                  .map((f) => (
                    <path
                      key={f.properties.iso}
                      d={pathGen(f) ?? ""}
                      fill="#1e2a3a"
                      stroke="#2d3f54"
                      strokeWidth={0.6 / zoomK}
                      strokeLinejoin="round"
                    />
                  ))}
              </g>
              {/* Active countries */}
              <g>
                {europeGeo.features
                  .filter((f) => ACTIVE_SET.has(f.properties.iso))
                  .map((f) => {
                    const code = f.properties.iso;
                    const s = stats.get(code);
                    const isSelected = selected === code;
                    const fill = s && s.views > 0 ? heatColor(s.views) : "hsl(225, 16%, 28%)";
                    const isHovered = hovered === code;
                    const d = pathGen(f) ?? "";
                    return (
                      <g key={code}>
                        {isSelected && (
                          <path
                            d={d}
                            fill={fill}
                            opacity="0.55"
                            filter="url(#country-glow)"
                            className="animate-pulse"
                            pointerEvents="none"
                          />
                        )}
                        <path
                          d={d}
                          fill={fill}
                          stroke={
                            isSelected
                              ? "hsl(var(--primary))"
                              : isHovered
                              ? "#ffffff"
                              : "rgba(255,255,255,0.55)"
                          }
                          strokeWidth={(isSelected ? 2 : isHovered ? 1.5 : 0.8) / zoomK}
                          strokeLinejoin="round"
                          className="cursor-pointer transition-[opacity] duration-200"
                          style={{ opacity: isHovered ? 0.9 : 1 }}
                          onMouseEnter={() => setHovered(code)}
                          onClick={() => onSelect(code)}
                          onDoubleClick={() => {
                            onSelect(code);
                            focusCountry(f);
                          }}
                        />
                      </g>
                    );
                  })}
              </g>
              {/* Labels — sized inversely to zoom so they stay readable */}
              <g pointerEvents="none">
                {(() => {
                  const ru = europeGeo.features.find((f) => f.properties.iso === "RU");
                  if (!ru) return null;
                  const [cx, cy] = pathGen.centroid(ru);
                  if (!Number.isFinite(cx) || !Number.isFinite(cy)) return null;
                  const size = Math.max(10, 18 / zoomK);
                  return (
                    <text
                      x={cx}
                      y={cy}
                      textAnchor="middle"
                      dominantBaseline="middle"
                      style={{ fontSize: size, fontWeight: 600 }}
                      fill="#3a3a4a"
                    >
                      ☹
                    </text>
                  );
                })()}
                {europeGeo.features
                  .filter((f) => ACTIVE_SET.has(f.properties.iso))
                  .map((f) => {
                    const code = f.properties.iso;
                    const s = stats.get(code);
                    if (!s || s.campaigns === 0) return null;
                    const [cx, cy] = pathGen.centroid(f);
                    if (!Number.isFinite(cx) || !Number.isFinite(cy)) return null;
                    const fontSize = Math.max(7, 11 / zoomK);
                    const subSize = Math.max(6, 8 / zoomK);
                    return (
                      <g key={code} transform={`translate(${cx}, ${cy})`}>
                        <text
                          textAnchor="middle"
                          style={{ fontSize, fontWeight: 700, paintOrder: "stroke" }}
                          stroke="#0a1628"
                          strokeWidth={3 / zoomK}
                          className="fill-foreground"
                        >
                          {code} {formatCompact(s.views)}
                        </text>
                        <text
                          y={fontSize + 1}
                          textAnchor="middle"
                          style={{ fontSize: subSize, paintOrder: "stroke" }}
                          stroke="#0a1628"
                          strokeWidth={2.5 / zoomK}
                          className="fill-foreground/80"
                        >
                          {s.influencers}i · {s.campaigns}c
                        </text>
                      </g>
                    );
                  })}
              </g>
            </g>
          </svg>

          {/* Hover tooltip */}
          {hovered && hoveredStat && tooltip && (
            <div
              className="pointer-events-none absolute z-10 min-w-[230px] rounded-lg border border-border bg-popover/95 p-3 text-xs shadow-xl backdrop-blur"
              style={{ left: tooltip.x, top: tooltip.y }}
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

          {/* Zoom controls */}
          <div className="absolute right-3 top-3 flex flex-col gap-1 rounded-md border border-border/60 bg-background/70 p-1 backdrop-blur">
            <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => zoomBy(1.5)}>
              <Plus className="h-4 w-4" />
            </Button>
            <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => zoomBy(1 / 1.5)}>
              <Minus className="h-4 w-4" />
            </Button>
          </div>

          {/* Legend */}
          <div className="absolute bottom-3 left-4 flex items-center gap-2 rounded-md border border-border/60 bg-background/70 px-2.5 py-1.5 text-[10px] text-muted-foreground backdrop-blur">
            <span>Low</span>
            <span
              className="h-2 w-28 rounded-full"
              style={{
                background:
                  "linear-gradient(to right, hsl(210,75%,48%), hsl(165,70%,45%), hsl(58,90%,52%), hsl(28,92%,54%), hsl(0,80%,52%))",
              }}
            />
            <span>High views</span>
          </div>
        </div>
      </Card>
    </div>
  );
};
