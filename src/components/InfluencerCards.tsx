import type { CSSProperties } from "react";
import { ArrowRight, Eye, Sparkles } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { COUNTRY_FLAGS } from "@/lib/countries";
import { FlagIcon, hasFlag } from "@/components/FlagIcon";
import type { InfluencerSummary } from "@/lib/calculations";
import { formatCompact, formatCurrency, formatNumber } from "@/lib/formatters";
import { cn } from "@/lib/utils";

interface Props {
  influencers: InfluencerSummary[];
  currency?: string;
  onSelectInfluencer?: (influencer: InfluencerSummary) => void;
}

const platformClass = (p: string) => {
  if (p === "YouTube") return "bg-[hsl(var(--platform-youtube)/0.15)] text-[hsl(var(--platform-youtube))] badge-glow-youtube";
  if (p === "Instagram") return "bg-[hsl(var(--platform-instagram)/0.15)] text-[hsl(var(--platform-instagram))] badge-glow-instagram";
  if (p === "Story") return "bg-[hsl(var(--platform-story)/0.18)] text-[hsl(var(--platform-story))] badge-glow-story";
  return "bg-[hsl(var(--platform-shorts)/0.15)] text-[hsl(var(--platform-shorts))] badge-glow-shorts";
};

const platformHsl = (platform: string) => {
  if (platform === "YouTube") return "var(--platform-youtube)";
  if (platform === "Instagram") return "var(--platform-instagram)";
  if (platform === "Story") return "var(--platform-story)";
  return "var(--platform-shorts)";
};

const rankColor = (rank: number) => {
  if (rank === 1) return "hsl(51 100% 50%)";
  if (rank === 2) return "hsl(0 0% 75%)";
  if (rank === 3) return "hsl(30 61% 50%)";
  return "hsl(var(--glow-cyan) / 0.75)";
};

