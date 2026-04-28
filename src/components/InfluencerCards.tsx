import { Eye, Sparkles } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { COUNTRY_FLAGS } from "@/lib/countries";
import type { InfluencerSummary } from "@/lib/calculations";
import { formatCompact, formatCurrency, formatNumber } from "@/lib/formatters";
import { cn } from "@/lib/utils";

interface Props {
  influencers: InfluencerSummary[];
  currency?: string;
  onSelectInfluencer?: (influencer: InfluencerSummary) => void;
}

const platformClass = (p: string) => {
  if (p === "YouTube") return "bg-[hsl(var(--platform-youtube)/0.15)] text-[hsl(var(--platform-youtube))]";
  if (p === "Instagram") return "bg-[hsl(var(--platform-instagram)/0.15)] text-[hsl(var(--platform-instagram))]";
  if (p === "Story") return "bg-[hsl(var(--platform-story)/0.18)] text-[hsl(var(--platform-story))]";
  return "bg-[hsl(var(--platform-shorts)/0.15)] text-[hsl(var(--platform-shorts))]";
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

  return (
    <div className="px-6 pt-6">
      <h2 className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        Top Influencers
      </h2>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {influencers.slice(0, 12).map((inf) => {
          const roiPos = (inf.roi ?? 0) >= 0;
          return (
            <Card
              key={inf.key}
              onClick={() => onSelectInfluencer?.(inf)}
              className="group cursor-pointer border-border bg-card p-4 transition-all hover:-translate-y-0.5 hover:border-primary/40 hover:bg-card-hover hover:shadow-lg"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <div className="truncate text-base font-bold text-foreground">{inf.influencer}</div>
                  <div className="mt-0.5 flex items-center gap-1.5 text-xs text-muted-foreground">
                    <span>{COUNTRY_FLAGS[inf.country]}</span>
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

              <div className="mt-4 grid grid-cols-2 gap-2 text-xs">
                <Stat label="Views" value={formatCompact(inf.totalViews)} />
                {inf.roi == null ? (
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <div><Stat label="ROI" value="—" /></div>
                    </TooltipTrigger>
                    <TooltipContent>No spend data entered</TooltipContent>
                  </Tooltip>
                ) : (
                  <Stat
                    label="ROI"
                    value={`${roiPos ? "+" : ""}${inf.roi.toFixed(0)}%`}
                    valueClass={roiPos ? "text-success" : "text-destructive"}
                  />
                )}
                <Stat label="Spend" value={formatCurrency(inf.totalSpend, currency)} />
                <Stat
                  label="Revenue"
                  value={formatCurrency(inf.totalRevenue, currency)}
                  valueClass={inf.totalRevenue > 0 ? "text-success" : undefined}
                />
              </div>

              {inf.topCampaign && (
                <div className="mt-3 border-t border-border pt-2">
                  <span className="inline-flex max-w-full items-center rounded-full bg-muted/60 px-2 py-1 text-xs text-muted-foreground">
                    <span className="shrink-0">Top:&nbsp;</span><span className="truncate text-foreground">{inf.topCampaign}</span>
                  </span>
                </div>
              )}
              <div className="mt-3 text-xs font-medium text-primary opacity-0 transition-opacity group-hover:opacity-100">
                View details →
              </div>
            </Card>
          );
        })}
      </div>
    </div>
  );
};

const Stat = ({ label, value, valueClass }: { label: string; value: string; valueClass?: string }) => (
  <div className="rounded-md bg-muted/50 p-2">
    <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</div>
    <div className={cn("text-sm font-bold text-foreground", valueClass)}>{value}</div>
  </div>
);

// expose unused re-export for ts
export { formatNumber };
