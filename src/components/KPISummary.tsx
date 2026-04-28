import { Activity, Eye, Wallet, TrendingUp, Percent, DollarSign, Sparkles } from "lucide-react";
import { Card } from "@/components/ui/card";
import { formatCurrency, formatNumber, formatPercent } from "@/lib/formatters";
import type { KPISet } from "@/lib/calculations";
import { cn } from "@/lib/utils";

interface Props {
  kpis: KPISet;
  currency?: string;
  convertedSub?: string;
  onSelectMetric?: (metric: "campaigns" | "stories" | "totalViews" | "totalSpend" | "totalRevenue" | "roi" | "avgEngagement") => void;
}

export const KPISummary = ({ kpis, currency = "CZK", convertedSub, onSelectMetric }: Props) => {
  const roiPositive = (kpis.roi ?? 0) >= 0;
  return (
    <div className="grid grid-cols-2 gap-3 px-6 pt-6 md:grid-cols-3 xl:grid-cols-7">
      <KPI
        icon={<Activity className="h-4 w-4" />}
        label="Campaigns"
        value={formatNumber(kpis.campaigns)}
        sub={`${kpis.influencers} influencers`}
        onClick={() => onSelectMetric?.("campaigns")}
      />
      <KPI
        icon={<Sparkles className="h-4 w-4" />}
        label="Stories"
        value={formatNumber(kpis.stories)}
        sub="IG Stories logged"
        valueClass="text-[hsl(var(--platform-story))]"
        onClick={() => onSelectMetric?.("stories")}
      />
      <KPI
        icon={<Eye className="h-4 w-4" />}
        label="Total Views"
        value={formatNumber(kpis.totalViews)}
        sub={`${formatNumber(kpis.totalLikes)} likes`}
        onClick={() => onSelectMetric?.("totalViews")}
      />
      <KPI
        icon={<Wallet className="h-4 w-4" />}
        label="Total Spend"
        value={formatCurrency(kpis.totalSpend, currency)}
        sub={convertedSub}
        onClick={() => onSelectMetric?.("totalSpend")}
      />
      <KPI
        icon={<DollarSign className="h-4 w-4" />}
        label="Revenue"
        value={formatCurrency(kpis.totalRevenue, currency)}
        sub={convertedSub}
        valueClass={kpis.totalRevenue > 0 ? "text-success" : undefined}
        onClick={() => onSelectMetric?.("totalRevenue")}
      />
      <KPI
        icon={<TrendingUp className="h-4 w-4" />}
        label="Overall ROI"
        value={kpis.roi == null ? "—" : `${kpis.roi >= 0 ? "+" : ""}${kpis.roi.toFixed(1)} %`}
        valueClass={
          kpis.roi == null ? undefined : roiPositive ? "text-success" : "text-destructive"
        }
        onClick={() => onSelectMetric?.("roi")}
      />
      <KPI
        icon={<Percent className="h-4 w-4" />}
        label="Avg Engagement"
        value={formatPercent(kpis.avgEngagement)}
        onClick={() => onSelectMetric?.("avgEngagement")}
      />
    </div>
  );
};

const KPI = ({
  icon,
  label,
  value,
  sub,
  valueClass,
  onClick,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  sub?: string;
  valueClass?: string;
  onClick?: () => void;
}) => (
  <Card
    onClick={onClick}
    role={onClick ? "button" : undefined}
    tabIndex={onClick ? 0 : undefined}
    onKeyDown={onClick ? (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onClick(); } } : undefined}
    className={cn(
      "border-border bg-card p-4 transition-all",
      onClick && "cursor-pointer hover:-translate-y-0.5 hover:border-primary/40 hover:bg-card-hover hover:shadow-md focus:outline-none focus:ring-2 focus:ring-primary/40",
      !onClick && "hover:bg-card-hover",
    )}
  >
    <div className="flex items-center justify-between text-muted-foreground">
      <span className="text-xs font-medium uppercase tracking-wider">{label}</span>
      <span className="text-primary/70">{icon}</span>
    </div>
    <div className={cn("mt-2 text-2xl font-bold tracking-tight text-foreground", valueClass)}>
      {value}
    </div>
    {sub && <div className="mt-1.5 text-[11px] leading-snug text-muted-foreground">{sub}</div>}
  </Card>
);