export const InfluencerCards = ({ influencers, currency = "CZK", onSelectInfluencer }: Props) => {
  if (!influencers.length) {
    return (
      <div className="px-6 pt-6">
        <Card className="flex flex-col items-center justify-center gap-2 border-dashed border-border bg-card/40 p-12 text-center">
          <div className="text-3xl">🌱</div>
          <div className="text-sm font-medium text-foreground">No influencers in this market yet</div>
          <div className="text-xs text-muted-foreground">Try selecting another market or clear your filters.</div>
        </Card>
      </div>
    );
  }

  const visibleInfluencers = influencers.slice(0, 12);
  const maxViews = Math.max(...visibleInfluencers.map((inf) => inf.totalViews), 1);

  return (
    <div className="px-6 pt-6">
      <h2 className="mb-3 text-xs font-semibold uppercase tracking-[0.10em] text-muted-foreground">
        Top Influencers
      </h2>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {visibleInfluencers.map((inf, index) => {
          const roiPos = (inf.roi ?? 0) >= 0;
          const platformColor = platformHsl(inf.topPlatform);
          const hasNoData = inf.totalViews === 0 && inf.campaigns === 0;
          const revenueDirection = inf.totalRevenue > inf.totalSpend ? "success" : inf.totalRevenue < inf.totalSpend ? "pink" : "muted";
          const viewShare = Math.max(4, Math.round((inf.totalViews / maxViews) * 100));
          return (
            <Card
              key={inf.key}
              onClick={() => onSelectInfluencer?.(inf)}
              className="top-influencer-card group relative flex h-full min-h-[280px] cursor-pointer flex-col overflow-hidden p-4 animate-fade-in-up"
              style={{ "--card-platform-hsl": platformColor, animationDelay: `${index * 40}ms` } as CSSProperties}
            >
              <div className="flex items-start justify-between gap-2 pl-8">
                <div
                  className="absolute left-3 top-3 text-xs font-black tabular-nums"
                  style={{ color: rankColor(index + 1), textShadow: `0 0 8px ${rankColor(index + 1)}` }}
                >
                  #{index + 1}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-lg font-bold text-foreground transition-[text-shadow] group-hover:[text-shadow:0_0_10px_hsl(var(--glow-pink)/0.5)]">{inf.influencer}</div>
                  <div className="mt-0.5 flex items-center gap-1.5 text-xs text-muted-foreground">
                    {hasFlag(inf.country)
                      ? <FlagIcon code={inf.country} width={16} height={11} />
                      : <span>{COUNTRY_FLAGS[inf.country]}</span>}
                    <span>{inf.country}</span>
                    <span>·</span>
                    <span>{inf.campaigns} campaign{inf.campaigns === 1 ? "" : "s"}</span>
                    {inf.stories > 0 && (
                      <>
                        <span>·</span>
                        <span className="inline-flex items-center gap-0.5 text-[hsl(var(--platform-story))]">
                          <Sparkles className="h-3 w-3" />
                          {inf.stories} {inf.stories === 1 ? "story" : "stories"}
                        </span>
                      </>
                    )}
                  </div>
                </div>
              </div>

              <div className="mt-3 flex flex-wrap gap-1">
                {inf.platforms.map((p) => (
                  <span
                    key={p}
                    className={cn("inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold", platformClass(p))}
                  >
                    {p === "Story" && <Eye className="h-3 w-3" />}
                    {p}
                  </span>
                ))}
              </div>

              {hasNoData ? (
                <div className="mt-4 flex flex-1 items-center justify-center rounded-md border border-dashed border-[hsl(var(--glow-purple)/0.32)] bg-[hsl(var(--muted)/0.18)] text-sm font-medium text-muted-foreground">
                  No data yet
                </div>
              ) : (
                <div className="mt-4 flex-1 space-y-3 text-xs tabular-nums">
                  <div className="flex items-end justify-between gap-3">
                    <div>
                      <div className="stat-label">Views</div>
                      <div className="text-[28px] font-black leading-none text-[hsl(var(--glow-cyan))] [text-shadow:0_0_12px_hsl(var(--glow-cyan)/0.55)]">
                        {formatCompact(inf.totalViews)}
                      </div>
                    </div>
                    <Sparkline values={inf.viewTrend} color="hsl(var(--glow-cyan))" />
                  </div>

                  <div className="flex items-center justify-between gap-2">
                    {inf.roi == null ? (
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <span className="inline-flex rounded-full border border-border bg-muted/40 px-2.5 py-1 text-xs font-bold text-muted-foreground">ROI —</span>
                        </TooltipTrigger>
                        <TooltipContent>No spend data entered</TooltipContent>
                      </Tooltip>
                    ) : (
                      <span
                        className={cn(
                          "inline-flex rounded-full border px-2.5 py-1 text-xs font-bold",
                          roiPos
                            ? "border-[hsl(var(--success)/0.55)] bg-[hsl(var(--success)/0.15)] text-[hsl(var(--success))] shadow-[0_0_10px_hsl(var(--success)/0.35)]"
                            : "border-[hsl(var(--glow-pink)/0.55)] bg-[hsl(var(--glow-pink)/0.15)] text-[hsl(var(--glow-pink))] shadow-[0_0_10px_hsl(var(--glow-pink)/0.35)]",
                        )}
                      >
                        ROI {`${roiPos ? "+" : ""}${inf.roi.toFixed(0)}%`}
                      </span>
                    )}
                    <div className="flex min-w-0 items-center gap-1.5 text-sm font-bold text-foreground/90">
                      <span className="truncate">{formatCurrency(inf.totalSpend, currency)}</span>
                      <ArrowRight
                        className={cn(
                          "h-4 w-4 shrink-0",
                          revenueDirection === "success" && "text-[hsl(var(--success))]",
                          revenueDirection === "pink" && "text-[hsl(var(--glow-pink))]",
                          revenueDirection === "muted" && "text-muted-foreground",
                        )}
                      />
                      <span className="truncate">{formatCurrency(inf.totalRevenue, currency)}</span>
                    </div>
                  </div>
                </div>
              )}

              <div className="mt-4 h-1 overflow-hidden rounded-full bg-[hsl(var(--muted)/0.45)]">
                <div
                  className="h-full rounded-full transition-all duration-500"
                  style={{ width: `${hasNoData ? 0 : viewShare}%`, background: `hsl(${platformColor})`, boxShadow: `0 0 10px hsl(${platformColor} / 0.55)` }}
                />
              </div>

              <div className="mt-3 flex items-end justify-between gap-3 pt-2" style={{ borderTop: "1px solid hsl(var(--glow-purple) / 0.18)" }}>
                {inf.topCampaign ? (
                  <span
                    className="inline-flex min-w-0 max-w-[75%] items-center rounded-full px-2 py-1 text-xs text-muted-foreground"
                    style={{ background: "hsl(248 60% 12%)", border: "1px solid hsl(var(--glow-purple) / 0.32)", boxShadow: "0 0 10px hsl(var(--glow-purple) / 0.12)" }}
                  >
                    <span className="shrink-0">Top:&nbsp;</span><span className="truncate text-foreground">{inf.topCampaign}</span>
                  </span>
                ) : (
                  <span />
                )}
                <div className="shrink-0 text-xs font-medium text-[hsl(var(--glow-cyan))] opacity-0 transition-opacity group-hover:opacity-100">
                  View details →
                </div>
              </div>
            </Card>
          );
        })}
      </div>
    </div>
  );
};

const Stat = ({ label, value, valueClass }: { label: string; value: string; valueClass?: string }) => (
  <div
    className="rounded-md p-2"
    style={{ background: "hsl(248 50% 9%)", border: "1px solid hsl(var(--glow-purple) / 0.12)" }}
  >
    <div className="stat-label">{label}</div>
    <div className={cn("text-sm font-bold text-foreground", valueClass)}>{value}</div>
  </div>
);

// expose unused re-export for ts
export { formatNumber };
