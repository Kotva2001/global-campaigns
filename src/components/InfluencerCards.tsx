import { Card } from "@/components/ui/card";
import { COUNTRY_FLAGS } from "@/lib/countries";
import type { InfluencerSummary } from "@/lib/calculations";
import { formatCompact, formatCurrency, formatNumber } from "@/lib/formatters";
import { cn } from "@/lib/utils";

interface Props {
  influencers: InfluencerSummary[];
}

const platformClass = (p: string) => {
  if (p === "YouTube") return "bg-[hsl(var(--platform-youtube)/0.15)] text-[hsl(var(--platform-youtube))]";
  if (p === "Instagram") return "bg-[hsl(var(--platform-instagram)/0.15)] text-[hsl(var(--platform-instagram))]";
  return "bg-[hsl(var(--platform-shorts)/0.15)] text-[hsl(var(--platform-shorts))]";
};

export const InfluencerCards = ({ influencers }: Props) => {
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
              className="group border-border bg-card p-4 transition-all hover:border-primary/40 hover:bg-card-hover"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <div className="truncate text-base font-bold text-foreground">{inf.influencer}</div>
                  <div className="mt-0.5 flex items-center gap-1.5 text-xs text-muted-foreground">
                    <span>{COUNTRY_FLAGS[inf.country]}</span>
                    <span>{inf.country}</span>
                    <span>·</span>
                    <span>{inf.campaigns} campaign{inf.campaigns === 1 ? "" : "s"}</span>
                  </div>
                </div>
              </div>

              <div className="mt-3 flex flex-wrap gap-1">
                {inf.platforms.map((p) => (
                  <span
                    key={p}
                    className={cn("rounded-full px-2 py-0.5 text-[10px] font-semibold", platformClass(p))}
                  >
                    {p}
                  </span>
                ))}
              </div>

              <div className="mt-4 grid grid-cols-2 gap-2 text-xs">
                <Stat label="Views" value={formatCompact(inf.totalViews)} />
                <Stat
                  label="ROI"
                  value={inf.roi == null ? "—" : `${roiPos ? "+" : ""}${inf.roi.toFixed(0)}%`}
                  valueClass={inf.roi == null ? undefined : roiPos ? "text-success" : "text-destructive"}
                />
                <Stat label="Spend" value={formatCurrency(inf.totalSpend)} />
                <Stat
                  label="Revenue"
                  value={formatCurrency(inf.totalRevenue)}
                  valueClass={inf.totalRevenue > 0 ? "text-success" : undefined}
                />
              </div>

              {inf.topCampaign && (
                <div className="mt-3 truncate border-t border-border pt-2 text-xs text-muted-foreground">
                  Top: <span className="text-foreground">{inf.topCampaign}</span>
                </div>
              )}
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
